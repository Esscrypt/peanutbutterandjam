import {
  OPCODE_ROT_R_32_IMM,
  OPCODE_ROT_R_32_IMM_ALT,
  OPCODE_ROT_R_64_IMM,
  OPCODE_ROT_R_64_IMM_ALT,
} from '../config'
import { InstructionContext, InstructionResult } from '../types'
import { BaseInstruction } from './base'

export class ROT_R_64_IMMInstruction extends BaseInstruction {
  opcode: i32 = OPCODE_ROT_R_64_IMM
  name: string = 'ROT_R_64_IMM'

  execute(context: InstructionContext): InstructionResult {
    const parseResult = this.parseTwoRegistersAndImmediate(context.operands, context.fskip)
    const registerA = parseResult.registerA
    const registerB = parseResult.registerB
    const immediateX = parseResult.immediateX
    const registerValue = this.getRegisterValue(context.registers, registerB)

    // Ensure rotation amount is within 64-bit range
    const rotationAmount = u64(immediateX) % u64(64)
    const result = this.rotateRight64(registerValue, rotationAmount)

    this.setRegisterValue(context.registers, registerA, result)

    return new InstructionResult(-1)
  }

  rotateRight64(value: u64, amount: u64): u64 {
    // Handle negative rotation amounts
    let normalizedAmount = amount
    if (i64(amount) < i64(0)) {
      normalizedAmount = u64(64) + amount
    }

    // Normalize amount to 0-63 range
    normalizedAmount = normalizedAmount % u64(64)

    if (normalizedAmount === u64(0)) return value

    // Perform right rotation
    const mask = u64(0xffffffffffffffff)
    const rightPart = value >> normalizedAmount
    const leftPart = (value << (u64(64) - normalizedAmount)) & mask
    return (rightPart | leftPart) & mask
  }
}

export class ROT_R_64_IMM_ALTInstruction extends BaseInstruction {
  opcode: i32 = OPCODE_ROT_R_64_IMM_ALT
  name: string = 'ROT_R_64_IMM_ALT'

  execute(context: InstructionContext): InstructionResult {
    const parseResult = this.parseTwoRegistersAndImmediate(context.operands, context.fskip)
    const registerA = parseResult.registerA
    const registerB = parseResult.registerB
    const immediateX = parseResult.immediateX
    // Gray Paper: rotates immediateX by registerB
    const immediateValue = u64(immediateX)
    const registerBValue = this.getRegisterValue(context.registers, registerB)

    // Alternative rotation implementation: rotate immediate by register value
    const rotationAmount = i32(registerBValue % u64(64))
    const result = this.rotateRight64(immediateValue, u64(rotationAmount))

    this.setRegisterValue(context.registers, registerA, result)

    return new InstructionResult(-1)
  }

  rotateRight64(value: u64, amount: u64): u64 {
    // Handle negative rotation amounts
    let normalizedAmount = amount
    if (i64(amount) < i64(0)) {
      normalizedAmount = u64(64) + amount
    }

    // Normalize amount to 0-63 range
    normalizedAmount = normalizedAmount % u64(64)

    if (normalizedAmount === u64(0)) return value

    // Perform right rotation
    const mask = u64(0xffffffffffffffff)
    const rightPart = value >> normalizedAmount
    const leftPart = (value << (u64(64) - normalizedAmount)) & mask
    return (rightPart | leftPart) & mask
  }
}

export class ROT_R_32_IMMInstruction extends BaseInstruction {
  opcode: i32 = OPCODE_ROT_R_32_IMM
  name: string = 'ROT_R_32_IMM'

  execute(context: InstructionContext): InstructionResult {
    const parseResult = this.parseTwoRegistersAndImmediate(context.operands, context.fskip)
    const registerA = parseResult.registerA
    const registerB = parseResult.registerB
    const immediateX = parseResult.immediateX
    const registerValue =
      this.getRegisterValue(context.registers, registerB) & u64(0xffffffff)

    // Ensure rotation amount is within 32-bit range
    const rotationAmount = i32(u64(immediateX) % u64(32))
    const result = this.rotateRight32(registerValue, rotationAmount)

    // Gray Paper: reg'_A = sext{4}{x} - sign-extend 32-bit result to 64 bits
    this.setRegisterValueWith32BitResult(context.registers, registerA, result)

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

export class ROT_R_32_IMM_ALTInstruction extends BaseInstruction {
  opcode: i32 = OPCODE_ROT_R_32_IMM_ALT
  name: string = 'ROT_R_32_IMM_ALT'

  execute(context: InstructionContext): InstructionResult {
    const parseResult = this.parseTwoRegistersAndImmediate(context.operands, context.fskip)
    const registerA = parseResult.registerA
    const registerB = parseResult.registerB
    const immediateX = parseResult.immediateX
    // Gray Paper: rotates immediateX by registerB (32-bit)
    const immediateValue = u64(immediateX) & u64(0xffffffff)
    const registerBValue =
      this.getRegisterValue(context.registers, registerB) & u64(0xffffffff)

    // Alternative rotation implementation: rotate immediate by register value
    const rotationAmount = i32(registerBValue % u64(32))
    const result = this.rotateRight32(immediateValue, rotationAmount)

    // Gray Paper: reg'_A = sext{4}{x} - sign-extend 32-bit result to 64 bits
    this.setRegisterValueWith32BitResult(context.registers, registerA, result)

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
