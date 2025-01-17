import { UniversalSearchHub } from '../src/index';
import { SystemConfig, Vector } from '../src/types';
import { createVector } from '../src/search/vector';

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
    };

    // Create search hub instance
    console.log('Initializing Universal Search Hub...');
    const searchHub = new UniversalSearchHub(config);

    try {
        // Generate some test vectors
        console.log('\nGenerating test vectors...');
        const numVectors = 1000;
        const vectors: Vector[] = [];
        const ids: number[] = [];

        for (let i = 0; i < numVectors; i++) {
            const vector = createVector(config.hnsw.dimension);
            // Fill with random values
            for (let j = 0; j < config.hnsw.dimension; j++) {
                vector[j] = Math.random();
            }
            vectors.push(vector);
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

        // Perform some searches
        console.log('\nPerforming searches...');
        const numQueries = 100;
        const k = 10; // Number of nearest neighbors to find
        const searchTimes: number[] = [];

        for (let i = 0; i < numQueries; i++) {
            const queryVector = vectors[Math.floor(Math.random() * vectors.length)];
            const searchStart = performance.now();
            const results = searchHub.search(queryVector, k);
            const searchTime = performance.now() - searchStart;
            searchTimes.push(searchTime);

            // Verify first result is the query vector itself
            const firstResult = results[0];
            if (firstResult.id === ids[vectors.indexOf(queryVector)]) {
                if (firstResult.distance < 1e-6) {
                    console.log(`Query ${i + 1}: Successfully found exact match`);
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

        // Print system metrics
        const metrics = searchHub.getMetrics();
        console.log('\nSystem Metrics:');
        console.log('- Search Metrics:');
        console.log(`  * Average Search Time: ${metrics.searchMetrics.avgSearchTime.toFixed(2)}ms`);
        console.log(`  * Average Insert Time: ${metrics.searchMetrics.avgInsertTime.toFixed(2)}ms`);
        console.log('- Memory Usage:');
        console.log(`  * ${(metrics.graphStats.memoryUsage / 1024 / 1024).toFixed(2)} MB`);
        console.log('- Graph Statistics:');
        console.log(`  * Nodes: ${metrics.graphStats.nodeCount}`);
        console.log(`  * Average Connections: ${metrics.graphStats.averageConnections.toFixed(2)}`);
        console.log('- Health:');
        console.log(`  * Status: ${metrics.health.status}`);
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
        if (searchResult[0].id === updateId && searchResult[0].distance < 1e-6) {
            console.log('Vector update successful');
        }

        // Test vector deletion
        console.log('\nTesting vector deletion...');
        const deleteId = ids[1];
        await searchHub.delete(deleteId);
        const deletedSearch = searchHub.search(vectors[1], 1);
        if (deletedSearch[0].id !== deleteId) {
            console.log('Vector deletion successful');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        // Cleanup
        searchHub.stop();
        console.log('\nExample completed');
    }
}

// Run the example
console.log('Starting Universal Search Hub example...\n');
runExample().catch(error => {
    console.error('Example failed:', error);
    process.exit(1);
});
