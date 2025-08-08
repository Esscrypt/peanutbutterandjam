/**
 * Network Types for JAM Protocol
 *
 * Types for network communication and protocol messages
 * Reference: Gray Paper network specifications
 */

import type { Uint8Array } from './core'

/**
 * Network message types
 */
export enum MessageType {
  BLOCK_ANNOUNCE = 0x01,
  BLOCK_REQUEST = 0x02,
  BLOCK_RESPONSE = 0x03,
  EXTRINSIC_ANNOUNCE = 0x04,
  EXTRINSIC_REQUEST = 0x05,
  EXTRINSIC_RESPONSE = 0x06,
  WORK_PACKAGE_ANNOUNCE = 0x07,
  WORK_PACKAGE_REQUEST = 0x08,
  WORK_PACKAGE_RESPONSE = 0x09,
  TICKET_ANNOUNCE = 0x0a,
  TICKET_REQUEST = 0x0b,
  TICKET_RESPONSE = 0x0c,
  STATE_REQUEST = 0x0d,
  STATE_RESPONSE = 0x0e,
  PING = 0x0f,
  PONG = 0x10,
}

/**
 * Base network message interface
 */
export interface NetworkMessage {
  /** Message type */
  type: MessageType
  /** Message payload */
  payload: Uint8Array
  /** Message timestamp */
  timestamp: number
  /** Message signature */
  signature?: Uint8Array
  /** Message sequence number */
  sequence?: number
}

/**
 * Block announce message
 */
export interface BlockAnnounceMessage extends NetworkMessage {
  type: MessageType.BLOCK_ANNOUNCE
  payload: Uint8Array // Block header hash
}

/**
 * Block request message
 */
export interface BlockRequestMessage extends NetworkMessage {
  type: MessageType.BLOCK_REQUEST
  payload: Uint8Array // Block hash
}

/**
 * Block response message
 */
export interface BlockResponseMessage extends NetworkMessage {
  type: MessageType.BLOCK_RESPONSE
  payload: Uint8Array // Full block data
}

/**
 * Extrinsic announce message
 */
export interface ExtrinsicAnnounceMessage extends NetworkMessage {
  type: MessageType.EXTRINSIC_ANNOUNCE
  payload: Uint8Array // Extrinsic hash
}

/**
 * Extrinsic request message
 */
export interface ExtrinsicRequestMessage extends NetworkMessage {
  type: MessageType.EXTRINSIC_REQUEST
  payload: Uint8Array // Extrinsic hash
}

/**
 * Extrinsic response message
 */
export interface ExtrinsicResponseMessage extends NetworkMessage {
  type: MessageType.EXTRINSIC_RESPONSE
  payload: Uint8Array // Full extrinsic data
}

/**
 * Work package announce message
 */
export interface WorkPackageAnnounceMessage extends NetworkMessage {
  type: MessageType.WORK_PACKAGE_ANNOUNCE
  payload: Uint8Array // Work package hash
}

/**
 * Work package request message
 */
export interface WorkPackageRequestMessage extends NetworkMessage {
  type: MessageType.WORK_PACKAGE_REQUEST
  payload: Uint8Array // Work package hash
}

/**
 * Work package response message
 */
export interface WorkPackageResponseMessage extends NetworkMessage {
  type: MessageType.WORK_PACKAGE_RESPONSE
  payload: Uint8Array // Full work package data
}

/**
 * Ticket announce message
 */
export interface TicketAnnounceMessage extends NetworkMessage {
  type: MessageType.TICKET_ANNOUNCE
  payload: Uint8Array // Ticket hash
}

/**
 * Ticket request message
 */
export interface TicketRequestMessage extends NetworkMessage {
  type: MessageType.TICKET_REQUEST
  payload: Uint8Array // Ticket hash
}

/**
 * Ticket response message
 */
export interface TicketResponseMessage extends NetworkMessage {
  type: MessageType.TICKET_RESPONSE
  payload: Uint8Array // Full ticket data
}

/**
 * State request message
 */
export interface StateRequestMessage extends NetworkMessage {
  type: MessageType.STATE_REQUEST
  payload: Uint8Array // State root hash
}

/**
 * State response message
 */
export interface StateResponseMessage extends NetworkMessage {
  type: MessageType.STATE_RESPONSE
  payload: Uint8Array // Full state data
}

/**
 * Ping message
 */
export interface PingMessage extends NetworkMessage {
  type: MessageType.PING
  payload: Uint8Array // Ping data
}

/**
 * Pong message
 */
