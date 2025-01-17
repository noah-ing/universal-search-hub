# Universal Search Hub

A high-performance distributed vector search system implementing the Hierarchical Navigable Small World (HNSW) algorithm with Raft consensus for distributed coordination.

## Features

### Search Engine
- HNSW (Hierarchical Navigable Small World) implementation
- WebAssembly SIMD optimization
- Sub-millisecond query times
- O(log n) search complexity
- Real-time performance monitoring

### Distributed System
- Full Raft consensus implementation
- Leader election (150-300ms timeouts)
- Log replication
- Automatic failure recovery
- Health monitoring

### Performance Features
- SIMD vector operations
- Real-time metrics
- Health monitoring
- Error handling
- Automatic optimization

## Prerequisites

- Node.js >=16.0.0
- TypeScript >=4.9.0
- npm or yarn
- WebAssembly support in Node.js

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/universal-search-hub.git
cd universal-search-hub
```

2. Install dependencies:
```bash
npm install
# or
yarn install
```

3. Build the project:
```bash
npm run build
# or
yarn build
```

## Configuration

Create a `.env` file in the project root:

```env
NODE_ENV=development
PORT=3000
CLUSTER_NODES=localhost:3000,localhost:3001,localhost:3002
LOG_LEVEL=info
METRICS_INTERVAL=1000
HEALTH_CHECK_INTERVAL=500
```

## Running the System

### Development Mode
```bash
npm run start:dev
# or
yarn start:dev
```

### Production Mode
```bash
npm start
# or
yarn start
```

### Running a Cluster
```bash
npm run start:cluster
# or
yarn start:cluster
```

## API Reference

### Vector Operations

```typescript
// Insert a vector
const id = await searchHub.insert(vector);

// Search for nearest neighbors
const results = searchHub.search(queryVector, k);

// Update a vector
await searchHub.update(id, newVector);

// Delete a vector
await searchHub.delete(id);
```

### Cluster Management

```typescript
// Get node status
const status = searchHub.getMetrics();

// Check health
const health = searchHub.getHealth();
```

## Testing

### Running Tests
```bash
# Run all tests
npm test

# Run integration tests
npm run test:integration

# Run tests with coverage
npm run test:coverage
```

### Benchmarking
```bash
npm run benchmark
```

## Monitoring

The system provides real-time metrics for:
- Query latency
- Throughput
- Memory usage
- CPU usage
- Network latency
- Error rates
- Health status

Access metrics through:
```typescript
const metrics = searchHub.getMetrics();
```

## Performance Tuning

### HNSW Parameters
- `M`: Maximum number of connections per layer (default: 16)
- `efConstruction`: Size of dynamic candidate list during construction (default: 200)
- `efSearch`: Size of dynamic candidate list during search (default: 50)

### Raft Parameters
- `heartbeatTimeout`: Time between heartbeats (default: 50ms)
- `electionTimeoutMin`: Minimum election timeout (default: 150ms)
- `electionTimeoutMax`: Maximum election timeout (default: 300ms)

## Architecture

The system consists of three main components:

1. **Search Engine**
   - HNSW graph implementation
   - SIMD-optimized vector operations
   - In-memory index structure

2. **Consensus Layer**
   - Raft protocol implementation
   - Leader election
   - Log replication
   - State machine replication

3. **Network Layer**
   - WebSocket communication
   - Peer discovery
   - Health monitoring

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Troubleshooting

### Common Issues

1. **Node Connection Failures**
   - Check network connectivity
   - Verify port availability
   - Check node IDs in configuration

2. **Performance Issues**
   - Monitor memory usage
   - Check CPU utilization
   - Verify SIMD optimization

3. **Consensus Problems**
   - Check election timeouts
   - Verify network latency
   - Monitor leader elections

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- HNSW algorithm implementation based on the paper "Efficient and robust approximate nearest neighbor search using Hierarchical Navigable Small World graphs" by Yu. A. Malkov and D. A. Yashunin
- Raft consensus implementation based on "In Search of an Understandable Consensus Algorithm" by Diego Ongaro and John Ousterhout