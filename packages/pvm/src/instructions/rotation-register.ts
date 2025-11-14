import type { InstructionContext, InstructionResult } from '@pbnj/types'
import { OPCODES } from '../config'
import { BaseInstruction } from './base'

export class ROT_L_64Instruction extends BaseInstruction {
  readonly opcode = OPCODES.ROT_L_64
  readonly name = 'ROT_L_64'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const registerB = this.getRegisterB(context.instruction.operands)
    const valueA = this.getRegisterValue(context.registers, registerA)
    const rotationAmount = Number(
      this.getRegisterValue(context.registers, registerB) % 64n,
    )
    const result = this.rotateLeft64(valueA, rotationAmount)

    context.log('ROT_L_64: Rotate left (64-bit)', {
      registerD,
      registerA,
      registerB,
      valueA,
      rotationAmount,
      result,
    })
    this.setRegisterValue(context.registers, registerD, result)

    // Mutate context directly
    

    return { resultCode: null }
  }

  private rotateLeft64(value: bigint, amount: number): bigint {
    // Handle negative rotation amounts
    if (amount < 0) {
      amount = 64 + amount
    }

    // Normalize amount to 0-63 range
    amount = amount % 64

    if (amount === 0) return value

    // Perform left rotation
    const mask = (1n << 64n) - 1n
    const leftPart = (value << BigInt(amount)) & mask
    const rightPart = value >> BigInt(64 - amount)
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
  readonly opcode = OPCODES.ROT_L_32
  readonly name = 'ROT_L_32' 

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const registerB = this.getRegisterB(context.instruction.operands)
    const valueA =
      this.getRegisterValue(context.registers, registerA) % 2n ** 32n
    const rotationAmount = Number(
      this.getRegisterValue(context.registers, registerB) % 32n,
    )
    const result = this.rotateLeft32(valueA, rotationAmount)

    context.log('ROT_L_32: Rotate left (32-bit)', {
      registerD,
      registerA,
      registerB,
      valueA,
      rotationAmount,
      result,
    })
    // Gray Paper: reg'_D = sext{4}{x} - sign-extend 32-bit result to 64 bits
    this.setRegisterValueWith32BitResult(context.registers, registerD, result)

    // Mutate context directly
    return { resultCode: null }
  }


  private rotateLeft32(value: bigint, amount: number): bigint {
    // Handle negative rotation amounts
    if (amount < 0) {
      amount = 32 + amount
    }

    // Normalize amount to 0-31 range
    amount = amount % 32

    if (amount === 0) return value

    // Perform left rotation
    const mask = (1n << 32n) - 1n
    const leftPart = (value << BigInt(amount)) & mask
    const rightPart = value >> BigInt(32 - amount)
    return (leftPart | rightPart) & mask
  }
}

export class ROT_R_64Instruction extends BaseInstruction {
  readonly opcode = OPCODES.ROT_R_64
  readonly name = 'ROT_R_64'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const registerB = this.getRegisterB(context.instruction.operands)
    const valueA = this.getRegisterValue(context.registers, registerA)
    const rotationAmount = Number(
      this.getRegisterValue(context.registers, registerB) % 64n,
    )
    const result = this.rotateRight64(valueA, rotationAmount)

    context.log('ROT_R_64: Rotate right (64-bit)', {
      registerD,
      registerA,
      registerB,
      valueA,
      rotationAmount,
      result,
    })
    this.setRegisterValue(context.registers, registerD, result)

    // Mutate context directly
    

    return { resultCode: null }
  }

  private rotateRight64(value: bigint, amount: number): bigint {
    // Handle negative rotation amounts
    if (amount < 0) {
      amount = 64 + amount
    }

    // Normalize amount to 0-63 range
    amount = amount % 64

    if (amount === 0) return value

    // Perform right rotation
    const mask = (1n << 64n) - 1n
    const rightPart = value >> BigInt(amount)
    const leftPart = (value << BigInt(64 - amount)) & mask
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
  readonly opcode = OPCODES.ROT_R_32
  readonly name = 'ROT_R_32'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const registerB = this.getRegisterB(context.instruction.operands)
    const valueA =
      this.getRegisterValue(context.registers, registerA) % 2n ** 32n
    const rotationAmount = Number(
      this.getRegisterValue(context.registers, registerB) % 32n,
    )
    const result = this.rotateRight32(valueA, rotationAmount)

    context.log('ROT_R_32: Rotate right (32-bit)', {
      registerD,
      registerA,
      registerB,
      valueA,
      rotationAmount,
      result,
    })
    // Gray Paper: reg'_D = sext{4}{x} - sign-extend 32-bit result to 64 bits
    this.setRegisterValueWith32BitResult(context.registers, registerD, result)

    // Mutate context directly
    

    return { resultCode: null }
  }

  private rotateRight32(value: bigint, amount: number): bigint {
    // Handle negative rotation amounts
    if (amount < 0) {
      amount = 32 + amount
    }

    // Normalize amount to 0-31 range
    amount = amount % 32

    if (amount === 0) return value

    // Perform right rotation
    const mask = (1n << 32n) - 1n
    const rightPart = value >> BigInt(amount)
    const leftPart = (value << BigInt(32 - amount)) & mask
    return (rightPart | leftPart) & mask
  }
}
