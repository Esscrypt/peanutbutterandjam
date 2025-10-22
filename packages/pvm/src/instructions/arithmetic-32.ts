import { logger } from '@pbnj/core'
import type { InstructionContext, InstructionResult } from '@pbnj/types'
import { OPCODES } from '../config'
import { BaseInstruction } from './base'

/**
 * ADD_32 instruction (opcode 0xBE / 190)
 * Gray Paper formula: reg'_D = sext{4}{(reg_A + reg_B) mod 2^32}
 */
export class ADD_32Instruction extends BaseInstruction {
  readonly opcode = OPCODES.ADD_32
  readonly name = 'ADD_32'
  readonly description = 'Add 32-bit registers'

  /**
   * Gray Paper: Instructions with 2 registers + immediate = 11 bytes
   * (1 opcode + 2 registers + 8 immediate)
   */
  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const registerB = this.getRegisterB(context.instruction.operands)

    const valueA = this.getRegisterValueAs32(context.registers, registerA)
    const valueB = this.getRegisterValueAs32(context.registers, registerB)
    const sum = (valueA + valueB) & 0xffffffffn
    const result = this.signExtend(sum, 4)

    logger.debug('Executing ADD_32 instruction', {
      registerD,
      registerA,
      registerB,
      valueA,
      valueB,
      result,
    })

    this.setRegisterValueWith32BitResult(context.registers, registerD, result)
    context.gas -= 1n

    return { resultCode: null }
  }

  disassemble(operands: Uint8Array): string {
    const registerD = this.getRegisterD(operands)
    const registerA = this.getRegisterA(operands)
    const registerB = this.getRegisterB(operands)
    return `${this.name} r${registerD} r${registerA} r${registerB}`
  }
}

/**
 * SUB_32 instruction (opcode 0xBF / 191)
 * Gray Paper formula: reg'_D = sext{4}{(reg_A + 2^32 - (reg_B mod 2^32)) mod 2^32}
 */
export class SUB_32Instruction extends BaseInstruction {
  readonly opcode = OPCODES.SUB_32
  readonly name = 'SUB_32'
  readonly description = 'Subtract 32-bit registers'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const registerB = this.getRegisterB(context.instruction.operands)
    const valueA = this.getRegisterValueAs32(context.registers, registerA)
    const valueB = this.getRegisterValueAs32(context.registers, registerB)
    const result = (valueA - valueB + 0x100000000n) & 0xffffffffn // Handle underflow

    logger.debug('Executing SUB_32 instruction', {
      registerD,
      registerA,
      registerB,
      valueA,
      valueB,
      result,
    })

    // Mutate context directly
    this.setRegisterValueWith32BitResult(
      context.registers,
      registerD,
      BigInt(result),
    )
    context.gas -= 1n

    return { resultCode: null }
  }

  disassemble(operands: Uint8Array): string {
    const registerD = this.getRegisterD(operands)
    const registerA = this.getRegisterA(operands)
    const registerB = this.getRegisterB(operands)
    return `${this.name} r${registerD} r${registerA} r${registerB}`
  }
}

/**
 * MUL_32 instruction (opcode 0xC0 / 192)
 * Gray Paper formula: reg'_D = sext{4}{(reg_A · reg_B) mod 2^32}
 */
export class MUL_32Instruction extends BaseInstruction {
  readonly opcode = OPCODES.MUL_32
  readonly name = 'MUL_32'
  readonly description = 'Multiply 32-bit registers'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const registerB = this.getRegisterB(context.instruction.operands)
    const valueA = this.getRegisterValueAs32(context.registers, registerA)
    const valueB = this.getRegisterValueAs32(context.registers, registerB)
    const result = (valueA * valueB) & 0xffffffffn

    logger.debug('Executing MUL_32 instruction', {
      registerD,
      registerA,
      registerB,
      valueA,
      valueB,
      result,
    })

    // Mutate context directly
    this.setRegisterValueWith32BitResult(
      context.registers,
      registerD,
      BigInt(result),
    )
    context.gas -= 1n

    return { resultCode: null }
  }

  disassemble(operands: Uint8Array): string {
    const registerD = this.getRegisterD(operands)
    const registerA = this.getRegisterA(operands)
    const registerB = this.getRegisterB(operands)
    return `${this.name} r${registerD} r${registerA} r${registerB}`
  }
}

