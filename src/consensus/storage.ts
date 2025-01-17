import { LogEntry, RaftState, SystemError, ErrorType } from '../types';
import { Database } from 'sqlite3';
import { promisify } from 'util';
import { mkdir } from 'fs/promises';
import { join } from 'path';

interface DBRow {
    index: number;
    term: number;
    command: string;
    value?: string;
    last_included_index?: number;
    last_included_term?: number;
    state?: string;
    cluster_config?: string;
}

interface Snapshot {
    lastIncludedIndex: number;
    lastIncludedTerm: number;
    state: any;
    clusterConfig: string[];
}

/**
 * Persistent storage interface for Raft state
 */
export class RaftStorage {
    private db!: Database;
    private initialized: boolean = false;

    constructor(private nodeId: string, private dataDir: string = 'data') {}

    /**
     * Initialize storage
     */
    async initialize(): Promise<void> {
        if (this.initialized) return;

        try {
            // Create data directory if it doesn't exist
            await mkdir(this.dataDir, { recursive: true });

            // Open database
            const dbPath = join(this.dataDir, `${this.nodeId}.db`);
            this.db = new Database(dbPath);

            // Create tables
            await this.runQuery(`
                CREATE TABLE IF NOT EXISTS raft_state (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                )
            `);

            await this.runQuery(`
                CREATE TABLE IF NOT EXISTS log_entries (
                    index INTEGER PRIMARY KEY,
                    term INTEGER NOT NULL,
                    command TEXT NOT NULL
                )
            `);

            await this.runQuery(`
                CREATE TABLE IF NOT EXISTS snapshots (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    last_included_index INTEGER NOT NULL,
                    last_included_term INTEGER NOT NULL,
                    state TEXT NOT NULL,
                    cluster_config TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);

            this.initialized = true;
        } catch (error) {
            throw new SystemError(
                ErrorType.SYSTEM,
                'STORAGE_INIT_FAILED',
                'Failed to initialize storage',
                error
            );
        }
    }

    /**
     * Helper method to run a query
     */
    private async runQuery(sql: string, params: any[] = []): Promise<void> {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, (err: Error | null) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    /**
     * Helper method to get all rows
     */
    private async getAllRows(sql: string, params: any[] = []): Promise<DBRow[]> {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err: Error | null, rows: DBRow[]) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    /**
     * Helper method to get single row
     */
    private async getRow(sql: string, params: any[] = []): Promise<DBRow | undefined> {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err: Error | null, row: DBRow | undefined) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }

    /**
     * Save current term
     */
    async saveTerm(term: number): Promise<void> {
        await this.setValue('currentTerm', term.toString());
    }

    /**
     * Get current term
     */
    async getTerm(): Promise<number> {
        const term = await this.getValue('currentTerm');
        return term ? parseInt(term) : 0;
    }

    /**
     * Save voted for
     */
    async saveVotedFor(nodeId: string | null): Promise<void> {
        await this.setValue('votedFor', nodeId || '');
    }

    /**
     * Get voted for
     */
    async getVotedFor(): Promise<string | null> {
        const votedFor = await this.getValue('votedFor');
        return votedFor || null;
    }

    /**
     * Save Raft state
     */
    async saveState(state: RaftState): Promise<void> {
        await this.setValue('state', state);
    }

    /**
     * Get Raft state
     */
    async getState(): Promise<RaftState> {
        const state = await this.getValue('state');
        return (state as RaftState) || RaftState.FOLLOWER;
    }

    /**
     * Create a snapshot
     */
    async createSnapshot(lastIncludedIndex: number, lastIncludedTerm: number, state: any, clusterConfig: string[]): Promise<void> {
        try {
            await this.runQuery('BEGIN TRANSACTION');

            // Save snapshot
            await this.runQuery(
                'INSERT INTO snapshots (last_included_index, last_included_term, state, cluster_config) VALUES (?, ?, ?, ?)',
                [lastIncludedIndex, lastIncludedTerm, JSON.stringify(state), JSON.stringify(clusterConfig)]
            );

            // Delete compacted logs
            await this.deleteLogEntriesUpTo(lastIncludedIndex);

            await this.runQuery('COMMIT');
        } catch (error) {
            await this.runQuery('ROLLBACK');
            throw new SystemError(
                ErrorType.SYSTEM,
                'SNAPSHOT_CREATE_FAILED',
                'Failed to create snapshot',
                error
            );
        }
    }

    /**
     * Get latest snapshot
     */
    async getLatestSnapshot(): Promise<Snapshot | null> {
        try {
            const row = await this.getRow(
                'SELECT * FROM snapshots ORDER BY last_included_index DESC LIMIT 1'
            );
            if (!row || !row.last_included_index || !row.last_included_term || !row.state || !row.cluster_config) {
                return null;
            }

            return {
                lastIncludedIndex: row.last_included_index,
                lastIncludedTerm: row.last_included_term,
                state: JSON.parse(row.state),
                clusterConfig: JSON.parse(row.cluster_config)
            };
        } catch (error) {
            throw new SystemError(
                ErrorType.SYSTEM,
                'SNAPSHOT_READ_FAILED',
                'Failed to read snapshot',
                error
            );
        }
    }

    /**
     * Delete logs up to index (inclusive)
     */
    private async deleteLogEntriesUpTo(index: number): Promise<void> {
        try {
            await this.runQuery(
                'DELETE FROM log_entries WHERE index <= ?',
                [index]
            );
        } catch (error) {
            throw new SystemError(
                ErrorType.SYSTEM,
                'LOG_DELETE_FAILED',
                'Failed to delete log entries',
                error
            );
        }
    }

    /**
     * Append log entries
     */
    async appendLogEntries(entries: LogEntry[]): Promise<void> {
        if (!entries.length) return;

        await this.runQuery('BEGIN TRANSACTION');

        try {
            for (const entry of entries) {
                await this.runQuery(
                    'INSERT OR REPLACE INTO log_entries (index, term, command) VALUES (?, ?, ?)',
                    [entry.index, entry.term, JSON.stringify(entry.command)]
                );
            }
            await this.runQuery('COMMIT');
        } catch (error) {
            await this.runQuery('ROLLBACK');
            throw new SystemError(
                ErrorType.SYSTEM,
                'LOG_APPEND_FAILED',
                'Failed to append log entries',
                error
            );
        }
    }

    /**
     * Get log entries in range
     */
    async getLogEntries(startIndex: number, endIndex?: number): Promise<LogEntry[]> {
        const query = endIndex
            ? 'SELECT * FROM log_entries WHERE index >= ? AND index < ? ORDER BY index'
            : 'SELECT * FROM log_entries WHERE index >= ? ORDER BY index';
        const params = endIndex ? [startIndex, endIndex] : [startIndex];

        try {
            const rows = await this.getAllRows(query, params);
            return rows.map(row => ({
                index: row.index,
                term: row.term,
                command: JSON.parse(row.command)
            }));
        } catch (error) {
            throw new SystemError(
                ErrorType.SYSTEM,
                'LOG_READ_FAILED',
                'Failed to read log entries',
                error
            );
        }
    }

    /**
     * Delete log entries from startIndex onwards
     */
    async deleteLogEntriesFrom(startIndex: number): Promise<void> {
        try {
            await this.runQuery(
                'DELETE FROM log_entries WHERE index >= ?',
                [startIndex]
            );
        } catch (error) {
            throw new SystemError(
                ErrorType.SYSTEM,
                'LOG_DELETE_FAILED',
                'Failed to delete log entries',
                error
            );
        }
    }

    /**
     * Get last log entry
     */
    async getLastLogEntry(): Promise<LogEntry | null> {
        try {
            const row = await this.getRow(
                'SELECT * FROM log_entries ORDER BY index DESC LIMIT 1'
            );
            if (!row) return null;
            return {
                index: row.index,
                term: row.term,
                command: JSON.parse(row.command)
            };
        } catch (error) {
            throw new SystemError(
                ErrorType.SYSTEM,
                'LOG_READ_FAILED',
                'Failed to read last log entry',
                error
            );
        }
    }

    /**
     * Helper method to set value
     */
    private async setValue(key: string, value: any): Promise<void> {
        try {
            await this.runQuery(
                'INSERT OR REPLACE INTO raft_state (key, value) VALUES (?, ?)',
                [key, typeof value === 'string' ? value : JSON.stringify(value)]
            );
        } catch (error) {
            throw new SystemError(
                ErrorType.SYSTEM,
                'STORAGE_WRITE_FAILED',
                `Failed to write ${key} to storage`,
                error
            );
        }
    }

    /**
     * Helper method to get value
     */
    private async getValue(key: string): Promise<string | null> {
        try {
            const row = await this.getRow(
                'SELECT value FROM raft_state WHERE key = ?',
                [key]
            );
            return row?.value || null;
        } catch (error) {
            throw new SystemError(
                ErrorType.SYSTEM,
                'STORAGE_READ_FAILED',
                `Failed to read ${key} from storage`,
                error
            );
        }
    }

    /**
     * Close storage
     */
    async close(): Promise<void> {
        if (!this.initialized) return;
        
        return new Promise((resolve, reject) => {
            this.db.close((err: Error | null) => {
                if (err) {
                    reject(new SystemError(
                        ErrorType.SYSTEM,
                        'STORAGE_CLOSE_FAILED',
                        'Failed to close storage',
                        err
                    ));
                } else {
                    this.initialized = false;
                    resolve();
                }
            });
        });
    }
}
