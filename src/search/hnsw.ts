// src/search/hnsw.ts

import { 
    HNSWNode, 
    HNSWConfig, 
    Vector, 
    SearchResult, 
    SystemError, 
    ErrorType 
} from '../types';
import { 
    euclideanDistance, 
    normalize, 
    vectorMetrics 
} from './vector';

/**
 * HNSW Graph Implementation
 */
export class HNSWGraph {
    private nodes: Map<number, HNSWNode>;
    private entryPoint: HNSWNode | null;
    private maxLevel: number;
    private config: HNSWConfig;
    private deletedNodes: Set<number>;
    private idCounter: number;

    constructor(config: HNSWConfig) {
        this.validateConfig(config);
        this.nodes = new Map();
        this.entryPoint = null;
        this.maxLevel = 0;
        this.config = config;
        this.deletedNodes = new Set();
        this.idCounter = 0;
    }

    /**
     * Validate HNSW configuration
     */
    private validateConfig(config: HNSWConfig): void {
        if (config.M < 2) {
            throw new SystemError(
                ErrorType.SYSTEM,
                'INVALID_CONFIG',
                'M must be at least 2'
            );
        }
        if (config.efConstruction < config.M) {
            throw new SystemError(
                ErrorType.SYSTEM,
                'INVALID_CONFIG',
                'efConstruction must be at least M'
            );
        }
    }

    /**
     * Generate random level according to HNSW paper
     */
    private generateRandomLevel(): number {
        const r = Math.random();
        return Math.floor(-Math.log(r) * this.config.ml);
    }

    /**
     * Insert a new element into the graph
     */
    public insert(vector: Vector, id?: number): number {
        const startTime = performance.now();
        
        try {
            // Normalize input vector
            const normalizedVector = new Float32Array(vector);
            normalize(normalizedVector);

            // Generate or validate ID
            const nodeId = id ?? this.idCounter++;
            if (this.nodes.has(nodeId)) {
                throw new SystemError(
                    ErrorType.SEARCH,
                    'DUPLICATE_ID',
                    `Node with ID ${nodeId} already exists`
                );
            }

            // Generate random level
            const nodeLevel = this.generateRandomLevel();

            // Create new node
            const newNode: HNSWNode = {
                id: nodeId,
                vector: normalizedVector,
                connections: new Map(),
                maxLevel: nodeLevel
            };

            // Initialize connections for each level
            for (let level = 0; level <= nodeLevel; level++) {
                newNode.connections.set(level, new Set());
            }

            // If this is the first node, make it the entry point
            if (!this.entryPoint) {
                this.entryPoint = newNode;
                this.maxLevel = nodeLevel;
                this.nodes.set(nodeId, newNode);
                return nodeId;
            }

            // Find entry point for insertion
            let currObj = this.entryPoint;
            let currDist = euclideanDistance(normalizedVector, currObj.vector);

            // Search for the closest entry point from top to bottom
            for (let level = this.maxLevel; level > nodeLevel; level--) {
                let changed = true;
                while (changed) {
                    changed = false;
                    const neighbors = currObj.connections.get(level) || new Set();
                    
                    for (const neighborId of neighbors) {
                        const neighbor = this.nodes.get(neighborId)!;
                        const distance = euclideanDistance(normalizedVector, neighbor.vector);
                        
                        if (distance < currDist) {
                            currDist = distance;
                            currObj = neighbor;
                            changed = true;
                        }
                    }
                }
            }

            // For each level, find and connect to neighbors
            for (let level = Math.min(nodeLevel, this.maxLevel); level >= 0; level--) {
                // Find ef closest neighbors at current level
                const neighbors = this.searchLayer(
                    normalizedVector,
                    currObj,
                    this.config.efConstruction,
                    level
                );

                // Select M closest neighbors
                const selectedNeighbors = this.selectNeighbors(
                    normalizedVector,
                    neighbors,
                    this.config.M
                );

                // Add bidirectional connections
                for (const neighbor of selectedNeighbors) {
                    newNode.connections.get(level)!.add(neighbor.id);
                    this.nodes.get(neighbor.id)!.connections.get(level)!.add(nodeId);
                }

                // Update entry point for next level
                if (selectedNeighbors.length > 0) {
                    currObj = selectedNeighbors[0];
                }
            }

            // Update max level if necessary
            if (nodeLevel > this.maxLevel) {
                this.maxLevel = nodeLevel;
                this.entryPoint = newNode;
            }

            // Add node to graph
            this.nodes.set(nodeId, newNode);

            return nodeId;
        } finally {
            vectorMetrics.recordOperation(performance.now() - startTime);
        }
    }

