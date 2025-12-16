import { NextResponse } from 'next/server';
import { apiClient } from '../../../../lib/api-client';
import { logger } from '../../../../lib/logger';

/**
 * POST /api/vectors/bulk - Bulk insert vectors into the backend
 */
export async function POST(request: Request): Promise<NextResponse> {
  const requestId = crypto.randomUUID();

  try {
    const body = await request.json();

    if (!body.vectors || !Array.isArray(body.vectors) || body.vectors.length === 0) {
      return NextResponse.json(
        { error: 'Missing or invalid vectors array' },
        { status: 400 }
      );
    }

    // Check if backend is available
    const isAvailable = await apiClient.isAvailable();
    if (!isAvailable) {
      logger.warn('Backend unavailable for bulk insert', { requestId });
      return NextResponse.json(
        { error: 'Backend server is not available' },
        { status: 503 }
      );
    }

    const result = await apiClient.bulkInsert({
      vectors: body.vectors,
    });

    logger.info('Bulk insert completed', {
      requestId,
      successCount: String(result.stats.successCount),
      failCount: String(result.stats.failCount),
      totalCount: String(result.stats.totalCount),
    });

    return NextResponse.json(result);

  } catch (error) {
    logger.error('Bulk insert failed', {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Bulk insert failed' },
      { status: 500 }
    );
  }
}
