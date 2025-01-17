// src/search/vector.ts

import { Vector, SystemError, ErrorType } from '../types';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * WebAssembly instance and memory management
 */
interface WasmExports extends WebAssembly.Exports {
    euclideanDistance: (offsetA: number, offsetB: number, length: number) => number;
    cosineSimilarity: (offsetA: number, offsetB: number, length: number) => number;
    normalize: (offset: number, length: number) => void;
}

let wasmInstance: WebAssembly.Instance | null = null;
let wasmMemory: WebAssembly.Memory | null = null;
let currentOffset = 0;
const VECTOR_ALIGNMENT = 16; // Required for SIMD operations
const INITIAL_MEMORY_PAGES = 1024; // 64MB (64KB per page)

/**
 * Initialize WebAssembly SIMD module
 */
export async function initSIMD(): Promise<void> {
    try {
        if (wasmInstance) return;

        // Create WebAssembly memory
        wasmMemory = new WebAssembly.Memory({
            initial: INITIAL_MEMORY_PAGES,
            maximum: INITIAL_MEMORY_PAGES * 2
        });

        // Reset offset
        currentOffset = 0;

        // Load WASM module
        const wasmPath = join(__dirname, '..', '..', 'dist', 'wasm', 'vector_simd.wasm');
        const wasmBuffer = readFileSync(wasmPath);
        const wasmModule = await WebAssembly.compile(wasmBuffer);

        // Instantiate WASM module
        wasmInstance = await WebAssembly.instantiate(wasmModule, {
            env: {
                memory: wasmMemory,
                memoryBase: 0,
                tableBase: 0,
                __memory_base: 0,
                __table_base: 0,
                _abort: () => { throw new Error('abort called'); }
            }
        });

        console.log('SIMD WASM module initialized successfully');
    } catch (error) {
        console.warn('SIMD initialization failed:', error);
        throw new SystemError(
            ErrorType.SYSTEM,
            'WASM_INIT_FAILED',
            'Failed to initialize WASM SIMD module'
        );
    }
}

/**
 * Reset WASM memory offset
 */
function resetMemoryOffset(): void {
    currentOffset = 0;
}

/**
 * Copy vector to WASM memory
 */
function copyToWasmMemory(vector: Vector): number {
    if (!wasmMemory) throw new Error('WASM memory not initialized');

    // Align offset for SIMD
    currentOffset = Math.ceil(currentOffset / VECTOR_ALIGNMENT) * VECTOR_ALIGNMENT;
    
    // Ensure we have enough memory
    const requiredBytes = (currentOffset + vector.length * 4);
    if (requiredBytes > wasmMemory.buffer.byteLength) {
        resetMemoryOffset();
        currentOffset = Math.ceil(currentOffset / VECTOR_ALIGNMENT) * VECTOR_ALIGNMENT;
        
        // Check again after reset
        if ((currentOffset + vector.length * 4) > wasmMemory.buffer.byteLength) {
            throw new Error('Vector too large for WASM memory');
        }
    }

    // Copy vector data
    const memoryView = new Float32Array(wasmMemory.buffer, currentOffset, vector.length);
    memoryView.set(vector);

    // Update offset for next allocation
    const usedOffset = currentOffset;
    currentOffset += vector.length * 4;

    return usedOffset;
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
    if (!a || !b || a.length !== b.length) {
        throw new SystemError(
            ErrorType.SYSTEM,
            'DIMENSION_MISMATCH',
            'Vectors must have same dimension and be non-null'
        );
    }

    try {
        if (wasmInstance) {
            const offsetA = copyToWasmMemory(a);
            const offsetB = copyToWasmMemory(b);
            const exports = wasmInstance.exports as WasmExports;
            const result = exports.euclideanDistance(offsetA, offsetB, a.length);
            resetMemoryOffset();
            return result;
        }

        // Fallback to JS implementation
        let sum = 0;
        for (let i = 0; i < a.length; i++) {
            const diff = a[i] - b[i];
            sum += diff * diff;
        }
        return Math.sqrt(sum);
    } catch (error) {
        throw new SystemError(
            ErrorType.SYSTEM,
            'DISTANCE_CALCULATION_FAILED',
            'Failed to calculate Euclidean distance',
            error
        );
    }
}