/**
 * DIV_U_32 instruction (opcode 0xC1 / 193)
 * Gray Paper formula: reg'_D = {2^64 - 1 when reg_B mod 2^32 = 0, sext{4}{floor((reg_A mod 2^32) ÷ (reg_B mod 2^32))} otherwise}
 */
export class DIV_U_32Instruction extends BaseInstruction {
  readonly opcode = OPCODES.DIV_U_32
  readonly name = 'DIV_U_32'
  readonly description = 'Divide 32-bit registers (unsigned)'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const registerB = this.getRegisterB(context.instruction.operands)

    // Gray Paper: reg'_D = sext{4}{floor((reg_A mod 2^32) / (reg_B mod 2^32))}
    // Get register values and mask to 32 bits
    const valueA = this.getRegisterValueAs32(context.registers, registerA)
    const valueB = this.getRegisterValueAs32(context.registers, registerB)

    // Gray Paper: Handle division by zero - result = 2^64 - 1
    let result: bigint
    if (valueB === 0n) {
      result = 2n ** 64n - 1n
    } else {
      // Unsigned division with sign-extension of result
      result = valueA / valueB
    }

    logger.debug('Executing DIV_U_32 instruction', {
      registerD,
      registerA,
      registerB,
      valueA,
      valueB,
      result,
    })

    // Mutate context directly
    this.setRegisterValueWith32BitResult(context.registers, registerD, result)
    context.gas -= 1n

    return { resultCode: null }
  }

  disassemble(operands: Uint8Array): string {
    const registerD = this.getRegisterD(operands)
    const registerA = this.getRegisterA(operands)
    const registerB = this.getRegisterB(operands)
    return `${this.name} r${registerD} r${registerA} r${registerB}`
  }
}

/**
 * DIV_S_32 instruction (opcode 0xC2 / 194)
 * Gray Paper formula: reg'_D = {2^64 - 1 when b = 0, unsigned{a} when a = -2^31 ∧ b = -1, unsigned{rtz(a ÷ b)} otherwise}
 * where a = signed_4(reg_A mod 2^32), b = signed_4(reg_B mod 2^32)
 */
export class DIV_S_32Instruction extends BaseInstruction {
  readonly opcode = OPCODES.DIV_S_32
  readonly name = 'DIV_S_32'
  readonly description = 'Divide 32-bit registers (signed)'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const registerB = this.getRegisterB(context.instruction.operands)
    const valueA = this.getRegisterValueAs32(context.registers, registerA)
    const valueB = this.getRegisterValueAs32(context.registers, registerB)

    // Convert to signed values (check if negative in 32-bit context)
    const isNegativeA = (valueA & 0x80000000n) !== 0n
    const isNegativeB = (valueB & 0x80000000n) !== 0n

    const signedA = isNegativeA ? valueA - 0x100000000n : valueA
    const signedB = isNegativeB ? valueB - 0x100000000n : valueB

    // Gray Paper: handle special cases
    let result: bigint
    if (signedB === 0n) {
      // Division by zero: result = 2^64 - 1
      result = 2n ** 64n - 1n
    } else if (valueA === 0x80000000n && valueB === 0xffffffffn) {
      // Gray Paper: unsigned{a} when a = -2^31 ∧ b = -1
      // Check using 32-bit values: 0x80000000 = -2^31, 0xffffffff = -1
      result = valueA
    } else {
      // Gray Paper: unsigned{rtz(a ÷ b)} - round towards zero, result as unsigned
      const signedResult = signedA / signedB
      result = signedResult < 0n ? signedResult + 2n ** 32n : signedResult
      // Ensure result is within 32-bit range
      result = result & 0xffffffffn
    }

    console.log('Executing DIV_S_32 instruction', {
      registerD,
      registerA,
      registerB,
      signedA,
      signedB,
      result,
    })

    // Mutate context directly
    this.setRegisterValueWith32BitResult(context.registers, registerD, result)
    context.gas -= 1n

