/**
 * JAM Simple Networking Protocol (JAMNP-S) Types
 *
 * Types specific to the JAM Simple Networking Protocol as defined in the Gray Paper
 * Reference: JAMNP-S specification
 */

import type { Bytes } from './core'

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
  privateKey: Bytes
  alpnProtocols: string[]
}

/**
 * Stream kinds for JAMNP-S protocols
 * UP (Unique Persistent) streams: 0-127
 * CE (Common Ephemeral) streams: 128+
 */
export enum StreamKind {
  // UP 0: Block announcement
  UP_BLOCK_ANNOUNCEMENT = 0,

  // CE 128: Block request
  CE_BLOCK_REQUEST = 128,

  // CE 129: State request
  CE_STATE_REQUEST = 129,

  // CE 131: Ticket distribution (generator to proxy)
  CE_TICKET_DISTRIBUTION_GENERATOR = 131,

  // CE 132: Ticket distribution (proxy to validators)
  CE_TICKET_DISTRIBUTION_PROXY = 132,

  // CE 133: Work package submission
  CE_WORK_PACKAGE_SUBMISSION = 133,

  // CE 134: Work package sharing
  CE_WORK_PACKAGE_SHARING = 134,

  // CE 135: Work report distribution
  CE_WORK_REPORT_DISTRIBUTION = 135,

  // CE 136: Work report request
  CE_WORK_REPORT_REQUEST = 136,

  // CE 137: Shard distribution
  CE_SHARD_DISTRIBUTION = 137,

  // CE 138: Audit shard request
  CE_AUDIT_SHARD_REQUEST = 138,

  // CE 139: Segment shard request (no justification)
  CE_SEGMENT_SHARD_REQUEST_NO_JUSTIFICATION = 139,

  // CE 140: Segment shard request (with justification)
  CE_SEGMENT_SHARD_REQUEST_WITH_JUSTIFICATION = 140,

  // CE 141: Assurance distribution
  CE_ASSURANCE_DISTRIBUTION = 141,

  // CE 142: Preimage announcement
  CE_PREIMAGE_ANNOUNCEMENT = 142,

  // CE 143: Preimage request
  CE_PREIMAGE_REQUEST = 143,

  // CE 144: Audit announcement
  CE_AUDIT_ANNOUNCEMENT = 144,

  // CE 145: Judgment publication
  CE_JUDGMENT_PUBLICATION = 145,
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
  certificate: Bytes
  /** Ed25519 public key */
  publicKey: Bytes
  /** Alternative name derived from public key */
  alternativeName: string
  /** Certificate signature */
  signature: Bytes
}

/**
 * Validator metadata
 */
export interface ValidatorMetadata {
  /** Validator index */
  index: ValidatorIndex
  /** Ed25519 public key */
  publicKey: Bytes
  /** Connection endpoint */
  endpoint: ConnectionEndpoint
  /** Additional metadata */
  metadata?: Bytes
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
  publicKey: Bytes
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
  finalBlockHash: Bytes
  /** Latest finalized block slot */
  finalBlockSlot: number
  /** Known leaves (descendants of finalized block with no children) */
  leaves: Array<{
    hash: Bytes
    slot: number
  }>
}

export interface BlockAnnouncement {
  /** Block header */
  header: Bytes
  /** Latest finalized block hash */
  finalBlockHash: Bytes
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
  headerHash: Bytes
  /** Request direction */
  direction: BlockRequestDirection
  /** Maximum number of blocks to return */
  maximumBlocks: number
}

export interface BlockResponse {
  /** Sequence of blocks */
  blocks: Bytes[]
}

/**
 * CE 129: State Request Protocol Types
 */
export interface StateRequest {
  /** Block header hash */
  headerHash: Bytes
  /** Start key (31 bytes) */
  startKey: Bytes
  /** End key (31 bytes) */
  endKey: Bytes
  /** Maximum response size in bytes */
  maximumSize: number
}

export interface StateResponse {
  /** Boundary nodes */
  boundaryNodes: Bytes[]
  /** Key-value pairs */
  keyValuePairs: Array<{
    key: Bytes
    value: Bytes
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
    proof: Bytes
  }
}

/**
 * CE 133: Work Package Submission Protocol Types
 */
export interface WorkPackageSubmission {
  /** Core index */
  coreIndex: number
  /** Work package */
  workPackage: Bytes
  /** Extrinsic data */
  extrinsic: Bytes
}

