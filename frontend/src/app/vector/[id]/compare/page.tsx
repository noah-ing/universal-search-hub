'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { EnhancedVector, VectorMetadata } from '@/types/vector';
import { Vector } from '@/types/app';
import LoadingSpinner from '@/components/LoadingSpinner';
import VectorVisualization from '@/components/VectorVisualization';
import Link from 'next/link';

interface VectorComparisonMetrics {
  cosineSimilarity: number;
  euclideanDistance: number;
  dotProduct: number;
  topDimensions: Array<{
    dimension: number;
    contribution: number;
  }>;
}

function calculateMetrics(v1: Vector, v2: Vector): VectorComparisonMetrics {
  // Calculate cosine similarity
  const dotProduct = v1.reduce((sum, a, i) => sum + a * v2[i], 0);
  const mag1 = Math.sqrt(v1.reduce((sum, a) => sum + a * a, 0));
  const mag2 = Math.sqrt(v2.reduce((sum, a) => sum + a * a, 0));
  const cosineSimilarity = dotProduct / (mag1 * mag2);

  // Calculate Euclidean distance
  const euclideanDistance = Math.sqrt(
    v1.reduce((sum, a, i) => sum + Math.pow(a - v2[i], 2), 0)
  );

  // Calculate dimension contributions
  const contributions = v1.map((val, i) => ({
    dimension: i,
    contribution: val * v2[i] / dotProduct
  }));
  
  const topDimensions = contributions
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
    .slice(0, 10);

  return {
    cosineSimilarity,
    euclideanDistance,
    dotProduct,
    topDimensions
  };
}

export default function VectorComparePage({
  params
}: {
  params: { id: string }
}) {
  const searchParams = useSearchParams();
  const queryVectorId = searchParams.get('query');
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [baseVector, setBaseVector] = useState<EnhancedVector | null>(null);
  const [queryVector, setQueryVector] = useState<EnhancedVector | null>(null);
  const [metrics, setMetrics] = useState<VectorComparisonMetrics | null>(null);

  useEffect(() => {
    async function fetchVectors() {
      try {
        setIsLoading(true);
        setError(null);

        // In a real implementation, these would be API calls
        // For now, we'll simulate fetching vectors
        const baseResponse = await fetch(`/api/vectors/${params.id}`);
        const queryResponse = await fetch(`/api/vectors/${queryVectorId}`);

        if (!baseResponse.ok || !queryResponse.ok) {
          throw new Error('Failed to fetch vectors');
        }

        const baseData = await baseResponse.json();
        const queryData = await queryResponse.json();

        setBaseVector(baseData);
        setQueryVector(queryData);

        // Calculate comparison metrics
        const metrics = calculateMetrics(baseData.vector, queryData.vector);
        setMetrics(metrics);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    }

    if (params.id && queryVectorId) {
      fetchVectors();
    }
  }, [params.id, queryVectorId]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700">{error}</p>
        </div>
        <Link href="/" className="mt-4 text-blue-600 hover:underline">
          Return to search
        </Link>
      </div>
    );
  }

  if (!baseVector || !queryVector || !metrics) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Link href="/" className="text-blue-600 hover:underline mb-8 block">
        ← Back to search
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Vector Visualizations */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Query Vector</h2>
          <VectorVisualization
            queryVector={queryVector.vector}
            results={[]}
          />
          <div className="mt-4">
            <h3 className="font-medium">Metadata</h3>
            <MetadataDisplay metadata={queryVector.metadata} />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Result Vector</h2>
          <VectorVisualization
            queryVector={baseVector.vector}
            results={[]}
          />
          <div className="mt-4">
            <h3 className="font-medium">Metadata</h3>
            <MetadataDisplay metadata={baseVector.metadata} />
          </div>
        </div>

        {/* Similarity Metrics */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Similarity Analysis</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <MetricCard
              title="Cosine Similarity"
              value={metrics.cosineSimilarity.toFixed(4)}
              description="Measures the cosine of the angle between vectors"
            />
            <MetricCard
              title="Euclidean Distance"
              value={metrics.euclideanDistance.toFixed(4)}
              description="Measures the straight-line distance between vectors"
            />
            <MetricCard
              title="Dot Product"
              value={metrics.dotProduct.toFixed(4)}
              description="Sum of the products of corresponding entries"
            />
          </div>

          <div>
            <h3 className="font-semibold mb-4">Top Contributing Dimensions</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {metrics.topDimensions.map(({ dimension, contribution }) => (
                <div
                  key={dimension}
                  className="flex items-center justify-between bg-gray-50 p-3 rounded"
                >
                  <span className="font-medium">Dimension {dimension}</span>
                  <span className={`${
                    contribution > 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {(contribution * 100).toFixed(2)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetadataDisplay({ metadata }: { metadata: VectorMetadata }) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="text-gray-600">Source:</div>
        <div>{metadata.source}</div>
        <div className="text-gray-600">Model:</div>
        <div>{metadata.model}</div>
        <div className="text-gray-600">Labels:</div>
        <div>{metadata.labels.join(', ')}</div>
      </div>
      <div className="mt-2">
        <div className="text-gray-600">Description:</div>
        <div className="text-sm">{metadata.description}</div>
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  description
}: {
  title: string;
  value: string;
  description: string;
}) {
  return (
    <div className="bg-gray-50 p-4 rounded-lg">
      <h3 className="font-semibold text-lg mb-1">{title}</h3>
      <div className="text-2xl font-bold text-blue-600 mb-2">{value}</div>
      <p className="text-sm text-gray-600">{description}</p>
    </div>
  );
}
