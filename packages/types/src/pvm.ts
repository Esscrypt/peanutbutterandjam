/**
 * PVM (Polkadot Virtual Machine) Types for JAM Protocol
 *
 * Types for the PVM runtime as specified in Gray Paper
 * Reference: graypaper/text/pvm.tex
 */

import type { Hex } from 'viem'
import type { OperandTuple, ServiceAccount, WorkPackage } from './serialization'

// Register indices: 0-7 are 64-bit, 8-12 are 32-bit
// All 13 registers (r0-r12) can store 64-bit values
export type RegisterIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12

/**
 * Register state: 13 registers split by width
 * Gray Paper: All registers are 64-bit (pvmreg ≡ N_64)
 *
 * Split into two arrays for implementation efficiency:
 * - registers64: r0-r7 (8 registers, 64-bit operations, stored as bigint)
 * - registers32: r8-r12 (5 registers, 32-bit operations with sign-extension, stored as number)
 *
 * Mapping:
 * - r0 = registers64[0], r1 = registers64[1], ..., r7 = registers64[7]
 * - r8 = registers32[0], r9 = registers32[1], ..., r12 = registers32[4]
 */
// All 13 PVM registers (r0-r12) can store 64-bit values
// The distinction between "32-bit" and "64-bit" registers only applies to
// how certain operations interpret them, not their storage capacity
export type RegisterState = bigint[] // 13 elements (r0-r12)

/**
 * Memory access types as specified in Gray Paper
 * Gray Paper: RAM access can be 'none', 'R' (read), 'W' (write), or 'R+W' (read+write)
 */
export type MemoryAccessType = 'none' | 'read' | 'write'

/**
 * RAM interface for PVM memory operations
 * Provides byte-level read/write access with page-based protection
 * Implements Gray Paper RAM specification with proper access control
 */
export interface RAM {
  /** Memory data
   * do not use directly unless its for initializing the memory layout*/
  memoryData: Map<bigint, number>

  /** Read multiple consecutive bytes from memory */
  readOctets(address: bigint, count: bigint): [Uint8Array | null, bigint | null]

  /** Write multiple consecutive bytes to memory */
  writeOctets(address: bigint, values: Uint8Array): bigint | null

  /** Check if an address range is readable */
  isReadableWithFault(address: bigint, size?: bigint): [boolean, bigint | null]

  /** Check if an address range is writable */
  isWritableWithFault(address: bigint, size?: bigint): [boolean, bigint | null]

  /** Initialize a memory page (for test vectors) */
  initializePage(
    address: bigint,
    length: number,
    accessType: MemoryAccessType,
  ): void

  /** Set memory page access rights (Gray Paper PAGES function) */
  setPageAccessRights(
    address: bigint,
    length: number,
    accessType: MemoryAccessType,
    isPadding?: boolean,
  ): void

  /** Get memory page access type */
  getPageAccessType(address: bigint): MemoryAccessType

  /** Get page map as JSON-serializable format (for logging/verification) */
  getPageMapJSON(): Array<{
    address: string
    length: number
    'is-writable': boolean
    accessType: MemoryAccessType
  }>

  /** Get memory contents for a specific address range */
  getMemoryContents(address: bigint, length: number): number[]

  /** Get page map with contents as JSON-serializable format (for verification) */
  getPageMapWithContentsJSON(): Array<{
    address: string
    length: number
    'is-writable': boolean
    accessType: MemoryAccessType
    contents: number[]
  }>
}

// Result codes as specified in PVM
export type ResultCode = 0 | 1 | 2 | 3 | 4

// Result code constants for cleaner code
export const RESULT_CODES = {
  HALT: 0 as const,
  PANIC: 1 as const,
  FAULT: 2 as const,
  HOST: 3 as const,
  OOG: 4 as const,
} as const

// Host-call result constants as specified in Gray Paper section 6.1
export const HOST_CALL_RESULTS = {
  OK: 0n as const,
  HUH: 2n ** 64n - 9n, // Invalid operation/privilege level
  LOW: 2n ** 64n - 8n, // Gas limit too low
  CASH: 2n ** 64n - 7n, // Insufficient funds
  CORE: 2n ** 64n - 6n, // Core index unknown
  FULL: 2n ** 64n - 5n, // Storage full/resource allocated
  WHO: 2n ** 64n - 4n, // Index unknown
  OOB: 2n ** 64n - 3n, // Memory index not accessible
  WHAT: 2n ** 64n - 2n, // Name unknown
  NONE: 2n ** 64n - 1n, // Item does not exist
} as const

