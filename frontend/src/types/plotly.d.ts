import { PlotData, Layout, Config, Font, ModeBarDefaultButtons } from 'plotly.js';

declare module 'plotly.js-dist-min';

export type PlotType = 'scatter' | 'scatter3d' | 'scattergl';
export type PlotMode = 'lines' | 'markers' | 'lines+markers';
export type HoverInfo = 'text' | 'x' | 'y' | 'z' | 'all';
export type DragMode = 'zoom' | 'pan' | 'orbit';

export interface CustomPlotData extends Omit<Partial<PlotData>, 'type' | 'mode' | 'hoverinfo'> {
  type?: PlotType;
  mode?: PlotMode;
  hoverinfo?: HoverInfo;
  marker?: {
    size?: number;
    color?: string | number | (string | number)[];
    symbol?: string;
    colorscale?: string;
    showscale?: boolean;
    colorbar?: {
      title?: string;
      titleside?: 'right';
      thickness?: number;
      len?: number;
      tickfont?: Partial<Font>;
      titlefont?: Partial<Font>;
    };
  };
  line?: {
    color?: string;
    width?: number;
  };
}

export interface CustomLayout extends Omit<Partial<Layout>, 'dragmode' | 'hovermode'> {
  dragmode?: DragMode;
  hovermode?: 'closest';
}

export interface CustomConfig extends Omit<Partial<Config>, 'modeBarButtonsToRemove'> {
  modeBarButtonsToRemove?: ModeBarDefaultButtons[];
}