/**
 * Calculate cosine similarity between two vectors using SIMD
 */
export function cosineSimilarity(a: Vector, b: Vector): number {
    if (!a || !b || a.length !== b.length) {
        throw new SystemError(
            ErrorType.SYSTEM,
            'DIMENSION_MISMATCH',
            'Vectors must have same dimension and be non-null'
        );
    }

    try {
        if (wasmInstance) {
            const offsetA = copyToWasmMemory(a);
            const offsetB = copyToWasmMemory(b);
            const exports = wasmInstance.exports as WasmExports;
            const result = exports.cosineSimilarity(offsetA, offsetB, a.length);
            resetMemoryOffset();
            return result;
        }

        // Fallback to JS implementation
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }

        if (normA === 0 || normB === 0) {
            throw new SystemError(
                ErrorType.SYSTEM,
                'ZERO_VECTOR',
                'Cannot compute similarity with zero vector'
            );
        }

        const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
        return Math.min(Math.max(similarity, -1), 1);
    } catch (error) {
        throw new SystemError(
            ErrorType.SYSTEM,
            'SIMILARITY_CALCULATION_FAILED',
            'Failed to calculate cosine similarity',
            error
        );
    }
}

/**
 * Normalize vector in-place using SIMD
 */
export function normalize(v: Vector): void {
    if (!v || v.length === 0) {
        throw new SystemError(
            ErrorType.SYSTEM,
            'INVALID_VECTOR',
            'Vector must be non-null and non-empty'
        );
    }

    try {
        if (wasmInstance) {
            const offset = copyToWasmMemory(v);
            const exports = wasmInstance.exports as WasmExports;
            exports.normalize(offset, v.length);
            // Copy normalized vector back
            const memoryView = new Float32Array(wasmMemory!.buffer, offset, v.length);
            v.set(memoryView);
            resetMemoryOffset();
            return;
        }

        // Fallback to JS implementation
        let sum = 0;
        for (let i = 0; i < v.length; i++) {
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

        for (let i = 0; i < v.length; i++) {
            v[i] /= norm;
        }
    } catch (error) {
        throw new SystemError(
            ErrorType.SYSTEM,
            'NORMALIZATION_FAILED',
            'Failed to normalize vector',
            error
        );
    }
}

/**
 * Calculate mean vector of a set of vectors
 */
export function meanVector(vectors: Vector[]): Vector {
    if (!vectors || vectors.length === 0) {
        throw new SystemError(
            ErrorType.SYSTEM,
            'EMPTY_VECTOR_SET',
            'Cannot calculate mean of empty vector set'
        );
    }

    const firstVector = vectors[0];
    if (!firstVector) {
        throw new SystemError(
            ErrorType.SYSTEM,
            'INVALID_VECTOR',
            'First vector must be non-null'
        );
    }

    const dimension = firstVector.length;
    const mean = createVector(dimension);

    try {
        // Calculate sum of all vectors
        for (const vector of vectors) {
            if (!vector || vector.length !== dimension) {
                throw new SystemError(
                    ErrorType.SYSTEM,
                    'DIMENSION_MISMATCH',
                    'All vectors must be non-null and have same dimension'
                );
            }
            for (let i = 0; i < dimension; i++) {
                mean[i] += vector[i];
            }
        }

        // Calculate mean
        const count = vectors.length;
        for (let i = 0; i < dimension; i++) {
            mean[i] /= count;
        }

        return mean;
    } catch (error) {
        throw new SystemError(
            ErrorType.SYSTEM,
            'MEAN_CALCULATION_FAILED',
            'Failed to calculate mean vector',
            error
        );
    }
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
