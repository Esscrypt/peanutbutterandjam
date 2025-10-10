// /**
//  * Connection Manager
//  *
//  * Manages QUIC connections to other validators
//  * Handles connection establishment, maintenance, and preferred initiator logic
//  */

// import {type SafePromise, safeError, safeResult } from '@pbnj/core'
// // import type { QuicTransport } from '@pbnj/networking'
// import type {
//   ConnectionEndpoint,
//   NodeType,
//   StreamInfo,
//   StreamKind,
//   ValidatorMetadata,
// } from '@pbnj/types'
// import { BaseService, PreferredInitiator, StreamState } from '@pbnj/types'
// import type { EpochTransitionEvent, EventBusService } from './event-bus'
// import type { GridStructureManager } from './grid-structure'
// import type { PeerDiscoveryManager } from './peer-discovery'
// import type { ValidatorSetManager } from './validator-set'
// import type { QuicStreamManager } from '@pbnj/networking'

// /**
//  * Connection information
//  */
// interface ConnectionInfo {
//   validatorIndex: bigint
//   endpoint: ConnectionEndpoint
//   isConnected: boolean
//   connectionId: string | null
//   streams: Map<StreamKind, StreamInfo>
//   lastActivity: number
//   preferredInitiator: PreferredInitiator
// }

// /**
//  * Connection manager
//  */
// export class ConnectionManagerService extends BaseService {
//   private connections: Map<bigint, ConnectionInfo> = new Map()
//   private validatorSetManager: ValidatorSetManager
//   private peerDiscoveryManager: PeerDiscoveryManager
//   private gridStructureManager: GridStructureManager
//   private localValidatorIndex: bigint | null = null
//   private localNodeType: NodeType | null = null
//   private eventBusService: EventBusService
//   // private keepAliveInterval = 30000 // 30 seconds (QUIC keepalive interval)
//   // private pingTimer: NodeJS.Timeout | null = null
//   private streamManager: QuicStreamManager
//   constructor(options: {
//     validatorSetManager: ValidatorSetManager
//     peerDiscoveryManager: PeerDiscoveryManager
//     gridStructureManager: GridStructureManager
//     eventBusService: EventBusService
//     streamManager: QuicStreamManager
//   }) {
//     super('connection-manager')
//     this.validatorSetManager = options.validatorSetManager
//     this.peerDiscoveryManager = options.peerDiscoveryManager
//     this.gridStructureManager = options.gridStructureManager
//     this.eventBusService = options.eventBusService
//     this.streamManager = options.streamManager
//   }

//   override async start(): SafePromise<boolean> {
//     this.eventBusService.onEpochTransition(this.handleEpochTransition)

//     // Set up connection event handlers
//     // this.setupEventHandlers()

//     // Initial connection setup
//     await this.setupInitialConnections()

//     return safeResult(true)
//   }

//   /**
//    * Set local validator information
//    */
//   setLocalValidator(validatorIndex: bigint, nodeType: NodeType): void {
//     this.localValidatorIndex = validatorIndex
//     this.localNodeType = nodeType
//     this.peerDiscoveryManager.setLocalValidator(validatorIndex, nodeType)
//   }

//   /**
//    * Stop connection management
//    */
//   override async stop(): SafePromise<boolean> {
//     this.eventBusService.removeEpochTransitionCallback(
//       this.handleEpochTransition,
//     )

//     // Close all connections
//     await this.closeAllConnections()

//     return safeResult(true)
//   }

//   /**
//    * Setup initial connections to all validators
//    */
//   private async setupInitialConnections(): Promise<void> {
//     const allValidators = this.validatorSetManager.getAllConnectedValidators()

//     for (const [validatorIndex, metadata] of allValidators) {
//       if (validatorIndex === this.localValidatorIndex) {
//         continue // Don't connect to ourselves
//       }

//       // Add to peer discovery
//       const preferredInitiator =
//         this.peerDiscoveryManager.computePreferredInitiator(
//           this.localValidatorIndex!,
//           validatorIndex,
//         )

