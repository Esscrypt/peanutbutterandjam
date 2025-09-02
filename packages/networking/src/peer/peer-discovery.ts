/**
 * Peer Discovery
 *
 * Discovers and manages connections to other validators
 * Handles peer discovery, connection establishment, and peer tracking
 */

import type {
  NodeType,
  PeerInfo,
  ValidatorIndex,
  ValidatorMetadata,
} from '@pbnj/types'
import { PreferredInitiator } from '@pbnj/types'

/**
 * Peer discovery manager
 */
export class PeerDiscoveryManager {
  private peers: Map<ValidatorIndex, PeerInfo> = new Map()
  private localValidatorIndex: ValidatorIndex | null = null
  private localNodeType: NodeType | null = null
  private discoveryInterval: NodeJS.Timeout | null = null
  // private connectionTimeout: number = 30000 // 30 seconds
  private maxConnectionAttempts = 3
  private retryDelay = 60000 // 1 minute

  /**
   * Set local validator information
   */
  setLocalValidator(validatorIndex: ValidatorIndex, nodeType: NodeType): void {
    this.localValidatorIndex = validatorIndex
    this.localNodeType = nodeType
  }

  /**
   * Add or update peer information
   */
  addPeer(
    validatorIndex: ValidatorIndex,
    metadata: ValidatorMetadata,
    preferredInitiator: PreferredInitiator = PreferredInitiator.NEITHER,
  ): void {
    const peerInfo: PeerInfo = {
      validatorIndex,
      metadata,
      endpoint: metadata.endpoint,
      isConnected: false,
      lastSeen: Date.now(),
      connectionAttempts: 0,
      lastConnectionAttempt: 0,
      preferredInitiator,
    }

    this.peers.set(validatorIndex, peerInfo)
  }

  /**
   * Remove peer
   */
  removePeer(validatorIndex: ValidatorIndex): void {
    this.peers.delete(validatorIndex)
  }

  /**
   * Get peer information
   */
  getPeer(validatorIndex: ValidatorIndex): PeerInfo | undefined {
    return this.peers.get(validatorIndex)
  }

  /**
   * Get all peers
   */
  getAllPeers(): Map<ValidatorIndex, PeerInfo> {
    return new Map(this.peers)
  }

  /**
   * Get connected peers
   */
  getConnectedPeers(): Map<ValidatorIndex, PeerInfo> {
    const connected = new Map<ValidatorIndex, PeerInfo>()

    for (const [index, peer] of this.peers) {
      if (peer.isConnected) {
        connected.set(index, peer)
      }
    }

    return connected
  }

  /**
   * Get disconnected peers that should be connected
   */
  getDisconnectedPeers(): Map<ValidatorIndex, PeerInfo> {
    const disconnected = new Map<ValidatorIndex, PeerInfo>()
    const now = Date.now()

    for (const [index, peer] of this.peers) {
      if (!peer.isConnected && this.shouldConnectToPeer(peer, now)) {
        disconnected.set(index, peer)
      }
    }

    return disconnected
  }

  /**
   * Check if we should attempt to connect to a peer
   */
  private shouldConnectToPeer(peer: PeerInfo, now: number): boolean {
    // Don't connect to ourselves
    if (peer.validatorIndex === this.localValidatorIndex) {
      return false
    }

    // Check if we've exceeded max connection attempts
    if (peer.connectionAttempts >= this.maxConnectionAttempts) {
      return false
    }

    // Check if enough time has passed since last attempt
    if (now - peer.lastConnectionAttempt < this.retryDelay) {
      return false
    }

    return true
  }

  /**
   * Mark peer as connected
   */
  markPeerConnected(validatorIndex: ValidatorIndex): void {
    const peer = this.peers.get(validatorIndex)
    if (peer) {
      peer.isConnected = true
      peer.lastSeen = Date.now()
      peer.connectionAttempts = 0
    }
  }

