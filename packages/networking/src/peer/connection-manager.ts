/**
 * Connection Manager
 *
 * Manages QUIC connections to other validators
 * Handles connection establishment, maintenance, and preferred initiator logic
 */

import { type SafePromise, safeError, safeResult } from '@pbnj/core'
import type {
  ConnectionEndpoint,
  NodeType,
  PeerInfo,
  StreamInfo,
  StreamKind,
  ValidatorMetadata,
} from '@pbnj/types'
import { PreferredInitiator, StreamState } from '@pbnj/types'
import type { QuicTransport } from '../quic/transport'
import type { GridStructureManager } from './grid-structure'
import type { PeerDiscoveryManager } from './peer-discovery'
import type { ValidatorSetManager } from './validator-set'

/**
 * Connection information
 */
interface ConnectionInfo {
  validatorIndex: bigint
  endpoint: ConnectionEndpoint
  isConnected: boolean
  connectionId: string | null
  streams: Map<StreamKind, StreamInfo>
  lastActivity: number
  preferredInitiator: PreferredInitiator
}

/**
 * Connection manager
 */
export class ConnectionManager {
  private connections: Map<bigint, ConnectionInfo> = new Map()
  private transport: QuicTransport
  private validatorSetManager: ValidatorSetManager
  private peerDiscoveryManager: PeerDiscoveryManager
  private gridStructureManager: GridStructureManager
  private localValidatorIndex: bigint | null = null
  private localNodeType: NodeType | null = null

  private keepAliveInterval = 30000 // 30 seconds (QUIC keepalive interval)
  private pingTimer: NodeJS.Timeout | null = null

  constructor(
    transport: QuicTransport,
    validatorSetManager: ValidatorSetManager,
    peerDiscoveryManager: PeerDiscoveryManager,
    gridStructureManager: GridStructureManager,
  ) {
    this.transport = transport
    this.validatorSetManager = validatorSetManager
    this.peerDiscoveryManager = peerDiscoveryManager
    this.gridStructureManager = gridStructureManager
  }

  /**
   * Set local validator information
   */
  setLocalValidator(validatorIndex: bigint, nodeType: NodeType): void {
    this.localValidatorIndex = validatorIndex
    this.localNodeType = nodeType
    this.peerDiscoveryManager.setLocalValidator(validatorIndex, nodeType)
  }

  /**
   * Start connection management
   */
  async start(): Promise<void> {
    // Start the transport layer
    await this.transport.start()

    // Start peer discovery
    this.peerDiscoveryManager.startDiscovery()

    // Set up connection event handlers
    this.setupEventHandlers()

    // Initial connection setup
    await this.setupInitialConnections()

    // Start keepalive mechanism
    this.startKeepalive()
  }

  /**
   * Stop connection management
   */
  async stop(): Promise<void> {
    // Stop keepalive
    this.stopKeepalive()

    // Stop peer discovery
    this.peerDiscoveryManager.stopDiscovery()

    // Close all connections
    await this.closeAllConnections()

    // Stop the transport layer
    await this.transport.stop()
  }

  /**
   * Setup initial connections to all validators
   */
  private async setupInitialConnections(): Promise<void> {
    const allValidators = this.validatorSetManager.getAllConnectedValidators()

    for (const [validatorIndex, metadata] of allValidators) {
      if (validatorIndex === this.localValidatorIndex) {
        continue // Don't connect to ourselves
      }

      // Add to peer discovery
      const preferredInitiator =
        this.peerDiscoveryManager.computePreferredInitiator(
          this.localValidatorIndex!,
          validatorIndex,
        )

      this.peerDiscoveryManager.addPeer(
        validatorIndex,
        metadata,
        preferredInitiator,
      )

      // Attempt connection if we should be the initiator
      if (preferredInitiator === PreferredInitiator.LOCAL) {
        await this.attemptConnection(validatorIndex, metadata)
      }
    }
  }

  /**
   * Set up connection event handlers
   */
  private setupEventHandlers(): void {
    // Listen for connection events from transport
    this.transport.on(
      'connection',
      (connectionInfo: { connectionId: string }) => {
        this.handleIncomingConnection(connectionInfo)
      },
    )

    this.transport.on(
      'disconnection',
      (connectionInfo: { connectionId: string }) => {
        this.handleConnectionClosed(connectionInfo)
      },
    )

    this.transport.on('stream', (streamInfo: StreamInfo) => {
      this.handleStreamEvent(streamInfo)
    })
  }

