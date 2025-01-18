'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import type { Data, Layout, Config } from 'plotly.js';
import { logger } from '../lib/logger';

// Dynamically import Plot component with no SSR
const Plot = dynamic(
  () => import('react-plotly.js').then(mod => {
    logger.info('Plotly component loaded successfully');
    return mod;
  }).catch(err => {
    logger.error('Failed to load Plotly', {
      error: err instanceof Error ? err.message : 'Unknown error',
    });
    throw new Error('Failed to load visualization component');
  }),
  { ssr: false }
);

interface ClientPlotProps {
  data: Partial<Data>[];
  layout: Partial<Layout>;
  config: Partial<Config>;
  onError?: (err: Error) => void;
  onInitialized?: () => void;
}

export default function ClientPlot({
  data,
  layout,
  config,
  onError,
  onInitialized
}: ClientPlotProps) {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Load Plotly on the client side
    if (typeof window !== 'undefined') {
      import('plotly.js-dist-min')
        .then(() => setIsLoaded(true))
        .catch(err => {
          logger.error('Failed to load Plotly', {
            error: err instanceof Error ? err.message : 'Unknown error',
          });
          onError?.(new Error('Failed to load visualization library'));
        });
    }
  }, [onError]);

  if (!isLoaded) {
    return (
      <div className="h-[500px] bg-[#1A1F2A] rounded-lg flex items-center justify-center">
        <div className="text-gray-400">Loading visualization...</div>
      </div>
    );
  }

  return (
    <Plot
      data={data}
      layout={layout}
      config={config}
      style={{ width: '100%', height: '500px' }}
      onError={(err) => onError?.(err)}
      onInitialized={() => {
        logger.info('Plot initialized');
        onInitialized?.();
      }}
      useResizeHandler={true}
    />
  );
}
