/**
 * HTTP API Server for Universal Search Hub
 * Provides REST endpoints for vector search operations
 */

import * as http from 'http';
import { URL } from 'url';
import { HNSWGraph } from './search/hnsw';
import { initSIMD, vectorMetrics } from './search/vector';
import { HNSWConfig, Vector, SystemError } from './types';
import { searchLogger } from './utils/logger';

// Server configuration
const PORT = parseInt(process.env['API_PORT'] || '3001', 10);
const HOST = process.env['API_HOST'] || '0.0.0.0';

// CORS headers for frontend access
const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
};

// Supported vector dimensions
const SUPPORTED_DIMENSIONS = [384, 768, 1024, 1536, 2048];

// HNSW graphs for each dimension
const graphs = new Map<number, HNSWGraph>();
const vectorStore = new Map<number, Map<number, { vector: Vector; metadata: Record<string, unknown> }>>();

// Server metrics
const serverMetrics = {
    startTime: Date.now(),
    requestCount: 0,
    searchCount: 0,
    insertCount: 0,
    errorCount: 0,
    totalSearchTime: 0,
    totalInsertTime: 0
};

/**
 * Initialize HNSW graphs for all supported dimensions
 */
async function initializeGraphs(): Promise<void> {
    // Try to initialize SIMD (will fallback gracefully if unavailable)
    try {
        await initSIMD();
        searchLogger.info('SIMD acceleration enabled');
    } catch (error) {
        searchLogger.warn('SIMD initialization failed, using JavaScript fallback');
    }

    for (const dimension of SUPPORTED_DIMENSIONS) {
        const config: HNSWConfig = {
            dimension,
            maxElements: 100000,
            M: parseInt(process.env['HNSW_M'] || '16', 10),
            efConstruction: parseInt(process.env['HNSW_EF_CONSTRUCTION'] || '200', 10),
            efSearch: parseInt(process.env['HNSW_EF_SEARCH'] || '50', 10),
            ml: 1 / Math.log(2)
        };

        graphs.set(dimension, new HNSWGraph(config));
        vectorStore.set(dimension, new Map());
        searchLogger.info({ dimension }, 'Initialized HNSW graph');
    }
}

/**
 * Parse JSON request body
 */
async function parseBody<T>(req: http.IncomingMessage): Promise<T> {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try {
                resolve(body ? JSON.parse(body) : {} as T);
            } catch (error) {
                reject(new Error('Invalid JSON in request body'));
            }
        });
        req.on('error', reject);
    });
}

/**
 * Send JSON response
 */
function sendResponse(
    res: http.ServerResponse,
    status: number,
    data: unknown
): void {
    res.writeHead(status, CORS_HEADERS);
    res.end(JSON.stringify(data));
}

/**
 * Send error response
 */
function sendError(
    res: http.ServerResponse,
    status: number,
    message: string,
    details?: unknown
): void {
    serverMetrics.errorCount++;
    sendResponse(res, status, { error: message, details });
}

/**
 * Handle search request
 */
async function handleSearch(
    req: http.IncomingMessage,
    res: http.ServerResponse
): Promise<void> {
    const startTime = performance.now();

    try {
        const body = await parseBody<{
            vector: number[];
            k?: number;
            filters?: Record<string, unknown>;
        }>(req);

        if (!body.vector || !Array.isArray(body.vector)) {
            return sendError(res, 400, 'Missing or invalid vector');
        }

        const dimension = body.vector.length;
        const graph = graphs.get(dimension);
        const store = vectorStore.get(dimension);

        if (!graph || !store) {
            return sendError(res, 400, `Unsupported dimension: ${dimension}. Supported: ${SUPPORTED_DIMENSIONS.join(', ')}`);
        }

        const k = Math.min(body.k || 10, 100);
        const queryVector = new Float32Array(body.vector);

        const searchStart = performance.now();
        const results = graph.search(queryVector, k);
        const searchTime = performance.now() - searchStart;

        // Enhance results with metadata
        const enhancedResults = results.map(result => {
            const stored = store.get(result.id);
            return {
                id: result.id,
                distance: result.distance,
                similarity: 1 / (1 + result.distance),
                metadata: stored?.metadata || {}
            };
        });

        serverMetrics.searchCount++;
        serverMetrics.totalSearchTime += searchTime;

        const totalTime = performance.now() - startTime;

        sendResponse(res, 200, {
            results: enhancedResults,
            stats: {
                searchTime: searchTime.toFixed(2) + 'ms',
                totalTime: totalTime.toFixed(2) + 'ms',
                dimension,
                k,
                resultsCount: enhancedResults.length
            }
        });

    } catch (error) {
        searchLogger.error({ error }, 'Search failed');
        sendError(res, 500, 'Search failed', error instanceof Error ? error.message : String(error));
    }
}

/**
 * Handle insert request
 */
