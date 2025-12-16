# Universal Search Hub

A working vector similarity search engine with HNSW (Hierarchical Navigable Small World) graph algorithm, WebAssembly SIMD acceleration, and SQLite persistence.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14.0-black.svg)](https://nextjs.org/)
[![WASM](https://img.shields.io/badge/WebAssembly-SIMD-orange.svg)](https://webassembly.org/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

## What This Actually Does

- **HNSW Vector Search**: Real implementation of the HNSW algorithm for approximate nearest neighbor search
- **SIMD Acceleration**: WebAssembly SIMD operations for fast vector distance calculations
- **REST API**: HTTP server with endpoints for search, insert, and management
- **SQLite Persistence**: Vectors survive server restarts
- **Next.js Frontend**: Interactive UI for search, visualization, and benchmarking
- **Multi-Dimension Support**: 384, 768, 1024, 1536, 2048 dimensional vectors

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Next.js Frontend                        │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────┐ │
│  │ VectorSearch│  │ Visualization │  │    Benchmark UI    │ │
│  └──────┬──────┘  └──────┬───────┘  └──────────┬──────────┘ │
└─────────┼────────────────┼─────────────────────┼────────────┘
          │                │                     │
          ▼                ▼                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    Frontend API Routes                      │
│         /api/search  /api/vectors  /api/vectors/bulk        │
└─────────────────────────────┬───────────────────────────────┘
                              │ (HTTP)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Backend API Server                       │
│                    (http://localhost:3001)                  │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌──────────────────┐                 │
│  │   HNSW Graphs    │  │  Vector Store    │                 │
│  │  (per dimension) │  │   (metadata)     │                 │
│  └────────┬─────────┘  └────────┬─────────┘                 │
│           │                     │                           │
│           └──────────┬──────────┘                           │
│                      ▼                                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              WASM SIMD Operations                    │   │
│  │    euclideanDistance() cosineSimilarity() normalize()│   │
│  └──────────────────────────────────────────────────────┘   │
│                      │                                      │
│                      ▼                                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │            SQLite Persistence                        │   │
│  │              (data/vectors.db)                       │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites
- Node.js 18+
- npm 9+

### 1. Install Dependencies

```bash
# Backend
npm install

# Frontend
cd frontend && npm install && cd ..
```

### 2. Start the Backend API Server

```bash
npm run start:api
```

This will:
- Compile the WASM SIMD module
- Initialize HNSW graphs for all dimensions
- Start the REST API on http://localhost:3001
- Load any persisted vectors from SQLite

### 3. Seed Sample Data (Optional)

In another terminal:

```bash
npm run seed
```

This populates the database with sample semantic embeddings across categories (technology, science, business, arts, health).

### 4. Start the Frontend

```bash
cd frontend && npm run dev
```

Access the UI at http://localhost:3000

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/search` | POST | Search for similar vectors |
| `/api/vectors` | POST | Insert a single vector |
| `/api/vectors/bulk` | POST | Bulk insert vectors |
| `/api/vectors/:id/dim/:dim` | GET | Get vector by ID and dimension |
| `/api/vectors/:id/dim/:dim` | DELETE | Delete a vector |
| `/health` | GET | Health check |
| `/metrics` | GET | Server metrics |

### Example: Search

```bash
curl -X POST http://localhost:3001/api/search \
  -H "Content-Type: application/json" \
  -d '{"vector": [0.1, 0.2, ...], "k": 10}'
```

### Example: Insert

```bash
curl -X POST http://localhost:3001/api/vectors \
  -H "Content-Type: application/json" \
  -d '{
    "vector": [0.1, 0.2, ...],
    "metadata": {"source": "text", "content": "Example document"}
  }'
```

## Configuration

### Environment Variables

```env
# Backend
API_PORT=3001
API_HOST=0.0.0.0
HNSW_M=16                  # Max connections per layer
HNSW_EF_CONSTRUCTION=200   # Construction search depth
HNSW_EF_SEARCH=50          # Query search depth

# Frontend
NEXT_PUBLIC_MAX_SEARCH_RESULTS=20
BACKEND_API_URL=http://localhost:3001
```

## Performance

Run the benchmark to get actual performance metrics:

```bash
# Start the API server first
npm run start:api

# In another terminal
npm run benchmark:api
```

The benchmark tests:
- Insert latency across dimensions
- Search latency across dimensions
- Throughput (operations/second)
- P50, P95, P99 latencies

## Project Structure

```
universal-search-hub/
├── src/
│   ├── server.ts           # HTTP API server
│   ├── search/
│   │   ├── hnsw.ts         # HNSW graph implementation
│   │   └── vector.ts       # Vector operations + WASM integration
│   ├── storage/
│   │   └── vector-store.ts # SQLite persistence
│   ├── wasm/
│   │   └── vector_simd.wat # WebAssembly SIMD operations
│   └── consensus/          # Raft implementation (future distributed mode)
├── frontend/
│   └── src/
│       ├── app/            # Next.js pages
│       ├── components/     # React components
│       └── lib/            # API client, utilities
├── scripts/
│   ├── build-wasm.js       # WASM compilation
│   ├── seed-vectors.ts     # Sample data seeder
│   └── benchmark-api.ts    # Performance benchmarks
└── data/
    └── vectors.db          # SQLite database (created on first run)
```

## What's Included vs Future Work

### Working Now
- HNSW algorithm with configurable parameters
- WASM SIMD for vector operations (euclidean, cosine, normalize)
- REST API for CRUD operations
- SQLite persistence
- Frontend with search, visualization, and benchmarks
- Automatic fallback to local search if backend unavailable

### Future/Experimental
- Raft consensus for distributed deployment (code exists, not wired to API)
- Multi-node clustering
- Production deployment configurations

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run start:api` | Start the backend API server |
| `npm run start:api:dev` | Start with hot reload |
| `npm run seed` | Populate database with sample vectors |
| `npm run benchmark:api` | Run performance benchmarks |
| `npm run build:wasm` | Compile WASM module |
| `npm run build` | Build TypeScript |

## License

MIT License - see [LICENSE](LICENSE) for details.
