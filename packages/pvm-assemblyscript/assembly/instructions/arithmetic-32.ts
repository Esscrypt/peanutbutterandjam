import { OPCODE_ADD_32, OPCODE_DIV_S_32, OPCODE_DIV_U_32, OPCODE_MUL_32, OPCODE_REM_S_32, OPCODE_REM_U_32, OPCODE_SUB_32 } from '../config'
import { InstructionContext, InstructionResult } from '../types'
import { BaseInstruction } from './base'

/**
 * ADD_32 instruction (opcode 0xBE / 190)
 * Gray Paper formula: reg'_D = sext{4}{(reg_A + reg_B) mod 2^32}
 */
export class ADD_32Instruction extends BaseInstruction {
  opcode: i32 = OPCODE_ADD_32
  name: string = 'ADD_32'

  /**
   * Gray Paper: Instructions with 2 registers + immediate = 11 bytes
   * (1 opcode + 2 registers + 8 immediate)
   */
  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.operands) // From operands[1]
    const registerA = this.getRegisterA(context.operands) // From operands[0] low nibble
    const registerB = this.getRegisterB(context.operands) // From operands[0] high nibble

    const valueA = this.getRegisterValueAs32(context.registers, registerA)
    const valueB = this.getRegisterValueAs32(context.registers, registerB)

    // Gray Paper formula: reg'_D = sext{4}{(reg_A + reg_B) mod 2^32}
    // Step 1: (reg_A + reg_B) mod 2^32
    const sum = (valueA + valueB) & u64(0xffffffff)
    
    // Use setRegisterValueWith32BitResult which will mask and sign-extend
    // This matches the Gray Paper formula: sext{4}{sum mod 2^32}
    this.setRegisterValueWith32BitResult(context.registers, registerD, sum)

    return new InstructionResult(-1)
  }
}

/**
 * SUB_32 instruction (opcode 0xBF / 191)
 * Gray Paper formula: reg'_D = sext{4}{(reg_A + 2^32 - (reg_B mod 2^32)) mod 2^32}
 */
export class SUB_32Instruction extends BaseInstruction {
  opcode: i32 = OPCODE_SUB_32
  name: string = 'SUB_32'

  execute(context: InstructionContext): InstructionResult {
    // Extract operands from code starting at programCounter + 1
    const pc = i32(context.programCounter)
    const operands = context.code.slice(pc + 1, pc + 3)
    
    const registerD = this.getRegisterD(operands)
    const registerA = this.getRegisterIndex(operands[0])
    const registerB = this.getRegisterB(operands)
    const valueA = this.getRegisterValueAs32(context.registers, registerA)
    const valueB = this.getRegisterValueAs32(context.registers, registerB)
    const result = (valueA - valueB + i64(0x100000000)) & i64(0xffffffff) // Handle underflow

    this.setRegisterValueWith32BitResult(context.registers, registerD, result)

    return new InstructionResult(-1)
  }
}

/**
 * MUL_32 instruction (opcode 0xC0 / 192)
 * Gray Paper formula: reg'_D = sext{4}{(reg_A · reg_B) mod 2^32}
 */
export class MUL_32Instruction extends BaseInstruction {
  opcode: i32 = OPCODE_MUL_32
  name: string = 'MUL_32'

  execute(context: InstructionContext): InstructionResult {
    // Extract operands from code starting at programCounter + 1
    const pc = i32(context.programCounter)
    const operands = context.code.slice(pc + 1, pc + 3)
    
    const registerD = this.getRegisterD(operands)
    const registerA = this.getRegisterIndex(operands[0])
    const registerB = this.getRegisterB(operands)
    const valueA = this.getRegisterValueAs32(context.registers, registerA)
    const valueB = this.getRegisterValueAs32(context.registers, registerB)
    const result = (valueA * valueB) & i64(0xffffffff)

    this.setRegisterValueWith32BitResult(context.registers, registerD, result)

    return new InstructionResult(-1)
  }
}

