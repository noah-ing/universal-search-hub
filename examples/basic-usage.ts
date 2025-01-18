import { UniversalSearchHub } from '../src/index';
import { SystemConfig, Vector, RaftState } from '../src/types';
import { createVector } from '../src/search/vector';

/**
 * Wait for node to become leader
 */
async function waitForLeadership(searchHub: UniversalSearchHub, timeout: number = 5000): Promise<void> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
        const metrics = searchHub.getMetrics();
        if (metrics.raftStatus.state === RaftState.LEADER) {
            return;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('Node did not become leader within timeout');
}

/**
 * Example demonstrating basic usage of Universal Search Hub
 */
async function runExample() {
    // Create configuration for a single node
    const config: SystemConfig = {
        nodeId: 'node0:3000',
        peers: [], // Single node setup
        hnsw: {
            dimension: 128,
            maxElements: 10000,
            M: 24,                  // Increased for better connectivity
            efConstruction: 400,    // Increased for better graph quality
            efSearch: 200,          // Increased for better search accuracy
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
            dataDir: './data',
            persistenceEnabled: true,
            snapshotThreshold: 1000
        },
        network: {
            reconnectInterval: 1000,
            maxReconnectAttempts: 5,
            heartbeatInterval: 100,
            connectionTimeout: 5000
        }
    };

    // Create search hub instance
    console.log('Initializing Universal Search Hub...');
    const searchHub = new UniversalSearchHub(config);
    await searchHub.initialize();
    console.log('Initialization complete');

    try {
        // Wait for node to become leader
        console.log('Waiting for leadership...');
        await waitForLeadership(searchHub);
        console.log('Node is now leader');

        // Generate test vectors with some structure
        console.log('\nGenerating test vectors...');
        const numVectors = 1000;
        const vectors: Vector[] = [];
        const ids: number[] = [];

        // Create clusters of similar vectors for better testing
        const numClusters = 10;
        const vectorsPerCluster = numVectors / numClusters;
        
        for (let cluster = 0; cluster < numClusters; cluster++) {
            // Create a cluster center
            const center = createVector(config.hnsw.dimension);
            for (let j = 0; j < config.hnsw.dimension; j++) {
                center[j] = Math.random();
            }

            // Create vectors around this center
            for (let i = 0; i < vectorsPerCluster; i++) {
                const vector = createVector(config.hnsw.dimension);
                // Add small random variations to the center
                for (let j = 0; j < config.hnsw.dimension; j++) {
                    vector[j] = center[j] + (Math.random() - 0.5) * 0.1;
                }
                vectors.push(vector);
            }
        }

        // Insert vectors
        console.log('Inserting vectors...');
        const insertStart = performance.now();
        for (const vector of vectors) {
            const id = await searchHub.insert(vector);
            ids.push(id);
        }
        const insertTime = performance.now() - insertStart;
        console.log(`Inserted ${numVectors} vectors in ${insertTime.toFixed(2)}ms`);
        console.log(`Average insert time: ${(insertTime / numVectors).toFixed(2)}ms per vector`);

        // Perform searches
        console.log('\nPerforming searches...');
        const numQueries = 100;
        const k = 10; // Number of nearest neighbors to find
        const searchTimes: number[] = [];
        let exactMatches = 0;
        let closeMatches = 0;
        const EXACT_THRESHOLD = 1e-4;  // Relaxed threshold for exact matches
        const CLOSE_THRESHOLD = 1e-2;  // Threshold for close matches

        for (let i = 0; i < numQueries; i++) {
            const queryVector = vectors[Math.floor(Math.random() * vectors.length)];
            const searchStart = performance.now();
            const results = searchHub.search(queryVector, k);
            const searchTime = performance.now() - searchStart;
            searchTimes.push(searchTime);

            // Verify results
            if (results.length > 0) {
                const firstResult = results[0];
                const queryIndex = vectors.indexOf(queryVector);
                if (queryIndex !== -1 && firstResult.id === ids[queryIndex]) {
                    if (firstResult.distance < EXACT_THRESHOLD) {
                        exactMatches++;
                    } else if (firstResult.distance < CLOSE_THRESHOLD) {
                        closeMatches++;
                    }
                }
            }
        }

        // Print search statistics
        const avgSearchTime = searchTimes.reduce((a, b) => a + b) / searchTimes.length;
        const maxSearchTime = Math.max(...searchTimes);
        const minSearchTime = Math.min(...searchTimes);
        
        console.log('\nSearch Performance:');
        console.log(`- Average: ${avgSearchTime.toFixed(2)}ms`);
        console.log(`- Maximum: ${maxSearchTime.toFixed(2)}ms`);
        console.log(`- Minimum: ${minSearchTime.toFixed(2)}ms`);
        console.log(`- Exact Matches (dist < ${EXACT_THRESHOLD}): ${exactMatches}/${numQueries}`);
        console.log(`- Close Matches (dist < ${CLOSE_THRESHOLD}): ${closeMatches}/${numQueries}`);

        // Print system metrics
        const metrics = searchHub.getMetrics();
        console.log('\nSystem Metrics:');
        console.log('- Raft Status:');
        console.log(`  * Node ID: ${metrics.raftStatus.nodeId}`);
        console.log(`  * State: ${metrics.raftStatus.state}`);
        console.log(`  * Term: ${metrics.raftStatus.term}`);
        console.log(`  * Log Length: ${metrics.raftStatus.logLength}`);
        console.log(`  * Leader ID: ${metrics.raftStatus.leaderId || 'self'}`);
        console.log('- Graph Statistics:');
        console.log(`  * Node Count: ${metrics.graphStats.nodeCount}`);
        console.log(`  * Max Level: ${metrics.graphStats.maxLevel}`);
        console.log(`  * Average Connections: ${metrics.graphStats.averageConnections.toFixed(2)}`);
        console.log(`  * Memory Usage: ${(metrics.graphStats.memoryUsage / 1024 / 1024).toFixed(2)} MB`);
        console.log('- Health Status:');
        console.log(`  * Status: ${metrics.health.status}`);
        console.log(`  * Active Connections: ${metrics.health.activeConnections}`);
        console.log(`  * Error Rate: ${metrics.health.errorRate.toFixed(2)}%`);
        console.log(`  * Warnings: ${metrics.health.warnings.length > 0 ? metrics.health.warnings.join(', ') : 'None'}`);

        // Test vector updates
        console.log('\nTesting vector updates...');
        const updateId = ids[0];
        const newVector = createVector(config.hnsw.dimension);
        for (let i = 0; i < config.hnsw.dimension; i++) {
            newVector[i] = Math.random();
        }

        await searchHub.update(updateId, newVector);
        const searchResult = searchHub.search(newVector, 1);
        if (searchResult.length > 0 && searchResult[0].id === updateId && searchResult[0].distance < EXACT_THRESHOLD) {
            console.log('Vector update successful');
        }

        // Test vector deletion
        console.log('\nTesting vector deletion...');
        const deleteId = ids[1];
        await searchHub.delete(deleteId);
        const deletedSearch = searchHub.search(vectors[1], 1);
        if (deletedSearch.length > 0 && deletedSearch[0].id !== deleteId) {
            console.log('Vector deletion successful');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        // Cleanup
        await searchHub.stop();
        console.log('\nExample completed');
    }
}

// Run the example
console.log('Starting Universal Search Hub example...\n');
runExample().catch(error => {
    console.error('Example failed:', error);
    process.exit(1);
});
