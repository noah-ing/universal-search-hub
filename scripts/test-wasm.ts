import { initSIMD, createVector, euclideanDistance, cosineSimilarity, normalize } from '../src/search/vector';

/**
 * Test WASM functionality
 */
async function testWasm() {
    try {
        console.log('Testing WASM SIMD implementation...\n');

        // Initialize WASM
        console.log('1. Initializing WASM SIMD...');
        await initSIMD();
        console.log('✓ WASM initialization successful\n');

        // Test vector creation
        console.log('2. Testing vector creation...');
        const dimension = 128;
        const v1 = createVector(dimension);
        const v2 = createVector(dimension);

        // Fill vectors with test data
        for (let i = 0; i < dimension; i++) {
            v1[i] = Math.random();
            v2[i] = Math.random();
        }
        console.log('✓ Vector creation successful\n');

        // Test normalization
        console.log('3. Testing vector normalization...');
        normalize(v1);
        normalize(v2);
        
        // Verify normalization
        const magnitude1 = Math.sqrt(v1.reduce((sum, val) => sum + val * val, 0));
        const magnitude2 = Math.sqrt(v2.reduce((sum, val) => sum + val * val, 0));
        
        if (Math.abs(magnitude1 - 1) > 1e-6 || Math.abs(magnitude2 - 1) > 1e-6) {
            throw new Error('Normalization test failed');
        }
        console.log('✓ Vector normalization successful\n');

        // Test Euclidean distance
        console.log('4. Testing Euclidean distance...');
        const distance = euclideanDistance(v1, v2);
        if (distance < 0 || distance > Math.sqrt(2)) {
            throw new Error('Euclidean distance test failed');
        }
        console.log('✓ Euclidean distance calculation successful\n');

        // Test cosine similarity
        console.log('5. Testing cosine similarity...');
        const similarity = cosineSimilarity(v1, v2);
        if (similarity < -1 || similarity > 1) {
            throw new Error('Cosine similarity test failed');
        }
        console.log('✓ Cosine similarity calculation successful\n');

        // Performance test
        console.log('6. Running performance test...');
        const numTests = 10000;
        const start = performance.now();
        
        for (let i = 0; i < numTests; i++) {
            euclideanDistance(v1, v2);
            cosineSimilarity(v1, v2);
        }
        
        const end = performance.now();
        const opsPerSecond = (numTests * 2) / ((end - start) / 1000);
        console.log(`✓ Performance test successful`);
        console.log(`  - ${numTests * 2} operations in ${(end - start).toFixed(2)}ms`);
        console.log(`  - ${opsPerSecond.toFixed(2)} operations per second\n`);

        console.log('All WASM tests passed successfully! 🎉');
        
    } catch (error) {
        console.error('\n❌ WASM test failed:', error);
        process.exit(1);
    }
}

// Run tests
console.log('Starting WASM tests...\n');
testWasm().catch(error => {
    console.error('Test script failed:', error);
    process.exit(1);
});
