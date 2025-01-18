export interface SearchResult {
  vector: number[];
  similarity: number;
}

export interface SearchMetrics {
  totalSearches: number;
  averageResponseTime: number;
  errorRate: number;
  lastSearchTime: number | null;
}
