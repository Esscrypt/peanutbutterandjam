import { readFileSync, writeFileSync } from 'node:fs'
import { logger } from '@pbnj/core'
import { PVMCallStack } from './call-stack'
import {
  DEFAULTS,
  GAS_CONFIG,
  INSTRUCTION_LENGTHS,
  RESULT_CODES,
} from './config'
import { InstructionRegistry } from './instructions/registry'
import { PVMRAM } from './ram'
import {
  type DeblobFunction,
  type DeblobResult,
  type ProgramBlob,
  PVMError,
  type PVMInstruction,
  type PVMRuntime,
  type PVMState,
  type RegisterValue,
  type RegisterValue32,
  type ResultCode,
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

// PVM implementation
export class PVM implements PVMRuntime {
  public state: PVMState
  private deblob: DeblobFunction
  private instructions: PVMInstruction[] = []
  private gasLimit: bigint

  constructor(deblobFunction?: DeblobFunction) {
    this.deblob = deblobFunction || defaultDeblob
    this.gasLimit = GAS_CONFIG.DEFAULT_GAS_LIMIT

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
        r8: 0n,
        r9: 0n,
        r10: 0n,
        r11: 0n,
        r12: 0n,
      },
      callStack: new PVMCallStack(),
      ram: new PVMRAM(),
      gasCounter: this.gasLimit,
    }

    logger.info('PVM initialized with Gray Paper specification compliance')
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
      this.instructions = this.parseInstructionsFromData(
        deblobResult.instructionData,
      )

      // Reset state
      this.state.instructionPointer = 0
      this.state.resultCode = null
      this.state.gasCounter = this.gasLimit

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
   * Load program from raw instruction data
   */
  public loadProgramFromData(instructionData: number[]): void {
    try {
      // Parse instructions from the raw data
      this.instructions = this.parseInstructionsFromData(instructionData)

      // Reset state
      this.state.instructionPointer = 0
      this.state.resultCode = null
      this.state.gasCounter = this.gasLimit

      logger.info('Program loaded from data successfully', {
        instructionCount: this.instructions.length,
      })
    } catch (error) {
      if (error instanceof PVMError) {
        throw error
      }
      throw new PVMError(
        `Failed to load program from data: ${error}`,
        'LOAD_ERROR',
      )
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
          resultCode: RESULT_CODES.HALT,
          newState: { ...this.state, resultCode: RESULT_CODES.HALT },
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
        resultCode: RESULT_CODES.FAULT,
        newState: { ...this.state, resultCode: RESULT_CODES.FAULT },
      }
    }
  }

  /**
   * Step with host call support
   */
  public stepWithHostCall(): SingleStepResult {
    try {
      const currentInstruction =
        this.instructions[this.state.instructionPointer]

      if (!currentInstruction) {
        // No more instructions - halt
        return {
          resultCode: RESULT_CODES.HALT,
          newState: { ...this.state, resultCode: RESULT_CODES.HALT },
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
      logger.error('Step with host call execution failed', {
        error: error instanceof Error ? error.message : String(error),
      })

      return {
        resultCode: RESULT_CODES.FAULT,
        newState: { ...this.state, resultCode: RESULT_CODES.FAULT },
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

      if (result.resultCode === RESULT_CODES.FAULT) {
        logger.error('PVM execution failed')
        break
      }

      if (result.resultCode === RESULT_CODES.HALT) {
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
        r8: 0n,
        r9: 0n,
        r10: 0n,
        r11: 0n,
        r12: 0n,
      },
      callStack: new PVMCallStack(),
      ram: new PVMRAM(),
      gasCounter: this.gasLimit,
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
   * Set gas limit
   */
  public setGasLimit(limit: bigint): void {
    this.gasLimit = limit
    this.state.gasCounter = limit
  }

  /**
   * Get gas counter
   */
  public getGasCounter(): bigint {
    return this.state.gasCounter
  }

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
        return 0n
    }
  }

  /**
   * Set register value (32-bit registers)
   */
  public setRegister32(
    index: 8 | 9 | 10 | 11 | 12,
    value: RegisterValue32,
  ): void {
    const maskedValue = value & 0xffffffffn // Ensure 32-bit
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
        gasCounter: this.state.gasCounter.toString(),
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
      this.state.gasCounter = BigInt(stateData.gasCounter || this.gasLimit)

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
   * Parse instructions from instruction data
   */
  private parseInstructionsFromData(
    instructionData: number[],
  ): PVMInstruction[] {
    const instructions: PVMInstruction[] = []
    let address = 0

    // Parse instructions using Gray Paper skip distance logic
    while (address < instructionData.length) {
      const opcode = instructionData[address]
      const instructionLength =
        INSTRUCTION_LENGTHS[opcode as keyof typeof INSTRUCTION_LENGTHS] ||
        DEFAULTS.UNKNOWN_INSTRUCTION_LENGTH

      if (address + instructionLength > instructionData.length) {
        break // Not enough data for complete instruction
      }

      const operands = instructionData.slice(
        address + 1,
        address + instructionLength,
      )

      instructions.push({
        opcode,
        operands,
        address,
      })

      address += instructionLength
    }

    return instructions
  }

  /**
   * Execute a single PVM instruction using the instruction registry
   */
  private executeInstruction(instruction: PVMInstruction): ResultCode {
    logger.debug('Executing instruction', {
      address: instruction.address,
      opcode: instruction.opcode,
      operands: instruction.operands,
    })

    const registry = InstructionRegistry.getInstance()
    const handler = registry.getHandler(instruction.opcode)

    if (!handler) {
      // Unknown instruction - treat as TRAP (panic)
      logger.warn('Unknown instruction opcode', { opcode: instruction.opcode })
      return RESULT_CODES.PANIC
    }

    try {
      // Create instruction context
      const context = {
        instruction,
        registers: this.state.registerState,
        ram: this.state.ram,
        callStack: this.state.callStack,
        instructionPointer: this.state.instructionPointer,
        stackPointer: this.state.stackPointer || 0,
        gasCounter: this.state.gasCounter,
      }

      // Execute instruction
      const result = handler.execute(context)

      // Update state based on result
      if (result.newRegisters) {
        this.state.registerState = {
          ...this.state.registerState,
          ...result.newRegisters,
        }
      }

      if (result.newInstructionPointer !== undefined) {
        this.state.instructionPointer = result.newInstructionPointer
      }

      if (result.newGasCounter !== undefined) {
        this.state.gasCounter = result.newGasCounter
      }

      if (result.newCallStack) {
        this.state.callStack.frames = result.newCallStack
      }

      return result.resultCode
    } catch (error) {
      logger.error('Instruction execution failed', {
        opcode: instruction.opcode,
        error: error instanceof Error ? error.message : String(error),
      })
      return RESULT_CODES.PANIC
    }
  }
}
