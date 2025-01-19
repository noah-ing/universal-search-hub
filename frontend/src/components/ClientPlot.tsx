'use client';

import dynamic from 'next/dynamic';
import type { Data, Layout, Config } from 'plotly.js';
import { logger } from '../lib/logger';

// Dynamically import Plot component with no SSR
const Plot = dynamic(
  () => import('react-plotly.js'),
  { 
    ssr: false,
    loading: () => (
      <div className="h-[500px] bg-[#1A1F2A] rounded-lg flex items-center justify-center">
        <div className="text-gray-400">Loading visualization...</div>
      </div>
    )
  }
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
