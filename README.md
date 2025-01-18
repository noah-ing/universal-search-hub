# Universal Search Hub

A distributed vector similarity search system with WASM SIMD optimization, Raft consensus, and a modern Next.js UI.

## Features

- High-performance vector similarity search using HNSW algorithm
- WASM SIMD optimization with automatic JS fallback
- Modern Next.js frontend interface for vector search
- Distributed consensus using Raft protocol
- Automatic log compaction and snapshots
- Dynamic cluster membership changes
- File-based persistence with in-memory operations
- Comprehensive error handling and recovery
- Perfect search accuracy in benchmark tests

## Performance Highlights

- Vector Operations: ~2.8M ops/sec with SIMD
- Search Latency: ~2.74ms average
- Memory Efficiency: ~0.5KB per vector
- Search Accuracy: 100% exact matches in tests

## Use Cases

### AI/ML Engineers
- Find similar embeddings for machine learning models
- Test and validate embedding similarity for semantic search
- Optimize recommendation systems
- Work with BERT/GPT text embeddings (384-dimensional vectors)

### Data Scientists
- Analyze high-dimensional data patterns
- Discover relationships in complex datasets
- Validate clustering algorithms
- Process image feature vectors from models like ResNet (512-dimensional vectors)

### Application Developers
- Build semantic search features
- Implement content recommendation systems
- Create similarity matching functionality
- Handle user behavior vectors (128-dimensional vectors)

## Prerequisites

- Node.js >= 16.0.0
- Git
- Emscripten (optional, for WASM SIMD optimization)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/noah-ing/universal-search-hub.git
cd universal-search-hub
```

2. Install dependencies:
```bash
npm install
cd frontend && npm install
```

3. Build the project:
```bash
npm run build
```
This will automatically run the WASM build as part of the prebuild script. If Emscripten is not available, the system will automatically use the JS implementation.

## Configuration

Create a `.env` file in the project root (see `.env.example` for all options):
```env
# Node Environment
NODE_ENV=development

# Server Configuration
PORT=3000
HOST=localhost

# Cluster Configuration
CLUSTER_NODES=localhost:3000,localhost:3001,localhost:3002
NODE_ID=node0

# HNSW Configuration
HNSW_DIMENSION=128
HNSW_MAX_ELEMENTS=1000000
HNSW_M=24                  # Optimized for better connectivity
HNSW_EF_CONSTRUCTION=400   # Increased for better graph quality
HNSW_EF_SEARCH=200        # Increased for better search accuracy
HNSW_ML=1.0

# Raft Configuration
RAFT_HEARTBEAT_TIMEOUT=50
RAFT_ELECTION_TIMEOUT_MIN=150
RAFT_ELECTION_TIMEOUT_MAX=300
RAFT_BATCH_SIZE=100

# Logging Configuration
LOG_LEVEL=info
LOG_FORMAT=pretty
```

## Running the System

### Development Mode

Start the backend:
```bash
npm run start:dev
```

Start the frontend:
```bash
cd frontend && npm run dev
```

Start a local cluster for development:
```bash
npm run start:cluster
```

### Production Mode

Start a node:
```bash
npm run start
```

### Examples

Run basic usage example:
```bash
npm run example
```

Run cluster example:
```bash
npm run example:cluster
```

## Testing

```bash
# Run all tests (includes WASM validation)
npm test

# Run tests in watch mode
npm run test:watch

# Run integration tests
npm run test:integration

# Run tests with coverage
npm run test:coverage
```

## Benchmarking

Run single-node benchmark:
```bash
npm run benchmark
```

Run cluster benchmark:
```bash
npm run benchmark:cluster
```

## Development

### Available Scripts

- `npm run build` - Build the project (includes WASM)
- `npm run build:wasm` - Build only the WASM module
- `npm run test:wasm` - Test WASM SIMD implementation
- `npm run validate` - Build and test WASM
- `npm run clean` - Clean build artifacts
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues
- `npm run format` - Format code with Prettier
- `npm run docs` - Generate TypeDoc documentation

### Code Quality

The project uses:
- TypeScript for type safety
- ESLint for code linting
- Prettier for code formatting
- Jest for testing
- Husky for git hooks
- Conventional commits

## Project Structure

```
.
├── frontend/         # Next.js frontend application
│   ├── src/
│   │   ├── app/     # Next.js app router
│   │   └── components/ # React components
├── src/
│   ├── consensus/     # Raft consensus implementation
│   │   ├── network.ts # Network communication
│   │   ├── raft.ts    # Raft protocol implementation
│   │   └── storage.ts # Persistence layer
│   ├── search/        # HNSW search implementation
│   │   ├── hnsw.ts    # HNSW graph implementation
│   │   └── vector.ts  # Vector operations with SIMD
│   ├── types/         # TypeScript type definitions
│   ├── utils/         # Utility functions
│   └── wasm/          # WASM SIMD implementation
├── tests/             # Test files
├── scripts/           # Build and utility scripts
├── examples/          # Usage examples
└── docs/             # Documentation
```

## Implementation Details

### Frontend Interface
- Modern Next.js application with App Router
- Tailwind CSS for responsive design
- Support for manual vector input and random generation
- Interactive visualization of search results
- Dark mode support
- Real-time search with loading states

### Vector Operations
- WASM SIMD-accelerated vector operations with automatic JS fallback
- Normalized vectors for consistent distance calculations
- Efficient memory management with Float32Array

### HNSW Graph
- Multi-layer graph structure for logarithmic search complexity
- Optimized parameters for real-world workloads
- Dynamic graph maintenance with efficient updates

### Raft Consensus
- Single-node and multi-node support
- Immediate commits in single-node mode
- Automatic log compaction and snapshots
- File-based persistence with in-memory operations

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes using conventional commits
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see LICENSE file for details
