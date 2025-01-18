import { HNSWGraph } from '../../../src/search/hnsw';
import type { 
  Vector, 
  TypedVector,
  HNSWConfig, 
  SearchResult, 
  VectorTemplates,
  LogContext
} from '../types/app';
import { toTypedVector, fromTypedVector } from '../types/app';
import { logger } from './logger';
import { performanceMonitor } from './performance';

const VECTOR_DIMENSION = parseInt(process.env.VECTOR_DIMENSION || '384');
const MAX_ELEMENTS = 10000;

// Initialize HNSW graph with configuration
const config: HNSWConfig = {
    dimension: VECTOR_DIMENSION,
    maxElements: MAX_ELEMENTS,
    M: parseInt(process.env.HNSW_M || '16'),
    efConstruction: parseInt(process.env.HNSW_EF_CONSTRUCTION || '200'),
    efSearch: parseInt(process.env.HNSW_EF_SEARCH || '50'),
    ml: 1 / Math.log(2),
};

logger.info('Initializing HNSW graph', { config: JSON.stringify(config) });

let graph: HNSWGraph;
try {
    graph = new HNSWGraph(config);
    logger.info('HNSW graph initialized successfully');
} catch (error) {
    logger.error('Failed to initialize HNSW graph', { error: error instanceof Error ? error.message : String(error) });
    throw error;
}

// Store vectors with their IDs for retrieval
const vectorStore = new Map<number, Vector>();

// Generate and insert sample vectors with different patterns
const generateSampleVectors = (): Vector[] => {
    logger.info('Generating sample vectors');
    const samples = performanceMonitor.measure('generateSampleVectors', () => [
        // Text embedding-like vectors (dense with small values)
        Array.from({ length: VECTOR_DIMENSION }, () => (Math.random() * 2 - 1) * 0.1),
        Array.from({ length: VECTOR_DIMENSION }, () => (Math.random() * 2 - 1) * 0.1),
        // Image feature vectors (sparse with larger values)
        Array.from({ length: VECTOR_DIMENSION }, () => Math.random() > 0.8 ? Math.random() * 2 - 1 : 0),
        Array.from({ length: VECTOR_DIMENSION }, () => Math.random() > 0.8 ? Math.random() * 2 - 1 : 0),
        // User behavior vectors (binary patterns)
        Array.from({ length: VECTOR_DIMENSION }, () => Math.random() > 0.5 ? 1 : -1),
        Array.from({ length: VECTOR_DIMENSION }, () => Math.random() > 0.5 ? 1 : -1),
        // Random variations of each type
        Array.from({ length: VECTOR_DIMENSION }, () => (Math.random() * 2 - 1) * 0.15),
        Array.from({ length: VECTOR_DIMENSION }, () => Math.random() > 0.7 ? Math.random() * 2 - 1 : 0),
        Array.from({ length: VECTOR_DIMENSION }, () => Math.random() > 0.4 ? 1 : -1),
    ]);

    // Insert samples into the graph and store
    samples.forEach((vector, index) => {
        try {
            const typedVector = toTypedVector(vector);
            const id = performanceMonitor.measure('insertSampleVector', () => 
                graph.insert(typedVector)
            );
            vectorStore.set(id, vector);
            logger.debug('Inserted sample vector', { index: String(index), id: String(id) });
        } catch (error) {
            logger.error('Failed to insert sample vector', { 
                index: String(index), 
                error: error instanceof Error ? error.message : String(error)
            });
        }
    });

    logger.info('Sample vectors generation complete', { count: String(samples.length) });
    return samples;
};

const sampleVectors = generateSampleVectors();

