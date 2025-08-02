import { readFileSync, writeFileSync } from 'node:fs'
import { logger } from './index'
import {
  type CallStack,
  type CallStackFrame,
  type DeblobFunction,
  type DeblobResult,
  type ProgramBlob,
  PVMError,
  type PVMInstruction,
  type PVMRuntime,
  type PVMState,
  type RAM,
  type RegisterValue,
  type RegisterValue32,
  type ResultCode,
  RuntimeError,
  type SingleStepResult,
} from './types'

// Default deblob function implementation
const defaultDeblob: DeblobFunction = (blob: number[]): DeblobResult => {
  try {
    // Simple implementation - in practice this would parse the blob format
    // For now, we'll assume the blob contains instruction data directly
    const instructionData = blob
    const opcodeBitmask = new Array(blob.length).fill(0xff) // Default bitmask
    const dynamicJumpTable = new Map<number, number>()

    return {
      success: true,
      instructionData,
      opcodeBitmask,
      dynamicJumpTable,
      errors: [],
    }
  } catch (error) {
    return {
      success: false,
      instructionData: [],
      opcodeBitmask: [],
      dynamicJumpTable: new Map(),
      errors: [`Deblob failed: ${error}`],
    }
  }
}

// RAM implementation
class PVMRAM implements RAM {
  public cells: Map<number, number> = new Map()

  readOctet(address: number): number {
    return this.cells.get(address) || 0
  }

  writeOctet(address: number, value: number): void {
    // Ensure value is 8-bit
    const octet = value & 0xff
    this.cells.set(address, octet)
  }

  readOctets(address: number, count: number): number[] {
    const result: number[] = []
    for (let i = 0; i < count; i++) {
      result.push(this.readOctet(address + i))
    }
    return result
  }

  writeOctets(address: number, values: number[]): void {
    values.forEach((value, index) => {
      this.writeOctet(address + index, value)
    })
  }
}

// Call stack implementation
class PVMCallStack implements CallStack {
  public frames: CallStackFrame[] = []

  pushFrame(frame: CallStackFrame): void {
    this.frames.push(frame)
  }

  popFrame(): CallStackFrame | undefined {
    return this.frames.pop()
  }

  getCurrentFrame(): CallStackFrame | undefined {
    return this.frames[this.frames.length - 1]
  }

  isEmpty(): boolean {
    return this.frames.length === 0
  }

  getDepth(): number {
    return this.frames.length
  }
}

// PVM implementation
export class PVM implements PVMRuntime {
  public state: PVMState
  private deblob: DeblobFunction
  private instructions: PVMInstruction[] = []

  constructor(deblobFunction?: DeblobFunction) {
    this.deblob = deblobFunction || defaultDeblob

    // Initialize default state
    this.state = {
      resultCode: null,
      instructionPointer: 0,
      registerState: {
        // 64-bit registers initialized to 0
        r0: 0n,
        r1: 0n,
        r2: 0n,
        r3: 0n,
        r4: 0n,
        r5: 0n,
        r6: 0n,
        r7: 0n,
        // 32-bit registers initialized to 0
        r8: 0,
        r9: 0,
        r10: 0,
        r11: 0,
        r12: 0,
      },
      callStack: new PVMCallStack(),
      ram: new PVMRAM(),
    }

    logger.info('PVM initialized with PVM specification compliance')
  }

  /**
   * Load program from blob using deblob function
   */
  public loadProgram(blob: ProgramBlob): void {
    try {
      // Use the deblob function to extract instruction data
      const deblobResult = this.deblob(blob.instructionData)

      if (!deblobResult.success) {
        throw new PVMError(
          `Failed to deblob program: ${deblobResult.errors.join(', ')}`,
          'DEBLOB_ERROR',
        )
      }

      // Parse instructions from the extracted data
      this.instructions = this.parseInstructions(deblobResult)

      // Reset state
      this.state.instructionPointer = 0
      this.state.resultCode = null

      logger.info('Program loaded successfully', {
        instructionCount: this.instructions.length,
      })
    } catch (error) {
      if (error instanceof PVMError) {
        throw error
      }
      throw new PVMError(`Failed to load program: ${error}`, 'LOAD_ERROR')
    }
  }

