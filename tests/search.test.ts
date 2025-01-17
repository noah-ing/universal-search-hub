// tests/search.test.ts

import { HNSWGraph } from '../src/search/hnsw';
import { Vector, HNSWConfig, SystemError } from '../src/types';
import { euclideanDistance, normalize, initSIMD } from '../src/search/vector';

describe('HNSW Search Implementation', () => {
    let graph: HNSWGraph;
    const config: HNSWConfig = {
        dimension: 128,
        maxElements: 10000,
        M: 16,
        efConstruction: 200,
        efSearch: 50,
        ml: 1.0
    };

    beforeAll(async () => {
        await initSIMD();
    });

    beforeEach(() => {
        graph = new HNSWGraph(config);
    });

    describe('Configuration Validation', () => {
        test('should throw error for invalid M', () => {
            expect(() => new HNSWGraph({ ...config, M: 1 }))
                .toThrow(SystemError);
        });

        test('should throw error for invalid efConstruction', () => {
            expect(() => new HNSWGraph({ ...config, efConstruction: 10, M: 16 }))
                .toThrow(SystemError);
        });
    });

    describe('Vector Operations', () => {
        test('should normalize vectors correctly', () => {
            const vector: Vector = new Float32Array([1, 2, 3, 4]);
            normalize(vector);
            const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
            expect(Math.abs(magnitude - 1)).toBeLessThan(1e-6);
        });

        test('should calculate euclidean distance correctly', () => {
            const v1: Vector = new Float32Array([1, 0, 0, 0]);
            const v2: Vector = new Float32Array([0, 1, 0, 0]);
            const distance = euclideanDistance(v1, v2);
            expect(distance).toBe(Math.sqrt(2));
        });

        test('should throw error for mismatched dimensions', () => {
            const v1: Vector = new Float32Array([1, 0, 0]);
            const v2: Vector = new Float32Array([0, 1, 0, 0]);
            expect(() => euclideanDistance(v1, v2)).toThrow(SystemError);
        });
    });

    describe('Graph Operations', () => {
        const generateRandomVector = (dim: number): Vector => {
            const vector = new Float32Array(dim);
            for (let i = 0; i < dim; i++) {
                vector[i] = Math.random();
            }
            return vector;
        };

        test('should insert and retrieve vectors', () => {
            const vector = generateRandomVector(config.dimension);
            const id = graph.insert(vector);
            expect(id).toBeDefined();
            const results = graph.search(vector, 1);
            expect(results[0].id).toBe(id);
            expect(results[0].distance).toBeLessThan(1e-6);
        });

        test('should handle multiple insertions', () => {
            const vectors: Vector[] = [];
            const ids: number[] = [];

            // Insert multiple vectors
            for (let i = 0; i < 100; i++) {
                const vector = generateRandomVector(config.dimension);
                vectors.push(vector);
                ids.push(graph.insert(vector));
            }

            // Verify each vector can be found
            for (let i = 0; i < vectors.length; i++) {
                const results = graph.search(vectors[i], 1);
                expect(results[0].id).toBe(ids[i]);
                expect(results[0].distance).toBeLessThan(1e-6);
            }
        });

        test('should maintain approximate kNN property', () => {
            const vectors: Vector[] = [];
            const ids: number[] = [];

            // Insert vectors
            for (let i = 0; i < 1000; i++) {
                const vector = generateRandomVector(config.dimension);
                vectors.push(vector);
                ids.push(graph.insert(vector));
            }

            // Test query
            const query = generateRandomVector(config.dimension);
            const k = 10;
            const results = graph.search(query, k);

            // Verify results are sorted by distance
            for (let i = 1; i < results.length; i++) {
                expect(results[i].distance).toBeGreaterThanOrEqual(results[i-1].distance);
            }

            // Verify approximate kNN property
            const exactDistances = vectors.map(v => ({
                id: ids[vectors.indexOf(v)],
                distance: euclideanDistance(query, v)
            })).sort((a, b) => a.distance - b.distance).slice(0, k);

            // Allow for some approximation error (recall should be decent)
            const recall = results.filter(r => 
                exactDistances.some(e => e.id === r.id)
            ).length / k;

            expect(recall).toBeGreaterThan(0.8);
        });

        test('should handle deletions correctly', () => {
            const vector = generateRandomVector(config.dimension);
            const id = graph.insert(vector);
            
            // Verify insertion
            let results = graph.search(vector, 1);
            expect(results[0].id).toBe(id);

            // Delete vector
            graph.delete(id);

            // Verify deletion
            results = graph.search(vector, 1);
            expect(results[0].id).not.toBe(id);
        });

        test('should handle concurrent operations', async () => {
            const operations = [];
            const vectors: Vector[] = [];

            // Generate random operations
            for (let i = 0; i < 100; i++) {
                const vector = generateRandomVector(config.dimension);
                vectors.push(vector);
                operations.push(async () => {
                    const id = graph.insert(vector);
                    const results = graph.search(vector, 1);
                    expect(results[0].id).toBe(id);
                    if (Math.random() < 0.5) {
                        graph.delete(id);
                    }
                });
            }

            // Execute operations concurrently
            await Promise.all(operations.map(op => op()));
        });
    });

    describe('Performance Metrics', () => {
        test('should maintain sub-millisecond query times', () => {
            const vectors: Vector[] = [];
            
            // Insert test vectors
            for (let i = 0; i < 1000; i++) {
                vectors.push(generateRandomVector(config.dimension));
                graph.insert(vectors[i]);
            }

            // Measure query times
            const queryTimes: number[] = [];
            for (let i = 0; i < 100; i++) {
                const query = generateRandomVector(config.dimension);
                const start = performance.now();
                graph.search(query, 10);
                queryTimes.push(performance.now() - start);
            }

            // Calculate statistics
            const avgTime = queryTimes.reduce((a, b) => a + b) / queryTimes.length;
            const maxTime = Math.max(...queryTimes);

            // Verify performance
            expect(avgTime).toBeLessThan(1.0); // Average < 1ms
            expect(maxTime).toBeLessThan(2.0); // Max < 2ms
        });

        test('should scale logarithmically with dataset size', () => {
            const sizes = [100, 1000, 10000];
            const queryTimes: number[] = [];

            // Test different dataset sizes
            for (const size of sizes) {
                const graph = new HNSWGraph(config);
                
                // Insert vectors
                for (let i = 0; i < size; i++) {
                    graph.insert(generateRandomVector(config.dimension));
                }

                // Measure query time
                const query = generateRandomVector(config.dimension);
                const start = performance.now();
                graph.search(query, 10);
                queryTimes.push(performance.now() - start);
            }

            // Verify logarithmic scaling
            for (let i = 1; i < queryTimes.length; i++) {
                const ratio = queryTimes[i] / queryTimes[i-1];
                expect(ratio).toBeLessThan(2); // Should scale sub-linearly
            }
        });
    });
});