export interface PongMessage extends NetworkMessage {
  type: MessageType.PONG
  payload: Uint8Array // Pong data
}

/**
 * Union type for all network messages
 */
export type AnyNetworkMessage =
  | BlockAnnounceMessage
  | BlockRequestMessage
  | BlockResponseMessage
  | ExtrinsicAnnounceMessage
  | ExtrinsicRequestMessage
  | ExtrinsicResponseMessage
  | WorkPackageAnnounceMessage
  | WorkPackageRequestMessage
  | WorkPackageResponseMessage
  | TicketAnnounceMessage
  | TicketRequestMessage
  | TicketResponseMessage
  | StateRequestMessage
  | StateResponseMessage
  | PingMessage
  | PongMessage

/**
 * Network peer information
 */
export interface NetworkPeer {
  /** Peer ID */
  id: string
  /** Peer address */
  address: string
  /** Peer port */
  port: number
  /** Peer public key */
  publicKey: Uint8Array
  /** Connection status */
  connected: boolean
  /** Last seen timestamp */
  lastSeen: number
  /** Peer capabilities */
  capabilities: string[]
}

/**
 * Connection status enum
 */
export enum ConnectionStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  DISCONNECTING = 'disconnecting',
}

/**
 * Network statistics
 */
export interface NetworkStats {
  /** Total peers */
  totalPeers: number
  /** Connected peers */
  connectedPeers: number
  /** Messages sent */
  messagesSent: number
  /** Messages received */
  messagesReceived: number
  /** Uint8Array sent */
  Uint8ArraySent: number
  /** Uint8Array received */
  Uint8ArrayReceived: number
  /** Average latency */
  averageLatency: number
}

/**
 * Network configuration
 */
export interface NetworkConfig {
  /** Listen address */
  listenAddress: string
  /** Listen port */
  listenPort: number
  /** Maximum peers */
  maxPeers: number
  /** Connection timeout */
  connectionTimeout: number
  /** Message timeout */
  messageTimeout: number
  /** Enable discovery */
  enableDiscovery: boolean
  /** Enable relay */
  enableRelay: boolean
}

// ============================================================================
// Safrole-specific network types
// ============================================================================

/**
 * Safrole network message types
 */
export enum SafroleMessageType {
  // Block propagation
  BLOCK_ANNOUNCE = 0x01,
  BLOCK_REQUEST = 0x02,
  BLOCK_RESPONSE = 0x03,

  // State synchronization
  STATE_REQUEST = 0x04,
  STATE_RESPONSE = 0x05,

  // Consensus messages
  GRANDPA_VOTE = 0x06,
  GRANDPA_COMMIT = 0x07,
  BEEFY_COMMITMENT = 0x08,

  // Work package distribution
  WORK_PACKAGE_ANNOUNCE = 0x09,
  WORK_PACKAGE_REQUEST = 0x0a,
  WORK_PACKAGE_RESPONSE = 0x0b,

  // Availability assurances
  AVAILABILITY_ANNOUNCE = 0x0c,
  AVAILABILITY_REQUEST = 0x0d,
  AVAILABILITY_RESPONSE = 0x0e,

  // Peer management
  PEER_HANDSHAKE = 0x0f,
  PEER_DISCONNECT = 0x10,

  // Heartbeat
  PING = 0x11,
  PONG = 0x12,
}

/**
 * Safrole network message interface
 */
export interface SafroleNetworkMessage {
  id: string // Unique message ID
  type: SafroleMessageType // Message type enum
  payload: Uint8Array // Serialized payload
  timestamp: number // Unix timestamp
  signature?: string // Optional signature for authenticated messages
}

/**
 * Safrole block propagation messages
 */
export interface SafroleBlockAnnounce {
  header: any // Block header (simplified)
  hash: string // Block hash
  parentHash: string // Parent block hash
  slot: number // Slot number
  author: string // Author validator ID
  isTicketed: boolean // Whether block uses ticket seal
}

export interface SafroleBlockRequest {
  hash: string // Requested block hash
  includeExtrinsics: boolean // Whether to include extrinsics
  includeState: boolean // Whether to include state
}

export interface SafroleBlockResponse {
  block: any // Full block data (simplified)
  state?: any // Optional state data (simplified)
}

/**
 * Safrole state synchronization messages
 */
export enum SafroleStateComponent {
  SAFROLE = 0x01, // Safrole consensus state
  VALIDATORS = 0x02, // Validator sets
  ENTROPY = 0x03, // Entropy accumulator
  TICKETS = 0x04, // Ticket accumulator
  ACCOUNTS = 0x05, // Account state
  REPORTS = 0x06, // Work reports
}

