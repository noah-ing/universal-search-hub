'use client';

import { useState, useEffect } from 'react';
import { SearchResult } from '../types/search';
import type { Data, Layout, Config, Font, PlotMarker } from 'plotly.js';
import { logger } from '../lib/logger';
import { performanceMonitor } from '../lib/performance';
import { withErrorBoundary } from './ErrorBoundary';
import ClientPlot from './ClientPlot';

interface VectorVisualizationProps {
  queryVector: number[];
  results: SearchResult[];
}

const defaultFont: Partial<Font> = {
  family: 'Inter, system-ui, sans-serif',
  size: 12,
  color: '#9CA3AF'
};

type CustomMarker = Partial<PlotMarker> & {
  colorbar?: {
    title: string;
    titleside: 'right';
    thickness: number;
    len: number;
    tickfont: Partial<Font>;
    titlefont: Partial<Font>;
  };
};

function VectorVisualization({ queryVector, results }: VectorVisualizationProps) {
  const [dimensions, setDimensions] = useState<{ x: number; y: number }>({ x: 0, y: 1 });
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d');
  const [error, setError] = useState<string | null>(null);
  const [containerWidth, setContainerWidth] = useState(800);

  useEffect(() => {
    // Set up responsive width
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
  }, []);

  if (!queryVector || !results.length) {
    return (
      <div className="h-[500px] bg-[#1A1F2A] rounded-lg flex items-center justify-center">
        <div className="text-gray-400">No data to visualize</div>
      </div>
    );
  }
  
  // Prepare data for visualization
  const data: Partial<Data>[] = viewMode === '2d' ? [
    // Query vector
    {
      x: [queryVector[dimensions.x]],
      y: [queryVector[dimensions.y]],
      mode: 'markers',
      type: 'scatter',
      name: 'Query Vector',
      marker: {
        size: 12,
        color: '#3B82F6',
        symbol: 'star',
      } as CustomMarker,
    },
    // Result vectors
    {
      x: results.map(r => r.vector[dimensions.x]),
      y: results.map(r => r.vector[dimensions.y]),
      mode: 'markers',
      type: 'scatter',
      name: 'Results',
      marker: {
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
      } as CustomMarker,
      text: results.map(r => `Similarity: ${(r.similarity * 100).toFixed(2)}%`),
      hoverinfo: 'text',
    },
  ] : [
    // 3D visualization
    {
      type: 'scatter3d',
      x: [queryVector[dimensions.x]],
      y: [queryVector[dimensions.y]],
      z: [queryVector[dimensions.x + 1] || 0],
      mode: 'markers',
      name: 'Query Vector',
      marker: {
        size: 8,
        color: '#3B82F6',
        symbol: 'diamond',
      } as CustomMarker,
    },
    {
      type: 'scatter3d',
      x: results.map(r => r.vector[dimensions.x]),
      y: results.map(r => r.vector[dimensions.y]),
      z: results.map(r => r.vector[dimensions.x + 1] || 0),
      mode: 'markers',
      name: 'Results',
      marker: {
        size: 6,
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
      } as CustomMarker,
      text: results.map(r => `Similarity: ${(r.similarity * 100).toFixed(2)}%`),
      hoverinfo: 'text',
    },
  ];

  const layout: Partial<Layout> = {
    title: {
      text: `${viewMode === '2d' ? '2D' : '3D'} Vector Space Visualization`,
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
    hovermode: 'closest' as const,
    dragmode: viewMode === '3d' ? 'orbit' as const : 'zoom' as const,
    ...(viewMode === '2d' ? {
      xaxis: {
        title: `Dimension ${dimensions.x}`,
        gridcolor: 'rgba(156, 163, 175, 0.2)',
        zerolinecolor: 'rgba(156, 163, 175, 0.2)',
        tickfont: defaultFont,
        titlefont: defaultFont,
      },
      yaxis: {
        title: `Dimension ${dimensions.y}`,
        gridcolor: 'rgba(156, 163, 175, 0.2)',
        zerolinecolor: 'rgba(156, 163, 175, 0.2)',
        tickfont: defaultFont,
        titlefont: defaultFont,
      },
    } : {
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
    }),
  };

  const config: Partial<Config> = {
    responsive: true,
    displayModeBar: true,
    modeBarButtonsToRemove: ['lasso2d', 'select2d'] as ('lasso2d' | 'select2d')[],
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
        </div>
      </div>

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

      <div className="text-sm text-gray-500">
        Tip: {viewMode === '3d' 
          ? 'Click and drag to rotate the view. Scroll to zoom.' 
          : 'Use the zoom and pan tools to explore the vector space.'}
      </div>
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
