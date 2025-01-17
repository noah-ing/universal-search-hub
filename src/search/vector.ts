// src/search/vector.ts

import { Vector, SystemError, ErrorType } from '../types';

/**
 * WebAssembly SIMD module for vector operations
 */
let wasmModule: WebAssembly.Instance | null = null;

/**
 * Initialize WebAssembly SIMD module
 */
export async function initSIMD(): Promise<void> {
    try {
        const response = await fetch('vector_simd.wasm');
        const wasmBuffer = await response.arrayBuffer();
        const wasmResult = await WebAssembly.instantiate(wasmBuffer, {
            env: {
                memory: new WebAssembly.Memory({ initial: 256 })
            }
        });
        wasmModule = wasmResult.instance;
    } catch (error) {
        throw new SystemError(
            ErrorType.SYSTEM,
            'WASM_INIT_FAILED',
            'Failed to initialize WASM SIMD module',
            error
        );
    }
}

/**
 * Create a new vector with given dimension
 */
export function createVector(dimension: number): Vector {
    if (dimension <= 0) {
        throw new SystemError(
            ErrorType.SYSTEM,
            'INVALID_DIMENSION',
            'Vector dimension must be positive'
        );
    }
    return new Float32Array(dimension);
}

/**
 * Calculate Euclidean distance between two vectors using SIMD
 */
export function euclideanDistance(a: Vector, b: Vector): number {
    if (a.length !== b.length) {
        throw new SystemError(
            ErrorType.SYSTEM,
            'DIMENSION_MISMATCH',
            'Vectors must have same dimension'
        );
    }

    if (wasmModule) {
        // Use WASM SIMD implementation
        return (wasmModule.exports as any).euclideanDistance(a, b);
    }

    // Fallback to JS implementation with manual SIMD optimization
    const len = a.length;
    let sum = 0;
    
    // Process 4 elements at a time using SIMD
    const simdLength = len - (len % 4);
    for (let i = 0; i < simdLength; i += 4) {
        const d0 = a[i] - b[i];
        const d1 = a[i + 1] - b[i + 1];
        const d2 = a[i + 2] - b[i + 2];
        const d3 = a[i + 3] - b[i + 3];
        
        sum += d0 * d0 + d1 * d1 + d2 * d2 + d3 * d3;
    }

    // Handle remaining elements
    for (let i = simdLength; i < len; i++) {
        const d = a[i] - b[i];
        sum += d * d;
    }

    return Math.sqrt(sum);
}

/**
 * Calculate cosine similarity between two vectors using SIMD
 */
export function cosineSimilarity(a: Vector, b: Vector): number {
    if (a.length !== b.length) {
        throw new SystemError(
            ErrorType.SYSTEM,
            'DIMENSION_MISMATCH',
            'Vectors must have same dimension'
        );
    }

    if (wasmModule) {
        // Use WASM SIMD implementation
        return (wasmModule.exports as any).cosineSimilarity(a, b);
    }

    // Fallback to JS implementation with manual SIMD optimization
    const len = a.length;
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    // Process 4 elements at a time using SIMD
    const simdLength = len - (len % 4);
    for (let i = 0; i < simdLength; i += 4) {
        const dp0 = a[i] * b[i];
        const dp1 = a[i + 1] * b[i + 1];
        const dp2 = a[i + 2] * b[i + 2];
        const dp3 = a[i + 3] * b[i + 3];
        
        dotProduct += dp0 + dp1 + dp2 + dp3;
        
        const na0 = a[i] * a[i];
        const na1 = a[i + 1] * a[i + 1];
        const na2 = a[i + 2] * a[i + 2];
        const na3 = a[i + 3] * a[i + 3];
        
        normA += na0 + na1 + na2 + na3;
        
        const nb0 = b[i] * b[i];
        const nb1 = b[i + 1] * b[i + 1];
        const nb2 = b[i + 2] * b[i + 2];
        const nb3 = b[i + 3] * b[i + 3];
        
        normB += nb0 + nb1 + nb2 + nb3;
    }

    // Handle remaining elements
    for (let i = simdLength; i < len; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }

    const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    return Math.min(Math.max(similarity, -1), 1); // Clamp to [-1, 1]
}