// Type for host call result values
export type HostCallResult = bigint

// Memory access types for fault handling
export interface MemoryAccess {
  address: bigint
  isWrite: boolean
  size: bigint // Number of octets accessed
}

// Fault information for memory access violations
export interface FaultInfo {
  type:
    | 'memory_read'
    | 'memory_write'
    | 'basic_block'
    | 'jump_table'
    | 'gas_limit'
    | 'gas'
    | 'host_call'
    | 'panic'
  address?: bigint // For memory faults
  details: string
}

export interface IPVM {
  state: PVMState

  invoke(
    gasLimit: bigint,
    registers: bigint[],
    programBlob: Uint8Array,
  ): Promise<void>
}

export interface PVMState {
  resultCode: ResultCode // ε: result code
  instructionPointer: bigint // ı: instruction pointer (index)
  registerState: RegisterState // ϱ: register state
  ram: RAM // µ: RAM
  gasCounter: bigint // Gas counter as specified in Gray Paper
  jumpTable: bigint[] // j: jump table for dynamic jumps (Gray Paper)
  code: Uint8Array // c: code
  bitmask: Uint8Array // k: opcode bitmask
  faultAddress: bigint | null // Fault address
  hostCallId: bigint | null // Host call ID
}

export interface ProgramBlob {
  instructionData: Uint8Array // Raw instruction data
  opcodeBitmask: Uint8Array // Opcode bitmasks
  dynamicJumpTable: Map<bigint, bigint> // Dynamic jump table
}

export interface PVMInstruction {
  opcode: bigint
  operands: Uint8Array
  fskip: number
  pc: bigint
}

/**
 * Instruction execution context (mutable)
 * Instructions modify this context directly
 */
export interface InstructionContext {
  instruction: PVMInstruction
  registers: RegisterState
  ram: RAM
  pc: bigint // instruction pointer
  gas: bigint // gas counter
  jumpTable: bigint[] // jump table for dynamic jumps
  code: Uint8Array // code
  bitmask: Uint8Array // opcode bitmask
  fskip: number
}

export interface HostFunctionContext {
  gasCounter: bigint
  registers: RegisterState
  ram: RAM
}

/**
 * Simplified instruction result
 * Only returns result code - context is mutated in place
 */
export interface InstructionResult {
  resultCode: ResultCode | null // null = continue execution
  faultInfo?: FaultInfo
}

export interface HostFunctionResult {
  resultCode: ResultCode | null // null = continue execution
  faultInfo?: FaultInfo
}

export interface SingleStepResult {
  resultCode: ResultCode
  newState: PVMState
  faultInfo?: FaultInfo
}

export interface DeblobResult {
  success: boolean
  instructionData: Uint8Array
  opcodeBitmask: Uint8Array
  dynamicJumpTable: Map<bigint, bigint>
  errors: string[]
}

export type DeblobFunction = (blob: Uint8Array) => DeblobResult

export interface HostCallHandler {
  handleHostCall(
    hostCallId: bigint,
    gasCounter: bigint,
    registers: RegisterState,
    ram: RAM,
  ):
    | {
        resultCode: 'continue' | 'halt' | 'panic' | 'oog'
        gasCounter: bigint
        registers: RegisterState
        ram: RAM
      }
    | {
        resultCode: 'fault'
        address: bigint
      }
}

// Program initialization types
export interface ProgramInitResult {
  success: boolean
  instructionData?: Uint8Array
  registers?: RegisterState
  ram?: RAM
  error?: string
}

export interface ArgumentData {
  data: Uint8Array
  size: bigint
}

// Basic block validation types
export interface BasicBlock {
  startAddress: bigint
  endAddress: bigint
  instructions: Uint8Array
}

export interface JumpTableEntry {
  address: bigint
  targetAddress: bigint
  isValid: boolean
}

// ===== IS-AUTHORIZED INVOCATION TYPES =====

// Work-related types are handled in the serialization package

// (Moved to end of file to avoid duplicates)

// ===== REFINE INVOCATION TYPES =====

// PVM-specific service account interface (for PVM runtime)
// export interface ServiceAccount {
//   codehash: bigint[]
//   storage: Map<string, bigint[]>
//   requests: Map<string, bigint[][]>
//   balance: bigint
//   minaccgas: bigint
//   minmemogas: bigint
//   preimages: Map<string, bigint[]>
//   created: bigint
//   gratis: boolean
//   lastacc: bigint
//   parent: bigint
//   items: bigint
//   minbalance: bigint
//   octets: bigint
// }

