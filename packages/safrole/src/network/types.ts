/**
 * Safrole Network Protocol Types
 *
 * Implements network protocol types for Safrole consensus
 * Reference: NETWORK_PROTOCOL_SPEC.md
 */

import type { CodecBlockHeader as BlockHeader } from '@pbnj/types'

// Define local types for Block and State since they're not available from centralized types
interface Block {
  header: BlockHeader
  body: unknown // Simplified for now
}

interface State {
  // Simplified state interface
  [key: string]: unknown
}

/**
 * Network message types
 */
export enum MessageType {
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
 * Base network message interface
 */
export interface NetworkMessage {
  id: string // Unique message ID
  type: MessageType // Message type enum
  payload: Uint8Array // Serialized payload
  timestamp: number // Unix timestamp
  signature?: string // Optional signature for authenticated messages
}

/**
 * Block propagation messages
 */
export interface BlockAnnounce {
  header: BlockHeader // Block header
  hash: string // Block hash
  parentHash: string // Parent block hash
  slot: number // Slot number
  author: string // Author validator ID
  isTicketed: boolean // Whether block uses ticket seal
}

export interface BlockRequest {
  hash: string // Requested block hash
  includeExtrinsics: boolean // Whether to include extrinsics
  includeState: boolean // Whether to include state
}

export interface BlockResponse {
  block: Block // Full block data
  state?: State // Optional state data
}

/**
 * State synchronization messages
 */
export enum StateComponent {
  SAFROLE = 0x01, // Safrole consensus state
  VALIDATORS = 0x02, // Validator sets
  ENTROPY = 0x03, // Entropy accumulator
  TICKETS = 0x04, // Ticket accumulator
  ACCOUNTS = 0x05, // Account state
  REPORTS = 0x06, // Work reports
}

export interface StateRequest {
  blockHash: string // Block hash to sync from
  components: StateComponent[] // Which state components to request
}

export interface StateResponse {
  blockHash: string // Block hash
  state: Partial<State> // Requested state components
  proof?: string // Optional Merkle proof
}

/**
 * Consensus protocol messages
 */
export interface GrandpaVote {
  targetHash: string // Target block hash
  targetNumber: number // Target block number
  stateRoot: string // Posterior state root
  signature: string // Validator signature
  validatorIndex: number // Validator index
}

export interface GrandpaCommit {
  targetHash: string // Committed block hash
  targetNumber: number // Committed block number
  stateRoot: string // Posterior state root
  signatures: GrandpaVote[] // Aggregated signatures
}

export interface BeefyCommitment {
  blockNumber: number // Block number
  mmrRoot: string // MMR root
  validatorSetId: number // Validator set ID
  signatures: string[] // BLS aggregated signatures
}

/**
 * Work package distribution messages
 */
export interface WorkPackageAnnounce {
  packageHash: string // Work package hash
  size: number // Package size in bytes
  coreId: number // Assigned core ID
  deadline: number // Processing deadline
}

export interface WorkPackageRequest {
  packageHash: string // Work package hash
  validatorId: string // Requesting validator ID
}

export interface WorkPackageResponse {
  packageHash: string // Work package hash
  data: Uint8Array // Package data
  proof?: string // Optional availability proof
}

/**
 * Availability protocol messages
 */
export interface AvailabilityAnnounce {
  packageHash: string // Work package hash
  validatorId: string // Validator ID
  available: boolean // Whether package is available
  proof?: string // Optional availability proof
}

export interface AvailabilityRequest {
  packageHash: string // Work package hash
  validatorId: string // Requesting validator ID
}

export interface AvailabilityResponse {
  packageHash: string // Work package hash
  available: boolean // Whether package is available
  proof?: string // Optional availability proof
}

/**
 * Peer management messages
 */
export interface PeerHandshake {
  nodeId: string // Node identifier
  validatorKey?: string // Validator key (if validator)
  supportedProtocols: string[] // Supported protocol versions
  capabilities: string[] // Node capabilities
}

export interface HandshakeResponse {
  accepted: boolean // Whether handshake accepted
  reason?: string // Rejection reason if applicable
  supportedProtocols: string[] // Supported protocol versions
}

export interface PeerDisconnect {
  reason: string // Disconnect reason
  code: number // Disconnect code
}

/**
 * Heartbeat messages
 */
export interface Ping {
  nonce: number // Random nonce for response matching
  timestamp: number // Current timestamp
}

export interface Pong {
  nonce: number // Echo of ping nonce
  timestamp: number // Response timestamp
}

/**
 * Connection configuration
 */
export interface ConnectionConfig {
  maxPeers: number // Maximum peer connections
  maxValidatorPeers: number // Maximum validator connections
  handshakeTimeout: number // Handshake timeout (ms)
  pingInterval: number // Ping interval (ms)
  pingTimeout: number // Ping timeout (ms)
}

/**
 * Peer information
 */
export interface PeerInfo {
  nodeId: string // Node identifier
  validatorKey?: string // Validator key (if validator)
  address: string // Network address
  port: number // Network port
  capabilities: string[] // Node capabilities
  lastSeen: number // Last seen timestamp
  isConnected: boolean // Whether currently connected
}

/**
 * Network statistics
 */
export interface NetworkStats {
  totalPeers: number // Total known peers
  connectedPeers: number // Currently connected peers
  validatorPeers: number // Connected validator peers
  messagesSent: number // Total messages sent
  messagesReceived: number // Total messages received
  bytesSent: number // Total bytes sent
  bytesReceived: number // Total bytes received
}

/**
 * Message validation result
 */
export interface MessageValidationResult {
  isValid: boolean // Whether message is valid
  errors: string[] // Validation errors
  warnings: string[] // Validation warnings
}
