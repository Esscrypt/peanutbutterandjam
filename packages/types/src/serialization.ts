/**
 * Serialization Types for JAM Protocol
 *
 * Type definitions for serialization functions and data structures
 * Reference: Gray Paper serialization specifications
 */

import type { Address, Hex } from 'viem'
import type { AlternativeName } from './core'
import type { WorkError } from './pvm'
/**
 * Preimage structure for data referenced by hash
 */
export interface Preimage {
  serviceIndex: bigint
  data: Uint8Array
}

/**
 * Guarantee structure for work report attestations
 */
export interface Guarantee {
  workReport: WorkReport
  timeslot: bigint
  credential: Credential[]
}

/**
 * Credential structure for validator signatures
 */
export interface Credential {
  value: bigint
  signature: Uint8Array
}

/**
 * Validity dispute structure
 */
export interface ValidityDispute {
  reportHash: Hex
  epochIndex: bigint
  judgments: Judgment[]
}

/**
 * Judgment structure for dispute resolution
 */
export interface Judgment {
  validity: boolean
  judgeIndex: bigint
  signature: Uint8Array
}

/**
 * Assurance structure for data availability
 */
export interface Assurance {
  anchor: Hex
  availabilities: Uint8Array
  assurer: bigint
  signature: Uint8Array
}

/**
 * Operand tuple structure for work item results
 */
export interface OperandTuple {
  packageHash: Hex
  segmentRoot: Hex
  authorizer: Hex
  payloadHash: Hex
  gasLimit: bigint
  result: WorkResult
  authTrace: Uint8Array
}

/**
 * Availability specification structure
 */
export interface AvailabilitySpecification {
  packageHash: Hex
  bundleLength: bigint
  erasureRoot: Hex
  segmentRoot: Hex
  segmentCount: bigint
}

/**
 * Extrinsic reference structure
 */
export interface ExtrinsicReference {
  hash: Hex
  length: bigint
}

/**
 * Authorizer structure
 */
export interface Authorizer {
  publicKey: Hex
  weight: bigint
}

// ============================================================================
// Block Header Types (matches exactly what JAM test vectors provide)
// ============================================================================

/**
 * Validator structure (matches test vectors)
 */
export interface ValidatorKeyTuple {
  bandersnatch: Hex
  ed25519: Hex
}

/**
 * Epoch mark structure (matches test vectors)
 */
export interface EpochMark {
  entropy: Hex
  tickets_entropy: Hex
  validators: ValidatorKeyTuple[]
}

/**
 * Ticket structure (single object format - matches test vectors)
 */
export interface SafroleTicketSingle {
  id: Hex
  entry_index: bigint
}

/**
 * Ticket structure (array format - matches test vectors)
 */
export interface SafroleTicketArray {
  id: Hex
  attempt: bigint
}

/**
 * Block header structure (matches test vectors exactly)
 */
export interface BlockHeader {
  parent: Hex
  parent_state_root: Hex
  extrinsic_hash: Hex
  slot: bigint
  epoch_mark: EpochMark | null
  tickets_mark: SafroleTicketSingle | SafroleTicketArray[] | null
  offenders_mark: Hex[]
  author_index: bigint
  entropy_source: Hex
  seal: Hex
}

/**
 * JAM validator key pair for epoch marker
 */
export interface ValidatorKeyPair {
  bandersnatch: Hex // 32-byte Bandersnatch key
  ed25519: Hex // 32-byte Ed25519 key
}

/**
 * JAM epoch marker containing entropy and validators
 */
export interface EpochMark {
  entropy: Hex // 32-byte entropy accumulator
  tickets_entropy: Hex // 32-byte tickets entropy
  validators: ValidatorKeyPair[] // Validator key pairs
}

/**
 * JAM Safrole ticket for winning tickets marker
 */
export interface SafroleTicketHeader {
  attempt: bigint
  signature: Hex
}

export interface SafroleTicketCore {
  id: Hex
  entryIndex: bigint
}

/**
 * JAM block header according to Gray Paper specification
 * Matches the test vector structure for header_0.json
 */
export interface JamHeader {
  parent: Hex // H_parent - parent block hash
  parent_state_root: Hex // H_priorstateroot - prior state root
  extrinsic_hash: Hex // H_extrinsichash - extrinsic data hash
  slot: bigint // H_timeslot - time slot index (32-bit)
  epoch_mark: EpochMark | null // H_epochmark - optional epoch marker
  winners_mark: SafroleTicketHeader[] | null // H_winnersmark - optional winning tickets
  offenders_mark: Hex[] // H_offendersmark - sequence of Ed25519 offender keys
  author_index: bigint // H_authorindex - block author index (16-bit)
  vrf_sig: Hex // H_vrfsig - VRF signature (96 bytes but stored as hex)
  seal_sig: Hex // H_sealsig - block seal signature (96 bytes but stored as hex)
}

