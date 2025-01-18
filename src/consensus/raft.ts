import {
    RaftState,
    LogEntry,
    RaftMessage,
    VoteRequest,
    VoteResponse,
    AppendEntries,
    AppendResponse,
    MessageType,
    RaftCommand,
    SystemError,
    ErrorType,
    InstallSnapshot,
    SnapshotResponse,
    CommandType
} from '../types';
import { RaftStorage } from './storage';
import { raftLogger } from '../utils/logger';

/**
 * Raft Node Implementation
 */
export class RaftNode {
    private state: RaftState = RaftState.FOLLOWER;
    private currentTerm: number = 0;
    private votedFor: string | null = null;
    private log: LogEntry[] = [];
    private commitIndex: number = -1;
    private lastApplied: number = -1;
    private nextIndex: Map<string, number> = new Map();
    private matchIndex: Map<string, number> = new Map();
    private leaderId: string | null = null;
    private electionTimeout: NodeJS.Timeout | null = null;
    private heartbeatInterval: NodeJS.Timeout | null = null;
    private storage: RaftStorage | null = null;
    private initialized: boolean = false;
    private clusterConfig: string[];
    private configChangeInProgress: boolean = false;
    private lastSnapshotIndex: number = -1;
    private lastSnapshotTerm: number = 0;

    constructor(
        private readonly nodeId: string,
        private readonly peers: string[],
        private readonly config: {
            heartbeatTimeout: number;
            electionTimeoutMin: number;
            electionTimeoutMax: number;
            batchSize: number;
            snapshotThreshold: number;
        },
        private readonly messageCallback: (msg: RaftMessage) => void,
        private readonly commitCallback: (command: RaftCommand) => void
    ) {
        this.clusterConfig = [nodeId, ...peers];
        // Initialize peer tracking
        for (const peer of peers) {
            this.nextIndex.set(peer, 0);
            this.matchIndex.set(peer, -1);
        }
    }

    /**
     * Generate random election timeout
     */
    private getRandomTimeout(): number {
        return Math.floor(
            Math.random() * 
            (this.config.electionTimeoutMax - this.config.electionTimeoutMin) + 
            this.config.electionTimeoutMin
        );
    }

    /**
     * Reset election timeout
     */
    private resetElectionTimeout(): void {
        if (this.electionTimeout) {
            clearTimeout(this.electionTimeout);
        }

        this.electionTimeout = setTimeout(
            () => this.startElection(),
            this.getRandomTimeout()
        );
    }

    /**
     * Start leader election
     */
    private async startElection(): Promise<void> {
        if (!this.initialized) return;

        this.state = RaftState.CANDIDATE;
        this.currentTerm++;
        this.votedFor = this.nodeId;
        this.leaderId = null;

        // Persist state changes
        await this.storage?.saveTerm(this.currentTerm);
        await this.storage?.saveVotedFor(this.votedFor);
        await this.storage?.saveState(this.state);

        // In single-node mode, immediately become leader
        if (this.peers.length === 0) {
            await this.becomeLeader();
            return;
        }

        const lastLog = this.log[this.log.length - 1];
        const request: VoteRequest = {
            type: MessageType.VOTE_REQUEST,
            term: this.currentTerm,
            from: this.nodeId,
            to: '',
            lastLogIndex: this.log.length - 1,
            lastLogTerm: lastLog ? lastLog.term : 0
        };

        // Request votes from all peers
        for (const peer of this.clusterConfig.filter(id => id !== this.nodeId)) {
            request.to = peer;
            this.messageCallback(request);
        }

        // Reset election timeout
        this.resetElectionTimeout();
    }

    /**
     * Start sending heartbeats (leader only)
     */
    private startHeartbeat(): void {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }

