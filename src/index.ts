import { 
    SystemConfig,
    Vector,
    SearchResult,
    SystemError,
    ErrorType,
    RaftState,
    RaftMessage,
    MessageType,
    CommandType,
    RaftCommand,
    HealthStatus
} from './types';
import { HNSWGraph } from './search/hnsw';
import { RaftNode } from './consensus/raft';
import { RaftStorage } from './consensus/storage';
import { RaftNetwork } from './consensus/network';
import { initSIMD } from './search/vector';
import { networkLogger, raftLogger, searchLogger } from './utils/logger';

/**
 * Universal Search Hub Implementation
 */
export class UniversalSearchHub {
    private readonly searchGraph: HNSWGraph;
    private readonly raftNode: RaftNode;
    private readonly storage: RaftStorage;
    private readonly network: RaftNetwork;
    private initialized: boolean = false;

    constructor(private readonly config: SystemConfig) {
        this.validateConfig(config);
        this.searchGraph = new HNSWGraph(config.hnsw);
        this.storage = new RaftStorage(config.nodeId, config.storage.dataDir);
        this.network = new RaftNetwork(config.nodeId, config.peers, config.network);
        this.raftNode = new RaftNode(
            config.nodeId,
            config.peers,
            {
                ...config.raft,
                snapshotThreshold: config.storage.snapshotThreshold
            },
            this.handleRaftMessage.bind(this),
            this.handleRaftCommand.bind(this)
        );
    }

    /**
     * Initialize the system
     */
    public async initialize(): Promise<void> {
        if (this.initialized) return;

        try {
            // Initialize WASM SIMD
            await initSIMD();

            // Initialize storage
            await this.storage.initialize();

            // Initialize network
            await this.network.initialize();

            // Initialize Raft node
            await this.raftNode.initialize(this.storage);

            // Setup network message handling
            this.network.on('message', (message: RaftMessage) => {
                this.raftNode.handleMessage(message);
            });

            this.network.on('error', (error: Error) => {
                networkLogger.error('Network error:', error);
            });

            this.initialized = true;
            raftLogger.info('Node initialized successfully');
        } catch (error) {
            throw new SystemError(
                ErrorType.SYSTEM,
                'INIT_FAILED',
                'Failed to initialize node',
                error
            );
        }
    }

    /**
     * Validate system configuration
     */
    private validateConfig(config: SystemConfig): void {
        if (!config.nodeId) {
            throw new SystemError(
                ErrorType.SYSTEM,
                'INVALID_CONFIG',
                'Node ID is required'
            );
        }
        if (!config.peers || !Array.isArray(config.peers)) {
            throw new SystemError(
                ErrorType.SYSTEM,
                'INVALID_CONFIG',
                'Peers must be an array'
            );
        }
        if (!config.storage?.dataDir) {
            throw new SystemError(
                ErrorType.SYSTEM,
                'INVALID_CONFIG',
                'Storage directory is required'
            );
        }
    }

    /**
     * Handle Raft messages
     */
    private async handleRaftMessage(message: RaftMessage): Promise<void> {
        try {
            await this.network.sendMessage(message.to, message);
        } catch (error) {
            networkLogger.error('Failed to send message:', error);
        }
    }

    /**
     * Handle committed Raft commands
     */
    private async handleRaftCommand(command: RaftCommand): Promise<void> {
        try {
            switch (command.type) {
                case CommandType.INSERT:
                    if (command.data.id !== undefined && command.data.vector) {
                        this.searchGraph.insert(command.data.vector, command.data.id);
                    }
                    break;

                case CommandType.DELETE:
                    if (command.data.id !== undefined) {
                        this.searchGraph.delete(command.data.id);
                    }
                    break;

                case CommandType.UPDATE:
                    if (command.data.id !== undefined && command.data.vector) {
                        this.searchGraph.delete(command.data.id);
                        this.searchGraph.insert(command.data.vector, command.data.id);
                    }
                    break;

                default:
                    throw new SystemError(
                        ErrorType.SYSTEM,
                        'INVALID_COMMAND',
                        `Unknown command type: ${command.type}`
                    );
            }
        } catch (error) {
            searchLogger.error('Failed to execute command:', error);
            throw error;
        }
    }

