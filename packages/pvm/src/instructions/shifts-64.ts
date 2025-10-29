
import type { InstructionContext, InstructionResult } from '@pbnj/types'
import { OPCODES } from '../config'
import { BaseInstruction } from './base'

/**
 * SHLO_L_IMM_64 instruction (opcode 0x151)
 * Logical left shift by immediate (64-bit) as specified in Gray Paper
 * Gray Paper formula: reg'_A = sext{8}{(reg_B · 2^{immed_X mod 64}) mod 2^64}
 */
export class SHLO_L_IMM_64Instruction extends BaseInstruction {
  readonly opcode = OPCODES.SHLO_L_IMM_64
  readonly name = 'SHLO_L_IMM_64'
  readonly description = 'Logical left shift by immediate (64-bit)'
  execute(context: InstructionContext): InstructionResult {
    console.log('SHLO_L_IMM_64: Starting execution', {
      operands: Array.from(context.instruction.operands),
      fskip: context.fskip,
    })

    // Test vector format: operands[0] = (A << 4) | D, operands[1+] = immediate
    const { registerA, registerB, immediateX } = this.parseTwoRegistersAndImmediate(context.instruction.operands, context.fskip)
    const registerValue = this.getRegisterValueAs64(context.registers, registerB)

    const shiftAmount = immediateX % 64n
    const result = registerValue << shiftAmount

    const shift = this.signExtend(result, 8)
    this.setRegisterValueWith64BitResult(context.registers, registerA, shift)

    console.log('SHLO_L_IMM_64: After setting register', {
      registerA,
      registerB,
      immediateX,
      registerValue,
      shiftAmount,
      shift,
      registers: context.registers,
    })

    return { resultCode: null }
  }
}

/**
 * SHLO_R_IMM_64 instruction (opcode 0x152)
 * Logical right shift by immediate (64-bit) as specified in Gray Paper
 * Gray Paper formula: reg'_A = sext{8}{floor{reg_B ÷ 2^{immed_X mod 64}}}
 */
export class SHLO_R_IMM_64Instruction extends BaseInstruction {
  readonly opcode = OPCODES.SHLO_R_IMM_64
  readonly name = 'SHLO_R_IMM_64'
  readonly description = 'Logical right shift by immediate (64-bit)'
  execute(context: InstructionContext): InstructionResult {
    // Test vector format: operands[0] = (A << 4) | D, operands[1+] = immediate
      const { registerA, registerB, immediateX } = this.parseTwoRegistersAndImmediate(context.instruction.operands, context.fskip)
    const registerValue = this.getRegisterValueAs64(context.registers, registerB)

    // Ensure shift amount is within 64-bit range
    const shiftAmount = immediateX % 64n
    const result = registerValue >> shiftAmount

    const shift = this.signExtend(result, 8)

    this.setRegisterValueWith64BitResult(context.registers, registerA, shift)

    console.log('Executing SHLO_R_IMM_64 instruction', {
      registerA,
      registerB,
      immediateX,
      registerValue,
      shiftAmount,
      result,
      shift,
      registers: context.registers,
    })

    return { resultCode: null }
  }

}

/**
 * SHAR_R_IMM_64 instruction (opcode 0x153)
 * Arithmetic right shift by immediate (64-bit) as specified in Gray Paper
 * Gray Paper formula: reg'_A = unsigned{floor{signed{reg_B} ÷ 2^{immed_X mod 64}}}
 */
export class SHAR_R_IMM_64Instruction extends BaseInstruction {
  readonly opcode = OPCODES.SHAR_R_IMM_64
  readonly name = 'SHAR_R_IMM_64'
  readonly description = 'Arithmetic right shift by immediate (64-bit)'
  execute(context: InstructionContext): InstructionResult {
    // Test vector format: operands[0] = (A << 4) | D, operands[1+] = immediate
    const { registerA, registerB, immediateX } = this.parseTwoRegistersAndImmediate(context.instruction.operands, context.fskip)
    const registerBValue = this.getRegisterValueAs64(context.registers, registerB)

    // Convert to signed for arithmetic shift
    const signedValue = this.toSigned64(registerBValue)
    const shiftAmount = immediateX % 64n
    const shiftedValue = signedValue >> shiftAmount
    const result = this.toUnsigned64(shiftedValue)

    this.setRegisterValueWith64BitResult(context.registers, registerA, result)
    
    console.log('Executing SHAR_R_IMM_64 instruction', {
      registerA,
      registerB,
      immediateX,
      registerBValue,
      signedValue,
      shiftAmount,
      shiftedValue,
      result,
      registers: context.registers,
    })

    return { resultCode: null }
  }


  private toSigned64(value: bigint): bigint {
    // Convert 64-bit unsigned to signed
    if (value >= 2n ** 63n) {
      return value - 2n ** 64n
    }
    return value
  }

  private toUnsigned64(value: bigint): bigint {
    // Convert signed back to unsigned
    if (value < 0n) {
      return value + 2n ** 64n
    }
    return value
  }
}

/**
 * NEG_ADD_IMM_64 instruction (opcode 0x154)
 * Negate and add immediate (64-bit) as specified in Gray Paper
 * Gray Paper formula: reg'_A = (immed_X + 2^64 - reg_B) mod 2^64
 */
export class NEG_ADD_IMM_64Instruction extends BaseInstruction {
  readonly opcode = OPCODES.NEG_ADD_IMM_64
  readonly name = 'NEG_ADD_IMM_64'
  readonly description = 'Negate and add immediate (64-bit)'

  execute(context: InstructionContext): InstructionResult {
    // Test vector format: operands[0] = (A << 4) | D, operands[1] = immediate
    const { registerA, registerB, immediateX } = this.parseTwoRegistersAndImmediate(context.instruction.operands, context.fskip)
    const registerBValue = this.getRegisterValueAs64(context.registers, registerB)

    // Negate the register value and add immediate
    const result = (immediateX + 2n ** 64n - registerBValue) & 0xffffffffffffffffn

    this.setRegisterValueWith64BitResult(context.registers, registerA, result)

    console.log('Executing NEG_ADD_IMM_64 instruction', {
      registerA,
      registerB,
      immediateX,
      registerBValue,
      result,
      registers: context.registers,
    })

    return { resultCode: null }
  }

}