//       this.peerDiscoveryManager.addPeer(
//         validatorIndex,
//         metadata,
//         preferredInitiator,
//       )

//       // Attempt connection if we should be the initiator
//       if (preferredInitiator === PreferredInitiator.LOCAL) {
//         await this.attemptConnection(validatorIndex, metadata)
//       }
//     }
//   }

//   /**
//    * Handle incoming connection
//    */
//   // private handleIncomingConnection(connectionInfo: {
//   //   connectionId: string
//   // }): void {
//   //   // Extract validator index from connection info
//   //   const validatorIndex = this.extractValidatorIndex(connectionInfo)

//   //   if (validatorIndex !== null) {
//   //     this.markConnectionEstablished(validatorIndex, connectionInfo)
//   //   }
//   // }

//   // /**
//   //  * Handle connection closed
//   //  */
//   // private handleConnectionClosed(connectionInfo: {
//   //   connectionId: string
//   // }): void {
//   //   const validatorIndex = this.extractValidatorIndex(connectionInfo)

//   //   if (validatorIndex !== null) {
//   //     this.markConnectionClosed(validatorIndex)
//   //   }
//   // }

//   // /**
//   //  * Handle stream event
//   //  */
//   // private handleStreamEvent(streamInfo: StreamInfo): void {
//   //   // Route stream to appropriate protocol handler
//   //   this.routeStreamToProtocol(streamInfo)
//   // }

//   /**
//    * Connect to a peer and return connection ID
//    * Used by protocol handlers to establish connections
//    */
//   async connectToPeer(endpoint: ConnectionEndpoint): Promise<string> {
//     try {
//       // Attempt connection via transport
//       const connectionInfo = await this.connectToPeer(endpoint)

//       if (connectionInfo) {
//         // connectionInfo is a string (connectionId) from transport
//         const connectionId =
//           typeof connectionInfo === 'string'
//             ? connectionInfo
//             : `conn-${Date.now()}`
//         console.log(`Connected to peer at ${endpoint.host}:${endpoint.port}`)
//         return connectionId
//       }

//       throw new Error('Failed to establish connection')
//     } catch (error) {
//       console.error(
//         `Failed to connect to peer at ${endpoint.host}:${endpoint.port}:`,
//         error,
//       )
//       throw error
//     }
//   }

//   /**
//    * Attempt connection to a validator
//    */
//   async attemptConnection(
//     validatorIndex: bigint,
//     metadata: ValidatorMetadata,
//   ): Promise<boolean> {
//     try {
//       // Record connection attempt
//       this.peerDiscoveryManager.recordConnectionAttempt(validatorIndex)

//       // Attempt connection via transport
//       const connectionInfo = await this.connectToPeer(
//         metadata.endpoint,
//       )

//       if (connectionInfo) {
//         this.markConnectionEstablished(validatorIndex, {
//           connectionId: connectionInfo,
//         })
//         return true
//       }

//       return false
//     } catch (error) {
//       console.error(`Failed to connect to validator ${validatorIndex}:`, error)
//       return false
//     }
//   }

//   /**
//    * Mark connection as established
//    */
//   private markConnectionEstablished(
//     validatorIndex: bigint,
//     connectionInfo: { connectionId: string },
//   ): void {
//     const peer = this.peerDiscoveryManager.getPeer(validatorIndex)
//     if (!peer) {
//       return
//     }

//     // Update peer discovery
//     this.peerDiscoveryManager.markPeerConnected(validatorIndex)

//     // Create connection info
//     const connection: ConnectionInfo = {
//       validatorIndex,
//       endpoint: peer.endpoint,
//       isConnected: true,
//       connectionId: connectionInfo.connectionId || null,
//       streams: new Map(),
//       lastActivity: Date.now(),
//       preferredInitiator: peer.preferredInitiator,
//     }

//     this.connections.set(validatorIndex, connection)

//     console.log(`Connection established to validator ${validatorIndex}`)
//   }

