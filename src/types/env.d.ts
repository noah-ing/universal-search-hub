declare global {
    namespace NodeJS {
        interface ProcessEnv {
            // Node Environment
            NODE_ENV: 'development' | 'production' | 'test';
            
            // Server Configuration
            PORT: string;
            HOST: string;

            // Cluster Configuration
            CLUSTER_NODES: string;
            NODE_ID: string;

            // HNSW Configuration
            HNSW_DIMENSION: string;
            HNSW_MAX_ELEMENTS: string;
            HNSW_M: string;
            HNSW_EF_CONSTRUCTION: string;
            HNSW_EF_SEARCH: string;
            HNSW_ML: string;

            // Raft Configuration
            RAFT_HEARTBEAT_TIMEOUT: string;
            RAFT_ELECTION_TIMEOUT_MIN: string;
            RAFT_ELECTION_TIMEOUT_MAX: string;
            RAFT_BATCH_SIZE: string;

            // Monitoring Configuration
            METRICS_INTERVAL: string;
            HEALTH_CHECK_INTERVAL: string;

            // Logging Configuration
            LOG_LEVEL: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';
            LOG_FORMAT: 'pretty' | 'json';

            // WebSocket Configuration
            WS_RECONNECT_INTERVAL: string;
            WS_MAX_RECONNECT_ATTEMPTS: string;
        }
    }
}

// This needs to be exported to be a valid module
export {};