/**
 * Normalize vector in-place using SIMD
 */
export function normalize(v: Vector): void {
    if (wasmModule) {
        // Use WASM SIMD implementation
        (wasmModule.exports as any).normalize(v);
        return;
    }

    // Fallback to JS implementation with manual SIMD optimization
    const len = v.length;
    let sum = 0;

    // Process 4 elements at a time using SIMD
    const simdLength = len - (len % 4);
    for (let i = 0; i < simdLength; i += 4) {
        const v0 = v[i];
        const v1 = v[i + 1];
        const v2 = v[i + 2];
        const v3 = v[i + 3];
        
        sum += v0 * v0 + v1 * v1 + v2 * v2 + v3 * v3;
    }

    // Handle remaining elements
    for (let i = simdLength; i < len; i++) {
        sum += v[i] * v[i];
    }

    const norm = Math.sqrt(sum);
    if (norm === 0) {
        throw new SystemError(
            ErrorType.SYSTEM,
            'ZERO_VECTOR',
            'Cannot normalize zero vector'
        );
    }

    // Normalize using SIMD
    for (let i = 0; i < simdLength; i += 4) {
        v[i] /= norm;
        v[i + 1] /= norm;
        v[i + 2] /= norm;
        v[i + 3] /= norm;
    }

    // Handle remaining elements
    for (let i = simdLength; i < len; i++) {
        v[i] /= norm;
    }
}

/**
 * Calculate mean vector of a set of vectors using SIMD
 */
export function meanVector(vectors: Vector[]): Vector {
    if (vectors.length === 0) {
        throw new SystemError(
            ErrorType.SYSTEM,
            'EMPTY_VECTOR_SET',
            'Cannot calculate mean of empty vector set'
        );
    }

    const dimension = vectors[0].length;
    const mean = createVector(dimension);

    if (wasmModule) {
        // Use WASM SIMD implementation
        return (wasmModule.exports as any).meanVector(vectors);
    }

    // Fallback to JS implementation with manual SIMD optimization
    const count = vectors.length;
    
    // Process 4 elements at a time using SIMD
    const simdLength = dimension - (dimension % 4);
    for (let i = 0; i < simdLength; i += 4) {
        let sum0 = 0, sum1 = 0, sum2 = 0, sum3 = 0;
        
        for (const vector of vectors) {
            sum0 += vector[i];
            sum1 += vector[i + 1];
            sum2 += vector[i + 2];
            sum3 += vector[i + 3];
        }
        
        mean[i] = sum0 / count;
        mean[i + 1] = sum1 / count;
        mean[i + 2] = sum2 / count;
        mean[i + 3] = sum3 / count;
    }

    // Handle remaining elements
    for (let i = simdLength; i < dimension; i++) {
        let sum = 0;
        for (const vector of vectors) {
            sum += vector[i];
        }
        mean[i] = sum / count;
    }

    return mean;
}

/**
 * Performance monitoring for vector operations
 */
export const vectorMetrics = {
    operationCount: 0,
    totalTime: 0,
    maxTime: 0,
    minTime: Infinity,
    
    reset(): void {
        this.operationCount = 0;
        this.totalTime = 0;
        this.maxTime = 0;
        this.minTime = Infinity;
    },
    
    recordOperation(time: number): void {
        this.operationCount++;
        this.totalTime += time;
        this.maxTime = Math.max(this.maxTime, time);
        this.minTime = Math.min(this.minTime, time);
    },
    
    getMetrics(): { avg: number; max: number; min: number; count: number } {
        return {
            avg: this.operationCount ? this.totalTime / this.operationCount : 0,
            max: this.maxTime,
            min: this.minTime === Infinity ? 0 : this.minTime,
            count: this.operationCount
        };
    }
};