//   /**
//    * Mark connection as closed
//    */
//   private markConnectionClosed(validatorIndex: bigint): void {
//     // Update peer discovery
//     this.peerDiscoveryManager.markPeerDisconnected(validatorIndex)

//     // Remove connection info
//     this.connections.delete(validatorIndex)

//     console.log(`Connection closed to validator ${validatorIndex}`)
//   }

//   /**
//    * Extract validator index from connection info
//    */
//   private extractValidatorIndex(_connectionInfo: {
//     connectionId: string
//   }): bigint | null {
//     // TODO: Implement validator index extraction from connection info
//     return null
//   }

//   /**
//    * Route stream to appropriate protocol handler
//    */
//   private routeStreamToProtocol(streamInfo: StreamInfo): void {
//     // This would route the stream to the appropriate protocol handler
//     // based on the stream kind
//     console.log(`Routing stream ${streamInfo.id} to protocol handler`)
//   }

//   /**
//    * Create stream to a validator
//    */
//   async createStream(
//     validatorIndex: bigint,
//     streamKind: StreamKind,
//   ): SafePromise<StreamInfo | null> {
//     const connection = this.connections.get(validatorIndex)
//     if (!connection || !connection.isConnected) {
//       return safeError(new Error('Connection not found'))
//     }

//     // Create stream through transport
//     const [error, streamId] = await this.streamManager.createStream(
//       connection.connectionId!,
//       streamKind,
//     )
//     if (error) {
//       return safeError(error)
//     }

//     // Create stream info
//     const streamInfo: StreamInfo = {
//       id: streamId,
//       kind: streamKind as StreamKind,
//       state: StreamState.OPEN,
//       connectionId: connection.connectionId!,
//       isInitiator: true,
//       createdAt: Date.now(),
//       lastActivity: Date.now(),
//       quicStream: undefined,
//       isBidirectional: true,
//     }

//     // Store stream info
//     connection.streams.set(streamKind, streamInfo)

//     return safeResult(streamInfo)
//   }

//   /**
//    * Send message to a validator
//    */
//   async sendMessage(
//     validatorIndex: bigint,
//     streamKind: StreamKind,
//     message: Uint8Array,
//   ): SafePromise<boolean> {
//     const connection = this.connections.get(validatorIndex)
//     if (!connection || !connection.isConnected) {
//       return safeError(new Error('Connection not found'))
//     }

//     const streamInfo = connection.streams.get(streamKind)
//     if (!streamInfo) {
//       return safeError(new Error('Stream not found'))
//     }

//     const [error] = await this.streamManager.sendMessage(streamInfo.id, message)
//     if (error) {
//       return safeError(error)
//     }
//     connection.lastActivity = Date.now()
//     return safeResult(true)
//   }

//   /**
//    * Close stream to a validator
//    */
//   async closeStream(
//     validatorIndex: bigint,
//     streamKind: StreamKind,
//   ): SafePromise<boolean> {
//     const connection = this.connections.get(validatorIndex)
//     if (!connection) {
//       return safeError(new Error('Connection not found'))
//     }

//     const streamInfo = connection.streams.get(streamKind)
//     if (!streamInfo) {
//       return safeError(new Error('Stream not found'))
//     }

//     const [error] = await this.streamManager.closeStream(streamInfo.id)
//     if (error) {
//       return safeError(error)
//     }
//     connection.streams.delete(streamKind)
//     return safeResult(true)
//   }

//   /**
//    * Close connection to a validator
//    */
//   async closeConnection(validatorIndex: bigint): SafePromise<boolean> {
//     const connection = this.connections.get(validatorIndex)
//     if (!connection) {
//       return safeError(new Error('Connection not found'))
//     }

//     // Close all streams
//     for (const [streamKind] of connection.streams) {
//       const [error] = await this.closeStream(validatorIndex, streamKind)
//       if (error) {
//         return safeError(error)
//       }
//     }

//     // Close connection
//     if (connection.connectionId) {
//       const [error] = await this.streamManager.closeStream(
//         connection.connectionId,
//       )
//       if (error) {
//         return safeError(error)
//       }
//     }