  /**
   * Mark peer as disconnected
   */
  markPeerDisconnected(validatorIndex: ValidatorIndex): void {
    const peer = this.peers.get(validatorIndex)
    if (peer) {
      peer.isConnected = false
    }
  }

  /**
   * Record connection attempt
   */
  recordConnectionAttempt(validatorIndex: ValidatorIndex): void {
    const peer = this.peers.get(validatorIndex)
    if (peer) {
      peer.connectionAttempts++
      peer.lastConnectionAttempt = Date.now()
    }
  }

  /**
   * Update peer last seen time
   */
  updatePeerLastSeen(validatorIndex: ValidatorIndex): void {
    const peer = this.peers.get(validatorIndex)
    if (peer) {
      peer.lastSeen = Date.now()
    }
  }

  /**
   * Get peers that need connection attempts
   */
  getPeersNeedingConnection(): Array<{
    validatorIndex: ValidatorIndex
    peer: PeerInfo
  }> {
    const now = Date.now()
    const peers: Array<{ validatorIndex: ValidatorIndex; peer: PeerInfo }> = []

    for (const [index, peer] of this.peers) {
      if (this.shouldConnectToPeer(peer, now)) {
        peers.push({ validatorIndex: index, peer })
      }
    }

    // Sort by preferred initiator and last attempt time
    peers.sort((a, b) => {
      // Prefer peers where we should be the initiator
      const aShouldInitiate =
        a.peer.preferredInitiator === PreferredInitiator.LOCAL
      const bShouldInitiate =
        b.peer.preferredInitiator === PreferredInitiator.LOCAL

      if (aShouldInitiate && !bShouldInitiate) return -1
      if (!aShouldInitiate && bShouldInitiate) return 1

      // Then sort by last attempt time (oldest first)
      return a.peer.lastConnectionAttempt - b.peer.lastConnectionAttempt
    })

    return peers
  }

  /**
   * Get peers where we should be the initiator
   */
  getPeersToInitiate(): Array<{
    validatorIndex: ValidatorIndex
    peer: PeerInfo
  }> {
    const peers: Array<{ validatorIndex: ValidatorIndex; peer: PeerInfo }> = []

    for (const [index, peer] of this.peers) {
      if (peer.preferredInitiator === PreferredInitiator.LOCAL) {
        peers.push({ validatorIndex: index, peer })
      }
    }

    return peers
  }

  /**
   * Get peers where remote should be the initiator
   */
  getPeersToAccept(): Array<{
    validatorIndex: ValidatorIndex
    peer: PeerInfo
  }> {
    const peers: Array<{ validatorIndex: ValidatorIndex; peer: PeerInfo }> = []

    for (const [index, peer] of this.peers) {
      if (peer.preferredInitiator === PreferredInitiator.REMOTE) {
        peers.push({ validatorIndex: index, peer })
      }
    }

    return peers
  }

  /**
   * Update preferred initiator for a peer
   */
  updatePreferredInitiator(
    validatorIndex: ValidatorIndex,
    preferredInitiator: PreferredInitiator,
  ): void {
    const peer = this.peers.get(validatorIndex)
    if (peer) {
      peer.preferredInitiator = preferredInitiator
    }
  }

  /**
   * Compute preferred initiator based on validator indices
   */
  computePreferredInitiator(
    validatorA: ValidatorIndex,
    validatorB: ValidatorIndex,
  ): PreferredInitiator {
    // Simple rule: lower validator index initiates
    if (validatorA < validatorB) {
      return PreferredInitiator.LOCAL
    } else if (validatorA > validatorB) {
      return PreferredInitiator.REMOTE
    } else {
      return PreferredInitiator.NEITHER
    }
  }

