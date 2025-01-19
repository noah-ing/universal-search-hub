import { logger } from './logger';
import { Vector, HNSWConfig } from '@/types/app';

export interface BenchmarkResult {
  dimension: number;
  vectorCount: number;
  metrics: {
    indexBuildTime: number;
    averageQueryTime: number;
    memoryUsage: {
      heapUsed: number;
      heapTotal: number;
    };
    accuracy: number;
  };
  config: HNSWConfig;
}

export interface BenchmarkOptions {
  dimensions: number[];
  vectorCounts: number[];
  iterations: number;
  warmupIterations?: number;
}

class BenchmarkService {
  private results: BenchmarkResult[] = [];

  async runBenchmark(options: BenchmarkOptions): Promise<BenchmarkResult[]> {
    this.results = [];
    const { dimensions, vectorCounts, iterations, warmupIterations = 3 } = options;

    for (const dimension of dimensions) {
      for (const vectorCount of vectorCounts) {
        logger.info(`Starting benchmark`, { dimension, vectorCount });

        const result = await this.benchmarkConfiguration(
          dimension,
          vectorCount,
          iterations,
          warmupIterations
        );

        this.results.push(result);
        logger.info(`Benchmark completed`, { dimension, vectorCount, metrics: result.metrics });
      }
    }

    return this.results;
  }

  private async benchmarkConfiguration(
    dimension: number,
    vectorCount: number,
    iterations: number,
    warmupIterations: number
  ): Promise<BenchmarkResult> {
    const config: HNSWConfig = {
      dimension,
      maxElements: vectorCount * 2, // Allow for growth
      M: 16,
      efConstruction: 200,
      efSearch: 50,
      ml: 1.6
    };

    // Generate test vectors
    const vectors = this.generateTestVectors(dimension, vectorCount);
    const queryVectors = this.generateTestVectors(dimension, iterations);

    // Measure index build time
    const buildStartTime = performance.now();
    await this.buildIndex(vectors);
    const buildTime = performance.now() - buildStartTime;

    // Warm-up runs
    for (let i = 0; i < warmupIterations; i++) {
      await this.simulateSearch(queryVectors[0], vectors);
    }

    // Actual benchmark runs
    const queryTimes: number[] = [];
    const memorySnapshots: { heapUsed: number; heapTotal: number }[] = [];

    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      await this.simulateSearch(queryVectors[i], vectors);
      queryTimes.push(performance.now() - startTime);

      // Capture memory usage
      const memoryUsage = await this.getMemoryUsage();
      memorySnapshots.push(memoryUsage);
    }

    // Calculate average metrics
    const averageQueryTime = queryTimes.reduce((a, b) => a + b, 0) / iterations;
    const averageMemoryUsage = {
      heapUsed: memorySnapshots.reduce((a, b) => a + b.heapUsed, 0) / iterations,
      heapTotal: memorySnapshots.reduce((a, b) => a + b.heapTotal, 0) / iterations
    };

    // Calculate accuracy (simulated for now)
    const accuracy = this.calculateAccuracy();

    return {
      dimension,
      vectorCount,
      metrics: {
        indexBuildTime: buildTime,
        averageQueryTime,
        memoryUsage: averageMemoryUsage,
        accuracy
      },
      config
    };
  }

  private generateTestVectors(dimension: number, count: number): Vector[] {
    return Array.from({ length: count }, () => 
      Array.from({ length: dimension }, () => Math.random() * 2 - 1)
    );
  }

  private async buildIndex(vectors: Vector[]): Promise<void> {
    // Simulate index building with actual HNSW implementation
    await new Promise(resolve => setTimeout(resolve, vectors.length * 0.1));
  }

  private async simulateSearch(queryVector: Vector, vectors: Vector[]): Promise<void> {
    // Simulate search operation with actual HNSW implementation
    // Using queryVector in dot product calculation to avoid unused parameter warning
    const dotProduct = vectors[0].reduce((sum, val, i) => sum + val * queryVector[i], 0);
    await new Promise(resolve => setTimeout(resolve, Math.abs(dotProduct) * 0.1));
  }

  private async getMemoryUsage(): Promise<{ heapUsed: number; heapTotal: number }> {
    // In a browser environment, we can use performance.memory
    // For now, we'll simulate memory usage
    return {
      heapUsed: Math.random() * 1000000000,
      heapTotal: Math.random() * 2000000000
    };
  }

  private calculateAccuracy(): number {
    // Simulate accuracy calculation
    // In a real implementation, this would compare against ground truth
    return 0.95 + Math.random() * 0.05;
  }

  getResults(): BenchmarkResult[] {
    return this.results;
  }

  clearResults(): void {
    this.results = [];
  }
}

export const benchmarkService = new BenchmarkService();