//     this.markConnectionClosed(validatorIndex)
//     return safeResult(true)
//   }

//   /**
//    * Close all connections
//    */
//   async closeAllConnections(): Promise<void> {
//     const validators = Array.from(this.connections.keys())

//     for (const validatorIndex of validators) {
//       await this.closeConnection(validatorIndex)
//     }
//   }

//   /**
//    * Get connection information
//    */
//   getConnection(validatorIndex: bigint): ConnectionInfo | undefined {
//     return this.connections.get(validatorIndex)
//   }

//   /**
//    * Get all connections
//    */
//   getAllConnections(): Map<bigint, ConnectionInfo> {
//     return new Map(this.connections)
//   }

//   /**
//    * Get connected validators
//    */
//   getConnectedValidators(): bigint[] {
//     return Array.from(this.connections.keys()).filter(
//       (index) => this.connections.get(index)?.isConnected,
//     )
//   }

//   /**
//    * Check if connected to a validator
//    */
//   isConnected(validatorIndex: bigint): boolean {
//     const connection = this.connections.get(validatorIndex)
//     return connection?.isConnected || false
//   }

//   /**
//    * Get connection statistics
//    */
//   getConnectionStatistics(): {
//     totalConnections: number
//     connectedCount: number
//     disconnectedCount: number
//     localValidatorIndex: bigint | null
//     localNodeType: NodeType | null
//   } {
//     const totalConnections = this.connections.size
//     const connectedCount = this.getConnectedValidators().length
//     const disconnectedCount = Number(totalConnections - connectedCount)

//     return {
//       totalConnections: Number(totalConnections),
//       connectedCount: Number(connectedCount),
//       disconnectedCount: Number(disconnectedCount),
//       localValidatorIndex: this.localValidatorIndex,
//       localNodeType: this.localNodeType,
//     }
//   }

//   /**
//    * Update validator set and recompute connections
//    */
//   async updateValidatorSet(): Promise<void> {
//     // Get current validators that should be connected
//     const allValidators = this.validatorSetManager.getAllConnectedValidators()

//     // Add new validators to peer discovery
//     for (const [validatorIndex, metadata] of allValidators) {
//       if (validatorIndex === this.localValidatorIndex) {
//         continue
//       }

//       const peer = this.peerDiscoveryManager.getPeer(validatorIndex)
//       if (!peer) {
//         // New validator - add to peer discovery
//         const preferredInitiator =
//           this.peerDiscoveryManager.computePreferredInitiator(
//             this.localValidatorIndex!,
//             validatorIndex,
//           )

//         this.peerDiscoveryManager.addPeer(
//           validatorIndex,
//           metadata,
//           preferredInitiator,
//         )

//         // Attempt connection if we should be the initiator
//         if (preferredInitiator === PreferredInitiator.LOCAL) {
//           await this.attemptConnection(validatorIndex, metadata)
//         }
//       }
//     }

//     // Remove validators that are no longer in the set
//     const currentPeers = this.peerDiscoveryManager.getAllPeers()
//     for (const [validatorIndex] of currentPeers) {
//       if (
//         !allValidators.has(validatorIndex) &&
//         validatorIndex !== this.localValidatorIndex
//       ) {
//         await this.closeConnection(validatorIndex)
//         this.peerDiscoveryManager.removePeer(validatorIndex)
//       }
//     }
//   }

//   /**
//    * Apply epoch transition
//    */
//   async handleEpochTransition(event: EpochTransitionEvent): SafePromise<void> {
//     // Apply epoch transition in validator set manager
//     // this.validatorSetManager.applyEpochTransition()

//     // Update connections based on new validator set
//     await this.updateValidatorSet()

//     // Update grid structure
//     // const currentValidators = this.validatorSetManager.getCurrentValidators()
//     // this.gridStructureManager.updateGridStructure(currentValidators)

//     return safeResult(undefined)
//   }

// }
