/**
 * QUIC Connection Management for JAMNP-S
 *
 * Provides QUIC connection establishment and lifecycle management
 */

import { QUICClient, type QUICConnection, QUICServer } from '@infisical/quic'
import type QUICStream from '@infisical/quic/dist/QUICStream'
import type {
  QUICClientCrypto,
  QUICConfig,
  QUICServerCrypto,
} from '@infisical/quic/dist/types'
import { type SafePromise, safeError, safeResult } from '@pbnj/core'
import type { ConnectionEndpoint } from '@pbnj/types'

/**
 * QUIC connection state
 */
export enum ConnectionState {
  INITIAL = 'initial',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  DISCONNECTING = 'disconnecting',
  DISCONNECTED = 'disconnected',
  ERROR = 'error',
}

/**
 * QUIC connection information
 */
export interface QUICConnectionInfo {
  /** Connection ID */
  id: string
  /** Remote endpoint */
  remoteEndpoint: ConnectionEndpoint
  /** Connection state */
  state: ConnectionState
  /** TLS configuration */
  tlsConfig: QUICConfig
  /** Connection start time */
  startTime: number
  /** Last activity time */
  lastActivity: number
  /** Error message (if any) */
  error?: string
  /** QUIC connection reference */
  quicConnection?: QUICConnection
}

/**
 * QUIC connection manager
 */
export class QuicConnectionManager {
  private connections: Map<string, QUICConnectionInfo> = new Map()
  private server?: QUICServer

  constructor() {
    // Initialize QUIC server and client
    this.initializeQuic()
  }

  /**
   * Initialize QUIC server and client
   */
  private async initializeQuic(): Promise<void> {
    try {
      // QUIC server and client will be created when needed
      // They require specific configuration and crypto setup
      console.log('QUIC connection manager initialized')
    } catch (error) {
      console.error('Failed to initialize QUIC:', error)
      throw error
    }
  }

  /**
   * Create QUIC server with proper configuration
   */
  private async createServer(
    crypto: QUICServerCrypto,
    config: QUICConfig,
  ): Promise<QUICServer> {
    const server = new QUICServer({
      crypto,
      config: {
        ...config,
        key: new Uint8Array(32), // Required for server
        cert: new Uint8Array(32), // Required for server
      },
    })
    return server
  }

  /**
   * Connect to a peer
   */
  async connectToPeer(
    endpoint: ConnectionEndpoint,
    tlsConfig: QUICConfig,
  ): Promise<string> {
    try {
      // Create client crypto
      const clientCrypto: QUICClientCrypto = {
        ops: {
          randomBytes: async (data: ArrayBuffer) => {
            // Fill with random bytes
            const randomData = new Uint8Array(data.byteLength)
            crypto.getRandomValues(randomData)
            new Uint8Array(data).set(randomData)
          },
        },
      }

      // Create client with target endpoint
      const client = await QUICClient.createQUICClient({
        host: endpoint.host,
        port: Math.floor(Number.parseInt(endpoint.port.toString())),
        crypto: clientCrypto,
        config: tlsConfig,
      })

      // Get the QUIC connection
      const quicConnection = client.connection

      const connectionId = this.generateConnectionId()
      const connectionInfo: QUICConnectionInfo = {
        id: connectionId,
        remoteEndpoint: endpoint,
        state: ConnectionState.CONNECTING,
        tlsConfig,
        startTime: Date.now(),
        lastActivity: Date.now(),
        quicConnection, // Store the QUIC connection reference
      }

      this.connections.set(connectionId, connectionInfo)
      this.handleConnectionEstablished(connectionId)

      return connectionId
    } catch (error) {
      console.error('Failed to connect to peer:', error)
      throw error
    }
  }

