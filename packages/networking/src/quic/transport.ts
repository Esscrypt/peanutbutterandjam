/**
 * QUIC Transport Layer for JAMNP-S
 *
 * Provides high-level transport abstraction over QUIC
 */

import type { Bytes, ConnectionEndpoint } from '@pbnj/types'
import type { QUICConfig } from '@infisical/quic/dist/types'
import { EventEmitter } from 'events'
import { QuicConnectionManager } from './connection'
import { QuicStreamManager } from './stream'

/**
 * Transport layer configuration
 */
export interface TransportConfig {
  /** Listen address */
  listenAddress: string
  /** Listen port */
  listenPort: number
  /** TLS configuration */
  tlsConfig: QUICConfig
  /** Maximum connections */
  maxConnections: number
  /** Connection timeout (ms) */
  connectionTimeout: number
  /** Message timeout (ms) */
  messageTimeout: number
}

/**
 * Transport layer events
 */
export interface TransportEvents {
  /** Connection established */
  onConnectionEstablished?: (connectionId: string, endpoint: ConnectionEndpoint) => void
  /** Connection closed */
  onConnectionClosed?: (connectionId: string) => void
  /** Stream created */
  onStreamCreated?: (streamId: string, kind: number, connectionId: string) => void
  /** Stream closed */
  onStreamClosed?: (streamId: string) => void
  /** Message received */
  onMessageReceived?: (streamId: string, data: Bytes) => void
  /** Error occurred */
  onError?: (error: Error) => void
}

/**
 * QUIC transport layer
 */
export class QuicTransport extends EventEmitter {
  private connectionManager: QuicConnectionManager
  private streamManager: QuicStreamManager
  private config: TransportConfig
  private events: TransportEvents
  private isListening: boolean = false

  constructor(config: TransportConfig, events: TransportEvents = {}) {
    super()
    this.config = config
    this.events = events
    this.connectionManager = new QuicConnectionManager()
    this.streamManager = new QuicStreamManager()
    
    this.setupEventHandlers()
  }

  /**
   * Set up event handlers
   */
  private setupEventHandlers(): void {
    // Set up stream manager event handlers
    this.streamManager.registerStreamHandler(0, (stream, data) => {
      this.handleStreamMessage(stream, data)
    })
  }

  /**
   * Start the transport layer
   */
  async start(): Promise<void> {
    try {
      // Start listening for incoming connections
      await this.connectionManager.startListening(
        this.config.listenAddress,
        this.config.listenPort,
        this.config.tlsConfig
      )
      
      this.isListening = true
      console.log(`Transport layer started on ${this.config.listenAddress}:${this.config.listenPort}`)
    } catch (error) {
      console.error('Failed to start transport layer:', error)
      throw error
    }
  }

  /**
   * Stop the transport layer
   */
  async stop(): Promise<void> {
    try {
      // Close all connections
      const activeConnections = this.connectionManager.getActiveConnections()
      for (const connection of activeConnections) {
        await this.connectionManager.closeConnection(connection.id)
      }
      
      this.isListening = false
      console.log('Transport layer stopped')
    } catch (error) {
      console.error('Failed to stop transport layer:', error)
      throw error
    }
  }

  /**
   * Connect to a peer
   */
  async connectToPeer(endpoint: ConnectionEndpoint): Promise<string> {
    try {
      const connectionId = await this.connectionManager.connectToPeer(
        endpoint,
        this.config.tlsConfig
      )
      
      // Set up connection event handlers
      this.setupConnectionEventHandlers(connectionId)
      
      return connectionId
    } catch (error) {
      console.error('Failed to connect to peer:', error)
      throw error
    }
  }

  /**
   * Disconnect from a peer
   */
  async disconnectFromPeer(connectionId: string): Promise<void> {
    try {
      await this.connectionManager.closeConnection(connectionId)
    } catch (error) {
      console.error('Failed to disconnect from peer:', error)
      throw error
    }
  }