// /**
//  * Legacy simplified header type for compatibility
//  * Can be cast to/from BlockHeader for reuse in other packages
//  */
// export interface SerializationHeader {
//   parent_hash: Hex
//   bigint: bigint
//   state_root: Hex
//   extrinsics_root: Hex
//   digest: Digest
// }

/**
 * Type guard to check if tickets_mark is an array
 */
export function isTicketsMarkArray(
  ticketsMark: unknown,
): ticketsMark is SafroleTicketArray[] {
  return Array.isArray(ticketsMark)
}

/**
 * Type guard to check if tickets_mark is a single object
 */
export function isTicketsMarkSingle(
  ticketsMark: unknown,
): ticketsMark is SafroleTicketSingle {
  return (
    ticketsMark !== null &&
    typeof ticketsMark === 'object' &&
    !Array.isArray(ticketsMark) &&
    ticketsMark !== undefined &&
    'entry_index' in (ticketsMark as Record<string, unknown>)
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
// export enum WorkError {
//   OVERSIZE = 'oversize',
//   BAD_EXPORTS = 'bad_exports',
//   INVALID_RESULT = 'invalid_result',
//   GAS_LIMIT_EXCEEDED = 'gas_limit_exceeded',
//   AUTHORIZATION_FAILED = 'authorization_failed',
// }

/**
 * Import segment structure
 */
export interface ImportSegment {
  hash: Hex // Root hash of the import tree
  index: bigint
}

/**
 * Extrinsic reference structure
 */
export interface ExtrinsicReference {
  hash: Hex
  length: bigint
}

/**
 * Work item structure according to Gray Paper equation \ref{eq:workitem}
 */
export interface WorkItem {
  /** Service index identifier */
  serviceindex: bigint
  /** Code hash of the service */
  codehash: Hex
  /** Payload blob */
  payload: Hex
  /** Gas limit for Refinement (64-bit) */
  refgaslimit: bigint
  /** Gas limit for Accumulation (64-bit) */
  accgaslimit: bigint
  /** Number of data segments exported */
  exportcount: bigint
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
  anchorhash: Hex
  /** Anchor block posterior state-root */
  anchorpoststate: Hex
  /** Anchor block accumulation output log super-peak */
  anchoraccoutlog: Hex
  /** Lookup-anchor block header hash */
  lookupanchorhash: Hex
  /** Lookup-anchor block timeslot */
  lookupanchortime: bigint
  /** Hash of any prerequisite work-packages */
  prerequisites: Hex[]
}

/**
 * Work package context structure - alias for WorkContext to maintain compatibility
 */
export interface WorkPackageContext extends WorkContext {}

/**
 * Work digest structure - unified with block-authoring WorkDigest
 */
export interface WorkDigest {
  serviceIndex: bigint
  codeHash: Hex
  payloadHash: Hex
  gasLimit: bigint
  result: Uint8Array | WorkError
  gasUsed: bigint
  importCount: bigint
  exportCount: bigint
  extrinsicCount: bigint
  extrinsicSize: bigint
}

/**
 * Authorizer structure
 */
export interface Authorizer {
  code_hash: Hex
  params: Hex // hex string
}

/**
 * Work package structure
 */
export interface WorkPackage {
  authorization: Hex // hex string
  auth_code_host: bigint
  authorizer: Authorizer
  context: WorkContext
  items: WorkItem[]
}

/**
 * Runtime work package structure - unified with block-authoring WorkPackage
 */
export interface RuntimeWorkPackage {
  id: Hex
  data: Hex
  author: Hex
  timestamp: bigint
  authToken: Hex
  authCodeHost: bigint
  authCodeHash: Hex
  authConfig: Hex
  context: WorkContext
  workItems: WorkItem[]
}

// ============================================================================
// Safrole Types
// ============================================================================

/**
 * Safrole ticket structure
 */
export interface SafroleTicket extends SafroleTicketCore {
  /** Additional ticket metadata for extended use cases */
  hash?: Hex
  owner?: Address // 20-byte address
  stake?: string
  timestamp?: bigint
}

/**
 * Safrole state structure
 */
export interface SafroleState {
  /** Current epoch */
  epoch: bigint
  /** Current timeslot */
  timeslot: bigint
  /** Current entropy */
  entropy: Hex
  /** Pending tickets */
  pendingset: SafroleTicket[]
  /** Epoch root hash */
  epochroot: Hex
  /** Seal tickets (tickets or keys) */
  sealtickets: SafroleTicket[]
  /** Ticket accumulator */
  ticketaccumulator: Hex
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
  challengeDisputes: Uint8Array
  /** Finality disputes (F) */
  finalityDisputes: Uint8Array
}

/**
 * Package specification structure
 */
export interface PackageSpec {
  hash: Hex
  length: bigint
  erasure_root: Hex
  exports_root: Hex
  exports_count: bigint
}

/**
 * Work result type - either success data or error
 */
export type WorkResult = Uint8Array | WorkError

/**
 * Refine load structure
 */
export interface RefineLoad {
  gas_used: bigint
  imports: bigint
  extrinsic_count: bigint
  extrinsic_size: bigint
  exports: bigint
}

/**
 * Work report result structure
 */
export interface WorkReportResult {
  service_id: bigint
  code_hash: Hex
  payload_hash: Hex
  accumulate_gas: bigint
  result: WorkResult
  refine_load: RefineLoad
}

/**
 * Work report structure - unified with block-authoring WorkReport
 */
export interface WorkReport {
  id: Hex
  workPackageId: Hex
  availabilitySpec: {
    packageHash: Hex
    bundleLength: bigint
    erasureRoot: Hex
    segmentRoot: Hex
    segmentCount: bigint
  }
  context: WorkContext
  coreIndex: bigint
  authorizer: Hex
  authTrace: Uint8Array
  srLookup: Map<Hex, Hex> // segment root lookup
  // digests: Array<{
  //   serviceIndex: bigint
  //   codeHash: Hex
  //   payloadHash: Hex
  //   gasLimit: bigint
  //   result: Uint8Array
  //   gasUsed: bigint
  //   importCount: bigint
  //   exportCount: bigint
  //   extrinsicCount: bigint
  //   extrinsicSize: bigint
  // }>
  digests: WorkDigest[]
  authGasUsed: bigint
  author: Hex
  timestamp: bigint
}

/**
 * Privileges structure
 */
export interface Privileges {
  /** Manager service ID */
  manager: bigint
  /** Assigners service ID */
  assigners: bigint
  /** Delegator service ID */
  delegator: bigint
  /** Registrar service ID */
  registrar: bigint
  /** Always accessible services */
  alwaysaccers: Address[] // 20-byte addresses
}

/**
 * Activity stats structure
 */
export interface ActivityStats {
  /** Validator stats accumulator */
  valstatsaccumulator: bigint
  /** Validator stats previous */
  valstatsprevious: bigint
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
  request: Hex
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
  serviceId: bigint
  /** Account hash */
  hash: Hex
}

/**
 * Service account structure
 */
export interface ServiceAccount {
  /** Account balance */
  balance: bigint
  /** Account nonce */
  nonce: bigint
  /** Is validator account */
  isValidator: boolean
  /** Validator public key */
  validatorKey?: Hex
  /** Validator stake */
  stake?: bigint
  /** Account storage */
  storage: Map<Hex, Uint8Array>
  /** Account preimages */
  preimages: Map<Hex, Uint8Array>
  /** Account requests */
  requests: Map<Hex, Uint8Array>
  /** Account gratis */
  gratis: bigint
  /** Account code hash */
  codehash: Hex
  /** Minimum accumulate gas */
  minaccgas: bigint
  /** Minimum memory gas */
  minmemogas: bigint
  /** Account octets */
  octets: bigint
  /** Account items */
  items: bigint
  /** Account created timestamp */
  created: bigint
  /** Last account timestamp */
  lastacc: bigint
  /** Parent service ID */
  parent: bigint
  /** Minimum balance requirement */
  minbalance: bigint
}

/**
 * Genesis state structure
 */
export interface GenesisState {
  /** Service accounts */
  accounts: Map<Address, ServiceAccount> // 20-byte addresses
  /** Validators */
  validators: Array<{
    address: Address // 20-byte address
    publicKey: Hex
    stake: bigint
    isActive: boolean
    altname?: AlternativeName
  }>
  /** Safrole state */
  safrole: SafroleState
}

/**
 * State trie entry structure
 */
export interface StateTrieEntry {
  /** State key (31 Uint8Array as hex) */
  key: Hex
  /** State value (serialized data as hex) */
  value: Hex
}

/**
 * State trie type
 */
export type StateTrie = Record<Hex, Hex>

// ============================================================================
// Constants
// ============================================================================

/**
 * Gray Paper constants
 */
export const GRAY_PAPER_CONSTANTS = {
  // Add any constants that are needed
} as const
