/**
 * Serialization Types for JAM Protocol
 *
 * Type definitions for serialization functions and data structures
 * Reference: Gray Paper serialization specifications
 */

import type { Hex } from 'viem'
import type { ExtrinsicReference, WorkError } from './pvm'
/**
 * Gray Paper Compliant Preimage Structure (XT_preimages)
 *
 * Gray Paper Reference: Section "Work Packages and Work Reports" - Extrinsic Data
 * Location: text/work_packages_and_reports.tex, text/accounts.tex
 *
 * Preimages are data blobs referenced by hash in work packages. They are introduced
 * into the system alongside work-packages and exposed to the Refine logic as arguments.
 * Preimages are committed to by including their hashes in work-packages.
 *
 * Matches Python types.py Preimage structure.
 *
 * Gray Paper Context:
 * - Part of block extrinsics (XT_preimages)
 * - Referenced by work-packages through hash commitments
 * - Available for lookup during work-package execution
 * - Subject to expunge period of Cexpungeperiod = 19,200 timeslots
 *
 * Structure Compliance:
 * ✅ requester: Service identifier that owns/requested this preimage
 * ✅ blob: The actual preimage data as octet sequence (Uint8Array)
 *
 * Note: Hash is calculated externally using Blake2b(data)
 */
export interface Preimage {
  requester: bigint
  blob: Hex
}

/**
 * Gray Paper Compliant GuaranteeSignature Structure (Part of ReportGuarantee)
 *
 * Represents a single validator signature within a guarantee.
 * Matches Python types.py GuaranteeSignature structure.
 *
 * Gray Paper Context: Part of ReportGuarantee signatures sequence
 * Structure: (validator_index, signature)
 *
 * Usage: Individual validator signature in guarantee attestation
 */
export interface GuaranteeSignature {
  /** Index of the validator providing the signature */
  validator_index: number
  /** Ed25519 signature from the validator */
  signature: Hex
}

/**
 * Gray Paper Compliant Guarantee Structure (XT_guarantees)
 *
 * Gray Paper Reference: Section "Guaranteeing" and "Work Report Guarantees"
 * Location: text/guaranteeing.tex, text/header.tex (equation for extrinsic hash)
 * Equation Reference: Header extrinsic hash calculation mentions guarantees structure
 *
 * Guarantees are validator attestations for work report validity. They are created by
 * guarantor validators who evaluate work-packages and commit to their correctness.
 * With sufficient guarantor signatures, work-reports may be included in blocks.
 *
 * Matches Python types.py ReportGuarantee structure.
 *
 * Gray Paper Context:
 * - Part of block extrinsics (XT_guarantees)
 * - Created by guarantor validators assigned to cores
 * - Requires minimum 2 guarantor signatures for inclusion
 * - Used for reward distribution to guarantors
 * - Includes cryptographic commitment to work-report correctness
 *
 * Structure Compliance:
 * ✅ report: The work-report being guaranteed (result of computereport)
 * ✅ slot: Timeslot when guarantee was created
 * ✅ signatures: Sequence of validator signatures/attestations
 *
 * Gray Paper Encoding:
 * Header extrinsic hash includes: tuple(blake(workReport), encode[4](slot), var(signatures))
 */
export interface Guarantee {
  report: WorkReport
  slot: bigint
  signatures: GuaranteeSignature[]
}

/**

/**
 * Verdict Structure (Gray Paper - Dispute Resolution)
 *
 * Represents a resolved dispute verdict with validator votes.
 * Matches Python types.py Verdict structure.
 *
 * Gray Paper Context: Part of block extrinsic disputes (XT_disputes)
 * Structure: (target, age, votes)
 *
 * Usage: Final verdict on work-report validity with validator consensus
 */
export interface Verdict {
  /** Hash of the work-report being judged */
  target: Hex
  /** Epoch age when verdict was reached */
  age: bigint
  /** Individual validator judgments/votes */
  votes: Judgment[]
}

/**
 * Individual Validator Judgment (Gray Paper - part of verdict)
 *
 * Represents a single validator's judgment on work-report validity.
 * Matches Python types.py Judgement structure.
 *
 * Gray Paper Context: Part of verdict votes sequence
 * Structure: (vote, index, signature)
 *
 * Usage: Individual validator vote in dispute resolution
 */
export interface Judgment {
  /** Validator's vote: true = valid, false = invalid */
  vote: boolean
  /** Index of the judging validator */
  index: bigint
  /** Ed25519 signature from the validator */
  signature: Hex
}

