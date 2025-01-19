import { NextResponse } from 'next/server';
import { performVectorSearch } from '../../../lib/search-service';
import { logger } from '../../../lib/logger';
import { performanceMonitor } from '../../../lib/performance';
import type { 
  SearchRequestBody, 
  SearchResponseBody, 
  Vector,
  LogContext
} from '../../../types/app';
import { SearchOptions, vectorTemplates } from '../../../types/vector';

// Get all supported dimensions
const SUPPORTED_DIMENSIONS = Array.from(new Set([
  ...Object.values(vectorTemplates).map(t => t.dimension),
  384 // Include the default dimension
])).sort((a, b) => a - b);

// Default max results (consistent with frontend)
const DEFAULT_MAX_RESULTS = 20;

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

export async function POST(request: Request): Promise<NextResponse<SearchResponseBody>> {
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
        const envMax = parseInt(process.env.MAX_SEARCH_RESULTS || String(DEFAULT_MAX_RESULTS));
        const requested = body.maxResults ? Math.min(body.maxResults, envMax) : envMax;
        logger.debug('Using max results', {
          requestId,
          requested: String(requested),
          default: String(DEFAULT_MAX_RESULTS),
          envValue: process.env.MAX_SEARCH_RESULTS || 'not set',
        });
        return requested;
      });

      // Prepare search options
      const searchOptions: Partial<SearchOptions> = {
        maxResults,
        algorithm: 'hnsw',
        filters: body.filters
      };

      // Perform search
      logger.info('Initiating vector search', {
        requestId,
        maxResults: String(maxResults),
        options: JSON.stringify(searchOptions),
      });

      const results = await performanceMonitor.measureAsync('search-execution', () =>
        performVectorSearch(body.vector, searchOptions)
      );

      // Log search completion
      logger.info('Search completed successfully', {
        requestId,
        numResults: String(results.length),
        similarities: JSON.stringify(results.map(r => r.similarity)),
      });

      // Report performance metrics
      performanceMonitor.reportMetrics();

      return NextResponse.json({ results });
    } catch (error) {
      // Handle errors
      const isKnownError = error instanceof Error && 
        ['Invalid vector format', 'Dimension mismatch', 'Invalid JSON'].some(msg => 
          error.message.includes(msg)
        );

      const errorResponse: SearchResponseBody = {
        results: [],
        error: isKnownError ? error instanceof Error ? error.message : 'Validation error' : 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined,
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

// Add error handling for unhandled rejections
if (typeof process !== 'undefined') {
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled Rejection', {
      reason: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
    });
  });
}