  /**
   * Single step execution as specified in PVM
   */
  public step(): SingleStepResult {
    try {
      const currentInstruction =
        this.instructions[this.state.instructionPointer]

      if (!currentInstruction) {
        // No more instructions - halt
        return {
          resultCode: '∎', // Halt
          newState: { ...this.state, resultCode: '∎' },
        }
      }

      // Execute the instruction
      const resultCode = this.executeInstruction(currentInstruction)

      // Update state
      const newState: PVMState = {
        ...this.state,
        resultCode,
        instructionPointer: this.state.instructionPointer + 1,
      }

      this.state = newState

      return {
        resultCode,
        newState,
      }
    } catch (error) {
      logger.error('Step execution failed', {
        error: error instanceof Error ? error.message : String(error),
      })

      return {
        resultCode: 'F', // Failure
        newState: { ...this.state, resultCode: 'F' },
      }
    }
  }

  /**
   * Run until halt condition
   */
  public run(): void {
    logger.info('Starting PVM execution')

    while (this.state.resultCode === null) {
      const result = this.step()

      if (result.resultCode === 'F') {
        logger.error('PVM execution failed')
        break
      }

      if (result.resultCode === '∎') {
        logger.info('PVM execution completed (halt)')
        break
      }
    }
  }

  /**
   * Reset to initial state
   */
  public reset(): void {
    this.state = {
      resultCode: null,
      instructionPointer: 0,
      registerState: {
        r0: 0n,
        r1: 0n,
        r2: 0n,
        r3: 0n,
        r4: 0n,
        r5: 0n,
        r6: 0n,
        r7: 0n,
        r8: 0,
        r9: 0,
        r10: 0,
        r11: 0,
        r12: 0,
      },
      callStack: new PVMCallStack(),
      ram: new PVMRAM(),
    }
    this.instructions = []

    logger.info('PVM state reset')
  }

  /**
   * Get current state
   */
  public getState(): PVMState {
    return { ...this.state }
  }

  /**
   * Set state
   */
  public setState(state: PVMState): void {
    this.state = { ...state }
  }

  /**
   * Get register value (64-bit registers)
   */
  /**
   * Get register value (64-bit registers)
   */
  public getRegister64(index: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7): RegisterValue {
    switch (index) {
      case 0:
        return this.state.registerState.r0
      case 1:
        return this.state.registerState.r1
      case 2:
        return this.state.registerState.r2
      case 3:
        return this.state.registerState.r3
      case 4:
        return this.state.registerState.r4
      case 5:
        return this.state.registerState.r5
      case 6:
        return this.state.registerState.r6
      case 7:
        return this.state.registerState.r7
      default:
        return 0n
    }
  }

  /**
   * Set register value (64-bit registers)
   */
  public setRegister64(
    index: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7,
    value: RegisterValue,
  ): void {
    switch (index) {
      case 0:
        this.state.registerState.r0 = value
        break
      case 1:
        this.state.registerState.r1 = value
        break
      case 2:
        this.state.registerState.r2 = value
        break
      case 3:
        this.state.registerState.r3 = value
        break
      case 4:
        this.state.registerState.r4 = value
        break
      case 5:
        this.state.registerState.r5 = value
        break
      case 6:
        this.state.registerState.r6 = value
        break
      case 7:
        this.state.registerState.r7 = value
        break
    }
  }

  /**
   * Get register value (32-bit registers)
   */
  public getRegister32(index: 8 | 9 | 10 | 11 | 12): RegisterValue32 {
    switch (index) {
      case 8:
        return this.state.registerState.r8
      case 9:
        return this.state.registerState.r9
      case 10:
        return this.state.registerState.r10
      case 11:
        return this.state.registerState.r11
      case 12:
        return this.state.registerState.r12
      default:
        return 0
    }
  }