    /**
     * Search for k nearest neighbors
     */
    public search(query: Vector, k: number): SearchResult[] {
        const startTime = performance.now();
        
        try {
            if (k <= 0) {
                throw new SystemError(
                    ErrorType.SEARCH,
                    'INVALID_K',
                    'k must be positive'
                );
            }

            if (!this.entryPoint) {
                return [];
            }

            // Normalize query vector
            const normalizedQuery = new Float32Array(query);
            normalize(normalizedQuery);

            // Start from entry point
            let currObj = this.entryPoint;
            let currDist = euclideanDistance(normalizedQuery, currObj.vector);

            // Search from top to bottom level
            for (let level = this.maxLevel; level > 0; level--) {
                let changed = true;
                while (changed) {
                    changed = false;
                    const neighbors = currObj.connections.get(level) || new Set();
                    
                    for (const neighborId of neighbors) {
                        const neighbor = this.nodes.get(neighborId)!;
                        const distance = euclideanDistance(normalizedQuery, neighbor.vector);
                        
                        if (distance < currDist) {
                            currDist = distance;
                            currObj = neighbor;
                            changed = true;
                        }
                    }
                }
            }

            // Search at bottom layer with ef = k
            const neighbors = this.searchLayer(
                normalizedQuery,
                currObj,
                Math.max(this.config.efSearch, k),
                0
            );

            // Return k closest neighbors
            return neighbors
                .slice(0, k)
                .map(node => ({
                    id: node.id,
                    distance: euclideanDistance(normalizedQuery, node.vector)
                }));
        } finally {
            vectorMetrics.recordOperation(performance.now() - startTime);
        }
    }

    /**
     * Search within a layer for closest neighbors
     */
    private searchLayer(
        query: Vector,
        entryPoint: HNSWNode,
        ef: number,
        level: number
    ): HNSWNode[] {
        const visited = new Set<number>([entryPoint.id]);
        const candidates = new Map<number, number>();
        const results = new Map<number, number>();

        const startDist = euclideanDistance(query, entryPoint.vector);
        candidates.set(entryPoint.id, startDist);
        results.set(entryPoint.id, startDist);

        while (candidates.size > 0) {
            // Find closest candidate
            let closest = Array.from(candidates.entries())
                .reduce((a, b) => a[1] < b[1] ? a : b);
            candidates.delete(closest[0]);

            // Check if we can terminate early
            const furthestResult = Array.from(results.entries())
                .reduce((a, b) => a[1] > b[1] ? a : b);
            if (closest[1] > furthestResult[1] && results.size >= ef) {
                break;
            }

            // Explore neighbors of closest candidate
            const node = this.nodes.get(closest[0])!;
            const neighbors = node.connections.get(level) || new Set();

            for (const neighborId of neighbors) {
                if (!visited.has(neighborId)) {
                    visited.add(neighborId);
                    const neighbor = this.nodes.get(neighborId)!;
                    const distance = euclideanDistance(query, neighbor.vector);

                    if (results.size < ef || distance < furthestResult[1]) {
                        candidates.set(neighborId, distance);
                        results.set(neighborId, distance);

                        if (results.size > ef) {
                            const furthest = Array.from(results.entries())
                                .reduce((a, b) => a[1] > b[1] ? a : b);
                            results.delete(furthest[0]);
                        }
                    }
                }
            }
        }

        return Array.from(results.keys())
            .map(id => this.nodes.get(id)!)
            .sort((a, b) => 
                euclideanDistance(query, a.vector) - 
                euclideanDistance(query, b.vector)
            );
    }

