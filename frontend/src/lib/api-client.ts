/**
 * API Client for communicating with the Universal Search Hub backend
 */

// Backend API URL - configurable via environment variable
const API_BASE_URL = process.env['BACKEND_API_URL'] || 'http://localhost:3001';

export interface SearchRequest {
    vector: number[];
    k?: number;
    filters?: Record<string, unknown>;
}

export interface SearchResultItem {
    id: number;
    distance: number;
    similarity: number;
    metadata: Record<string, unknown>;
}

export interface SearchResponse {
    results: SearchResultItem[];
    stats: {
        searchTime: string;
        totalTime: string;
        dimension: number;
        k: number;
        resultsCount: number;
    };
}

export interface InsertRequest {
    vector: number[];
    id?: number;
    metadata?: Record<string, unknown>;
}

export interface InsertResponse {
    id: number;
    dimension: number;
    stats: {
        insertTime: string;
        totalTime: string;
    };
}

export interface BulkInsertRequest {
    vectors: InsertRequest[];
}

export interface BulkInsertResponse {
    results: Array<{ id: number; success: boolean; error?: string }>;
    stats: {
        totalTime: string;
        successCount: number;
        failCount: number;
        totalCount: number;
    };
}

export interface MetricsResponse {
    server: {
        uptime: string;
        requestCount: number;
        searchCount: number;
        insertCount: number;
        errorCount: number;
    };
    performance: {
        avgSearchTime: string;
        avgInsertTime: string;
        vectorOps: {
            avg: number;
            max: number;
            min: number;
            count: number;
        };
    };
    graphs: Record<string, {
        nodeCount: number;
        maxLevel: number;
        averageConnections: number;
        memoryUsage: number;
    }>;
    supportedDimensions: number[];
}

export interface HealthResponse {
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: string;
    uptime: string;
}

class ApiClient {
    private baseUrl: string;

    constructor(baseUrl: string = API_BASE_URL) {
        this.baseUrl = baseUrl;
    }

    private async fetch<T>(
        path: string,
        options: RequestInit = {}
    ): Promise<T> {
        const url = `${this.baseUrl}${path}`;
        const response = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
        }

        return response.json();
    }

    /**
     * Search for similar vectors
     */
    async search(request: SearchRequest): Promise<SearchResponse> {
        return this.fetch<SearchResponse>('/api/search', {
            method: 'POST',
            body: JSON.stringify(request),
        });
    }

    /**
     * Insert a vector
     */
    async insert(request: InsertRequest): Promise<InsertResponse> {
        return this.fetch<InsertResponse>('/api/vectors', {
            method: 'POST',
            body: JSON.stringify(request),
        });
    }

    /**
     * Bulk insert vectors
     */
    async bulkInsert(request: BulkInsertRequest): Promise<BulkInsertResponse> {
        return this.fetch<BulkInsertResponse>('/api/vectors/bulk', {
            method: 'POST',
            body: JSON.stringify(request),
        });
    }

    /**
     * Get a vector by ID
     */
    async getVector(id: number, dimension: number): Promise<{
        id: number;
        dimension: number;
        vector: number[];
        metadata: Record<string, unknown>;
    }> {
        return this.fetch(`/api/vectors/${id}/dim/${dimension}`);
    }

    /**
     * Delete a vector
     */
    async deleteVector(id: number, dimension: number): Promise<{ success: boolean; id: number }> {
        return this.fetch(`/api/vectors/${id}/dim/${dimension}`, {
            method: 'DELETE',
        });
    }

    /**
     * Get server metrics
     */
    async getMetrics(): Promise<MetricsResponse> {
        return this.fetch<MetricsResponse>('/metrics');
    }

    /**
     * Health check
     */
    async healthCheck(): Promise<HealthResponse> {
        return this.fetch<HealthResponse>('/health');
    }

    /**
     * Check if backend is available
     */
    async isAvailable(): Promise<boolean> {
        try {
            await this.healthCheck();
            return true;
        } catch {
            return false;
        }
    }
}

// Export singleton instance
export const apiClient = new ApiClient();

// Export class for custom instances
export { ApiClient };
