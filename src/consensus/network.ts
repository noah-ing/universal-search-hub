import WebSocket from 'ws';
import { SystemError, ErrorType, RaftMessage } from '../types';
import { EventEmitter } from 'events';

interface NetworkConfig {
    reconnectInterval: number;
    maxReconnectAttempts: number;
    heartbeatInterval: number;
    connectionTimeout: number;
}

/**
 * Network layer for Raft consensus
 */
export class RaftNetwork extends EventEmitter {
    private connections: Map<string, WebSocket> = new Map();
    private reconnectAttempts: Map<string, number> = new Map();
    private reconnectTimers: Map<string, NodeJS.Timeout> = new Map();
    private heartbeatTimers: Map<string, NodeJS.Timeout> = new Map();

    constructor(
        private nodeId: string,
        private peers: string[],
        private config: NetworkConfig
    ) {
        super();
    }

    /**
     * Initialize network connections
     */
    async initialize(): Promise<void> {
        // Setup server
        const port = parseInt(this.nodeId.split(':')[1]);
        const server = new WebSocket.Server({ port });

        server.on('connection', (ws: WebSocket, req: any) => {
            const peerId = req.headers['x-peer-id'];
            if (!peerId || !this.peers.includes(peerId)) {
                ws.close();
                return;
            }

            this.handleConnection(peerId, ws);
        });

        server.on('error', (error) => {
            this.emit('error', new SystemError(
                ErrorType.NETWORK,
                'SERVER_ERROR',
                'WebSocket server error',
                error
            ));
        });

        // Connect to peers
        for (const peer of this.peers) {
            await this.connectToPeer(peer);
        }
    }

    /**
     * Connect to a peer
     */
    private async connectToPeer(peerId: string): Promise<void> {
        if (this.connections.has(peerId)) return;

        try {
            const ws = new WebSocket(`ws://${peerId}`, {
                headers: { 'x-peer-id': this.nodeId }
            });

            ws.on('open', () => {
                this.handleConnection(peerId, ws);
                this.resetReconnectAttempts(peerId);
            });

            ws.on('error', (error) => {
                this.emit('error', new SystemError(
                    ErrorType.NETWORK,
                    'CONNECTION_ERROR',
                    `Connection error to peer ${peerId}`,
                    error
                ));
                this.handleDisconnection(peerId);
            });

            // Set connection timeout
            const timeout = setTimeout(() => {
                if (ws.readyState === WebSocket.CONNECTING) {
                    ws.terminate();
                    this.handleDisconnection(peerId);
                }
            }, this.config.connectionTimeout);

            ws.once('open', () => clearTimeout(timeout));

        } catch (error) {
            this.handleDisconnection(peerId);
        }
    }

    /**
     * Handle new connection
     */
    private handleConnection(peerId: string, ws: WebSocket): void {
        // Clear any existing connection
        this.clearConnection(peerId);

        // Setup new connection
        this.connections.set(peerId, ws);
        this.setupHeartbeat(peerId, ws);

        ws.on('message', (data: WebSocket.Data) => {
            try {
                const message = JSON.parse(data.toString()) as RaftMessage;
                this.emit('message', message);
            } catch (error) {
                this.emit('error', new SystemError(
                    ErrorType.NETWORK,
                    'MESSAGE_PARSE_ERROR',
                    'Failed to parse message',
                    error
                ));
            }
        });

        ws.on('close', () => this.handleDisconnection(peerId));
        ws.on('error', () => this.handleDisconnection(peerId));

        this.emit('connect', peerId);
    }

    /**
     * Handle peer disconnection
     */
    private handleDisconnection(peerId: string): void {
        this.clearConnection(peerId);
        this.emit('disconnect', peerId);

        // Attempt reconnection
        const attempts = this.reconnectAttempts.get(peerId) || 0;
        if (attempts < this.config.maxReconnectAttempts) {
            this.reconnectAttempts.set(peerId, attempts + 1);
            const timer = setTimeout(
                () => this.connectToPeer(peerId),
                this.config.reconnectInterval * Math.pow(2, attempts)
            );
            this.reconnectTimers.set(peerId, timer);
        } else {
            this.emit('error', new SystemError(
                ErrorType.NETWORK,
                'MAX_RECONNECT_ATTEMPTS',
                `Max reconnection attempts reached for peer ${peerId}`
            ));
        }
    }

    /**
     * Setup heartbeat for connection
     */
    private setupHeartbeat(peerId: string, ws: WebSocket): void {
        const timer = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.ping();
            }
        }, this.config.heartbeatInterval);

        this.heartbeatTimers.set(peerId, timer);

        ws.on('pong', () => {
            this.emit('heartbeat', peerId);
        });
    }

    /**
     * Clear connection resources
     */
    private clearConnection(peerId: string): void {
        // Clear existing connection
        const existingWs = this.connections.get(peerId);
        if (existingWs) {
            existingWs.removeAllListeners();
            if (existingWs.readyState === WebSocket.OPEN) {
                existingWs.close();
            }
        }
        this.connections.delete(peerId);

        // Clear timers
        const heartbeatTimer = this.heartbeatTimers.get(peerId);
        if (heartbeatTimer) {
            clearInterval(heartbeatTimer);
            this.heartbeatTimers.delete(peerId);
        }

        const reconnectTimer = this.reconnectTimers.get(peerId);
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            this.reconnectTimers.delete(peerId);
        }
    }

    /**
     * Reset reconnection attempts
     */
    private resetReconnectAttempts(peerId: string): void {
        this.reconnectAttempts.delete(peerId);
        const timer = this.reconnectTimers.get(peerId);
        if (timer) {
            clearTimeout(timer);
            this.reconnectTimers.delete(peerId);
        }
    }

    /**
     * Send message to peer
     */
    async sendMessage(peerId: string, message: RaftMessage): Promise<void> {
        const ws = this.connections.get(peerId);
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            throw new SystemError(
                ErrorType.NETWORK,
                'NOT_CONNECTED',
                `Not connected to peer ${peerId}`
            );
        }

        try {
            ws.send(JSON.stringify(message));
        } catch (error) {
            throw new SystemError(
                ErrorType.NETWORK,
                'SEND_FAILED',
                `Failed to send message to peer ${peerId}`,
                error
            );
        }
    }

    /**
     * Broadcast message to all peers
     */
    async broadcast(message: RaftMessage): Promise<void> {
        const errors: Error[] = [];
        
        for (const peer of this.peers) {
            try {
                await this.sendMessage(peer, message);
            } catch (error) {
                errors.push(error as Error);
            }
        }

        if (errors.length > 0) {
            throw new SystemError(
                ErrorType.NETWORK,
                'BROADCAST_PARTIAL_FAILURE',
                'Failed to broadcast message to some peers',
                errors
            );
        }
    }

    /**
     * Get connection status
     */
    getStatus(): { [peerId: string]: boolean } {
        const status: { [peerId: string]: boolean } = {};
        for (const peer of this.peers) {
            const ws = this.connections.get(peer);
            status[peer] = ws?.readyState === WebSocket.OPEN;
        }
        return status;
    }

    /**
     * Stop network layer
     */
    stop(): void {
        for (const peer of this.peers) {
            this.clearConnection(peer);
        }
        this.removeAllListeners();
    }
}
