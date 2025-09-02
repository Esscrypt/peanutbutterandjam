/**
 * JAM Simple Networking Protocol (JAMNP-S) Types
 *
 * Types specific to the JAM Simple Networking Protocol as defined in the Gray Paper
 * Reference: JAMNP-S specification
 */

import type { AlternativeName } from './core'
import type { StreamKind } from './network'

/**
 * Core types for JAMNP-S
 */
export type ValidatorIndex = number // 0 to 2^32-1
export type CoreIndex = number // 0 to 2^32-1
export type BuilderSlot = number // 0 to 2^32-1
export type EpochIndex = number // 0 to 2^32-1

/**
 * Grid position interface
 */
export interface GridPosition {
  row: number
  column: number
}

/**
 * Stream information interface
 */
export interface StreamInfo {
  streamId: string
  streamKind: StreamKind
  isOpen: boolean
  isBidirectional: boolean
}

/**
 * TLS configuration interface
 */
export interface TLSConfig {
  certificate: JAMNPCertificate
  privateKey: Uint8Array
  alpnProtocols: string[]
}

/**
 * ALPN protocol identifier
 */
export interface ALPNProtocol {
  /** Protocol name */
  name: 'jamnp-s'
  /** Protocol version */
  version: '0'
  /** Chain hash (first 8 nibbles of genesis header hash) */
  chainHash: string
  /** Builder suffix */
  isBuilder?: boolean
}

/**
 * X.509 Certificate for JAMNP-S
 */
export interface JAMNPCertificate {
  /** Certificate data */
  certificate: Uint8Array
  /** Ed25519 public key */
  publicKey: Uint8Array
  /** Alternative name derived from public key */
  alternativeName: AlternativeName
  /** Certificate signature */
  signature: Uint8Array
}

/**
 * Validator metadata
 */
export interface ValidatorMetadata {
  /** Validator index */
  index: ValidatorIndex
  /** Ed25519 public key */
  publicKey: Uint8Array
  /** Connection endpoint */
  endpoint: ConnectionEndpoint
  /** Additional metadata */
  metadata?: Uint8Array
}

/**
 * Validator set for an epoch
 */
export interface ValidatorSet {
  /** Epoch index */
  epochIndex: number
  /** Validators in the set */
  validators: ValidatorMetadata[]
  /** Total number of validators */
  totalValidators: number
}

/**
 * Grid structure for validators
 */
export interface ValidatorGrid {
  /** Grid rows */
  rows: number
  /** Grid columns */
  columns: number
  /** Validator positions */
  positions: Map<ValidatorIndex, GridPosition>
}

/**
 * Connection endpoint
 */
export interface ConnectionEndpoint {
  /** IPv6 address */
  host: string
  /** Port number */
  port: number
  /** Ed25519 public key */
  publicKey: Uint8Array
}

/**
 * Preferred initiator logic
 */
export enum PreferredInitiator {
  LOCAL = 'local',
  REMOTE = 'remote',
  NEITHER = 'neither',
}

/**
 * UP 0: Block Announcement Protocol Types
 */
export interface BlockAnnouncementHandshake {
  /** Latest finalized block hash */
  finalBlockHash: Uint8Array
  /** Latest finalized block slot */
  finalBlockSlot: number
  /** Known leaves (descendants of finalized block with no children) */
  leaves: Array<{
    hash: Uint8Array
    slot: number
  }>
}

export interface BlockAnnouncement {
  /** Block header */
  header: Uint8Array
  /** Latest finalized block hash */
  finalBlockHash: Uint8Array
  /** Latest finalized block slot */
  finalBlockSlot: number
}

/**
 * CE 128: Block Request Protocol Types
 */
export enum BlockRequestDirection {
  ASCENDING_EXCLUSIVE = 0,
  DESCENDING_INCLUSIVE = 1,
}

export interface BlockRequest {
  /** Header hash to start from */
  headerHash: Uint8Array
  /** Request direction */
  direction: BlockRequestDirection
  /** Maximum number of blocks to return */
  maximumBlocks: number
}

export interface BlockResponse {
  /** Sequence of blocks */
  blocks: Uint8Array[]
}

/**
 * CE 129: State Request Protocol Types
 */
export interface StateRequest {
  /** Block header hash */
  headerHash: Uint8Array
  /** Start key (31 bytes) */
  startKey: Uint8Array
  /** End key (31 bytes) */
  endKey: Uint8Array
  /** Maximum response size in bytes */
  maximumSize: number
}

export interface StateResponse {
  /** Boundary nodes */
  boundaryNodes: Uint8Array[]
  /** Key-value pairs */
  keyValuePairs: Array<{
    key: Uint8Array
    value: Uint8Array
  }>
}

/**
 * CE 131/132: Ticket Distribution Protocol Types
 */
export interface TicketDistribution {
  /** Epoch index for ticket usage */
  epochIndex: number
  /** Ticket data */
  ticket: {
    /** Attempt (0 or 1) */
    attempt: number
    /** Bandersnatch RingVRF proof */
    proof: Uint8Array
  }
}

/**
 * CE 133: Work Package Submission Protocol Types
 */
export interface WorkPackageSubmission {
  /** Core index */
  coreIndex: number
  /** Work package */
  workPackage: Uint8Array
  /** Extrinsic data */
  extrinsic: Uint8Array
}

/**
 * CE 134: Work Package Sharing Protocol Types
 */
export interface WorkPackageSharing {
  /** Core index */
  coreIndex: number
  /** Segments-root mappings */
  segmentsRootMappings: Array<{
    workPackageHash: Uint8Array
    segmentsRoot: Uint8Array
  }>
  /** Work package bundle */
  workPackageBundle: Uint8Array
}

