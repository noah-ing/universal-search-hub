// src/index.ts

import { 
    SystemConfig, 
    RaftCommand, 
    CommandType, 
    Vector, 
    SearchResult, 
    SystemError, 
    ErrorType,
    RaftState,
    RaftMessage,
    MessageType
} from './types';
import { HNSWGraph, hnswMetrics } from './search/hnsw';
import { RaftNode } from './consensus/raft';
import { initSIMD, vectorMetrics } from './search/vector';
import WebSocket from 'ws';

/**
 * Universal Search Hub Implementation
 */
export class UniversalSearchHub {
    private readonly config: SystemConfig;
    private readonly searchGraph: HNSWGraph;
    private readonly raftNode: RaftNode;
    private readonly wsServer: WebSocket.Server;
    private readonly peers: Map<string, WebSocket>;
    private readonly metrics: {
        startTime: number;
        operations: number;
        errors: number;
        lastHealthCheck: number;
    };

    constructor(config: SystemConfig) {
        this.validateConfig(config);
        this.config = config;
        this.searchGraph = new HNSWGraph(config.hnsw);
        this.peers = new Map();
        this.metrics = {
            startTime: Date.now(),
            operations: 0,
            errors: 0,
            lastHealthCheck: Date.now()
        };

        // Initialize SIMD operations
        this.initializeSIMD();

        // Initialize Raft consensus
        this.raftNode = new RaftNode(
            config.nodeId,
            config.peers,
            config.raft,
            this.handleRaftMessage.bind(this),
            this.handleRaftCommand.bind(this)
        );

        // Initialize WebSocket server
        this.wsServer = new WebSocket.Server({ port: this.getPortFromNodeId() });
        this.setupWebSocket();

        // Start monitoring
        this.startMonitoring();
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
    }

    /**
     * Initialize SIMD operations
     */
    private async initializeSIMD(): Promise<void> {
        try {
            await initSIMD();
        } catch (error) {
            console.warn('SIMD initialization failed, falling back to JS implementation');
        }
    }

    /**
     * Extract port number from node ID
     */
    private getPortFromNodeId(): number {
        const port = parseInt(this.config.nodeId.split(':')[1]);
        if (isNaN(port)) {
            throw new SystemError(
                ErrorType.SYSTEM,
                'INVALID_NODE_ID',
                'Node ID must contain valid port number'
            );
        }
        return port;
    }

    /**
     * Setup WebSocket server and connections
     */
    private setupWebSocket(): void {
        this.wsServer.on('connection', (ws: WebSocket, req: any) => {
            const peerId = req.headers['x-peer-id'];
            if (!peerId || !this.config.peers.includes(peerId)) {
                ws.close();
                return;
            }

            this.peers.set(peerId, ws);

            ws.on('message', (data: WebSocket.Data) => {
                try {
                    const message = JSON.parse(data.toString()) as RaftMessage;
                    if (message.to === this.config.nodeId) {
                        this.raftNode.handleMessage(message);
                    }
                } catch (error) {
                    this.metrics.errors++;
                    console.error('Error processing message:', error);
                }
            });

            ws.on('close', () => {
                this.peers.delete(peerId);
            });
        });
    }

    /**
     * Handle Raft messages
     */
    private handleRaftMessage(message: RaftMessage): void {
        const peer = this.peers.get(message.to);
        if (peer && peer.readyState === WebSocket.OPEN) {
            peer.send(JSON.stringify(message));
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
            this.metrics.operations++;
        } catch (error) {
            this.metrics.errors++;
            throw error;
        }
    }

    /**
     * Start monitoring system health and metrics
     */
    private startMonitoring(): void {
        // Collect metrics
        setInterval(() => {
            const stats = this.searchGraph.getStats();
            const status = this.raftNode.getStatus();
            const metrics = {
                uptime: Date.now() - this.metrics.startTime,
                operations: this.metrics.operations,
                errors: this.metrics.errors,
                searchMetrics: hnswMetrics.getMetrics(),
                vectorMetrics: vectorMetrics.getMetrics(),
                graphStats: stats,
                raftStatus: status,
                activeConnections: this.peers.size
            };

            // Log metrics
            console.log('System Metrics:', JSON.stringify(metrics, null, 2));
        }, this.config.monitoring.metricsInterval);

        // Health checks
        setInterval(() => {
            this.metrics.lastHealthCheck = Date.now();
            const health = this.getHealth();
            if (health.status !== 'healthy') {
                console.warn('Health Check Warning:', health);
            }
        }, this.config.monitoring.healthCheckInterval);
    }

    /**
     * Get system health status
     */
    private getHealth(): {
        status: 'healthy' | 'degraded' | 'unhealthy';
        warnings: string[];
    } {
        const warnings: string[] = [];
        
        // Check Raft status
        const raftStatus = this.raftNode.getStatus();
        if (raftStatus.state === RaftState.CANDIDATE) {
            warnings.push('Node is in candidate state');
        }

        // Check peer connections
        if (this.peers.size < this.config.peers.length) {
            warnings.push('Missing peer connections');
        }

        // Check error rate
        const errorRate = this.metrics.errors / Math.max(1, this.metrics.operations);
        if (errorRate > 0.01) {
            warnings.push('High error rate detected');
        }

        // Check search metrics
        const searchMetrics = hnswMetrics.getMetrics();
        if (searchMetrics.avgSearchTime > 1) { // > 1ms
            warnings.push('Search latency above threshold');
        }

        return {
            status: warnings.length === 0 ? 'healthy' :
                    warnings.length < 3 ? 'degraded' : 'unhealthy',
            warnings
        };
    }

    /**
     * Insert vector into the search graph
     */
    public async insert(vector: Vector, id?: number): Promise<number> {
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

        this.raftNode.submitCommand(command);
        return id ?? this.metrics.operations;
    }

    /**
     * Search for nearest neighbors
     */
    public search(query: Vector, k: number): SearchResult[] {
        // Search can be performed on any node
        return this.searchGraph.search(query, k);
    }

    /**
     * Delete vector from the search graph
     */
    public delete(id: number): void {
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

        this.raftNode.submitCommand(command);
    }

    /**
     * Update vector in the search graph
     */
    public update(id: number, vector: Vector): void {
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

        this.raftNode.submitCommand(command);
    }

    /**
     * Get system metrics
     */
    public getMetrics(): any {
        return {
            uptime: Date.now() - this.metrics.startTime,
            operations: this.metrics.operations,
            errors: this.metrics.errors,
            searchMetrics: hnswMetrics.getMetrics(),
            vectorMetrics: vectorMetrics.getMetrics(),
            graphStats: this.searchGraph.getStats(),
            raftStatus: this.raftNode.getStatus(),
            activeConnections: this.peers.size,
            health: this.getHealth()
        };
    }

    /**
     * Gracefully stop the system
     */
    public stop(): void {
        this.raftNode.stop();
        this.wsServer.close();
        for (const peer of this.peers.values()) {
            peer.close();
        }
    }
}