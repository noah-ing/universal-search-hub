'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { EnhancedSearchResult } from '../types/vector';
import { withErrorBoundary } from './ErrorBoundary';
import { logger } from '../lib/logger';
import { performanceMonitor } from '../lib/performance';

interface SearchResultsProps {
  results: EnhancedSearchResult[];
  queryVectorId?: string;
}

function SearchResults({ results, queryVectorId }: SearchResultsProps) {
  const router = useRouter();

  const stats = useMemo(() => {
    if (!results.length) return null;

    return performanceMonitor.measure('calculate_stats', () => {
      try {
        const similarities = results.map(r => r.similarity);
        const magnitudes = results.map(r => r.metadata.stats?.magnitude || 0);

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
          searchTime: results[0].algorithmSpecific.searchTime,
        };

        logger.debug('Calculated search result stats', {
          numResults: String(results.length),
          similarityRange: `${(stats.similarities.min * 100).toFixed(2)}% - ${(stats.similarities.max * 100).toFixed(2)}%`,
          magnitudeRange: `${stats.magnitudes.min.toFixed(3)} - ${stats.magnitudes.max.toFixed(3)}`,
          searchTime: `${stats.searchTime.toFixed(2)}ms`,
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

  const handleResultClick = (resultId: string) => {
    if (!queryVectorId) {
      logger.warn('No query vector ID available for comparison');
      return;
    }
    router.push(`/vector/${resultId}/compare?query=${queryVectorId}`);
  };

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
        <div className="grid grid-cols-3 gap-4 mb-6">
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

          <div className="bg-[#252B38] rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-400 mb-3">
              Search Performance
            </h4>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Time:</span>
                <span className="text-white">
                  {stats.searchTime.toFixed(2)}ms
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Method:</span>
                <span className="text-white">
                  {results[0].algorithmSpecific.distanceMetric}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Results:</span>
                <span className="text-white">
                  {results.length}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Results List */}
      <div className="space-y-4">
        {results.map((result, index) => (
          <div
            key={index}
            className="bg-[#252B38] rounded-lg p-4 transition-colors hover:bg-[#2A3241] cursor-pointer"
            onClick={() => handleResultClick(result.metadata.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                handleResultClick(result.metadata.id);
              }
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <span className="text-gray-400">#{index + 1}</span>
                <div className="h-2 w-2 rounded-full bg-blue-500" />
                <span className="text-white font-medium">
                  {(result.similarity * 100).toFixed(2)}% Similar
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-gray-400 text-sm">
                  ID: {result.metadata.id}
                </span>
                <span className="text-xs text-blue-400 hover:text-blue-300">
                  Click to compare →
                </span>
              </div>
            </div>

            {/* Metadata Section */}
            <div className="grid grid-cols-2 gap-4 mb-3 text-sm">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-gray-500">Source:</span>
                  <span className="text-white capitalize">{result.metadata.source}</span>
                </div>
                <div className="flex justify-between mb-1">
                  <span className="text-gray-500">Model:</span>
                  <span className="text-white uppercase">{result.metadata.model}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Created:</span>
                  <span className="text-white">
                    {new Date(result.metadata.timestamp).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-gray-500">Magnitude:</span>
                  <span className="text-white">
                    {result.metadata.stats?.magnitude.toFixed(3) || 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between mb-1">
                  <span className="text-gray-500">Sparsity:</span>
                  <span className="text-white">
                    {result.metadata.stats?.sparsity 
                      ? `${(result.metadata.stats.sparsity * 100).toFixed(1)}%` 
                      : 'N/A'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {result.metadata.labels.map((label, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 bg-[#1A1F2A] rounded text-xs text-blue-400"
                    >
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Original Content */}
            {result.metadata.originalContent && (
              <div className="mt-3 text-sm">
                <h4 className="text-gray-400 mb-2">Original Content:</h4>
                <div className="bg-[#1A1F2A] rounded p-2">
                  {result.metadata.originalContent.type === 'image' ? (
                    <div className="flex items-center space-x-2">
                      <img
                        src={result.metadata.originalContent.url || '#'}
                        alt="Thumbnail"
                        className="w-8 h-8 object-cover rounded"
                      />
                      <span className="text-gray-300">Image content</span>
                    </div>
                  ) : (
                    <p className="text-gray-300">
                      {result.metadata.originalContent.value}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Vector Preview */}
            <div className="mt-3">
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-sm text-gray-400">Vector Preview:</h4>
                <span className="text-xs text-gray-500">
                  Dimension: {result.vector.length}
                </span>
              </div>
              <div className="text-xs font-mono bg-[#1A1F2A] rounded p-2 overflow-x-auto">
                <div className="flex flex-wrap gap-1">
                  {result.vector.slice(0, 10).map((value, i) => (
                    <span
                      key={i}
                      className={`inline-block ${
                        value > 0 ? 'text-blue-400' : 'text-red-400'
                      }`}
                    >
                      {value.toFixed(3)}
                    </span>
                  ))}
                  <span className="text-gray-500">...</span>
                </div>
              </div>
            </div>
          </div>
        ))}
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
performanceMonitor.setThreshold('calculate_stats', 50);

export default withErrorBoundary(SearchResults, SearchResultsErrorFallback);