  /**
   * Handle incoming connection
   */
  private handleIncomingConnection(connectionInfo: {
    connectionId: string
  }): void {
    // Extract validator index from connection info
    const validatorIndex = this.extractValidatorIndex(connectionInfo)

    if (validatorIndex !== null) {
      this.markConnectionEstablished(validatorIndex, connectionInfo)
    }
  }

  /**
   * Handle connection closed
   */
  private handleConnectionClosed(connectionInfo: {
    connectionId: string
  }): void {
    const validatorIndex = this.extractValidatorIndex(connectionInfo)

    if (validatorIndex !== null) {
      this.markConnectionClosed(validatorIndex)
    }
  }

  /**
   * Handle stream event
   */
  private handleStreamEvent(streamInfo: StreamInfo): void {
    // Route stream to appropriate protocol handler
    this.routeStreamToProtocol(streamInfo)
  }

  /**
   * Connect to a peer and return connection ID
   * Used by protocol handlers to establish connections
   */
  async connectToPeer(endpoint: ConnectionEndpoint): Promise<string> {
    try {
      // Attempt connection via transport
      const connectionInfo = await this.transport.connectToPeer(endpoint)

      if (connectionInfo) {
        // connectionInfo is a string (connectionId) from transport
        const connectionId =
          typeof connectionInfo === 'string'
            ? connectionInfo
            : `conn-${Date.now()}`
        console.log(`Connected to peer at ${endpoint.host}:${endpoint.port}`)
        return connectionId
      }

      throw new Error('Failed to establish connection')
    } catch (error) {
      console.error(
        `Failed to connect to peer at ${endpoint.host}:${endpoint.port}:`,
        error,
      )
      throw error
    }
  }

  /**
   * Attempt connection to a validator
   */
  async attemptConnection(
    validatorIndex: bigint,
    metadata: ValidatorMetadata,
  ): Promise<boolean> {
    try {
      // Record connection attempt
      this.peerDiscoveryManager.recordConnectionAttempt(validatorIndex)

      // Attempt connection via transport
      const connectionInfo = await this.transport.connectToPeer(
        metadata.endpoint,
      )

      if (connectionInfo) {
        this.markConnectionEstablished(validatorIndex, {
          connectionId: connectionInfo,
        })
        return true
      }

      return false
    } catch (error) {
      console.error(`Failed to connect to validator ${validatorIndex}:`, error)
      return false
    }
  }

  /**
   * Mark connection as established
   */
  private markConnectionEstablished(
    validatorIndex: bigint,
    connectionInfo: { connectionId: string },
  ): void {
    const peer = this.peerDiscoveryManager.getPeer(validatorIndex)
    if (!peer) {
      return
    }

    // Update peer discovery
    this.peerDiscoveryManager.markPeerConnected(validatorIndex)

    // Create connection info
    const connection: ConnectionInfo = {
      validatorIndex,
      endpoint: peer.endpoint,
      isConnected: true,
      connectionId: connectionInfo.connectionId || null,
      streams: new Map(),
      lastActivity: Date.now(),
      preferredInitiator: peer.preferredInitiator,
    }

    this.connections.set(validatorIndex, connection)

    console.log(`Connection established to validator ${validatorIndex}`)
  }

  /**
   * Mark connection as closed
   */
  private markConnectionClosed(validatorIndex: bigint): void {
    // Update peer discovery
    this.peerDiscoveryManager.markPeerDisconnected(validatorIndex)

    // Remove connection info
    this.connections.delete(validatorIndex)

    console.log(`Connection closed to validator ${validatorIndex}`)
  }

  /**
   * Extract validator index from connection info
   */
  private extractValidatorIndex(_connectionInfo: {
    connectionId: string
  }): bigint | null {
    // TODO: Implement validator index extraction from connection info
    return null
  }

  /**
   * Route stream to appropriate protocol handler
   */
  private routeStreamToProtocol(streamInfo: StreamInfo): void {
    // This would route the stream to the appropriate protocol handler
    // based on the stream kind
    console.log(`Routing stream ${streamInfo.id} to protocol handler`)
  }

  /**
   * Create stream to a validator
   */
  async createStream(
    validatorIndex: bigint,
    streamKind: StreamKind,
  ): SafePromise<StreamInfo | null> {
    const connection = this.connections.get(validatorIndex)
    if (!connection || !connection.isConnected) {
      return safeError(new Error('Connection not found'))
    }

    // Create stream through transport
    const [error, streamId] = await this.transport.createStream(
      connection.connectionId!,
      streamKind,
    )
    if (error) {
      return safeError(error)
    }

    // Create stream info
    const streamInfo: StreamInfo = {
      id: streamId,
      kind: streamKind as StreamKind,
      state: StreamState.OPEN,
      connectionId: connection.connectionId!,
      isInitiator: true,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      quicStream: undefined,
      isBidirectional: true,
    }

    // Store stream info
    connection.streams.set(streamKind, streamInfo)

    return safeResult(streamInfo)
  }