async function handleInsert(
    req: http.IncomingMessage,
    res: http.ServerResponse
): Promise<void> {
    const startTime = performance.now();

    try {
        const body = await parseBody<{
            vector: number[];
            id?: number;
            metadata?: Record<string, unknown>;
        }>(req);

        if (!body.vector || !Array.isArray(body.vector)) {
            return sendError(res, 400, 'Missing or invalid vector');
        }

        const dimension = body.vector.length;
        const graph = graphs.get(dimension);
        const store = vectorStore.get(dimension);

        if (!graph || !store) {
            return sendError(res, 400, `Unsupported dimension: ${dimension}. Supported: ${SUPPORTED_DIMENSIONS.join(', ')}`);
        }

        const insertVector = new Float32Array(body.vector);
        const insertStart = performance.now();
        const id = graph.insert(insertVector, body.id);
        const insertTime = performance.now() - insertStart;

        // Store metadata
        store.set(id, {
            vector: insertVector,
            metadata: body.metadata || {}
        });

        serverMetrics.insertCount++;
        serverMetrics.totalInsertTime += insertTime;

        const totalTime = performance.now() - startTime;

        sendResponse(res, 201, {
            id,
            dimension,
            stats: {
                insertTime: insertTime.toFixed(2) + 'ms',
                totalTime: totalTime.toFixed(2) + 'ms'
            }
        });

    } catch (error) {
        searchLogger.error({ error }, 'Insert failed');
        if (error instanceof SystemError && error.code === 'DUPLICATE_ID') {
            sendError(res, 409, 'Vector with this ID already exists');
        } else {
            sendError(res, 500, 'Insert failed', error instanceof Error ? error.message : String(error));
        }
    }
}

/**
 * Handle bulk insert request
 */
async function handleBulkInsert(
    req: http.IncomingMessage,
    res: http.ServerResponse
): Promise<void> {
    const startTime = performance.now();

    try {
        const body = await parseBody<{
            vectors: Array<{
                vector: number[];
                id?: number;
                metadata?: Record<string, unknown>;
            }>;
        }>(req);

        if (!body.vectors || !Array.isArray(body.vectors) || body.vectors.length === 0) {
            return sendError(res, 400, 'Missing or invalid vectors array');
        }

        const results: Array<{ id: number; success: boolean; error?: string }> = [];
        let successCount = 0;
        let failCount = 0;

        for (const item of body.vectors) {
            try {
                const dimension = item.vector.length;
                const graph = graphs.get(dimension);
                const store = vectorStore.get(dimension);

                if (!graph || !store) {
                    results.push({ id: item.id || -1, success: false, error: `Unsupported dimension: ${dimension}` });
                    failCount++;
                    continue;
                }

                const insertVector = new Float32Array(item.vector);
                const id = graph.insert(insertVector, item.id);
                store.set(id, {
                    vector: insertVector,
                    metadata: item.metadata || {}
                });

                results.push({ id, success: true });
                successCount++;
                serverMetrics.insertCount++;
            } catch (error) {
                results.push({
                    id: item.id || -1,
                    success: false,
                    error: error instanceof Error ? error.message : String(error)
                });
                failCount++;
            }
        }

        const totalTime = performance.now() - startTime;

        sendResponse(res, 200, {
            results,
            stats: {
                totalTime: totalTime.toFixed(2) + 'ms',
                successCount,
                failCount,
                totalCount: body.vectors.length
            }
        });

    } catch (error) {
        searchLogger.error({ error }, 'Bulk insert failed');
        sendError(res, 500, 'Bulk insert failed', error instanceof Error ? error.message : String(error));
    }
}

/**
 * Handle delete request
 */
async function handleDelete(
    _req: http.IncomingMessage,
    res: http.ServerResponse,
    id: number,
    dimension: number
): Promise<void> {
    try {
        const graph = graphs.get(dimension);
        const store = vectorStore.get(dimension);

        if (!graph || !store) {
            return sendError(res, 400, `Unsupported dimension: ${dimension}`);
        }

        graph.delete(id);
        store.delete(id);

        sendResponse(res, 200, { success: true, id });

    } catch (error) {
        if (error instanceof SystemError && error.code === 'NODE_NOT_FOUND') {
            sendError(res, 404, 'Vector not found');
        } else {
            sendError(res, 500, 'Delete failed', error instanceof Error ? error.message : String(error));
        }
    }
}

/**
 * Handle get vector request
 */
async function handleGetVector(
    res: http.ServerResponse,
    id: number,
    dimension: number
): Promise<void> {
    try {
        const store = vectorStore.get(dimension);

        if (!store) {
            return sendError(res, 400, `Unsupported dimension: ${dimension}`);
        }

        const stored = store.get(id);
        if (!stored) {
            return sendError(res, 404, 'Vector not found');
        }

        sendResponse(res, 200, {
            id,
            dimension,
            vector: Array.from(stored.vector),
            metadata: stored.metadata
        });

    } catch (error) {
        sendError(res, 500, 'Failed to get vector', error instanceof Error ? error.message : String(error));
    }
}

