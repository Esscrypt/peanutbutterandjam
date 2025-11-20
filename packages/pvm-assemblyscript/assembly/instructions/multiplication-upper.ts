import {
  OPCODE_MUL_UPPER_S_S,
  OPCODE_MUL_UPPER_S_U,
  OPCODE_MUL_UPPER_U_U,
} from '../config'
import { InstructionContext, InstructionResult } from '../types'
import { BaseInstruction } from './base'

export class MUL_UPPER_S_SInstruction extends BaseInstruction {
  opcode: i32 = OPCODE_MUL_UPPER_S_S
  name: string = 'MUL_UPPER_S_S'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.operands)
    const registerA = this.getRegisterA(context.operands)
    const registerB = this.getRegisterB(context.operands)
    const valueA = this.getRegisterValue(context.registers, registerA)
    const valueB = this.getRegisterValue(context.registers, registerB)

    // Convert to signed 64-bit values
    const signedA = i64(valueA)
    const signedB = i64(valueB)

    // Split into high and low 32-bit parts
    const aLo = u64(signedA) & u64(0xffffffff)
    const aHi = i64(signedA >> 32)
    const bLo = u64(signedB) & u64(0xffffffff)
    const bHi = i64(signedB >> 32)

    // Compute 128-bit product: (a_hi * 2^32 + a_lo) * (b_hi * 2^32 + b_lo)
    // Upper 64 bits = a_hi * b_hi + ((a_hi * b_lo + a_lo * b_hi) >> 32) + carry
    const aHi_bHi = i64(aHi * bHi)
    const aHi_bLo = i64(aHi) * i64(bLo)
    const aLo_bHi = i64(aLo) * i64(bHi)
    const aLo_bLo = u64(aLo) * u64(bLo)

    // Middle term: (a_hi * b_lo + a_lo * b_hi)
    const middle = aHi_bLo + aLo_bHi
    const middleHi = i64(middle >> 32)
    const middleLo = i64(middle & i64(0xffffffff))

    // Check for carry from low multiplication
    const carry = (aLo_bLo >> 32) + (middleLo >> 32)
    const carryOverflow = carry >> 32

    // Upper 64 bits result
    const upperBits = aHi_bHi + middleHi + i64(carryOverflow)

    // Convert back to unsigned representation
    const result = u64(upperBits)

    this.setRegisterValue(context.registers, registerD, result)

    return new InstructionResult(-1)
  }
}

export class MUL_UPPER_U_UInstruction extends BaseInstruction {
  opcode: i32 = OPCODE_MUL_UPPER_U_U
  name: string = 'MUL_UPPER_U_U'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.operands)
    const registerA = this.getRegisterA(context.operands)
    const registerB = this.getRegisterB(context.operands)
    const valueA = this.getRegisterValue(context.registers, registerA)
    const valueB = this.getRegisterValue(context.registers, registerB)

    // Split into high and low 32-bit parts
    const aLo = valueA & u64(0xffffffff)
    const aHi = valueA >> 32
    const bLo = valueB & u64(0xffffffff)
    const bHi = valueB >> 32

    // Compute 128-bit product: (a_hi * 2^32 + a_lo) * (b_hi * 2^32 + b_lo)
    // Upper 64 bits = a_hi * b_hi + ((a_hi * b_lo + a_lo * b_hi) >> 32) + carry
    const aHi_bHi = aHi * bHi
    const aHi_bLo = aHi * bLo
    const aLo_bHi = aLo * bHi
    const aLo_bLo = aLo * bLo

    // Middle term: (a_hi * b_lo + a_lo * b_hi)
    const middle = aHi_bLo + aLo_bHi
    const middleHi = middle >> 32
    const middleLo = middle & u64(0xffffffff)

    // Check for carry from low multiplication
    const carry = (aLo_bLo >> 32) + (middleLo >> 32)
    const carryOverflow = carry >> 32

    // Upper 64 bits result
    const result = aHi_bHi + middleHi + carryOverflow

    this.setRegisterValue(context.registers, registerD, result)

    return new InstructionResult(-1)
  }
}

export class MUL_UPPER_S_UInstruction extends BaseInstruction {
  opcode: i32 = OPCODE_MUL_UPPER_S_U
  name: string = 'MUL_UPPER_S_U'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.operands)
    const registerA = this.getRegisterA(context.operands)
    const registerB = this.getRegisterB(context.operands)
    const valueA = this.getRegisterValue(context.registers, registerA)
    const valueB = this.getRegisterValue(context.registers, registerB)

    // Convert first operand to signed, keep second as unsigned
    const signedA = i64(valueA)
    const unsignedB = valueB

    // Split into high and low 32-bit parts
    const aLo = u64(signedA) & u64(0xffffffff)
    const aHi = i64(signedA >> 32)
    const bLo = unsignedB & u64(0xffffffff)
    const bHi = unsignedB >> 32

    // Compute 128-bit product: (a_hi * 2^32 + a_lo) * (b_hi * 2^32 + b_lo)
    // Upper 64 bits = a_hi * b_hi + ((a_hi * b_lo + a_lo * b_hi) >> 32) + carry
    const aHi_bHi = i64(aHi) * i64(bHi)
    const aHi_bLo = i64(aHi) * i64(bLo)
    const aLo_bHi = i64(aLo) * i64(bHi)
    const aLo_bLo = u64(aLo) * u64(bLo)

    // Middle term: (a_hi * b_lo + a_lo * b_hi)
    const middle = aHi_bLo + aLo_bHi
    const middleHi = i64(middle >> 32)
    const middleLo = i64(middle & i64(0xffffffff))

    // Check for carry from low multiplication
    const carry = (aLo_bLo >> 32) + (middleLo >> 32)
    const carryOverflow = carry >> 32

    // Upper 64 bits result
    const upperBits = aHi_bHi + middleHi + i64(carryOverflow)

    // Convert back to unsigned representation
    const result = u64(upperBits)

    this.setRegisterValue(context.registers, registerD, result)

    return new InstructionResult(-1)
  }
}
