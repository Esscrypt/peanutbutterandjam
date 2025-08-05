import { logger } from '@pbnj/core'
import { OPCODES, RESULT_CODES } from '../config'
import type { InstructionContext, InstructionResult } from '../types'
import { BaseInstruction } from './base'

export class ADD_32Instruction extends BaseInstruction {
  readonly opcode = OPCODES.ADD_32
  readonly name = 'ADD_32'
  readonly description = 'Add 32-bit registers'

  execute(context: InstructionContext): InstructionResult {
    // For ADD_32: operands[0] = destination, operands[1] = source1, operands[2] = source2
    const registerD = this.getRegisterIndex(context.instruction.operands[0])
    const registerA = this.getRegisterIndex(context.instruction.operands[1])
    const registerB = this.getRegisterIndex(context.instruction.operands[2])
    const valueA =
      this.getRegisterValue(context.registers, registerA) % 2n ** 32n
    const valueB =
      this.getRegisterValue(context.registers, registerB) % 2n ** 32n
    const result = (valueA + valueB) % 2n ** 32n

    logger.debug('Executing ADD_32 instruction', {
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
    const registerD = this.getRegisterIndex(operands[0])
    const registerA = this.getRegisterIndex(operands[1])
    const registerB = this.getRegisterIndex(operands[2])
    return `${this.name} r${registerD} r${registerA} r${registerB}`
  }
}

export class SUB_32Instruction extends BaseInstruction {
  readonly opcode = OPCODES.SUB_32
  readonly name = 'SUB_32'
  readonly description = 'Subtract 32-bit registers'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const registerB = this.getRegisterB(context.instruction.operands)
    const valueA =
      this.getRegisterValue(context.registers, registerA) % 2n ** 32n
    const valueB =
      this.getRegisterValue(context.registers, registerB) % 2n ** 32n
    const result = (valueA - valueB + 2n ** 32n) % 2n ** 32n // Handle underflow

    logger.debug('Executing SUB_32 instruction', {
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

export class MUL_32Instruction extends BaseInstruction {
  readonly opcode = OPCODES.MUL_32
  readonly name = 'MUL_32'
  readonly description = 'Multiply 32-bit registers'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const registerB = this.getRegisterB(context.instruction.operands)
    const valueA =
      this.getRegisterValue(context.registers, registerA) % 2n ** 32n
    const valueB =
      this.getRegisterValue(context.registers, registerB) % 2n ** 32n
    const result = (valueA * valueB) % 2n ** 32n

    logger.debug('Executing MUL_32 instruction', {
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

export class DIV_U_32Instruction extends BaseInstruction {
  readonly opcode = OPCODES.DIV_U_32
  readonly name = 'DIV_U_32'
  readonly description = 'Divide 32-bit registers (unsigned)'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const registerB = this.getRegisterB(context.instruction.operands)
    const valueA =
      this.getRegisterValue(context.registers, registerA) % 2n ** 32n
    const valueB =
      this.getRegisterValue(context.registers, registerB) % 2n ** 32n

    // Handle division by zero
    if (valueB === 0n) {
      logger.warn('Division by zero in DIV_U_32 instruction')
      return {
        resultCode: RESULT_CODES.FAULT,
        newInstructionPointer: context.instructionPointer,
        newGasCounter: context.gasCounter,
      }
    }

    const result = valueA / valueB

    logger.debug('Executing DIV_U_32 instruction', {
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

export class DIV_S_32Instruction extends BaseInstruction {
  readonly opcode = OPCODES.DIV_S_32
  readonly name = 'DIV_S_32'
  readonly description = 'Divide 32-bit registers (signed)'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const registerB = this.getRegisterB(context.instruction.operands)
    const valueA =
      this.getRegisterValue(context.registers, registerA) % 2n ** 32n
    const valueB =
      this.getRegisterValue(context.registers, registerB) % 2n ** 32n

    // Convert to signed values
    const signedA = valueA > 2n ** 31n - 1n ? valueA - 2n ** 32n : valueA
    const signedB = valueB > 2n ** 31n - 1n ? valueB - 2n ** 32n : valueB

    // Handle division by zero
    if (signedB === 0n) {
      logger.warn('Division by zero in DIV_S_32 instruction')
      return {
        resultCode: RESULT_CODES.FAULT,
        newInstructionPointer: context.instructionPointer,
        newGasCounter: context.gasCounter,
      }
    }

    const signedResult = signedA / signedB
    const result = signedResult < 0n ? signedResult + 2n ** 32n : signedResult

    logger.debug('Executing DIV_S_32 instruction', {
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

export class REM_U_32Instruction extends BaseInstruction {
  readonly opcode = OPCODES.REM_U_32
  readonly name = 'REM_U_32'
  readonly description = 'Remainder 32-bit registers (unsigned)'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const registerB = this.getRegisterB(context.instruction.operands)
    const valueA =
      this.getRegisterValue(context.registers, registerA) % 2n ** 32n
    const valueB =
      this.getRegisterValue(context.registers, registerB) % 2n ** 32n

    // Handle division by zero
    if (valueB === 0n) {
      logger.warn('Division by zero in REM_U_32 instruction')
      return {
        resultCode: RESULT_CODES.FAULT,
        newInstructionPointer: context.instructionPointer,
        newGasCounter: context.gasCounter,
      }
    }

    const result = valueA % valueB

    logger.debug('Executing REM_U_32 instruction', {
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

export class REM_S_32Instruction extends BaseInstruction {
  readonly opcode = OPCODES.REM_S_32
  readonly name = 'REM_S_32'
  readonly description = 'Remainder 32-bit registers (signed)'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const registerB = this.getRegisterB(context.instruction.operands)
    const valueA =
      this.getRegisterValue(context.registers, registerA) % 2n ** 32n
    const valueB =
      this.getRegisterValue(context.registers, registerB) % 2n ** 32n

    // Convert to signed values
    const signedA = valueA > 2n ** 31n - 1n ? valueA - 2n ** 32n : valueA
    const signedB = valueB > 2n ** 31n - 1n ? valueB - 2n ** 32n : valueB

    // Handle division by zero
    if (signedB === 0n) {
      logger.warn('Division by zero in REM_S_32 instruction')
      return {
        resultCode: RESULT_CODES.FAULT,
        newInstructionPointer: context.instructionPointer,
        newGasCounter: context.gasCounter,
      }
    }

    const signedResult = signedA % signedB
    const result = signedResult < 0n ? signedResult + 2n ** 32n : signedResult

    logger.debug('Executing REM_S_32 instruction', {
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