    return { resultCode: null }
  }

  disassemble(operands: Uint8Array): string {
    const registerD = this.getRegisterD(operands)
    const registerA = this.getRegisterA(operands)
    const registerB = this.getRegisterB(operands)
    return `${this.name} r${registerD} r${registerA} r${registerB}`
  }
}

/**
 * REM_U_32 instruction (opcode 0xC3 / 195)
 * Gray Paper formula: reg'_D = {sext{4}{reg_A mod 2^32} when reg_B mod 2^32 = 0, sext{4}{(reg_A mod 2^32) mod (reg_B mod 2^32)} otherwise}
 */
export class REM_U_32Instruction extends BaseInstruction {
  readonly opcode = OPCODES.REM_U_32
  readonly name = 'REM_U_32'
  readonly description = 'Remainder 32-bit registers (unsigned)'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const registerB = this.getRegisterB(context.instruction.operands)
    const valueA = this.getRegisterValueAs32(context.registers, registerA)
    const valueB = this.getRegisterValueAs32(context.registers, registerB)

    // Gray Paper: when B = 0, result = sext(4, A mod 2^32)
    const result = valueB === 0n ? valueA : valueA % valueB

    logger.debug('Executing REM_U_32 instruction', {
      registerD,
      registerA,
      registerB,
      valueA,
      valueB,
      result,
    })

    // Mutate context directly
    this.setRegisterValueWith32BitResult(context.registers, registerD, result)
    context.gas -= 1n

    return { resultCode: null }
  }

  disassemble(operands: Uint8Array): string {
    const registerD = this.getRegisterD(operands)
    const registerA = this.getRegisterA(operands)
    const registerB = this.getRegisterB(operands)
    return `${this.name} r${registerD} r${registerA} r${registerB}`
  }
}

/**
 * REM_S_32 instruction (opcode 0xC4 / 196)
 * Gray Paper formula: reg'_D = {0 when a = -2^31 ∧ b = -1, unsigned{smod(a, b)} otherwise}
 * where a = signed_4(reg_A mod 2^32), b = signed_4(reg_B mod 2^32)
 */
export class REM_S_32Instruction extends BaseInstruction {
  readonly opcode = OPCODES.REM_S_32
  readonly name = 'REM_S_32'
  readonly description = 'Remainder 32-bit registers (signed)'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const registerB = this.getRegisterB(context.instruction.operands)
    const valueA = this.getRegisterValueAs32(context.registers, registerA)
    const valueB = this.getRegisterValueAs32(context.registers, registerB)

    // Convert to signed values
    const signedA = this.signExtend(valueA, 4)
    const signedB = this.signExtend(valueB, 4)

    // Gray Paper: reg'_D = {0 when a = -2^31 ∧ b = -1, unsigned{smod(a, b)} otherwise}
    let result: bigint
    if (signedA === -(2n ** 31n) && signedB === -1n) {
      // Special overflow case: result = 0
      result = 0n
    } else if (signedB === 0n) {
      // Gray Paper: smod(a, b) = a when b = 0
      // Convert signed value a to unsigned
      result = signedA < 0n ? signedA + 2n ** 32n : signedA
    } else {
      // Gray Paper: smod(a, b) = sgn(a) · (|a| mod |b|)
      // Check if valueA is negative in 32-bit context (MSB set)
      const isNegativeA = (valueA & 0x80000000n) !== 0n
      const isNegativeB = (valueB & 0x80000000n) !== 0n

      const absA = isNegativeA ? 0x100000000n - valueA : valueA
      const absB = isNegativeB ? 0x100000000n - valueB : valueB
      const signA = isNegativeA ? -1n : 1n
      const modResult = absA % absB
      const signedResult = signA * modResult
      // Gray Paper: unsigned{smod(a, b)} - convert signed result to unsigned
      result = signedResult < 0n ? signedResult + 2n ** 32n : signedResult
    }
    // Mutate context directly
    this.setRegisterValueWith32BitResult(context.registers, registerD, result)
    context.gas -= 1n

    return { resultCode: null }
  }

  disassemble(operands: Uint8Array): string {
    const registerD = this.getRegisterD(operands)
    const registerA = this.getRegisterA(operands)
    const registerB = this.getRegisterB(operands)
    return `${this.name} r${registerD} r${registerA} r${registerB}`
  }
}