// Accounts state interface
export type Accounts = Map<bigint, ServiceAccount>

// Segment type (blob of length Csegmentsize)
export type Segment = Uint8Array

// PVM Guest type as per Gray Paper equation eq:pvmguest
export interface PVMGuest {
  code: Uint8Array // pg_code
  pvm: IPVM // Actual PVM instance for execution
}

// Refine context type as per Gray Paper
// Gray Paper: Ω_H(gascounter, registers, memory, (m, e), s, d, t)
// where (m, e) = refine context pair, s = service ID, d = accounts dict, t = timeslot
export interface RefineInvocationContext {
  // Core refine context pair (Gray Paper: (m, e))
  machines: Map<bigint, PVMGuest> // m: Dictionary of PVM guests
  exportSegments: Segment[] // e: Sequence of export segments

  // Refine invocation parameters (Gray Paper: c, i, p, r, ī, segoff)
  coreIndex: bigint // c: Core index
  workItemIndex: bigint // i: Work item index
  workPackage: WorkPackage // p: Work package
  authorizerTrace: Hex // r: Authorizer trace
  importSegments: Segment[][] // ī: Import segments by work item
  exportSegmentOffset: bigint // segoff: Export segment offset

  // Additional context from refine invocation
  accountsDictionary: Map<bigint, ServiceAccount> // accounts: Service accounts
  lookupTimeslot: bigint // lookup anchor time from work package context
  currentServiceId: bigint // s: Current service ID (for host functions)
}

// Refine result type
export type RefineResult = Uint8Array | WorkError

// ===== ACCUMULATE INVOCATION TYPES =====

/**
 * Partial state type as per Gray Paper section 31.1
 * @param accounts - Map of service IDs to service accounts
 * @param stagingset - Array of validator keys
 * @param authqueue - Array of arrays of authorization hashes
 * @param manager - Service ID of the manager
 * @param assigners - Array of service IDs
 * @param delegator - Service ID of the delegator
 * @param registrar - Service ID of the registrar
 * @param alwaysaccers - Map of service IDs to gas
 * 
 * partialstate ≡ tuple{
  ps_accounts: dictionary<serviceid, serviceaccount>,
  ps_stagingset: sequence[Cvalcount]{valkey},
  ps_authqueue: sequence[Ccorecount]{sequence[Cauthqueuesize]{hash}},
  ps_manager: serviceid,
  ps_assigners: sequence[Ccorecount]{serviceid},
  ps_delegator: serviceid,
  ps_registrar: serviceid,
  ps_alwaysaccers: dictionary<serviceid, gas>,
} 
 */
export interface PartialState {
  // ps_accounts: dictionary<serviceid, serviceaccount>
  accounts: Map<bigint, ServiceAccount>

  // ps_stagingset: sequence[Cvalcount]{valkey}
  stagingset: Uint8Array[]

  // ps_authqueue: sequence[Ccorecount]{sequence[Cauthqueuesize]{hash}}
  authqueue: Uint8Array[][]

  // ps_manager: serviceid
  manager: bigint

  // ps_assigners: sequence[Ccorecount]{serviceid}
  assigners: bigint[]

  // ps_delegator: serviceid
  delegator: bigint

  // ps_registrar: serviceid
  registrar: bigint

  // ps_alwaysaccers: dictionary<serviceid, gas>
  alwaysaccers: Map<bigint, bigint>
}

export interface DeferredTransfer {
  source: bigint // DX_source (4 bytes)
  dest: bigint // DX_dest (4 bytes)
  amount: bigint // DX_amount (8 bytes)
  memo: Uint8Array // DX_memo (variable)
  gas: bigint // DX_gas (8 bytes)
}

/**
 * Implications type as per Gray Paper section 31.1
 * @param id - Service ID
 * @param state - Partial state
 * @param nextfreeid - Next free ID
 * @param xfers - Deferred transfers
 * @param yield - Yield result hash (optional)
 * @param provisions - Provisions
 * 
 * implications ≡ tuple{
  im_id: serviceid,           // Service account ID
  im_state: partialstate,     // Partial blockchain state
  im_nextfreeid: serviceid,   // Next free service ID
  im_xfers: defxfers,         // Deferred transfers
  im_yield: optional<hash>,   // Yield result (optional)
  im_provisions: protoset<tuple{serviceid, blob}> // Provisions
} 
 */