    /**
     * Insert vector into the search graph
     */
    public async insert(vector: Vector, id?: number): Promise<number> {
        if (!this.initialized) {
            throw new SystemError(
                ErrorType.SYSTEM,
                'NOT_INITIALIZED',
                'System not initialized'
            );
        }

        if (this.raftNode.getStatus().state !== RaftState.LEADER) {
            throw new SystemError(
                ErrorType.CONSENSUS,
                'NOT_LEADER',
                'Not the leader node'
            );
        }

        const command: RaftCommand = {
            type: CommandType.INSERT,
            data: { vector, id }
        };

        await this.raftNode.submitCommand(command);
        return id ?? this.searchGraph.getStats().nodeCount - 1;
    }

    /**
     * Search for nearest neighbors
     */
    public search(query: Vector, k: number): SearchResult[] {
        if (!this.initialized) {
            throw new SystemError(
                ErrorType.SYSTEM,
                'NOT_INITIALIZED',
                'System not initialized'
            );
        }

        return this.searchGraph.search(query, k);
    }

    /**
     * Delete vector from the search graph
     */
    public async delete(id: number): Promise<void> {
        if (!this.initialized) {
            throw new SystemError(
                ErrorType.SYSTEM,
                'NOT_INITIALIZED',
                'System not initialized'
            );
        }

        if (this.raftNode.getStatus().state !== RaftState.LEADER) {
            throw new SystemError(
                ErrorType.CONSENSUS,
                'NOT_LEADER',
                'Not the leader node'
            );
        }

        const command: RaftCommand = {
            type: CommandType.DELETE,
            data: { id }
        };

        await this.raftNode.submitCommand(command);
    }

    /**
     * Update vector in the search graph
     */
    public async update(id: number, vector: Vector): Promise<void> {
        if (!this.initialized) {
            throw new SystemError(
                ErrorType.SYSTEM,
                'NOT_INITIALIZED',
                'System not initialized'
            );
        }

        if (this.raftNode.getStatus().state !== RaftState.LEADER) {
            throw new SystemError(
                ErrorType.CONSENSUS,
                'NOT_LEADER',
                'Not the leader node'
            );
        }

        const command: RaftCommand = {
            type: CommandType.UPDATE,
            data: { id, vector }
        };

        await this.raftNode.submitCommand(command);
    }

    /**
     * Get system metrics
     */
    public getMetrics(): {
        raftStatus: {
            nodeId: string;
            state: RaftState;
            term: number;
            logLength: number;
            commitIndex: number;
            leaderId: string | null;
        };
        graphStats: {
            nodeCount: number;
            maxLevel: number;
            averageConnections: number;
            memoryUsage: number;
        };
        networkStatus: Record<string, boolean>;
        health: HealthStatus;
    } {
        if (!this.initialized) {
            throw new SystemError(
                ErrorType.SYSTEM,
                'NOT_INITIALIZED',
                'System not initialized'
            );
        }

        return {
            raftStatus: this.raftNode.getStatus(),
            graphStats: this.searchGraph.getStats(),
            networkStatus: this.network.getStatus(),
            health: this.getHealth()
        };
    }

    /**
     * Get system health status
     */
    private getHealth(): HealthStatus {
        const warnings: string[] = [];
        
        // Check Raft status
        const raftStatus = this.raftNode.getStatus();
        if (raftStatus.state === RaftState.CANDIDATE) {
            warnings.push('Node is in candidate state');
        }

        // Check network status
        const networkStatus = this.network.getStatus();
        const disconnectedPeers = Object.entries(networkStatus)
            .filter(([_, connected]) => !connected)
            .map(([peer]) => peer);
        
        if (disconnectedPeers.length > 0) {
            warnings.push(`Disconnected peers: ${disconnectedPeers.join(', ')}`);
        }

        // Count active connections
        const activeConnections = Object.values(networkStatus)
            .filter(connected => connected).length;

        return {
            status: warnings.length === 0 ? 'healthy' :
                    warnings.length < 3 ? 'degraded' : 'unhealthy',
            lastHeartbeat: Date.now(),
            activeConnections,
            errorRate: 0, // TODO: Implement error rate tracking
            warnings
        };
    }

    /**
     * Stop the system
     */
    public async stop(): Promise<void> {
        if (!this.initialized) return;

        try {
            await this.raftNode.stop();
            this.network.stop();
            await this.storage.close();
            this.initialized = false;
            raftLogger.info('Node stopped successfully');
        } catch (error) {
            throw new SystemError(
                ErrorType.SYSTEM,
                'STOP_FAILED',
                'Failed to stop node',
                error
            );
        }
    }
}