/**
 * Culprit Structure (Gray Paper - Challenge Disputes)
 *
 * Represents a validator accused of misbehavior.
 * Matches Python types.py Culprit structure.
 *
 * Gray Paper Context: Part of block extrinsic disputes (XT_disputes)
 * Structure: (target, key, signature)
 *
 * Usage: Evidence of validator misbehavior requiring punishment
 */
export interface Culprit {
  /** Hash of the work-report being challenged */
  target: Hex
  /** Public key of the accused validator */
  key: Hex
  /** Signature proving the accusation */
  signature: Hex
}

/**
 * Fault Structure (Gray Paper - Finality Disputes)
 *
 * Represents a validator fault with contradictory evidence.
 * Matches Python types.py Fault structure.
 *
 * Gray Paper Context: Part of block extrinsic disputes (XT_disputes)
 * Structure: (target, vote, key, signature)
 *
 * Usage: Evidence of validator contradiction requiring punishment
 */
export interface Fault {
  /** Hash of the work-report with contradictory evidence */
  target: Hex
  /** The contradictory vote/statement */
  vote: boolean
  /** Public key of the validator at fault */
  key: Hex
  /** Signature proving the fault */
  signature: Hex
}

/**
 * Assurance structure for data availability (Gray Paper - AvailAssurance)
 *
 * An assurance is a signed statement issued by validators when they are in possession
 * of all their corresponding erasure-coded chunks for a given work-report which is
 * currently pending availability. Matches Python types.py AvailAssurance structure.
 *
 * Gray Paper Context: Part of block extrinsic assurances (XT_assurances)
 * Structure: (anchor, bitfield, validator_index, signature)
 *
 * Usage: Validators attest to data availability for specific cores
 */
export interface Assurance {
  /**
   * The parent block hash that this assurance is anchored to.
   * Must equal the parent block hash H_parent for all assurances in a block.
   * This ensures assurances are tied to a specific block and cannot be replayed.
   */
  anchor: Hex

  /**
   * A bitfield representing which cores this validator assures availability for.
   * Each bit represents whether the validator assures availability for the corresponding core.
   * A value of 1 (true) at index i means the validator assures they are
   * contributing to the availability of the work-report on core i.
   */
  bitfield: Hex

  /**
   * The validator index (0 to C_valcount-1, where C_valcount = 1023)
   * of the validator who is issuing this assurance.
   * Must be unique within the assurances extrinsic and ordered by validator index.
   */
  validator_index: number

  /**
   * Ed25519 signature proving the authenticity of this assurance.
   * The signature is over the message: "$jam_available" || blake2b(encode(anchor, bitfield))
   * where the public key corresponds to the validator's Ed25519 verification key.
   * This ensures only the assigned validator can issue valid assurances.
   */
  signature: Hex
}

/**
 * Operand tuple structure for work item results
 */
