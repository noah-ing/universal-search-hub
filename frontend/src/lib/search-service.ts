import { HNSWGraph } from '../../../src/search/hnsw';
import type { 
  Vector,
  TypedVector,
  HNSWConfig
} from '../types/app';
import { 
  EnhancedVector,
  VectorCollection,
  SearchOptions,
  EnhancedSearchResult,
  sampleCollections
} from '../types/vector';
import { toTypedVector } from '../types/app';
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

// Store vectors with their metadata
const vectorStore = new Map<number, EnhancedVector>();

// Initialize collections
const collections = new Map<string, VectorCollection>();

function calculateVectorStats(vector: Vector) {
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    const nonZeroElements = vector.filter(val => Math.abs(val) > 1e-6).length;
    const sparsity = 1 - (nonZeroElements / vector.length);
    
    return {
        magnitude,
        sparsity,
        min: Math.min(...vector),
        max: Math.max(...vector)
    };
}

function initializeCollections() {
    // Initialize collections with sample data
    Object.entries(sampleCollections).forEach(([name, vectors]) => {
        const collection: VectorCollection = {
            id: name,
            name: name.charAt(0).toUpperCase() + name.slice(1),
            description: `Collection of ${name}`,
            vectors: [],
            dimension: VECTOR_DIMENSION,
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
            stats: {
                totalVectors: 0,
                averageMagnitude: 0,
                averageSparsity: 0
            }
        };

        vectors.forEach(partialVector => {
            // Generate a sample vector if not provided
            const vector = Array.from({ length: VECTOR_DIMENSION }, 
                () => (Math.random() * 2 - 1) * 0.1
            );

            const stats = calculateVectorStats(vector);
            const enhancedVector: EnhancedVector = {
                vector,
                metadata: {
                    ...partialVector.metadata!,
                    stats
                }
            };

            try {
                const typedVector = toTypedVector(vector);
                const id = graph.insert(typedVector);
                vectorStore.set(id, enhancedVector);
                collection.vectors.push(enhancedVector);
                
                // Update collection stats
                collection.stats.totalVectors++;
                collection.stats.averageMagnitude = 
                    (collection.stats.averageMagnitude * (collection.stats.totalVectors - 1) + stats.magnitude) 
                    / collection.stats.totalVectors;
                collection.stats.averageSparsity = 
                    (collection.stats.averageSparsity * (collection.stats.totalVectors - 1) + stats.sparsity) 
                    / collection.stats.totalVectors;
            } catch (error) {
                logger.error('Failed to insert vector into collection', {
                    collection: name,
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        });

        collections.set(name, collection);
        logger.info('Initialized collection', { 
            name,
            vectorCount: String(collection.vectors.length)
        });
    });
}

// Initialize collections with sample data
initializeCollections();

export async function performVectorSearch(
    inputVector: Vector, 
    options: Partial<SearchOptions> = {}
): Promise<EnhancedSearchResult[]> {
    const {
        maxResults = 10,
        filters
    } = options;

    const logContext = {
        inputVectorLength: String(inputVector.length),
        maxResults: String(maxResults),
        filters: filters ? JSON.stringify(filters) : 'none',
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
            const startTime = performance.now();
            const results = graph.search(queryVector, maxResults);
            const searchTime = performance.now() - startTime;
            
            logger.debug('Raw search results', {
                numResults: String(results.length),
                searchTime: String(searchTime.toFixed(2)),
            });

            // Map results to include metadata
            const enhancedResults = results.map(result => {
                const enhancedVector = vectorStore.get(result.id);
                if (!enhancedVector) {
                    logger.warn('Vector not found in store', { id: String(result.id) });
                    return null;
                }

                // Apply filters if specified
                if (filters) {
                    const { sources, models, labels, dateRange } = filters;
                    const metadata = enhancedVector.metadata;

                    if (sources && !sources.includes(metadata.source)) return null;
                    if (models && !models.includes(metadata.model)) return null;
                    if (labels && !labels.some(label => metadata.labels.includes(label))) return null;
                    if (dateRange) {
                        const timestamp = new Date(metadata.timestamp);
                        const start = new Date(dateRange.start);
                        const end = new Date(dateRange.end);
                        if (timestamp < start || timestamp > end) return null;
                    }
                }

                const searchResult: EnhancedSearchResult = {
                    vector: enhancedVector.vector,
                    metadata: enhancedVector.metadata,
                    similarity: 1 / (1 + result.distance),
                    algorithmSpecific: {
                        distanceMetric: 'euclidean',
                        searchTime
                    }
                };

                return searchResult;
            }).filter((result): result is EnhancedSearchResult => result !== null);

            logger.info('Search completed successfully', {
                numResults: String(enhancedResults.length),
                searchTime: String(searchTime.toFixed(2)),
            });

            return enhancedResults;
        } catch (error) {
            logger.error('Vector search failed', { 
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    });
}

// Export collections for the input component
export function getCollections(): VectorCollection[] {
    return Array.from(collections.values());
}

// Export vector templates with real-world examples
export const vectorTemplates = {
    text: {
        title: "Text Embedding",
        description: "BERT embeddings for semantic text search",
        dimension: VECTOR_DIMENSION,
        vector: collections.get('textEmbeddings')?.vectors[0]?.vector || 
                Array.from({ length: VECTOR_DIMENSION }, () => (Math.random() * 2 - 1) * 0.1)
    },
    image: {
        title: "Image Feature Vector",
        description: "CLIP embeddings for image similarity",
        dimension: VECTOR_DIMENSION,
        vector: collections.get('imageFeatures')?.vectors[0]?.vector ||
                Array.from({ length: VECTOR_DIMENSION }, () => (Math.random() * 2 - 1) * 0.1)
    },
    audio: {
        title: "Audio Embedding",
        description: "Wav2Vec embeddings for audio similarity",
        dimension: VECTOR_DIMENSION,
        vector: collections.get('audioEmbeddings')?.vectors[0]?.vector ||
                Array.from({ length: VECTOR_DIMENSION }, () => (Math.random() * 2 - 1) * 0.1)
    }
};

// Set performance thresholds
performanceMonitor.setThreshold('vectorSearch', 50);
performanceMonitor.setThreshold('calculateVectorStats', 10);
