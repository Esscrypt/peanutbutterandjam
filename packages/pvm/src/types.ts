// Polkadot Virtual Machine (PVM) Types

// Register indices: 0-7 are 64-bit, 8-12 are 32-bit
export type RegisterIndex64 = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7
export type RegisterIndex32 = 8 | 9 | 10 | 11 | 12
export type RegisterIndex = RegisterIndex64 | RegisterIndex32

// Register values: 64-bit for registers 0-7, 32-bit for registers 8-12
export type RegisterValue = bigint // 64-bit registers
export type RegisterValue32 = number // 32-bit registers

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
export type ResultCode = '∎' | '☇' | '∞' | 'F' | 'ḥ'

// RAM: dictionary from natural numbers to octets
export interface RAM {
  // Map from address (natural number) to octet (8-bit value)
  cells: Map<number, number>

  // Read octet at address
  readOctet(address: number): number

  // Write octet at address
  writeOctet(address: number, value: number): void

  // Read multiple octets
  readOctets(address: number, count: number): number[]

  // Write multiple octets
  writeOctets(address: number, values: number[]): void
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

// PVM State tuple as specified: (ε, ı, ϱ, φ, µ)
export interface PVMState {
  resultCode: ResultCode | null // ε: result code
  instructionPointer: number // ı: instruction pointer (index)
  registerState: RegisterState // ϱ: register state
  callStack: CallStack // φ: call stack
  ram: RAM // µ: RAM
}

// Program blob structure
export interface ProgramBlob {
  instructionData: number[] // Raw instruction data
  opcodeBitmask: number[] // Opcode bitmasks
  dynamicJumpTable: Map<number, number> // Dynamic jump table
}

// PVM instruction types (to be defined based on PVM spec)
export interface PVMInstruction {
  opcode: number
  operands: number[]
  address: number
}

// Single-step function result
export interface SingleStepResult {
  resultCode: ResultCode
  newState: PVMState
}

// PVM Runtime interface
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
}

// PVM Error types
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
    super(message, 'PARSE_ERROR', { line, column })
    this.name = 'ParseError'
  }
}

export class RuntimeError extends PVMError {
  constructor(
    message: string,
    public instruction?: PVMInstruction,
  ) {
    super(message, 'RUNTIME_ERROR', { instruction })
    this.name = 'RuntimeError'
  }
}

export class MemoryError extends PVMError {
  constructor(
    message: string,
    public address?: number,
  ) {
    super(message, 'MEMORY_ERROR', { address })
    this.name = 'MemoryError'
  }
}

// Parser interfaces
export interface ParseResult {
  success: boolean
  instruction?: PVMInstruction
  error?: string
  line?: number
  column?: number
}

export interface Parser {
  parseInstruction(data: number[]): ParseResult
  parseProgram(blob: ProgramBlob): {
    success: boolean
    instructions: PVMInstruction[]
    errors: string[]
  }
  disassemble(instruction: PVMInstruction): string
}

// deblob function interface
export interface DeblobResult {
  success: boolean
  instructionData: number[]
  opcodeBitmask: number[]
  dynamicJumpTable: Map<number, number>
  errors: string[]
}

export type DeblobFunction = (blob: number[]) => DeblobResult
