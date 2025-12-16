import { NextResponse } from 'next/server';
import { apiClient } from '../../../lib/api-client';
import { performVectorSearch } from '../../../lib/search-service';
import { logger } from '../../../lib/logger';
import { performanceMonitor } from '../../../lib/performance';
import type {
  SearchRequestBody,
  Vector,
  LogContext
} from '../../../types/app';
import { SearchOptions, vectorTemplates, VectorSource, ModelType, EnhancedSearchResult } from '../../../types/vector';

// Get all supported dimensions
const SUPPORTED_DIMENSIONS = Array.from(new Set([
  ...Object.values(vectorTemplates).map(t => t.dimension),
  384 // Include the default dimension
])).sort((a, b) => a - b);

// Default max results (consistent with frontend)
const DEFAULT_MAX_RESULTS = 20;

// Track if backend is available
let backendAvailable: boolean | null = null;
let lastBackendCheck = 0;
const BACKEND_CHECK_INTERVAL = 30000; // Check every 30 seconds

// Validate vector format and dimensions
function validateVector(vector: unknown): vector is Vector {
  if (!Array.isArray(vector)) {
    throw new Error('Vector must be an array of numbers');
  }

  if (vector.some((v) => typeof v !== 'number')) {
    throw new Error('Vector must contain only numbers');
  }

  if (!SUPPORTED_DIMENSIONS.includes(vector.length)) {
    throw new Error(`Unsupported vector dimension: ${vector.length}. Supported dimensions are: ${SUPPORTED_DIMENSIONS.join(', ')}`);
  }

  return true;
}

// Check if backend is available (with caching)
async function checkBackendAvailable(): Promise<boolean> {
  const now = Date.now();
  if (backendAvailable !== null && now - lastBackendCheck < BACKEND_CHECK_INTERVAL) {
    return backendAvailable;
  }

  try {
    backendAvailable = await apiClient.isAvailable();
    lastBackendCheck = now;
    if (backendAvailable) {
      logger.info('Backend API is available, using distributed search');
    } else {
      logger.warn('Backend API unavailable, falling back to local search');
    }
  } catch {
    backendAvailable = false;
    lastBackendCheck = now;
    logger.warn('Backend check failed, using local search');
  }

  return backendAvailable;
}

// Response type for search results
interface SearchApiResponse {
  results: EnhancedSearchResult[];
  backend?: boolean;
  stats?: Record<string, unknown>;
  error?: string;
  details?: string;
}

