/**
 * JAM Simple Networking Protocol (JAMNP-S) Types
 *
 * Types specific to the JAM Simple Networking Protocol as defined in the Gray Paper
 * Reference: JAMNP-S specification
 */

import type { Hex } from '@pbnj/core'
import type { Block } from './block-authoring'
import type { AlternativeName, Extrinsic } from './core'
import type { WorkPackage, WorkReport } from './serialization'

/**
 * Grid position interface
 */
export interface GridPosition {
  row: bigint
  column: bigint
}

/**
 * Stream information interface
 */
// export interface StreamInfo {
//   streamId: string
//   streamKind: StreamKind
//   isOpen: boolean
//   isBidirectional: boolean
// }

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
  index: bigint
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
  epochIndex: bigint
  /** Validators in the set */
  validators: ValidatorMetadata[]
  /** Total number of validators */
  totalValidators: bigint
}

/**
 * Grid structure for validators
 */
export interface ValidatorGrid {
  /** Grid rows */
  rows: bigint
  /** Grid columns */
  columns: bigint
  /** Validator positions */
  positions: Map<bigint, GridPosition>
}

/**
 * Connection endpoint
 */
export interface ConnectionEndpoint {
  /** IPv6 address */
  host: string
  /** Port number */
  port: bigint
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
  finalBlockSlot: bigint
  /** Known leaves (descendants of finalized block with no children) */
  leaves: Array<{
    hash: Uint8Array
    slot: bigint
  }>
}

export interface BlockAnnouncement {
  /** Block header */
  header: Uint8Array
  /** Latest finalized block hash */
  finalBlockHash: Uint8Array
  /** Latest finalized block slot */
  finalBlockSlot: bigint
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
  headerHash: Hex
  /** Request direction */
  direction: BlockRequestDirection
  /** Maximum number of blocks to return */
  maximumBlocks: bigint
}

