import { HNSWGraph } from '../src/search/hnsw';
import { Vector, HNSWConfig, SystemError } from '../src/types';
import { euclideanDistance, normalize, initSIMD } from '../src/search/vector';
import { searchLogger } from '../src/utils/logger';
import { promisify } from 'util';

const sleep = promisify(setTimeout);

/**
 * Generate random vector for testing
 */
const generateRandomVector = (dim: number): Vector => {
    const vector = new Float32Array(dim);
    for (let i = 0; i < dim; i++) {
        vector[i] = Math.random();
    }
    return vector;
};

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
        try {
            await initSIMD();
        } catch (error) {
            searchLogger.warn('SIMD initialization failed, using fallback implementation');
        }
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

        test('should handle large vectors efficiently', () => {
            const dimension = 1024;
            const v1 = new Float32Array(dimension);
            const v2 = new Float32Array(dimension);
            
            // Fill vectors with random values
            for (let i = 0; i < dimension; i++) {
                v1[i] = Math.random();
                v2[i] = Math.random();
            }

            const start = performance.now();
            const distance = euclideanDistance(v1, v2);
            const time = performance.now() - start;

            expect(distance).toBeGreaterThan(0);
            expect(time).toBeLessThan(1); // Should be fast even for large vectors
        });
    });

    describe('Graph Operations', () => {
        test('should insert and retrieve vectors', () => {
            const vector = generateRandomVector(config.dimension);
            const id = graph.insert(vector);
            expect(id).toBeDefined();
            const results = graph.search(vector, 1);
            expect(results[0].id).toBe(id);
            expect(results[0].distance).toBeLessThan(1e-6);
        });

        test('should handle multiple insertions with reasonable performance', async () => {
            const vectors: Vector[] = [];
            const ids: number[] = [];
            const batchSize = 1000;
            const insertTimes: number[] = [];

            // Insert vectors in batches
            for (let batch = 0; batch < 10; batch++) {
                const batchStart = performance.now();
                
                for (let i = 0; i < batchSize; i++) {
                    const vector = generateRandomVector(config.dimension);
                    vectors.push(vector);
                    ids.push(graph.insert(vector));
                }

                insertTimes.push(performance.now() - batchStart);
                
                // Allow some time for GC between batches
                await sleep(100);
            }

            // Calculate insertion rate
            const totalTime = insertTimes.reduce((a, b) => a + b, 0);
            const avgInsertTime = totalTime / (batchSize * 10);
            
            searchLogger.info(`Average insert time: ${avgInsertTime.toFixed(3)}ms per vector`);
            expect(avgInsertTime).toBeLessThan(10); // 10ms per insert is reasonable

            // Verify each vector can be found
            const searchTimes: number[] = [];
            for (let i = 0; i < vectors.length; i += 100) { // Test subset for time
                const start = performance.now();
                const results = graph.search(vectors[i], 1);
                searchTimes.push(performance.now() - start);
                expect(results[0].id).toBe(ids[i]);
            }

            const avgSearchTime = searchTimes.reduce((a, b) => a + b) / searchTimes.length;
            searchLogger.info(`Average search time: ${avgSearchTime.toFixed(3)}ms`);
            expect(avgSearchTime).toBeLessThan(5); // 5ms per search is reasonable
        }, 30000);

        test('should maintain approximate kNN property with acceptable recall', async () => {
            const numVectors = 10000;
            const k = 10;
            const vectors: Vector[] = [];
            const ids: number[] = [];

            // Insert vectors
            for (let i = 0; i < numVectors; i++) {
                const vector = generateRandomVector(config.dimension);
                vectors.push(vector);
                ids.push(graph.insert(vector));

                if (i % 1000 === 0) {
                    await sleep(100); // Allow GC to run
                }
            }

            // Test queries
            const numQueries = 100;
            let totalRecall = 0;

            for (let i = 0; i < numQueries; i++) {
                const query = generateRandomVector(config.dimension);
                
                // Get approximate nearest neighbors
                const results = graph.search(query, k);

                // Calculate exact nearest neighbors
                const exactDistances = vectors.map((v, idx) => ({
                    id: ids[idx],
                    distance: euclideanDistance(query, v)
                })).sort((a, b) => a.distance - b.distance).slice(0, k);

                // Calculate recall
                const recall = results.filter(r => 
                    exactDistances.some(e => e.id === r.id)
                ).length / k;

                totalRecall += recall;

                // Allow some time between heavy computations
                if (i % 10 === 0) await sleep(100);
            }

            const avgRecall = totalRecall / numQueries;
            searchLogger.info(`Average recall: ${avgRecall.toFixed(3)}`);
            
            // Expect reasonable recall (>0.8 is good for approximate search)
            expect(avgRecall).toBeGreaterThan(0.8);
        }, 60000);

        test('should handle deletions and updates correctly', async () => {
            // Insert initial vectors
            const vectors: Vector[] = [];
            const ids: number[] = [];

            for (let i = 0; i < 1000; i++) {
                const vector = generateRandomVector(config.dimension);
                vectors.push(vector);
                ids.push(graph.insert(vector));
            }

            // Delete some vectors
            const deletedIds = ids.slice(0, 100);
            for (const id of deletedIds) {
                graph.delete(id);
            }

            // Verify deletions
            for (let i = 0; i < 100; i++) {
                const results = graph.search(vectors[i], 1);
                expect(results[0].id).not.toBe(deletedIds[i]);
            }

            // Update some vectors
            const updatedVectors = vectors.slice(100, 200).map(() => 
                generateRandomVector(config.dimension)
            );

            for (let i = 0; i < 100; i++) {
                const id = ids[i + 100];
                graph.delete(id);
                graph.insert(updatedVectors[i], id);
            }

            // Verify updates
            for (let i = 0; i < 100; i++) {
                const results = graph.search(updatedVectors[i], 1);
                expect(results[0].id).toBe(ids[i + 100]);
                expect(results[0].distance).toBeLessThan(1e-6);
            }
        });

        test('should handle concurrent operations safely', async () => {
            const numOperations = 1000;
            const operations: Array<() => Promise<void>> = [];

            // Generate random operations
            for (let i = 0; i < numOperations; i++) {
                const vector = generateRandomVector(config.dimension);
                operations.push(async () => {
                    const id = graph.insert(vector);
                    const results = graph.search(vector, 1);
                    expect(results[0].id).toBe(id);
                    
                    if (Math.random() < 0.5) {
                        graph.delete(id);
                    }
                });
            }

            // Execute operations in chunks to avoid memory issues
            const chunkSize = 100;
            for (let i = 0; i < operations.length; i += chunkSize) {
                const chunk = operations.slice(i, i + chunkSize);
                await Promise.all(chunk.map(op => op()));
                await sleep(100); // Allow GC to run
            }
        }, 30000);
    });

    describe('Memory Management', () => {
        test('should maintain reasonable memory usage', async () => {
            const initialMemory = process.memoryUsage().heapUsed;
            const vectors: Vector[] = [];
            const numVectors = 10000;

            // Insert vectors in batches
            for (let i = 0; i < numVectors; i += 1000) {
                for (let j = 0; j < 1000; j++) {
                    const vector = generateRandomVector(config.dimension);
                    vectors.push(vector);
                    graph.insert(vector);
                }

                // Allow GC to run
                await sleep(100);
            }

            const finalMemory = process.memoryUsage().heapUsed;
            const memoryPerVector = (finalMemory - initialMemory) / numVectors;

            searchLogger.info(`Memory per vector: ${(memoryPerVector / 1024).toFixed(2)}KB`);
            
            // Memory usage should be reasonable
            // Each vector needs space for:
            // - Float32Array data (dimension * 4 bytes)
            // - Graph connections (M * 4 bytes per level)
            // - Overhead
            const expectedMaxMemory = 
                (config.dimension * 4 + config.M * 4 * 2 + 100) * // 100 bytes overhead
                numVectors;

            expect(finalMemory - initialMemory).toBeLessThan(expectedMaxMemory);
        }, 30000);
    });
});
