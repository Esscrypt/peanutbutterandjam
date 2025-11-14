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
  execute(context: InstructionContext): InstructionResult {

    // Test vector format: operands[0] = (A << 4) | D, operands[1+] = immediate
    const { registerA, registerB, immediateX } =
      this.parseTwoRegistersAndImmediate(
        context.instruction.operands,
        context.fskip,
      )
    const registerValue = this.getRegisterValueAs64(
      context.registers,
      registerB,
    )

    // Gray Paper: reg'_A = sext{8}{(reg_B · 2^{immed_X mod 64}) mod 2^64}
    // Apply mod 2^64 BEFORE sext{8} (sext{8} is a no-op for 64-bit values, but we still need to mask)
    const shiftAmount = immediateX % 64n
    const multiplied = registerValue << shiftAmount
    const mod64 = multiplied & 0xffffffffffffffffn // mod 2^64
    const shift = this.signExtend(mod64, 8) // sext{8} (no-op for 64-bit values)
    
    // Log BEFORE modification to capture the before state
    const beforeValue = context.registers[registerA]
    context.log('SHLO_L_IMM_64: Logical left shift of registerB by immediate (64-bit) and storing in registerA', {
      registerA,
      registerB,
      immediateX,
      registerValue,
      shiftAmount,
      shift,
      beforeValue: beforeValue.toString(),
      registers: Array.from(context.registers.slice(0, 13)).map(r => r.toString()),
    })

    this.setRegisterValueWith64BitResult(context.registers, registerA, shift)

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
  execute(context: InstructionContext): InstructionResult {
    // Test vector format: operands[0] = (A << 4) | D, operands[1+] = immediate
    const { registerA, registerB, immediateX } =
      this.parseTwoRegistersAndImmediate(
        context.instruction.operands,
        context.fskip,
      )
    const registerValue = this.getRegisterValueAs64(
      context.registers,
      registerB,
    )

    // Ensure shift amount is within 64-bit range
    const shiftAmount = immediateX % 64n
    const result = registerValue >> shiftAmount

    const shift = this.signExtend(result, 8)

    // Log BEFORE modification to capture the before state
    const beforeValue = context.registers[registerA]
    context.log('SHLO_R_IMM_64: Logical right shift of registerB by immediate (64-bit) and storing in registerA', {
      registerA,
      registerB,
      immediateX,
      registerValue,
      shiftAmount,
      result,
      shift,
      beforeValue: beforeValue.toString(),
      registers: Array.from(context.registers.slice(0, 13)).map(r => r.toString()),
    })

    this.setRegisterValueWith64BitResult(context.registers, registerA, shift)

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
  execute(context: InstructionContext): InstructionResult {
    // Test vector format: operands[0] = (A << 4) | D, operands[1+] = immediate
    const { registerA, registerB, immediateX } =
      this.parseTwoRegistersAndImmediate(
        context.instruction.operands,
        context.fskip,
      )
    const registerBValue = this.getRegisterValueAs64(
      context.registers,
      registerB,
    )

    // Convert to signed for arithmetic shift
    const signedValue = this.toSigned64(registerBValue)
    const shiftAmount = immediateX % 64n
    const shiftedValue = signedValue >> shiftAmount
    const result = this.toUnsigned64(shiftedValue)

    // Log BEFORE modification to capture the before state
    const beforeValue = context.registers[registerA]
    context.log('SHAR_R_IMM_64: Arithmetic right shift of registerB by immediate (64-bit) and storing in registerA', {
      registerA,
      registerB,
      immediateX,
      registerBValue,
      signedValue,
      shiftAmount,
      shiftedValue,
      result,
      beforeValue: beforeValue.toString(),
      registers: Array.from(context.registers.slice(0, 13)).map(r => r.toString()),
    })

    this.setRegisterValueWith64BitResult(context.registers, registerA, result)

    return { resultCode: null }
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

  execute(context: InstructionContext): InstructionResult {
    // Test vector format: operands[0] = (A << 4) | D, operands[1] = immediate
    const { registerA, registerB, immediateX } =
      this.parseTwoRegistersAndImmediate(
        context.instruction.operands,
        context.fskip,
      )
    const registerBValue = this.getRegisterValueAs64(
      context.registers,
      registerB,
    )

    // Negate the register value and add immediate
    const result =
      (immediateX + 2n ** 64n - registerBValue) & 0xffffffffffffffffn

    // Log BEFORE modification to capture the before state
    const beforeValue = context.registers[registerA]
    context.log('NEG_ADD_IMM_64: Negate and add immediate (64-bit)', {
      registerA,
      registerB,
      immediateX,
      registerBValue,
      result,
      beforeValue: beforeValue.toString(),
      registers: Array.from(context.registers.slice(0, 13)).map(r => r.toString()),
    })

    this.setRegisterValueWith64BitResult(context.registers, registerA, result)

    return { resultCode: null }
  }
}