export interface OperandTuple {
  packageHash: Hex // hash
  segmentRoot: Hex // hash
  authorizer: Hex
  payloadHash: Hex // hash
  gasLimit: bigint
  result: WorkExecutionResult
  authTrace: Uint8Array
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
 * @param bandersnatch - Bandersnatch public key (32 bytes)
 * @param ed25519 - Ed25519 public key (32 bytes)
 */
export interface ValidatorKeyTuple {
  bandersnatch: Hex
  ed25519: Hex
}

/**
 * Core Safrole ticket structure according to Gray Paper
 *
 * Gray Paper safrole.tex equations 289-292:
 * xt_tickets ∈ sequence{⟨xt_entryindex, xt_proof⟩}
 * where:
 *   xt_entryindex ∈ N_max{C_ticketentries}
 *   xt_proof ∈ bsringproof{epochroot'}{Xticket ∥ entropy'_2 ∥ xt_entryindex}{[]}
 *
 * Gray Paper safrole.tex equation 303:
 * st_id = banderout(xt_proof)  (ticket ID from VRF output)
 */
export interface SafroleTicket {
  /** Ticket ID (VRF output hash - banderout) */
  id: Hex
  /** Entry index (0 to C_ticketentries-1) */
  entryIndex: bigint
  /** Ring VRF proof (bsringproof) */
  proof: Hex
}

export type SafroleTicketWithoutProof = Omit<SafroleTicket, 'proof'>

export type SealKey = SafroleTicket | SafroleTicketWithoutProof | Uint8Array
export interface DecodingResult<T> {
  value: T
  remaining: Uint8Array
  consumed: number
}

/**
 * Import Segment Specification - Based on Gray Paper ImportSpec
 *
 * Gray Paper: ImportSpec as defined in ASN.1 specification
 * ASN.1: ImportSpec ::= SEQUENCE { tree-root OpaqueHash, index U16 }
 *
 * Test vectors confirm:
 * @param tree_root - 32-byte hash (0x-prefixed hex string)
 * @param index - U16 integer (0-65535)
 */
export interface ImportSegment {
  /** Root hash of the segment tree - Gray Paper: tree-root ∈ hash */
  treeRoot: Hex
  /** Index of the segment in the tree - Gray Paper: index ∈ U16 (0-65535) */
  index: number
}

/**
 * Work item structure according to Gray Paper equation \ref{eq:workitem}
 * @param serviceindex - Service index identifier
 * @param codehash - Code hash of the service
 * @param payload - Payload blob
 * @param refgaslimit - Gas limit for Refinement (64-bit)
 * @param accgaslimit - Gas limit for Accumulation (64-bit)
 * @param exportcount - Number of data segments exported
 * @param importsegments - Imported data segments
 * @param extrinsics - Extrinsic references
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
 * Gray Paper Compliant Authorizer Structure
 *
 * Gray Paper Equation 154-159: Authorizer concepts and computation
 *
 * wp_authorizer ≡ blake{wp_authcodehash ∥ wp_authconfig}
 *
 * An authorizer is NOT a standalone structure but rather a computed hash that
 * identifies authorization logic. It's derived from:
 * 1. Authorization code hash (wp_authcodehash)
 * 2. Authorization configuration blob (wp_authconfig)
 *
 * The authorizer system involves three key concepts:
 * - Authorizers: Logic that determines if a work-package is authorized
 * - Tokens: Opaque data included with work-package for authorization
 * - Traces: Opaque data characterizing successful authorization
 *
 * Gray Paper Context:
 * - Authorizers are identified as blake{authcodehash ∥ authconfig}
 * - Authorization code must be available from historical lookup
 * - Configuration is opaque data meaningful to the PVM code
 *
 * ❌ NON-COMPLIANT: Current interface doesn't match Gray Paper model
 * ✅ IMPROVEMENT NEEDED: Should represent authorization components, not final hash
 */

// Instead of a single "Authorizer" interface, Gray Paper suggests these components:

/**
 * Authorization Code Reference
 * Points to the PVM code that performs authorization logic
 */
export interface AuthorizationCode {
  /** Hash of the authorization code */
  codeHash: Hex
  /** Service ID hosting the authorization code */
  hostServiceId: bigint
}

/**
 * Authorization Configuration
 * Opaque configuration data for the authorization code
 */
export interface AuthorizationConfig {
  /** Configuration blob (opaque to protocol) */
  config: Uint8Array
}

/**
 * Authorization Token
 * Opaque data included with work-package to support authorization argument
 */
export interface AuthorizationToken {
  /** Token blob (opaque to protocol) */
  token: Uint8Array
}

/**
 * Authorization Trace
 * Opaque data characterizing successful authorization result
 */
export interface AuthorizationTrace {
  /** Trace blob (opaque to protocol) */
  trace: Uint8Array
}

/**
 * Computed Authorizer Hash
 * The actual authorizer identifier used in the protocol
 */
// export type AuthorizerHash = Hex // blake{authcodehash ∥ authconfig}

/**
 * Gray Paper Compliant Work Package Structure
 *
 * Gray Paper Equation 65: workpackage ≡ (authtoken, authcodehost, authcodehash, authconfig, context, workitems)
 *
 * This represents the CANONICAL work package structure as defined in the Gray Paper.
 * It contains exactly the fields specified for serialization/deserialization and matches
 * the encoding/decoding order in the serialization specification.
 *
 * Fields (Gray Paper terminology):
 * - authtoken: blob - authorization token for the package
 * - authcodehost: serviceid - index of service hosting authorization code
 * - authcodehash: hash - hash of the authorization code
 * - authconfig: blob - configuration data for authorization
 * - context: workcontext - refinement context (anchor, lookup, prerequisites)
 * - workitems: sequence[1:maxpackageitems] - individual work items
 *
 * Serialization Order (Gray Paper Equation 242):
 * 1. encode[4]{authcodehost} - 4-byte fixed-length service ID
 * 2. authcodehash - 32-byte hash
 * 3. context - work context structure
 * 4. var{authtoken} - variable-length blob with length prefix
 * 5. var{authconfig} - variable-length blob with length prefix
 * 6. var{workitems} - variable-length sequence with length prefix
 *
 * Usage: For serialization/deserialization and protocol compliance
 *
 * ✅ CORRECT: Matches Gray Paper specification exactly
 * ✅ CORRECT: Compatible with encodeWorkPackage/decodeWorkPackage functions
 */
export interface WorkPackage {
  /** Authorization token (Gray Paper: authtoken) */
  authToken: Hex
  /** Service hosting authorization code (Gray Paper: authcodehost) */
  authCodeHost: bigint
  /** Authorization code hash (Gray Paper: authcodehash) */
  authCodeHash: Hex
  /** Authorization configuration (Gray Paper: authconfig) */
  authConfig: Hex
  /** Work context (Gray Paper: context) */
  context: RefineContext
  /** Work items sequence (Gray Paper: workitems) */
  workItems: WorkItem[]
}

/**
 * Runtime work package structure - unified with block-authoring WorkPackage
 */
export interface RuntimeWorkPackage extends WorkPackage {
  id: Hex
  data: Hex
  author: Hex
  timestamp: bigint
}

// ============================================================================
// Safrole Types
// ============================================================================

/**
 * Extended Safrole ticket structure with additional metadata
 *
 * This extends the core ticket structure with additional fields
 * for application-specific use cases.
 */
// export interface SafroleTicket extends SafroleTicket {
//   /** Optional hash for additional verification */
//   hash?: Hex
//   /** Optional owner address (20-byte) */
//   owner?: Address
//   /** Optional stake amount */
//   stake?: string
//   /** Optional timestamp */
//   timestamp?: bigint
// }

// ============================================================================
// Other Types
// ============================================================================

/**
 * Dispute Extrinsic Structure (Gray Paper XT_disputes)
 *
 * Gray Paper Equation: XT_disputes ≡ (verdicts, culprits, faults)
 *
 * This represents BLOCK EXTRINSIC DATA - transient input for dispute resolution.
 * It contains new dispute information being submitted in a block that will be
 * processed to update the persistent Disputes state.
 *
 * Components:
 * - verdicts: Resolved verdicts on work-report validity with validator votes
 * - culprits: Validators accused of misbehavior requiring punishment
 * - faults: Validators with contradictory evidence requiring punishment
 *
 * Usage: Part of block extrinsics - processed by state transition function
 *
 * ⚠️  DO NOT CONFUSE with Disputes (state) - they serve different purposes:
 * - Dispute (this): Input data in blocks (temporary)
 * - Disputes: Persistent state outcomes (permanent)
 */
export interface Dispute {
  /** Verdicts on work-report validity (matches test vector structure) */
  verdicts: Verdict[]
  /** Culprits accused of misbehavior (matches test vector structure) */
  culprits: Culprit[]
  /** Faults with contradictory evidence (matches test vector structure) */
  faults: Fault[]
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
 * Work execution result type - either success data or error
 * Used in WorkDigest and OperandTuple interfaces
 */
export type WorkExecutionResult = Uint8Array | WorkError

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
  result: WorkExecutionResult
  refine_load: RefineLoad
}

/**
 * Gray Paper Compliant WorkPackageSpec Structure
 *
 * Matches Python types.py WorkPackageSpec structure exactly.
 *
 * Gray Paper Reference: Section "Work Packages and Work Reports"
 * Location: text/work_packages_and_reports.tex
 *
 * Same as AvailabilitySpecification
 *
 * Work package specification contains metadata about a work package:
 * 1. hash: Hash of the work package
 * 2. length: Length of the work package in bytes
 * 3. erasure_root: Root of the erasure coding tree
 * 4. exports_root: Root of the exports tree (segment tree root)
 * 5. exports_count: Number of exports (segment count)
 *
 * Structure Compliance:
 * ✅ hash: WorkPackageHash - work package identifier
 * ✅ length: U32 - package length in bytes
 * ✅ erasure_root: OpaqueHash - erasure coding root
 * ✅ exports_root: OpaqueHash - exports tree root
 * ✅ exports_count: U16 - number of exports
 */
export interface WorkPackageSpec {
  hash: Hex
  length: bigint
  erasure_root: Hex
  exports_root: Hex
  exports_count: bigint
}

/**
 * Gray Paper Compliant RefineContext Structure
 *
 * Matches Python types.py RefineContext structure exactly.
 *
 * Gray Paper Reference: Section "Work Packages and Work Reports"
 * Location: text/work_packages_and_reports.tex
 *
 * Refinement context contains execution environment information:
 * 1. anchor: block header hash denoting the block when the work package was evaluated
 * 2. state_root: State root hash of the posterior state after the anchor block was executed
 * 3. beefy_root: Beefy root hash
 * 4. lookup_anchor: Lookup anchor block header hash
 * 5. lookup_anchor_slot: Lookup anchor block timeslot
 * 6. prerequisites: Prerequisite work package hashes
 *
 * Structure Compliance:
 * ✅ anchor: HeaderHash - anchor block identifier
 * ✅ state_root: OpaqueHash - state root hash
 * ✅ beefy_root: OpaqueHash - beefy root hash
 * ✅ lookup_anchor: HeaderHash - lookup anchor identifier
 * ✅ lookup_anchor_slot: TimeSlot - lookup anchor timeslot
 * ✅ prerequisites: Vec<OpaqueHash> - prerequisite hashes
 */
export interface RefineContext {
  anchor: Hex
  state_root: Hex
  beefy_root: Hex
  lookup_anchor: Hex
  lookup_anchor_slot: bigint
  prerequisites: Hex[]
}

/**
 * Gray Paper Compliant SegmentRootLookupItem Structure
 *
 * Matches Python types.py SegmentRootLookupItem structure exactly.
 *
 * Gray Paper Reference: Section "Work Packages and Work Reports"
 * Location: text/work_packages_and_reports.tex
 *
 * Segment root lookup item maps work package hash to segment tree root:
 * 1. work_package_hash: Hash of the work package
 * 2. segment_tree_root: Root of the segment tree
 *
 * Structure Compliance:
 * ✅ work_package_hash: WorkReportHash - work package identifier
 * ✅ segment_tree_root: SegmentTreeRoot - segment tree root
 */
export interface SegmentRootLookupItem {
  work_package_hash: Hex
  segment_tree_root: Hex
}

/**
 * Gray Paper Compliant WorkExecResult Enum
 *
 * Matches Python types.py WorkExecResult enum exactly.
 *
 * Gray Paper Reference: Section "Work Packages and Work Reports"
 * Location: text/work_packages_and_reports.tex
 *
 * Work execution result represents the outcome of work execution:
 * 0: ok - successful execution with output
 * 1: out_of_gas - execution failed due to gas limit
 * 2: panic - execution panicked
 * 3: bad_exports - invalid exports
 * 4: output_oversize - output too large
 * 5: bad_code - invalid code
 * 6: code_oversize - code too large
 */
export enum WorkExecResult {
  Ok = 0,
  OutOfGas = 1,
  Panic = 2,
  BadExports = 3,
  OutputOversize = 4,
  BadCode = 5,
  CodeOversize = 6,
}

/**
 * Work execution result union type for encoding/decoding
 *
 * Matches Gray Paper specification from text/serialization.tex:
 * \encoderesult{o \in \workerror \cup \blob} \equiv \begin{cases}
 *   \tup{0, \var{o}} &\when o \in \blob \\
 *   1 &\when o = \infty \\
 *   2 &\when o = \panic \\
 *   3 &\when o = \badexports \\
 *   4 &\when o = \oversize \\
 *   5 &\when o = \token{BAD} \\
 *   6 &\when o = \token{BIG}
 * \end{cases}
 *
 * Can be:
 * - Hex string: Direct success result (e.g., "0xaabbcc")
 * - Object with ok: Success result with explicit ok field (e.g., {"ok": "0xaabbcc"})
 * - Object with panic: Panic result (e.g., {"panic": null})
 * - Error strings: Various error conditions
 */
export type WorkExecResultValue =
  | Hex // Success case with hex data
  | { ok: Hex } // Success case with explicit ok field
  | { panic: null } // Panic case
  | 'out_of_gas' // Out of gas error
  | 'bad_exports' // Bad exports error
  | 'oversize' // Output oversize error
  | 'bad_code' // Bad code error
  | 'code_oversize' // Code oversize error

/**
 * Gray Paper Compliant RefineLoad Structure
 *
 * Matches Python types.py RefineLoad structure exactly.
 *
 * Gray Paper Reference: Section "Work Packages and Work Reports"
 * Location: text/work_packages_and_reports.tex
 *
 * Refinement load contains execution statistics:
 * 1. gas_used: Gas consumed during execution
 * 2. imports: Number of imports
 * 3. extrinsic_count: Number of extrinsics
 * 4. extrinsic_size: Size of extrinsics
 * 5. exports: Number of exports
 *
 * Structure Compliance:
 * ✅ gas_used: Compact<U64> - gas consumed
 * ✅ imports: Compact<U16> - import count
 * ✅ extrinsic_count: Compact<U16> - extrinsic count
 * ✅ extrinsic_size: Compact<U32> - extrinsic size
 * ✅ exports: Compact<U16> - export count
 */
export interface RefineLoad {
  gas_used: bigint
  imports: bigint
  extrinsic_count: bigint
  extrinsic_size: bigint
  exports: bigint
}

/**
 * Gray Paper Compliant WorkResult Structure
 *
 * Matches Python types.py WorkResult structure exactly.
 *
 * Gray Paper Reference: Section "Work Packages and Work Reports"
 * Location: text/work_packages_and_reports.tex
 *
 * Work result contains the outcome of work item execution:
 * 1. service_id: Service identifier
 * 2. code_hash: Hash of service code
 * 3. payload_hash: Hash of work item payload
 * 4. accumulate_gas: Gas for accumulation
 * 5. result: Execution result (ok, error, etc.)
 * 6. refine_load: Refinement load statistics
 *
 * Structure Compliance:
 * ✅ service_id: ServiceId - service identifier
 * ✅ code_hash: OpaqueHash - service code hash
 * ✅ payload_hash: OpaqueHash - payload hash
 * ✅ accumulate_gas: Gas - accumulation gas limit
 * ✅ result: WorkExecResult - execution result
 * ✅ refine_load: RefineLoad - refinement statistics
 */
export interface WorkResult {
  service_id: bigint
  code_hash: Hex
  payload_hash: Hex
  accumulate_gas: bigint
  result: WorkExecResultValue
  refine_load: RefineLoad
}

/**
 * Gray Paper Compliant WorkReport Structure
 *
 * Matches Python types.py WorkReport structure exactly.
 *
 * Gray Paper Reference: Section "Work Packages and Work Reports"
 * Location: text/work_packages_and_reports.tex
 *
 * Work reports are the output of work package execution and contain:
 * 1. package_spec: Work package specification with hash, length, erasure root, etc.
 * 2. context: Refinement context with anchor, state root, beefy root, etc.
 * 3. core_index: Index of the core that executed the work
 * 4. authorizer_hash: Hash of the authorizer that authorized the work
 * 5. auth_gas_used: Gas consumed during authorization
 * 6. auth_output: Output from the authorizer execution
 * 7. segment_root_lookup: Lookup table for segment roots
 * 8. results: Results from work execution (service results)
 *
 * Structure Compliance:
 * ✅ package_spec: WorkPackageSpec - work package details
 * ✅ context: RefineContext - execution context
 * ✅ core_index: CoreIndex - core that executed the work
 * ✅ authorizer_hash: OpaqueHash - authorizer identifier
 * ✅ auth_gas_used: U64 - gas consumed during authorization
 * ✅ auth_output: AuthorizerOutput - authorizer execution output
 * ✅ segment_root_lookup: SegmentRootLookupItem[] - segment root mapping
 * ✅ results: WorkResult[] - work execution results
 */
export interface WorkReport {
  package_spec: WorkPackageSpec
  context: RefineContext
  core_index: bigint
  authorizer_hash: Hex
  auth_gas_used: bigint
  auth_output: Hex
  segment_root_lookup: SegmentRootLookupItem[]
  results: WorkResult[]
}

export interface RuntimeWorkReport extends WorkReport {
  id: Hex
  workPackageId: Hex
  author: Hex
  timestamp: bigint
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
 * Ready item structure for serialization
 */
export interface SerializationReadyItem {
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
// export interface ServiceAccount {
//   /** Account balance */
//   balance: bigint
//   /** Account nonce */
//   nonce: bigint
//   /** Is validator account */
//   isValidator: boolean
//   /** Validator public key */
//   validatorKey?: Hex
//   /** Validator stake */
//   stake?: bigint
//   /** Account storage */
//   storage: Map<Hex, Uint8Array>
//   /** Account preimages */
//   preimages: Map<Hex, Uint8Array>
//   /** Account requests */
//   requests: Map<Hex, Uint8Array>
//   /** Account gratis */
//   gratis: bigint
//   /** Account code hash */
//   codehash: Hex
//   /** Minimum accumulate gas */
//   minaccgas: bigint
//   /** Minimum memory gas */
//   minmemogas: bigint
//   /** Account octets */
//   octets: bigint
//   /** Account items */
//   items: bigint
//   /** Account created timestamp */
//   created: bigint
//   /** Last account timestamp */
//   lastacc: bigint
//   /** Parent service ID */
//   parent: bigint
//   /** Minimum balance requirement */
//   minbalance: bigint
// }

/**
 * Service Account Core structure according to Gray Paper specification.
 *
 * Gray Paper service account encoding (Chapter 255):
 * C(255, s) → encode{0, codehash, encode[8]{balance, minaccgas, minmemogas, octets, gratis}, encode[4]{items, created, lastacc, parent}}
 *
 * Core fields that are directly serialized in the state trie:
 * - codehash: 32-byte hash of service code
 * - balance: 8-byte service account balance
 * - minaccgas: 8-byte minimum accumulate gas requirement
 * - minmemogas: 8-byte minimum memory gas requirement
 * - octets: 8-byte total storage size (computed but serialized)
 * - gratis: 8-byte gratis gas allocation
 * - items: 4-byte number of storage items (computed but serialized)
 * - created: 4-byte timestamp when service was created
 * - lastacc: 4-byte timestamp of last accumulation
 * - parent: 4-byte parent service identifier
 */
export interface ServiceAccountCore {
  codehash: Hex // sa_codehash
  balance: bigint // sa_balance
  minaccgas: bigint // sa_minaccgas
  minmemogas: bigint // sa_minmemogas
  octets: bigint // sa_octets (computed, but serialized)
  gratis: bigint // sa_gratis
  items: bigint // sa_items (computed, but serialized)
  created: bigint // sa_created
  lastacc: bigint // sa_lastacc
  parent: bigint // sa_parent
}

/**
 * Preimage request key structure according to Gray Paper specification.
 *
 * Gray Paper accounts.tex equation (16) defines sa_requests as:
 * dictionary{tuple{hash, bloblength}}{sequence[:3]{timeslot}}
 *
 * The composite key consists of:
 * - hash: Blake2b hash of the requested preimage
 * - length: Expected length of the preimage blob in octets
 */
export interface PreimageRequestKey {
  hash: Hex
  length: bigint
}

/**
 * Preimage request status sequence according to Gray Paper specification.
 *
 * Gray Paper accounts.tex lines 104-110 defines the semantics:
 * - [] = requested but not yet supplied
 * - [t0] = available since timeslot t0
 * - [t0, t1] = was available from t0 until t1 (now unavailable)
 * - [t0, t1, t2] = was available t0-t1, now available again since t2
 *
 * Maximum length is 3 timeslots as per sequence[:3]{timeslot}
 */
export type PreimageRequestStatus = bigint[] // sequence[:3]{timeslot}

/**
 * Preimage request helper functions for nested map structure.
 *
 * These utilities make it easier to work with the nested map structure
 * while maintaining Gray Paper compliance for service account requests.
 */
export const PreimageRequestUtils = {
  /** Create a requested status (empty sequence) */
  createRequested(): PreimageRequestStatus {
    return []
  },

  /** Create an available status since timeslot t0 */
  createAvailable(t0: bigint): PreimageRequestStatus {
    return [t0]
  },

  /** Create an unavailable status (was available from t0 until t1) */
  createUnavailable(t0: bigint, t1: bigint): PreimageRequestStatus {
    return [t0, t1]
  },

  /** Create a re-available status (was available t0-t1, now available since t2) */
  createReAvailable(t0: bigint, t1: bigint, t2: bigint): PreimageRequestStatus {
    return [t0, t1, t2]
  },

  /** Check if preimage is currently available at given timeslot per Gray Paper equation (126) */
  isAvailable(status: PreimageRequestStatus, timeslot: bigint): boolean {
    switch (status.length) {
      case 0:
        return false // requested but not supplied
      case 1:
        return status[0] <= timeslot // available since t0
      case 2:
        return status[0] <= timeslot && timeslot < status[1] // was available t0-t1
      case 3:
        return (
          (status[0] <= timeslot && timeslot < status[1]) ||
          status[2] <= timeslot
        ) // t0-t1 or since t2
      default:
        return false // invalid status
    }
  },

  /** Get status name for debugging */
  getStatusName(status: PreimageRequestStatus): string {
    switch (status.length) {
      case 0:
        return 'requested'
      case 1:
        return 'available'
      case 2:
        return 'unavailable'
      case 3:
        return 'reavailable'
      default:
        return 'invalid'
    }
  },

  /** Set request status in nested map structure */
  setRequest(
    requests: Map<Hex, Map<bigint, PreimageRequestStatus>>,
    hash: Hex,
    length: bigint,
    status: PreimageRequestStatus,
  ): void {
    let hashMap = requests.get(hash)
    if (!hashMap) {
      hashMap = new Map()
      requests.set(hash, hashMap)
    }
    hashMap.set(length, status)
  },

  /** Get request status from nested map structure */
  getRequest(
    requests: Map<Hex, Map<bigint, PreimageRequestStatus>>,
    hash: Hex,
    length: bigint,
  ): PreimageRequestStatus | undefined {
    const hashMap = requests.get(hash)
    return hashMap?.get(length)
  },

  /** Check if request exists in nested map structure */
  hasRequest(
    requests: Map<Hex, Map<bigint, PreimageRequestStatus>>,
    hash: Hex,
    length: bigint,
  ): boolean {
    const hashMap = requests.get(hash)
    return hashMap?.has(length) ?? false
  },

  /** Get all lengths for a given hash */
  getLengthsForHash(
    requests: Map<Hex, Map<bigint, PreimageRequestStatus>>,
    hash: Hex,
  ): bigint[] {
    const hashMap = requests.get(hash)
    return hashMap ? Array.from(hashMap.keys()) : []
  },

  /** Get all hash-length pairs */
  getAllRequests(
    requests: Map<Hex, Map<bigint, PreimageRequestStatus>>,
  ): Array<{ hash: Hex; length: bigint; status: PreimageRequestStatus }> {
    const result: Array<{
      hash: Hex
      length: bigint
      status: PreimageRequestStatus
    }> = []
    for (const [hash, hashMap] of requests) {
      for (const [length, status] of hashMap) {
        result.push({ hash, length, status })
      }
    }
    return result
  },

  /** Create an empty requests map */
  createEmpty(): Map<Hex, Map<bigint, PreimageRequestStatus>> {
    return new Map()
  },

  /** Clone a requests map */
  clone(
    requests: Map<Hex, Map<bigint, PreimageRequestStatus>>,
  ): Map<Hex, Map<bigint, PreimageRequestStatus>> {
    const cloned = new Map<Hex, Map<bigint, PreimageRequestStatus>>()
    for (const [hash, hashMap] of requests) {
      cloned.set(hash, new Map(hashMap))
    }
    return cloned
  },
} as const

/**
 * Complete Service Account structure according to Gray Paper specification.
 *
 * Gray Paper accounts.tex equation (12-27) defines service account as:
 *
 * serviceaccount ≡ tuple{
 *   sa_storage ∈ dictionary{blob}{blob},
 *   sa_preimages ∈ dictionary{hash}{blob},
 *   sa_requests ∈ dictionary{tuple{hash, bloblength}}{sequence[:3]{timeslot}},
 *   sa_gratis ∈ balance,
 *   sa_codehash ∈ hash,
 *   sa_balance ∈ balance,
 *   sa_minaccgas ∈ gas,
 *   sa_minmemogas ∈ gas,
 *   sa_created ∈ timeslot,
 *   sa_lastacc ∈ timeslot,
 *   sa_parent ∈ serviceid
 * }
 *
 * State storage locations per Gray Paper:
 * - Core fields: Directly encoded in state trie at C(255, s)
 * - Storage: Key-value pairs at C(s, storage_key)
 * - Preimages: Hash-to-data mappings at C(s, preimage_hash)
 * - Requests: Preimage request metadata at C(s, request_hash, length)
 *
 * sa_requests semantics (accounts.tex lines 104-110):
 * - Maps (hash, length) → sequence of up to 3 timeslots
 * - [] = requested but not supplied
 * - [t0] = available since t0
 * - [t0, t1] = was available from t0 until t1 (now unavailable)
 * - [t0, t1, t2] = was available t0-t1, now available again since t2
 *
 * ✅ CORRECT: Nested map structure matches Gray Paper exactly
 * requests: Map<Hex, Map<bigint, PreimageRequestStatus>>
 *
 * This corresponds to:
 * dictionary{tuple{hash, bloblength}}{sequence[:3]{timeslot}}
 *
 * where:
 * - Outer Map<Hex, ...> groups by hash
 * - Inner Map<bigint, PreimageRequestStatus> maps length to status sequence
 * - PreimageRequestStatus = sequence[:3]{timeslot} (up to 3 time slots)
 *
 * Benefits of nested map structure:
 * - Natural grouping by hash (common access pattern)
 * - Easier iteration over all lengths for a given hash
 * - More efficient lookups when hash is known
 * - Better alignment with state trie storage patterns
 */
export interface ServiceAccount extends ServiceAccountCore {
  storage: Map<Hex, Uint8Array> // sa_storage - stored at C(s, storage_key)
  preimages: Map<Hex, Uint8Array> // sa_preimages - stored at C(s, preimage_hash)
  requests: Map<Hex, Map<bigint, PreimageRequestStatus>> // sa_requests - ✅ GRAY PAPER COMPLIANT (nested map)
}

// Note: GenesisState moved to @pbnj/types/genesis for Gray Paper compliance

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
