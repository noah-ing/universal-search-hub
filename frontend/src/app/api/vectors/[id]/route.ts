import { NextResponse } from 'next/server';
import { sampleCollections, vectorTemplates } from '../../../../types/vector';
import { logger } from '../../../../lib/logger';

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Combine all sample collections
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

    const dimension = modelTemplate?.dimension || 384; // Fallback to 384 if model not found

    logger.info('Fetching vector', {
      id: params.id,
      model: vector.metadata?.model,
      dimension: String(dimension)
    });

    // Return the vector with the correct dimension
    return NextResponse.json({
      ...vector,
      vector: Array.from({ length: dimension }, () => Math.random() * 2 - 1)
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