  /**
   * Create a stream
   * JAMNP-S specification requires all streams to be bidirectional
   */
  async createStream(connectionId: string, kind: number): Promise<string> {
    try {
      // Get connection info
      const connectionInfo = this.connectionManager.getConnectionInfo(connectionId)
      if (!connectionInfo) {
        throw new Error(`Connection ${connectionId} not found`)
      }

      // Create actual QUIC stream through the connection
      // JAMNP-S specification requires bidirectional streams
      const quicStream = await this.connectionManager.createStream(connectionId)
      
      // Create stream in the stream manager
      const streamId = await this.streamManager.createStream(connectionId, kind, quicStream, true)
      
      // Trigger stream created event
      if (this.events.onStreamCreated) {
        this.events.onStreamCreated(streamId, kind, connectionId)
      }
      
      return streamId
    } catch (error) {
      console.error('Failed to create stream:', error)
      throw error
    }
  }

  /**
   * Send message on stream
   */
  async sendMessage(streamId: string, data: Bytes): Promise<void> {
    try {
      await this.streamManager.sendMessage(streamId, data)
    } catch (error) {
      console.error('Failed to send message:', error)
      throw error
    }
  }

  /**
   * Close stream
   */
  async closeStream(streamId: string): Promise<void> {
    try {
      await this.streamManager.closeStream(streamId)
      
      // Trigger stream closed event
      if (this.events.onStreamClosed) {
        this.events.onStreamClosed(streamId)
      }
    } catch (error) {
      console.error('Failed to close stream:', error)
      throw error
    }
  }

  /**
   * Get connection information
   */
  getConnectionInfo(connectionId: string) {
    return this.connectionManager.getConnectionInfo(connectionId)
  }

  /**
   * Get stream information
   */
  getStreamInfo(streamId: string) {
    return this.streamManager.getStreamInfo(streamId)
  }

  /**
   * Get all active connections
   */
  getActiveConnections() {
    return this.connectionManager.getActiveConnections()
  }

  /**
   * Get all active streams
   */
  getActiveStreams() {
    return this.streamManager.getActiveStreams()
  }

  /**
   * Get streams by kind
   */
  getStreamsByKind(kind: number) {
    return this.streamManager.getStreamsByKind(kind)
  }

  /**
   * Check if transport is listening
   */
  isTransportListening(): boolean {
    return this.isListening
  }

  /**
   * Set up connection event handlers
   */
  private setupConnectionEventHandlers(connectionId: string): void {
    // Monitor connection state changes
    const checkConnectionState = () => {
      const connectionInfo = this.connectionManager.getConnectionInfo(connectionId)
      if (connectionInfo) {
        if (connectionInfo.state === 'connected') {
          // Trigger connection established event
          if (this.events.onConnectionEstablished) {
            this.events.onConnectionEstablished(connectionId, connectionInfo.remoteEndpoint)
          }
        } else if (connectionInfo.state === 'disconnected' || connectionInfo.state === 'error') {
          // Trigger connection closed event
          if (this.events.onConnectionClosed) {
            this.events.onConnectionClosed(connectionId)
          }
        }
      }
    }

    // Check connection state periodically
    const interval = setInterval(checkConnectionState, 100)
    
    // Clean up interval when connection is closed
    const cleanup = () => {
      clearInterval(interval)
    }
    
    // Set up cleanup on connection close
    setTimeout(() => {
      const connectionInfo = this.connectionManager.getConnectionInfo(connectionId)
      if (!connectionInfo || connectionInfo.state === 'disconnected' || connectionInfo.state === 'error') {
        cleanup()
      }
    }, 1000)
  }

  /**
   * Handle stream message
   */
  private handleStreamMessage(stream: any, data: Bytes): void {
    // Trigger message received event
    if (this.events.onMessageReceived) {
      this.events.onMessageReceived(stream.id, data)
    }
  }

  /**
   * Handle transport errors
   */
  private handleError(error: Error): void {
    console.error('Transport error:', error)
    
    // Trigger error event if handler is registered
    if (this.events.onError) {
      this.events.onError(error)
    }
    
    // Emit error event for EventEmitter compatibility
    this.emit('error', error)
  }
} 