export interface Implications {
  id: bigint
  state: PartialState
  nextfreeid: bigint
  xfers: DeferredTransfer[]
  yield: Uint8Array | null
  provisions: Map<bigint, Uint8Array>
}

export type ImplicationsPair = [Implications, Implications]

/**
 * Accumulate input structure
 * @param type - Type of the input
 * @param value - Value of the input
 */
export interface AccumulateInput {
  type: bigint // 0 for operand tuple, 1 for deferred transfer
  value: OperandTuple | DeferredTransfer
}

export interface AccumulateOutput {
  poststate: PartialState
  defxfers: DeferredTransfer[]
  yield: Uint8Array | null
  gasused: bigint
  provisions: Map<bigint, Uint8Array>
}

export type AccumulateInvocationResult =
  | { ok: true; value: AccumulateOutput }
  | { ok: false; err: WorkError }

/**
 * Export segment structure
 * @param data - Data of the segment
 * @param size - Size of the segment in bytes
 */
export interface ExportSegment {
  data: Hex
  size: bigint
}

/**
 * Extrinsic reference structure
 * @param hash - Hash of the extrinsic
 * @param length - Length of the extrinsic in bytes
 */
export interface ExtrinsicReference {
  hash: Hex
  length: bigint
}

/**
 * Work Error Types
 *
 * *** DO NOT REMOVE - GRAY PAPER FORMULA ***
 * Gray Paper Section: Appendix D.1 - Reporting Assurance
 * Formula (Equation 112):
 *
 * \workerror \in \set{ \oog, \panic, \badexports, \oversize, \token{BAD}, \token{BIG} }
 *
 * The first two are special values concerning execution of the virtual machine:
 * - OOG: Out-of-gas error during VM execution
 * - PANIC: Unexpected program termination during VM execution
 *
 * The remaining four indicate various failure conditions:
 * - BADEXPORTS: Number of exports made was invalidly reported
 * - OVERSIZE: Size of digest (refinement output) would cross acceptable limit
 * - BAD: Service's code was not available for lookup in state at the posterior state of the lookup-anchor block
 * - BIG: Code was available but was beyond the maximum size allowed
 */
export type WorkError =
  | 'OOG'
  | 'PANIC'
  | 'BADEXPORTS'
  | 'OVERSIZE'
  | 'BAD'
  | 'BIG'

export type IsAuthorizedResult = Uint8Array | WorkError

// PVM Constants
export const PVM_CONSTANTS = {
  DEFAULT_GAS_LIMIT: 1000000n,
  MIN_GAS_COST: 1n,
  RESERVED_MEMORY_START: 0n,
  MAX_MEMORY_ADDRESS: 0xffffffffn,
  INITIAL_ZONE_SIZE: 1024n,
  PAGE_SIZE: 4096n,
  DYNAMIC_ADDRESS_ALIGNMENT: 8n,
  INIT_ZONE_SIZE: 1024n,
  INIT_INPUT_SIZE: 1024n,
  REGISTER_COUNT_64BIT: 8n,
  REGISTER_COUNT_32BIT: 5n,
  REGISTER_TOTAL_COUNT: 13n,
  MAX_OPCODE: 255n,
  MAX_OPERANDS: 4n,
  DEFAULT_INSTRUCTION_LENGTH: 1n,
} as const

/**
 * Decoded PVM program blob components (Gray Paper: deblob function)
 */
export interface DecodedBlob {
  /** Instruction data (c) */
  code: Uint8Array
  /** Opcode bitmask (k) - marks which bytes are opcodes */
  bitmask: Uint8Array
  /** Dynamic jump table (j) */
  jumpTable: bigint[]
  /** Jump table element size in bytes */
  elementSize: number
  /** Total header size (for PC offset calculations) */
  headerSize: number
}

/**
 * PVM constructor options
 */
export interface PVMOptions {
  /** Initial program code (blob) */
  code?: Uint8Array
  /** Initial RAM instance */
  ram?: RAM
  /** Initial program counter */
  pc?: bigint
  /** Initial gas counter */
  gasCounter?: bigint
  /** Initial register state */
  registerState?: bigint[]
}

export type ContextMutator<T> = (
  hostCallId: bigint,
  gasCounter: bigint,
  registers: bigint[],
  memory: RAM,
  context: T,
) => {
  resultCode: ResultCode
  gasCounter: bigint
  registers: bigint[]
  memory: RAM
  context: T
}
