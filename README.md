# Universal Search Hub

A distributed vector similarity search system with WASM SIMD optimization and Raft consensus.

## Features

- High-performance vector similarity search using HNSW algorithm
- WASM SIMD optimization for vector operations
- Distributed consensus using Raft protocol
- Automatic log compaction and snapshots
- Dynamic cluster membership changes
- SQLite persistence
- Comprehensive error handling and recovery

## Performance

Benchmark results on a test dataset (128-dimensional vectors):
- Insert throughput: ~3.8M ops/sec
- Search throughput: ~4.3M ops/sec
- Memory efficiency: ~100 bytes per vector
- SIMD speedup: 3-4x over non-SIMD version

## Prerequisites

- Node.js >= 16
- Emscripten (for WASM compilation)
- SQLite3
- Git

## Installation

1. Clone the repository:
```bash
git clone https://github.com/noah-ing/universal-search-hub.git
cd universal-search-hub
```

2. Install dependencies:
```bash
npm install
```

3. Build WASM module:
```bash
npm run build:wasm
```

4. Build TypeScript:
```bash
npm run build
```

## Configuration

Create a `.env` file in the project root:
```env
NODE_ID=localhost:8081
PEERS=localhost:8082,localhost:8083
DATA_DIR=./data
LOG_LEVEL=info
```

Key configuration options:
- `NODE_ID`: Unique identifier for this node (hostname:port)
- `PEERS`: Comma-separated list of peer nodes
- `DATA_DIR`: Directory for persistent storage
- `LOG_LEVEL`: Logging level (debug, info, warn, error)

## Running the System

1. Start the first node:
```bash
npm run start -- --port 8081
```

2. Start additional nodes:
```bash
npm run start -- --port 8082
npm run start -- --port 8083
```

3. Monitor the cluster:
```bash
npm run status
```

## Running Tests

```bash
# Run all tests
npm test

# Run specific test suites
npm test -- consensus
npm test -- integration
npm test -- search

# Run benchmarks
npm run benchmark
```

## Deployment

### Single Machine Deployment

1. Install dependencies:
```bash
sudo apt-get update
sudo apt-get install -y nodejs npm sqlite3
```

2. Clone and build:
```bash
git clone https://github.com/noah-ing/universal-search-hub.git
cd universal-search-hub
npm install
npm run build:all
```

3. Start the service:
```bash
npm run start:prod
```

### Distributed Deployment

1. Set up each machine with prerequisites:
```bash
sudo apt-get update
sudo apt-get install -y nodejs npm sqlite3
```

2. On each machine:
```bash
git clone https://github.com/noah-ing/universal-search-hub.git
cd universal-search-hub
npm install
npm run build:all
```

3. Configure each node:
```bash
# On machine 1 (leader)
export NODE_ID=machine1:8081
export PEERS=machine2:8081,machine3:8081

# On machine 2
export NODE_ID=machine2:8081
export PEERS=machine1:8081,machine3:8081

# On machine 3
export NODE_ID=machine3:8081
export PEERS=machine1:8081,machine2:8081
```

4. Start each node:
```bash
npm run start:prod
```

### Docker Deployment

1. Build the image:
```bash
docker build -t universal-search-hub .
```

2. Run containers:
```bash
# Start leader node
docker run -d \
  --name ush-node1 \
  -p 8081:8081 \
  -e NODE_ID=node1:8081 \
  -e PEERS=node2:8081,node3:8081 \
  universal-search-hub

# Start follower nodes
docker run -d \
  --name ush-node2 \
  -p 8082:8081 \
  -e NODE_ID=node2:8081 \
  -e PEERS=node1:8081,node3:8081 \
  universal-search-hub

docker run -d \
  --name ush-node3 \
  -p 8083:8081 \
  -e NODE_ID=node3:8081 \
  -e PEERS=node1:8081,node2:8081 \
  universal-search-hub
```

## Monitoring

The system exposes metrics at `/metrics` endpoint:
- Node status (leader/follower)
- Search graph statistics
- Network health
- Memory usage
- Operation throughput

Monitor using:
```bash
curl http://localhost:8081/metrics
```

## Troubleshooting

Common issues and solutions:

1. Node fails to start:
   - Check port availability
   - Verify data directory permissions
   - Check log files in data directory

2. Cluster formation issues:
   - Verify network connectivity between nodes
   - Check firewall settings
   - Ensure consistent configuration across nodes

3. Performance issues:
   - Monitor memory usage
   - Check disk I/O
   - Verify SIMD support
   - Adjust HNSW parameters

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT License - see LICENSE file for details