export interface BlockResponse {
  /** Sequence of serialized blocks (Gray Paper encoded) */
  blocks: Block[]
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
  maximumSize: bigint
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
export interface TicketDistributionRequest {
  /** Epoch index for ticket usage */
  epochIndex: bigint
  /** Ticket data */
  ticket: {
    /** Attempt (0 or 1) */
    attempt: bigint
    /** Bandersnatch RingVRF proof */
    proof: Uint8Array
  }
}

/**
 * CE 133: Work Package Submission Protocol Types
 */
export interface WorkPackageSubmissionRequest {
  /** Core index */
  coreIndex: bigint
  /** Work package */
  workPackage: WorkPackage
  /** Extrinsic data */
  extrinsic: Extrinsic
}

/**
 * CE 134: Work Package Sharing Protocol Types
 */
export interface WorkPackageSharing {
  /** Core index */
  coreIndex: bigint
  /** Segments-root mappings */
  segmentsRootMappings: Array<{
    workPackageHash: Hex
    segmentsRoot: Hex
  }>
  /** Work package bundle */
  workPackageBundle: WorkPackage
}

export interface WorkPackageSharingResponse {
  /** Work report hash */
  workReportHash: Hex
  /** Ed25519 signature */
  signature: Hex
}

/**
 * CE 135: Work Report Distribution Protocol Types
 */
export interface GuaranteedWorkReport {
  /** Work report */
  workReport: WorkReport
  /** Slot */
  slot: bigint
  /** Validator signatures */
  signatures: Array<{
    validatorIndex: bigint
    signature: Hex
  }>
}

/**
 * CE 136: Work Report Request Protocol Types
 */
export interface WorkReportRequest {
  /** Work report hash */
  workReportHash: Hex
}

export interface WorkReportResponse {
  /** Work report */
  workReport: WorkReport
}

/**
 * CE 137: Shard Distribution Protocol Types
 */
export interface ShardDistributionRequest {
  /** Erasure root */
  erasureRoot: Hex
  /** Shard index */
  shardIndex: bigint
}

export interface ShardDistributionResponse {
  /** Bundle shard */
  bundleShard: Hex
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
  erasureRoot: Hex
  /** Shard index */
  shardIndex: bigint
}

export interface AuditShardResponse {
  /** Bundle shard */
  bundleShard: Hex
  /** Justification */
  justification: Uint8Array
}

/**
 * CE 139/140: Segment Shard Request Protocol Types
 */
export interface SegmentShardRequest {
  /** Requests for multiple erasure roots */
  requests: Array<{
    erasureRoot: Hex
    shardIndex: bigint
    segmentIndices: number[]
  }>
}

export interface SegmentShardResponse {
  /** Segment shards */
  segmentShards: Hex[]
  /** Justifications (only for protocol 140) */
  justifications?: Uint8Array[]
}

/**
 * CE 141: Assurance Distribution Protocol Types
 */
export interface AssuranceDistributionRequest {
  /** Header hash (anchor) */
  anchorHash: Hex
  /** Bitfield (one bit per core) */
  bitfield: Uint8Array
  /** Ed25519 signature */
  signature: Hex
}

/**
 * CE 142: Preimage Announcement Protocol Types
 */
export interface PreimageAnnouncement {
  /** Service ID */
  serviceId: bigint
  /** Preimage hash */
  hash: Hex
  /** Preimage length */
  preimageLength: bigint
}

/**
 * CE 143: Preimage Request Protocol Types
 */
export interface PreimageRequest {
  /** Preimage hash */
  hash: Hex
}

// response is the Preimage directly
// export interface PreimageResponse {
//   /** Preimage data */
//   preimage: Hex
// }

/**
 * CE 144: Audit Announcement Protocol Types
 *
 * *** GRAY PAPER EXPLANATION - BANDERSNATCH SIGNATURE s_n(w) ***
 *
 * The evidence field contains Bandersnatch VRF signatures s_n(w) that prove
 * the validator's right to audit specific work-reports. These signatures are
 * contextualized VRF signatures that provide verifiable random selection.
 *
 * For Initial Tranche (n=0):
 * s_0 ∈ bssignature{activeset[v]_bs}{Xaudit ∥ banderout{H_vrfsig}}{∅}
 * - Public Key: activeset[v]_bs (validator's Bandersnatch public key)
 * - Context: Xaudit ∥ banderout{H_vrfsig}
 *   * Xaudit = token("$jam_audit") (audit context token)
 *   * banderout{H_vrfsig} (VRF output from block header)
 * - Message: ∅ (empty message)
 *
 * For Subsequent Tranches (n>0):
 * s_n(w) ∈ bssignature{activeset[v]_bs}{Xaudit ∥ banderout{H_vrfsig} ∥ blake{w} ∥ n}{∅}
 * - Public Key: activeset[v]_bs (validator's Bandersnatch public key)
 * - Context: Xaudit ∥ banderout{H_vrfsig} ∥ blake{w} ∥ n
 *   * Xaudit = token("$jam_audit") (audit context token)
 *   * banderout{H_vrfsig} (VRF output from block header)
 *   * blake{w} (Blake2b hash of the work-report)
 *   * n (tranche number)
 * - Message: ∅ (empty message)
 *
 * Key Properties:
 * - Size: 96 bytes (as per Gray Paper definition)
 * - VRF Output: 32-byte hash via banderout{s_n(w)}
 * - Purpose: Verifiable random selection for audit requirements
 * - Verification: Other validators can verify without knowing private key
 * - Deterministic: Same inputs always produce same signature
 * - Unpredictable: Cannot be gamed or manipulated
 *
 * The signature proves that a validator legitimately selected specific
 * work-reports for auditing based on verifiable random selection, ensuring
 * the audit process is fair and cannot be manipulated.
 */
export interface AuditAnnouncement {
  /** Block header hash */
  headerHash: Hex
  /** Tranche number */
  tranche: bigint
  /** Announcement data */
  announcement: {
    /** Work reports to audit */
    workReports: Array<{
      coreIndex: bigint
      workReportHash: Hex
    }>
    /** Ed25519 signature */
    signature: Hex
  }
  /** Evidence for audit requirement */
  evidence: Uint8Array
}

/**
 * CE 145: Judgment Publication Protocol Types
 */
export interface JudgmentPublicationRequest {
  /** Epoch index */
  epochIndex: bigint
  /** Validator index */
  validatorIndex: bigint
  /** Validity (0 = Invalid, 1 = Valid) */
  validity: 0 | 1
  /** Work report hash */
  workReportHash: Hex
  /** Ed25519 signature */
  signature: Hex
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
  listenPort: bigint
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
  maxConnections: bigint
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
