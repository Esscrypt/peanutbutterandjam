/**
 * Serialization Types for JAM Protocol
 *
 * Type definitions for serialization functions and data structures
 * Reference: Gray Paper serialization specifications
 */

import type { Address, Hex } from 'viem'
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
 * Gray Paper Context:
 * - Part of block extrinsics (XT_preimages)
 * - Referenced by work-packages through hash commitments
 * - Available for lookup during work-package execution
 * - Subject to expunge period of Cexpungeperiod = 19,200 timeslots
 *
 * Structure Compliance:
 * ✅ serviceIndex: Service identifier that owns/requested this preimage
 * ✅ data: The actual preimage data as octet sequence (Uint8Array)
 *
 * Note: Hash is calculated externally using Blake2b(data)
 */
export interface Preimage {
  serviceIndex: bigint
  data: Hex
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
 * Gray Paper Context:
 * - Part of block extrinsics (XT_guarantees)
 * - Created by guarantor validators assigned to cores
 * - Requires minimum 2 guarantor signatures for inclusion
 * - Used for reward distribution to guarantors
 * - Includes cryptographic commitment to work-report correctness
 *
 * Structure Compliance:
 * ✅ workReport: The work-report being guaranteed (result of computereport)
 * ✅ timeslot: Timeslot when guarantee was created
 * ✅ credential: Sequence of validator signatures/attestations
 *
 * Gray Paper Encoding:
 * Header extrinsic hash includes: tuple(blake(workReport), encode[4](timeslot), var(credential))
 */
export interface Guarantee {
  workReport: WorkReport
  timeslot: bigint
  credential: Credential[]
}

/**
 * Gray Paper Compliant Credential Structure (Part of Guarantee)
 *
 * Gray Paper Reference: Section "Guaranteeing" - Guarantor Signatures
 * Location: text/guaranteeing.tex (equation 23-24 for signature creation)
 * Context: Part of guarantee credential sequence in XT_guarantees
 *
 * Credentials represent individual validator signatures/attestations within a guarantee.
 * Each credential is a cryptographic commitment by a validator to the correctness of
 * a work-report. The signature is created using the validator's registered Ed25519 key.
 *
 * Gray Paper Context:
 * - Part of guarantee structure (credential: Credential[])
 * - Created by guarantor validators assigned to specific cores
 * - Signature payload: l = blake(encode(workReport))
 * - Uses validator's registered Ed25519 key for signing
 * - Multiple credentials required for work-report inclusion (minimum 2)
 *
 * Structure Compliance:
 * ✅ value: Validator index or value associated with this credential
 * ✅ signature: Ed25519 signature over blake(encode(workReport))
 *
 * Gray Paper Equation Reference:
 * - Section guaranteeing.tex: "s" signature using Ed25519 key on payload "l"
 * - l = blake(encode(r)) where r is the work-report
 */
export interface Credential {
  value: bigint
  signature: Hex
}

/**
 * Validity Dispute Structure (Gray Paper - part of verdicts)
 *
 * Represents a single validity dispute within the verdicts component of dispute extrinsics.
 * Contains judgments from validators about whether a specific work-report is valid.
 *
 * Gray Paper Context: Part of XT_disputes verdicts component
 * Structure: (report_hash, epoch_index, sequence[judgments])
 *
 * Usage: Collected from validators and included in dispute extrinsics
 */
export interface ValidityDispute {
  /** Hash of the work-report being disputed */
  reportHash: Hex
  /** Epoch index when the dispute was raised */
  epochIndex: bigint
  /** Individual validator judgments on this report */
  judgments: Judgment[]
}

/**
 * Individual Validator Judgment (Gray Paper - part of validity dispute)
 *
 * Represents a single validator's judgment on work-report validity.
 * Must be signed by the validator's Ed25519 key and requires 2/3+1 consensus.
 *
 * Gray Paper Context: Part of validity dispute judgments sequence
 * Structure: (validity, judge_index, signature)
 *
 * Usage: Aggregated to determine final verdict (good/bad/wonky)
 */
export interface Judgment {
  /** Validator's judgment: true = valid, false = invalid */
  validity: boolean
  /** Index of the judging validator */
  judgeIndex: bigint
  /** Ed25519 signature from the validator */
  signature: Hex
}

/**
 * Assurance structure for data availability
 *
 * An assurance is a signed statement issued by validators when they are in possession
 * of all their corresponding erasure-coded chunks for a given work-report which is
 * currently pending availability. This is part of the JAM protocol's data availability
 * mechanism as specified in the Gray Paper section 4.2.
 */
export interface Assurance {
  /**
   * The parent block hash that this assurance is anchored to.
   * Must equal the parent block hash H_parent for all assurances in a block.
   * This ensures assurances are tied to a specific block and cannot be replayed.
   */
  anchor: Hex // hash