  /**
   * Set register value (32-bit registers)
   */
  public setRegister32(
    index: 8 | 9 | 10 | 11 | 12,
    value: RegisterValue32,
  ): void {
    const maskedValue = value & 0xffffffff // Ensure 32-bit
    switch (index) {
      case 8:
        this.state.registerState.r8 = maskedValue
        break
      case 9:
        this.state.registerState.r9 = maskedValue
        break
      case 10:
        this.state.registerState.r10 = maskedValue
        break
      case 11:
        this.state.registerState.r11 = maskedValue
        break
      case 12:
        this.state.registerState.r12 = maskedValue
        break
    }
  }

  /**
   * Save state to file
   */
  public saveState(filePath: string): void {
    try {
      const stateData = {
        resultCode: this.state.resultCode,
        instructionPointer: this.state.instructionPointer,
        registerState: {
          r0: this.state.registerState.r0.toString(),
          r1: this.state.registerState.r1.toString(),
          r2: this.state.registerState.r2.toString(),
          r3: this.state.registerState.r3.toString(),
          r4: this.state.registerState.r4.toString(),
          r5: this.state.registerState.r5.toString(),
          r6: this.state.registerState.r6.toString(),
          r7: this.state.registerState.r7.toString(),
          r8: this.state.registerState.r8,
          r9: this.state.registerState.r9,
          r10: this.state.registerState.r10,
          r11: this.state.registerState.r11,
          r12: this.state.registerState.r12,
        },
        callStackDepth: this.state.callStack.getDepth(),
        instructionCount: this.instructions.length,
      }

      writeFileSync(filePath, JSON.stringify(stateData, null, 2))
      logger.info('State saved to file', { filePath })
    } catch (error) {
      throw new PVMError(
        `Failed to save state to ${filePath}: ${error}`,
        'FILE_ERROR',
      )
    }
  }

  /**
   * Load state from file
   */
  public loadState(filePath: string): void {
    try {
      const content = readFileSync(filePath, 'utf-8')
      const stateData = JSON.parse(content)

      // Restore register state
      this.state.registerState = {
        r0: BigInt(stateData.registerState.r0),
        r1: BigInt(stateData.registerState.r1),
        r2: BigInt(stateData.registerState.r2),
        r3: BigInt(stateData.registerState.r3),
        r4: BigInt(stateData.registerState.r4),
        r5: BigInt(stateData.registerState.r5),
        r6: BigInt(stateData.registerState.r6),
        r7: BigInt(stateData.registerState.r7),
        r8: stateData.registerState.r8,
        r9: stateData.registerState.r9,
        r10: stateData.registerState.r10,
        r11: stateData.registerState.r11,
        r12: stateData.registerState.r12,
      }

      this.state.resultCode = stateData.resultCode
      this.state.instructionPointer = stateData.instructionPointer

      logger.info('State loaded from file', { filePath })
    } catch (error) {
      throw new PVMError(
        `Failed to load state from ${filePath}: ${error}`,
        'FILE_ERROR',
      )
    }
  }

  // Private methods

  /**
   * Parse instructions from deblob result
   */
  private parseInstructions(deblobResult: DeblobResult): PVMInstruction[] {
    const instructions: PVMInstruction[] = []
    let address = 0

    // Simple parsing - in practice this would be more sophisticated
    for (let i = 0; i < deblobResult.instructionData.length; i += 4) {
      const opcode =
        deblobResult.instructionData[i] & deblobResult.opcodeBitmask[i] || 0xff
      const operands = deblobResult.instructionData.slice(i + 1, i + 4)

      instructions.push({
        opcode,
        operands,
        address,
      })

      address += 4
    }

    return instructions
  }

  /**
   * Execute a single PVM instruction
   */
  private executeInstruction(instruction: PVMInstruction): ResultCode {
    logger.debug('Executing instruction', {
      address: instruction.address,
      opcode: instruction.opcode,
      operands: instruction.operands,
    })

    // Basic instruction execution - this would be expanded based on PVM spec
    switch (instruction.opcode) {
      case 0x00: // NOP
        return '☇' // Continue
      case 0x01: // HALT
        return '∎' // Halt
      case 0x02: // ERROR
        return 'F' // Failure
      default:
        // Unknown instruction
        throw new RuntimeError(
          `Unknown instruction opcode: ${instruction.opcode}`,
          instruction,
        )
    }
  }
}