/**
 * CE 134: Work Package Sharing Protocol Types
 */
export interface WorkPackageSharing {
  /** Core index */
  coreIndex: number
  /** Segments-root mappings */
  segmentsRootMappings: Array<{
    workPackageHash: Bytes
    segmentsRoot: Bytes
  }>
  /** Work package bundle */
  workPackageBundle: Bytes
}

export interface WorkPackageSharingResponse {
  /** Work report hash */
  workReportHash: Bytes
  /** Ed25519 signature */
  signature: Bytes
}

/**
 * CE 135: Work Report Distribution Protocol Types
 */
export interface GuaranteedWorkReport {
  /** Work report */
  workReport: Bytes
  /** Slot */
  slot: number
  /** Validator signatures */
  signatures: Array<{
    validatorIndex: number
    signature: Bytes
  }>
}

/**
 * CE 136: Work Report Request Protocol Types
 */
export interface WorkReportRequest {
  /** Work report hash */
  workReportHash: Bytes
}

export interface WorkReportResponse {
  /** Work report */
  workReport: Bytes
}

/**
 * CE 137: Shard Distribution Protocol Types
 */
export interface ShardDistributionRequest {
  /** Erasure root */
  erasureRoot: Bytes
  /** Shard index */
  shardIndex: number
}

export interface ShardDistributionResponse {
  /** Bundle shard */
  bundleShard: Bytes
  /** Segment shards */
  segmentShards: Bytes[]
  /** Justification */
  justification: Bytes
}

/**
 * CE 138: Audit Shard Request Protocol Types
 */
export interface AuditShardRequest {
  /** Erasure root */
  erasureRoot: Bytes
  /** Shard index */
  shardIndex: number
}

export interface AuditShardResponse {
  /** Bundle shard */
  bundleShard: Bytes
  /** Justification */
  justification: Bytes
}

/**
 * CE 139/140: Segment Shard Request Protocol Types
 */
export interface SegmentShardRequest {
  /** Requests for multiple erasure roots */
  requests: Array<{
    erasureRoot: Bytes
    shardIndex: number
    segmentIndices: number[]
  }>
}

export interface SegmentShardResponse {
  /** Segment shards */
  segmentShards: Bytes[]
  /** Justifications (only for protocol 140) */
  justifications?: Bytes[]
}

/**
 * CE 141: Assurance Distribution Protocol Types
 */
export interface AssuranceDistribution {
  /** Header hash (anchor) */
  anchorHash: Bytes
  /** Bitfield (one bit per core) */
  bitfield: Bytes
  /** Ed25519 signature */
  signature: Bytes
}

/**
 * CE 142: Preimage Announcement Protocol Types
 */
export interface PreimageAnnouncement {
  /** Service ID */
  serviceId: number
  /** Preimage hash */
  hash: Bytes
  /** Preimage length */
  preimageLength: number
}

/**
 * CE 143: Preimage Request Protocol Types
 */
export interface PreimageRequest {
  /** Preimage hash */
  hash: Bytes
}

export interface PreimageResponse {
  /** Preimage data */
  preimage: Bytes
}

/**
 * CE 144: Audit Announcement Protocol Types
 */
export interface AuditAnnouncement {
  /** Block header hash */
  headerHash: Bytes
  /** Tranche number */
  tranche: number
  /** Announcement data */
  announcement: {
    /** Work reports to audit */
    workReports: Array<{
      coreIndex: number
      workReportHash: Bytes
    }>
    /** Ed25519 signature */
    signature: Bytes
  }
  /** Evidence for audit requirement */
  evidence: Bytes
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
  workReportHash: Bytes
  /** Ed25519 signature */
  signature: Bytes
}

/**
 * Network node types
 */
export enum NodeType {
  VALIDATOR = 'validator',
  BUILDER = 'builder',
  AUDITOR = 'auditor',
  ASSURER = 'assurer',
  GUARANTOR = 'guarantor',
}

/**
 * Network node information
 */
export interface NetworkNode {
  /** Node type */
  type: NodeType
  /** Ed25519 public key */
  publicKey: Bytes
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
    publicKey: Bytes
    privateKey: Bytes
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
  publicKey: Bytes
  /** Private key (32 bytes) */
  privateKey: Bytes
}
