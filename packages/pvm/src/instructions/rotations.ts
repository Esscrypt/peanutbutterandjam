import type { InstructionContext, InstructionResult } from '@pbnj/types'
import { OPCODES } from '../config'
import { BaseInstruction } from './base'

export class ROT_R_64_IMMInstruction extends BaseInstruction {
  readonly opcode = OPCODES.ROT_R_64_IMM
  readonly name = 'ROT_R_64_IMM'
  execute(context: InstructionContext): InstructionResult {
    // Gray Paper pvm.tex line 524: "Two Registers & One Immediate" format
    const { registerA, registerB, immediateX } =
      this.parseTwoRegistersAndImmediate(
        context.instruction.operands,
        context.fskip,
      )
    const registerValue = this.getRegisterValue(context.registers, registerB)

    // Ensure rotation amount is within 64-bit range
    const rotationAmount = immediateX % 64n
    const result = this.rotateRight64(registerValue, rotationAmount)

    context.log('ROT_R_64_IMM: Rotate right by immediate (64-bit)', {
      registerA,
      registerB,
      immediateX,
      registerValue,
      rotationAmount,
      result,
    })
    this.setRegisterValue(context.registers, registerA, result)

    // Mutate context directly
    

    return { resultCode: null }
  }



  private rotateRight64(value: bigint, amount: bigint): bigint {
    // Handle negative rotation amounts
    if (amount < 0) {
      amount = 64n + amount
    }

    // Normalize amount to 0-63 range
    amount = amount % 64n

    if (amount === 0n) return value

    // Perform right rotation
    const mask = (1n << 64n) - 1n
    const rightPart = value >> amount
    const leftPart = (value << (64n - amount)) & mask
    return (rightPart | leftPart) & mask
  }
}

export class ROT_R_64_IMM_ALTInstruction extends BaseInstruction {
  readonly opcode = OPCODES.ROT_R_64_IMM_ALT
  readonly name = 'ROT_R_64_IMM_ALT'
  execute(context: InstructionContext): InstructionResult {
    // Gray Paper pvm.tex line 525: "Two Registers & One Immediate" format
    const { registerA, registerB, immediateX } =
      this.parseTwoRegistersAndImmediate(
        context.instruction.operands,
        context.fskip,
      )
    // Gray Paper: rotates immediateX by registerB
    const immediateValue = immediateX
    const registerBValue = this.getRegisterValue(context.registers, registerB)

    // Alternative rotation implementation: rotate immediate by register value
    const rotationAmount = Number(registerBValue % 64n)
    const result = this.rotateRight64(immediateValue, rotationAmount)

    context.log('ROT_R_64_IMM_ALT: Alternative rotate right by immediate (64-bit)', {
      registerA,
      registerB,
      immediateX,
      registerBValue,
      rotationAmount,
      result,
    })
    this.setRegisterValue(context.registers, registerA, result)

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

export class ROT_R_32_IMMInstruction extends BaseInstruction {
  readonly opcode = OPCODES.ROT_R_32_IMM
  readonly name = 'ROT_R_32_IMM'
  execute(context: InstructionContext): InstructionResult {
    // Gray Paper pvm.tex line 526: "Two Registers & One Immediate" format
    const { registerA, registerB, immediateX } =
      this.parseTwoRegistersAndImmediate(
        context.instruction.operands,
        context.fskip,
      )
    const registerValue =
      this.getRegisterValue(context.registers, registerB) % 2n ** 32n

    // Ensure rotation amount is within 32-bit range
    const rotationAmount = Number(immediateX % 32n)
    const result = this.rotateRight32(registerValue, rotationAmount)

    context.log('ROT_R_32_IMM: Rotate right by immediate (32-bit)', {
      registerA,
      registerB,
      immediateX,
      registerValue,
      rotationAmount,
      result,
    })
    // Gray Paper: reg'_A = sext{4}{x} - sign-extend 32-bit result to 64 bits
    this.setRegisterValueWith32BitResult(context.registers, registerA, result)

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

export class ROT_R_32_IMM_ALTInstruction extends BaseInstruction {
  readonly opcode = OPCODES.ROT_R_32_IMM_ALT
  readonly name = 'ROT_R_32_IMM_ALT'
  execute(context: InstructionContext): InstructionResult {
    // Gray Paper pvm.tex line 527: "Two Registers & One Immediate" format
    const { registerA, registerB, immediateX } =
      this.parseTwoRegistersAndImmediate(
        context.instruction.operands,
        context.fskip,
      )
    // Gray Paper: rotates immediateX by registerB (32-bit)
    const immediateValue = immediateX % 2n ** 32n
    const registerBValue =
      this.getRegisterValue(context.registers, registerB) % 2n ** 32n

    // Alternative rotation implementation: rotate immediate by register value
    const rotationAmount = Number(registerBValue % 32n)
    const result = this.rotateRight32(immediateValue, rotationAmount)

    context.log('ROT_R_32_IMM_ALT: Alternative rotate right by immediate (32-bit)', {
      registerA,
      registerB,
      immediateX,
      registerBValue,
      rotationAmount,
      result,
    })
    // Gray Paper: reg'_A = sext{4}{x} - sign-extend 32-bit result to 64 bits
    this.setRegisterValueWith32BitResult(context.registers, registerA, result)

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
