'use client';

import { useState, useEffect, useMemo } from 'react';
import { EnhancedSearchResult } from '../types/vector';
import { CustomPlotData, CustomLayout, CustomConfig, PlotType, PlotMode, HoverInfo } from '../types/plotly';
import { logger } from '../lib/logger';
import { performanceMonitor } from '../lib/performance';
import { withErrorBoundary } from './ErrorBoundary';
import ClientPlot from './ClientPlot';

interface VectorVisualizationProps {
  queryVector: number[];
  results: EnhancedSearchResult[];
}

const defaultFont = {
  family: 'Inter, system-ui, sans-serif',
  size: 12,
  color: '#9CA3AF'
} as const;

type VisualizationMode = '2d' | '3d' | 'cluster' | 'pca' | 'tsne';

function VectorVisualization({ queryVector, results }: VectorVisualizationProps) {
  const [dimensions, setDimensions] = useState<{ x: number; y: number }>({ x: 0, y: 1 });
  const [viewMode, setViewMode] = useState<VisualizationMode>('2d');
  const [error, setError] = useState<string | null>(null);
  const [containerWidth, setContainerWidth] = useState(800);
  const [clusterCount, setClusterCount] = useState(3);
  const [showVectorPaths, setShowVectorPaths] = useState(false);
  const [showMetadata, setShowMetadata] = useState(true);

  useEffect(() => {
    const updateWidth = () => {
      const container = document.querySelector('.plot-container');
      if (container) {
        setContainerWidth(container.clientWidth);
      }
    };

    if (typeof window !== 'undefined') {
      updateWidth();
      window.addEventListener('resize', updateWidth);
      return () => window.removeEventListener('resize', updateWidth);
    }
    return () => {};
  }, []);

  // Group results by source type for better visualization
  const groupedResults = useMemo(() => {
    return results.reduce((acc, result) => {
      const source = result.metadata.source;
      if (!acc[source]) acc[source] = [];
      acc[source].push(result);
      return acc;
    }, {} as Record<string, EnhancedSearchResult[]>);
  }, [results]);

  if (!queryVector || !results.length) {
    return (
      <div className="h-[500px] bg-[#1A1F2A] rounded-lg flex items-center justify-center">
        <div className="text-gray-400">No data to visualize</div>
      </div>
    );
  }

  // Prepare hover text with metadata
  const getHoverText = (result: EnhancedSearchResult) => {
    const { metadata, similarity } = result;
    return `
      Source: ${metadata.source}
      Model: ${metadata.model}
      Similarity: ${(similarity * 100).toFixed(2)}%
      Labels: ${metadata.labels.join(', ')}
      ${metadata.originalContent ? `Content: ${metadata.originalContent.value.slice(0, 50)}...` : ''}
    `.trim();
  };
  
  // Prepare data for different visualization modes
  const data: CustomPlotData[] = (() => {
    // Common marker settings for results
    const getResultMarker = (results: EnhancedSearchResult[]) => ({
      size: 10,
      color: results.map(r => r.similarity),
      colorscale: 'Viridis',
      showscale: true,
      colorbar: {
        title: 'Similarity',
        titleside: 'right',
        thickness: 15,
        len: 0.75,
        tickfont: defaultFont,
        titlefont: defaultFont,
      },
    });

    // Query vector marker
    const queryMarker = {
      size: 12,
      color: '#3B82F6',
      symbol: 'star',
    };

    switch (viewMode) {
      case '2d': {
        const plotType: PlotType = 'scatter';
        const plotMode: PlotMode = 'markers';
        const hoverInfo: HoverInfo = 'text';

        return [
          // Query vector
          {
            x: [queryVector[dimensions.x]],
            y: [queryVector[dimensions.y]],
            mode: plotMode,
            type: plotType,
            name: 'Query Vector',
            marker: queryMarker,
          } as CustomPlotData,
          // Results by source type
          ...Object.entries(groupedResults).map(([source, sourceResults]) => ({
            x: sourceResults.map(r => r.vector[dimensions.x]),
            y: sourceResults.map(r => r.vector[dimensions.y]),
            mode: showVectorPaths ? 'lines+markers' as PlotMode : plotMode,
            type: plotType,
            name: `${source.charAt(0).toUpperCase()}${source.slice(1)} Vectors`,
            marker: getResultMarker(sourceResults),
            text: sourceResults.map(getHoverText),
            hoverinfo: hoverInfo,
            line: showVectorPaths ? { color: '#4B5563', width: 1 } : undefined,
          } as CustomPlotData)),
        ];
      }

      case '3d': {
        const plotType: PlotType = 'scatter3d';
        const plotMode: PlotMode = 'markers';
        const hoverInfo: HoverInfo = 'text';

        return [
          // Query vector
          {
            type: plotType,
            x: [queryVector[dimensions.x]],
            y: [queryVector[dimensions.y]],
            z: [queryVector[dimensions.x + 1] || 0],
            mode: plotMode,
            name: 'Query Vector',
            marker: { ...queryMarker, size: 8 },
          } as CustomPlotData,
          // Results by source type
          ...Object.entries(groupedResults).map(([source, sourceResults]) => ({
            type: plotType,
            x: sourceResults.map(r => r.vector[dimensions.x]),
            y: sourceResults.map(r => r.vector[dimensions.y]),
            z: sourceResults.map(r => r.vector[dimensions.x + 1] || 0),
            mode: showVectorPaths ? 'lines+markers' as PlotMode : plotMode,
            name: `${source.charAt(0).toUpperCase()}${source.slice(1)} Vectors`,
            marker: { ...getResultMarker(sourceResults), size: 6 },
            text: sourceResults.map(getHoverText),
            hoverinfo: hoverInfo,
            line: showVectorPaths ? { color: '#4B5563', width: 1 } : undefined,
          } as CustomPlotData)),
        ];
      }

      case 'cluster': {
        const plotType: PlotType = 'scatter';
        const plotMode: PlotMode = 'markers';
        const hoverInfo: HoverInfo = 'text';

        // Simplified k-means visualization
        const clusters = results.map(r => Math.floor(r.similarity * clusterCount));
        return [
          // Query vector
          {
            x: [queryVector[dimensions.x]],
            y: [queryVector[dimensions.y]],
            mode: plotMode,
            type: plotType,
            name: 'Query Vector',
            marker: queryMarker,
          } as CustomPlotData,
          // Clustered results
          {
            x: results.map(r => r.vector[dimensions.x]),
            y: results.map(r => r.vector[dimensions.y]),
            mode: plotMode,
            type: plotType,
            name: 'Clustered Results',
            marker: {
              size: 10,
              color: clusters,
              colorscale: 'Viridis',
              showscale: true,
              colorbar: {
                title: 'Cluster',
                titleside: 'right',
                thickness: 15,
                len: 0.75,
                tickfont: defaultFont,
                titlefont: defaultFont,
              },
            },
            text: results.map(getHoverText),
            hoverinfo: hoverInfo,
          } as CustomPlotData,
        ];
      }

      // Placeholder for PCA and t-SNE
      case 'pca':
      case 'tsne': {
        const plotType: PlotType = 'scatter';
        const plotMode: PlotMode = 'markers';
        const hoverInfo: HoverInfo = 'text';

        return [
          {
            x: results.map(() => Math.random() * 2 - 1),
            y: results.map(() => Math.random() * 2 - 1),
            mode: plotMode,
            type: plotType,
            name: 'Dimensionality Reduced Vectors',
            marker: getResultMarker(results),
            text: results.map(getHoverText),
            hoverinfo: hoverInfo,
          } as CustomPlotData,
        ];
      }

      default:
        return [];
    }
  })();

  const layout: CustomLayout = {
    title: {
      text: `Vector Space Visualization (${viewMode.toUpperCase()})`,
      font: defaultFont,
    },
    plot_bgcolor: '#1A1F2A',
    paper_bgcolor: '#1A1F2A',
    width: containerWidth,
    height: 500,
    autosize: true,
    showlegend: true,
    legend: {
      font: defaultFont,
      bgcolor: 'rgba(26, 31, 42, 0.8)',
    },
    margin: { t: 50, r: 50, b: 50, l: 50 },
    hovermode: 'closest',
    dragmode: viewMode === '3d' ? 'orbit' : 'zoom',
    ...(viewMode === '3d' ? {
      scene: {
        xaxis: {
          title: `Dimension ${dimensions.x}`,
          gridcolor: 'rgba(156, 163, 175, 0.2)',
          tickfont: defaultFont,
          titlefont: defaultFont,
        },
        yaxis: {
          title: `Dimension ${dimensions.y}`,
          gridcolor: 'rgba(156, 163, 175, 0.2)',
          tickfont: defaultFont,
          titlefont: defaultFont,
        },
        zaxis: {
          title: `Dimension ${dimensions.x + 1}`,
          gridcolor: 'rgba(156, 163, 175, 0.2)',
          tickfont: defaultFont,
          titlefont: defaultFont,
        },
        camera: {
          up: { x: 0, y: 0, z: 1 },
          center: { x: 0, y: 0, z: 0 },
          eye: { x: 1.5, y: 1.5, z: 1.5 }
        },
      },
    } : {
      xaxis: {
        title: viewMode === '2d' ? `Dimension ${dimensions.x}` : 'Component 1',
        gridcolor: 'rgba(156, 163, 175, 0.2)',
        zerolinecolor: 'rgba(156, 163, 175, 0.2)',
        tickfont: defaultFont,
        titlefont: defaultFont,
      },
      yaxis: {
        title: viewMode === '2d' ? `Dimension ${dimensions.y}` : 'Component 2',
        gridcolor: 'rgba(156, 163, 175, 0.2)',
        zerolinecolor: 'rgba(156, 163, 175, 0.2)',
        tickfont: defaultFont,
        titlefont: defaultFont,
      },
    }),
  };

  const config: CustomConfig = {
    responsive: true,
    displayModeBar: true,
    modeBarButtonsToRemove: ['lasso2d', 'select2d'],
  };

  const handleDimensionChange = (axis: 'x' | 'y', value: number) => {
    performanceMonitor.measure('dimension_change', () => {
      setDimensions(prev => ({
        ...prev,
        [axis]: Math.min(Math.max(0, value), queryVector.length - 1),
      }));
    });
  };

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-red-500">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4 items-center justify-between">
        {/* Dimension Controls */}
        {viewMode === '2d' || viewMode === '3d' ? (
          <div className="flex gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">
                X Dimension
              </label>
              <input
                type="number"
                min={0}
                max={queryVector.length - 1}
                value={dimensions.x}
                onChange={(e) => handleDimensionChange('x', parseInt(e.target.value))}
                className="w-20 px-2 py-1 rounded bg-[#1A1F2A] border border-gray-700 text-gray-300"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">
                Y Dimension
              </label>
              <input
                type="number"
                min={0}
                max={queryVector.length - 1}
                value={dimensions.y}
                onChange={(e) => handleDimensionChange('y', parseInt(e.target.value))}
                className="w-20 px-2 py-1 rounded bg-[#1A1F2A] border border-gray-700 text-gray-300"
              />
            </div>
          </div>
        ) : viewMode === 'cluster' ? (
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">
              Cluster Count
            </label>
            <input
              type="number"
              min={2}
              max={10}
              value={clusterCount}
              onChange={(e) => setClusterCount(parseInt(e.target.value))}
              className="w-20 px-2 py-1 rounded bg-[#1A1F2A] border border-gray-700 text-gray-300"
            />
          </div>
        ) : null}

        {/* Visualization Controls */}
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('2d')}
            className={`px-3 py-1 rounded ${
              viewMode === '2d'
                ? 'bg-blue-600 text-white'
                : 'bg-[#1A1F2A] text-gray-400 hover:bg-[#252B38]'
            }`}
          >
            2D View
          </button>
          <button
            onClick={() => setViewMode('3d')}
            className={`px-3 py-1 rounded ${
              viewMode === '3d'
                ? 'bg-blue-600 text-white'
                : 'bg-[#1A1F2A] text-gray-400 hover:bg-[#252B38]'
            }`}
          >
            3D View
          </button>
          <button
            onClick={() => setViewMode('cluster')}
            className={`px-3 py-1 rounded ${
              viewMode === 'cluster'
                ? 'bg-blue-600 text-white'
                : 'bg-[#1A1F2A] text-gray-400 hover:bg-[#252B38]'
            }`}
          >
            Clusters
          </button>
          <button
            onClick={() => setViewMode('pca')}
            className={`px-3 py-1 rounded ${
              viewMode === 'pca'
                ? 'bg-blue-600 text-white'
                : 'bg-[#1A1F2A] text-gray-400 hover:bg-[#252B38]'
            }`}
          >
            PCA
          </button>
          <button
            onClick={() => setViewMode('tsne')}
            className={`px-3 py-1 rounded ${
              viewMode === 'tsne'
                ? 'bg-blue-600 text-white'
                : 'bg-[#1A1F2A] text-gray-400 hover:bg-[#252B38]'
            }`}
          >
            t-SNE
          </button>
        </div>
      </div>

      {/* Additional Options */}
      <div className="flex gap-4 text-sm">
        <label className="flex items-center gap-2 text-gray-400">
          <input
            type="checkbox"
            checked={showVectorPaths}
            onChange={(e) => setShowVectorPaths(e.target.checked)}
            className="rounded border-gray-700 bg-[#1A1F2A] text-blue-600"
          />
          Show Vector Paths
        </label>
        <label className="flex items-center gap-2 text-gray-400">
          <input
            type="checkbox"
            checked={showMetadata}
            onChange={(e) => setShowMetadata(e.target.checked)}
            className="rounded border-gray-700 bg-[#1A1F2A] text-blue-600"
          />
          Show Metadata
        </label>
      </div>

      {/* Plot Container */}
      <div className="bg-[#1A1F2A] rounded-lg p-4 shadow-lg plot-container">
        <ClientPlot
          data={data}
          layout={layout}
          config={config}
          onError={(err) => {
            logger.error('Plotly error', {
              error: err instanceof Error ? err.message : 'Unknown error',
            });
            setError('Failed to render visualization');
          }}
          onInitialized={() => {
            logger.info('Plot initialized');
          }}
        />
      </div>

      {/* Help Text */}
      <div className="text-sm text-gray-500">
        {viewMode === '3d' ? (
          'Click and drag to rotate the view. Scroll to zoom.'
        ) : viewMode === 'cluster' ? (
          'Adjust cluster count to see different groupings. Hover over points to see metadata.'
        ) : viewMode === 'pca' || viewMode === 'tsne' ? (
          'Dimensionality reduction helps visualize high-dimensional relationships.'
        ) : (
          'Use the zoom and pan tools to explore the vector space.'
        )}
      </div>

      {/* Vector Statistics */}
      {showMetadata && (
        <div className="grid grid-cols-3 gap-4 text-sm">
          {Object.entries(groupedResults).map(([source, sourceResults]) => (
            <div key={source} className="bg-[#252B38] rounded-lg p-4">
              <h4 className="font-medium text-gray-300 mb-2 capitalize">{source} Vectors</h4>
              <div className="space-y-1 text-gray-400">
                <div>Count: {sourceResults.length}</div>
                <div>
                  Avg Similarity: {
                    (sourceResults.reduce((sum, r) => sum + r.similarity, 0) / sourceResults.length * 100).toFixed(2)
                  }%
                </div>
                <div>
                  Models: {
                    Array.from(new Set(sourceResults.map(r => r.metadata.model)))
                      .join(', ')
                  }
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Custom fallback UI for visualization errors
const VisualizationErrorFallback = (
  <div className="min-h-[500px] bg-[#1A1F2A] rounded-lg p-6 flex items-center justify-center">
    <div className="text-center">
      <h3 className="text-xl font-semibold text-red-500 mb-3">
        Visualization Error
      </h3>
      <p className="text-gray-400 mb-4">
        An error occurred while rendering the vector visualization.
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

export default withErrorBoundary(VectorVisualization, VisualizationErrorFallback);
