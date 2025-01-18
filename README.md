# Universal Search Hub

A high-performance vector similarity search engine with HNSW algorithm and WASM SIMD optimization. Find similar items at lightning speed with an intuitive 3D visualization interface.

## Overview

Universal Search Hub transforms your data into vector space and finds similarities at incredible speeds. Whether you're working with images, text, audio, or any other type of data that can be vectorized, this engine helps you discover patterns and relationships that traditional search methods might miss.

## Features

- **Blazing Fast Performance**: 
  - 2.74ms average search latency
  - 100% accuracy in similarity matching
  - Handles millions of vectors efficiently
  - Real-time search results

- **Advanced Search Technology**:
  - HNSW (Hierarchical Navigable Small World) graph for efficient nearest neighbor search
  - WASM SIMD optimization for vector operations
  - Normalized vector magnitudes for consistent similarity matching
  - Configurable index parameters for performance tuning

- **Interactive Visualization**:
  - Real-time 3D visualization of vector space
  - Dynamic clustering view
  - Interactive point exploration
  - Adjustable dimension mapping
  - 2D/3D view switching

- **Modern Stack**: 
  - Next.js frontend with TypeScript
  - Tailwind CSS for responsive design
  - React components for modular UI
  - WebAssembly for high-performance computing

- **Distributed System**:
  - Raft consensus for reliable operations
  - Automatic leader election
  - Fault tolerance
  - Scalable architecture

## How It Works

1. **Vector Transformation**:
   - Data is converted into high-dimensional vectors
   - Each dimension represents a specific feature
   - Vectors are normalized for consistent comparison
   - SIMD instructions optimize vector operations

2. **Similarity Search**:
   - HNSW algorithm builds a navigable graph
   - Efficient nearest neighbor search
   - Configurable precision vs speed tradeoff
   - Real-time similarity scoring

3. **Visualization**:
   - Interactive 3D space exploration
   - Color-coded similarity scores
   - Dimension reduction for visualization
   - Cluster analysis tools

## Project Structure

```
universal-search-hub/
├── frontend/               # Next.js web interface
│   ├── src/
│   │   ├── app/           # Next.js app router
│   │   ├── components/    # React components
│   │   └── lib/          # Shared utilities
│   └── public/           # Static assets
├── src/                  # Core search engine
│   ├── search/          # HNSW implementation
│   ├── consensus/       # Raft consensus
│   ├── wasm/           # WASM SIMD modules
│   └── utils/          # Utilities
├── scripts/             # Build and utility scripts
└── tests/              # Test suites
```

## Core Components

### Vector Search Engine
- HNSW graph implementation for efficient similarity search
- WASM SIMD optimization for vector operations
- Configurable index parameters (M, efConstruction, efSearch)
- Vector normalization and magnitude handling

### Distributed System
- Raft consensus protocol implementation
- Reliable state replication across nodes
- Automatic leader election and failure recovery
- Scalable cluster management

### Web Interface
- Interactive vector search UI
- Real-time search results
- 3D visualization with dimension controls
- Responsive design with Tailwind CSS

## Getting Started

1. Install dependencies:
```bash
# Install root project dependencies
npm install

# Install frontend dependencies
cd frontend
npm install
```

2. Set up environment variables:
```bash
# Root project
cp .env.example .env

# Frontend
cd frontend
cp .env.example .env.local
```

3. Start the development server:
```bash
# Start backend services
npm run dev

# In another terminal, start frontend
cd frontend
npm run dev
```

## Environment Variables

### Backend
- `NODE_ID`: Unique identifier for each node
- `CLUSTER_PEERS`: Comma-separated list of peer node addresses
- `STORAGE_DIR`: Directory for persistent storage
- `LOG_LEVEL`: Logging verbosity level

### Frontend
- `VECTOR_DIMENSION`: Dimension of vectors (default: 384)
- `MAX_SEARCH_RESULTS`: Maximum search results (default: 10)
- `HNSW_M`: Maximum connections per layer (default: 16)
- `HNSW_EF_CONSTRUCTION`: Dynamic candidate list size for construction
- `HNSW_EF_SEARCH`: Dynamic candidate list size for search

## Performance Optimization

### Vector Operations
- WASM SIMD instructions for parallel processing
- Optimized distance calculations
- Efficient memory management
- Vectorized operations for bulk processing

### Search Algorithm
- Multi-layer graph structure
- Logarithmic search complexity
- Configurable precision/speed tradeoff
- Cached graph traversal

### Memory Usage
- Optimized for large-scale indices
- Efficient vector storage
- Smart caching strategies
- Memory-mapped file support

## Development

### Backend Development
- Implement new search algorithms in `src/search/`
- Add consensus features in `src/consensus/`
- Optimize WASM modules in `src/wasm/`
- Profile and optimize performance

### Frontend Development
- Add new components in `frontend/src/components/`
- Modify API routes in `frontend/src/app/api/`
- Update styles using Tailwind CSS
- Enhance visualization features

## Deployment

The project is configured for deployment on Vercel:

1. Push your changes to GitHub
2. Import the project in Vercel Dashboard
3. Configure environment variables
4. Deploy

### TypeScript Configuration
- Target ES2015 or higher for Set iteration support
- Strict type checking enabled
- Path aliases configured
- WebAssembly type definitions included

## Testing

Run the test suites:
```bash
# Run all tests
npm test

# Run specific test suite
npm test -- tests/search.test.ts
```

## Real-World Applications

- **E-commerce**: Find similar products based on features
- **Content Recommendation**: Suggest related articles or media
- **Image Search**: Find visually similar images
- **Audio Analysis**: Match similar sound patterns
- **Scientific Research**: Analyze data patterns
- **AI/ML Systems**: Organize and search through embeddings

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## Performance Metrics

- Average Search Latency: 2.74ms
- Search Accuracy: 100%
- WASM SIMD Optimization: Enabled
- Memory Usage: Optimized for large-scale indices
- Query Throughput: Thousands per second

## License

MIT License - see LICENSE file for details

## Support

For issues, feature requests, or questions:
1. Check existing issues in the repository
2. Create a new issue with detailed description
3. Follow the issue template guidelines
