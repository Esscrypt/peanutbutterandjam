/**
 * Network Types for JAM Protocol
 *
 * Network-related types and interfaces
 * Reference: Gray Paper network specifications
 */

import type { Block, Hash, Peer } from './common'

/**
 * Network message types
 */
export enum NetworkMessageType {
  /** Block announcement */
  BLOCK_ANNOUNCEMENT = 'block_announcement',
  /** Block request */
  BLOCK_REQUEST = 'block_request',
  /** Block response */
  BLOCK_RESPONSE = 'block_response',
  /** Transaction announcement */
  TRANSACTION_ANNOUNCEMENT = 'transaction_announcement',
  /** Transaction request */
  TRANSACTION_REQUEST = 'transaction_request',
  /** Transaction response */
  TRANSACTION_RESPONSE = 'transaction_response',
  /** Peer discovery */
  PEER_DISCOVERY = 'peer_discovery',
  /** Peer handshake */
  PEER_HANDSHAKE = 'peer_handshake',
  /** Peer disconnect */
  PEER_DISCONNECT = 'peer_disconnect',
  /** Heartbeat */
  HEARTBEAT = 'heartbeat',
}

/**
 * Base network message
 */
export interface NetworkMessage {
  /** Message type */
  type: NetworkMessageType
  /** Message ID */
  id: string
  /** Timestamp */
  timestamp: number
  /** Source peer ID */
  sourcePeerId: string
  /** Target peer ID (optional for broadcast) */
  targetPeerId?: string
}

/**
 * Block announcement message
 */
export interface BlockAnnouncementMessage extends NetworkMessage {
  type: NetworkMessageType.BLOCK_ANNOUNCEMENT
  /** Block hash */
  blockHash: Hash
  /** Block number */
  blockNumber: number
  /** Block header */
  header: Block['header']
}

/**
 * Block request message
 */
export interface BlockRequestMessage extends NetworkMessage {
  type: NetworkMessageType.BLOCK_REQUEST
  /** Requested block hash */
  blockHash: Hash
  /** Requested block number */
  blockNumber: number
}

/**
 * Block response message
 */
export interface BlockResponseMessage extends NetworkMessage {
  type: NetworkMessageType.BLOCK_RESPONSE
  /** Requested block */
  block: Block
}

/**
 * Transaction announcement message
 */
export interface TransactionAnnouncementMessage extends NetworkMessage {
  type: NetworkMessageType.TRANSACTION_ANNOUNCEMENT
  /** Transaction hash */
  transactionHash: Hash
  /** Transaction data */
  transactionData: Uint8Array
}

/**
 * Transaction request message
 */
export interface TransactionRequestMessage extends NetworkMessage {
  type: NetworkMessageType.TRANSACTION_REQUEST
  /** Requested transaction hash */
  transactionHash: Hash
}

/**
 * Transaction response message
 */
export interface TransactionResponseMessage extends NetworkMessage {
  type: NetworkMessageType.TRANSACTION_RESPONSE
  /** Requested transaction */
  transaction: Uint8Array
}

/**
 * Peer discovery message
 */
export interface PeerDiscoveryMessage extends NetworkMessage {
  type: NetworkMessageType.PEER_DISCOVERY
  /** Known peers */
  knownPeers: Peer[]
}

/**
 * Peer handshake message
 */
export interface PeerHandshakeMessage extends NetworkMessage {
  type: NetworkMessageType.PEER_HANDSHAKE
  /** Protocol version */
  protocolVersion: string
  /** Node capabilities */
  capabilities: string[]
  /** Node address */
  address: string
  /** Node port */
  port: number
}

/**
 * Peer disconnect message
 */
export interface PeerDisconnectMessage extends NetworkMessage {
  type: NetworkMessageType.PEER_DISCONNECT
  /** Disconnect reason */
  reason: string
}

/**
 * Heartbeat message
 */
export interface HeartbeatMessage extends NetworkMessage {
  type: NetworkMessageType.HEARTBEAT
  /** Current block number */
  currentBlockNumber: number
  /** Current block hash */
  currentBlockHash: Hash
}

/**
 * Union type for all network messages
 */
export type NetworkMessageUnion =
  | BlockAnnouncementMessage
  | BlockRequestMessage
  | BlockResponseMessage
  | TransactionAnnouncementMessage
  | TransactionRequestMessage
  | TransactionResponseMessage
  | PeerDiscoveryMessage
  | PeerHandshakeMessage
  | PeerDisconnectMessage
  | HeartbeatMessage

/**
 * Network connection state
 */
export enum ConnectionState {
  /** Disconnected */
  DISCONNECTED = 'disconnected',
  /** Connecting */
  CONNECTING = 'connecting',
  /** Connected */
  CONNECTED = 'connected',
  /** Disconnecting */
  DISCONNECTING = 'disconnecting',
}

/**
 * Network connection
 */
export interface NetworkConnection {
  /** Connection ID */
  id: string
  /** Peer information */
  peer: Peer
  /** Connection state */
  state: ConnectionState
  /** Connection established timestamp */
  establishedAt: number
  /** Last activity timestamp */
  lastActivityAt: number
  /** Connection quality score */
  qualityScore: number
}

/**
 * Network configuration
 */
export interface NetworkConfig {
  /** Maximum peers */
  maxPeers: number
  /** Connection timeout (ms) */
  connectionTimeout: number
  /** Heartbeat interval (ms) */
  heartbeatInterval: number
  /** Message timeout (ms) */
  messageTimeout: number
  /** Retry attempts */
  retryAttempts: number
  /** Retry delay (ms) */
  retryDelay: number
}

/**
 * Network statistics
 */
export interface NetworkStats {
  /** Total connections */
  totalConnections: number
  /** Active connections */
  activeConnections: number
  /** Messages sent */
  messagesSent: number
  /** Messages received */
  messagesReceived: number
  /** Bytes sent */
  bytesSent: number
  /** Bytes received */
  bytesReceived: number
  /** Errors */
  errors: number
}
