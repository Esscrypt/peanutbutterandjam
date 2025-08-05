/**
 * Core Types for Gray Paper Serialization
 *
 * Type definitions for serialization functions and data structures
 * Reference: Gray Paper Appendix D - Serialization
 */

import type {
  BitSequence,
  Decoder,
  DeserializationContext,
  DeserializationResult,
  Dictionary,
  Encoder,
  FixedLengthSize,
  FixedOctetSequence,
  HashValue,
  Natural,
  OctetSequence,
  Optional,
  OptionalDecoder,
  OptionalEncoder,
  Sequence,
  SerializationContext,
  SerializationError,
  SerializationResult,
  Tuple,
  VariableOctetSequence,
} from '@pbnj/core'

// Re-export common types from core
export type {
  Natural,
  OctetSequence,
  VariableOctetSequence,
  FixedOctetSequence,
  BitSequence,
  HashValue,
  Optional,
  Tuple,
  Sequence,
  Dictionary,
  SerializationResult,
  DeserializationResult,
  SerializationError,
  SerializationContext,
  DeserializationContext,
  FixedLengthSize,
  Encoder,
  Decoder,
  OptionalEncoder,
  OptionalDecoder,
}

// Re-export constants
export { GRAY_PAPER_CONSTANTS } from '@pbnj/core'

// ============================================================================
// Block Header Types
// ============================================================================

/**
 * Block header structure
 */
export interface BlockHeader {
  parentHash: HashValue
  priorStateRoot: HashValue
  extrinsicHash: HashValue
  timeslot: Natural
  epochMark?: HashValue
  winnersMark?: HashValue
  authorIndex: Natural
  vrfSignature: HashValue
  offendersMark: OctetSequence
  sealSignature: HashValue
}

/**
 * Unsigned block header (without seal signature)
 */
export type UnsignedBlockHeader = Omit<BlockHeader, 'sealSignature'>

// ============================================================================
// Work Package Types
// ============================================================================

/**
 * Work context structure
 */
export interface WorkContext {
  anchorHash: HashValue
  anchorPostState: HashValue
  anchorAccountLog: OctetSequence
  lookupAnchorHash: HashValue
  lookupAnchorTime: Natural
  prerequisites: OctetSequence
}

/**
 * Availability specification structure
 */
export interface AvailabilitySpecification {
  packageHash: HashValue
  bundleLength: Natural
  erasureRoot: HashValue
  segmentRoot: HashValue
  segmentCount: Natural
}

/**
 * Work digest structure
 */
export interface WorkDigest {
  serviceIndex: Natural
  codeHash: HashValue
  payloadHash: HashValue
  gasLimit: Natural
  result: WorkResult
  gasUsed: Natural
  importCount: Natural
  extrinsicCount: Natural
  extrinsicSize: Natural
  exportCount: Natural
}

/**
 * Work result type
 */
export type WorkResult = OctetSequence | WorkError

/**
 * Work error types
 */
export enum WorkError {
  INFINITY = 'infinity',
  PANIC = 'panic',
  BAD_EXPORTS = 'bad_exports',
  OVERSIZE = 'oversize',
  BAD = 'bad',
  BIG = 'big',
}

/**
 * Work report structure
 */
export interface WorkReport {
  availabilitySpecification: AvailabilitySpecification
  context: WorkContext
  core: OctetSequence
  authorizer: HashValue
  authGasUsed: Natural
  authTrace: OctetSequence
  stateRootLookup: OctetSequence
  digests: WorkDigest[]
}

/**
 * Work package structure
 */
export interface WorkPackage {
  authCodeHost: Natural
  authCodeHash: HashValue
  context: WorkContext
  authToken: OctetSequence
  authConfig: OctetSequence
  workItems: WorkItem[]
}

/**
 * Work item structure
 */
export interface WorkItem {
  serviceIndex: Natural
  codeHash: HashValue
  refGasLimit: Natural
  accGasLimit: Natural
  exportCount: Natural
  payload: OctetSequence
  importSegments: ImportReference[]
  extrinsics: ExtrinsicReference[]
}

/**
 * Import reference structure
 */
export interface ImportReference {
  hash: HashValue
  index: Natural
}

/**
 * Extrinsic reference structure
 */
export interface ExtrinsicReference {
  hash: HashValue
  index: Natural
}

// ============================================================================
// PVM-Specific Types
// ============================================================================

/**
 * Safrole ticket structure
 */
export interface SafroleTicket {
  id: HashValue
  entryIndex: Natural
}

/**
 * Preimage structure
 */
export interface Preimage {
  serviceIndex: Natural
  data: OctetSequence
}

/**
 * Credential structure
 */
export interface Credential {
  value: Natural
  signature: OctetSequence
}

/**
 * Guarantee structure
 */
export interface Guarantee {
  workReport: WorkReport
  timeslot: Natural
  credential: Credential[]
}

/**
 * Assurance structure
 */
export interface Assurance {
  anchor: HashValue
  availabilities: AvailabilitySpecification[]
  assurer: Natural
  signature: OctetSequence
}

/**
 * Judgment structure
 */
export interface Judgment {
  validity: OctetSequence
  judgeIndex: Natural
  signature: OctetSequence
}

/**
 * Validity dispute structure
 */
export interface ValidityDispute {
  reportHash: HashValue
  epochIndex: Natural
  judgments: Judgment[]
}

/**
 * Dispute structure
 */
export interface Dispute {
  validityDisputes: ValidityDispute[]
  challengeDisputes: OctetSequence
  finalityDisputes: OctetSequence
}

/**
 * Deferred transfer structure
 */
export interface DeferredTransfer {
  source: Natural
  destination: Natural
  amount: Natural
  memo: OctetSequence
  gas: Natural
}

/**
 * Operand tuple structure
 */
export interface OperandTuple {
  packageHash: HashValue
  segmentRoot: HashValue
  authorizer: HashValue
  payloadHash: HashValue
  gasLimit: Natural
  result: WorkResult
  authTrace: OctetSequence
}

/**
 * Accumulate input structure
 */
export type AccumulateInput =
  | { type: 'operand'; value: OperandTuple }
  | { type: 'deferred'; value: DeferredTransfer }