    /**
     * Select best neighbors based on distance and existing connections
     */
    private selectNeighbors(
        query: Vector,
        candidates: HNSWNode[],
        M: number
    ): HNSWNode[] {
        if (candidates.length <= M) {
            return candidates;
        }

        const selectedNeighbors: HNSWNode[] = [];
        const distances = new Map<number, number>();

        // Calculate distances once
        for (const candidate of candidates) {
            distances.set(
                candidate.id,
                euclideanDistance(query, candidate.vector)
            );
        }

        // Sort candidates by distance
        candidates.sort((a, b) => 
            distances.get(a.id)! - distances.get(b.id)!
        );

        // Select M closest candidates
        for (const candidate of candidates) {
            if (selectedNeighbors.length >= M) {
                break;
            }
            selectedNeighbors.push(candidate);
        }

        return selectedNeighbors;
    }

    /**
     * Delete a node from the graph
     */
    public delete(id: number): void {
        const node = this.nodes.get(id);
        if (!node) {
            throw new SystemError(
                ErrorType.SEARCH,
                'NODE_NOT_FOUND',
                `Node with ID ${id} not found`
            );
        }

        // Remove connections to this node
        for (let level = 0; level <= node.maxLevel; level++) {
            const neighbors = node.connections.get(level) || new Set();
            for (const neighborId of neighbors) {
                const neighbor = this.nodes.get(neighborId);
                if (neighbor) {
                    neighbor.connections.get(level)!.delete(id);
                }
            }
        }

        // Remove node and mark as deleted
        this.nodes.delete(id);
        this.deletedNodes.add(id);

        // Update entry point if necessary
        if (this.entryPoint && this.entryPoint.id === id) {
            // Get the first remaining node or null if no nodes left
            const firstNode = this.nodes.size > 0 ? 
                Array.from(this.nodes.values())[0] : null;
            
            this.entryPoint = firstNode;
            this.maxLevel = firstNode ? firstNode.maxLevel : 0;
        }
    }

    /**
     * Get graph statistics
     */
    public getStats(): {
        nodeCount: number;
        maxLevel: number;
        averageConnections: number;
        memoryUsage: number;
    } {
        let totalConnections = 0;
        let memoryUsage = 0;

        for (const node of this.nodes.values()) {
            for (const connections of node.connections.values()) {
                totalConnections += connections.size;
            }
            memoryUsage += node.vector.length * 4; // Float32Array bytes
            memoryUsage += 8 * node.connections.size; // Map overhead
        }

        return {
            nodeCount: this.nodes.size,
            maxLevel: this.maxLevel,
            averageConnections: totalConnections / Math.max(1, this.nodes.size),
            memoryUsage
        };
    }
}

export const hnswMetrics = {
    insertTime: [] as number[],
    searchTime: [] as number[],
    memoryUsage: [] as number[],
    
    recordOperation(type: 'insert' | 'search', time: number, memory: number): void {
        if (type === 'insert') {
            this.insertTime.push(time);
        } else {
            this.searchTime.push(time);
        }
        this.memoryUsage.push(memory);
    },
    
    getMetrics(): {
        avgInsertTime: number;
        avgSearchTime: number;
        maxMemoryUsage: number;
    } {
        return {
            avgInsertTime: this.insertTime.length ? 
                this.insertTime.reduce((a, b) => a + b) / this.insertTime.length : 0,
            avgSearchTime: this.searchTime.length ? 
                this.searchTime.reduce((a, b) => a + b) / this.searchTime.length : 0,
            maxMemoryUsage: Math.max(0, ...this.memoryUsage)
        };
    }
};