/**
 * DIV_U_32 instruction (opcode 0xC1 / 193)
 * Gray Paper formula: reg'_D = {2^64 - 1 when reg_B mod 2^32 = 0, sext{4}{floor((reg_A mod 2^32) ÷ (reg_B mod 2^32))} otherwise}
 */
export class DIV_U_32Instruction extends BaseInstruction {
  opcode: i32 = OPCODE_DIV_U_32
  name: string = 'DIV_U_32'

  execute(context: InstructionContext): InstructionResult {
    // Extract operands from code starting at programCounter + 1
    const pc = i32(context.programCounter)
    const operands = context.code.slice(pc + 1, pc + 3)
    
    const registerD = this.getRegisterD(operands)
    const registerA = this.getRegisterIndex(operands[0])
    const registerB = this.getRegisterB(operands)

    // Gray Paper: reg'_D = sext{4}{floor((reg_A mod 2^32) / (reg_B mod 2^32))}
    const valueA = this.getRegisterValueAs32(context.registers, registerA)
    const valueB = this.getRegisterValueAs32(context.registers, registerB)

    // Gray Paper: Handle division by zero - result = 2^64 - 1
    // Use u64 to avoid overflow: 0xFFFFFFFFFFFFFFFF
    let result: i64
    if (valueB === i64(0)) {
      result = i64(u64(0xFFFFFFFFFFFFFFFF)) // 2^64 - 1
    } else {
      // Unsigned division with sign-extension of result
      result = valueA / valueB
    }

    this.setRegisterValueWith32BitResult(context.registers, registerD, result)

    return new InstructionResult(-1)
  }
}

/**
 * DIV_S_32 instruction (opcode 0xC2 / 194)
 * Gray Paper formula: reg'_D = {2^64 - 1 when b = 0, unsigned{a} when a = -2^31 ∧ b = -1, unsigned{rtz(a ÷ b)} otherwise}
 * where a = signed_4(reg_A mod 2^32), b = signed_4(reg_B mod 2^32)
 */
export class DIV_S_32Instruction extends BaseInstruction {
  opcode: i32 = OPCODE_DIV_S_32
  name: string = 'DIV_S_32'

  execute(context: InstructionContext): InstructionResult {
    // Extract operands from code starting at programCounter + 1
    const registerD = this.getRegisterD(context.operands)
    const registerA = this.getRegisterA(context.operands)
    const registerB = this.getRegisterB(context.operands)
    const valueA = this.getRegisterValueAs32(context.registers, registerA)
    const valueB = this.getRegisterValueAs32(context.registers, registerB)

    // Convert to signed values (check if negative in 32-bit context)
    // Gray Paper: signed_4(x) means interpret 32-bit value as signed
    const isNegativeA = (valueA & u64(0x80000000)) !== u64(0)
    const isNegativeB = (valueB & u64(0x80000000)) !== u64(0)

    // Convert to signed: if MSB is set, subtract 2^32 to get negative value
    // Use u64 for the calculation to avoid overflow, then convert to i64
    const signedA_u64 = isNegativeA ? valueA - u64(0x100000000) : valueA
    const signedB_u64 = isNegativeB ? valueB - u64(0x100000000) : valueB
    const signedA = i64(signedA_u64)
    const signedB = i64(signedB_u64)

    // Gray Paper: handle special cases
    let result: i64
    if (signedB === i64(0)) {
      // Division by zero: result = 2^64 - 1
      // Use u64 to avoid overflow: 0xFFFFFFFFFFFFFFFF
      result = i64(u64(0xFFFFFFFFFFFFFFFF))
    } else if (valueA === i64(0x80000000) && valueB === i64(0xffffffff)) {
      // Gray Paper: unsigned{a} when a = -2^31 ∧ b = -1
      // Check using 32-bit values: 0x80000000 = -2^31, 0xffffffff = -1
      result = valueA
    } else {
      // Gray Paper: unsigned{rtz(a ÷ b)} - round towards zero, result as unsigned
      const signedResult = signedA / signedB
      result = i64(signedResult) < i64(0) ? signedResult + (i64(1) << i64(32)) : signedResult
      // Ensure result is within 32-bit range
      result = result & i64(0xffffffff)
    }

    this.setRegisterValueWith32BitResult(context.registers, registerD, result)

    return new InstructionResult(-1)
  }
}

