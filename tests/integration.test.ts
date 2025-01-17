import { UniversalSearchHub } from '../src/index';
import { SystemConfig, Vector, SystemError, ErrorType, RaftState } from '../src/types';
import { createVector } from '../src/search/vector';
import { networkLogger, raftLogger } from '../src/utils/logger';
import { promisify } from 'util';
import { rm } from 'fs/promises';
import { join } from 'path';

const sleep = promisify(setTimeout);

describe('Universal Search Hub Integration', () => {
    let nodes: UniversalSearchHub[];
    const ports = [8081, 8082, 8083];
    const dimension = 128;
    const dataDir = join(__dirname, '..', 'test-data');

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
        },
        storage: {
            dataDir,
            persistenceEnabled: true,
            snapshotThreshold: 1000 // Take snapshot every 1000 entries
        },
        network: {
            reconnectInterval: 1000,
            maxReconnectAttempts: 3,
            heartbeatInterval: 500,
            connectionTimeout: 2000
        }
    });

    const generateRandomVector = (dim: number): Vector => {
        const vector = createVector(dim);
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
            await sleep(100);
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
            await sleep(100);
        }
        throw new Error('Replication did not complete within timeout');
    };

    beforeAll(async () => {
        // Clean up test data directory
        try {
            await rm(dataDir, { recursive: true, force: true });
        } catch (error) {
            networkLogger.warn('Failed to clean test data directory:', error);
        }
    });

    beforeEach(async () => {
        // Initialize nodes
        nodes = await Promise.all(
            ports.map(async port => {
                const node = new UniversalSearchHub(createConfig(port));
                await node.initialize();
                return node;
            })
        );

        // Wait for cluster to stabilize
        await sleep(1000);
    });

    afterEach(async () => {
        // Stop nodes and clean up
        await Promise.all(nodes.map(node => node.stop()));
        try {
            await rm(dataDir, { recursive: true, force: true });
        } catch (error) {
            networkLogger.warn('Failed to clean test data directory:', error);
        }
    });

    describe('Cluster Formation', () => {
        test('should form a healthy cluster', async () => {
            const leader = await waitForLeader();
            const metrics = leader.getMetrics();
            
            expect(metrics.health.status).toBe('healthy');
            expect(metrics.health.activeConnections).toBe(ports.length - 1);
        }, 10000);

        test('should maintain consistent configuration across nodes', async () => {
            const configs = nodes.map(node => node.getMetrics().raftStatus);
            
            // Verify term consistency
            const terms = new Set(configs.map(c => c.term));
            expect(terms.size).toBe(1);

            // Verify leader consistency
            const leaders = configs.filter(c => c.state === RaftState.LEADER);
            expect(leaders.length).toBe(1);
        }, 10000);
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
        }, 15000);

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
            await failedNode.stop();
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
        }, 15000);

        test('should handle leader failure', async () => {
            // Insert initial data
            const vector = generateRandomVector(dimension);
            const id = await leader.insert(vector);
            await waitForReplication();
            
            // Stop leader
            await leader.stop();
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
        }, 20000);

        test('should recover from network partitions', async () => {
            // Create network partition by stopping communication
            const partition1 = [nodes[0]];
            const partition2 = nodes.slice(1);
            
            // Simulate network partition
            await Promise.all(partition2.map(node => node.stop()));
            
            // Verify partition1 cannot commit
            const vector = generateRandomVector(dimension);
            await expect(partition1[0].insert(vector)).rejects.toThrow(SystemError);
            
            // Restore network
            nodes = [partition1[0]];
            await Promise.all(partition2.map(async node => {
                const newNode = new UniversalSearchHub(createConfig(
                    parseInt(node.getMetrics().raftStatus.nodeId.split(':')[1])
                ));
                await newNode.initialize();
                nodes.push(newNode);
            }));
            
            // Wait for cluster to heal
            await sleep(2000);
            const newLeader = await waitForLeader();
            
            // Verify cluster is operational
            const newVector = generateRandomVector(dimension);
            const id = await newLeader.insert(newVector);
            await waitForReplication();
            
            for (const node of nodes) {
                const results = node.search(newVector, 1);
                expect(results[0].id).toBe(id);
            }
        }, 30000);
    });
});
