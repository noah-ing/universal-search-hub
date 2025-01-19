import { useState, useCallback, useRef } from 'react';
import { logger } from '../lib/logger';
import { performanceMonitor } from '../lib/performance';
import type { 
  Vector,
  SearchMetrics, 
  SearchState,
  SearchRequestBody,
  SearchResponseBody,
  LogContext
} from '../types/app';
import { EnhancedSearchResult, vectorTemplates } from '../types/vector';

// Get all supported dimensions
const SUPPORTED_DIMENSIONS = Array.from(new Set([
  ...Object.values(vectorTemplates).map(t => t.dimension),
  384 // Include the default dimension
])).sort((a, b) => a - b);

const MAX_RESULTS = Number(process.env.MAX_SEARCH_RESULTS) || 20;

interface UseVectorSearchReturn extends Omit<SearchState, 'results'> {
  results: EnhancedSearchResult[];
  search: (vector: Vector) => Promise<void>;
  reset: () => void;
  getMetrics: () => SearchMetrics;
}

export function useVectorSearch(): UseVectorSearchReturn {
  const [state, setState] = useState<Omit<SearchState, 'results'> & { results: EnhancedSearchResult[] }>({
    results: [],
    isLoading: false,
    error: null,
    queryVector: null,
  });

  const metricsRef = useRef<SearchMetrics>({
    totalSearches: 0,
    averageResponseTime: 0,
    errorRate: 0,
    lastSearchTime: null,
  });

  const errorCount = useRef<number>(0);

  const updateMetrics = useCallback((duration: number, hasError: boolean): void => {
    performanceMonitor.measure('update_metrics', () => {
      const metrics = metricsRef.current;
      metrics.totalSearches += 1;
      metrics.lastSearchTime = duration;
      
      // Update average response time using rolling average
      metrics.averageResponseTime = 
        (metrics.averageResponseTime * (metrics.totalSearches - 1) + duration) / 
        metrics.totalSearches;

      if (hasError) {
        errorCount.current += 1;
      }
      
      metrics.errorRate = (errorCount.current / metrics.totalSearches) * 100;

      const logContext: LogContext = {
        totalSearches: String(metrics.totalSearches),
        avgResponseTime: String(metrics.averageResponseTime.toFixed(2)),
        errorRate: String(metrics.errorRate.toFixed(2)),
        lastSearchTime: String(duration.toFixed(2)),
      };

      logger.debug('Search metrics updated', logContext);
    });
  }, []);

  const validateVector = useCallback((vector: Vector): string | null => {
    return performanceMonitor.measure('validate_vector', () => {
      if (!Array.isArray(vector)) {
        return 'Input must be an array of numbers';
      }

      if (!SUPPORTED_DIMENSIONS.includes(vector.length)) {
        return `Vector dimension ${vector.length} is not supported. Supported dimensions are: ${SUPPORTED_DIMENSIONS.join(', ')}`;
      }

      if (!vector.every(n => typeof n === 'number' && !isNaN(n))) {
        return 'All vector elements must be valid numbers';
      }

      return null;
    });
  }, []);

  const search = useCallback(async (vector: Vector): Promise<void> => {
    const validationError = validateVector(vector);
    if (validationError) {
      setState(prev => ({ ...prev, error: validationError }));
      return;
    }

    setState(prev => ({
      ...prev,
      isLoading: true,
      error: null,
      queryVector: vector,
    }));

    const startTime = performance.now();

    try {
      const searchResult = await performanceMonitor.measureAsync<EnhancedSearchResult[]>(
        'vector_search_request',
        async () => {
          const logContext: LogContext = {
            vectorLength: String(vector.length),
            maxResults: String(MAX_RESULTS),
          };
          
          logger.info('Starting vector search request', logContext);

          const requestBody: SearchRequestBody = { 
            vector,
            maxResults: MAX_RESULTS
          };

          const response = await fetch('/api/search', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
          });

          if (!response.ok) {
            const errorResponse = await response.json() as SearchResponseBody;
            throw new Error(errorResponse.error || 'Search failed');
          }

          const data = await response.json() as { results: EnhancedSearchResult[] };
          if (!Array.isArray(data.results)) {
            throw new Error('Invalid response format');
          }

          return data.results;
        },
        { vectorLength: vector.length }
      );

      setState(prev => ({
        ...prev,
        results: searchResult,
        isLoading: false,
        error: null,
      }));

      const duration = performance.now() - startTime;
      updateMetrics(duration, false);

      logger.info('Search completed successfully', {
        duration: String(duration.toFixed(2)),
        resultCount: String(searchResult.length),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred during search';
      const duration = performance.now() - startTime;
      
      logger.error('Search failed', {
        error: errorMessage,
        duration: String(duration.toFixed(2)),
        vectorLength: String(vector.length),
      });

      setState(prev => ({
        ...prev,
        error: errorMessage,
        isLoading: false,
        results: [],
      }));

      updateMetrics(duration, true);
    }
  }, [validateVector, updateMetrics]);

  const reset = useCallback((): void => {
    performanceMonitor.measure('reset_search', () => {
      setState({
        results: [],
        isLoading: false,
        error: null,
        queryVector: null,
      });

      logger.info('Search state reset');
    });
  }, []);

  const getMetrics = useCallback((): SearchMetrics => {
    return performanceMonitor.measure('get_metrics', () => {
      return { ...metricsRef.current };
    });
  }, []);

  return {
    ...state,
    search,
    reset,
    getMetrics,
  };
}
