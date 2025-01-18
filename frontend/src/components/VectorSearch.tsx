'use client';

import { useCallback, Suspense } from 'react';
import { withErrorBoundary } from './ErrorBoundary';
import VectorInput from './VectorInput';
import SearchResults from './SearchResults';
import VectorVisualization from './VectorVisualization';
import { useVectorSearch } from '../hooks/useVectorSearch';
import { logger } from '../lib/logger';
import { performanceMonitor } from '../lib/performance';
import LoadingSpinner, { 
  SearchLoading, 
  VisualizationLoading, 
  ResultsLoading 
} from './LoadingSpinner';

function VectorSearch() {
  const {
    results,
    isLoading,
    error,
    queryVector,
    search,
    getMetrics,
  } = useVectorSearch();

  const handleSearch = useCallback(async (vector: number[]) => {
    try {
      await performanceMonitor.measureAsync(
        'total_search_operation',
        async () => {
          logger.info('Starting vector search', {
            vectorLength: String(vector.length),
            timestamp: new Date().toISOString(),
          });

          await search(vector);

          const metrics = getMetrics();
          logger.info('Search metrics', {
            totalSearches: String(metrics.totalSearches),
            avgResponseTime: String(metrics.averageResponseTime.toFixed(2)),
            errorRate: String(metrics.errorRate.toFixed(2)),
          });
        },
        { vectorLength: vector.length }
      );
    } catch (err) {
      logger.error('Search operation failed', {
        error: err instanceof Error ? err.message : 'Unknown error',
        vectorLength: String(vector.length),
      });
    }
  }, [search, getMetrics]);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="bg-[#1A1F2A] rounded-lg shadow-lg p-6 mb-8">
        <Suspense fallback={<LoadingSpinner size="small" />}>
          <VectorInput onSearch={handleSearch} isLoading={isLoading} />
        </Suspense>
      </div>
      
      {error && (
        <div className="mb-8 text-red-500 text-sm bg-red-500/10 border border-red-500/20 rounded-lg p-4">
          {error}
        </div>
      )}
      
      {results.length > 0 && queryVector && (
        <div className="space-y-6">
          <div className="bg-[#1A1F2A] rounded-lg shadow-lg p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Results Section */}
              <div>
                <h3 className="text-lg font-medium text-white mb-4">
                  Search Results
                </h3>
                <Suspense fallback={<ResultsLoading />}>
                  <SearchResults results={results} />
                </Suspense>
              </div>

              {/* Visualization Section */}
              <div>
                <h3 className="text-lg font-medium text-white mb-4">
                  Vector Space Visualization
                </h3>
                <Suspense fallback={<VisualizationLoading />}>
                  <VectorVisualization
                    queryVector={queryVector}
                    results={results}
                  />
                </Suspense>
              </div>
            </div>
          </div>

          {/* Performance Metrics */}
          <div className="bg-[#1A1F2A] rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-medium text-white mb-4">
              Performance Metrics
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {Object.entries(getMetrics()).map(([key, value]) => (
                <div
                  key={key}
                  className="bg-[#252B38] rounded-lg p-4"
                >
                  <div className="text-sm text-gray-400 mb-1">
                    {key.split(/(?=[A-Z])/).join(' ')}
                  </div>
                  <div className="text-lg font-medium text-white">
                    {typeof value === 'number'
                      ? key.includes('time')
                        ? `${value.toFixed(2)}ms`
                        : key.includes('rate')
                          ? `${value.toFixed(1)}%`
                          : value.toLocaleString()
                      : value || 'N/A'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {!isLoading && results.length === 0 && !error && (
        <div className="text-center text-gray-500 dark:text-gray-400 mt-8">
          No search results yet. Try using a template or uploading a vector file.
        </div>
      )}

      {isLoading && (
        <div className="mt-8">
          <SearchLoading />
        </div>
      )}
    </div>
  );
}

// Custom error fallback UI
const VectorSearchErrorFallback = (
  <div className="max-w-6xl mx-auto p-6">
    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-6 text-center">
      <h2 className="text-xl font-semibold text-red-500 mb-2">
        Vector Search Error
      </h2>
      <p className="text-gray-400 mb-4">
        An error occurred while rendering the vector search interface.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
      >
        Reload Page
      </button>
    </div>
  </div>
);

export default withErrorBoundary(VectorSearch, VectorSearchErrorFallback);
