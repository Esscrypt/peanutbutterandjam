import { logger } from '@pbnj/core'
import { OPCODES, RESULT_CODES } from '../config'
import type { InstructionContext, InstructionResult } from '../types'
import { BaseInstruction } from './base'

export class ADD_64Instruction extends BaseInstruction {
  readonly opcode = OPCODES.ADD_64
  readonly name = 'ADD_64'
  readonly description = 'Add 64-bit registers'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const registerB = this.getRegisterB(context.instruction.operands)
    const valueA = this.getRegisterValue(context.registers, registerA)
    const valueB = this.getRegisterValue(context.registers, registerB)
    const result = valueA + valueB

    logger.debug('Executing ADD_64 instruction', {
      registerD,
      registerA,
      registerB,
      valueA,
      valueB,
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

export class SUB_64Instruction extends BaseInstruction {
  readonly opcode = OPCODES.SUB_64
  readonly name = 'SUB_64'
  readonly description = 'Subtract 64-bit registers'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const registerB = this.getRegisterB(context.instruction.operands)
    const valueA = this.getRegisterValue(context.registers, registerA)
    const valueB = this.getRegisterValue(context.registers, registerB)
    const result = valueA - valueB

    logger.debug('Executing SUB_64 instruction', {
      registerD,
      registerA,
      registerB,
      valueA,
      valueB,
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

export class MUL_64Instruction extends BaseInstruction {
  readonly opcode = OPCODES.MUL_64
  readonly name = 'MUL_64'
  readonly description = 'Multiply 64-bit registers'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const registerB = this.getRegisterB(context.instruction.operands)
    const valueA = this.getRegisterValue(context.registers, registerA)
    const valueB = this.getRegisterValue(context.registers, registerB)
    const result = valueA * valueB

    logger.debug('Executing MUL_64 instruction', {
      registerD,
      registerA,
      registerB,
      valueA,
      valueB,
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

export class DIV_U_64Instruction extends BaseInstruction {
  readonly opcode = OPCODES.DIV_U_64
  readonly name = 'DIV_U_64'
  readonly description = 'Divide 64-bit registers (unsigned)'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const registerB = this.getRegisterB(context.instruction.operands)
    const valueA = this.getRegisterValue(context.registers, registerA)
    const valueB = this.getRegisterValue(context.registers, registerB)

    // Handle division by zero
    if (valueB === 0n) {
      logger.warn('Division by zero in DIV_U_64 instruction')
      return {
        resultCode: RESULT_CODES.FAULT,
        newInstructionPointer: context.instructionPointer,
        newGasCounter: context.gasCounter,
      }
    }

    const result = valueA / valueB

    logger.debug('Executing DIV_U_64 instruction', {
      registerD,
      registerA,
      registerB,
      valueA,
      valueB,
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

export class DIV_S_64Instruction extends BaseInstruction {
  readonly opcode = OPCODES.DIV_S_64
  readonly name = 'DIV_S_64'
  readonly description = 'Divide 64-bit registers (signed)'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const registerB = this.getRegisterB(context.instruction.operands)
    const valueA = this.getRegisterValue(context.registers, registerA)
    const valueB = this.getRegisterValue(context.registers, registerB)

    // Convert to signed values
    const signedA = valueA > 2n ** 63n - 1n ? valueA - 2n ** 64n : valueA
    const signedB = valueB > 2n ** 63n - 1n ? valueB - 2n ** 64n : valueB

    // Handle division by zero
    if (signedB === 0n) {
      logger.warn('Division by zero in DIV_S_64 instruction')
      return {
        resultCode: RESULT_CODES.FAULT,
        newInstructionPointer: context.instructionPointer,
        newGasCounter: context.gasCounter,
      }
    }

    const signedResult = signedA / signedB
    const result = signedResult < 0n ? signedResult + 2n ** 64n : signedResult

    logger.debug('Executing DIV_S_64 instruction', {
      registerD,
      registerA,
      registerB,
      signedA,
      signedB,
      signedResult,
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

export class REM_U_64Instruction extends BaseInstruction {
  readonly opcode = OPCODES.REM_U_64
  readonly name = 'REM_U_64'
  readonly description = 'Remainder 64-bit registers (unsigned)'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const registerB = this.getRegisterB(context.instruction.operands)
    const valueA = this.getRegisterValue(context.registers, registerA)
    const valueB = this.getRegisterValue(context.registers, registerB)

    // Handle division by zero
    if (valueB === 0n) {
      logger.warn('Division by zero in REM_U_64 instruction')
      return {
        resultCode: RESULT_CODES.FAULT,
        newInstructionPointer: context.instructionPointer,
        newGasCounter: context.gasCounter,
      }
    }

    const result = valueA % valueB

    logger.debug('Executing REM_U_64 instruction', {
      registerD,
      registerA,
      registerB,
      valueA,
      valueB,
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

export class REM_S_64Instruction extends BaseInstruction {
  readonly opcode = OPCODES.REM_S_64
  readonly name = 'REM_S_64'
  readonly description = 'Remainder 64-bit registers (signed)'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const registerB = this.getRegisterB(context.instruction.operands)
    const valueA = this.getRegisterValue(context.registers, registerA)
    const valueB = this.getRegisterValue(context.registers, registerB)

    // Convert to signed values
    const signedA = valueA > 2n ** 63n - 1n ? valueA - 2n ** 64n : valueA
    const signedB = valueB > 2n ** 63n - 1n ? valueB - 2n ** 64n : valueB

    // Handle division by zero
    if (signedB === 0n) {
      logger.warn('Division by zero in REM_S_64 instruction')
      return {
        resultCode: RESULT_CODES.FAULT,
        newInstructionPointer: context.instructionPointer,
        newGasCounter: context.gasCounter,
      }
    }

    const signedResult = signedA % signedB
    const result = signedResult < 0n ? signedResult + 2n ** 64n : signedResult

    logger.debug('Executing REM_S_64 instruction', {
      registerD,
      registerA,
      registerB,
      signedA,
      signedB,
      signedResult,
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
