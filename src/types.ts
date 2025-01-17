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
  SEARCH = 'SEARCH'
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
  };
}

/**
 * Raft message types
 */
export enum MessageType {
  VOTE_REQUEST = 'VOTE_REQUEST',
  VOTE_RESPONSE = 'VOTE_RESPONSE',
  APPEND_ENTRIES = 'APPEND_ENTRIES',
  APPEND_RESPONSE = 'APPEND_RESPONSE'
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
    public details?: any
  ) {
    super(message);
    this.name = 'SystemError';
  }
}

/**
 * Configuration for the entire system
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
}