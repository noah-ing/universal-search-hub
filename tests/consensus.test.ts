// tests/consensus.test.ts

import { RaftNode } from '../src/consensus/raft';
import {
    RaftState,
    RaftMessage,
    MessageType,
    CommandType,
    RaftCommand,
    VoteRequest,
    VoteResponse,
    AppendEntries,
    AppendResponse,
    SystemError
} from '../src/types';

describe('Raft Consensus Implementation', () => {
    const defaultConfig = {
        heartbeatTimeout: 50,
        electionTimeoutMin: 150,
        electionTimeoutMax: 300,
        batchSize: 100
    };

    let nodes: RaftNode[];
    let messageQueues: Map<string, RaftMessage[]>;
    let committedCommands: Map<string, RaftCommand[]>;

    const setupCluster = (nodeCount: number) => {
        nodes = [];
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
            nodes.push(new RaftNode(
                nodeId,
                peers,
                defaultConfig,
                createMessageHandler(nodeId),
                createCommitHandler(nodeId)
            ));
            messageQueues.set(nodeId, []);
            committedCommands.set(nodeId, []);
        }
    };

    const processMessages = (timeout: number = 1000) => {
        return new Promise<void>(resolve => {
            const startTime = Date.now();
            const processNext = () => {
                if (Date.now() - startTime > timeout) {
                    resolve();
                    return;
                }

                let processed = false;
                for (const [nodeId, queue] of messageQueues.entries()) {
                    if (queue.length > 0) {
                        const message = queue.shift()!;
                        const node = nodes.find(n => n.getStatus().nodeId === nodeId);
                        if (node) {
                            node.handleMessage(message);
                            processed = true;
                        }
                    }
                }

                if (processed) {
                    setImmediate(processNext);
                } else {
                    setTimeout(processNext, 10);
                }
            };

            processNext();
        });
    };

    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
        nodes?.forEach(node => node.stop());
    });

    describe('Leader Election', () => {
        test('should elect a leader in a healthy cluster', async () => {
            setupCluster(3);
            
            // Wait for election timeout
            jest.advanceTimersByTime(defaultConfig.electionTimeoutMax);
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
        });

        test('should maintain leadership with heartbeats', async () => {
            setupCluster(3);
            
            // Initial election
            jest.advanceTimersByTime(defaultConfig.electionTimeoutMax);
            await processMessages();

            const initialLeader = nodes.find(n => n.getStatus().state === RaftState.LEADER)!;
            const initialTerm = initialLeader.getStatus().term;

            // Advance time but less than election timeout
            jest.advanceTimersByTime(defaultConfig.heartbeatTimeout * 2);
            await processMessages();

            // Verify same leader
            expect(initialLeader.getStatus().state).toBe(RaftState.LEADER);
            expect(initialLeader.getStatus().term).toBe(initialTerm);
        });

        test('should handle split vote scenarios', async () => {
            setupCluster(4); // Even number of nodes

            // Force simultaneous elections
            nodes.forEach(node => {
                jest.advanceTimersByTime(defaultConfig.electionTimeoutMin);
            });
            await processMessages();

            // Eventually should resolve to single leader
            jest.advanceTimersByTime(defaultConfig.electionTimeoutMax * 2);
            await processMessages();

            const leaders = nodes.filter(n => n.getStatus().state === RaftState.LEADER);
            expect(leaders.length).toBe(1);
        });
    });

    describe('Log Replication', () => {
        let leader: RaftNode;
        
        beforeEach(async () => {
            setupCluster(3);
            jest.advanceTimersByTime(defaultConfig.electionTimeoutMax);
            await processMessages();
            leader = nodes.find(n => n.getStatus().state === RaftState.LEADER)!;
        });

        test('should replicate commands to followers', async () => {
            const command: RaftCommand = {
                type: CommandType.INSERT,
                data: { id: 1, vector: new Float32Array([1, 2, 3]) }
            };

            // Submit command to leader
            leader.submitCommand(command);
            await processMessages();

            // Verify command is committed on all nodes
            for (const nodeId of committedCommands.keys()) {
                const commands = committedCommands.get(nodeId)!;
                expect(commands.length).toBe(1);
                expect(commands[0].type).toBe(command.type);
                expect(commands[0].data.id).toBe(command.data.id);
            }
        });

        test('should handle concurrent commands', async () => {
            const commands = Array.from({ length: 10 }, (_, i) => ({
                type: CommandType.INSERT,
                data: { id: i, vector: new Float32Array([i, i + 1, i + 2]) }
            }));

            // Submit commands concurrently
            commands.forEach(cmd => leader.submitCommand(cmd));
            await processMessages();

            // Verify all commands are committed in same order
            for (const nodeId of committedCommands.keys()) {
                const committedCmds = committedCommands.get(nodeId)!;
                expect(committedCmds.length).toBe(commands.length);
                
                // Verify order
                committedCmds.forEach((cmd, idx) => {
                    expect(cmd.data.id).toBe(commands[idx].data.id);
                });
            }
        });

        test('should handle network partitions', async () => {
            const partition1 = [nodes[0]];
            const partition2 = [nodes[1], nodes[2]];

            // Simulate network partition
            messageQueues.clear();
            partition1.forEach(node => messageQueues.set(node.getStatus().nodeId, []));
            partition2.forEach(node => messageQueues.set(node.getStatus().nodeId, []));

            // Allow elections in both partitions
            jest.advanceTimersByTime(defaultConfig.electionTimeoutMax);
            await processMessages();

            // Verify at most one leader per term
            const maxTerm = Math.max(...nodes.map(n => n.getStatus().term));
            const leadersInTerm = nodes.filter(n => 
                n.getStatus().state === RaftState.LEADER && 
                n.getStatus().term === maxTerm
            );
            expect(leadersInTerm.length).toBeLessThanOrEqual(1);
        });

        test('should recover from node failures', async () => {
            // Submit initial command
            const command1: RaftCommand = {
                type: CommandType.INSERT,
                data: { id: 1, vector: new Float32Array([1, 2, 3]) }
            };
            leader.submitCommand(command1);
            await processMessages();

            // Simulate node failure
            const failedNode = nodes.find(n => n !== leader)!;
            failedNode.stop();
            nodes = nodes.filter(n => n !== failedNode);

            // Submit another command
            const command2: RaftCommand = {
                type: CommandType.INSERT,
                data: { id: 2, vector: new Float32Array([4, 5, 6]) }
            };
            leader.submitCommand(command2);
            await processMessages();

            // Verify remaining nodes have all commands
            nodes.forEach(node => {
                const commands = committedCommands.get(node.getStatus().nodeId)!;
                expect(commands.length).toBe(2);
                expect(commands[0].data.id).toBe(1);
                expect(commands[1].data.id).toBe(2);
            });
        });
    });

    describe('Safety Properties', () => {
        test('should maintain log consistency', async () => {
            setupCluster(5);
            jest.advanceTimersByTime(defaultConfig.electionTimeoutMax);
            await processMessages();

            const leader = nodes.find(n => n.getStatus().state === RaftState.LEADER)!;
            
            // Submit several commands
            for (let i = 0; i < 5; i++) {
                leader.submitCommand({
                    type: CommandType.INSERT,
                    data: { id: i, vector: new Float32Array([i, i + 1, i + 2]) }
                });
            }
            await processMessages();

            // Verify log consistency
            const allCommands = Array.from(committedCommands.values());
            for (let i = 1; i < allCommands.length; i++) {
                expect(allCommands[i]).toEqual(allCommands[0]);
            }
        });

        test('should not commit entries from previous terms', async () => {
            setupCluster(3);
            
            // Get initial leader
            jest.advanceTimersByTime(defaultConfig.electionTimeoutMax);
            await processMessages();
            let leader = nodes.find(n => n.getStatus().state === RaftState.LEADER)!;
            
            // Submit command but isolate leader before replication
            const command: RaftCommand = {
                type: CommandType.INSERT,
                data: { id: 1, vector: new Float32Array([1, 2, 3]) }
            };
            leader.submitCommand(command);
            
            // Isolate leader
            const oldLeaderId = leader.getStatus().nodeId;
            messageQueues.set(oldLeaderId, []);
            
            // Force new election
            jest.advanceTimersByTime(defaultConfig.electionTimeoutMax * 2);
            await processMessages();
            
            // Verify command was not committed
            nodes
                .filter(n => n.getStatus().nodeId !== oldLeaderId)
                .forEach(node => {
                    const commands = committedCommands.get(node.getStatus().nodeId)!;
                    expect(commands.length).toBe(0);
                });
        });
    });

    describe('Performance Requirements', () => {
        test('should meet election timeout requirements', async () => {
            setupCluster(3);
            
            const start = Date.now();
            jest.advanceTimersByTime(defaultConfig.electionTimeoutMax);
            await processMessages();

            const leader = nodes.find(n => n.getStatus().state === RaftState.LEADER);
            expect(leader).toBeDefined();
            expect(Date.now() - start).toBeLessThanOrEqual(defaultConfig.electionTimeoutMax);
        });

        test('should maintain stable leadership under load', async () => {
            setupCluster(3);
            
            // Initial election
            jest.advanceTimersByTime(defaultConfig.electionTimeoutMax);
            await processMessages();
            
            const leader = nodes.find(n => n.getStatus().state === RaftState.LEADER)!;
            const initialTerm = leader.getStatus().term;

            // Submit commands rapidly
            for (let i = 0; i < 100; i++) {
                leader.submitCommand({
                    type: CommandType.INSERT,
                    data: { id: i, vector: new Float32Array([i, i + 1, i + 2]) }
                });
            }
            
            // Allow processing
            await processMessages(2000);

            // Verify leadership stability
            expect(leader.getStatus().state).toBe(RaftState.LEADER);
            expect(leader.getStatus().term).toBe(initialTerm);
        });
    });
});