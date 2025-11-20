import { OPCODE_ADD_64, OPCODE_DIV_S_64, OPCODE_DIV_U_64, OPCODE_MUL_64, OPCODE_REM_S_64, OPCODE_REM_U_64, OPCODE_SUB_64 } from '../config'
import { InstructionContext, InstructionResult } from '../types'
import { BaseInstruction } from './base'

export class ADD_64Instruction extends BaseInstruction {
  opcode: i32 = OPCODE_ADD_64
  name: string = 'ADD_64'
  
  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.operands)
    const registerA = this.getRegisterA(context.operands)
    const registerB = this.getRegisterB(context.operands)
    const valueA = this.getRegisterValueAs64(context.registers, registerA)
    const valueB = this.getRegisterValueAs64(context.registers, registerB)
    const result = valueA + valueB

    this.setRegisterValueWith64BitResult(context.registers, registerD, result)

    return new InstructionResult(-1)
  }
}

export class SUB_64Instruction extends BaseInstruction {
  opcode: i32 = OPCODE_SUB_64
  name: string = 'SUB_64'
  
  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.operands)
    const registerA = this.getRegisterA(context.operands)
    const registerB = this.getRegisterB(context.operands)
    const valueA = this.getRegisterValueAs64(context.registers, registerA)
    const valueB = this.getRegisterValueAs64(context.registers, registerB)
    const result = valueA - valueB

    this.setRegisterValueWith64BitResult(context.registers, registerD, result)

    return new InstructionResult(-1)
  }
}

export class MUL_64Instruction extends BaseInstruction {
  opcode: i32 = OPCODE_MUL_64
  name: string = 'MUL_64'
  
  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.operands)
    const registerA = this.getRegisterA(context.operands)
    const registerB = this.getRegisterB(context.operands)
    const valueA = this.getRegisterValueAs64(context.registers, registerA)
    const valueB = this.getRegisterValueAs64(context.registers, registerB)
    const result = valueA * valueB

    this.setRegisterValueWith64BitResult(context.registers, registerD, result)

    return new InstructionResult(-1)
  }
}

export class DIV_U_64Instruction extends BaseInstruction {
  opcode: i32 = OPCODE_DIV_U_64
  name: string = 'DIV_U_64'
  
  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.operands)
    const registerA = this.getRegisterA(context.operands)
    const registerB = this.getRegisterB(context.operands)
    const valueA = this.getRegisterValueAs64(context.registers, registerA)
    const valueB = this.getRegisterValueAs64(context.registers, registerB)

    // Gray Paper: division by zero results in 2^64 - 1
    // Use u64 to avoid overflow: 0xFFFFFFFFFFFFFFFF
    const result = valueB === i64(0) ? i64(u64(0xFFFFFFFFFFFFFFFF)) : valueA / valueB

    this.setRegisterValue(context.registers, registerD, result)

    return new InstructionResult(-1)
  }
}

export class DIV_S_64Instruction extends BaseInstruction {
  opcode: i32 = OPCODE_DIV_S_64
  name: string = 'DIV_S_64'
  
  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.operands)
    const registerA = this.getRegisterA(context.operands)
    const registerB = this.getRegisterB(context.operands)
    const valueA = this.getRegisterValueAs64(context.registers, registerA)
    const valueB = this.getRegisterValueAs64(context.registers, registerB)

    // Convert to signed values
    const signedA = this.toSigned64(valueA)
    const signedB = this.toSigned64(valueB)

    // Gray Paper: handle special cases
    let result: i64
    if (signedB === i64(0)) {
      // Division by zero: result = 2^64 - 1
      // Use u64 to avoid overflow: 0xFFFFFFFFFFFFFFFF
      result = i64(u64(0xFFFFFFFFFFFFFFFF))
    } else if (signedA === -(i64(1) << i64(63)) && signedB === i64(-1)) {
      // Overflow case: result = unsigned(a) = valueA
      result = valueA
    } else {
      // Normal division: round towards zero
      // Gray Paper: unsigned{rtz(a ÷ b)} - convert signed result to unsigned
      const signedResult = signedA / signedB
      // Convert negative result to unsigned: add 2^64
      // Use u64 arithmetic to avoid overflow: signedResult + 2^64 = signedResult + 0xFFFFFFFFFFFFFFFF + 1
      if (signedResult < i64(0)) {
        // For negative values, we need to add 2^64 to get the unsigned representation
        // Since we can't do i64 + 2^64 directly, we use u64 arithmetic
        // u64(signedResult) when signedResult is negative gives a large positive (two's complement)
        // But we want signedResult + 2^64, which is: u64(signedResult) (already includes the 2^64 offset)
        // Actually, in two's complement, a negative i64 value when viewed as u64 IS the unsigned representation
        // So we can just cast: u64(signedResult) is correct
        result = i64(u64(signedResult))
      } else {
        result = signedResult
      }
    }

    this.setRegisterValue(context.registers, registerD, result)

    return new InstructionResult(-1)
  }
}

export class REM_U_64Instruction extends BaseInstruction {
  opcode: i32 = OPCODE_REM_U_64
  name: string = 'REM_U_64'
  
  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.operands)
    const registerA = this.getRegisterA(context.operands)
    const registerB = this.getRegisterB(context.operands)
    const valueA = this.getRegisterValueAs64(context.registers, registerA)
    const valueB = this.getRegisterValueAs64(context.registers, registerB)

    // Gray Paper: when B = 0, result = A
    const result = valueB === i64(0) ? valueA : valueA % valueB

    this.setRegisterValue(context.registers, registerD, result)

    return new InstructionResult(-1)
  }
}

export class REM_S_64Instruction extends BaseInstruction {
  opcode: i32 = OPCODE_REM_S_64
  name: string = 'REM_S_64'
  
  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.operands)
    const registerA = this.getRegisterA(context.operands)
    const registerB = this.getRegisterB(context.operands)
    const valueA = this.getRegisterValueAs64(context.registers, registerA)
    const valueB = this.getRegisterValueAs64(context.registers, registerB)

    // Convert to signed values using toSigned64 helper
    const signedA = this.toSigned64(valueA)
    const signedB = this.toSigned64(valueB)

    // Gray Paper: smod(a, b) = a when b = 0, or 0 when a = -2^63 and b = -1
    let result: i64
    if (signedA === -(i64(1) << i64(63)) && signedB === i64(-1)) {
      // Special overflow case: result = 0
      result = i64(0)
    } else if (signedB === i64(0)) {
      // Division by zero: result = a (signed modulo definition)
      result = valueA
    } else {
      // Normal case: sgn(a) * (|a| mod |b|)
      const absA = signedA < i64(0) ? -signedA : signedA
      const absB = signedB < i64(0) ? -signedB : signedB
      const sign = signedA < i64(0) ? i64(-1) : i64(1)
      const signedResult = sign * (absA % absB)
      // Convert signed result to unsigned using two's complement
      // Casting negative i64 to u64 automatically adds 2^64
      result = i64(u64(signedResult))
    }

    this.setRegisterValue(context.registers, registerD, result)

    return new InstructionResult(-1)
  }
}
