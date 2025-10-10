/**
 * PVM (Polkadot Virtual Machine) Types for JAM Protocol
 *
 * Types for the PVM runtime as specified in Gray Paper
 * Reference: graypaper/text/pvm.tex
 */

import type { Hex } from 'viem'
import type { OperandTuple, ServiceAccount } from './serialization'

// Register indices: 0-7 are 64-bit, 8-12 are 32-bit
export type RegisterIndex64 = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7
export type RegisterIndex32 = 8 | 9 | 10 | 11 | 12
export type RegisterIndex = RegisterIndex64 | RegisterIndex32

// Register state: 13 registers as specified in PVM
export interface RegisterState {
  // 64-bit registers (ϱ₀ through ϱ₇)
  r0: bigint
  r1: bigint
  r2: bigint
  r3: bigint
  r4: bigint
  r5: bigint
  r6: bigint
  r7: bigint
  // 32-bit registers (ϱ₈ through ϱ₁₂)
  r8: bigint
  r9: bigint
  r10: bigint
  r11: bigint
  r12: bigint
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

// RAM: dictionary from natural numbers to octets
export interface RAM {
  // Map from address (natural bigint) to octet (8-bit value)
  cells: Map<bigint, Uint8Array>

  // Read multiple octets
  readOctets(address: bigint, count: bigint): Uint8Array

  // Write multiple octets
  writeOctets(address: bigint, values: Uint8Array): void

  // Check if address is readable (for fault detection)
  isReadable(address: bigint): boolean

  // Check if address is writable (for fault detection)
  isWritable(address: bigint): boolean

  // Get memory layout information
  getMemoryLayout(): {
    stackStart: bigint
    heapStart: bigint
    totalSize: bigint
  }
}

// Call stack frame as specified in PVM
export interface CallStackFrame {
  returnAddress: bigint // Instruction pointer for return
  registerState: RegisterState // Register state at call time
  stackPointer: bigint // Stack pointer value at call time
}

// Call stack: sequence of frames
export interface CallStack {
  frames: CallStackFrame[]

  // Push a new frame
  pushFrame(frame: CallStackFrame): void

  // Pop the top frame
  popFrame(): CallStackFrame | undefined

  // Get current frame
  getCurrentFrame(): CallStackFrame | undefined

  // Check if stack is empty
  isEmpty(): boolean

  // Get stack depth
  getDepth(): bigint
}

export interface PVMState {
  resultCode: ResultCode | null // ε: result code
  instructionPointer: bigint // ı: instruction pointer (index)
  registerState: RegisterState // ϱ: register state
  callStack: CallStack // φ: call stack
  ram: RAM // µ: RAM
  gasCounter: bigint // Gas counter as specified in Gray Paper
  stackPointer?: bigint // Stack pointer for stack operations
  instructionData?: Uint8Array // Raw instruction data
  instructions?: PVMInstruction[] // Parsed instructions
}

export interface ProgramBlob {
  instructionData: Uint8Array // Raw instruction data
  opcodeBitmask: Uint8Array // Opcode bitmasks
  dynamicJumpTable: Map<bigint, bigint> // Dynamic jump table
}

export interface PVMInstruction {
  opcode: bigint
  operands: Uint8Array
  address: bigint
}

export interface InstructionContext {
  instruction: PVMInstruction
  registers: RegisterState
  ram: RAM
  callStack: CallStack
  instructionPointer: bigint
  stackPointer: bigint
  gasCounter: bigint
}

export interface InstructionResult {
  resultCode: ResultCode
  newRegisters?: Partial<RegisterState>
  newRam?: Map<bigint, Uint8Array>
  newCallStack?: CallStackFrame[]
  newInstructionPointer?: bigint
  newStackPointer?: bigint
  newGasCounter?: bigint
  memoryAccesses?: Array<{
    address: bigint
    value: Uint8Array
    isWrite: boolean
  }>
  faultInfo?: FaultInfo
}

export interface SingleStepResult {
  resultCode: ResultCode
  newState: PVMState
  faultInfo?: FaultInfo
}

export interface PVMRuntime {
  // Current state
  state: PVMState

  // Load program from blob
  loadProgram(blob: ProgramBlob): void

  // Single step execution
  step(): SingleStepResult

  // Run until halt
  run(): void

  // Reset to initial state
  reset(): void

  // Get current state
  getState(): PVMState

  // Set state
  setState(state: PVMState): void

  // Set gas limit
  setGasLimit(limit: bigint): void

