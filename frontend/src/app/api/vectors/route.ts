import { NextResponse } from 'next/server';
import { apiClient } from '../../../lib/api-client';
import { logger } from '../../../lib/logger';

/**
 * POST /api/vectors - Insert a vector into the backend
 */
export async function POST(request: Request): Promise<NextResponse> {
  const requestId = crypto.randomUUID();

  try {
    const body = await request.json();

    if (!body.vector || !Array.isArray(body.vector)) {
      return NextResponse.json(
        { error: 'Missing or invalid vector' },
        { status: 400 }
      );
    }

    // Check if backend is available
    const isAvailable = await apiClient.isAvailable();
    if (!isAvailable) {
      logger.warn('Backend unavailable for vector insert', { requestId });
      return NextResponse.json(
        { error: 'Backend server is not available' },
        { status: 503 }
      );
    }

    const result = await apiClient.insert({
      vector: body.vector,
      id: body.id,
      metadata: body.metadata,
    });

    logger.info('Vector inserted successfully', {
      requestId,
      id: String(result.id),
      dimension: String(result.dimension),
    });

    return NextResponse.json(result, { status: 201 });

  } catch (error) {
    logger.error('Vector insert failed', {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Insert failed' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/vectors - Get backend metrics
 */
export async function GET(): Promise<NextResponse> {
  try {
    const isAvailable = await apiClient.isAvailable();
    if (!isAvailable) {
      return NextResponse.json(
        { error: 'Backend server is not available', available: false },
        { status: 503 }
      );
    }

    const metrics = await apiClient.getMetrics();
    return NextResponse.json({
      available: true,
      ...metrics,
    });

  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get metrics', available: false },
      { status: 500 }
    );
  }
}