export interface WorkPackageSharingResponse {
  /** Work report hash */
  workReportHash: Uint8Array
  /** Ed25519 signature */
  signature: Uint8Array
}

/**
 * CE 135: Work Report Distribution Protocol Types
 */
export interface GuaranteedWorkReport {
  /** Work report */
  workReport: Uint8Array
  /** Slot */
  slot: number
  /** Validator signatures */
  signatures: Array<{
    validatorIndex: number
    signature: Uint8Array
  }>
}

/**
 * CE 136: Work Report Request Protocol Types
 */
export interface WorkReportRequest {
  /** Work report hash */
  workReportHash: Uint8Array
}

export interface WorkReportResponse {
  /** Work report */
  workReport: Uint8Array
}

/**
 * CE 137: Shard Distribution Protocol Types
 */
export interface ShardDistributionRequest {
  /** Erasure root */
  erasureRoot: Uint8Array
  /** Shard index */
  shardIndex: number
}

export interface ShardDistributionResponse {
  /** Bundle shard */
  bundleShard: Uint8Array
  /** Segment shards */
  segmentShards: Uint8Array[]
  /** Justification */
  justification: Uint8Array
}

/**
 * CE 138: Audit Shard Request Protocol Types
 */
export interface AuditShardRequest {
  /** Erasure root */
  erasureRoot: Uint8Array
  /** Shard index */
  shardIndex: number
}

export interface AuditShardResponse {
  /** Bundle shard */
  bundleShard: Uint8Array
  /** Justification */
  justification: Uint8Array
}

/**
 * CE 139/140: Segment Shard Request Protocol Types
 */
export interface SegmentShardRequest {
  /** Requests for multiple erasure roots */
  requests: Array<{
    erasureRoot: Uint8Array
    shardIndex: number
    segmentIndices: number[]
  }>
}

export interface SegmentShardResponse {
  /** Segment shards */
  segmentShards: Uint8Array[]
  /** Justifications (only for protocol 140) */
  justifications?: Uint8Array[]
}

/**
 * CE 141: Assurance Distribution Protocol Types
 */
export interface AssuranceDistribution {
  /** Header hash (anchor) */
  anchorHash: Uint8Array
  /** Bitfield (one bit per core) */
  bitfield: Uint8Array
  /** Ed25519 signature */
  signature: Uint8Array
}

/**
 * CE 142: Preimage Announcement Protocol Types
 */
export interface PreimageAnnouncement {
  /** Service ID */
  serviceId: number
  /** Preimage hash */
  hash: Uint8Array
  /** Preimage length */
  preimageLength: number
}

/**
 * CE 143: Preimage Request Protocol Types
 */
export interface PreimageRequest {
  /** Preimage hash */
  hash: Uint8Array
}

export interface PreimageResponse {
  /** Preimage data */
  preimage: Uint8Array
}

/**
 * CE 144: Audit Announcement Protocol Types
 */
export interface AuditAnnouncement {
  /** Block header hash */
  headerHash: Uint8Array
  /** Tranche number */
  tranche: number
  /** Announcement data */
  announcement: {
    /** Work reports to audit */
    workReports: Array<{
      coreIndex: number
      workReportHash: Uint8Array
    }>
    /** Ed25519 signature */
    signature: Uint8Array
  }
  /** Evidence for audit requirement */
  evidence: Uint8Array
}

/**
 * CE 145: Judgment Publication Protocol Types
 */
export interface JudgmentPublication {
  /** Epoch index */
  epochIndex: number
  /** Validator index */
  validatorIndex: number
  /** Validity (0 = Invalid, 1 = Valid) */
  validity: 0 | 1
  /** Work report hash */
  workReportHash: Uint8Array
  /** Ed25519 signature */
  signature: Uint8Array
}

/**
 * Network node types
 */
// export enum NodeType {
//   VALIDATOR = 'validator',
//   BUILDER = 'builder',
//   AUDITOR = 'auditor',
//   ASSURER = 'assurer',
//   GUARANTOR = 'guarantor',
// }
export type NodeType =
  | 'validator'
  | 'builder'
  | 'auditor'
  | 'assurer'
  | 'guarantor'

/**
 * Network node information
 */
export interface NetworkNode {
  /** Node type */
  type: NodeType
  /** Ed25519 public key */
  publicKey: Uint8Array
  /** Connection endpoint */
  endpoint: ConnectionEndpoint
  /** Node capabilities */
  capabilities: string[]
  /** Connection status */
  status: 'connected' | 'connecting' | 'disconnected'
  /** Last seen timestamp */
  lastSeen: number
}

/**
 * Network configuration for JAMNP-S
 */
export interface JAMNPConfig {
  /** Listen address */
  listenAddress: string
  /** Listen port */
  listenPort: number
  /** Ed25519 key pair */
  keyPair: {
    publicKey: Uint8Array
    privateKey: Uint8Array
  }
  /** Node type */
  nodeType: NodeType
  /** Chain hash for ALPN */
  chainHash: string
  /** Maximum connections */
  maxConnections: number
  /** Connection timeout (ms) */
  connectionTimeout: number
  /** Message timeout (ms) */
  messageTimeout: number
  /** Epoch duration (slots) */
  epochDuration: number
  /** Builder slots */
  builderSlots: number
}

/**
 * Ed25519 key pair
 */
export interface Ed25519KeyPair {
  /** Public key (32 bytes) */
  publicKey: Uint8Array
  /** Private key (32 bytes) */
  privateKey: Uint8Array
}