/**
 * REM_U_32 instruction (opcode 0xC3 / 195)
 * Gray Paper formula: reg'_D = {sext{4}{reg_A mod 2^32} when reg_B mod 2^32 = 0, sext{4}{(reg_A mod 2^32) mod (reg_B mod 2^32)} otherwise}
 */
export class REM_U_32Instruction extends BaseInstruction {
  opcode: i32 = OPCODE_REM_U_32
  name: string = 'REM_U_32'

  execute(context: InstructionContext): InstructionResult {

    const registerD = this.getRegisterD(context.operands)
    const registerA = this.getRegisterA(context.operands)
    const registerB = this.getRegisterB(context.operands)
    const valueA = this.getRegisterValueAs32(context.registers, registerA)
    const valueB = this.getRegisterValueAs32(context.registers, registerB)

    // Gray Paper: when B = 0, result = sext(4, A mod 2^32)
    const result = valueB === u64(0) ? valueA : valueA % valueB

    this.setRegisterValueWith32BitResult(context.registers, registerD, result)

    return new InstructionResult(-1)
  }
}

/**
 * REM_S_32 instruction (opcode 0xC4 / 196)
 * Gray Paper formula: reg'_D = {0 when a = -2^31 ∧ b = -1, unsigned{smod(a, b)} otherwise}
 * where a = signed_4(reg_A mod 2^32), b = signed_4(reg_B mod 2^32)
 */
export class REM_S_32Instruction extends BaseInstruction {
  opcode: i32 = OPCODE_REM_S_32
  name: string = 'REM_S_32'

  execute(context: InstructionContext): InstructionResult {
    // Extract operands from code starting at programCounter + 1
    const pc = i32(context.programCounter)
    const operands = context.code.slice(pc + 1, pc + 3)
    
    const registerD = this.getRegisterD(operands)
    const registerA = this.getRegisterIndex(operands[0])
    const registerB = this.getRegisterB(operands)
    const valueA = this.getRegisterValueAs32(context.registers, registerA)
    const valueB = this.getRegisterValueAs32(context.registers, registerB)

    // Convert to signed values (signExtend32 returns u64, but represents sign-extended value)
    const signedA_u64 = this.signExtend32(valueA)
    const signedB_u64 = this.signExtend32(valueB)
    const signedA = i64(signedA_u64)
    const signedB = i64(signedB_u64)

    // Gray Paper: reg'_D = {0 when a = -2^31 ∧ b = -1, unsigned{smod(a, b)} otherwise}
    let result: i64
    if (signedA === -(i64(1) << i64(31)) && signedB === i64(-1)) {
      // Special overflow case: result = 0
      result = i64(0)
    } else if (signedB === i64(0)) {
      // Gray Paper: smod(a, b) = a when b = 0
      // Convert signed value a to unsigned
      result = signedA < i64(0) ? signedA + (i64(1) << i64(32)) : signedA
    } else {
      // Gray Paper: smod(a, b) = sgn(a) · (|a| mod |b|)
      // Check if valueA is negative in 32-bit context (MSB set)
      const isNegativeA = (valueA & i64(0x80000000)) !== i64(0)
      const isNegativeB = (valueB & i64(0x80000000)) !== i64(0)

      const absA = isNegativeA ? i64(0x100000000) - valueA : valueA
      const absB = isNegativeB ? i64(0x100000000) - valueB : valueB
      const signA = isNegativeA ? i64(-1) : i64(1)
      const modResult = absA % absB
      const signedResult = signA * modResult
      // Gray Paper: unsigned{smod(a, b)} - convert signed result to unsigned
      result = signedResult < i64(0) ? signedResult + (i64(1) << i64(32)) : signedResult
    }
    
    this.setRegisterValueWith32BitResult(context.registers, registerD, result)

    return new InstructionResult(-1)
  }
}
