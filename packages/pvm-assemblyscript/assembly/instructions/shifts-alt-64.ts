import {
  OPCODE_SHAR_R_IMM_ALT_64,
  OPCODE_SHLO_L_IMM_ALT_64,
  OPCODE_SHLO_R_IMM_ALT_64,
} from '../config'
import { InstructionContext, InstructionResult } from '../types'
import { BaseInstruction } from './base'

export class SHLO_L_IMM_ALT_64Instruction extends BaseInstruction {
  opcode: i32 = OPCODE_SHLO_L_IMM_ALT_64
  name: string = 'SHLO_L_IMM_ALT_64'

  execute(context: InstructionContext): InstructionResult {
    // Gray Paper: reg'_A = (immed_X · 2^(reg_B mod 64)) mod 2^64
    // ALT: immediate << register (not register << immediate!)
    const parseResult = this.parseTwoRegistersAndImmediate(context.operands, context.fskip)
    const registerA = parseResult.registerA
    const registerB = parseResult.registerB
    const immediateX = parseResult.immediateX

    const registerBValue = this.getRegisterValueAs64(context.registers, registerB)
    const shiftAmount = u64(registerBValue) % u64(64)

    // ALT: shift the immediate value by the register amount
    const result = u64(immediateX) << shiftAmount

    this.setRegisterValueWith64BitResult(context.registers, registerA, result)

    return new InstructionResult(-1)
  }
}

export class SHLO_R_IMM_ALT_64Instruction extends BaseInstruction {
  opcode: i32 = OPCODE_SHLO_R_IMM_ALT_64
  name: string = 'SHLO_R_IMM_ALT_64'

  execute(context: InstructionContext): InstructionResult {
    // Gray Paper: reg'_A = floor(immed_X / 2^(reg_B mod 64))
    // ALT: immediate >> register (not register >> immediate!)
    const parseResult = this.parseTwoRegistersAndImmediate(context.operands, context.fskip)
    const registerA = parseResult.registerA
    const registerB = parseResult.registerB
    const immediateX = parseResult.immediateX

    const registerBValue = this.getRegisterValueAs64(context.registers, registerB)
    const shiftAmount = u64(registerBValue) % u64(64)

    // ALT: shift the immediate value by the register amount (unsigned)
    const result = u64(immediateX) >> shiftAmount

    this.setRegisterValueWith64BitResult(context.registers, registerA, result)

    return new InstructionResult(-1)
  }
}

export class SHAR_R_IMM_ALT_64Instruction extends BaseInstruction {
  opcode: i32 = OPCODE_SHAR_R_IMM_ALT_64
  name: string = 'SHAR_R_IMM_ALT_64'

  execute(context: InstructionContext): InstructionResult {
    // Gray Paper: reg'_A = unsigned{floor(signed_64(immed_X) / 2^(reg_B mod 64))}
    // ALT: immediate >> register (not register >> immediate!) with arithmetic shift
    const parseResult = this.parseTwoRegistersAndImmediate(context.operands, context.fskip)
    const registerA = parseResult.registerA
    const registerB = parseResult.registerB
    const immediateX = parseResult.immediateX

    const registerBValue = this.getRegisterValueAs64(context.registers, registerB)
    const shiftAmount = u64(registerBValue) % u64(64)

    // ALT: arithmetic shift the immediate value by the register amount
    const signedImmediate = this.toSigned64(immediateX)
    const shiftedValue = signedImmediate >> i64(shiftAmount)
    const result = this.toUnsigned64(shiftedValue)

    this.setRegisterValueWith64BitResult(context.registers, registerA, result)

    return new InstructionResult(-1)
  }
}