  /**
   * Send message to a validator
   */
  async sendMessage(
    validatorIndex: bigint,
    streamKind: StreamKind,
    message: Uint8Array,
  ): SafePromise<boolean> {
    const connection = this.connections.get(validatorIndex)
    if (!connection || !connection.isConnected) {
      return safeError(new Error('Connection not found'))
    }

    const streamInfo = connection.streams.get(streamKind)
    if (!streamInfo) {
      return safeError(new Error('Stream not found'))
    }

    const [error] = await this.transport.sendMessage(streamInfo.id, message)
    if (error) {
      return safeError(error)
    }
    connection.lastActivity = Date.now()
    return safeResult(true)
  }

  /**
   * Close stream to a validator
   */
  async closeStream(
    validatorIndex: bigint,
    streamKind: StreamKind,
  ): SafePromise<boolean> {
    const connection = this.connections.get(validatorIndex)
    if (!connection) {
      return safeError(new Error('Connection not found'))
    }

    const streamInfo = connection.streams.get(streamKind)
    if (!streamInfo) {
      return safeError(new Error('Stream not found'))
    }

    const [error] = await this.transport.closeStream(streamInfo.id)
    if (error) {
      return safeError(error)
    }
    connection.streams.delete(streamKind)
    return safeResult(true)
  }

  /**
   * Close connection to a validator
   */
  async closeConnection(validatorIndex: bigint): SafePromise<boolean> {
    const connection = this.connections.get(validatorIndex)
    if (!connection) {
      return safeError(new Error('Connection not found'))
    }

    // Close all streams
    for (const [streamKind] of connection.streams) {
      const [error] = await this.closeStream(validatorIndex, streamKind)
      if (error) {
        return safeError(error)
      }
    }

    // Close connection
    if (connection.connectionId) {
      const [error] = await this.transport.disconnectFromPeer(
        connection.connectionId,
      )
      if (error) {
        return safeError(error)
      }
    }

    this.markConnectionClosed(validatorIndex)
    return safeResult(true)
  }

  /**
   * Close all connections
   */
  async closeAllConnections(): Promise<void> {
    const validators = Array.from(this.connections.keys())

    for (const validatorIndex of validators) {
      await this.closeConnection(validatorIndex)
    }
  }

  /**
   * Get connection information
   */
  getConnection(validatorIndex: bigint): ConnectionInfo | undefined {
    return this.connections.get(validatorIndex)
  }

  /**
   * Get all connections
   */
  getAllConnections(): Map<bigint, ConnectionInfo> {
    return new Map(this.connections)
  }

  /**
   * Get connected validators
   */
  getConnectedValidators(): bigint[] {
    return Array.from(this.connections.keys()).filter(
      (index) => this.connections.get(index)?.isConnected,
    )
  }

  /**
   * Check if connected to a validator
   */
  isConnected(validatorIndex: bigint): boolean {
    const connection = this.connections.get(validatorIndex)
    return connection?.isConnected || false
  }

  /**
   * Get connection statistics
   */
  getConnectionStatistics(): {
    totalConnections: number
    connectedCount: number
    disconnectedCount: number
    localValidatorIndex: bigint | null
    localNodeType: NodeType | null
  } {
    const totalConnections = this.connections.size
    const connectedCount = this.getConnectedValidators().length
    const disconnectedCount = Number(totalConnections - connectedCount)

    return {
      totalConnections: Number(totalConnections),
      connectedCount: Number(connectedCount),
      disconnectedCount: Number(disconnectedCount),
      localValidatorIndex: this.localValidatorIndex,
      localNodeType: this.localNodeType,
    }
  }

