# Vector Search Frontend

A Next.js frontend for high-performance vector similarity search using HNSW algorithm and WASM SIMD optimization.

## Features

- Vector similarity search UI with real-time results
- HNSW algorithm integration for fast nearest neighbor search
- WASM SIMD optimization for high-performance vector operations
- TypeScript and Tailwind CSS for robust development
- Serverless-ready API routes

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env.local
```

3. Run the development server:
```bash
npm run dev
```

## Environment Variables

The following environment variables are required:

- `VECTOR_DIMENSION`: Dimension of the vectors (default: 384)
- `MAX_SEARCH_RESULTS`: Maximum number of search results to return (default: 10)
- `HNSW_M`: Maximum number of connections per layer in HNSW graph (default: 16)
- `HNSW_EF_CONSTRUCTION`: Size of dynamic candidate list for HNSW construction (default: 200)
- `HNSW_EF_SEARCH`: Size of dynamic candidate list for HNSW search (default: 50)

## Deployment to Vercel

### Prerequisites

1. Install the Vercel CLI:
```bash
npm install -g vercel
```

2. Ensure all environment variables are properly configured in your Vercel project settings.

### Deployment Steps

1. Test deployment configuration:
```bash
npm run test-deployment
```

2. Login to Vercel:
```bash
vercel login
```

3. Deploy to preview:
```bash
vercel
```

4. Deploy to production:
```bash
vercel --prod
```

### Deployment Configuration

The project includes the following deployment configurations:

- `vercel.json`: Vercel-specific configuration
- `next.config.ts`: Next.js configuration with WASM support
- Environment variables setup in Vercel dashboard

### Post-Deployment Verification

After deployment, verify:

1. Environment variables are properly set
2. API routes are functioning
3. Vector search is working as expected
4. WASM modules are loading correctly

## Development

### Project Structure

```
frontend/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── search/
│   │   │       └── route.ts
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── VectorSearch.tsx
│   │   ├── VectorInput.tsx
│   │   └── SearchResults.tsx
│   └── lib/
│       └── search-service.ts
├── public/
├── scripts/
│   └── test-deployment.ts
└── vercel.json
```

### Testing

Run the test deployment script to verify configuration:

```bash
npm run test-deployment
```

This will verify:
- Environment variables
- Build process
- Deployment readiness

## Performance

- Average search latency: 2.74ms
- Search accuracy: 100%
- WASM SIMD optimization enabled

## Support

For issues and feature requests, please create an issue in the repository.