/**
 * Handle metrics request
 */
function handleMetrics(res: http.ServerResponse): void {
    const uptime = (Date.now() - serverMetrics.startTime) / 1000;
    const avgSearchTime = serverMetrics.searchCount > 0
        ? serverMetrics.totalSearchTime / serverMetrics.searchCount
        : 0;
    const avgInsertTime = serverMetrics.insertCount > 0
        ? serverMetrics.totalInsertTime / serverMetrics.insertCount
        : 0;

    const graphStats: Record<string, unknown> = {};
    for (const [dimension, graph] of graphs) {
        graphStats[`dim_${dimension}`] = graph.getStats();
    }

    sendResponse(res, 200, {
        server: {
            uptime: uptime.toFixed(2) + 's',
            requestCount: serverMetrics.requestCount,
            searchCount: serverMetrics.searchCount,
            insertCount: serverMetrics.insertCount,
            errorCount: serverMetrics.errorCount
        },
        performance: {
            avgSearchTime: avgSearchTime.toFixed(2) + 'ms',
            avgInsertTime: avgInsertTime.toFixed(2) + 'ms',
            vectorOps: vectorMetrics.getMetrics()
        },
        graphs: graphStats,
        supportedDimensions: SUPPORTED_DIMENSIONS
    });
}

/**
 * Handle health check
 */
function handleHealth(res: http.ServerResponse): void {
    sendResponse(res, 200, {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: ((Date.now() - serverMetrics.startTime) / 1000).toFixed(2) + 's'
    });
}

/**
 * Main request handler
 */
async function handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse
): Promise<void> {
    serverMetrics.requestCount++;

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(204, CORS_HEADERS);
        res.end();
        return;
    }

    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const path = url.pathname;

    searchLogger.debug({ method: req.method, path }, 'Request received');

    try {
        // Health check
        if (path === '/health' && req.method === 'GET') {
            return handleHealth(res);
        }

        // Metrics
        if (path === '/metrics' && req.method === 'GET') {
            return handleMetrics(res);
        }

        // Search
        if (path === '/api/search' && req.method === 'POST') {
            return await handleSearch(req, res);
        }

        // Insert
        if (path === '/api/vectors' && req.method === 'POST') {
            return await handleInsert(req, res);
        }

        // Bulk insert
        if (path === '/api/vectors/bulk' && req.method === 'POST') {
            return await handleBulkInsert(req, res);
        }

        // Vector operations by ID
        const vectorMatch = path.match(/^\/api\/vectors\/(\d+)\/dim\/(\d+)$/);
        if (vectorMatch) {
            const id = parseInt(vectorMatch[1], 10);
            const dimension = parseInt(vectorMatch[2], 10);

            if (req.method === 'GET') {
                return await handleGetVector(res, id, dimension);
            }
            if (req.method === 'DELETE') {
                return await handleDelete(req, res, id, dimension);
            }
        }

        // 404 for unknown routes
        sendError(res, 404, 'Not found');

    } catch (error) {
        searchLogger.error({ error }, 'Request handler error');
        sendError(res, 500, 'Internal server error');
    }
}

/**
 * Start the server
 */
async function startServer(): Promise<void> {
    searchLogger.info('Initializing Universal Search Hub API Server...');

    await initializeGraphs();

    const server = http.createServer(handleRequest);

    server.listen(PORT, HOST, () => {
        searchLogger.info({ host: HOST, port: PORT }, 'Server started');
        console.log(`\n🚀 Universal Search Hub API Server`);
        console.log(`   Running on http://${HOST}:${PORT}`);
        console.log(`   Supported dimensions: ${SUPPORTED_DIMENSIONS.join(', ')}`);
        console.log(`\n📚 API Endpoints:`);
        console.log(`   POST /api/search          - Search for similar vectors`);
        console.log(`   POST /api/vectors         - Insert a vector`);
        console.log(`   POST /api/vectors/bulk    - Bulk insert vectors`);
        console.log(`   GET  /api/vectors/:id/dim/:dim - Get vector by ID`);
        console.log(`   DELETE /api/vectors/:id/dim/:dim - Delete vector`);
        console.log(`   GET  /health              - Health check`);
        console.log(`   GET  /metrics             - Server metrics\n`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
        searchLogger.info('Received SIGTERM, shutting down...');
        server.close(() => {
            searchLogger.info('Server closed');
            process.exit(0);
        });
    });

    process.on('SIGINT', () => {
        searchLogger.info('Received SIGINT, shutting down...');
        server.close(() => {
            searchLogger.info('Server closed');
            process.exit(0);
        });
    });
}

// Start the server
startServer().catch(error => {
    searchLogger.error({ error }, 'Failed to start server');
    process.exit(1);
});
