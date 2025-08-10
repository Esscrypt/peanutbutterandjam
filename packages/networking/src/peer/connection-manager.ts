/**
 * Connection Manager
 *
 * Manages QUIC connections to other validators
 * Handles connection establishment, maintenance, and preferred initiator logic
 */

import type {
  ConnectionEndpoint,
  NodeType,
  StreamInfo,
  StreamKind,
  ValidatorIndex,
  ValidatorMetadata,
} from '@pbnj/types'
import { PreferredInitiator } from '@pbnj/types'
import type { QuicTransport } from '../quic/transport'
import type { GridStructureManager } from './grid-structure'
import type { PeerDiscoveryManager } from './peer-discovery'
import type { ValidatorSetManager } from './validator-set'

/**
 * Connection information
 */
interface ConnectionInfo {
  validatorIndex: ValidatorIndex
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
  private connections: Map<ValidatorIndex, ConnectionInfo> = new Map()
  private transport: QuicTransport
  private validatorSetManager: ValidatorSetManager
  private peerDiscoveryManager: PeerDiscoveryManager
  private gridStructureManager: GridStructureManager
  private localValidatorIndex: ValidatorIndex | null = null
  private localNodeType: NodeType | null = null
  // private connectionTimeout: number = 30000 // 30 seconds
  // private keepAliveInterval: number = 60000 // 1 minute

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
  setLocalValidator(validatorIndex: ValidatorIndex, nodeType: NodeType): void {
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
  }

  /**
   * Stop connection management
   */
  async stop(): Promise<void> {
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
    this.transport.on('connection', (connectionInfo: any) => {
      this.handleIncomingConnection(connectionInfo)
    })

    this.transport.on('disconnection', (connectionInfo: any) => {
      this.handleConnectionClosed(connectionInfo)
    })

    this.transport.on('stream', (streamInfo: any) => {
      this.handleStreamEvent(streamInfo)
    })
  }

  /**
   * Handle incoming connection
   */
  private handleIncomingConnection(connectionInfo: any): void {
    // Extract validator index from connection info
    const validatorIndex = this.extractValidatorIndex(connectionInfo)

    if (validatorIndex !== null) {
      this.markConnectionEstablished(validatorIndex, connectionInfo)
    }
  }

  /**
   * Handle connection closed
   */
  private handleConnectionClosed(connectionInfo: any): void {
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
   * Attempt connection to a validator
   */
  async attemptConnection(
    validatorIndex: ValidatorIndex,
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
        this.markConnectionEstablished(validatorIndex, connectionInfo)
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
    validatorIndex: ValidatorIndex,
    connectionInfo: any,
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
  private markConnectionClosed(validatorIndex: ValidatorIndex): void {
    // Update peer discovery
    this.peerDiscoveryManager.markPeerDisconnected(validatorIndex)

    // Remove connection info
    this.connections.delete(validatorIndex)

    console.log(`Connection closed to validator ${validatorIndex}`)
  }

  /**
   * Extract validator index from connection info
   */
  private extractValidatorIndex(
    _connectionInfo: unknown,
  ): ValidatorIndex | null {
    // TODO: Implement validator index extraction from connection info
    return null
  }

  /**
   * Route stream to appropriate protocol handler
   */
  private routeStreamToProtocol(streamInfo: StreamInfo): void {
    // This would route the stream to the appropriate protocol handler
    // based on the stream kind
    console.log(`Routing stream ${streamInfo.streamId} to protocol handler`)
  }

  /**
   * Create stream to a validator
   */
  async createStream(
    validatorIndex: ValidatorIndex,
    streamKind: StreamKind,
  ): Promise<StreamInfo | null> {
    const connection = this.connections.get(validatorIndex)
    if (!connection || !connection.isConnected) {
      return null
    }

    try {
      // Create stream through transport
      const streamId = await this.transport.createStream(
        connection.connectionId!,
        streamKind,
      )

      // Create stream info
      const streamInfo: StreamInfo = {
        streamId,
        streamKind,
        isOpen: true,
        isBidirectional: true,
      }

      // Store stream info
      connection.streams.set(streamKind, streamInfo)

      return streamInfo
    } catch (error) {
      console.error('Failed to create stream:', error)
      return null
    }
  }

  /**
   * Send message to a validator
   */
  async sendMessage(
    validatorIndex: ValidatorIndex,
    streamKind: StreamKind,
    message: Uint8Array,
  ): Promise<boolean> {
    const connection = this.connections.get(validatorIndex)
    if (!connection || !connection.isConnected) {
      return false
    }

    const streamInfo = connection.streams.get(streamKind)
    if (!streamInfo) {
      return false
    }

    try {
      await this.transport.sendMessage(streamInfo.streamId, message)
      connection.lastActivity = Date.now()
      return true
    } catch (error) {
      console.error(
        `Failed to send message to validator ${validatorIndex}:`,
        error,
      )
      return false
    }
  }

  /**
   * Close stream to a validator
   */
  async closeStream(
    validatorIndex: ValidatorIndex,
    streamKind: StreamKind,
  ): Promise<boolean> {
    const connection = this.connections.get(validatorIndex)
    if (!connection) {
      return false
    }

    const streamInfo = connection.streams.get(streamKind)
    if (!streamInfo) {
      return false
    }

    try {
      await this.transport.closeStream(streamInfo.streamId)
      connection.streams.delete(streamKind)
      return true
    } catch (error) {
      console.error(
        `Failed to close stream ${streamKind} to validator ${validatorIndex}:`,
        error,
      )
      return false
    }
  }

  /**
   * Close connection to a validator
   */
  async closeConnection(validatorIndex: ValidatorIndex): Promise<boolean> {
    const connection = this.connections.get(validatorIndex)
    if (!connection) {
      return false
    }

    try {
      // Close all streams
      for (const [streamKind] of connection.streams) {
        await this.closeStream(validatorIndex, streamKind)
      }

      // Close connection
      if (connection.connectionId) {
        await this.transport.disconnectFromPeer(connection.connectionId)
      }

      this.markConnectionClosed(validatorIndex)
      return true
    } catch (error) {
      console.error(
        `Failed to close connection to validator ${validatorIndex}:`,
        error,
      )
      return false
    }
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
  getConnection(validatorIndex: ValidatorIndex): ConnectionInfo | undefined {
    return this.connections.get(validatorIndex)
  }

  /**
   * Get all connections
   */
  getAllConnections(): Map<ValidatorIndex, ConnectionInfo> {
    return new Map(this.connections)
  }

  /**
   * Get connected validators
   */
  getConnectedValidators(): ValidatorIndex[] {
    return Array.from(this.connections.keys()).filter(
      (index) => this.connections.get(index)?.isConnected,
    )
  }

  /**
   * Check if connected to a validator
   */
  isConnected(validatorIndex: ValidatorIndex): boolean {
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
    localValidatorIndex: ValidatorIndex | null
    localNodeType: NodeType | null
  } {
    const totalConnections = this.connections.size
    const connectedCount = this.getConnectedValidators().length
    const disconnectedCount = totalConnections - connectedCount

    return {
      totalConnections,
      connectedCount,
      disconnectedCount,
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
}
