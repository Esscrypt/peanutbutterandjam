/**
 * Serialization Types for JAM Protocol
 *
 * Type definitions for serialization functions and data structures
 * Reference: Gray Paper serialization specifications
 */

import type { HashValue, HexString } from './core'

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
 * Type guard to check if tickets_mark is an array
 */
export function isTicketsMarkArray(ticketsMark: any): ticketsMark is SafroleTicketArray[] {
  return Array.isArray(ticketsMark)
}

/**
 * Type guard to check if tickets_mark is a single object
 */
export function isTicketsMarkSingle(ticketsMark: any): ticketsMark is SafroleTicketSingle {
  return ticketsMark && typeof ticketsMark === 'object' && !Array.isArray(ticketsMark) && 'entry_index' in ticketsMark
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
 * Import segment structure (matches test vectors)
 */
export interface ImportSegment {
  tree_root: HashValue
  index: number
}

/**
 * Extrinsic reference structure (matches test vectors)
 */
export interface ExtrinsicReference {
  hash: HashValue
  len: number
}

/**
 * Work item structure (matches test vectors exactly)
 */
export interface WorkItem {
  service: number
  code_hash: HashValue
  payload: HexString // hex string
  refine_gas_limit: number
  accumulate_gas_limit: number
  import_segments: ImportSegment[]
  extrinsic: ExtrinsicReference[]
  export_count: number
}

/**
 * Work context structure (matches test vectors)
 */
export interface WorkContext {
  anchor: HashValue
  state_root: HashValue
  beefy_root: HashValue
  lookup_anchor: HashValue
  lookup_anchor_slot: number
  prerequisites: any[]
}

/**
 * Authorizer structure (matches test vectors)
 */
export interface Authorizer {
  code_hash: HashValue
  params: HexString // hex string
}

/**
 * Work package structure (matches test vectors exactly)
 */
export interface WorkPackage {
  authorization: HexString // hex string
  auth_code_host: number
  authorizer: Authorizer
  context: WorkContext
  items: WorkItem[]
}

// ============================================================================
// State Types
// ============================================================================

/**
 * Safrole ticket structure
 */
export interface SafroleTicket {
  /** Ticket hash */
  hash: HashValue
  /** Ticket owner */
  owner: `0x${string}` // 20-byte address
  /** Ticket stake */
  stake: string
  /** Ticket timestamp */
  timestamp: number
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

/**
 * Dispute structure
 */
export interface Dispute {
  /** Dispute hash */
  hash: HashValue
  /** Dispute type */
  type: number
  /** Dispute data */
  data: Uint8Array
}

/**
 * Package specification structure (matches test vectors)
 */
export interface PackageSpec {
  hash: HashValue
  length: number
  erasure_root: HashValue
  exports_root: HashValue
  exports_count: number
}

/**
 * Work result structure (matches test vectors)
 */
export interface WorkResult {
  ok?: string // hex string
  panic?: any
}

/**
 * Refine load structure (matches test vectors)
 */
export interface RefineLoad {
  gas_used: number
  imports: number
  extrinsic_count: number
  extrinsic_size: number
  exports: number
}

/**
 * Work report result structure (matches test vectors)
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
 * Work report structure (matches test vectors exactly)
 */
export interface WorkReport {
  package_spec: PackageSpec
  context: WorkContext
  core_index: number
  authorizer_hash: HashValue
  auth_output: HexString // hex string
  segment_root_lookup: any[]
  results: WorkReportResult[]
  auth_gas_used: number
}

/**
 * Privilege structure
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
  alwaysaccers: `0x${string}`[] // 20-byte addresses
}

/**
 * Activity statistics structure
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
 * State trie entry
 */
export interface StateTrieEntry {
  /** State key (31 Uint8Array as hex) */
  key: `0x${string}`
  /** State value (serialized data as hex) */
  value: `0x${string}`
}

/**
 * Complete state trie
 */
export type StateTrie = Record<`0x${string}`, `0x${string}`>
