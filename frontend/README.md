# Vector Search Frontend

A Next.js frontend for high-performance vector similarity search. Connects to the Universal Search Hub backend API with automatic fallback to local HNSW when the backend is unavailable.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Next.js Frontend                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  UI Components │  │  API Routes │  │  API Client        │  │
│  │  (React/TSX)   │  │  /api/*     │  │  lib/api-client.ts │  │
│  └───────┬───────┘  └──────┬──────┘  └──────────┬────────┘  │
│          │                 │                     │           │
│          └─────────────────┼─────────────────────┘           │
│                            │                                 │
│                    ┌───────▼───────┐                         │
│                    │ Backend Check │                         │
│                    └───────┬───────┘                         │
│                            │                                 │
│              ┌─────────────┴─────────────┐                   │
│              │                           │                   │
│       Backend Available?           Backend Down?             │
│              │                           │                   │
│              ▼                           ▼                   │
│     ┌────────────────┐          ┌────────────────┐           │
│     │ Proxy to       │          │ Local HNSW     │           │
│     │ localhost:3001 │          │ (Fallback)     │           │
│     └────────────────┘          └────────────────┘           │
└─────────────────────────────────────────────────────────────┘
```

## Features

- Multi-dimensional vector similarity search UI
- Support for dimensions: 384, 768, 1024, 1536, 2048
- Backend API integration with automatic fallback
- Real-time search results display
- Vector visualization components
- TypeScript with Tailwind CSS

## Getting Started

### With Backend (Recommended)

1. Start the backend API server (from project root):
```bash
npm run start:api
```

2. In another terminal, start the frontend:
```bash
cd frontend
npm install
npm run dev
```

3. Open http://localhost:3000

### Standalone Mode (No Backend)

The frontend works without the backend using local HNSW:

```bash
cd frontend
npm install
npm run dev
```

Note: In standalone mode, vectors are not persisted and search results use local in-memory HNSW graphs.

## Environment Variables

Create `.env.local` from the example:

```bash
cp .env.example .env.local
```

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_VECTOR_DIMENSION` | 384 | Default vector dimension |
| `NEXT_PUBLIC_API_URL` | http://localhost:3001 | Backend API URL |
| `MAX_SEARCH_RESULTS` | 20 | Maximum results returned |
| `HNSW_M` | 16 | HNSW connections per layer |
| `HNSW_EF_CONSTRUCTION` | 200 | HNSW construction candidate list size |
| `HNSW_EF_SEARCH` | 50 | HNSW search candidate list size |

## Supported Vector Dimensions

| Dimension | Common Use Cases |
|-----------|-----------------|
| 384 | Sentence-transformers (all-MiniLM-L6-v2) |
| 768 | BERT-base, CLIP text, Wav2Vec |
| 1024 | BERT-large |
| 1536 | OpenAI text-embedding-ada-002 |
| 2048 | ResNet image features |

## Project Structure

```
frontend/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── search/
│   │   │   │   └── route.ts      # Search endpoint (proxies to backend)
│   │   │   └── vectors/
│   │   │       ├── route.ts      # Bulk vector operations
│   │   │       ├── bulk/
│   │   │       │   └── route.ts  # Bulk insert endpoint
│   │   │       └── [id]/
│   │   │           └── route.ts  # Individual vector CRUD
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── VectorSearch.tsx      # Main search interface
│   │   ├── VectorInput.tsx       # Vector input component
│   │   ├── VectorVisualization.tsx
│   │   └── SearchResults.tsx
│   ├── hooks/
│   │   └── useVectorSearch.ts
│   ├── lib/
│   │   ├── api-client.ts         # Backend API client
│   │   └── search-service.ts     # Local search service
│   └── types/
│       ├── vector.ts
│       └── app.ts
├── public/
└── vercel.json
```

## API Routes

### Search
```
POST /api/search
Body: { vector: number[], dimension: number, k?: number }
```

### Vector Operations
```
GET    /api/vectors/:id?dimension=N    # Get vector by ID
POST   /api/vectors                    # Insert single vector
POST   /api/vectors/bulk               # Bulk insert vectors
DELETE /api/vectors/:id?dimension=N    # Delete vector
```

## Deployment

### Vercel (Frontend Only)

```bash
vercel login
vercel           # Preview
vercel --prod    # Production
```

Note: When deployed to Vercel without the backend, the frontend operates in standalone mode with local HNSW.

### Full Stack

For production with persistence, deploy both:
1. Backend API server (any Node.js host)
2. Frontend (Vercel, or same server)

Set `NEXT_PUBLIC_API_URL` to your backend URL.

## Development

### Prerequisites
- Node.js 18+
- npm or yarn

### Local Development
```bash
npm install
npm run dev
```

### Type Checking
```bash
npm run type-check
```

### Building
```bash
npm run build
```

## Performance Notes

- Search latency depends on dataset size and backend availability
- Backend mode: Sub-10ms typical for <100k vectors
- Standalone mode: Performance varies, no persistence
- WASM SIMD acceleration available when backend is running

## Troubleshooting

### "Backend unavailable" in console
The backend API server isn't running. Start it with `npm run start:api` from the project root, or continue in standalone mode.

### TypeScript Set iteration errors
Ensure `tsconfig.json` has `"target": "es2015"` or higher.

### CORS errors
The backend is configured for localhost. For other origins, update CORS settings in `src/server.ts`.
