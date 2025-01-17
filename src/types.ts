// src/types.ts

/**
 * Vector representation for SIMD operations
 */
export type Vector = Float32Array;

/**
 * Node in the HNSW graph
 */
export interface HNSWNode {
    id: number;
    vector: Vector;
    connections: Map<number, Set<number>>; // level -> connected node ids
    maxLevel: number;
}

/**
 * HNSW graph configuration
 */
export interface HNSWConfig {
    dimension: number;
    maxElements: number;
    M: number; // max number of connections per layer
    efConstruction: number; // size of dynamic candidate list
    efSearch: number; // size of dynamic candidate list for search
    ml: number; // maximum level
}

/**
 * Storage configuration
 */
export interface StorageConfig {
    dataDir: string;
    persistenceEnabled: boolean;
    snapshotThreshold: number; // number of entries before taking snapshot
}

/**
 * Network configuration
 */
export interface NetworkConfig {
    reconnectInterval: number;
    maxReconnectAttempts: number;
    heartbeatInterval: number;
    connectionTimeout: number;
}

/**
 * System configuration
 */
export interface SystemConfig {
    nodeId: string;
    peers: string[];
    hnsw: HNSWConfig;
    raft: {
        heartbeatTimeout: number;
        electionTimeoutMin: number;
        electionTimeoutMax: number;
        batchSize: number;
    };
    monitoring: {
        metricsInterval: number;
        healthCheckInterval: number;
    };
    storage: StorageConfig;
    network: NetworkConfig;
}

/**
 * Search result with distance
 */
export interface SearchResult {
    id: number;
    distance: number;
}

/**
 * Raft node states
 */
export enum RaftState {
    FOLLOWER = 'FOLLOWER',
    CANDIDATE = 'CANDIDATE',
    LEADER = 'LEADER'
}

/**
 * Raft log entry
 */
export interface LogEntry {
    term: number;
    index: number;
    command: RaftCommand;
}

/**
 * Raft command types
 */
export enum CommandType {
    INSERT = 'INSERT',
    DELETE = 'DELETE',
    UPDATE = 'UPDATE',
    SEARCH = 'SEARCH',
    ADD_SERVER = 'ADD_SERVER',
    REMOVE_SERVER = 'REMOVE_SERVER',
    CHANGE_CONFIG = 'CHANGE_CONFIG'
}

/**
 * Raft command structure
 */
export interface RaftCommand {
    type: CommandType;
    data: {
        id?: number;
        vector?: Vector;
        query?: Vector;
        k?: number;
        serverId?: string;
        config?: string[];
    };
}

/**
 * Raft message types
 */
export enum MessageType {
    VOTE_REQUEST = 'VOTE_REQUEST',
    VOTE_RESPONSE = 'VOTE_RESPONSE',
    APPEND_ENTRIES = 'APPEND_ENTRIES',
    APPEND_RESPONSE = 'APPEND_RESPONSE',
    INSTALL_SNAPSHOT = 'INSTALL_SNAPSHOT',
    SNAPSHOT_RESPONSE = 'SNAPSHOT_RESPONSE'
}

/**
 * Base Raft message interface
 */
export interface RaftMessage {
    type: MessageType;
    term: number;
    from: string;
    to: string;
}

/**
 * Vote request message
 */
export interface VoteRequest extends RaftMessage {
    lastLogIndex: number;
    lastLogTerm: number;
}

/**
 * Vote response message
 */
export interface VoteResponse extends RaftMessage {
    granted: boolean;
}

/**
 * Append entries message
 */
export interface AppendEntries extends RaftMessage {
    prevLogIndex: number;
    prevLogTerm: number;
    entries: LogEntry[];
    leaderCommit: number;
}

/**
 * Append response message
 */
export interface AppendResponse extends RaftMessage {
    success: boolean;
    matchIndex?: number;
}

/**
 * Install snapshot message
 */
export interface InstallSnapshot extends RaftMessage {
    lastIncludedIndex: number;
    lastIncludedTerm: number;
    offset: number;
    data: Buffer;
    done: boolean;
}

/**
 * Snapshot response message
 */
export interface SnapshotResponse extends RaftMessage {
    success: boolean;
}

/**
 * Cluster configuration
 */
export interface ClusterConfig {
    servers: string[];
    version: number;
}

/**
 * Performance metrics
 */
export interface Metrics {
    queryLatency: number[];
    throughput: number;
    memoryUsage: number;
    cpuUsage: number;
    networkLatency: number[];
}

/**
 * Health status
 */
export interface HealthStatus {
    status: 'healthy' | 'degraded' | 'unhealthy';
    lastHeartbeat: number;
    activeConnections: number;
    errorRate: number;
    warnings: string[];
}

/**
 * Error types
 */
export enum ErrorType {
    NETWORK = 'NETWORK',
    CONSENSUS = 'CONSENSUS',
    SEARCH = 'SEARCH',
    SYSTEM = 'SYSTEM'
}

/**
 * Custom error class
 */
export class SystemError extends Error {
    constructor(
        public type: ErrorType,
        public code: string,
        message: string,
        public details?: unknown
    ) {
        super(message);
        this.name = 'SystemError';
    }
}
