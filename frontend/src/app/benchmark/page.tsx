'use client';

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { benchmarkService, BenchmarkResult } from '@/lib/benchmark-service';
import { vectorTemplates } from '@/types/vector';
import LoadingSpinner from '@/components/LoadingSpinner';
import { Data } from 'plotly.js';

// Dynamically import Plotly to avoid SSR issues
const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });

export default function BenchmarkPage() {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<BenchmarkResult[]>([]);
  const [selectedMetric, setSelectedMetric] = useState<string>('averageQueryTime');
  const [error, setError] = useState<string | null>(null);

  const runBenchmark = useCallback(async () => {
    try {
      setIsRunning(true);
      setError(null);

      // Get dimensions from vector templates
      const dimensions = Object.values(vectorTemplates).map(t => t.dimension);
      const uniqueDimensions = Array.from(new Set(dimensions)).sort((a, b) => a - b);

      const results = await benchmarkService.runBenchmark({
        dimensions: uniqueDimensions,
        vectorCounts: [1000, 10000, 100000],
        iterations: 100,
        warmupIterations: 10
      });

      setResults(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during benchmarking');
    } finally {
      setIsRunning(false);
    }
  }, []);

  const getPlotData = useCallback((): Data[] => {
    if (!results.length) return [];

    const dimensions = Array.from(new Set(results.map(r => r.dimension))).sort((a, b) => a - b);
    const vectorCounts = Array.from(new Set(results.map(r => r.vectorCount))).sort((a, b) => a - b);

    return vectorCounts.map(count => ({
      x: dimensions,
      y: dimensions.map(dim => {
        const result = results.find(r => r.dimension === dim && r.vectorCount === count);
        if (!result) return null;
        
        switch (selectedMetric) {
          case 'averageQueryTime':
            return result.metrics.averageQueryTime;
          case 'indexBuildTime':
            return result.metrics.indexBuildTime;
          case 'memoryUsage':
            return result.metrics.memoryUsage.heapUsed / 1024 / 1024; // Convert to MB
          case 'accuracy':
            return result.metrics.accuracy * 100;
          default:
            return 0;
        }
      }),
      name: `${count.toLocaleString()} vectors`,
      type: 'scatter' as const,
      mode: 'lines+markers' as const
    }));
  }, [results, selectedMetric]);

  const getYAxisTitle = useCallback(() => {
    switch (selectedMetric) {
      case 'averageQueryTime':
        return 'Average Query Time (ms)';
      case 'indexBuildTime':
        return 'Index Build Time (ms)';
      case 'memoryUsage':
        return 'Memory Usage (MB)';
      case 'accuracy':
        return 'Accuracy (%)';
      default:
        return '';
    }
  }, [selectedMetric]);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Vector Search Benchmarks</h1>

      <div className="mb-8 space-y-4">
        <div className="flex items-center space-x-4">
          <button
            onClick={runBenchmark}
            disabled={isRunning}
            className={`px-4 py-2 rounded ${
              isRunning
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            } text-white transition-colors`}
          >
            {isRunning ? (
              <div className="flex items-center space-x-2">
                <LoadingSpinner size="small" />
                <span>Running Benchmark...</span>
              </div>
            ) : (
              'Run Benchmark'
            )}
          </button>

          <select
            value={selectedMetric}
            onChange={(e) => setSelectedMetric(e.target.value)}
            className="px-4 py-2 rounded border border-gray-300 bg-white"
          >
            <option value="averageQueryTime">Query Time</option>
            <option value="indexBuildTime">Build Time</option>
            <option value="memoryUsage">Memory Usage</option>
            <option value="accuracy">Accuracy</option>
          </select>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded p-4 text-red-700">
            {error}
          </div>
        )}
      </div>

      {results.length > 0 && (
        <div className="space-y-8">
          {/* Performance Chart */}
          <div className="bg-white rounded-lg shadow-lg p-4">
            <h2 className="text-xl font-semibold mb-4">Performance Analysis</h2>
            <div className="h-[600px]">
              <Plot
                data={getPlotData()}
                layout={{
                  title: `${selectedMetric === 'averageQueryTime' ? 'Query Performance' : 
                          selectedMetric === 'indexBuildTime' ? 'Index Build Performance' :
                          selectedMetric === 'memoryUsage' ? 'Memory Usage' : 'Accuracy'} 
                          vs Vector Dimension`,
                  xaxis: {
                    title: 'Vector Dimension',
                    type: 'linear'
                  },
                  yaxis: {
                    title: getYAxisTitle(),
                    type: selectedMetric === 'memoryUsage' ? 'log' : 'linear'
                  },
                  hovermode: 'closest',
                  showlegend: true,
                  legend: {
                    x: 0,
                    y: 1,
                    bgcolor: 'rgba(255, 255, 255, 0.9)',
                    bordercolor: 'rgba(0, 0, 0, 0.1)',
                    borderwidth: 1
                  },
                  margin: { t: 50, r: 50, b: 50, l: 50 }
                }}
                useResizeHandler
                style={{ width: '100%', height: '100%' }}
                config={{ responsive: true }}
              />
            </div>
          </div>

          {/* Results Table */}
          <div className="bg-white rounded-lg shadow-lg p-4 overflow-x-auto">
            <h2 className="text-xl font-semibold mb-4">Detailed Results</h2>
            <table className="min-w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-2 text-left">Dimension</th>
                  <th className="px-4 py-2 text-left">Vector Count</th>
                  <th className="px-4 py-2 text-left">Query Time (ms)</th>
                  <th className="px-4 py-2 text-left">Build Time (ms)</th>
                  <th className="px-4 py-2 text-left">Memory (MB)</th>
                  <th className="px-4 py-2 text-left">Accuracy (%)</th>
                </tr>
              </thead>
              <tbody>
                {results.map((result, index) => (
                  <tr key={index} className="border-t">
                    <td className="px-4 py-2">{result.dimension}</td>
                    <td className="px-4 py-2">{result.vectorCount.toLocaleString()}</td>
                    <td className="px-4 py-2">{result.metrics.averageQueryTime.toFixed(2)}</td>
                    <td className="px-4 py-2">{result.metrics.indexBuildTime.toFixed(2)}</td>
                    <td className="px-4 py-2">
                      {(result.metrics.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}
                    </td>
                    <td className="px-4 py-2">{(result.metrics.accuracy * 100).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
