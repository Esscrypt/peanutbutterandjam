import {
  OPCODE_SET_GT_S_IMM,
  OPCODE_SET_GT_U_IMM,
  OPCODE_SET_LT_S_IMM,
  OPCODE_SET_LT_U_IMM,
} from '../config'
import { InstructionContext, InstructionResult } from '../types'
import { BaseInstruction } from './base'

export class SET_LT_U_IMMInstruction extends BaseInstruction {
  opcode: i32 = OPCODE_SET_LT_U_IMM
  name: string = 'SET_LT_U_IMM'

  execute(context: InstructionContext): InstructionResult {
    // Gray Paper pvm.tex line 495: set_lt_u_imm: reg'_A = reg_B < immed_X
    // Format: Two Registers & One Immediate (lines 459-471)
    // l_X = min(4, max(0, ℓ - 1)) where ℓ = fskip
    // immed_X = sext{l_X}{decode[l_X]{instructions[ι+2:l_X]}}
    // The immediate is sign-extended according to Gray Paper, but comparison is unsigned
    const parseResult = this.parseTwoRegistersAndImmediate(
        context.operands,
        context.fskip,
      )
    const registerA = parseResult.registerA
    const registerB = parseResult.registerB
    const immediateX = parseResult.immediateX
    const registerValue = this.getRegisterValueAs64(
      context.registers,
      registerB,
    )
    // Unsigned comparison: reg'_A = reg_B < immed_X
    const result = u64(registerValue) < u64(immediateX) ? i64(1) : i64(0)

    this.setRegisterValueWith64BitResult(context.registers, registerA, result)

    return new InstructionResult(-1)
  }
}

export class SET_LT_S_IMMInstruction extends BaseInstruction {
  opcode: i32 = OPCODE_SET_LT_S_IMM
  name: string = 'SET_LT_S_IMM'

  execute(context: InstructionContext): InstructionResult {
    // Gray Paper pvm.tex line 496: set_lt_s_imm: reg'_A = signed(reg_B) < signed(immed_X)
    // Format: Two Registers & One Immediate (lines 459-471)
    // l_X = min(4, max(0, ℓ - 1)) where ℓ = fskip
    // immed_X = sext{l_X}{decode[l_X]{instructions[ι+2:l_X]}}
    const parseResult = this.parseTwoRegistersAndImmediate(
        context.operands,
        context.fskip,
      )
    const registerA = parseResult.registerA
    const registerB = parseResult.registerB
    const immediateX = parseResult.immediateX
    const registerValue = this.getRegisterValueAs64(
      context.registers,
      registerB,
    )

    // Signed comparison: reg'_A = signed(reg_B) < signed(immed_X)
    const result = this.signedCompare(registerValue, immediateX) < 0 ? i64(1) : i64(0)

    this.setRegisterValueWith64BitResult(context.registers, registerA, result)

    return new InstructionResult(-1)
  }
}

export class SET_GT_U_IMMInstruction extends BaseInstruction {
  opcode: i32 = OPCODE_SET_GT_U_IMM
  name: string = 'SET_GT_U_IMM'

  execute(context: InstructionContext): InstructionResult {
    // Gray Paper pvm.tex: set_gt_u_imm: reg'_A = reg_B > immed_X
    // Format: Two Registers & One Immediate (lines 459-471)
    // l_X = min(4, max(0, ℓ - 1)) where ℓ = fskip
    // immed_X = sext{l_X}{decode[l_X]{instructions[ι+2:l_X]}}
    // The immediate is sign-extended according to Gray Paper, but comparison is unsigned
    const parseResult = this.parseTwoRegistersAndImmediate(
        context.operands,
        context.fskip,
      )
    const registerA = parseResult.registerA
    const registerB = parseResult.registerB
    const immediateX = parseResult.immediateX
    const registerValue = this.getRegisterValueAs64(
      context.registers,
      registerB,
    )
    // Unsigned comparison: reg'_A = reg_B > immed_X
    const result = u64(registerValue) > u64(immediateX) ? i64(1) : i64(0)

    this.setRegisterValueWith64BitResult(context.registers, registerA, result)

    return new InstructionResult(-1)
  }
}

export class SET_GT_S_IMMInstruction extends BaseInstruction {
  opcode: i32 = OPCODE_SET_GT_S_IMM
  name: string = 'SET_GT_S_IMM'

  execute(context: InstructionContext): InstructionResult {
    // Gray Paper pvm.tex: set_gt_s_imm: reg'_A = signed(reg_B) > signed(immed_X)
    // Format: Two Registers & One Immediate (lines 459-471)
    // l_X = min(4, max(0, ℓ - 1)) where ℓ = fskip
    // immed_X = sext{l_X}{decode[l_X]{instructions[ι+2:l_X]}}
    const parseResult = this.parseTwoRegistersAndImmediate(
        context.operands,
        context.fskip,
      )
    const registerA = parseResult.registerA
    const registerB = parseResult.registerB
    const immediateX = parseResult.immediateX
    const registerValue = this.getRegisterValueAs64(
      context.registers,
      registerB,
    )

    // Signed comparison: reg'_A = signed(reg_B) > signed(immed_X)
    const result = this.signedCompare(registerValue, immediateX) > 0 ? i64(1) : i64(0)

    this.setRegisterValueWith64BitResult(context.registers, registerA, result)

    return new InstructionResult(-1)
  }
}
