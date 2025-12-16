/**
 * SQLite-based vector storage for persistence
 */

import * as sqlite3 from 'sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import { Vector } from '../types';
import { searchLogger } from '../utils/logger';

export interface StoredVector {
    id: number;
    dimension: number;
    vector: Float32Array;
    metadata: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
}

export class VectorStore {
    private db: sqlite3.Database | null = null;
    private dbPath: string;
    private initialized = false;

    constructor(dbPath?: string) {
        // Default to data directory in project root
        const dataDir = path.join(process.cwd(), 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        this.dbPath = dbPath || path.join(dataDir, 'vectors.db');
    }

    /**
     * Initialize the database and create tables
     */
    async initialize(): Promise<void> {
        if (this.initialized) return;

        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    searchLogger.error({ error: err }, 'Failed to open database');
                    reject(err);
                    return;
                }

                // Create vectors table
                const createTableSQL = `
                    CREATE TABLE IF NOT EXISTS vectors (
                        id INTEGER PRIMARY KEY,
                        dimension INTEGER NOT NULL,
                        vector BLOB NOT NULL,
                        metadata TEXT DEFAULT '{}',
                        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
                    );

                    CREATE INDEX IF NOT EXISTS idx_vectors_dimension ON vectors(dimension);
                `;

                this.db!.exec(createTableSQL, (err) => {
                    if (err) {
                        searchLogger.error({ error: err }, 'Failed to create tables');
                        reject(err);
                        return;
                    }

                    this.initialized = true;
                    searchLogger.info({ dbPath: this.dbPath }, 'Vector store initialized');
                    resolve();
                });
            });
        });
    }

    /**
     * Insert a vector
     */
    async insert(
        id: number,
        dimension: number,
        vector: Vector,
        metadata: Record<string, unknown> = {}
    ): Promise<void> {
        if (!this.db) throw new Error('Database not initialized');

        return new Promise((resolve, reject) => {
            const vectorBuffer = Buffer.from(vector.buffer);
            const metadataJson = JSON.stringify(metadata);

            this.db!.run(
                `INSERT OR REPLACE INTO vectors (id, dimension, vector, metadata, updated_at)
                 VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
                [id, dimension, vectorBuffer, metadataJson],
                (err) => {
                    if (err) {
                        searchLogger.error({ error: err, id }, 'Failed to insert vector');
                        reject(err);
                        return;
                    }
                    resolve();
                }
            );
        });
    }

    /**
     * Get a vector by ID and dimension
     */
    async get(id: number, dimension: number): Promise<StoredVector | null> {
        if (!this.db) throw new Error('Database not initialized');

        return new Promise((resolve, reject) => {
            this.db!.get(
                `SELECT * FROM vectors WHERE id = ? AND dimension = ?`,
                [id, dimension],
                (err, row: {
                    id: number;
                    dimension: number;
                    vector: Buffer;
                    metadata: string;
                    created_at: string;
                    updated_at: string;
                } | undefined) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    if (!row) {
                        resolve(null);
                        return;
                    }

                    resolve({
                        id: row.id,
                        dimension: row.dimension,
                        vector: new Float32Array(row.vector.buffer, row.vector.byteOffset, row.vector.length / 4),
                        metadata: JSON.parse(row.metadata),
                        createdAt: row.created_at,
                        updatedAt: row.updated_at
                    });
                }
            );
        });
    }

    /**
     * Delete a vector
     */
    async delete(id: number, dimension: number): Promise<boolean> {
        if (!this.db) throw new Error('Database not initialized');

        return new Promise((resolve, reject) => {
            this.db!.run(
                `DELETE FROM vectors WHERE id = ? AND dimension = ?`,
                [id, dimension],
                function(err) {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve(this.changes > 0);
                }
            );
        });
    }

    /**
     * Get all vectors for a dimension
     */
    async getAllByDimension(dimension: number): Promise<StoredVector[]> {
        if (!this.db) throw new Error('Database not initialized');

        return new Promise((resolve, reject) => {
            this.db!.all(
                `SELECT * FROM vectors WHERE dimension = ?`,
                [dimension],
                (err, rows: Array<{
                    id: number;
                    dimension: number;
                    vector: Buffer;
                    metadata: string;
                    created_at: string;
                    updated_at: string;
                }>) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    const vectors = rows.map(row => ({
                        id: row.id,
                        dimension: row.dimension,
                        vector: new Float32Array(row.vector.buffer, row.vector.byteOffset, row.vector.length / 4),
                        metadata: JSON.parse(row.metadata),
                        createdAt: row.created_at,
                        updatedAt: row.updated_at
                    }));

                    resolve(vectors);
                }
            );
        });
    }

    /**
     * Get count of vectors by dimension
     */
    async getCount(dimension?: number): Promise<number> {
        if (!this.db) throw new Error('Database not initialized');

        return new Promise((resolve, reject) => {
            const sql = dimension
                ? `SELECT COUNT(*) as count FROM vectors WHERE dimension = ?`
                : `SELECT COUNT(*) as count FROM vectors`;
            const params = dimension ? [dimension] : [];

            this.db!.get(sql, params, (err, row: { count: number } | undefined) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(row?.count || 0);
            });
        });
    }

    /**
     * Get statistics
     */
    async getStats(): Promise<{
        totalVectors: number;
        byDimension: Record<number, number>;
        dbSizeBytes: number;
    }> {
        if (!this.db) throw new Error('Database not initialized');

        const totalVectors = await this.getCount();

        const byDimension: Record<number, number> = {};
        const dimensions = [384, 768, 1024, 1536, 2048];
        for (const dim of dimensions) {
            byDimension[dim] = await this.getCount(dim);
        }

        const stats = fs.statSync(this.dbPath);

        return {
            totalVectors,
            byDimension,
            dbSizeBytes: stats.size
        };
    }

    /**
     * Close the database
     */
    async close(): Promise<void> {
        if (!this.db) return;

        return new Promise((resolve, reject) => {
            this.db!.close((err) => {
                if (err) {
                    reject(err);
                    return;
                }
                this.db = null;
                this.initialized = false;
                resolve();
            });
        });
    }
}

// Export singleton instance
let instance: VectorStore | null = null;

export function getVectorStore(): VectorStore {
    if (!instance) {
        instance = new VectorStore();
    }
    return instance;
}