export async function POST(request: Request): Promise<NextResponse<SearchApiResponse>> {
  const requestId = crypto.randomUUID();
  logger.info('Received search request', { requestId });

  return performanceMonitor.measure('api-search-total', async () => {
    try {
      // Parse and validate request body
      const body = await performanceMonitor.measureAsync<SearchRequestBody>('request-parse', async () => {
        try {
          return await request.json() as SearchRequestBody;
        } catch {
          throw new Error('Invalid JSON in request body');
        }
      });

      const logContext: LogContext = {
        requestId,
        hasVector: String(!!body.vector),
        vectorLength: body.vector ? String(body.vector.length) : 'undefined',
      };

      logger.debug('Request body received', logContext);

      // Validate request body
      if (!body.vector) {
        logger.error('Missing vector in request', { requestId });
        return NextResponse.json(
          {
            results: [],
            error: 'Missing vector in request body'
          },
          { status: 400 }
        );
      }

      // Validate vector format
      try {
        validateVector(body.vector);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Invalid vector format';
        logger.error('Vector validation failed', {
          requestId,
          error: message,
        });
        return NextResponse.json(
          {
            results: [],
            error: message
          },
          { status: 400 }
        );
      }

      // Get max results from request or environment or default
      const maxResults = performanceMonitor.measure('parse-max-results', () => {
        const envMax = parseInt(process.env['NEXT_PUBLIC_MAX_SEARCH_RESULTS'] || String(DEFAULT_MAX_RESULTS));
        const requested = body.maxResults ? Math.min(body.maxResults, envMax) : envMax;
        logger.debug('Using max results', {
          requestId,
          requested: String(requested),
          default: String(DEFAULT_MAX_RESULTS),
          envValue: process.env['NEXT_PUBLIC_MAX_SEARCH_RESULTS'] || 'not set',
        });
        return requested;
      });

      // Check if backend is available
      const useBackend = await checkBackendAvailable();

      if (useBackend) {
        // Use backend API for distributed search
        logger.info('Using backend API for search', { requestId });

        try {
          const backendResponse = await performanceMonitor.measureAsync('backend-search', async () => {
            return apiClient.search({
              vector: body.vector,
              k: maxResults,
              filters: body.filters,
            });
          });

          // Transform backend response to frontend format
          const results: EnhancedSearchResult[] = backendResponse.results.map(result => {
            // Map source to valid VectorSource type
            const rawSource = (result.metadata?.source as string) || 'backend';
            const source: VectorSource = ['text', 'image', 'audio', 'custom', 'backend'].includes(rawSource)
              ? rawSource as VectorSource
              : 'backend';

            // Map model to valid ModelType
            const rawModel = (result.metadata?.model as string) || 'unknown';
            const model: ModelType = ['bert', 'clip', 'resnet', 'wav2vec', 'custom', 'bert-large', 'text-embedding-ada-002', 'unknown'].includes(rawModel)
              ? rawModel as ModelType
              : 'unknown';

            return {
              vector: [] as number[],
              metadata: {
                id: String(result.id),
                source,
                model,
                timestamp: (result.metadata?.timestamp as string) || new Date().toISOString(),
                description: (result.metadata?.description as string) || `Vector ${result.id}`,
                labels: (result.metadata?.labels as string[]) || [],
                originalContent: (result.metadata?.originalContent as { type: string; value: string }) || { type: 'vector', value: '' },
                stats: (result.metadata?.stats as { magnitude: number; sparsity: number; min: number; max: number }) || {
                  magnitude: 0,
                  sparsity: 0,
                  min: 0,
                  max: 0
                }
              },
              similarity: result.similarity,
              algorithmSpecific: {
                distanceMetric: 'euclidean',
                searchTime: parseFloat(backendResponse.stats.searchTime)
              }
            };
          });

          logger.info('Backend search completed successfully', {
            requestId,
            numResults: String(results.length),
            searchTime: backendResponse.stats.searchTime,
          });

          return NextResponse.json({
            results,
            backend: true,
            stats: backendResponse.stats
          });

        } catch (backendError) {
          logger.warn('Backend search failed, falling back to local', {
            requestId,
            error: backendError instanceof Error ? backendError.message : String(backendError),
          });
          // Fall through to local search
          backendAvailable = false;
        }
      }

      // Fallback: Local search (for demo/development when backend is unavailable)
      const searchOptions: Partial<SearchOptions> = {
        maxResults,
        algorithm: 'hnsw',
        filters: body.filters
      };

      logger.info('Using local search (backend unavailable)', {
        requestId,
        maxResults: String(maxResults),
      });

      const results = await performanceMonitor.measureAsync('search-execution', () =>
        performVectorSearch(body.vector, searchOptions)
      );

      logger.info('Local search completed successfully', {
        requestId,
        numResults: String(results.length),
      });

      performanceMonitor.reportMetrics();

      return NextResponse.json({
        results,
        backend: false
      });
    } catch (error) {
      // Handle errors
      const isKnownError = error instanceof Error &&
        ['Invalid vector format', 'Dimension mismatch', 'Invalid JSON'].some(msg =>
          error.message.includes(msg)
        );

      const errorResponse: SearchApiResponse = {
        results: [],
        error: isKnownError ? error instanceof Error ? error.message : 'Validation error' : 'Internal server error',
        details: process.env['NODE_ENV'] === 'development' ? String(error) : undefined,
      };

      logger.error('Search API error', {
        requestId,
        error: error instanceof Error ? error.message : String(error),
        type: isKnownError ? 'validation' : 'internal',
        stack: error instanceof Error ? error.stack : undefined,
      });

      return NextResponse.json(
        errorResponse,
        {
          status: isKnownError ? 400 : 500
        }
      );
    }
  });
}

// Set performance thresholds for API operations
performanceMonitor.setThreshold('api-search-total', 1000); // 1 second total
performanceMonitor.setThreshold('request-parse', 50); // 50ms for parsing
performanceMonitor.setThreshold('search-execution', 500); // 500ms for search execution
performanceMonitor.setThreshold('backend-search', 500); // 500ms for backend search

// Add error handling for unhandled rejections
if (typeof process !== 'undefined') {
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled Rejection', {
      reason: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
    });
  });
}
