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
  sampleCollections,
  vectorTemplates
} from '../types/vector';
import { toTypedVector } from '../types/app';
import { logger } from './logger';
import { performanceMonitor } from '../lib/performance';

const MAX_ELEMENTS = 10000;

// Map to store HNSW graphs for different dimensions
const dimensionGraphs = new Map<number, HNSWGraph>();
const dimensionVectorStores = new Map<number, Map<number, EnhancedVector>>();

// Get all supported dimensions
const SUPPORTED_DIMENSIONS = Array.from(new Set([
  ...Object.values(vectorTemplates).map(t => t.dimension),
  384 // Include the default dimension
])).sort((a, b) => a - b);

// Initialize HNSW graphs for each dimension
function initializeGraphs() {
    SUPPORTED_DIMENSIONS.forEach(dimension => {
        const config: HNSWConfig = {
            dimension,
            maxElements: MAX_ELEMENTS,
            M: parseInt(process.env.HNSW_M || '16'),
            efConstruction: parseInt(process.env.HNSW_EF_CONSTRUCTION || '200'),
            efSearch: parseInt(process.env.HNSW_EF_SEARCH || '50'),
            ml: 1 / Math.log(2),
        };

        logger.info('Initializing HNSW graph', { dimension, config: JSON.stringify(config) });

        try {
            const graph = new HNSWGraph(config);
            dimensionGraphs.set(dimension, graph);
            dimensionVectorStores.set(dimension, new Map());
            logger.info('HNSW graph initialized successfully', { dimension });
        } catch (error) {
            logger.error('Failed to initialize HNSW graph', { 
                dimension,
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    });
}

// Initialize graphs
initializeGraphs();

// Store vectors with their metadata
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

// Generate sample vectors for a specific dimension
function generateSampleVectors(dimension: number, count: number): Partial<EnhancedVector>[] {
    return Array.from({ length: count }, (_, i) => ({
        metadata: {
            id: `sample-${dimension}-${i + 1}`,
            source: 'custom',
            model: 'custom',
            timestamp: new Date().toISOString(),
            description: `Sample ${dimension}-dimensional vector ${i + 1}`,
            labels: ['sample', `dim-${dimension}`],
            originalContent: {
                type: 'vector',
                value: `Sample ${dimension}D vector`
            }
        }
    }));
}

function initializeCollections() {
    // Initialize collections with sample data for each dimension
    SUPPORTED_DIMENSIONS.forEach(dimension => {
        const collectionName = `vectors${dimension}d`;
        const sampleCount = 50; // Generate 50 sample vectors for each dimension
        
        const samples = generateSampleVectors(dimension, sampleCount);
        
        samples.forEach(partialVector => {
            const collection = collections.get(collectionName) || {
                id: collectionName,
                name: `${dimension}D Vectors`,
                description: `Collection of ${dimension}-dimensional vectors`,
                vectors: [],
                dimension,
                created: new Date().toISOString(),
                updated: new Date().toISOString(),
                stats: {
                    totalVectors: 0,
                    averageMagnitude: 0,
                    averageSparsity: 0
                }
            };

            // Generate a sample vector
            const vector = Array.from({ length: dimension }, 
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
                const graph = dimensionGraphs.get(dimension);
                const vectorStore = dimensionVectorStores.get(dimension);
                
                if (!graph || !vectorStore) {
                    throw new Error(`No graph or store found for dimension ${dimension}`);
                }

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
                    collection: collectionName,
                    error: error instanceof Error ? error.message : String(error)
                });
            }

            collections.set(collectionName, collection);
        });

        logger.info('Initialized collection', { 
            name: collectionName,
            dimension: String(dimension),
            vectorCount: String(collections.get(collectionName)?.vectors.length || 0)
        });
    });

    // Also initialize the original sample collections
    Object.entries(sampleCollections).forEach(([name, vectors]) => {
        vectors.forEach(partialVector => {
            const modelTemplate = Object.values(vectorTemplates).find(
                t => t.model === partialVector.metadata?.model
            );
            
            if (!modelTemplate) {
                logger.warn('No template found for model', { 
                    model: partialVector.metadata?.model 
                });
                return;
            }

            const dimension = modelTemplate.dimension;
            const collection = collections.get(name) || {
                id: name,
                name: name.charAt(0).toUpperCase() + name.slice(1),
                description: `Collection of ${name}`,
                vectors: [],
                dimension,
                created: new Date().toISOString(),
                updated: new Date().toISOString(),
                stats: {
                    totalVectors: 0,
                    averageMagnitude: 0,
                    averageSparsity: 0
                }
            };

            // Generate a sample vector
            const vector = Array.from({ length: dimension }, 
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
                const graph = dimensionGraphs.get(dimension);
                const vectorStore = dimensionVectorStores.get(dimension);
                
                if (!graph || !vectorStore) {
                    throw new Error(`No graph or store found for dimension ${dimension}`);
                }

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

            collections.set(name, collection);
        });

        logger.info('Initialized collection', { 
            name,
            vectorCount: String(collections.get(name)?.vectors.length || 0)
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

    const dimension = inputVector.length;
    const graph = dimensionGraphs.get(dimension);
    const vectorStore = dimensionVectorStores.get(dimension);

    if (!graph || !vectorStore) {
        throw new Error(`Unsupported vector dimension: ${dimension}. Supported dimensions are: ${SUPPORTED_DIMENSIONS.join(', ')}`);
    }

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

// Set performance thresholds
performanceMonitor.setThreshold('vectorSearch', 50);
performanceMonitor.setThreshold('calculateVectorStats', 10);
