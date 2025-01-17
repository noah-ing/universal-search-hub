import { UniversalSearchHub } from '../src/index';
import { SystemConfig, Vector } from '../src/types';
import { createVector } from '../src/search/vector';
import { join } from 'path';

const dimension = 128;
const numVectors = 10000;
const k = 10;

const config: SystemConfig = {
    nodeId: 'localhost:8081',
    peers: ['localhost:8082', 'localhost:8083'],
    hnsw: {
        dimension,
        maxElements: 100000,
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
        dataDir: join(__dirname, '..', 'benchmark-data'),
        persistenceEnabled: true,
        snapshotThreshold: 1000
    },
    network: {
        reconnectInterval: 1000,
        maxReconnectAttempts: 3,
        heartbeatInterval: 500,
        connectionTimeout: 2000
    }
};

async function runBenchmark() {
    console.log('Starting benchmark...');
    const node = new UniversalSearchHub(config);
    await node.initialize();

    // Generate test vectors
    console.log('Generating test vectors...');
    const vectors: Vector[] = [];
    for (let i = 0; i < numVectors; i++) {
        const vector = createVector(dimension);
        for (let j = 0; j < dimension; j++) {
            vector[j] = Math.random();
        }
        vectors.push(vector);
    }

    // Benchmark insertion
    console.log('Benchmarking insertion...');
    const insertStart = performance.now();
    for (let i = 0; i < numVectors; i++) {
        await node.insert(vectors[i]);
        if ((i + 1) % 1000 === 0) {
            console.log(`Inserted ${i + 1} vectors`);
        }
    }
    const insertEnd = performance.now();
    const insertTime = insertEnd - insertStart;
    const insertThroughput = numVectors / (insertTime / 1000);

    // Benchmark search
    console.log('Benchmarking search...');
    const searchStart = performance.now();
    let totalResults = 0;
    for (let i = 0; i < 1000; i++) {
        const results = node.search(vectors[Math.floor(Math.random() * numVectors)], k);
        totalResults += results.length;
    }
    const searchEnd = performance.now();
    const searchTime = searchEnd - searchStart;
    const searchThroughput = 1000 / (searchTime / 1000);

    // Get metrics
    const metrics = node.getMetrics();

    console.log('\nBenchmark Results:');
    console.log('==================');
    console.log(`Insertion Performance:`);
    console.log(`- Total Time: ${insertTime.toFixed(2)}ms`);
    console.log(`- Throughput: ${insertThroughput.toFixed(2)} vectors/second`);
    console.log(`\nSearch Performance:`);
    console.log(`- Total Time: ${searchTime.toFixed(2)}ms`);
    console.log(`- Throughput: ${searchThroughput.toFixed(2)} queries/second`);
    console.log(`\nMemory Usage:`);
    console.log(`- Graph Memory: ${(metrics.graphStats.memoryUsage / 1024 / 1024).toFixed(2)} MB`);
    console.log(`- Total Nodes: ${metrics.graphStats.nodeCount}`);
    console.log(`- Max Level: ${metrics.graphStats.maxLevel}`);
    console.log(`- Average Connections: ${metrics.graphStats.averageConnections.toFixed(2)}`);

    await node.stop();
}

runBenchmark().catch(console.error);