        this.heartbeatInterval = setInterval(() => {
            for (const peer of this.clusterConfig.filter(id => id !== this.nodeId)) {
                this.sendAppendEntries(peer);
            }
        }, this.config.heartbeatTimeout);
    }

    /**
     * Send AppendEntries RPC to a peer
     */
    private sendAppendEntries(peerId: string): void {
        if (!this.initialized) return;

        const nextIdx = this.nextIndex.get(peerId)!;
        const prevLogIndex = nextIdx - 1;
        const prevLog = this.log[prevLogIndex];
        const entries = this.log.slice(
            nextIdx,
            nextIdx + this.config.batchSize
        );

        const request: AppendEntries = {
            type: MessageType.APPEND_ENTRIES,
            term: this.currentTerm,
            from: this.nodeId,
            to: peerId,
            prevLogIndex,
            prevLogTerm: prevLog ? prevLog.term : 0,
            entries,
            leaderCommit: this.commitIndex
        };

        this.messageCallback(request);
    }

    /**
     * Handle VoteRequest RPC
     */
    private async handleVoteRequest(request: VoteRequest): Promise<void> {
        const response: VoteResponse = {
            type: MessageType.VOTE_RESPONSE,
            term: this.currentTerm,
            from: this.nodeId,
            to: request.from,
            granted: false
        };

        if (request.term < this.currentTerm) {
            this.messageCallback(response);
            return;
        }

        const lastLog = this.log[this.log.length - 1];
        const lastLogTerm = lastLog ? lastLog.term : 0;
        const lastLogIndex = this.log.length - 1;

        if (
            (this.votedFor === null || this.votedFor === request.from) &&
            (request.lastLogTerm > lastLogTerm ||
            (request.lastLogTerm === lastLogTerm &&
             request.lastLogIndex >= lastLogIndex))
        ) {
            this.votedFor = request.from;
            response.granted = true;
            this.resetElectionTimeout();

            // Persist vote
            await this.storage?.saveVotedFor(this.votedFor);
        }

        this.messageCallback(response);
    }

    /**
     * Handle VoteResponse RPC
     */
    private async handleVoteResponse(response: VoteResponse): Promise<void> {
        if (
            this.state !== RaftState.CANDIDATE ||
            response.term < this.currentTerm
        ) {
            return;
        }

        if (response.granted) {
            let votesReceived = 1; // Count self vote
            for (const peer of this.peers) {
                if (peer === response.from && response.granted) {
                    votesReceived++;
                }
            }

            const votesNeeded = Math.floor((this.clusterConfig.length) / 2) + 1;
            if (votesReceived >= votesNeeded) {
                await this.becomeLeader();
            }
        }
    }

    /**
     * Handle AppendEntries RPC
     */
    private async handleAppendEntries(request: AppendEntries): Promise<void> {
        const response: AppendResponse = {
            type: MessageType.APPEND_RESPONSE,
            term: this.currentTerm,
            from: this.nodeId,
            to: request.from,
            success: false
        };

        if (request.term < this.currentTerm) {
            this.messageCallback(response);
            return;
        }

        this.resetElectionTimeout();
        this.leaderId = request.from;
        this.state = RaftState.FOLLOWER;

        // Persist state
        await this.storage?.saveState(this.state);

        // Check if log contains an entry at prevLogIndex with prevLogTerm
        if (
            request.prevLogIndex > -1 &&
            (this.log.length <= request.prevLogIndex ||
             this.log[request.prevLogIndex].term !== request.prevLogTerm)
        ) {
            this.messageCallback(response);
            return;
        }

        // Find conflicting entries
        let newEntries = request.entries;
        let conflictIndex = -1;
        for (let i = 0; i < newEntries.length; i++) {
            const index = request.prevLogIndex + 1 + i;
            if (
                index < this.log.length &&
                this.log[index].term !== newEntries[i].term
            ) {
                conflictIndex = index;
                break;
            }
        }

        // Remove conflicting entries and append new ones
        if (conflictIndex !== -1) {
            this.log = this.log.slice(0, conflictIndex);
            await this.storage?.deleteLogEntriesFrom(conflictIndex);
        }

        // Append new entries
        if (newEntries.length > 0) {
            this.log = this.log.concat(newEntries);
            await this.storage?.appendLogEntries(newEntries);
        }

        // Update commit index
        if (request.leaderCommit > this.commitIndex) {
            this.commitIndex = Math.min(
                request.leaderCommit,
                this.log.length - 1
            );
            await this.applyCommitted();
        }

        response.success = true;
        response.matchIndex = request.prevLogIndex + newEntries.length;
        this.messageCallback(response);
    }

    /**
     * Handle AppendResponse RPC
     */
    private async handleAppendResponse(response: AppendResponse): Promise<void> {
        if (
            this.state !== RaftState.LEADER ||
            response.term < this.currentTerm
        ) {
            return;
        }

        if (response.success) {
            if (response.matchIndex !== undefined) {
                this.matchIndex.set(response.from, response.matchIndex);
                this.nextIndex.set(response.from, response.matchIndex + 1);
            }

            // Check if we can commit more entries
            const matchIndexes = Array.from(this.matchIndex.values())
                .concat(this.log.length - 1)
                .sort((a, b) => b - a);
            
            const majorityIndex = matchIndexes[
                Math.floor(this.clusterConfig.length / 2)
            ];

            if (
                majorityIndex > this.commitIndex &&
                this.log[majorityIndex].term === this.currentTerm
            ) {
                this.commitIndex = majorityIndex;
                await this.applyCommitted();
            }
        } else {
            // Decrement nextIndex and retry
            const nextIdx = this.nextIndex.get(response.from)!;
            this.nextIndex.set(response.from, Math.max(0, nextIdx - 1));
            this.sendAppendEntries(response.from);
        }
    }

    /**
     * Handle InstallSnapshot RPC
     */
    private async handleInstallSnapshot(request: InstallSnapshot): Promise<void> {
        if (!this.storage) return;

        const response: SnapshotResponse = {
            type: MessageType.SNAPSHOT_RESPONSE,
            term: this.currentTerm,
            from: this.nodeId,
            to: request.from,
            success: false
        };

        if (request.term < this.currentTerm) {
            this.messageCallback(response);
            return;
        }

        this.resetElectionTimeout();
        this.leaderId = request.from;
        this.state = RaftState.FOLLOWER;

        try {
            if (request.lastIncludedIndex > this.lastSnapshotIndex) {
                // Save snapshot
                await this.storage.createSnapshot(
                    request.lastIncludedIndex,
                    request.lastIncludedTerm,
                    request.data,
                    this.clusterConfig
                );

                this.lastSnapshotIndex = request.lastIncludedIndex;
                this.lastSnapshotTerm = request.lastIncludedTerm;

                // Update log
                this.log = this.log.filter(entry => entry.index > request.lastIncludedIndex);

                // Apply snapshot
                await this.commitCallback({
                    type: CommandType.CHANGE_CONFIG,
                    data: { config: this.clusterConfig }
                });

                response.success = true;
            }
        } catch (error) {
            raftLogger.error({
                nodeId: this.nodeId,
                error
            }, 'Failed to install snapshot');
        }

        this.messageCallback(response);
    }

    /**
     * Create and install snapshot
     */
    private async createSnapshot(): Promise<void> {
        if (!this.storage) return;

        const lastEntry = this.log[this.log.length - 1];
        if (!lastEntry) return;

        try {
            await this.storage.createSnapshot(
                lastEntry.index,
                lastEntry.term,
                { lastApplied: this.lastApplied },
                this.clusterConfig
            );

            this.lastSnapshotIndex = lastEntry.index;
            this.lastSnapshotTerm = lastEntry.term;

            // Clear log entries up to snapshot
            this.log = this.log.slice(lastEntry.index + 1);

            raftLogger.info({
                nodeId: this.nodeId,
                snapshotIndex: this.lastSnapshotIndex,
                snapshotTerm: this.lastSnapshotTerm
            }, 'Created snapshot');
        } catch (error) {
            raftLogger.error({
                nodeId: this.nodeId,
                error
            }, 'Failed to create snapshot');
        }
    }

    /**
     * Handle cluster membership changes
     */
    private async handleConfigChange(command: RaftCommand): Promise<void> {
        if (this.configChangeInProgress) {
            throw new SystemError(
                ErrorType.CONSENSUS,
                'CONFIG_CHANGE_IN_PROGRESS',
                'Another configuration change is in progress'
            );
        }

        this.configChangeInProgress = true;

        try {
            switch (command.type) {
                case CommandType.ADD_SERVER:
                    if (command.data.serverId && !this.clusterConfig.includes(command.data.serverId)) {
                        this.clusterConfig = [...this.clusterConfig, command.data.serverId];
                        this.nextIndex.set(command.data.serverId, this.log.length);
                        this.matchIndex.set(command.data.serverId, -1);
                    }
                    break;

                case CommandType.REMOVE_SERVER:
                    if (command.data.serverId && command.data.serverId !== this.nodeId) {
                        this.clusterConfig = this.clusterConfig.filter(id => id !== command.data.serverId);
                        this.nextIndex.delete(command.data.serverId);
                        this.matchIndex.delete(command.data.serverId);
                    }
                    break;
            }

            // Apply configuration change
            await this.commitCallback({
                type: CommandType.CHANGE_CONFIG,
                data: { config: this.clusterConfig }
            });

            this.configChangeInProgress = false;
        } catch (error) {
            this.configChangeInProgress = false;
            throw error;
        }
    }

    /**
     * Initialize Raft node with storage
     */
    public async initialize(storage: RaftStorage): Promise<void> {
        if (this.initialized) return;

        try {
            this.storage = storage;

            // Check for existing snapshot
            const snapshot = await storage.getLatestSnapshot();
            if (snapshot) {
                this.lastSnapshotIndex = snapshot.lastIncludedIndex;
                this.lastSnapshotTerm = snapshot.lastIncludedTerm;
                this.clusterConfig = snapshot.clusterConfig;
                // Apply snapshot state
                await this.commitCallback({
                    type: CommandType.CHANGE_CONFIG,
                    data: { config: snapshot.clusterConfig }
                });
            }

            // Restore state from storage
            this.currentTerm = await storage.getTerm();
            this.votedFor = await storage.getVotedFor();
            this.state = await storage.getState();

            // Restore log entries
            const entries = await storage.getLogEntries(0);
            this.log = entries;

            // Update indices
            if (entries.length > 0) {
                this.commitIndex = entries.length - 1;
                this.lastApplied = entries.length - 1;
                
                // Apply all committed entries
                for (const entry of entries) {
                    await this.commitCallback(entry.command);
                }
            }

            // Start election timeout
            this.resetElectionTimeout();
            this.initialized = true;

            raftLogger.info({
                nodeId: this.nodeId,
                term: this.currentTerm,
                state: this.state,
                logLength: this.log.length
            }, 'Raft node initialized');

        } catch (error) {
            throw new SystemError(
                ErrorType.CONSENSUS,
                'INIT_FAILED',
                'Failed to initialize Raft node',
                error
            );
        }
    }

    /**
     * Apply committed entries to state machine
     */
    private async applyCommitted(): Promise<void> {
        if (!this.initialized) return;

        while (this.lastApplied < this.commitIndex) {
            this.lastApplied++;
            const entry = this.log[this.lastApplied];
            await this.commitCallback(entry.command);
        }
    }

    /**
     * Become leader
     */
    private async becomeLeader(): Promise<void> {
        if (this.state !== RaftState.CANDIDATE) {
            return;
        }

        this.state = RaftState.LEADER;
        this.leaderId = this.nodeId;

        // Persist state
        await this.storage?.saveState(this.state);

        // Initialize leader state
        for (const peer of this.peers) {
            this.nextIndex.set(peer, this.log.length);
            this.matchIndex.set(peer, -1);
        }

        // Clear election timeout and start heartbeat
        if (this.electionTimeout) {
            clearTimeout(this.electionTimeout);
            this.electionTimeout = null;
        }
        this.startHeartbeat();

        // Send initial empty AppendEntries
        for (const peer of this.peers) {
            this.sendAppendEntries(peer);
        }

        raftLogger.info({
            nodeId: this.nodeId,
            term: this.currentTerm
        }, 'Became leader');
    }

    /**
     * Handle incoming RaftMessage
     */
    public async handleMessage(message: RaftMessage): Promise<void> {
        if (!this.initialized) return;

        // Update term if necessary
        if (message.term > this.currentTerm) {
            this.currentTerm = message.term;
            this.state = RaftState.FOLLOWER;
            this.votedFor = null;
            this.leaderId = null;

            // Persist state changes
            await this.storage?.saveTerm(this.currentTerm);
            await this.storage?.saveVotedFor(null);
            await this.storage?.saveState(this.state);
        }

        switch (message.type) {
            case MessageType.VOTE_REQUEST:
                await this.handleVoteRequest(message as VoteRequest);
                break;
            case MessageType.VOTE_RESPONSE:
                await this.handleVoteResponse(message as VoteResponse);
                break;
            case MessageType.APPEND_ENTRIES:
                await this.handleAppendEntries(message as AppendEntries);
                break;
            case MessageType.APPEND_RESPONSE:
                await this.handleAppendResponse(message as AppendResponse);
                break;
            case MessageType.INSTALL_SNAPSHOT:
                await this.handleInstallSnapshot(message as InstallSnapshot);
                break;
        }
    }

    /**
     * Submit command to the cluster
     */
    public async submitCommand(command: RaftCommand): Promise<void> {
        if (!this.initialized) {
            throw new SystemError(
                ErrorType.CONSENSUS,
                'NOT_INITIALIZED',
                'Raft node not initialized'
            );
        }

        if (this.state !== RaftState.LEADER) {
            throw new SystemError(
                ErrorType.CONSENSUS,
                'NOT_LEADER',
                `Not the leader. Current leader: ${this.leaderId}`
            );
        }

        // Handle configuration changes
        if (command.type === CommandType.ADD_SERVER || command.type === CommandType.REMOVE_SERVER) {
            await this.handleConfigChange(command);
        }

        const entry: LogEntry = {
            term: this.currentTerm,
            index: this.log.length,
            command
        };

        // Append to log and persist
        this.log.push(entry);
        await this.storage?.appendLogEntries([entry]);

        this.matchIndex.set(this.nodeId, entry.index);

        // In single-node mode, commit immediately
        if (this.peers.length === 0) {
            this.commitIndex = entry.index;
            await this.applyCommitted();
        } else {
            // Check if we need to create a snapshot
            if (this.log.length >= this.config.snapshotThreshold) {
                await this.createSnapshot();
            }

            // Replicate to all peers
            for (const peer of this.clusterConfig.filter(id => id !== this.nodeId)) {
                this.sendAppendEntries(peer);
            }
        }
    }

    /**
     * Get node status
     */
    public getStatus(): {
        nodeId: string;
        state: RaftState;
        term: number;
        logLength: number;
        commitIndex: number;
        leaderId: string | null;
    } {
        return {
            nodeId: this.nodeId,
            state: this.state,
            term: this.currentTerm,
            logLength: this.log.length,
            commitIndex: this.commitIndex,
            leaderId: this.leaderId
        };
    }

    /**
     * Stop the node
     */
    public async stop(): Promise<void> {
        if (this.electionTimeout) {
            clearTimeout(this.electionTimeout);
            this.electionTimeout = null;
        }
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
        this.initialized = false;
    }
}
