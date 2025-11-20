import {
  OPCODE_ROT_L_32,
  OPCODE_ROT_L_64,
  OPCODE_ROT_R_32,
  OPCODE_ROT_R_64,
} from '../config'
import { InstructionContext, InstructionResult } from '../types'
import { BaseInstruction } from './base'

export class ROT_L_64Instruction extends BaseInstruction {
  opcode: i32 = OPCODE_ROT_L_64
  name: string = 'ROT_L_64'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.operands)
    const registerA = this.getRegisterA(context.operands)
    const registerB = this.getRegisterB(context.operands)
    const valueA = this.getRegisterValue(context.registers, registerA)
    const rotationAmount = i32(
      this.getRegisterValue(context.registers, registerB) % u64(64),
    )
    const result = this.rotateLeft64(valueA, rotationAmount)

    this.setRegisterValue(context.registers, registerD, result)

    return new InstructionResult(-1)
  }

  rotateLeft64(value: u64, amount: i32): u64 {
    // Handle negative rotation amounts
    let normalizedAmount = amount
    if (amount < 0) {
      normalizedAmount = 64 + amount
    }

    // Normalize amount to 0-63 range
    normalizedAmount = normalizedAmount % 64

    if (normalizedAmount === 0) return value

    // Perform left rotation
    const mask = u64(0xffffffffffffffff)
    const leftPart = (value << u64(normalizedAmount)) & mask
    const rightPart = value >> u64(64 - normalizedAmount)
    return (leftPart | rightPart) & mask
  }
}

/**
 * ROT_L_32 instruction (opcode 0xDD / 221)
 * Gray Paper pvm.tex line 678:
 * reg'_D = sext{4}{x} where x ∈ Nbits{32}, ∀i ∈ Nmax{32} : bitsfunc{4}(x)_{(i + reg_B) mod 32} = bitsfunc{4}(reg_A)_i
 *
 * Rotates the lower 32 bits of reg_A left by reg_B positions, then sign-extends to 64 bits.
 */
export class ROT_L_32Instruction extends BaseInstruction {
  opcode: i32 = OPCODE_ROT_L_32
  name: string = 'ROT_L_32'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.operands)
    const registerA = this.getRegisterA(context.operands)
    const registerB = this.getRegisterB(context.operands)
    const valueA =
      this.getRegisterValue(context.registers, registerA) & u64(0xffffffff)
    const rotationAmount = i32(
      this.getRegisterValue(context.registers, registerB) % u64(32),
    )
    const result = this.rotateLeft32(valueA, rotationAmount)

    // Gray Paper: reg'_D = sext{4}{x} - sign-extend 32-bit result to 64 bits
    this.setRegisterValueWith32BitResult(context.registers, registerD, result)

    return new InstructionResult(-1)
  }

  rotateLeft32(value: u64, amount: i32): u64 {
    // Handle negative rotation amounts
    let normalizedAmount = amount
    if (amount < 0) {
      normalizedAmount = 32 + amount
    }

    // Normalize amount to 0-31 range
    normalizedAmount = normalizedAmount % 32

    if (normalizedAmount === 0) return value

    // Perform left rotation
    const mask = u64(0xffffffff)
    const leftPart = (value << u64(normalizedAmount)) & mask
    const rightPart = value >> u64(32 - normalizedAmount)
    return (leftPart | rightPart) & mask
  }
}

export class ROT_R_64Instruction extends BaseInstruction {
  opcode: i32 = OPCODE_ROT_R_64
  name: string = 'ROT_R_64'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.operands)
    const registerA = this.getRegisterA(context.operands)
    const registerB = this.getRegisterB(context.operands)
    const valueA = this.getRegisterValue(context.registers, registerA)
    const rotationAmount = i32(
      this.getRegisterValue(context.registers, registerB) % u64(64),
    )
    const result = this.rotateRight64(valueA, rotationAmount)

    this.setRegisterValue(context.registers, registerD, result)

    return new InstructionResult(-1)
  }

  rotateRight64(value: u64, amount: i32): u64 {
    // Handle negative rotation amounts
    let normalizedAmount = amount
    if (amount < 0) {
      normalizedAmount = 64 + amount
    }

    // Normalize amount to 0-63 range
    normalizedAmount = normalizedAmount % 64

    if (normalizedAmount === 0) return value

    // Perform right rotation
    const mask = u64(0xffffffffffffffff)
    const rightPart = value >> u64(normalizedAmount)
    const leftPart = (value << u64(64 - normalizedAmount)) & mask
    return (rightPart | leftPart) & mask
  }
}

/**
 * ROT_R_32 instruction (opcode 0xDF / 223)
 * Gray Paper pvm.tex line 680:
 * reg'_D = sext{4}{x} where x ∈ Nbits{32}, ∀i ∈ Nmax{32} : bitsfunc{4}(x)_i = bitsfunc{4}(reg_A)_{(i + reg_B) mod 32}
 *
 * Rotates the lower 32 bits of reg_A right by reg_B positions, then sign-extends to 64 bits.
 */
export class ROT_R_32Instruction extends BaseInstruction {
  opcode: i32 = OPCODE_ROT_R_32
  name: string = 'ROT_R_32'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.operands)
    const registerA = this.getRegisterA(context.operands)
    const registerB = this.getRegisterB(context.operands)
    const valueA =
      this.getRegisterValue(context.registers, registerA) & u64(0xffffffff)
    const rotationAmount = i32(
      this.getRegisterValue(context.registers, registerB) % u64(32),
    )
    const result = this.rotateRight32(valueA, rotationAmount)

    // Gray Paper: reg'_D = sext{4}{x} - sign-extend 32-bit result to 64 bits
    this.setRegisterValueWith32BitResult(context.registers, registerD, result)

    return new InstructionResult(-1)
  }

  rotateRight32(value: u64, amount: i32): u64 {
    // Handle negative rotation amounts
    let normalizedAmount = amount
    if (amount < 0) {
      normalizedAmount = 32 + amount
    }

    // Normalize amount to 0-31 range
    normalizedAmount = normalizedAmount % 32

    if (normalizedAmount === 0) return value

    // Perform right rotation
    const mask = u64(0xffffffff)
    const rightPart = value >> u64(normalizedAmount)
    const leftPart = (value << u64(32 - normalizedAmount)) & mask
    return (rightPart | leftPart) & mask
  }
}