  /**
   * Get peer statistics
   */
  getPeerStatistics(): {
    totalPeers: number
    connectedPeers: number
    disconnectedPeers: number
    peersNeedingConnection: number
    localValidatorIndex: ValidatorIndex | null
    localNodeType: NodeType | null
  } {
    const totalPeers = this.peers.size
    const connectedPeers = this.getConnectedPeers().size
    const disconnectedPeers = totalPeers - connectedPeers
    const peersNeedingConnection = this.getPeersNeedingConnection().length

    return {
      totalPeers,
      connectedPeers,
      disconnectedPeers,
      peersNeedingConnection,
      localValidatorIndex: this.localValidatorIndex,
      localNodeType: this.localNodeType,
    }
  }

  /**
   * Start peer discovery
   */
  startDiscovery(intervalMs = 30000): void {
    if (this.discoveryInterval) {
      clearInterval(this.discoveryInterval)
    }

    this.discoveryInterval = setInterval(() => {
      this.performDiscovery()
    }, intervalMs)
  }

  /**
   * Stop peer discovery
   */
  stopDiscovery(): void {
    if (this.discoveryInterval) {
      clearInterval(this.discoveryInterval)
      this.discoveryInterval = null
    }
  }

  /**
   * Perform peer discovery
   */
  private performDiscovery(): void {
    // This would typically involve:
    // 1. Checking for new validators in the validator set
    // 2. Attempting connections to disconnected peers
    // 3. Updating peer status
    // 4. Computing preferred initiators

    const peersNeedingConnection = this.getPeersNeedingConnection()

    for (const { validatorIndex, peer } of peersNeedingConnection) {
      // Emit event or call callback for connection attempt
      this.onPeerNeedsConnection(validatorIndex, peer)
    }
  }

  /**
   * Callback for when a peer needs connection
   */
  private onPeerNeedsConnection(
    validatorIndex: ValidatorIndex,
    peer: PeerInfo,
  ): void {
    // This would be overridden by the connection manager
    console.log(
      `Peer ${validatorIndex} needs connection to ${peer.endpoint.host}:${peer.endpoint.port}`,
    )
  }

  /**
   * Clean up old peers
   */
  cleanupOldPeers(maxAgeMs = 300000): void {
    // 5 minutes
    const now = Date.now()
    const toRemove: ValidatorIndex[] = []

    for (const [index, peer] of this.peers) {
      if (now - peer.lastSeen > maxAgeMs && !peer.isConnected) {
        toRemove.push(index)
      }
    }

    for (const index of toRemove) {
      this.removePeer(index)
    }
  }

  /**
   * Reset connection attempts for all peers
   */
  resetConnectionAttempts(): void {
    for (const peer of this.peers.values()) {
      peer.connectionAttempts = 0
      peer.lastConnectionAttempt = 0
    }
  }

  /**
   * Start peer discovery process
   * JIP-5 compliant startup method
   */
  async start(): Promise<void> {
    console.log('Starting peer discovery for JIP-5 compliance')

    // For testing, add a hardcoded peer (polkaJAM) if we're not that peer
    if (this.localValidatorIndex !== 1) {
      this.addPeer(1, {
        index: 1,
        publicKey: new Uint8Array(32), // Placeholder
        endpoint: {
          host: '127.0.0.1',
          port: 30334,
          publicKey: new Uint8Array(32), // Placeholder
        },
      })
      console.log(
        'Added polkaJAM peer for testing (validator index 1 at 127.0.0.1:30334)',
      )
    }

    // For testing, add our own node as a discoverable peer if we're validator 0
    if (this.localValidatorIndex === 0) {
      // polkaJAM should be able to discover us at 127.0.0.1:30333
      console.log(
        'Local node discoverable at 127.0.0.1:30333 for validator index 0',
      )
    }

    console.log(
      `Peer discovery started for validator ${this.localValidatorIndex}`,
    )
  }

  /**
   * Stop peer discovery process
   * JIP-5 compliant shutdown method
   */
  async stop(): Promise<void> {
    console.log('Stopping peer discovery')
    // TODO: Implement graceful shutdown
  }
}
