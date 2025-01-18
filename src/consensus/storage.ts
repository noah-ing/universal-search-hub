import { LogEntry, RaftState, SystemError, ErrorType } from '../types';
import { mkdir } from 'fs/promises';
import { join } from 'path';

interface Snapshot {
    lastIncludedIndex: number;
    lastIncludedTerm: number;
    state: any;
    clusterConfig: string[];
}

/**
 * In-memory storage implementation with persistence capabilities
 */
export class RaftStorage {
    private state: Map<string, any> = new Map();
    private logEntries: Map<number, LogEntry> = new Map();
    private snapshots: Snapshot[] = [];
    private initialized: boolean = false;
    private snapshotDir: string;
    private stateDir: string;
    private logDir: string;

    constructor(private nodeId: string, private dataDir: string = 'data') {
        // Sanitize nodeId for filesystem use (replace invalid characters)
        const safeNodeId = this.sanitizeDirectoryName(nodeId);
        
        // Create node-specific directories under dataDir
        const nodeDir = join(dataDir, safeNodeId);
        this.snapshotDir = join(nodeDir, 'snapshots');
        this.stateDir = join(nodeDir, 'state');
        this.logDir = join(nodeDir, 'logs');
    }

    /**
     * Sanitize directory name by replacing invalid characters
     */
    private sanitizeDirectoryName(name: string): string {
        // Replace invalid characters with underscores
        return name.replace(/[<>:"\/\\|?*\x00-\x1F]/g, '_');
    }

    async initialize(): Promise<void> {
        if (this.initialized) return;

        try {
            // Create all required directories
            await mkdir(this.snapshotDir, { recursive: true });
            await mkdir(this.stateDir, { recursive: true });
            await mkdir(this.logDir, { recursive: true });

            // Initialize node-specific state
            this.state.set('nodeId', this.nodeId);
            this.state.set('dataPath', this.snapshotDir);

            this.initialized = true;
        } catch (error) {
            throw new SystemError(
                ErrorType.SYSTEM,
                'STORAGE_INIT_FAILED',
                `Failed to initialize storage for node ${this.nodeId} in directory ${this.dataDir}`,
                error
            );
        }
    }

    async saveTerm(term: number): Promise<void> {
        try {
            if (term < 0) {
                throw new SystemError(
                    ErrorType.VALIDATION,
                    'INVALID_TERM',
                    'Term must be non-negative'
                );
            }
            this.state.set('currentTerm', term);
        } catch (error) {
            throw new SystemError(
                ErrorType.SYSTEM,
                'TERM_SAVE_FAILED',
                'Failed to save term',
                error
            );
        }
    }

    async getTerm(): Promise<number> {
        try {
            return this.state.get('currentTerm') || 0;
        } catch (error) {
            throw new SystemError(
                ErrorType.SYSTEM,
                'TERM_READ_FAILED',
                'Failed to read term',
                error
            );
        }
    }

    async saveVotedFor(nodeId: string | null): Promise<void> {
        try {
            this.state.set('votedFor', nodeId);
        } catch (error) {
            throw new SystemError(
                ErrorType.SYSTEM,
                'VOTE_SAVE_FAILED',
                'Failed to save voted for',
                error
            );
        }
    }

    async getVotedFor(): Promise<string | null> {
        try {
            return this.state.get('votedFor') || null;
        } catch (error) {
            throw new SystemError(
                ErrorType.SYSTEM,
                'VOTE_READ_FAILED',
                'Failed to read voted for',
                error
            );
        }
    }

    async saveState(state: RaftState): Promise<void> {
        try {
            this.state.set('state', state);
        } catch (error) {
            throw new SystemError(
                ErrorType.SYSTEM,
                'STATE_SAVE_FAILED',
                'Failed to save state',
                error
            );
        }
    }

    async getState(): Promise<RaftState> {
        try {
            return this.state.get('state') || RaftState.FOLLOWER;
        } catch (error) {
            throw new SystemError(
                ErrorType.SYSTEM,
                'STATE_READ_FAILED',
                'Failed to read state',
                error
            );
        }
    }

    async createSnapshot(lastIncludedIndex: number, lastIncludedTerm: number, state: any, clusterConfig: string[]): Promise<void> {
        try {
            if (lastIncludedIndex < 0 || lastIncludedTerm < 0) {
                throw new SystemError(
                    ErrorType.VALIDATION,
                    'INVALID_SNAPSHOT_PARAMS',
                    'Snapshot indices must be non-negative'
                );
            }

            const snapshot: Snapshot = {
                lastIncludedIndex,
                lastIncludedTerm,
                state,
                clusterConfig
            };

            this.snapshots.push(snapshot);

            // Delete compacted logs
            for (const [index] of this.logEntries) {
                if (index <= lastIncludedIndex) {
                    this.logEntries.delete(index);
                }
            }
        } catch (error) {
            throw new SystemError(
                ErrorType.SYSTEM,
                'SNAPSHOT_CREATE_FAILED',
                'Failed to create snapshot',
                error
            );
        }
    }

    async getLatestSnapshot(): Promise<Snapshot | null> {
        try {
            if (this.snapshots.length === 0) return null;
            return this.snapshots[this.snapshots.length - 1];
        } catch (error) {
            throw new SystemError(
                ErrorType.SYSTEM,
                'SNAPSHOT_READ_FAILED',
                'Failed to read latest snapshot',
                error
            );
        }
    }

    async appendLogEntries(entries: LogEntry[]): Promise<void> {
        try {
            if (!Array.isArray(entries)) {
                throw new SystemError(
                    ErrorType.VALIDATION,
                    'INVALID_ENTRIES',
                    'Entries must be an array'
                );
            }

            for (const entry of entries) {
                if (entry.index < 0 || entry.term < 0) {
                    throw new SystemError(
                        ErrorType.VALIDATION,
                        'INVALID_ENTRY',
                        'Log entry index and term must be non-negative'
                    );
                }
                this.logEntries.set(entry.index, entry);
            }
        } catch (error) {
            throw new SystemError(
                ErrorType.SYSTEM,
                'LOG_APPEND_FAILED',
                'Failed to append log entries',
                error
            );
        }
    }

    async getLogEntries(startIndex: number, endIndex?: number): Promise<LogEntry[]> {
        try {
            if (startIndex < 0) {
                throw new SystemError(
                    ErrorType.VALIDATION,
                    'INVALID_INDEX',
                    'Start index must be non-negative'
                );
            }

            const entries: LogEntry[] = [];
            for (const [index, entry] of this.logEntries) {
                if (index >= startIndex && (!endIndex || index < endIndex)) {
                    entries.push(entry);
                }
            }
            return entries.sort((a, b) => a.index - b.index);
        } catch (error) {
            throw new SystemError(
                ErrorType.SYSTEM,
                'LOG_READ_FAILED',
                'Failed to read log entries',
                error
            );
        }
    }

    async deleteLogEntriesFrom(startIndex: number): Promise<void> {
        try {
            if (startIndex < 0) {
                throw new SystemError(
                    ErrorType.VALIDATION,
                    'INVALID_INDEX',
                    'Start index must be non-negative'
                );
            }

            for (const [index] of this.logEntries) {
                if (index >= startIndex) {
                    this.logEntries.delete(index);
                }
            }
        } catch (error) {
            throw new SystemError(
                ErrorType.SYSTEM,
                'LOG_DELETE_FAILED',
                'Failed to delete log entries',
                error
            );
        }
    }

    async getLastLogEntry(): Promise<LogEntry | null> {
        try {
            if (this.logEntries.size === 0) return null;
            const maxIndex = Math.max(...Array.from(this.logEntries.keys()));
            return this.logEntries.get(maxIndex) || null;
        } catch (error) {
            throw new SystemError(
                ErrorType.SYSTEM,
                'LOG_READ_FAILED',
                'Failed to read last log entry',
                error
            );
        }
    }

    async close(): Promise<void> {
        try {
            this.initialized = false;
            this.state.clear();
            this.logEntries.clear();
            this.snapshots = [];
        } catch (error) {
            throw new SystemError(
                ErrorType.SYSTEM,
                'STORAGE_CLOSE_FAILED',
                'Failed to close storage',
                error
            );
        }
    }
}
