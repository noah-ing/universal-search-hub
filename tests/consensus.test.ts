import { RaftNode } from '../src/consensus/raft';
import { RaftStorage } from '../src/consensus/storage';
import { RaftNetwork } from '../src/consensus/network';
import {
    RaftState,
    RaftMessage,
    MessageType,
    CommandType,
    RaftCommand,
    SystemError,
    Vector
} from '../src/types';
import { rm } from 'fs/promises';
import { join } from 'path';
import { promisify } from 'util';

const sleep = promisify(setTimeout);

describe('Raft Consensus Implementation', () => {
    const defaultConfig = {
        heartbeatTimeout: 50,
        electionTimeoutMin: 150,
        electionTimeoutMax: 300,
        batchSize: 100,
        snapshotThreshold: 1000
    };

    const networkConfig = {
        reconnectInterval: 1000,
        maxReconnectAttempts: 3,
        heartbeatInterval: 500,
        connectionTimeout: 2000
    };

    let nodes: RaftNode[];
    let storages: RaftStorage[];
    let networks: RaftNetwork[];
    let messageQueues: Map<string, RaftMessage[]>;
    let committedCommands: Map<string, RaftCommand[]>;
    const testDataDir = join(__dirname, '..', 'test-data');

    const setupCluster = async (nodeCount: number) => {
        nodes = [];
        storages = [];
        networks = [];
        messageQueues = new Map();
        committedCommands = new Map();

        // Create node IDs
        const nodeIds = Array.from({ length: nodeCount }, (_, i) => `node${i}`);

        // Create message handler for each node
        const createMessageHandler = (nodeId: string) => (message: RaftMessage) => {
            const queue = messageQueues.get(message.to) || [];
            queue.push(message);
            messageQueues.set(message.to, queue);
        };

        // Create commit handler for each node
        const createCommitHandler = (nodeId: string) => (command: RaftCommand) => {
            const commands = committedCommands.get(nodeId) || [];
            commands.push(command);
            committedCommands.set(nodeId, commands);
        };

        // Initialize nodes
        for (const nodeId of nodeIds) {
            const peers = nodeIds.filter(id => id !== nodeId);
            
            // Create storage
            const storage = new RaftStorage(nodeId, testDataDir);
            await storage.initialize();
            storages.push(storage);

            // Create network
            const network = new RaftNetwork(nodeId, peers, networkConfig);
            await network.initialize();
            networks.push(network);

            // Create node
            const node = new RaftNode(
                nodeId,
                peers,
                defaultConfig,
                createMessageHandler(nodeId),
                createCommitHandler(nodeId)
            );
            await node.initialize(storage);
            nodes.push(node);

            messageQueues.set(nodeId, []);
            committedCommands.set(nodeId, []);
        }
    };

    const processMessages = async (timeout: number = 1000): Promise<void> => {
        const startTime = Date.now();
        while (Date.now() - startTime < timeout) {
            let processed = false;
            for (const [nodeId, queue] of messageQueues.entries()) {
                if (queue.length > 0) {
                    const message = queue.shift()!;
                    const node = nodes.find(n => n.getStatus().nodeId === nodeId);
                    if (node) {
                        await node.handleMessage(message);
                        processed = true;
                    }
                }
            }

            if (!processed) {
                await sleep(10);
            }
        }
    };

    beforeAll(async () => {
        // Clean up test data directory
        try {
            await rm(testDataDir, { recursive: true, force: true });
        } catch (error) {
            console.warn('Failed to clean test data directory:', error);
        }
    });

    afterEach(async () => {
        // Stop nodes and clean up
        await Promise.all([
            ...nodes.map(node => node.stop()),
            ...networks.map(network => network.stop()),
            ...storages.map(storage => storage.close())
        ]);

        try {
            await rm(testDataDir, { recursive: true, force: true });
        } catch (error) {
            console.warn('Failed to clean test data directory:', error);
        }
    });

    describe('Leader Election', () => {
        test('should elect a leader in a healthy cluster', async () => {
            await setupCluster(3);
            
            // Wait for election timeout
            await sleep(defaultConfig.electionTimeoutMax);
            await processMessages();

            // Verify leader election
            const leaders = nodes.filter(n => n.getStatus().state === RaftState.LEADER);
            expect(leaders.length).toBe(1);

            // Verify other nodes are followers
            const followers = nodes.filter(n => n.getStatus().state === RaftState.FOLLOWER);
            expect(followers.length).toBe(2);

            // Verify terms
            const leaderTerm = leaders[0].getStatus().term;
            followers.forEach(follower => {
                expect(follower.getStatus().term).toBe(leaderTerm);
            });
        }, 10000);

        test('should maintain leadership with heartbeats', async () => {
            await setupCluster(3);
            
            // Initial election
            await sleep(defaultConfig.electionTimeoutMax);
            await processMessages();

            const initialLeader = nodes.find(n => n.getStatus().state === RaftState.LEADER)!;
            const initialTerm = initialLeader.getStatus().term;

            // Wait for multiple heartbeat intervals
            await sleep(defaultConfig.heartbeatTimeout * 3);
            await processMessages();

            // Verify same leader
            expect(initialLeader.getStatus().state).toBe(RaftState.LEADER);
            expect(initialLeader.getStatus().term).toBe(initialTerm);
        }, 10000);
    });

    describe('Log Replication', () => {
        let leader: RaftNode;
        
        beforeEach(async () => {
            await setupCluster(3);
            await sleep(defaultConfig.electionTimeoutMax);
            await processMessages();
            leader = nodes.find(n => n.getStatus().state === RaftState.LEADER)!;
        });

        test('should replicate commands to followers', async () => {
            const vector = new Float32Array([1, 2, 3]);
            const command: RaftCommand = {
                type: CommandType.INSERT,
                data: { id: 1, vector }
            };

            // Submit command to leader
            await leader.submitCommand(command);
            await processMessages();

            // Verify command is committed on all nodes
            for (const nodeId of committedCommands.keys()) {
                const commands = committedCommands.get(nodeId)!;
                expect(commands.length).toBe(1);
                expect(commands[0].type).toBe(command.type);
                expect(commands[0].data.id).toBe(command.data.id);
            }
        });

        test('should persist log entries across restarts', async () => {
            // Submit some commands
            const commands = Array.from({ length: 5 }, (_, i) => ({
                type: CommandType.INSERT,
                data: { id: i, vector: new Float32Array([i, i + 1, i + 2]) }
            }));

            for (const command of commands) {
                await leader.submitCommand(command);
            }
            await processMessages();

            // Stop all nodes
            await Promise.all(nodes.map(node => node.stop()));

            // Restart cluster
            await setupCluster(3);
            await processMessages();

            // Verify all commands are present
            for (const nodeId of committedCommands.keys()) {
                const nodeCommands = committedCommands.get(nodeId)!;
                expect(nodeCommands.length).toBe(commands.length);
                
                nodeCommands.forEach((cmd, idx) => {
                    expect(cmd.type).toBe(commands[idx].type);
                    expect(cmd.data.id).toBe(commands[idx].data.id);
                });
            }
        });
    });

    describe('Fault Tolerance', () => {
        test('should handle network partitions', async () => {
            await setupCluster(5);
            await sleep(defaultConfig.electionTimeoutMax);
            await processMessages();

            const originalLeader = nodes.find(n => n.getStatus().state === RaftState.LEADER)!;

            // Create network partition
            const partition1 = nodes.slice(0, 2);
            const partition2 = nodes.slice(2);

            // Simulate network partition
            messageQueues.clear();
            partition1.forEach(node => messageQueues.set(node.getStatus().nodeId, []));
            partition2.forEach(node => messageQueues.set(node.getStatus().nodeId, []));

            // Let both partitions elect leaders
            await sleep(defaultConfig.electionTimeoutMax * 2);
            await processMessages();

            // Verify at most one leader per term
            const maxTerm = Math.max(...nodes.map(n => n.getStatus().term));
            const leadersInTerm = nodes.filter(n => 
                n.getStatus().state === RaftState.LEADER && 
                n.getStatus().term === maxTerm
            );
            expect(leadersInTerm.length).toBeLessThanOrEqual(1);
        }, 15000);

        test('should recover from node failures', async () => {
            await setupCluster(3);
            await sleep(defaultConfig.electionTimeoutMax);
            await processMessages();

            const leader = nodes.find(n => n.getStatus().state === RaftState.LEADER)!;

            // Submit initial command
            const command1: RaftCommand = {
                type: CommandType.INSERT,
                data: { id: 1, vector: new Float32Array([1, 2, 3]) }
            };
            await leader.submitCommand(command1);
            await processMessages();

            // Stop a follower
            const failedNode = nodes.find(n => n !== leader)!;
            await failedNode.stop();
            nodes = nodes.filter(n => n !== failedNode);

            // Submit another command
            const command2: RaftCommand = {
                type: CommandType.INSERT,
                data: { id: 2, vector: new Float32Array([4, 5, 6]) }
            };
            await leader.submitCommand(command2);
            await processMessages();

            // Verify remaining nodes have all commands
            nodes.forEach(node => {
                const commands = committedCommands.get(node.getStatus().nodeId)!;
                expect(commands.length).toBe(2);
                expect(commands[0].data.id).toBe(1);
                expect(commands[1].data.id).toBe(2);
            });
        }, 15000);
    });
});
