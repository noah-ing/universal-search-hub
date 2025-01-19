# Universal Search Hub

High-performance vector similarity search engine leveraging HNSW (Hierarchical Navigable Small World) graph algorithms and WebAssembly SIMD optimizations. Built for efficient vector search operations with rich visualization capabilities.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14.0-black.svg)](https://nextjs.org/)
[![WASM](https://img.shields.io/badge/WebAssembly-SIMD-orange.svg)](https://webassembly.org/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

## Features

### High-Performance Vector Search
- **Fast Query Performance**: Average search latency of 2.74ms
- **SIMD Acceleration**: WebAssembly SIMD optimizations for parallel vector operations
- **Efficient Memory Management**: Optimized memory usage with configurable index parameters
- **Distributed Architecture**: Raft consensus for reliable operations

### Advanced Vector Processing
- **Comprehensive Dimension Support**: 
  - Default vectors (384 dimensions)
  - CLIP embeddings (768 dimensions)
  - BERT-large embeddings (1024 dimensions)
  - OpenAI text-embedding-ada-002 (1536 dimensions)
  - ResNet features (2048 dimensions)
  - Dynamic dimension handling
- **Preprocessing Options**: Vector normalization and standardization
- **Multiple Input Methods**: File upload, templates, manual input, random generation
- **Automatic Dimension Detection**: Seamless handling of different vector dimensions

### Visualization & Analysis
- **Interactive 3D Visualization**: Real-time vector space exploration
- **Vector Comparison**:
  - Side-by-side visualization
  - Cosine similarity metrics
  - Euclidean distance calculation
  - Component-wise comparison
  - Top contributing dimensions
- **Performance Benchmarking**: 
  - Search performance across dimensions
  - Memory usage patterns
  - Index build times
  - Query latency distributions

## System Architecture

### Core Components
```
universal-search-hub/
├── src/
│   ├── search/           # Core search engine
│   │   ├── hnsw.ts      # HNSW implementation
│   │   └── vector.ts    # Vector operations
│   ├── consensus/        # Distributed consensus
│   │   ├── raft.ts      # Raft protocol implementation
│   │   └── network.ts   # Network communication
│   └── wasm/            # WASM modules
│       └── vector_simd.wat  # SIMD optimizations
├── frontend/
│   ├── src/
│   │   ├── app/         # Next.js application
│   │   ├── components/  # React components
│   │   ├── lib/        # Shared utilities
│   │   └── types/      # TypeScript definitions
└── scripts/             # Build & deployment
```

### Technology Stack
- **Frontend**: Next.js 14, TypeScript, Tailwind CSS
- **Visualization**: Plotly
- **Core Engine**: WebAssembly, HNSW
- **State Management**: React Context + Custom Hooks
- **Build System**: Next.js + SWC

## Performance Metrics

### Search Performance
- Query Latency: 2.74ms average
- Accuracy: 100% for exact nearest neighbor search
- Configurable precision/speed tradeoff

### Memory Usage
- Efficient vector storage
- Configurable index parameters
- Smart caching strategies

## Getting Started

### Prerequisites
- Node.js 18+
- npm 9+

### Development Setup
```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
cp frontend/.env.example frontend/.env.local

# Start development servers
npm run dev          # Backend
cd frontend && npm run dev  # Frontend
```

### Environment Variables

#### Backend
```env
NODE_ID=node1
CLUSTER_PEERS=localhost:3001,localhost:3002
STORAGE_DIR=./data
LOG_LEVEL=info
```

#### Frontend
```env
# Default dimension (can be overridden at runtime)
NEXT_PUBLIC_VECTOR_DIMENSION=384
MAX_SEARCH_RESULTS=20

# HNSW Parameters
HNSW_M=16
HNSW_EF_CONSTRUCTION=200
HNSW_EF_SEARCH=50
```

## Usage

### Vector Search
1. Access the main interface at `http://localhost:3000`
2. Choose input method:
   - Upload vector file (JSON, CSV)
   - Use predefined templates
   - Manual vector input
   - Random vector generation
3. Select vector dimension:
   - 384 (Default)
   - 768 (CLIP/BERT-base)
   - 1024 (BERT-large)
   - 1536 (OpenAI Ada)
   - 2048 (ResNet)
4. View search results with:
   - Similarity scores
   - 3D visualization
   - Metadata display
   - Vector preview

### Vector Comparison
1. Click any search result to access detailed comparison
2. View at `http://localhost:3000/vector/[id]/compare?query=[queryId]`
3. Compare:
   - Side-by-side visualizations
   - Similarity metrics
   - Component contributions
   - Metadata differences

### Performance Benchmarking
1. Access benchmark interface at `http://localhost:3000/benchmark`
2. Configure test parameters:
   - Vector dimensions
   - Dataset sizes
   - Iteration counts
3. View results:
   - Performance graphs
   - Memory usage charts
   - Response time distributions
   - Detailed metrics table

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT License - see [LICENSE](LICENSE) for details.

## Support

For issues and feature requests:
1. Check existing issues in the repository
2. Create a new issue with detailed description
3. Follow the issue template guidelines