  // Get gas counter
  getGasCounter(): bigint
}

// Error classes
export class PVMError extends Error {
  constructor(
    message: string,
    public code: string,
    public context?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'PVMError'
  }
}

export class ParseError extends PVMError {
  constructor(
    message: string,
    public line?: bigint,
    public column?: bigint,
  ) {
    super(message, 'PARSE_ERROR')
    this.name = 'ParseError'
  }
}

export class RuntimeError extends PVMError {
  constructor(
    message: string,
    public instruction?: PVMInstruction,
  ) {
    super(message, 'RUNTIME_ERROR')
    this.name = 'RuntimeError'
  }
}

export class MemoryError extends PVMError {
  constructor(
    message: string,
    public address?: bigint,
  ) {
    super(message, 'MEMORY_ERROR')
    this.name = 'MemoryError'
  }
}

export class GasError extends PVMError {
  constructor(
    message: string,
    public gasUsed?: bigint,
    public gasLimit?: bigint,
  ) {
    super(message, 'GAS_ERROR')
    this.name = 'GasError'
  }
}

export interface ParseResult {
  success: boolean
  instruction?: PVMInstruction
  error?: string
  line?: bigint
  column?: bigint
}

export interface Parser {
  parseInstruction(data: Uint8Array): ParseResult
  parseProgram(blob: ProgramBlob): {
    success: boolean
    instructions: PVMInstruction[]
    errors: string[]
  }
  disassemble(instruction: PVMInstruction): string
}

export interface DeblobResult {
  success: boolean
  instructionData: Uint8Array
  opcodeBitmask: Uint8Array
  dynamicJumpTable: Map<bigint, bigint>
  errors: string[]
}

export type DeblobFunction = (blob: Uint8Array) => DeblobResult

// Host call system types
export type ContextMutator<X> = (
  hostCallId: bigint,
  gasCounter: bigint,
  registers: RegisterState,
  ram: RAM,
  context: X,
) =>
  | {
      resultCode: 'continue' | 'halt' | 'panic' | 'oog'
      gasCounter: bigint
      registers: RegisterState
      ram: RAM
      context: X
    }
  | {
      resultCode: 'fault'
      address: bigint
    }

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

// Is-Authorized context mutator function
export type IsAuthorizedContextMutator = (
  hostCallId: bigint,
  gasCounter: bigint,
  registers: RegisterState,
  ram: RAM,
  context: null,
) =>
  | {
      resultCode: 'continue' | 'halt' | 'panic' | 'oog'
      gasCounter: bigint
      registers: RegisterState
      ram: RAM
      context: null
    }
  | {
      resultCode: 'fault'
      address: bigint
    }

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
  ram: RAM // pg_ram
  pc: bigint // pg_pc
}

// Refine context type as per Gray Paper
export type RefineContextPVM = [Map<bigint, PVMGuest>, Segment[]]

// Refine result type
export type RefineResult = Uint8Array | WorkError

// Refine context mutator function F as per Gray Paper equation eq:refinemutator
export type RefineContextMutator = (
  hostCallId: bigint,
  gasCounter: bigint,
  registers: RegisterState,
  ram: RAM,
  context: RefineContextPVM,
) =>
  | {
      resultCode: 'continue' | 'halt' | 'panic' | 'oog'
      gasCounter: bigint
      registers: RegisterState
      ram: RAM
      context: RefineContextPVM
    }
  | {
      resultCode: 'fault'
      address: bigint
    }

// ===== ACCUMULATE INVOCATION TYPES =====

export interface PartialState {
  accounts: Map<bigint, ServiceAccount>
  authqueue: Map<bigint, Uint8Array[]>
  assigners: Map<bigint, bigint>
  stagingset: Uint8Array[]
  nextfreeid: bigint
  manager: bigint
  registrar: bigint
  delegator: bigint
  alwaysaccers: Map<bigint, bigint>
  xfers: Uint8Array[]
  provisions: Map<bigint, Uint8Array[]>
  yield: Uint8Array | null
}

export interface DeferredTransfer {
  source: bigint // DX_source (4 bytes)
  dest: bigint // DX_dest (4 bytes)
  amount: bigint // DX_amount (8 bytes)
  memo: Uint8Array // DX_memo (variable)
  gas: bigint // DX_gas (8 bytes)
}

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

export type AccumulateInvocationResult = AccumulateOutput | WorkError

export type AccumulateContextMutator = (
  hostCallId: bigint,
  gasCounter: bigint,
  registers: RegisterState,
  ram: RAM,
  context: ImplicationsPair,
) =>
  | {
      resultCode: 'continue' | 'halt' | 'panic' | 'oog'
      gasCounter: bigint
      registers: RegisterState
      ram: RAM
      context: ImplicationsPair
    }
  | { resultCode: 'fault'; address: bigint }

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
