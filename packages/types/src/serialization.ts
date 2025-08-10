/**
 * Serialization Types for JAM Protocol
 *
 * Type definitions for serialization functions and data structures
 * Reference: Gray Paper serialization specifications
 */

import type { Address, Bytes, HashValue, HexString } from './core'

/**
 * Preimage structure for data referenced by hash
 */
export interface Preimage {
  serviceIndex: number
  data: Bytes
}

/**
 * Guarantee structure for work report attestations
 */
export interface Guarantee {
  workReport: WorkReport
  timeslot: number
  credential: Credential[]
}

/**
 * Credential structure for validator signatures
 */
export interface Credential {
  value: number
  signature: Bytes
}

/**
 * Validity dispute structure
 */
export interface ValidityDispute {
  reportHash: HashValue
  epochIndex: number
  judgments: Judgment[]
}

/**
 * Judgment structure for dispute resolution
 */
export interface Judgment {
  validity: boolean
  judgeIndex: number
  signature: Bytes
}

/**
 * Assurance structure for data availability
 */
export interface Assurance {
  anchor: HashValue
  availabilities: Bytes
  assurer: number
  signature: Bytes
}

/**
 * Operand tuple structure for work item results
 */
export interface OperandTuple {
  packageHash: HashValue
  segmentRoot: HashValue
  authorizer: HashValue
  payloadHash: HashValue
  gasLimit: number
  result: WorkResult
  authTrace: Bytes
}

/**
 * Availability specification structure
 */
export interface AvailabilitySpecification {
  packageHash: HashValue
  bundleLength: number
  erasureRoot: HashValue
  segmentRoot: HashValue
  segmentCount: number
}

/**
 * Extrinsic reference structure
 */
export interface ExtrinsicReference {
  hash: HashValue
  length: number
}

/**
 * Authorizer structure
 */
export interface Authorizer {
  publicKey: HashValue
  weight: number
}

// ============================================================================
// Block Header Types (matches exactly what JAM test vectors provide)
// ============================================================================

/**
 * Validator structure (matches test vectors)
 */
export interface ValidatorKeyTuple {
  bandersnatch: HashValue
  ed25519: HashValue
}

/**
 * Epoch mark structure (matches test vectors)
 */
export interface EpochMark {
  entropy: HashValue
  tickets_entropy: HashValue
  validators: ValidatorKeyTuple[]
}

/**
 * Ticket structure (single object format - matches test vectors)
 */
export interface SafroleTicketSingle {
  id: HashValue
  entry_index: number
}

/**
 * Ticket structure (array format - matches test vectors)
 */
export interface SafroleTicketArray {
  id: HashValue
  attempt: number
}

/**
 * Block header structure (matches test vectors exactly)
 */
export interface BlockHeader {
  parent: HashValue
  parent_state_root: HashValue
  extrinsic_hash: HashValue
  slot: number
  epoch_mark: EpochMark | null
  tickets_mark: SafroleTicketSingle | SafroleTicketArray[] | null
  offenders_mark: HashValue[]
  author_index: number
  entropy_source: HashValue
  seal: HashValue
}

/**
 * JAM validator key pair for epoch marker
 */
export interface ValidatorKeyPair {
  bandersnatch: HashValue // 32-byte Bandersnatch key
  ed25519: HashValue // 32-byte Ed25519 key
}

/**
 * JAM epoch marker containing entropy and validators
 */
export interface EpochMark {
  entropy: HashValue // 32-byte entropy accumulator
  tickets_entropy: HashValue // 32-byte tickets entropy
  validators: ValidatorKeyPair[] // Validator key pairs
}

/**
 * JAM Safrole ticket for winning tickets marker
 */
export interface SafroleTicketHeader {
  attempt: number
  signature: HashValue
}

export interface SafroleTicketCore {
  id: HashValue
  entryIndex: number
}

/**
 * JAM block header according to Gray Paper specification
 * Matches the test vector structure for header_0.json
 */
export interface JamHeader {
  parent: HashValue // H_parent - parent block hash
  parent_state_root: HashValue // H_priorstateroot - prior state root
  extrinsic_hash: HashValue // H_extrinsichash - extrinsic data hash
  slot: number // H_timeslot - time slot index (32-bit)
  epoch_mark: EpochMark | null // H_epochmark - optional epoch marker
  winners_mark: SafroleTicketHeader[] | null // H_winnersmark - optional winning tickets
  offenders_mark: HashValue[] // H_offendersmark - sequence of Ed25519 offender keys
  author_index: number // H_authorindex - block author index (16-bit)
  vrf_sig: HashValue // H_vrfsig - VRF signature (96 bytes but stored as hex)
  seal_sig: HashValue // H_sealsig - block seal signature (96 bytes but stored as hex)
}

// /**
//  * Legacy simplified header type for compatibility
//  * Can be cast to/from BlockHeader for reuse in other packages
//  */
// export interface SerializationHeader {
//   parent_hash: HashValue
//   number: number
//   state_root: HashValue
//   extrinsics_root: HashValue
//   digest: Digest
// }

