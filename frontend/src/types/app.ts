import { VectorSource, ModelType, EnhancedSearchResult } from './vector';

// Vector Types
export type Vector = number[];
export type TypedVector = Float32Array;

export interface VectorTemplate {
  title: string;
  description: string;
  dimension: number;
  vector: Vector;
}

export interface VectorTemplates {
  [key: string]: VectorTemplate;
}

// Search Types
export interface SearchResult {
  vector: Vector;
  similarity: number;
}

export interface SearchMetrics {
  totalSearches: number;
  averageResponseTime: number;
  errorRate: number;
  lastSearchTime: number | null;
}

// Performance Types
export interface PerformanceMetric {
  name: string;
  startTime: number;
  duration?: number;
  metadata?: Record<string, unknown>;
}

export interface PerformanceStats {
  min: number;
  max: number;
  avg: number;
  p95: number;
  count: number;
}

// Error Types
export interface ErrorInfo {
  name: string;
  message: string;
  stack?: string;
  componentStack?: string;
  timestamp: string;
}

// API Types
export interface SearchRequestBody {
  vector: Vector;
  maxResults?: number;
  filters?: {
    sources?: VectorSource[];
    models?: ModelType[];
    labels?: string[];
    dateRange?: {
      start: string;
      end: string;
    };
  };
}

export interface SearchResponseBody {
  results: EnhancedSearchResult[];
  error?: string;
  details?: string;
}

// Component Props Types
export interface VectorInputProps {
  onSearch: (vector: Vector) => void;
  isLoading: boolean;
}

export interface VectorVisualizationProps {
  queryVector: Vector;
  results: EnhancedSearchResult[];
}

export interface SearchResultsProps {
  results: EnhancedSearchResult[];
}

export interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

export interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

// Environment Types
export interface EnvVars {
  VECTOR_DIMENSION: number;
  MAX_SEARCH_RESULTS: number;
  HNSW_M: number;
  HNSW_EF_CONSTRUCTION: number;
  HNSW_EF_SEARCH: number;
}

// Logger Types
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  [key: string]: string | number | boolean | null | undefined;
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  context?: LogContext;
  timestamp: string;
}

// State Types
export interface SearchState {
  results: EnhancedSearchResult[];
  isLoading: boolean;
  error: string | null;
  queryVector: Vector | null;
}

export interface VisualizationState {
  dimensions: {
    x: number;
    y: number;
  };
  viewMode: '2d' | '3d';
  isPlotlyReady: boolean;
  error: string | null;
  containerWidth: number;
}

// Utility Types
export type PreprocessingMethod = 'none' | 'normalize' | 'standardize';
export type InputMethod = 'manual' | 'random' | 'file' | 'template';

// Configuration Types
export interface HNSWConfig {
  dimension: number;
  maxElements: number;
  M: number;
  efConstruction: number;
  efSearch: number;
  ml: number;
}

export interface PlotlyConfig {
  responsive: boolean;
  displayModeBar: boolean;
  modeBarButtonsToRemove: string[];
}

// Vector Conversion Utilities
export function toTypedVector(vector: Vector): TypedVector {
  return new Float32Array(vector);
}

export function fromTypedVector(vector: TypedVector): Vector {
  return Array.from(vector);
}
