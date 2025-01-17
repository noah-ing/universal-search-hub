// src/consensus/raft.ts

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
    ErrorType
} from '../types';

/**
 * Raft Node Implementation
 */
export class RaftNode {
    private state: RaftState;
    private currentTerm: number;
    private votedFor: string | null;
    private log: LogEntry[];
    private commitIndex: number;
    private lastApplied: number;
    private nextIndex: Map<string, number>;
    private matchIndex: Map<string, number>;
    private readonly nodeId: string;
    private readonly peers: string[];
    private leaderId: string | null;
    private electionTimeout: NodeJS.Timeout | null;
    private heartbeatInterval: NodeJS.Timeout | null;
    private lastHeartbeat: number;
    private config: {
        heartbeatTimeout: number;
        electionTimeoutMin: number;
        electionTimeoutMax: number;
        batchSize: number;
    };
    private messageCallback: (msg: RaftMessage) => void;
    private commitCallback: (command: RaftCommand) => void;

    constructor(
        nodeId: string,
        peers: string[],
        config: {
            heartbeatTimeout: number;
            electionTimeoutMin: number;
            electionTimeoutMax: number;
            batchSize: number;
        },
        messageCallback: (msg: RaftMessage) => void,
        commitCallback: (command: RaftCommand) => void
    ) {
        this.nodeId = nodeId;
        this.peers = peers;
        this.config = config;
        this.messageCallback = messageCallback;
        this.commitCallback = commitCallback;

        // Initialize Raft state
        this.state = RaftState.FOLLOWER;
        this.currentTerm = 0;
        this.votedFor = null;
        this.log = [];
        this.commitIndex = -1;
        this.lastApplied = -1;
        this.nextIndex = new Map();
        this.matchIndex = new Map();
        this.leaderId = null;
        this.electionTimeout = null;
        this.heartbeatInterval = null;
        this.lastHeartbeat = Date.now();

        // Initialize peer tracking
        for (const peer of peers) {
            this.nextIndex.set(peer, 0);
            this.matchIndex.set(peer, -1);
        }

        // Start election timeout
        this.resetElectionTimeout();
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
    private startElection(): void {
        this.state = RaftState.CANDIDATE;
        this.currentTerm++;
        this.votedFor = this.nodeId;
        this.leaderId = null;

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
        let votesReceived = 1; // Vote for self
        const votesNeeded = Math.floor((this.peers.length + 1) / 2) + 1;

        for (const peer of this.peers) {
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
            for (const peer of this.peers) {
                this.sendAppendEntries(peer);
            }
        }, this.config.heartbeatTimeout);
    }

    /**
     * Send AppendEntries RPC to a peer
     */
    private sendAppendEntries(peerId: string): void {
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
     * Apply committed entries to state machine
     */
    private applyCommitted(): void {
        while (this.lastApplied < this.commitIndex) {
            this.lastApplied++;
            const entry = this.log[this.lastApplied];
            this.commitCallback(entry.command);
        }
    }

    /**
     * Handle incoming RaftMessage
     */
    public handleMessage(message: RaftMessage): void {
        // Update term if necessary
        if (message.term > this.currentTerm) {
            this.currentTerm = message.term;
            this.state = RaftState.FOLLOWER;
            this.votedFor = null;
            this.leaderId = null;
        }

        switch (message.type) {
            case MessageType.VOTE_REQUEST:
                this.handleVoteRequest(message as VoteRequest);
                break;
            case MessageType.VOTE_RESPONSE:
                this.handleVoteResponse(message as VoteResponse);
                break;
            case MessageType.APPEND_ENTRIES:
                this.handleAppendEntries(message as AppendEntries);
                break;
            case MessageType.APPEND_RESPONSE:
                this.handleAppendResponse(message as AppendResponse);
                break;
        }
    }

    /**
     * Handle VoteRequest RPC
     */
    private handleVoteRequest(request: VoteRequest): void {
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
        }

        this.messageCallback(response);
    }

    /**
     * Handle VoteResponse RPC
     */
    private handleVoteResponse(response: VoteResponse): void {
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

            const votesNeeded = Math.floor((this.peers.length + 1) / 2) + 1;
            if (votesReceived >= votesNeeded) {
                this.becomeLeader();
            }
        }
    }

    /**
     * Handle AppendEntries RPC
     */
    private handleAppendEntries(request: AppendEntries): void {
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
        }
        this.log = this.log.concat(newEntries);

        // Update commit index
        if (request.leaderCommit > this.commitIndex) {
            this.commitIndex = Math.min(
                request.leaderCommit,
                this.log.length - 1
            );
            this.applyCommitted();
        }

        response.success = true;
        response.matchIndex = request.prevLogIndex + newEntries.length;
        this.messageCallback(response);
    }

    /**
     * Handle AppendResponse RPC
     */
    private handleAppendResponse(response: AppendResponse): void {
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
                Math.floor((this.peers.length + 1) / 2)
            ];

            if (
                majorityIndex > this.commitIndex &&
                this.log[majorityIndex].term === this.currentTerm
            ) {
                this.commitIndex = majorityIndex;
                this.applyCommitted();
            }
        } else {
            // Decrement nextIndex and retry
            const nextIdx = this.nextIndex.get(response.from)!;
            this.nextIndex.set(response.from, Math.max(0, nextIdx - 1));
            this.sendAppendEntries(response.from);
        }
    }

    /**
     * Become leader
     */
    private becomeLeader(): void {
        if (this.state !== RaftState.CANDIDATE) {
            return;
        }

        this.state = RaftState.LEADER;
        this.leaderId = this.nodeId;

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
    }

    /**
     * Submit command to the cluster
     */
    public submitCommand(command: RaftCommand): void {
        if (this.state !== RaftState.LEADER) {
            throw new SystemError(
                ErrorType.CONSENSUS,
                'NOT_LEADER',
                `Not the leader. Current leader: ${this.leaderId}`
            );
        }

        const entry: LogEntry = {
            term: this.currentTerm,
            index: this.log.length,
            command
        };

        this.log.push(entry);
        this.matchIndex.set(this.nodeId, entry.index);

        // Replicate to all peers
        for (const peer of this.peers) {
            this.sendAppendEntries(peer);
        }
    }

    /**
     * Get node status
     */
    public getStatus(): {
        state: RaftState;
        term: number;
        logLength: number;
        commitIndex: number;
        leaderId: string | null;
    } {
        return {
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
    public stop(): void {
        if (this.electionTimeout) {
            clearTimeout(this.electionTimeout);
            this.electionTimeout = null;
        }
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }
}