/**
 * Type guard to check if tickets_mark is an array
 */
export function isTicketsMarkArray(
  ticketsMark: any,
): ticketsMark is SafroleTicketArray[] {
  return Array.isArray(ticketsMark)
}

/**
 * Type guard to check if tickets_mark is a single object
 */
export function isTicketsMarkSingle(
  ticketsMark: any,
): ticketsMark is SafroleTicketSingle {
  return (
    ticketsMark &&
    typeof ticketsMark === 'object' &&
    !Array.isArray(ticketsMark) &&
    'entry_index' in ticketsMark
  )
}

// ============================================================================
// Block Body Types
// ============================================================================

/**
 * Block body structure
 */
export interface BlockBody {
  extrinsics: Uint8Array[]
}

// ============================================================================
// Work Package Types
// ============================================================================

/**
 * Work error types
 */
export enum WorkError {
  OVERSIZE = 'oversize',
  BAD_EXPORTS = 'bad_exports',
  INVALID_RESULT = 'invalid_result',
  GAS_LIMIT_EXCEEDED = 'gas_limit_exceeded',
  AUTHORIZATION_FAILED = 'authorization_failed',
}

/**
 * Import segment structure
 */
export interface ImportSegment {
  hash: HashValue // Root hash of the import tree
  index: number
}

/**
 * Extrinsic reference structure
 */
export interface ExtrinsicReference {
  hash: HashValue
  length: number
}

/**
 * Work item structure according to Gray Paper equation \ref{eq:workitem}
 */
export interface WorkItem {
  /** Service index identifier */
  serviceindex: number
  /** Code hash of the service */
  codehash: HashValue
  /** Payload blob */
  payload: HexString
  /** Gas limit for Refinement (64-bit) */
  refgaslimit: bigint
  /** Gas limit for Accumulation (64-bit) */
  accgaslimit: bigint
  /** Number of data segments exported */
  exportcount: number
  /** Imported data segments */
  importsegments: ImportSegment[]
  /** Extrinsic references */
  extrinsics: ExtrinsicReference[]
}

/**
 * Work context structure according to Gray Paper equation \ref{eq:workcontext}
 * Describes the context of the chain at the point that the work-package was evaluated
 */
export interface WorkContext {
  /** Anchor block header hash */
  anchorhash: HashValue
  /** Anchor block posterior state-root */
  anchorpoststate: HashValue
  /** Anchor block accumulation output log super-peak */
  anchoraccoutlog: HashValue
  /** Lookup-anchor block header hash */
  lookupanchorhash: HashValue
  /** Lookup-anchor block timeslot */
  lookupanchortime: number
  /** Hash of any prerequisite work-packages */
  prerequisites: HashValue[]
}

/**
 * Work package context structure - alias for WorkContext to maintain compatibility
 */
export interface WorkPackageContext extends WorkContext {}

/**
 * Work digest structure - unified with block-authoring WorkDigest
 */
export interface WorkDigest {
  serviceIndex: number
  codeHash: HashValue
  payloadHash: HashValue
  gasLimit: number
  result: Uint8Array | WorkError
  gasUsed: number
  importCount: number
  exportCount: number
  extrinsicCount: number
  extrinsicSize: number
}

/**
 * Authorizer structure
 */
export interface Authorizer {
  code_hash: HashValue
  params: HexString // hex string
}

/**
 * Work package structure
 */
export interface WorkPackage {
  authorization: HexString // hex string
  auth_code_host: number
  authorizer: Authorizer
  context: WorkContext
  items: WorkItem[]
}

/**
 * Runtime work package structure - unified with block-authoring WorkPackage
 */
export interface RuntimeWorkPackage {
  id: string
  data: HexString
  author: HexString
  timestamp: number
  authToken: HexString
  authCodeHost: number
  authCodeHash: HexString
  authConfig: HexString
  context: WorkContext
  workItems: Array<{
    serviceIndex: number
    codeHash: HexString
    payload: HexString
    refGasLimit: number
    accGasLimit: number
    exportCount: number
    importSegments: Array<{
      hash: HexString
      index: number
    }>
    extrinsics: Array<{
      hash: HexString
      index: number
    }>
  }>
}

// ============================================================================
// Safrole Types
// ============================================================================

/**
 * Safrole ticket structure
 */
export interface SafroleTicket extends SafroleTicketCore {
  /** Additional ticket metadata for extended use cases */
  hash?: HashValue
  owner?: Address // 20-byte address
  stake?: string
  timestamp?: number
}

/**
 * Safrole state structure
 */
export interface SafroleState {
  /** Current epoch */
  epoch: number
  /** Current timeslot */
  timeslot: number
  /** Current entropy */
  entropy: HashValue
  /** Pending tickets */
  pendingset: SafroleTicket[]
  /** Epoch root hash */
  epochroot: HashValue
  /** Seal tickets (tickets or keys) */
  sealtickets: SafroleTicket[]
  /** Ticket accumulator */
  ticketaccumulator: HashValue
}

