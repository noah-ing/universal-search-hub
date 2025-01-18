declare module 'react-plotly.js' {
  import { Component } from 'react';
  import { Data, Layout, Config } from 'plotly.js';

  interface PlotlyEventData {
    points: Array<{
      curveNumber: number;
      pointNumber: number;
      x: number;
      y: number;
      data: Partial<Data>;
    }>;
    event: MouseEvent;
  }

  interface PlotlyRelayoutEvent {
    'xaxis.range[0]'?: number;
    'xaxis.range[1]'?: number;
    'yaxis.range[0]'?: number;
    'yaxis.range[1]'?: number;
    [key: string]: number | undefined;
  }

  interface PlotParams {
    data: Partial<Data>[];
    layout?: Partial<Layout>;
    config?: Partial<Config>;
    frames?: Partial<Data>[];
    style?: React.CSSProperties;
    useResizeHandler?: boolean;
    onInitialized?: (figure: { data: Partial<Data>[]; layout: Partial<Layout> }) => void;
    onUpdate?: (figure: { data: Partial<Data>[]; layout: Partial<Layout> }) => void;
    onPurge?: (figure: { data: Partial<Data>[]; layout: Partial<Layout> }) => void;
    onError?: (err: Error) => void;
    onClick?: (event: PlotlyEventData) => void;
    onClickAnnotation?: (event: PlotlyEventData) => void;
    onHover?: (event: PlotlyEventData) => void;
    onUnhover?: (event: PlotlyEventData) => void;
    onSelected?: (event: PlotlyEventData) => void;
    onDeselect?: (event: PlotlyEventData) => void;
    onDoubleClick?: (event: PlotlyEventData) => void;
    onRelayout?: (event: PlotlyRelayoutEvent) => void;
    onRestyle?: (event: { data: Partial<Data>[]; layout: Partial<Layout> }) => void;
    onRedraw?: (event: { data: Partial<Data>[]; layout: Partial<Layout> }) => void;
    onAnimated?: (event: { data: Partial<Data>[]; layout: Partial<Layout> }) => void;
    onAfterExport?: (event: { data: Partial<Data>[]; layout: Partial<Layout> }) => void;
    onAfterPlot?: (event: { data: Partial<Data>[]; layout: Partial<Layout> }) => void;
    onAnimatingFrame?: (event: { data: Partial<Data>[]; layout: Partial<Layout>; frame: Partial<Data> }) => void;
    onAnimationInterrupted?: (event: { data: Partial<Data>[]; layout: Partial<Layout> }) => void;
    onAutoSize?: (event: { data: Partial<Data>[]; layout: Partial<Layout> }) => void;
    onBeforeExport?: (event: { data: Partial<Data>[]; layout: Partial<Layout> }) => void;
    onButtonClicked?: (event: { data: Partial<Data>[]; layout: Partial<Layout>; button: { name: string } }) => void;
    onLegendClick?: (event: PlotlyEventData) => void;
    onLegendDoubleClick?: (event: PlotlyEventData) => void;
    onSliderChange?: (event: { data: Partial<Data>[]; layout: Partial<Layout>; slider: { value: number } }) => void;
    onSliderEnd?: (event: { data: Partial<Data>[]; layout: Partial<Layout>; slider: { value: number } }) => void;
    onSliderStart?: (event: { data: Partial<Data>[]; layout: Partial<Layout>; slider: { value: number } }) => void;
    onTransitioning?: (event: { data: Partial<Data>[]; layout: Partial<Layout> }) => void;
    onTransitionInterrupted?: (event: { data: Partial<Data>[]; layout: Partial<Layout> }) => void;
  }

  export default class Plot extends Component<PlotParams> {}
}