export async function performVectorSearch(inputVector: Vector, k: number = 10): Promise<SearchResult[]> {
    const logContext: LogContext = {
        inputVectorLength: String(inputVector.length),
        k: String(k),
        graphStats: JSON.stringify(graph.getStats()),
        storeSize: String(vectorStore.size),
    };

    logger.info('Starting vector search', logContext);

    return performanceMonitor.measure('vectorSearch', () => {
        try {
            if (inputVector.length !== VECTOR_DIMENSION) {
                const error = new Error(`Input vector dimension (${inputVector.length}) does not match expected dimension (${VECTOR_DIMENSION})`);
                logger.error('Vector dimension mismatch', { 
                    expected: String(VECTOR_DIMENSION),
                    received: String(inputVector.length)
                });
                throw error;
            }

            // Convert input array to TypedVector
            const queryVector: TypedVector = toTypedVector(inputVector);
            
            // Perform search using HNSW
            const results = performanceMonitor.measure('hnswSearch', () => 
                graph.search(queryVector, k)
            );
            
            logger.debug('Raw search results', {
                numResults: String(results.length),
                distances: JSON.stringify(results.map(r => r.distance)),
            });

            // Map results to include actual vectors from our store
            const mappedResults = results.map(result => {
                const vector = vectorStore.get(result.id);
                if (!vector) {
                    logger.warn('Vector not found in store', { id: String(result.id) });
                }
                return {
                    vector: vector || fromTypedVector(queryVector),
                    similarity: 1 / (1 + result.distance)
                };
            });

            logger.info('Search completed successfully', {
                numResults: String(mappedResults.length),
                similarities: JSON.stringify(mappedResults.map(r => r.similarity)),
            });

            return mappedResults;
        } catch (error) {
            logger.error('Vector search failed', { 
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    });
}

// Export vector templates for the input component
export const vectorTemplates: VectorTemplates = {
    text: {
        title: "Text Embedding",
        description: "BERT/GPT embeddings for semantic text search",
        dimension: VECTOR_DIMENSION,
        vector: sampleVectors[0]
    },
    image: {
        title: "Image Feature Vector",
        description: "ResNet/EfficientNet embeddings for image similarity",
        dimension: VECTOR_DIMENSION,
        vector: sampleVectors[2]
    },
    user: {
        title: "User Behavior Vector",
        description: "Recommendation system embeddings",
        dimension: VECTOR_DIMENSION,
        vector: sampleVectors[4]
    }
};

// Initialize more random vectors for better search results
logger.info('Initializing additional random vectors');

function initializeAdditionalVectors(): void {
    performanceMonitor.measure('initializeAdditionalVectors', () => {
        // Add 50 more random vectors with various patterns
        for (let i = 0; i < 50; i++) {
            const pattern = Math.floor(Math.random() * 3);
            let vector: Vector;
            
            switch (pattern) {
                case 0: // Text-like
                    vector = Array.from({ length: VECTOR_DIMENSION }, 
                        () => (Math.random() * 2 - 1) * 0.1
                    );
                    break;
                case 1: // Image-like
                    vector = Array.from({ length: VECTOR_DIMENSION }, 
                        () => Math.random() > 0.8 ? Math.random() * 2 - 1 : 0
                    );
                    break;
                default: // User behavior-like
                    vector = Array.from({ length: VECTOR_DIMENSION }, 
                        () => Math.random() > 0.5 ? 1 : -1
                    );
            }
            
            try {
                const typedVector = toTypedVector(vector);
                const id = performanceMonitor.measure('insertAdditionalVector', () =>
                    graph.insert(typedVector)
                );
                vectorStore.set(id, vector);
                if (i % 10 === 0) {
                    logger.debug('Additional vectors progress', { count: String(i + 1) });
                }
            } catch (error) {
                logger.error('Failed to insert additional vector', { 
                    index: String(i),
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        }
        logger.info('Additional vectors initialization complete', {
            graphStats: JSON.stringify(graph.getStats())
        });
    });
}

// Execute initialization
initializeAdditionalVectors();

// Set performance thresholds
performanceMonitor.setThreshold('vectorSearch', 50); // 50ms threshold for search
performanceMonitor.setThreshold('hnswSearch', 30); // 30ms threshold for HNSW search
performanceMonitor.setThreshold('insertSampleVector', 10); // 10ms threshold for vector insertion
