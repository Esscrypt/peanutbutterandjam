import { logger } from '@pbnj/core'
import type { InstructionContext, InstructionResult } from '@pbnj/types'
import { OPCODES, RESULT_CODES } from '../config'
import { BaseInstruction } from './base'

export class SHLO_L_64Instruction extends BaseInstruction {
  readonly opcode = OPCODES.SHLO_L_64
  readonly name = 'SHLO_L_64'
  readonly description = 'Shift left (64-bit)'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const registerB = this.getRegisterB(context.instruction.operands)
    const valueA = this.getRegisterValue(context.registers, registerA)
    const shiftAmount = Number(
      this.getRegisterValue(context.registers, registerB) % 64n,
    )
    const result = valueA << BigInt(shiftAmount)

    logger.debug('Executing SHLO_L_64 instruction', {
      registerD,
      registerA,
      registerB,
      valueA,
      shiftAmount,
      result,
    })

    const newRegisters = { ...context.registers }
    this.setRegisterValue(newRegisters, registerD, result)

    return {
      resultCode: RESULT_CODES.HALT,
      newInstructionPointer: context.instructionPointer + 1,
      newGasCounter: context.gasCounter - 1n,
      newRegisters,
    }
  }

  validate(operands: Uint8Array): boolean {
    if (operands.length !== 3) {
      return false
    }
    return true
  }

  disassemble(operands: Uint8Array): string {
    const registerD = this.getRegisterD(operands)
    const registerA = this.getRegisterA(operands)
    const registerB = this.getRegisterB(operands)
    return `${this.name} r${registerD} r${registerA} r${registerB}`
  }
}

export class SHLO_R_64Instruction extends BaseInstruction {
  readonly opcode = OPCODES.SHLO_R_64
  readonly name = 'SHLO_R_64'
  readonly description = 'Shift right logical (64-bit)'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const registerB = this.getRegisterB(context.instruction.operands)
    const valueA = this.getRegisterValue(context.registers, registerA)
    const shiftAmount = Number(
      this.getRegisterValue(context.registers, registerB) % 64n,
    )
    const result = valueA >> BigInt(shiftAmount)

    logger.debug('Executing SHLO_R_64 instruction', {
      registerD,
      registerA,
      registerB,
      valueA,
      shiftAmount,
      result,
    })

    const newRegisters = { ...context.registers }
    this.setRegisterValue(newRegisters, registerD, result)

    return {
      resultCode: RESULT_CODES.HALT,
      newInstructionPointer: context.instructionPointer + 1,
      newGasCounter: context.gasCounter - 1n,
      newRegisters,
    }
  }

  validate(operands: Uint8Array): boolean {
    if (operands.length !== 3) {
      return false
    }
    return true
  }

  disassemble(operands: Uint8Array): string {
    const registerD = this.getRegisterD(operands)
    const registerA = this.getRegisterA(operands)
    const registerB = this.getRegisterB(operands)
    return `${this.name} r${registerD} r${registerA} r${registerB}`
  }
}

export class SHAR_R_64Instruction extends BaseInstruction {
  readonly opcode = OPCODES.SHAR_R_64
  readonly name = 'SHAR_R_64'
  readonly description = 'Shift right arithmetic (64-bit)'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const registerB = this.getRegisterB(context.instruction.operands)
    const valueA = this.getRegisterValue(context.registers, registerA)
    const shiftAmount = Number(
      this.getRegisterValue(context.registers, registerB) % 64n,
    )

    // Convert to signed for arithmetic shift
    const signedValue = valueA > 2n ** 63n - 1n ? valueA - 2n ** 64n : valueA
    const shiftedValue = signedValue >> BigInt(shiftAmount)
    const result = shiftedValue < 0n ? shiftedValue + 2n ** 64n : shiftedValue

    logger.debug('Executing SHAR_R_64 instruction', {
      registerD,
      registerA,
      registerB,
      valueA,
      signedValue,
      shiftAmount,
      shiftedValue,
      result,
    })

    const newRegisters = { ...context.registers }
    this.setRegisterValue(newRegisters, registerD, result)

    return {
      resultCode: RESULT_CODES.HALT,
      newInstructionPointer: context.instructionPointer + 1,
      newGasCounter: context.gasCounter - 1n,
      newRegisters,
    }
  }

  validate(operands: Uint8Array): boolean {
    if (operands.length !== 3) {
      return false
    }
    return true
  }

  disassemble(operands: Uint8Array): string {
    const registerD = this.getRegisterD(operands)
    const registerA = this.getRegisterA(operands)
    const registerB = this.getRegisterB(operands)
    return `${this.name} r${registerD} r${registerA} r${registerB}`
  }
}
