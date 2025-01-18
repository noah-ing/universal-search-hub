'use client';

import { useMemo } from 'react';
import { SearchResult } from '../types/search';
import { withErrorBoundary } from './ErrorBoundary';
import { logger } from '../lib/logger';
import { performanceMonitor } from '../lib/performance';

interface SearchResultsProps {
  results: SearchResult[];
}

function SearchResults({ results }: SearchResultsProps) {
  const stats = useMemo(() => {
    if (!results.length) return null;

    return performanceMonitor.measure('calculate_stats', () => {
      try {
        const similarities = results.map(r => r.similarity);
        const magnitudes = results.map(r => 
          Math.sqrt(r.vector.reduce((sum: number, val: number) => sum + val * val, 0))
        );

        const stats = {
          similarities: {
            min: Math.min(...similarities),
            max: Math.max(...similarities),
            avg: similarities.reduce((sum, val) => sum + val, 0) / similarities.length,
          },
          magnitudes: {
            min: Math.min(...magnitudes),
            max: Math.max(...magnitudes),
            avg: magnitudes.reduce((sum, val) => sum + val, 0) / magnitudes.length,
          },
        };

        logger.debug('Calculated search result stats', {
          numResults: String(results.length),
          similarityRange: `${(stats.similarities.min * 100).toFixed(2)}% - ${(stats.similarities.max * 100).toFixed(2)}%`,
          magnitudeRange: `${stats.magnitudes.min.toFixed(3)} - ${stats.magnitudes.max.toFixed(3)}`,
        });

        return stats;
      } catch (error) {
        logger.error('Failed to calculate stats', {
          error: error instanceof Error ? error.message : String(error),
        });
        throw new Error('Failed to calculate result statistics');
      }
    });
  }, [results]);

  if (!results.length) {
    return (
      <div className="text-center text-gray-500 py-8">
        No results to display
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-[#252B38] rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-400 mb-3">
              Similarity Range
            </h4>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Min:</span>
                <span className="text-white">
                  {(stats.similarities.min * 100).toFixed(2)}%
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Max:</span>
                <span className="text-white">
                  {(stats.similarities.max * 100).toFixed(2)}%
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Avg:</span>
                <span className="text-white">
                  {(stats.similarities.avg * 100).toFixed(2)}%
                </span>
              </div>
            </div>
          </div>

          <div className="bg-[#252B38] rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-400 mb-3">
              Vector Magnitudes
            </h4>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Min:</span>
                <span className="text-white">
                  {stats.magnitudes.min.toFixed(3)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Max:</span>
                <span className="text-white">
                  {stats.magnitudes.max.toFixed(3)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Avg:</span>
                <span className="text-white">
                  {stats.magnitudes.avg.toFixed(3)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Results List */}
      <div className="space-y-4">
        {results.map((result, index) => {
          const magnitude = performanceMonitor.measure('calculate_magnitude', () =>
            Math.sqrt(
              result.vector.reduce((sum: number, val: number) => sum + val * val, 0)
            )
          );

          // Calculate vector preview - show first few and last few elements
          const previewLength = 5;
          const vectorPreview = performanceMonitor.measure('prepare_vector_preview', () => {
            const preview = [...result.vector];
            if (preview.length > previewLength * 2) {
              preview.splice(
                previewLength,
                preview.length - previewLength * 2,
                ...Array(3).fill('...')
              );
            }
            return preview;
          });

          return (
            <div
              key={index}
              className="bg-[#252B38] rounded-lg p-4 transition-colors hover:bg-[#2A3241]"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-3">
                  <span className="text-gray-400">#{index + 1}</span>
                  <div className="h-2 w-2 rounded-full bg-blue-500" />
                  <span className="text-white font-medium">
                    {(result.similarity * 100).toFixed(2)}% Similar
                  </span>
                </div>
                <span className="text-gray-400 text-sm">
                  Magnitude: {magnitude.toFixed(3)}
                </span>
              </div>

              <div className="mt-2 text-sm font-mono bg-[#1A1F2A] rounded p-2 overflow-x-auto">
                <div className="flex flex-wrap gap-1">
                  {vectorPreview.map((value: number | string, i: number) => (
                    <span
                      key={i}
                      className={`inline-block ${
                        typeof value === 'string'
                          ? 'text-gray-500'
                          : value > 0
                          ? 'text-blue-400'
                          : 'text-red-400'
                      }`}
                    >
                      {typeof value === 'number' ? value.toFixed(3) : value}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Custom fallback UI for search results errors
const SearchResultsErrorFallback = (
  <div className="min-h-[400px] bg-[#1A1F2A] rounded-lg p-6 flex items-center justify-center">
    <div className="text-center">
      <h3 className="text-xl font-semibold text-red-500 mb-3">
        Results Display Error
      </h3>
      <p className="text-gray-400 mb-4">
        An error occurred while displaying the search results.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
      >
        Retry
      </button>
    </div>
  </div>
);

// Set performance thresholds
performanceMonitor.setThreshold('calculate_stats', 50); // 50ms for stats calculation
performanceMonitor.setThreshold('calculate_magnitude', 10); // 10ms for magnitude calculation
performanceMonitor.setThreshold('prepare_vector_preview', 5); // 5ms for preview preparation

export default withErrorBoundary(SearchResults, SearchResultsErrorFallback);
