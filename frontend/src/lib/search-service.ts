import { HNSWGraph } from '../../../src/search/hnsw';
import type { Vector, HNSWConfig } from '../../../src/types';

const VECTOR_DIMENSION = parseInt(process.env.VECTOR_DIMENSION || '384');
const MAX_ELEMENTS = 10000; // Default max elements

// Initialize HNSW graph with configuration from environment variables
const config: HNSWConfig = {
    dimension: VECTOR_DIMENSION,
    maxElements: MAX_ELEMENTS,
    M: parseInt(process.env.HNSW_M || '16'),
    efConstruction: parseInt(process.env.HNSW_EF_CONSTRUCTION || '200'),
    efSearch: parseInt(process.env.HNSW_EF_SEARCH || '50'),
    ml: 1 / Math.log(2), // Default value from paper
};

const graph = new HNSWGraph(config);

export interface SearchResult {
    vector: number[];
    similarity: number;
}

export async function performVectorSearch(inputVector: number[], k: number = 10): Promise<SearchResult[]> {
    try {
        // Convert input array to Float32Array
        const queryVector: Vector = new Float32Array(inputVector);
        
        // Perform search using HNSW
        const results = graph.search(queryVector, k);
        
        // Convert distances to similarities (1 / (1 + distance))
        return results.map(result => ({
            vector: Array.from(queryVector), // Return the query vector since we can't access node vectors directly
            similarity: 1 / (1 + result.distance)
        }));
    } catch (error) {
        console.error('Vector search error:', error);
        throw error;
    }
}