  /**
   * Start listening for incoming connections
   */
  async startListening(
    address: string,
    port: number,
    tlsConfig: QUICConfig,
  ): Promise<void> {
    try {
      // Create server crypto
      const serverCrypto: QUICServerCrypto = {
        key: new ArrayBuffer(32), // Placeholder key
        ops: {
          sign: async (
            _key: ArrayBuffer,
            _data: ArrayBuffer,
          ): Promise<ArrayBuffer> => {
            // Placeholder signing
            return new ArrayBuffer(64)
          },
          verify: async (
            _key: ArrayBuffer,
            _data: ArrayBuffer,
            _sig: ArrayBuffer,
          ): Promise<boolean> => {
            // Placeholder verification
            return true
          },
        },
      }

      // Create server
      this.server = await this.createServer(serverCrypto, tlsConfig)

      // Start server
      await this.server.start()

      console.log(`QUIC server listening on ${address}:${port}`)
    } catch (error) {
      console.error('Failed to start QUIC server:', error)
      throw error
    }
  }

  /**
   * Create a stream on a connection
   * JAMNP-S specification requires all streams to be bidirectional
   */
  async createStream(connectionId: string): SafePromise<QUICStream> {
    const connectionInfo = this.connections.get(connectionId)
    if (!connectionInfo || !connectionInfo.quicConnection) {
      return safeError(
        new Error(
          `Connection ${connectionId} not found or no QUIC connection available`,
        ),
      )
    }

    // JAMNP-S specification requires bidirectional streams
    const quicStream = connectionInfo.quicConnection.newStream('bidi')
    return safeResult(quicStream)
  }

  /**
   * Close a connection
   */
  async closeConnection(connectionId: string): SafePromise<boolean> {
    const connection = this.connections.get(connectionId)
    if (!connection) {
      return safeError(new Error(`Connection ${connectionId} not found`))
    }

    if (
      connection.state === ConnectionState.DISCONNECTED ||
      connection.state === ConnectionState.ERROR
    ) {
      return safeResult(true)
    }

    connection.state = ConnectionState.DISCONNECTING

    try {
      // Close the QUIC connection if available
      if (connection.quicConnection) {
        await connection.quicConnection.stop({ isApp: true })
      }

      this.handleConnectionClosed(connectionId)
      return safeResult(true)
    } catch (error) {
      this.handleConnectionError(connectionId, error as Error)
      return safeError(error as Error)
    }
  }

  /**
   * Get connection information
   */
  getConnectionInfo(connectionId: string): QUICConnectionInfo | undefined {
    return this.connections.get(connectionId)
  }

  /**
   * Get all active connections
   */
  getActiveConnections(): QUICConnectionInfo[] {
    return Array.from(this.connections.values()).filter(
      (conn) => conn.state === ConnectionState.CONNECTED,
    )
  }

  /**
   * Handle connection established
   */
  private handleConnectionEstablished(connectionId: string): void {
    const connection = this.connections.get(connectionId)
    if (connection) {
      connection.state = ConnectionState.CONNECTED
      connection.lastActivity = Date.now()
      console.log(`Connection established: ${connectionId}`)
    }
  }

  /**
   * Handle connection closed
   */
  private handleConnectionClosed(connectionId: string): void {
    const connection = this.connections.get(connectionId)
    if (connection) {
      connection.state = ConnectionState.DISCONNECTED
      console.log(`Connection closed: ${connectionId}`)
    }
    this.connections.delete(connectionId)
  }

  /**
   * Handle connection error
   */
  private handleConnectionError(connectionId: string, error: Error): void {
    const connection = this.connections.get(connectionId)
    if (connection) {
      connection.state = ConnectionState.ERROR
      connection.error = error.message
      console.error(`Connection error: ${connectionId}`, error)

      // Clean up the connection after a short delay to allow for potential recovery
      setTimeout(() => {
        if (connection.state === ConnectionState.ERROR) {
          this.handleConnectionClosed(connectionId)
        }
      }, 5000) // 5 second delay before cleanup
    }
  }

  /**
   * Generate connection ID
   */
  private generateConnectionId(): string {
    return `conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }
}
