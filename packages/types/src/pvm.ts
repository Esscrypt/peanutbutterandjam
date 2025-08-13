/**
 * PVM (Polkadot Virtual Machine) Types for JAM Protocol
 *
 * Types for the PVM runtime as specified in Gray Paper
 * Reference: graypaper/text/pvm.tex
 */

import type { Bytes, HashValue, HexString } from './core'
import type { OperandTuple, ServiceAccount } from './serialization'

// Gas types as specified in Gray Paper
export type Gas = bigint // 64-bit unsigned integer (0 to 2^64-1)
export type SignedGas = bigint // 64-bit signed integer (-2^63 to 2^63-1)

// Register indices: 0-7 are 64-bit, 8-12 are 32-bit
export type RegisterIndex64 = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7
export type RegisterIndex32 = 8 | 9 | 10 | 11 | 12
export type RegisterIndex = RegisterIndex64 | RegisterIndex32

// Register values: 64-bit for registers 0-7, 32-bit for registers 8-12
export type RegisterValue = bigint // 64-bit registers
export type RegisterValue32 = bigint // 32-bit registers

// Register state: 13 registers as specified in PVM
export interface RegisterState {
  // 64-bit registers (ϱ₀ through ϱ₇)
  r0: RegisterValue
  r1: RegisterValue
  r2: RegisterValue
  r3: RegisterValue
  r4: RegisterValue
  r5: RegisterValue
  r6: RegisterValue
  r7: RegisterValue
  // 32-bit registers (ϱ₈ through ϱ₁₂)
  r8: RegisterValue32
  r9: RegisterValue32
  r10: RegisterValue32
  r11: RegisterValue32
  r12: RegisterValue32
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
  address: number
  isWrite: boolean
  size: number // Number of octets accessed
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
  address?: number // For memory faults
  details: string
}

// RAM: dictionary from natural numbers to octets
export interface RAM {
  // Map from address (natural number) to octet (8-bit value)
  cells: Map<number, Uint8Array>

  // Read multiple octets
  readOctets(address: number, count: number): Uint8Array

  // Write multiple octets
  writeOctets(address: number, values: Uint8Array): void

  // Check if address is readable (for fault detection)
  isReadable(address: number): boolean

  // Check if address is writable (for fault detection)
  isWritable(address: number): boolean

  // Get memory layout information
  getMemoryLayout(): {
    stackStart: number
    heapStart: number
    totalSize: number
  }
}

// Call stack frame as specified in PVM
export interface CallStackFrame {
  returnAddress: number // Instruction pointer for return
  registerState: RegisterState // Register state at call time
  stackPointer: number // Stack pointer value at call time
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
  getDepth(): number
}

export interface PVMState {
  resultCode: ResultCode | null // ε: result code
  instructionPointer: number // ı: instruction pointer (index)
  registerState: RegisterState // ϱ: register state
  callStack: CallStack // φ: call stack
  ram: RAM // µ: RAM
  gasCounter: Gas // Gas counter as specified in Gray Paper
  stackPointer?: number // Stack pointer for stack operations
  instructionData?: Uint8Array // Raw instruction data
  instructions?: PVMInstruction[] // Parsed instructions
}

export interface ProgramBlob {
  instructionData: Uint8Array // Raw instruction data
  opcodeBitmask: Uint8Array // Opcode bitmasks
  dynamicJumpTable: Map<number, number> // Dynamic jump table
}

export interface PVMInstruction {
  opcode: number
  operands: Uint8Array
  address: number
}

export interface InstructionContext {
  instruction: PVMInstruction
  registers: RegisterState
  ram: RAM
  callStack: CallStack
  instructionPointer: number
  stackPointer: number
  gasCounter: Gas
}

export interface InstructionResult {
  resultCode: ResultCode
  newRegisters?: Partial<RegisterState>
  newRam?: Map<number, Uint8Array>
  newCallStack?: CallStackFrame[]
  newInstructionPointer?: number
  newStackPointer?: number
  newGasCounter?: Gas
  memoryAccesses?: Array<{
    address: number
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
  setGasLimit(limit: Gas): void

  // Get gas counter
  getGasCounter(): Gas
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
    public line?: number,
    public column?: number,
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
    public address?: number,
  ) {
    super(message, 'MEMORY_ERROR')
    this.name = 'MemoryError'
  }
}

export class GasError extends PVMError {
  constructor(
    message: string,
    public gasUsed?: Gas,
    public gasLimit?: Gas,
  ) {
    super(message, 'GAS_ERROR')
    this.name = 'GasError'
  }
}

export interface ParseResult {
  success: boolean
  instruction?: PVMInstruction
  error?: string
  line?: number
  column?: number
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
  dynamicJumpTable: Map<number, number>
  errors: string[]
}

export type DeblobFunction = (blob: Uint8Array) => DeblobResult

// Host call system types
export type ContextMutator<X> = (
  hostCallId: number,
  gasCounter: Gas,
  registers: RegisterState,
  ram: RAM,
  context: X,
) =>
  | {
      resultCode: 'continue' | 'halt' | 'panic' | 'oog'
      gasCounter: Gas
      registers: RegisterState
      ram: RAM
      context: X
    }
  | {
      resultCode: 'fault'
      address: number
    }