  /**
   * A bitstring of length C_corecount (341 bits) where each bit represents
   * whether the validator assures availability for the corresponding core.
   * A value of 1 (true) at index i means the validator assures they are
   * contributing to the availability of the work-report on core i.
   * This is a "soft" implication with no on-chain consequences if dishonestly reported.
   */
  availabilities: Hex

  /**
   * The validator index (0 to C_valcount-1, where C_valcount = 1023)
   * of the validator who is issuing this assurance.
   * Must be unique within the assurances extrinsic and ordered by validator index.
   */
  assurer: bigint // validator index

  /**
   * Ed25519 signature proving the authenticity of this assurance.
   * The signature is over the message: "$jam_available" || blake2b(encode(anchor, availabilities))
   * where the public key corresponds to the assurer's Ed25519 verification key.
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
  result: WorkResult
  authTrace: Uint8Array
}

/**
 * Gray Paper Compliant Availability Specification Structure
 *
 * Gray Paper Equation 71 (label: eq:avspec): avspec ≡ (
 *   as_packagehash, as_bundlelen, as_erasureroot, as_segroot, as_segcount
 * )
 *
 * This represents the CANONICAL availability specification structure as defined
 * in the Gray Paper. It specifies the data availability requirements for a work-package,
 * including package identification, bundle size, and erasure coding roots.
 *
 * Fields (Gray Paper terminology):
 * - as_packagehash: hash - work-package hash identifier
 * - as_bundlelen: bloblength - auditable work bundle length
 * - as_erasureroot: hash - erasure-coding commitment root
 * - as_segroot: hash - segment-root (exported segments Merkle tree root)
 * - as_segcount: N - number of exported segments
 *
 * Field Order per Gray Paper:
 * 1. packagehash - 32-byte hash
 * 2. bundlelen - natural number (blob length)
 * 3. erasureroot - 32-byte hash
 * 4. segroot - 32-byte hash
 * 5. segcount - natural number
 *
 * ✅ GRAY PAPER COMPLIANT:
 * - Contains all 5 required fields
 * - Correct field names match Gray Paper terminology
 * - Correct field types (Hex for hashes, bigint for numbers)
 * - Correct field order matches serialization specification
 *
 * Usage: Part of WorkReport structure for guaranteeing and availability assurance
 * Related: Used in WorkReport.availabilitySpec field
 */
export interface AvailabilitySpecification {
  packageHash: Hex
  bundleLength: bigint
  erasureRoot: Hex
  segmentRoot: Hex
  segmentCount: bigint
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

export interface DecodingResult<T> {
  value: T
  remaining: Uint8Array
}

/**
 * Import Segment Specification - Based on Gray Paper ImportSpec
 *
 * Gray Paper: ImportSpec as defined in ASN.1 specification
 * ASN.1: ImportSpec ::= SEQUENCE { tree-root OpaqueHash, index U16 }
 *
 * Test vectors confirm:
 * - tree_root: 32-byte hash (0x-prefixed hex string)
 * - index: U16 integer (0-65535)
 */
export interface ImportSegment {
  /** Root hash of the segment tree - Gray Paper: tree-root ∈ hash */
  treeRoot: Hex
  /** Index of the segment in the tree - Gray Paper: index ∈ U16 (0-65535) */
  index: number
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
 * Gray Paper Compliant Work Context Structure
 *
 * Gray Paper Equation 57 (label: eq:workcontext): workcontext ≡ (
 *   wc_anchorhash, wc_anchorpoststate, wc_anchoraccoutlog,
 *   wc_lookupanchorhash, wc_lookupanchortime, wc_prerequisites
 * )
 *
 * A refinement context describes the context of the chain at the point
 * that the report's corresponding work-package was evaluated.
 *
 * It identifies two historical blocks:
 * 1. The ANCHOR: provides state context for work evaluation
 * 2. The LOOKUP-ANCHOR: provides import/lookup context
 *
 * ✅ CORRECT: All 6 required fields present according to Gray Paper
 * ✅ CORRECT: Field types match Gray Paper specification exactly
  
@param anchorHash - Anchor block header hash - Gray Paper: wc_anchorhash ∈ hash 
@param anchorPostState - Anchor block posterior state-root - Gray Paper: wc_anchorpoststate ∈ hash 
@param anchorAccoutLog - Anchor block accumulation output log super-peak - Gray Paper: wc_anchoraccoutlog ∈ hash 
@param lookupAnchorHash - Lookup-anchor block header hash - Gray Paper: wc_lookupanchorhash ∈ hash 
@param lookupAnchorTime - Lookup-anchor block timeslot - Gray Paper: wc_lookupanchortime ∈ timeslot
@param prerequisites - Hash of any prerequisite work-packages - Gray Paper: wc_prerequisites ∈ protoset{hash} 
*/
export interface WorkContext {
  /** Anchor block header hash - Gray Paper: wc_anchorhash ∈ hash */
  anchorHash: Hex

