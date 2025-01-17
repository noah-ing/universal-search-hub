// tests/integration.test.ts

import { UniversalSearchHub } from '../src/index';
import { SystemConfig, Vector, SystemError, ErrorType, RaftState } from '../src/types';
import WebSocket from 'ws';

describe('Universal Search Hub Integration', () => {
    let nodes: UniversalSearchHub[];
    const ports = [8081, 8082, 8083];
    const dimension = 128;

    const createConfig = (port: number): SystemConfig => ({
        nodeId: `localhost:${port}`,
        peers: ports.filter(p => p !== port).map(p => `localhost:${p}`),
        hnsw: {
            dimension,
            maxElements: 10000,
            M: 16,
            efConstruction: 200,
            efSearch: 50,
            ml: 1.0
        },
        raft: {
            heartbeatTimeout: 50,
            electionTimeoutMin: 150,
            electionTimeoutMax: 300,
            batchSize: 100
        },
        monitoring: {
            metricsInterval: 1000,
            healthCheckInterval: 500
        }
    });

    const generateRandomVector = (dim: number): Vector => {
        const vector = new Float32Array(dim);
        for (let i = 0; i < dim; i++) {
            vector[i] = Math.random();
        }
        return vector;
    };

    const waitForLeader = async (timeout: number = 5000): Promise<UniversalSearchHub> => {
        const startTime = Date.now();
        while (Date.now() - startTime < timeout) {
            for (const node of nodes) {
                const metrics = node.getMetrics();
                if (metrics.raftStatus.state === RaftState.LEADER) {
                    return node;
                }
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        throw new Error('No leader elected within timeout');
    };

    const waitForReplication = async (timeout: number = 2000): Promise<void> => {
        const startTime = Date.now();
        while (Date.now() - startTime < timeout) {
            const metrics = nodes.map(n => n.getMetrics());
            const logLengths = new Set(metrics.map(m => m.raftStatus.logLength));
            if (logLengths.size === 1) {
                return;
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        throw new Error('Replication did not complete within timeout');
    };

    beforeEach(async () => {
        nodes = ports.map(port => new UniversalSearchHub(createConfig(port)));
        // Wait for cluster to stabilize
        await new Promise(resolve => setTimeout(resolve, 1000));
    });

    afterEach(() => {
        nodes.forEach(node => node.stop());
    });

    describe('Cluster Formation', () => {
        test('should form a healthy cluster', async () => {
            const leader = await waitForLeader();
            const metrics = leader.getMetrics();
            
            expect(metrics.health.status).toBe('healthy');
            expect(metrics.activeConnections).toBe(ports.length - 1);
        });

        test('should maintain consistent configuration across nodes', () => {
            const configs = nodes.map(node => node.getMetrics().raftStatus);
            
            // Verify term consistency
            const terms = new Set(configs.map(c => c.term));
            expect(terms.size).toBe(1);

            // Verify leader consistency
            const leaders = configs.filter(c => c.state === RaftState.LEADER);
            expect(leaders.length).toBe(1);
        });
    });

    describe('Distributed Search Operations', () => {
        let leader: UniversalSearchHub;
        const testVectors: Vector[] = [];
        const testIds: number[] = [];

        beforeEach(async () => {
            leader = await waitForLeader();
            
            // Insert test vectors
            for (let i = 0; i < 100; i++) {
                const vector = generateRandomVector(dimension);
                testVectors.push(vector);
                const id = await leader.insert(vector);
                testIds.push(id);
            }
            
            await waitForReplication();
        });

        test('should replicate vector insertions across cluster', async () => {
            const query = testVectors[0];
            
            // Search on each node
            for (const node of nodes) {
                const results = node.search(query, 1);
                expect(results[0].id).toBe(testIds[0]);
                expect(results[0].distance).toBeLessThan(1e-6);
            }
        });

        test('should handle vector updates consistently', async () => {
            const newVector = generateRandomVector(dimension);
            const updateId = testIds[0];
            
            // Update vector through leader
            await leader.update(updateId, newVector);
            await waitForReplication();
            
            // Verify update on all nodes
            for (const node of nodes) {
                const results = node.search(newVector, 1);
                expect(results[0].id).toBe(updateId);
                expect(results[0].distance).toBeLessThan(1e-6);
            }
        });

        test('should handle vector deletions across cluster', async () => {
            const deleteId = testIds[0];
            const queryVector = testVectors[0];
            
            // Delete vector through leader
            await leader.delete(deleteId);
            await waitForReplication();
            
            // Verify deletion on all nodes
            for (const node of nodes) {
                const results = node.search(queryVector, 1);
                expect(results[0].id).not.toBe(deleteId);
            }
        });

        test('should maintain search performance across cluster', async () => {
            const queryVector = generateRandomVector(dimension);
            const k = 10;
            
            // Measure search times on all nodes
            const searchTimes = await Promise.all(nodes.map(async node => {
                const start = performance.now();
                const results = node.search(queryVector, k);
                const time = performance.now() - start;
                
                // Verify results
                expect(results.length).toBe(k);
                expect(results.every(r => testIds.includes(r.id))).toBe(true);
                
                return time;
            }));
            
            // Verify performance
            const avgTime = searchTimes.reduce((a, b) => a + b) / searchTimes.length;
            expect(avgTime).toBeLessThan(1.0); // Average < 1ms
        });
    });

    describe('Fault Tolerance', () => {
        let leader: UniversalSearchHub;
        let followers: UniversalSearchHub[];

        beforeEach(async () => {
            leader = await waitForLeader();
            followers = nodes.filter(n => n !== leader);
        });

        test('should handle follower node failure', async () => {
            // Stop a follower
            const failedNode = followers[0];
            failedNode.stop();
            nodes = nodes.filter(n => n !== failedNode);
            
            // Verify cluster remains operational
            const vector = generateRandomVector(dimension);
            const id = await leader.insert(vector);
            await waitForReplication();
            
            // Verify remaining nodes
            for (const node of nodes) {
                const results = node.search(vector, 1);
                expect(results[0].id).toBe(id);
            }
        });

        test('should handle leader failure', async () => {
            // Insert initial data
            const vector = generateRandomVector(dimension);
            const id = await leader.insert(vector);
            await waitForReplication();
            
            // Stop leader
            leader.stop();
            nodes = nodes.filter(n => n !== leader);
            
            // Wait for new leader
            const newLeader = await waitForLeader();
            expect(newLeader).not.toBe(leader);
            
            // Verify cluster remains operational
            const newVector = generateRandomVector(dimension);
            const newId = await newLeader.insert(newVector);
            await waitForReplication();
            
            // Verify data consistency
            for (const node of nodes) {
                const results1 = node.search(vector, 1);
                expect(results1[0].id).toBe(id);
                
                const results2 = node.search(newVector, 1);
                expect(results2[0].id).toBe(newId);
            }
        });

        test('should handle network partitions', async () => {
            // Create two partitions
            const partition1 = [nodes[0]];
            const partition2 = nodes.slice(1);
            
            // Simulate network partition by stopping nodes
            partition2.forEach(node => node.stop());
            
            // Verify partition1 remains operational but cannot commit
            const vector = generateRandomVector(dimension);
            await expect(partition1[0].insert(vector)).rejects.toThrow(SystemError);
            
            // Restore network
            nodes = [partition1[0]];
            partition2.forEach(node => {
                const newNode = new UniversalSearchHub(createConfig(
                    parseInt(node.getMetrics().raftStatus.nodeId.split(':')[1])
                ));
                nodes.push(newNode);
            });
            
            // Wait for cluster to heal
            await new Promise(resolve => setTimeout(resolve, 1000));
            const newLeader = await waitForLeader();
            
            // Verify cluster is operational
            const newVector = generateRandomVector(dimension);
            const id = await newLeader.insert(newVector);
            await waitForReplication();
            
            for (const node of nodes) {
                const results = node.search(newVector, 1);
                expect(results[0].id).toBe(id);
            }
        });
    });

    describe('Performance and Monitoring', () => {
        let leader: UniversalSearchHub;

        beforeEach(async () => {
            leader = await waitForLeader();
        });

        test('should maintain performance under load', async () => {
            const batchSize = 1000;
            const vectors: Vector[] = [];
            const start = performance.now();
            
            // Insert batch of vectors
            for (let i = 0; i < batchSize; i++) {
                const vector = generateRandomVector(dimension);
                vectors.push(vector);
                await leader.insert(vector);
            }
            
            await waitForReplication();
            const insertTime = performance.now() - start;
            
            // Verify insertion rate
            const insertsPerSecond = batchSize / (insertTime / 1000);
            expect(insertsPerSecond).toBeGreaterThan(100); // At least 100 inserts/sec
            
            // Verify search performance
            const queryTimes: number[] = [];
            for (let i = 0; i < 100; i++) {
                const query = generateRandomVector(dimension);
                const start = performance.now();
                leader.search(query, 10);
                queryTimes.push(performance.now() - start);
            }
            
            const avgQueryTime = queryTimes.reduce((a, b) => a + b) / queryTimes.length;
            expect(avgQueryTime).toBeLessThan(1.0); // Average < 1ms
        });

        test('should provide accurate monitoring metrics', async () => {
            // Generate some load
            for (let i = 0; i < 100; i++) {
                await leader.insert(generateRandomVector(dimension));
            }
            
            await waitForReplication();
            
            // Check metrics on all nodes
            for (const node of nodes) {
                const metrics = node.getMetrics();
                
                // Verify basic metrics
                expect(metrics.operations).toBeGreaterThan(0);
                expect(metrics.uptime).toBeGreaterThan(0);
                
                // Verify search metrics
                expect(metrics.searchMetrics.avgSearchTime).toBeDefined();
                expect(metrics.searchMetrics.avgInsertTime).toBeDefined();
                
                // Verify health status
                expect(metrics.health.status).toBe('healthy');
                expect(metrics.health.warnings).toHaveLength(0);
                
                // Verify Raft status
                expect(metrics.raftStatus.term).toBeGreaterThan(0);
                expect(['LEADER', 'FOLLOWER']).toContain(metrics.raftStatus.state);
            }
        });

        test('should handle system errors gracefully', async () => {
            // Test invalid operations
            await expect(leader.delete(-1)).rejects.toThrow(SystemError);
            await expect(leader.update(-1, generateRandomVector(dimension)))
                .rejects.toThrow(SystemError);
            
            // Verify system remains operational
            const vector = generateRandomVector(dimension);
            const id = await leader.insert(vector);
            await waitForReplication();
            
            const results = leader.search(vector, 1);
            expect(results[0].id).toBe(id);
        });
    });
});