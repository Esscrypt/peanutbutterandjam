/**
 * JAM Simple Networking Protocol (JAMNP-S) Types
 *
 * Types specific to the JAM Simple Networking Protocol as defined in the Gray Paper
 * Reference: JAMNP-S specification
 */

import type { Hex } from 'viem'
import type { Block } from './block-authoring'
import type { ValidatorPublicKeys } from './consensus'
import type { BlockHeader } from './global-state'
import type { WorkPackage, WorkReport } from './serialization'

/**
 * Grid position interface
 */
export interface GridPosition {
  row: bigint
  column: bigint
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
 * Validator metadata
 */
export interface ValidatorMetadata {
  /** Validator index */
  index: number
  /** Validator public keys */
  keys: ValidatorPublicKeys
  /** Connection endpoint */
  endpoint: ConnectionEndpoint
  /** Additional metadata */
  metadata?: Uint8Array
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
  positions: Map<number, GridPosition>
}

/**
 * Connection endpoint
 * @param host - The host of the connection endpoint
 * @param port - The port of the connection endpoint
 * @param publicKey - The public key of the connection endpoint
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
 * Block announcement handshake
 * @param finalBlockHash - The hash of the latest finalized block
 * @param finalBlockSlot - The slot of the latest finalized block
 * @param leaves - The leaves (descendants of the latest finalized block with no children)
 */
export interface BlockAnnouncementHandshake {
  /** Latest finalized block hash */
  finalBlockHash: Uint8Array
  /** Latest finalized block slot */
  finalBlockSlot: bigint
  /** Known leaves (descendants of finalized block with no children) */
  leaves: {
    hash: Uint8Array
    slot: bigint
  }[]
}

/**
 * Block announcement
 * @param header - The block header
 * @param finalBlockHash - The hash of the latest finalized block
 * @param finalBlockSlot - The slot of the latest finalized block
 */
export interface BlockAnnouncement {
  /** Block header */
  header: BlockHeader
  /** Latest finalized block hash */
  finalBlockHash: Hex
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

/**
 * CE 129: State Response Protocol Types
 * @param boundaryNodes - Merkle inclusion proofs for the keyValuePairs
 * @param keyValuePairs - The key-value pairs. The key is the 31 bytes of the key, and the value arbitrary length data
 */
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
 * @dev: to convert to a safrole ticket with an id, you need to hash the proof with banderout see getTicketIdFromProof in safrole/src/ticket-generation.ts
 * @param epochIndex - The epoch index for ticket usage
 * @param ticket - The ticket data
 * @param entryIndex - The entry index of the ticket
 * @param proof - The Bandersnatch RingVRF proof
 */
export interface TicketDistributionRequest {
  /** Epoch index for ticket usage */
  epochIndex: bigint
  /** Ticket data */
  ticket: {
    /** Entry index */
    entryIndex: bigint
    /** Bandersnatch RingVRF proof */
    proof: Uint8Array
  }
}

/**
 * Ticket Distribution Response
 *
 * Response to a ticket distribution request
 */
export interface TicketDistributionResponse {
  /** Epoch index for ticket usage */
  epochIndex: bigint
  /** Success status */
  success: boolean
  /** Error message if unsuccessful */
  error?: string
}

/**
 * Ticket Distribution Event
 *
 * Event emitted during ticket distribution phases
 */
export interface TicketDistributionEvent {
  /** Epoch index for ticket usage */
  epochIndex: bigint
  /** Phase of distribution (1 or 2) */
  phase: number
  /** Timestamp of the event */
  timestamp: number
}

/**
 * CE 133: Work Package Submission Protocol Types
 */
/**
 * CE 133: Work Package Submission Request
 *
 * Gray Paper Reference: work_packages_and_reports.tex, Equation 247
 * JAMNP-S Reference: CE 133
 *
 * Builder submits work package with extrinsic data to guarantor.
 *
 * Extrinsics are raw data blobs concatenated in order, matching the
 * (hash, length) pairs in work items' wi_extrinsics fields.
 */
export interface WorkPackageSubmissionRequest {
  /** Core index (4 bytes) */
  coreIndex: bigint
  /** Work package (Gray Paper encoded) */
  workPackage: WorkPackage
  /**
   * Extrinsic data blobs concatenated
   *
   * All extrinsic data referenced by work items, in order.
   * For each (hash, length) in wi_extrinsics across all work items:
   * - The corresponding blob must be included
   * - blake{blob} must equal hash
   * - len{blob} must equal length
   *
   * Total size must equal Σ(length) from all extrinsic references.
   */
  extrinsics: Uint8Array
}

/**
 * CE 134: Work Package Sharing Protocol Types
 *
 * Gray Paper: Guarantors share work packages and segments-root mappings
 * Message format (Guarantor -> Guarantor):
 * --> Core Index ++ Segments-Root Mappings ++ Work-Package Bundle ++ FIN
 * <-- Work-Report Hash ++ Ed25519 Signature ++ FIN
 */
export interface WorkPackageSharing {
  /** Core index (4 bytes) */
  coreIndex: bigint
  /**
   * Segments-Root Mappings = len++[Work-Package Hash ++ Segments-Root]
   * Array of mappings from work package hash to segments root
   */
  segmentsRootMappings: {
    /** Work package hash (32 bytes) */
    workPackageHash: Uint8Array
    /** Segments root (32 bytes) - Merkle root of erasure-coded chunks */
    segmentsRoot: Uint8Array
  }[]
  /** Work package bundle (Gray Paper WorkPackage structure) */
  workPackageBundle: WorkPackage
}

/**
 * CE 134: Work Package Sharing Response Protocol Types
 * @param workReportHash - The hash of the work report
 * @param signature - The signature of the work report
 */
export interface WorkPackageSharingResponse {
  /** Work report hash (32 bytes) */
  workReportHash: Uint8Array
  /** Ed25519 signature (64 bytes) - Co-guarantor's signature on work report */
  signature: Uint8Array
}

/**
 * CE 135: Work Report Distribution Protocol Types
 * @param workReport - The work report
 * @param slot - The slot
 * @param signatures - The signatures array of validator index and signature
 * @param validatorIndex - The validator index
 * @param signature - The signature. look at `validateGuaranteeSignatures` in `guarantor` package for the structure
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
 * @param erasureRoot - The erasure root we would like to query for
 * @param shardIndex - The shard index we would like to query for
 */
export interface ShardDistributionRequest {
  /** Erasure root */
  erasureRoot: Hex
  /** Shard index */
  shardIndex: bigint
}

/**
 * CE 137: Shard Distribution Protocol Types
 * @param bundleShard - The bundle shard we need to return. It needs to merklize into the requested erasure root
 * @param segmentShards - The segment shards we need to return. They need to merklize into the requested erasure root
 * @param justification - The justification (merkle trace)
 */
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
 * @param anchorHash - The anchor hash
 * @param bitfield - The bitfield
 * @param signature - The signature
 */
export interface AssuranceDistributionRequest {
  /** Header hash (anchor) */
  anchorHash: Hex
  /** Bitfield (one bit per core) */
  bitfield: Hex
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
    workReports: {
      coreIndex: bigint
      workReportHash: Hex
    }[]
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