// ============================================================================
// Other Types
// ============================================================================

/**
 * Dispute structure according to Gray Paper (3-tuple: V, C, F)
 */
export interface Dispute {
  /** Validity disputes (V) */
  validityDisputes: ValidityDispute[]
  /** Challenge disputes (C) */
  challengeDisputes: Bytes
  /** Finality disputes (F) */
  finalityDisputes: Bytes
}

/**
 * Package specification structure
 */
export interface PackageSpec {
  hash: HashValue
  length: number
  erasure_root: HashValue
  exports_root: HashValue
  exports_count: number
}

/**
 * Work result type - either success data or error
 */
export type WorkResult = Uint8Array | WorkError

/**
 * Refine load structure
 */
export interface RefineLoad {
  gas_used: number
  imports: number
  extrinsic_count: number
  extrinsic_size: number
  exports: number
}

/**
 * Work report result structure
 */
export interface WorkReportResult {
  service_id: number
  code_hash: HashValue
  payload_hash: HashValue
  accumulate_gas: number
  result: WorkResult
  refine_load: RefineLoad
}

/**
 * Work report structure - unified with block-authoring WorkReport
 */
export interface WorkReport {
  id: string
  workPackageId: string
  availabilitySpec: {
    packageHash: HashValue
    bundleLength: number
    erasureRoot: HashValue
    segmentRoot: HashValue
    segmentCount: number
  }
  context: WorkContext
  coreIndex: number
  authorizer: HashValue
  authTrace: Uint8Array
  srLookup: Map<string, string> // segment root lookup
  digests: Array<{
    serviceIndex: number
    codeHash: HashValue
    payloadHash: HashValue
    gasLimit: number
    result: Uint8Array
    gasUsed: number
    importCount: number
    exportCount: number
    extrinsicCount: number
    extrinsicSize: number
  }>
  authGasUsed: number
  author: HexString
  timestamp: number
}

/**
 * Privileges structure
 */
export interface Privileges {
  /** Manager service ID */
  manager: number
  /** Assigners service ID */
  assigners: number
  /** Delegator service ID */
  delegator: number
  /** Registrar service ID */
  registrar: number
  /** Always accessible services */
  alwaysaccers: Address[] // 20-byte addresses
}

/**
 * Activity stats structure
 */
export interface ActivityStats {
  /** Validator stats accumulator */
  valstatsaccumulator: number
  /** Validator stats previous */
  valstatsprevious: number
  /** Core statistics */
  corestats: Uint8Array
  /** Service statistics */
  servicestats: Uint8Array
}

/**
 * Ready item structure
 */
export interface ReadyItem {
  /** Request hash */
  request: HashValue
  /** Request data */
  data: Uint8Array
}

/**
 * Accumulated item structure
 */
export interface AccumulatedItem {
  /** Item data */
  data: Uint8Array
}

/**
 * Last account out structure
 */
export interface LastAccountOut {
  /** Service ID */
  serviceId: number
  /** Account hash */
  hash: HashValue
}

/**
 * Service account structure
 */
export interface ServiceAccount {
  /** Account balance */
  balance: string
  /** Account nonce */
  nonce: number
  /** Is validator account */
  isValidator: boolean
  /** Validator public key */
  validatorKey?: HashValue
  /** Validator stake */
  stake?: string
  /** Account storage */
  storage: Map<HashValue, Uint8Array>
  /** Account preimages */
  preimages: Map<HashValue, Uint8Array>
  /** Account requests */
  requests: Map<HashValue, Uint8Array>
  /** Account gratis */
  gratis: bigint
  /** Account code hash */
  codehash: HashValue
  /** Minimum accumulate gas */
  minaccgas: bigint
  /** Minimum memory gas */
  minmemogas: bigint
  /** Account octets */
  octets: bigint
  /** Account items */
  items: number
  /** Account created timestamp */
  created: number
  /** Last account timestamp */
  lastacc: number
  /** Parent service ID */
  parent: number
}

/**
 * Genesis state structure
 */
export interface GenesisState {
  /** Service accounts */
  accounts: Record<`0x${string}`, ServiceAccount> // 20-byte addresses
  /** Validators */
  validators: Array<{
    address: `0x${string}` // 20-byte address
    publicKey: HashValue
    stake: string
    isActive: boolean
    altname?: string
  }>
  /** Safrole state */
  safrole: SafroleState
}

/**
 * State trie entry structure
 */
export interface StateTrieEntry {
  /** State key (31 Uint8Array as hex) */
  key: `0x${string}`
  /** State value (serialized data as hex) */
  value: `0x${string}`
}

/**
 * State trie type
 */
export type StateTrie = Record<`0x${string}`, `0x${string}`>

// ============================================================================
// Constants
// ============================================================================

/**
 * Gray Paper constants
 */
export const GRAY_PAPER_CONSTANTS = {
  // Add any constants that are needed
} as const
