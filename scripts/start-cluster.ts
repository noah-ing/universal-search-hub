import { UniversalSearchHub } from '../src/index';
import { SystemConfig } from '../src/types';
import { config as dotenvConfig } from 'dotenv';
import { join } from 'path';

// Load environment variables
dotenvConfig({ path: join(__dirname, '..', '.env') });

/**
 * Create node configuration
 */
function createNodeConfig(nodeId: string, port: number, peers: string[]): SystemConfig {
    return {
        nodeId: `${nodeId}:${port}`,
        peers: peers.filter(p => !p.startsWith(nodeId)),
        hnsw: {
            dimension: parseInt(process.env.HNSW_DIMENSION || '128'),
            maxElements: parseInt(process.env.HNSW_MAX_ELEMENTS || '1000000'),
            M: parseInt(process.env.HNSW_M || '16'),
            efConstruction: parseInt(process.env.HNSW_EF_CONSTRUCTION || '200'),
            efSearch: parseInt(process.env.HNSW_EF_SEARCH || '50'),
            ml: parseFloat(process.env.HNSW_ML || '1.0')
        },
        raft: {
            heartbeatTimeout: parseInt(process.env.RAFT_HEARTBEAT_TIMEOUT || '50'),
            electionTimeoutMin: parseInt(process.env.RAFT_ELECTION_TIMEOUT_MIN || '150'),
            electionTimeoutMax: parseInt(process.env.RAFT_ELECTION_TIMEOUT_MAX || '300'),
            batchSize: parseInt(process.env.RAFT_BATCH_SIZE || '100')
        },
        monitoring: {
            metricsInterval: parseInt(process.env.METRICS_INTERVAL || '1000'),
            healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '500')
        }
    };
}

/**
 * Start cluster nodes
 */
async function startCluster() {
    // Default cluster configuration
    const basePort = parseInt(process.env.PORT || '3000');
    const numNodes = parseInt(process.env.NUM_NODES || '3');
    
    // Generate peer list
    const peers = Array.from({ length: numNodes }, (_, i) => 
        `localhost:${basePort + i}`
    );

    // Start nodes
    const nodes: UniversalSearchHub[] = [];
    for (let i = 0; i < numNodes; i++) {
        const nodeId = `node${i}`;
        const port = basePort + i;
        const config = createNodeConfig(nodeId, port, peers);
        
        console.log(`Starting ${nodeId} on port ${port}...`);
        const node = new UniversalSearchHub(config);
        nodes.push(node);
    }

    // Wait for cluster to stabilize
    console.log('\nWaiting for cluster to stabilize...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Print cluster status
    console.log('\nCluster Status:');
    for (const node of nodes) {
        const metrics = node.getMetrics();
        console.log(`\n${metrics.raftStatus.nodeId}:`);
        console.log(`- State: ${metrics.raftStatus.state}`);
        console.log(`- Term: ${metrics.raftStatus.term}`);
        console.log(`- Health: ${metrics.health.status}`);
        console.log(`- Active Connections: ${metrics.activeConnections}`);
    }

    // Handle process termination
    process.on('SIGINT', () => {
        console.log('\nShutting down cluster...');
        nodes.forEach(node => node.stop());
        process.exit(0);
    });

    // Keep process alive
    console.log('\nCluster is running. Press Ctrl+C to stop.');
}

// Start the cluster
console.log('Starting Universal Search Hub cluster...\n');
startCluster().catch(error => {
    console.error('Failed to start cluster:', error);
    process.exit(1);
});
