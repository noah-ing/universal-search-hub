import { NextResponse } from 'next/server';
import { apiClient } from '../../../../lib/api-client';
import { sampleCollections, vectorTemplates } from '../../../../types/vector';
import { logger } from '../../../../lib/logger';

// Get all supported dimensions for lookup
const SUPPORTED_DIMENSIONS = [384, 768, 1024, 1536, 2048];

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Check URL for dimension parameter
    const url = new URL(request.url);
    const dimensionParam = url.searchParams.get('dimension');

    // Try to get vector from backend first
    const isAvailable = await apiClient.isAvailable();

    if (isAvailable) {
      // Try to find the vector in backend across all dimensions
      const numericId = parseInt(params.id, 10);

      if (!isNaN(numericId)) {
        // If dimension is specified, use it; otherwise try all dimensions
        const dimensionsToTry = dimensionParam
          ? [parseInt(dimensionParam, 10)]
          : SUPPORTED_DIMENSIONS;

        for (const dimension of dimensionsToTry) {
          try {
            const backendVector = await apiClient.getVector(numericId, dimension);
            logger.info('Vector fetched from backend', {
              id: params.id,
              dimension: String(dimension),
            });
            return NextResponse.json({
              vector: backendVector.vector,
              metadata: {
                id: String(backendVector.id),
                source: 'backend',
                model: 'unknown',
                timestamp: new Date().toISOString(),
                description: `Vector ${backendVector.id}`,
                labels: ['backend'],
                originalContent: { type: 'vector', value: '' },
                stats: {
                  magnitude: Math.sqrt(backendVector.vector.reduce((s, v) => s + v * v, 0)),
                  sparsity: backendVector.vector.filter(v => Math.abs(v) < 1e-6).length / backendVector.vector.length,
                  min: Math.min(...backendVector.vector),
                  max: Math.max(...backendVector.vector),
                },
                ...backendVector.metadata,
              },
            });
          } catch {
            // Vector not found at this dimension, try next
            continue;
          }
        }
      }

      // If not found in backend by numeric ID, try string ID in local samples
      logger.debug('Vector not found in backend, checking local samples', { id: params.id });
    }

    // Fallback: Check local sample collections
    const allVectors = [
      ...sampleCollections.textEmbeddings,
      ...sampleCollections.imageFeatures,
      ...sampleCollections.audioEmbeddings
    ];

    // Find the vector by ID
    const vector = allVectors.find(v => v.metadata?.id === params.id);

    if (!vector) {
      logger.error('Vector not found', { id: params.id });
      return NextResponse.json(
        { error: 'Vector not found' },
        { status: 404 }
      );
    }

    // Get the correct dimension based on the vector's model
    const modelTemplate = Object.values(vectorTemplates).find(
      t => t.model === vector.metadata?.model
    );

    const dimension = modelTemplate?.dimension || 384;

    logger.info('Fetching vector from local samples', {
      id: params.id,
      model: vector.metadata?.model,
      dimension: String(dimension)
    });

    // For local samples, we generate deterministic vectors based on ID
    // This ensures consistency while still being demo data
    const seed = params.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const deterministicRandom = (i: number) => {
      const x = Math.sin(seed * i + i) * 10000;
      return (x - Math.floor(x)) * 2 - 1;
    };

    const generatedVector = Array.from({ length: dimension }, (_, i) => deterministicRandom(i));

    return NextResponse.json({
      ...vector,
      vector: generatedVector
    });
  } catch (error) {
    logger.error('Error fetching vector', {
      id: params.id,
      error: error instanceof Error ? error.message : String(error)
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const isAvailable = await apiClient.isAvailable();

    if (!isAvailable) {
      return NextResponse.json(
        { error: 'Backend server is not available' },
        { status: 503 }
      );
    }

    const numericId = parseInt(params.id, 10);
    if (isNaN(numericId)) {
      return NextResponse.json(
        { error: 'Invalid vector ID' },
        { status: 400 }
      );
    }

    // Try to delete from all dimensions
    for (const dimension of SUPPORTED_DIMENSIONS) {
      try {
        await apiClient.deleteVector(numericId, dimension);
        logger.info('Vector deleted', { id: params.id, dimension: String(dimension) });
        return NextResponse.json({ success: true, id: numericId });
      } catch {
        // Try next dimension
        continue;
      }
    }

    return NextResponse.json(
      { error: 'Vector not found' },
      { status: 404 }
    );

  } catch (error) {
    logger.error('Error deleting vector', {
      id: params.id,
      error: error instanceof Error ? error.message : String(error)
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
