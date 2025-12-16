/**
 * Benchmark script for Universal Search Hub API
 * Tests actual performance metrics for search and insert operations
 */

const API_URL = process.env['API_URL'] || 'http://localhost:3001';

interface BenchmarkResult {
    operation: string;
    dimension: number;
    iterations: number;
    totalTime: number;
    avgTime: number;
    minTime: number;
    maxTime: number;
    p50: number;
    p95: number;
    p99: number;
    throughput: number;
}

/**
 * Generate a random vector of given dimension
 */
function generateRandomVector(dimension: number): number[] {
    const vector = Array.from({ length: dimension }, () => Math.random() * 2 - 1);
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    return vector.map(val => val / magnitude);
}

/**
 * Calculate percentile from sorted array
 */
function percentile(sorted: number[], p: number): number {
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
}

/**
 * Benchmark insert operations
 */
async function benchmarkInsert(dimension: number, iterations: number): Promise<BenchmarkResult> {
    const times: number[] = [];

    console.log(`  Benchmarking insert (${dimension}D, ${iterations} iterations)...`);

    for (let i = 0; i < iterations; i++) {
        const vector = generateRandomVector(dimension);
        const start = performance.now();

        const response = await fetch(`${API_URL}/api/vectors`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                vector,
                metadata: { benchmark: true, iteration: i }
            }),
        });

        const end = performance.now();

        if (!response.ok) {
            console.error(`    Insert ${i} failed`);
            continue;
        }

        times.push(end - start);

        // Progress indicator
        if ((i + 1) % 100 === 0) {
            process.stdout.write(`    Progress: ${i + 1}/${iterations}\r`);
        }
    }

    const sorted = times.slice().sort((a, b) => a - b);
    const totalTime = times.reduce((sum, t) => sum + t, 0);

    console.log(`    Completed ${times.length} inserts`);

    return {
        operation: 'insert',
        dimension,
        iterations: times.length,
        totalTime,
        avgTime: totalTime / times.length,
        minTime: sorted[0],
        maxTime: sorted[sorted.length - 1],
        p50: percentile(sorted, 50),
        p95: percentile(sorted, 95),
        p99: percentile(sorted, 99),
        throughput: times.length / (totalTime / 1000),
    };
}

/**
 * Benchmark search operations
 */
async function benchmarkSearch(dimension: number, iterations: number): Promise<BenchmarkResult> {
    const times: number[] = [];

    console.log(`  Benchmarking search (${dimension}D, ${iterations} iterations)...`);

    for (let i = 0; i < iterations; i++) {
        const vector = generateRandomVector(dimension);
        const start = performance.now();

        const response = await fetch(`${API_URL}/api/search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ vector, k: 10 }),
        });

        const end = performance.now();

        if (!response.ok) {
            console.error(`    Search ${i} failed`);
            continue;
        }

        times.push(end - start);

        // Progress indicator
        if ((i + 1) % 100 === 0) {
            process.stdout.write(`    Progress: ${i + 1}/${iterations}\r`);
        }
    }

    const sorted = times.slice().sort((a, b) => a - b);
    const totalTime = times.reduce((sum, t) => sum + t, 0);

    console.log(`    Completed ${times.length} searches`);

    return {
        operation: 'search',
        dimension,
        iterations: times.length,
        totalTime,
        avgTime: totalTime / times.length,
        minTime: sorted[0],
        maxTime: sorted[sorted.length - 1],
        p50: percentile(sorted, 50),
        p95: percentile(sorted, 95),
        p99: percentile(sorted, 99),
        throughput: times.length / (totalTime / 1000),
    };
}

/**
 * Format benchmark results as table
 */
function formatResults(results: BenchmarkResult[]): string {
    const header = '| Operation | Dimension | Avg (ms) | P50 (ms) | P95 (ms) | P99 (ms) | Throughput (ops/s) |';
    const separator = '|-----------|-----------|----------|----------|----------|----------|-------------------|';

    const rows = results.map(r =>
        `| ${r.operation.padEnd(9)} | ${r.dimension.toString().padEnd(9)} | ${r.avgTime.toFixed(2).padStart(8)} | ${r.p50.toFixed(2).padStart(8)} | ${r.p95.toFixed(2).padStart(8)} | ${r.p99.toFixed(2).padStart(8)} | ${r.throughput.toFixed(1).padStart(17)} |`
    );

    return [header, separator, ...rows].join('\n');
}

/**
 * Main benchmark function
 */
async function main(): Promise<void> {
    console.log('🏃 Universal Search Hub - Performance Benchmark');
    console.log('================================================\n');

    // Check if server is running
    try {
        const health = await fetch(`${API_URL}/health`);
        if (!health.ok) throw new Error('Server not healthy');
        console.log('✅ Server is running\n');
    } catch {
        console.error('❌ Cannot connect to server at', API_URL);
        console.error('   Start the API server first: npm run start:api');
        process.exit(1);
    }

    const results: BenchmarkResult[] = [];
    const dimensions = [384, 768, 1024];
    const insertIterations = 100;
    const searchIterations = 200;

    // Run insert benchmarks
    console.log('📝 Insert Benchmarks');
    console.log('--------------------');
    for (const dim of dimensions) {
        const result = await benchmarkInsert(dim, insertIterations);
        results.push(result);
    }

    // Run search benchmarks
    console.log('\n🔍 Search Benchmarks');
    console.log('--------------------');
    for (const dim of dimensions) {
        const result = await benchmarkSearch(dim, searchIterations);
        results.push(result);
    }

    // Print results
    console.log('\n📊 Results Summary');
    console.log('==================\n');
    console.log(formatResults(results));

    // Get server metrics
    console.log('\n📈 Server Metrics');
    console.log('=================');
    try {
        const metricsRes = await fetch(`${API_URL}/metrics`);
        const metrics = await metricsRes.json();

        console.log(`Server Uptime: ${metrics.server.uptime}`);
        console.log(`Total Requests: ${metrics.server.requestCount}`);
        console.log(`Total Searches: ${metrics.server.searchCount}`);
        console.log(`Total Inserts: ${metrics.server.insertCount}`);
        console.log(`Avg Search Time: ${metrics.performance.avgSearchTime}`);
        console.log(`Avg Insert Time: ${metrics.performance.avgInsertTime}`);

        if (metrics.persistence) {
            console.log(`Persisted Vectors: ${metrics.persistence.totalVectors}`);
            console.log(`DB Size: ${(metrics.persistence.dbSizeBytes / 1024).toFixed(1)} KB`);
        }
    } catch {
        console.log('(Metrics unavailable)');
    }

    // Summary
    const avgSearchLatency = results
        .filter(r => r.operation === 'search')
        .reduce((sum, r) => sum + r.avgTime, 0) / dimensions.length;

    console.log('\n✨ Benchmark Complete!');
    console.log(`Average search latency: ${avgSearchLatency.toFixed(2)}ms`);

    if (avgSearchLatency < 5) {
        console.log('🚀 Performance is excellent!');
    } else if (avgSearchLatency < 10) {
        console.log('👍 Performance is good');
    } else {
        console.log('⚠️  Performance may need optimization');
    }
}

main().catch(console.error);