export interface HostCallHandler {
  handleHostCall(
    hostCallId: number,
    gasCounter: Gas,
    registers: RegisterState,
    ram: RAM,
  ):
    | {
        resultCode: 'continue' | 'halt' | 'panic' | 'oog'
        gasCounter: Gas
        registers: RegisterState
        ram: RAM
      }
    | {
        resultCode: 'fault'
        address: number
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
  size: number
}

// Basic block validation types
export interface BasicBlock {
  startAddress: number
  endAddress: number
  instructions: Uint8Array
}

export interface JumpTableEntry {
  address: number
  targetAddress: number
  isValid: boolean
}

// ===== IS-AUTHORIZED INVOCATION TYPES =====

// Work-related types are handled in the serialization package

// (Moved to end of file to avoid duplicates)

// Is-Authorized context mutator function
export type IsAuthorizedContextMutator = (
  hostCallId: number,
  gasCounter: Gas,
  registers: RegisterState,
  ram: RAM,
  context: null,
) =>
  | {
      resultCode: 'continue' | 'halt' | 'panic' | 'oog'
      gasCounter: Gas
      registers: RegisterState
      ram: RAM
      context: null
    }
  | {
      resultCode: 'fault'
      address: number
    }

// ===== REFINE INVOCATION TYPES =====

// PVM-specific service account interface (for PVM runtime)
// export interface ServiceAccount {
//   codehash: number[]
//   storage: Map<string, number[]>
//   requests: Map<string, number[][]>
//   balance: bigint
//   minaccgas: bigint
//   minmemogas: bigint
//   preimages: Map<string, number[]>
//   created: number
//   gratis: boolean
//   lastacc: number
//   parent: number
//   items: number
//   minbalance: bigint
//   octets: number
// }

// Accounts state interface
export interface Accounts {
  [serviceId: number]: ServiceAccount
}

// Segment type (blob of length Csegmentsize)
export type Segment = Uint8Array

// PVM Guest type as per Gray Paper equation eq:pvmguest
export interface PVMGuest {
  code: Uint8Array // pg_code
  ram: RAM // pg_ram
  pc: number // pg_pc
}

// Refine context type as per Gray Paper
export type RefineContext = [Map<number, PVMGuest>, Segment[]]

// Refine result type
export type RefineResult = Uint8Array | WorkError

// Refine context mutator function F as per Gray Paper equation eq:refinemutator
export type RefineContextMutator = (
  hostCallId: number,
  gasCounter: Gas,
  registers: RegisterState,
  ram: RAM,
  context: RefineContext,
) =>
  | {
      resultCode: 'continue' | 'halt' | 'panic' | 'oog'
      gasCounter: Gas
      registers: RegisterState
      ram: RAM
      context: RefineContext
    }
  | {
      resultCode: 'fault'
      address: number
    }

// ===== ACCUMULATE INVOCATION TYPES =====

export interface PartialState {
  accounts: Map<number, ServiceAccount>
  authqueue: Map<number, Uint8Array[]>
  assigners: Map<number, number>
  stagingset: Uint8Array[]
  nextfreeid: number
  manager: number
  registrar: number
  delegator: number
  alwaysaccers: Map<number, bigint>
  xfers: Uint8Array[]
  provisions: Map<number, Uint8Array[]>
  yield: Uint8Array | null
}

export interface DeferredTransfer {
  source: number // DX_source (4 bytes)
  dest: number // DX_dest (4 bytes)
  amount: bigint // DX_amount (8 bytes)
  memo: Bytes // DX_memo (variable)
  gas: bigint // DX_gas (8 bytes)
}

export interface Implications {
  id: number
  state: PartialState
  nextfreeid: number
  xfers: DeferredTransfer[]
  yield: Uint8Array | null
  provisions: Map<number, Uint8Array>
}

export type ImplicationsPair = [Implications, Implications]

export interface AccumulateInput {
  type: number // 0 for operand tuple, 1 for deferred transfer
  value: OperandTuple | DeferredTransfer
}

export interface AccumulateOutput {
  poststate: PartialState
  defxfers: DeferredTransfer[]
  yield: Uint8Array | null
  gasused: bigint
  provisions: Map<number, Uint8Array>
}

export type AccumulateInvocationResult = AccumulateOutput | WorkError

export type AccumulateContextMutator = (
  hostCallId: number,
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
  | { resultCode: 'fault'; address: number }

// Work types for PVM compatibility
export interface WorkContext {
  lookupanchortime: number
}

export interface WorkItem {
  serviceindex: number
  codehash: HashValue
  payload: HexString
  refgaslimit: Gas
  accgaslimit: Gas
  importsegments: ImportSegment[]
  exportsegments: ExportSegment[]
  extrinsics: ExtrinsicReference[]
}

export interface ImportSegment {
  hash: HashValue // Root hash of the import tree
  index: number
}

export interface ExportSegment {
  data: HexString
  size: number
}

export interface ExtrinsicReference {
  hash: HashValue
  length: number
}

export type WorkError = 'BAD' | 'BIG'

export type IsAuthorizedResult = number[] | WorkError

// PVM Constants
export const PVM_CONSTANTS = {
  DEFAULT_GAS_LIMIT: BigInt(1000000),
  MIN_GAS_COST: BigInt(1),
  RESERVED_MEMORY_START: 0,
  MAX_MEMORY_ADDRESS: 0xffffffff,
  INITIAL_ZONE_SIZE: 1024,
  PAGE_SIZE: 4096,
  DYNAMIC_ADDRESS_ALIGNMENT: 8,
  INIT_ZONE_SIZE: 1024,
  INIT_INPUT_SIZE: 1024,
  REGISTER_COUNT_64BIT: 8,
  REGISTER_COUNT_32BIT: 5,
  REGISTER_TOTAL_COUNT: 13,
  MAX_OPCODE: 255,
  MAX_OPERANDS: 4,
  DEFAULT_INSTRUCTION_LENGTH: 1,
} as const