export interface SafroleStateRequest {
  blockHash: string // Block hash to sync from
  components: SafroleStateComponent[] // Which state components to request
}

export interface SafroleStateResponse {
  blockHash: string // Block hash
  state: any // Requested state components (simplified)
  proof?: string // Optional Merkle proof
}

/**
 * Safrole consensus protocol messages
 */
export interface SafroleGrandpaVote {
  targetHash: string // Target block hash
  targetNumber: number // Target block number
  stateRoot: string // Posterior state root
  signature: string // Validator signature
  validatorIndex: number // Validator index
}

export interface SafroleGrandpaCommit {
  targetHash: string // Committed block hash
  targetNumber: number // Committed block number
  stateRoot: string // Posterior state root
  signatures: SafroleGrandpaVote[] // Aggregated signatures
}

export interface SafroleBeefyCommitment {
  blockNumber: number // Block number
  mmrRoot: string // MMR root
  validatorSetId: number // Validator set ID
  signatures: string[] // BLS aggregated signatures
}

/**
 * Safrole work package distribution messages
 */
export interface SafroleWorkPackageAnnounce {
  packageHash: string // Work package hash
  size: number // Package size in Uint8Array
  coreId: number // Assigned core ID
  deadline: number // Processing deadline
}

export interface SafroleWorkPackageRequest {
  packageHash: string // Work package hash
  validatorId: string // Requesting validator ID
}

export interface SafroleWorkPackageResponse {
  packageHash: string // Work package hash
  data: Uint8Array // Package data
  proof?: string // Optional availability proof
}

/**
 * Safrole availability protocol messages
 */
export interface SafroleAvailabilityAnnounce {
  packageHash: string // Work package hash
  validatorId: string // Validator ID
  available: boolean // Whether package is available
  proof?: string // Optional availability proof
}

export interface SafroleAvailabilityRequest {
  packageHash: string // Work package hash
  validatorId: string // Requesting validator ID
}

export interface SafroleAvailabilityResponse {
  packageHash: string // Work package hash
  available: boolean // Whether package is available
  proof?: string // Optional availability proof
}

/**
 * Safrole peer management messages
 */
export interface SafrolePeerHandshake {
  nodeId: string // Node identifier
  validatorKey?: string // Validator key (if validator)
  supportedProtocols: string[] // Supported protocol versions
  capabilities: string[] // Node capabilities
}

export interface SafroleHandshakeResponse {
  accepted: boolean // Whether handshake accepted
  reason?: string // Rejection reason if applicable
  supportedProtocols: string[] // Supported protocol versions
}

export interface SafrolePeerDisconnect {
  reason: string // Disconnect reason
  code: number // Disconnect code
}

/**
 * Safrole heartbeat messages
 */
export interface SafrolePing {
  nonce: number // Random nonce for response matching
  timestamp: number // Current timestamp
}

export interface SafrolePong {
  nonce: number // Echo of ping nonce
  timestamp: number // Response timestamp
}

/**
 * Safrole connection configuration
 */
export interface SafroleConnectionConfig {
  maxPeers: number // Maximum peer connections
  maxValidatorPeers: number // Maximum validator connections
  handshakeTimeout: number // Handshake timeout (ms)
  pingInterval: number // Ping interval (ms)
  pingTimeout: number // Ping timeout (ms)
}

/**
 * Safrole peer information
 */
export interface SafrolePeerInfo {
  nodeId: string // Node identifier
  validatorKey?: string // Validator key (if validator)
  address: string // Network address
  port: number // Network port
  capabilities: string[] // Node capabilities
  lastSeen: number // Last seen timestamp
  isConnected: boolean // Whether currently connected
}

/**
 * Safrole network statistics
 */
export interface SafroleNetworkStats {
  totalPeers: number // Total known peers
  connectedPeers: number // Currently connected peers
  validatorPeers: number // Connected validator peers
  messagesSent: number // Total messages sent
  messagesReceived: number // Total messages received
  Uint8ArraySent: number // Total Uint8Array sent
  Uint8ArrayReceived: number // Total Uint8Array received
}

/**
 * Safrole message validation result
 */
export interface SafroleMessageValidationResult {
  isValid: boolean // Whether message is valid
  errors: string[] // Validation errors
  warnings: string[] // Validation warnings
}

/**
 * Network Types for JAM Protocol
 *
 * Network-related types and interfaces
 * Reference: Gray Paper network specifications
 */

import type { Block, Hash, Peer } from '@pbnj/types'

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
