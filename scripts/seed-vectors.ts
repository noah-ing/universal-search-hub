/**
 * Seed script to populate the vector database with sample embeddings
 *
 * These are deterministic pseudo-embeddings that simulate real text/image embeddings.
 * Similar content produces similar vectors (cosine similarity based on semantic meaning).
 */

const API_URL = process.env['API_URL'] || 'http://localhost:3001';

// Sample documents with semantic categories
const sampleDocuments = [
    // Technology category
    { category: 'technology', id: 'tech-1', content: 'Machine learning algorithms process data to find patterns', labels: ['ml', 'ai', 'data'] },
    { category: 'technology', id: 'tech-2', content: 'Neural networks are inspired by biological brain structures', labels: ['ml', 'ai', 'neural'] },
    { category: 'technology', id: 'tech-3', content: 'Deep learning uses multiple layers of neural networks', labels: ['ml', 'ai', 'deep-learning'] },
    { category: 'technology', id: 'tech-4', content: 'Natural language processing enables computers to understand text', labels: ['nlp', 'ai', 'text'] },
    { category: 'technology', id: 'tech-5', content: 'Computer vision algorithms detect objects in images', labels: ['cv', 'ai', 'vision'] },
    { category: 'technology', id: 'tech-6', content: 'Transformers revolutionized NLP with attention mechanisms', labels: ['nlp', 'transformers', 'ai'] },
    { category: 'technology', id: 'tech-7', content: 'Vector databases enable efficient similarity search', labels: ['database', 'vectors', 'search'] },
    { category: 'technology', id: 'tech-8', content: 'Embeddings represent semantic meaning in numerical form', labels: ['embeddings', 'ml', 'semantics'] },

    // Science category
    { category: 'science', id: 'sci-1', content: 'Quantum mechanics describes behavior at atomic scales', labels: ['physics', 'quantum'] },
    { category: 'science', id: 'sci-2', content: 'DNA stores genetic information in living organisms', labels: ['biology', 'genetics'] },
    { category: 'science', id: 'sci-3', content: 'Black holes have gravity so strong light cannot escape', labels: ['physics', 'astronomy'] },
    { category: 'science', id: 'sci-4', content: 'Chemical reactions transform molecules through bond changes', labels: ['chemistry', 'reactions'] },
    { category: 'science', id: 'sci-5', content: 'Evolution drives species adaptation through natural selection', labels: ['biology', 'evolution'] },
    { category: 'science', id: 'sci-6', content: 'Climate change affects global weather patterns', labels: ['climate', 'environment'] },

    // Business category
    { category: 'business', id: 'biz-1', content: 'Startups innovate by disrupting traditional markets', labels: ['startup', 'innovation'] },
    { category: 'business', id: 'biz-2', content: 'Financial markets respond to economic indicators', labels: ['finance', 'markets'] },
    { category: 'business', id: 'biz-3', content: 'Marketing strategies target customer segments', labels: ['marketing', 'customers'] },
    { category: 'business', id: 'biz-4', content: 'Supply chain optimization reduces costs and delays', labels: ['operations', 'logistics'] },
    { category: 'business', id: 'biz-5', content: 'Customer analytics improve personalization', labels: ['analytics', 'customers'] },

    // Arts category
    { category: 'arts', id: 'art-1', content: 'Impressionist painters captured light and movement', labels: ['painting', 'impressionism'] },
    { category: 'arts', id: 'art-2', content: 'Classical music features complex orchestral compositions', labels: ['music', 'classical'] },
    { category: 'arts', id: 'art-3', content: 'Modern architecture emphasizes function and minimalism', labels: ['architecture', 'modern'] },
    { category: 'arts', id: 'art-4', content: 'Photography captures moments through lens and light', labels: ['photography', 'visual'] },
    { category: 'arts', id: 'art-5', content: 'Digital art uses software tools for creative expression', labels: ['digital', 'creative'] },

    // Health category
    { category: 'health', id: 'health-1', content: 'Exercise improves cardiovascular health and fitness', labels: ['fitness', 'cardio'] },
    { category: 'health', id: 'health-2', content: 'Nutrition affects energy levels and overall wellness', labels: ['nutrition', 'diet'] },
    { category: 'health', id: 'health-3', content: 'Mental health includes emotional and psychological wellbeing', labels: ['mental', 'wellness'] },
    { category: 'health', id: 'health-4', content: 'Sleep is essential for cognitive function and recovery', labels: ['sleep', 'recovery'] },
    { category: 'health', id: 'health-5', content: 'Vaccines prevent disease by building immunity', labels: ['vaccines', 'immunity'] },
];

// Category vectors - base semantic directions
const categorySeeds: Record<string, number[]> = {
    technology: [0.9, 0.8, 0.7, 0.2, 0.1, -0.3, -0.5, -0.2],
    science: [0.7, 0.6, 0.3, 0.8, 0.9, -0.2, -0.4, 0.1],
    business: [0.3, 0.2, 0.1, -0.5, -0.6, 0.8, 0.9, 0.7],
    arts: [-0.4, -0.3, 0.5, 0.6, 0.1, 0.4, 0.3, 0.8],
    health: [0.2, 0.4, -0.2, 0.3, 0.5, -0.1, 0.6, -0.4],
};

/**
 * Generate deterministic pseudo-embedding for a document
 * Similar documents will have similar embeddings
 */