  /**
   * Update validator set and recompute connections
   */
  async updateValidatorSet(): Promise<void> {
    // Get current validators that should be connected
    const allValidators = this.validatorSetManager.getAllConnectedValidators()

    // Add new validators to peer discovery
    for (const [validatorIndex, metadata] of allValidators) {
      if (validatorIndex === this.localValidatorIndex) {
        continue
      }

      const peer = this.peerDiscoveryManager.getPeer(validatorIndex)
      if (!peer) {
        // New validator - add to peer discovery
        const preferredInitiator =
          this.peerDiscoveryManager.computePreferredInitiator(
            this.localValidatorIndex!,
            validatorIndex,
          )

        this.peerDiscoveryManager.addPeer(
          validatorIndex,
          metadata,
          preferredInitiator,
        )

        // Attempt connection if we should be the initiator
        if (preferredInitiator === PreferredInitiator.LOCAL) {
          await this.attemptConnection(validatorIndex, metadata)
        }
      }
    }

    // Remove validators that are no longer in the set
    const currentPeers = this.peerDiscoveryManager.getAllPeers()
    for (const [validatorIndex] of currentPeers) {
      if (
        !allValidators.has(validatorIndex) &&
        validatorIndex !== this.localValidatorIndex
      ) {
        await this.closeConnection(validatorIndex)
        this.peerDiscoveryManager.removePeer(validatorIndex)
      }
    }
  }

  /**
   * Apply epoch transition
   */
  async applyEpochTransition(): Promise<void> {
    // Apply epoch transition in validator set manager
    this.validatorSetManager.applyEpochTransition()

    // Update connections based on new validator set
    await this.updateValidatorSet()

    // Update grid structure
    const currentValidators = this.validatorSetManager.getCurrentValidators()
    this.gridStructureManager.updateGridStructure(currentValidators)
  }

  /**
   * Start keepalive mechanism for maintaining connection health
   * Gray Paper: QUIC connections require periodic activity to stay alive
   */
  private startKeepalive(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer)
    }

    this.pingTimer = setInterval(() => {
      this.performKeepalive()
    }, this.keepAliveInterval)

    console.log(`Keepalive started with ${this.keepAliveInterval}ms interval`)
  }

  /**
   * Stop keepalive mechanism
   */
  private stopKeepalive(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer)
      this.pingTimer = null
      console.log('Keepalive stopped')
    }
  }

  /**
   * Perform keepalive by checking connection health and maintaining UP 0 streams
   * Gray Paper approach: Use existing block announcement streams for health monitoring
   */
  private async performKeepalive(): Promise<void> {
    try {
      const connectedPeers = this.peerDiscoveryManager.getAllPeers()
      const healthyConnections = new Set<bigint>()
      const unhealthyConnections = new Set<bigint>()

      console.log(
        `Performing keepalive check for ${connectedPeers.size} connections`,
      )

      // Check each connection's health
      for (const [validatorIndex, peerInfo] of connectedPeers) {
        try {
          const isHealthy = await this.checkConnectionHealth(
            validatorIndex,
            peerInfo,
          )
          if (isHealthy) {
            healthyConnections.add(validatorIndex)
          } else {
            unhealthyConnections.add(validatorIndex)
            console.warn(
              `Connection to validator ${validatorIndex} appears unhealthy`,
            )
          }
        } catch (error) {
          unhealthyConnections.add(validatorIndex)
          console.error(
            `Failed to check health for validator ${validatorIndex}:`,
            error,
          )
        }
      }

      // Attempt to reconnect to unhealthy connections
      for (const validatorIndex of unhealthyConnections) {
        try {
          console.log(`Attempting to reconnect to validator ${validatorIndex}`)
          const metadata =
            this.validatorSetManager.getValidatorMetadata(validatorIndex)
          if (metadata) {
            await this.attemptConnection(validatorIndex, metadata)
          }
        } catch (error) {
          console.error(
            `Failed to reconnect to validator ${validatorIndex}:`,
            error,
          )
        }
      }

      console.log(
        `Keepalive complete: ${healthyConnections.size} healthy, ${unhealthyConnections.size} unhealthy`,
      )
    } catch (error) {
      console.error('Error during keepalive check:', error)
    }
  }

  /**
   * Check if a connection to a peer is healthy
   * Uses QUIC connection state and UP 0 stream status as indicators
   */
  private async checkConnectionHealth(
    validatorIndex: bigint,
    peerInfo: PeerInfo,
  ): Promise<boolean> {
    try {
      // Basic check: peer exists
      if (!peerInfo) {
        return false
      }

      // Check if we have a connection to this validator
      const connection = this.connections.get(peerInfo.validatorIndex)
      if (!connection || !connection.isConnected) {
        return false
      }

      // Additional health checks could include:
      // - Last activity timestamp
      // - UP 0 stream status
      // - Recent message exchange

      // For now, assume connection is healthy if it exists and isn't closed
      return true
    } catch (error) {
      console.error(
        `Error checking connection health for validator ${validatorIndex}:`,
        error,
      )
      return false
    }
  }
}
