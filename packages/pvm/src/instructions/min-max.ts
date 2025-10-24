import { logger } from '@pbnj/core'
import type { InstructionContext, InstructionResult } from '@pbnj/types'
import { OPCODES } from '../config'
import { BaseInstruction } from './base'

export class MINInstruction extends BaseInstruction {
  readonly opcode = OPCODES.MIN
  readonly name = 'MIN'
  readonly description = 'Minimum (signed)'
  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const registerB = this.getRegisterB(context.instruction.operands)
    const valueA = this.getRegisterValue(context.registers, registerA)
    const valueB = this.getRegisterValue(context.registers, registerB)

    // Convert to signed values for comparison
    const signedA = this.toSigned64(valueA)
    const signedB = this.toSigned64(valueB)
    const result = signedA < signedB ? valueA : valueB

    logger.debug('Executing MIN instruction', {
      registerD,
      registerA,
      registerB,
      valueA,
      valueB,
      signedA,
      signedB,
      result,
    })
    this.setRegisterValue(context.registers, registerD, result)

    // Mutate context directly
    

    return { resultCode: null }
  }

  disassemble(operands: Uint8Array): string {
    const registerD = this.getRegisterD(operands)
    const registerA = this.getRegisterA(operands)
    const registerB = this.getRegisterB(operands)
    return `${this.name} r${registerD} r${registerA} r${registerB}`
  }

  private toSigned64(value: bigint): bigint {
    return value > 2n ** 63n - 1n ? value - 2n ** 64n : value
  }
}

export class MIN_UInstruction extends BaseInstruction {
  readonly opcode = OPCODES.MIN_U
  readonly name = 'MIN_U'
  readonly description = 'Minimum (unsigned)'
  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const registerB = this.getRegisterB(context.instruction.operands)
    const valueA = this.getRegisterValue(context.registers, registerA)
    const valueB = this.getRegisterValue(context.registers, registerB)
    const result = valueA < valueB ? valueA : valueB

    logger.debug('Executing MIN_U instruction', {
      registerD,
      registerA,
      registerB,
      valueA,
      valueB,
      result,
    })
    this.setRegisterValue(context.registers, registerD, result)

    // Mutate context directly
    

    return { resultCode: null }
  }

  disassemble(operands: Uint8Array): string {
    const registerD = this.getRegisterD(operands)
    const registerA = this.getRegisterA(operands)
    const registerB = this.getRegisterB(operands)
    return `${this.name} r${registerD} r${registerA} r${registerB}`
  }
}

export class MAXInstruction extends BaseInstruction {
  readonly opcode = OPCODES.MAX
  readonly name = 'MAX'
  readonly description = 'Maximum (signed)'
  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const registerB = this.getRegisterB(context.instruction.operands)
    const valueA = this.getRegisterValue(context.registers, registerA)
    const valueB = this.getRegisterValue(context.registers, registerB)

    // Convert to signed values for comparison
    const signedA = this.toSigned64(valueA)
    const signedB = this.toSigned64(valueB)
    const result = signedA > signedB ? valueA : valueB

    logger.debug('Executing MAX instruction', {
      registerD,
      registerA,
      registerB,
      valueA,
      valueB,
      signedA,
      signedB,
      result,
    })
    this.setRegisterValue(context.registers, registerD, result)

    // Mutate context directly
    

    return { resultCode: null }
  }

  disassemble(operands: Uint8Array): string {
    const registerD = this.getRegisterD(operands)
    const registerA = this.getRegisterA(operands)
    const registerB = this.getRegisterB(operands)
    return `${this.name} r${registerD} r${registerA} r${registerB}`
  }

  private toSigned64(value: bigint): bigint {
    return value > 2n ** 63n - 1n ? value - 2n ** 64n : value
  }
}

export class MAX_UInstruction extends BaseInstruction {
  readonly opcode = OPCODES.MAX_U
  readonly name = 'MAX_U'
  readonly description = 'Maximum (unsigned)'
  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const registerB = this.getRegisterB(context.instruction.operands)
    const valueA = this.getRegisterValue(context.registers, registerA)
    const valueB = this.getRegisterValue(context.registers, registerB)
    const result = valueA > valueB ? valueA : valueB

    logger.debug('Executing MAX_U instruction', {
      registerD,
      registerA,
      registerB,
      valueA,
      valueB,
      result,
    })
    this.setRegisterValue(context.registers, registerD, result)

    // Mutate context directly
    

    return { resultCode: null }
  }

  disassemble(operands: Uint8Array): string {
    const registerD = this.getRegisterD(operands)
    const registerA = this.getRegisterA(operands)
    const registerB = this.getRegisterB(operands)
    return `${this.name} r${registerD} r${registerA} r${registerB}`
  }
}