function generateEmbedding(doc: typeof sampleDocuments[0], dimension: number): number[] {
    const baseVector = categorySeeds[doc.category] || [0, 0, 0, 0, 0, 0, 0, 0];
    const embedding: number[] = [];

    // Create a deterministic seed from the document ID
    const seedValue = doc.id.split('').reduce((acc, char, idx) => acc + char.charCodeAt(0) * (idx + 1), 0);

    // Seeded random number generator
    const seededRandom = (seed: number, i: number): number => {
        const x = Math.sin(seed * i + i * 0.618033988749895) * 10000;
        return (x - Math.floor(x)) * 2 - 1;
    };

    for (let i = 0; i < dimension; i++) {
        // Combine category direction with document-specific variation
        const baseComponent = baseVector[i % baseVector.length];
        const docVariation = seededRandom(seedValue, i) * 0.3;
        const contentHash = doc.content.charCodeAt(i % doc.content.length) / 255 - 0.5;

        const value = baseComponent * 0.6 + docVariation * 0.3 + contentHash * 0.1;

        // Normalize to reasonable range
        embedding.push(Math.max(-1, Math.min(1, value)));
    }

    // Normalize the vector
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => val / magnitude);
}

/**
 * Seed vectors for a specific dimension
 */
async function seedVectorsForDimension(dimension: number): Promise<{ success: number; failed: number }> {
    console.log(`\n📊 Seeding ${dimension}-dimensional vectors...`);

    const vectors = sampleDocuments.map((doc, index) => ({
        vector: generateEmbedding(doc, dimension),
        id: index + dimension * 1000, // Unique ID per dimension
        metadata: {
            source: 'text' as const,
            model: dimension <= 768 ? 'bert' : dimension === 1024 ? 'bert-large' : 'text-embedding-ada-002',
            id: doc.id,
            category: doc.category,
            content: doc.content,
            labels: doc.labels,
            dimension,
            timestamp: new Date().toISOString(),
        }
    }));

    try {
        const response = await fetch(`${API_URL}/api/vectors/bulk`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ vectors }),
        });

        if (!response.ok) {
            const error = await response.text();
            console.error(`  ❌ Failed: ${error}`);
            return { success: 0, failed: vectors.length };
        }

        const result = await response.json();
        console.log(`  ✅ Inserted: ${result.stats.successCount}/${result.stats.totalCount} vectors`);
        console.log(`  ⏱️  Time: ${result.stats.totalTime}`);

        return { success: result.stats.successCount, failed: result.stats.failCount };
    } catch (error) {
        console.error(`  ❌ Error: ${error}`);
        return { success: 0, failed: vectors.length };
    }
}

/**
 * Test search functionality
 */
async function testSearch(dimension: number): Promise<void> {
    console.log(`\n🔍 Testing search for ${dimension}D...`);

    // Create a query similar to technology category
    const queryDoc = {
        category: 'technology',
        id: 'query',
        content: 'AI and machine learning applications',
        labels: ['ai', 'ml']
    };
    const queryVector = generateEmbedding(queryDoc, dimension);

    try {
        const response = await fetch(`${API_URL}/api/search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ vector: queryVector, k: 5 }),
        });

        if (!response.ok) {
            console.error(`  ❌ Search failed`);
            return;
        }

        const result = await response.json();
        console.log(`  Found ${result.results.length} results in ${result.stats?.searchTime || 'N/A'}`);

        result.results.slice(0, 3).forEach((r: { id: number; similarity: number; metadata?: { content?: string } }, i: number) => {
            const content = r.metadata?.content || `Vector ${r.id}`;
            console.log(`  ${i + 1}. [${(r.similarity * 100).toFixed(1)}%] ${content.substring(0, 50)}...`);
        });
    } catch (error) {
        console.error(`  ❌ Error: ${error}`);
    }
}

/**
 * Main seed function
 */
async function main(): Promise<void> {
    console.log('🌱 Universal Search Hub - Vector Seeder');
    console.log('=====================================\n');

    // Check if server is running
    try {
        const health = await fetch(`${API_URL}/health`);
        if (!health.ok) {
            console.error('❌ Server is not healthy. Start the API server first:');
            console.error('   npm run start:api');
            process.exit(1);
        }
        console.log('✅ Server is running');
    } catch {
        console.error('❌ Cannot connect to server at', API_URL);
        console.error('   Start the API server first: npm run start:api');
        process.exit(1);
    }

    // Seed vectors for each dimension
    const dimensions = [384, 768, 1024, 1536];
    let totalSuccess = 0;
    let totalFailed = 0;

    for (const dimension of dimensions) {
        const { success, failed } = await seedVectorsForDimension(dimension);
        totalSuccess += success;
        totalFailed += failed;
    }

    console.log('\n=====================================');
    console.log(`📈 Summary: ${totalSuccess} vectors inserted, ${totalFailed} failed`);

    // Test search
    console.log('\n🧪 Running search tests...');
    for (const dimension of dimensions.slice(0, 2)) {
        await testSearch(dimension);
    }

    // Get final metrics
    try {
        const metricsRes = await fetch(`${API_URL}/metrics`);
        const metrics = await metricsRes.json();
        console.log('\n📊 Final Metrics:');
        console.log(`   Total vectors in DB: ${metrics.persistence?.totalVectors || 'N/A'}`);
        console.log(`   DB size: ${((metrics.persistence?.dbSizeBytes || 0) / 1024).toFixed(1)} KB`);
    } catch {
        // Ignore metrics error
    }

    console.log('\n✨ Seeding complete!');
}

main().catch(console.error);