  /** Anchor block posterior state-root - Gray Paper: wc_anchorpoststate ∈ hash */
  anchorPostState: Hex

  /** Anchor block accumulation output log super-peak - Gray Paper: wc_anchoraccoutlog ∈ hash */
  anchorAccoutLog: Hex

  /** Lookup-anchor block header hash - Gray Paper: wc_lookupanchorhash ∈ hash */
  lookupAnchorHash: Hex

  /** Lookup-anchor block timeslot - Gray Paper: wc_lookupanchortime ∈ timeslot */
  lookupAnchorTime: bigint

  /** Hash of any prerequisite work-packages - Gray Paper: wc_prerequisites ∈ protoset{hash} */
  prerequisites: Hex[] // Array of 32-byte hashes
}

/**
 * Work package context structure - alias for WorkContext to maintain compatibility
 */
export interface WorkPackageContext extends WorkContext {}

/**
 * Gray Paper Compliant Work Digest Structure
 *
 * Gray Paper Equation 88 (label: eq:workdigest): workdigest ≡ (
 *   wd_serviceindex, wd_codehash, wd_payloadhash, wd_gaslimit, wd_result,
 *   wd_gasused, wd_importcount, wd_xtcount, wd_xtsize, wd_exportcount
 * )
 *
 * A work-digest is the data conduit by which services' states may be altered
 * through the computation done within a work-package. It represents the results
 * of evaluating a single work-item.
 *
 * Field mapping (Gray Paper → TypeScript):
 * - wd_serviceindex → serviceIndex: service whose state is to be altered
 * - wd_codehash → codeHash: hash of service code at time of reporting
 * - wd_payloadhash → payloadHash: hash of work-item payload
 * - wd_gaslimit → gasLimit: gas limit for accumulation (was wd_accgaslimit)
 * - wd_result → result: computation result (blob or error)
 * - wd_gasused → gasUsed: actual gas consumed
 * - wd_importcount → importCount: number of imported segments
 * - wd_xtcount → extrinsicCount: number of extrinsics
 * - wd_xtsize → extrinsicSize: total size of extrinsics
 * - wd_exportcount → exportCount: number of exported segments
 *
 * ✅ CORRECT: All 10 required fields present according to Gray Paper
 * ✅ CORRECT: Field types match Gray Paper specification
 * ✅ CORRECT: Current interface already Gray Paper compliant!
 */
export interface WorkDigest {
  /** Service index whose state is altered - Gray Paper: wd_serviceindex ∈ serviceid */
  serviceIndex: bigint

