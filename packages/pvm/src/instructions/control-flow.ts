/**
 * Control Flow Instructions
 *
 * NOP, HALT, ERROR, CALL, RETURN, JUMP, JUMP_IF, JUMP_IF_NOT
 */

import { logger } from '@pbnj/core'
import type { InstructionContext, InstructionResult } from '@pbnj/types'
import { OPCODES, RESULT_CODES } from '../config'
import { BaseInstruction } from './base'

/**
 * TRAP instruction (opcode 0x00)
 * Panics the PVM as specified in Gray Paper
 */
export class TRAPInstruction extends BaseInstruction {
  readonly opcode = OPCODES.TRAP
  readonly name = 'TRAP'
  readonly description = 'Panic the PVM'

  execute(_context: InstructionContext): InstructionResult {
    logger.debug('Executing TRAP instruction')
    return {
      resultCode: RESULT_CODES.PANIC,
      newInstructionPointer: undefined,
      newGasCounter: undefined,
    }
  }

  validate(_operands: Uint8Array): boolean {
    return true // No operands required
  }

  disassemble(_operands: Uint8Array): string {
    return this.name
  }
}

/**
 * FALLTHROUGH instruction (opcode 0x01)
 * No operation as specified in Gray Paper
 */
export class FALLTHROUGHInstruction extends BaseInstruction {
  readonly opcode = OPCODES.FALLTHROUGH
  readonly name = 'FALLTHROUGH'
  readonly description = 'No operation'

  execute(context: InstructionContext): InstructionResult {
    logger.debug('Executing FALLTHROUGH instruction')
    return {
      resultCode: RESULT_CODES.HALT,
      newInstructionPointer: context.instructionPointer + 1n,
      newGasCounter: context.gasCounter - 1n,
    }
  }

  validate(_operands: Uint8Array): boolean {
    return true // No operands required
  }

  disassemble(_operands: Uint8Array): string {
    return this.name
  }
}

/**
 * JUMP instruction (opcode 0x40)
 * Unconditional jump with offset as specified in Gray Paper
 */
export class JUMPInstruction extends BaseInstruction {
  readonly opcode = OPCODES.JUMP
  readonly name = 'JUMP'
  readonly description = 'Unconditional jump with offset'

  execute(context: InstructionContext): InstructionResult {
    // For JUMP: operands[0] = offset (8-bit immediate)
    const offset = context.instruction.operands[0]
    const targetAddress = context.instructionPointer + BigInt(offset)

    logger.debug('Executing JUMP instruction', { offset, targetAddress })

    return {
      resultCode: RESULT_CODES.HALT,
      newInstructionPointer: targetAddress,
      newGasCounter: context.gasCounter - 1n,
    }
  }

  validate(operands: Uint8Array): boolean {
    return operands.length >= 1 // Need offset
  }

  disassemble(operands: Uint8Array): string {
    const offset = operands[0]
    return `${this.name} ${offset}`
  }
}

/**
 * JUMP_IND instruction (opcode 0x50)
 * Indirect jump as specified in Gray Paper
 */
export class JUMP_INDInstruction extends BaseInstruction {
  readonly opcode = OPCODES.JUMP_IND
  readonly name = 'JUMP_IND'
  readonly description = 'Indirect jump using register + immediate'

  execute(context: InstructionContext): InstructionResult {
    const registerA = this.getRegisterA(context.instruction.operands)
    const immediate = this.getImmediateValue(context.instruction.operands, 1n)
    const registerValue = this.getRegisterValue(context.registers, registerA)
    const targetAddress = (registerValue + immediate) % 2n ** 32n

    logger.debug('Executing JUMP_IND instruction', {
      registerA,
      immediate,
      targetAddress,
    })

    return {
      resultCode: RESULT_CODES.HALT,
      newInstructionPointer: targetAddress,
      newGasCounter: context.gasCounter - 1n,
    }
  }

  validate(operands: Uint8Array): boolean {
    return operands.length >= 2 // Need register and immediate
  }

  disassemble(operands: Uint8Array): string {
    const registerA = this.getRegisterA(operands)
    const immediate = this.getImmediateValue(operands, 1n)
    return `${this.name} r${registerA} ${immediate}`
  }
}

/**
 * LOAD_IMM_JUMP instruction (opcode 0x80)
 * Load immediate and jump as specified in Gray Paper
 */
export class LOAD_IMM_JUMPInstruction extends BaseInstruction {
  readonly opcode = OPCODES.LOAD_IMM_JUMP
  readonly name = 'LOAD_IMM_JUMP'
  readonly description = 'Load immediate into register and jump'

  execute(context: InstructionContext): InstructionResult {
    const registerA = this.getRegisterA(context.instruction.operands)
    const immediate = this.getImmediateValue(context.instruction.operands, 1n)
    const offset = this.getImmediateValue(context.instruction.operands, 2n, 2n)
    const targetAddress = context.instructionPointer + offset

    logger.debug('Executing LOAD_IMM_JUMP instruction', {
      registerA,
      immediate,
      targetAddress,
    })

    const newRegisters = { ...context.registers }
    this.setRegisterValue(newRegisters, registerA, immediate)

    return {
      resultCode: RESULT_CODES.HALT,
      newInstructionPointer: targetAddress,
      newGasCounter: context.gasCounter - 1n,
      newRegisters,
    }
  }

  validate(operands: Uint8Array): boolean {
    return operands.length >= 4 // Need register, immediate, and offset
  }

  disassemble(operands: Uint8Array): string {
    const registerA = this.getRegisterA(operands)
    const immediate = this.getImmediateValue(operands, 1n)
    const offset = this.getImmediateValue(operands, 2n, 2n)
    return `${this.name} r${registerA} ${immediate} ${offset}`
  }
}

/**
 * LOAD_IMM_JUMP_IND instruction (opcode 0x180)
 * Load immediate and indirect jump as specified in Gray Paper
 */
export class LOAD_IMM_JUMP_INDInstruction extends BaseInstruction {
  readonly opcode = OPCODES.LOAD_IMM_JUMP_IND
  readonly name = 'LOAD_IMM_JUMP_IND'
  readonly description = 'Load immediate into register and indirect jump'

  execute(context: InstructionContext): InstructionResult {
    const registerA = this.getRegisterA(context.instruction.operands)
    const registerB = this.getRegisterB(context.instruction.operands)
    const immediateX = this.getImmediateValue(context.instruction.operands, 2n)
    const immediateY = this.getImmediateValue(
      context.instruction.operands,
      3n,
      2n,
    )
    const registerValue = this.getRegisterValue(context.registers, registerB)
    const targetAddress = (registerValue + immediateY) % 2n ** 32n

    logger.debug('Executing LOAD_IMM_JUMP_IND instruction', {
      registerA,
      registerB,
      immediateX,
      targetAddress,
    })

    const newRegisters = { ...context.registers }
    this.setRegisterValue(newRegisters, registerA, immediateX)

    return {
      resultCode: RESULT_CODES.HALT,
      newInstructionPointer: targetAddress,
      newGasCounter: context.gasCounter - 1n,
      newRegisters,
    }
  }

  validate(operands: Uint8Array): boolean {
    return operands.length >= 5 // Need two registers and two immediates
  }

  disassemble(operands: Uint8Array): string {
    const registerA = this.getRegisterA(operands)
    const registerB = this.getRegisterB(operands)
    const immediateX = this.getImmediateValue(operands, 2n)
    const immediateY = this.getImmediateValue(operands, 3n, 2n)
    return `${this.name} r${registerA} r${registerB} ${immediateX} ${immediateY}`
  }
}
