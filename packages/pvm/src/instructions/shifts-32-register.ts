import { logger } from '@pbnj/core'
import { OPCODES, RESULT_CODES } from '../config'
import type { InstructionContext, InstructionResult } from '../types'
import { BaseInstruction } from './base'

export class SHLO_L_32Instruction extends BaseInstruction {
  readonly opcode = OPCODES.SHLO_L_32
  readonly name = 'SHLO_L_32'
  readonly description = 'Shift left (32-bit)'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const registerB = this.getRegisterB(context.instruction.operands)
    const valueA =
      this.getRegisterValue(context.registers, registerA) % 2n ** 32n
    const shiftAmount = Number(
      this.getRegisterValue(context.registers, registerB) % 32n,
    )
    const result = (valueA << BigInt(shiftAmount)) % 2n ** 32n

    logger.debug('Executing SHLO_L_32 instruction', {
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

  validate(operands: number[]): boolean {
    return operands.length >= 3 // Need three registers
  }

  disassemble(operands: number[]): string {
    const registerD = this.getRegisterD(operands)
    const registerA = this.getRegisterA(operands)
    const registerB = this.getRegisterB(operands)
    return `${this.name} r${registerD} r${registerA} r${registerB}`
  }
}

export class SHLO_R_32Instruction extends BaseInstruction {
  readonly opcode = OPCODES.SHLO_R_32
  readonly name = 'SHLO_R_32'
  readonly description = 'Shift right logical (32-bit)'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const registerB = this.getRegisterB(context.instruction.operands)
    const valueA =
      this.getRegisterValue(context.registers, registerA) % 2n ** 32n
    const shiftAmount = Number(
      this.getRegisterValue(context.registers, registerB) % 32n,
    )
    const result = valueA >> BigInt(shiftAmount)

    logger.debug('Executing SHLO_R_32 instruction', {
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

  validate(operands: number[]): boolean {
    return operands.length >= 3 // Need three registers
  }

  disassemble(operands: number[]): string {
    const registerD = this.getRegisterD(operands)
    const registerA = this.getRegisterA(operands)
    const registerB = this.getRegisterB(operands)
    return `${this.name} r${registerD} r${registerA} r${registerB}`
  }
}

export class SHAR_R_32Instruction extends BaseInstruction {
  readonly opcode = OPCODES.SHAR_R_32
  readonly name = 'SHAR_R_32'
  readonly description = 'Shift right arithmetic (32-bit)'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const registerB = this.getRegisterB(context.instruction.operands)
    const valueA =
      this.getRegisterValue(context.registers, registerA) % 2n ** 32n
    const shiftAmount = Number(
      this.getRegisterValue(context.registers, registerB) % 32n,
    )

    // Convert to signed for arithmetic shift
    const signedValue = valueA > 2n ** 31n - 1n ? valueA - 2n ** 32n : valueA
    const shiftedValue = signedValue >> BigInt(shiftAmount)
    const result = shiftedValue < 0n ? shiftedValue + 2n ** 32n : shiftedValue

    logger.debug('Executing SHAR_R_32 instruction', {
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

  validate(operands: number[]): boolean {
    return operands.length >= 3 // Need three registers
  }

  disassemble(operands: number[]): string {
    const registerD = this.getRegisterD(operands)
    const registerA = this.getRegisterA(operands)
    const registerB = this.getRegisterB(operands)
    return `${this.name} r${registerD} r${registerA} r${registerB}`
  }
}