  /** Hash of service code at time of reporting - Gray Paper: wd_codehash ∈ hash */
  codeHash: Hex

  /** Hash of work-item payload - Gray Paper: wd_payloadhash ∈ hash */
  payloadHash: Hex

  /** Gas limit for accumulation - Gray Paper: wd_gaslimit ∈ gas */
  gasLimit: bigint

  /** Computation result - Gray Paper: wd_result ∈ blob ∪ workerror */
  result: WorkResult

  /** Actual gas consumed - Gray Paper: wd_gasused ∈ gas */
  gasUsed: bigint

  /** Number of imported segments - Gray Paper: wd_importcount ∈ ℕ */
  importCount: bigint

  /** Number of extrinsics - Gray Paper: wd_xtcount ∈ ℕ */
  extrinsicCount: bigint

  /** Total size of extrinsics - Gray Paper: wd_xtsize ∈ ℕ */
  extrinsicSize: bigint

  /** Number of exported segments - Gray Paper: wd_exportcount ∈ ℕ */
  exportCount: bigint
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
  context: WorkContext
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
 * Safrole ticket structure
 */
export interface SafroleTicket extends SafroleTicketCore {
  /** Additional ticket metadata for extended use cases */
  hash?: Hex
  owner?: Address // 20-byte address
  stake?: string
  timestamp?: bigint
}

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
 * - verdicts (validityDisputes): New judgments on work-report validity
 * - culprits (challengeDisputes): Proofs of guarantor misbehavior
 * - faults (finalityDisputes): Proofs of judgment contradictions
 *
 * Usage: Part of block extrinsics - processed by state transition function
 *
 * ⚠️  DO NOT CONFUSE with Disputes (state) - they serve different purposes:
 * - Dispute (this): Input data in blocks (temporary)
 * - Disputes: Persistent state outcomes (permanent)
 */
export interface Dispute {
  /** Validity disputes (V) - verdicts on work-report validity */
  validityDisputes: ValidityDispute[]
  /** Challenge disputes (C) - proofs of guarantor misbehavior */
  challengeDisputes: Hex
  /** Finality disputes (F) - proofs of judgment contradictions */
  finalityDisputes: Hex
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
 * Gray Paper Compliant Work Report Structure
 *
 * Gray Paper Equation 32 (label: eq:workreport): work-report ≡ (
 *   WR_avspec, WR_context, WR_core, WR_authorizer, WR_authtrace,
 *   WR_srlookup, WR_digests, WR_authgasused
 * )
 *
 * This represents the CANONICAL work report structure as defined in the Gray Paper.
 * A work report contains the results of evaluating a work package on a specific core,
 * including availability specification, context, authorizer information, and work digests.
 *
 * Fields (Gray Paper terminology):
 * - avspec: availability specification (as_packagehash, as_bundlelen, as_erasureroot, as_segroot, as_segcount)
 * - context: refinement context (anchor, lookup, prerequisites)
 * - core: core index where work was performed
 * - authorizer: hash of the authorizer
 * - authtrace: authorization trace blob
 * - srlookup: segment root lookup dictionary (hash → hash)
 * - digests: sequence of work digests (results of work item evaluation)
 * - authgasused: gas consumed during Is-Authorized invocation
 *
 * Field Order per Gray Paper:
 * 1. avspec - availability specification
 * 2. context - work context (refinement context)
 * 3. core - core index (natural encoding)
 * 4. authorizer - hash (32 bytes)
 * 5. authtrace - variable-length blob
 * 6. srlookup - variable-length dictionary
 * 7. digests - variable-length sequence of work digests
 * 8. authgasused - gas amount (natural encoding)
 * Usage: For work report processing and guaranteeing protocol
 * Related: See AvailabilitySpecification, WorkContext, WorkDigest interfaces
 */
export interface WorkReport {
  availabilitySpec: AvailabilitySpecification
  context: WorkContext
  coreIndex: bigint
  authorizer: Hex
  authTrace: Uint8Array
  srLookup: Map<Hex, Hex> // segment root lookup
  digests: WorkDigest[]
  authGasUsed: bigint
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
