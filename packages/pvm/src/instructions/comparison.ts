import type { InstructionContext, InstructionResult } from '@pbnj/types'
import { OPCODES } from '../config'
import { BaseInstruction } from './base'

export class SET_LT_U_IMMInstruction extends BaseInstruction {
  readonly opcode = OPCODES.SET_LT_U_IMM
  readonly name = 'SET_LT_U_IMM'
  readonly description = 'Set if less than immediate (unsigned)'

  execute(context: InstructionContext): InstructionResult {
    // Gray Paper pvm.tex line 495: set_lt_u_imm: reg'_A = reg_B < immed_X
    // Format: Two Registers & One Immediate (lines 459-471)
    // l_X = min(4, max(0, ℓ - 1)) where ℓ = fskip
    // immed_X = sext{l_X}{decode[l_X]{instructions[ι+2:l_X]}}
    // The immediate is sign-extended according to Gray Paper, but comparison is unsigned
    const { registerA, registerB, immediateX } =
      this.parseTwoRegistersAndImmediate(
        context.instruction.operands,
        context.fskip,
      )
    const registerValue = this.getRegisterValueAs64(
      context.registers,
      registerB,
    )
    // Unsigned comparison: reg'_A = reg_B < immed_X
    const result = registerValue < immediateX ? 1n : 0n

    context.log('Executing SET_LT_U_IMM instruction', {
      registerD: registerA,
      registerA: registerB,
      immediate: immediateX.toString(),
      registerValue: registerValue.toString(),
      result: result.toString(),
    })
    this.setRegisterValueWith64BitResult(context.registers, registerA, result)

    return { resultCode: null }
  }
}

export class SET_LT_S_IMMInstruction extends BaseInstruction {
  readonly opcode = OPCODES.SET_LT_S_IMM
  readonly name = 'SET_LT_S_IMM'
  readonly description = 'Set if less than immediate (signed)'

  execute(context: InstructionContext): InstructionResult {
    // Gray Paper pvm.tex line 496: set_lt_s_imm: reg'_A = signed(reg_B) < signed(immed_X)
    // Format: Two Registers & One Immediate (lines 459-471)
    // l_X = min(4, max(0, ℓ - 1)) where ℓ = fskip
    // immed_X = sext{l_X}{decode[l_X]{instructions[ι+2:l_X]}}
    const { registerA, registerB, immediateX } =
      this.parseTwoRegistersAndImmediate(
        context.instruction.operands,
        context.fskip,
      )
    const registerValue = this.getRegisterValueAs64(
      context.registers,
      registerB,
    )

    // Signed comparison: reg'_A = signed(reg_B) < signed(immed_X)
    const result = this.signedCompare(registerValue, immediateX) < 0 ? 1n : 0n

    context.log('Executing SET_LT_S_IMM instruction', {
      registerD: registerA,
      registerA: registerB,
      immediate: immediateX.toString(),
      registerValue: registerValue.toString(),
      result: result.toString(),
    })
    this.setRegisterValueWith64BitResult(context.registers, registerA, result)

    return { resultCode: null }
  }
}

export class SET_GT_U_IMMInstruction extends BaseInstruction {
  readonly opcode = OPCODES.SET_GT_U_IMM
  readonly name = 'SET_GT_U_IMM'
  readonly description = 'Set if greater than immediate (unsigned)'

  execute(context: InstructionContext): InstructionResult {
    // Gray Paper pvm.tex: set_gt_u_imm: reg'_A = reg_B > immed_X
    // Format: Two Registers & One Immediate (lines 459-471)
    // l_X = min(4, max(0, ℓ - 1)) where ℓ = fskip
    // immed_X = sext{l_X}{decode[l_X]{instructions[ι+2:l_X]}}
    // The immediate is sign-extended according to Gray Paper, but comparison is unsigned
    const { registerA, registerB, immediateX } =
      this.parseTwoRegistersAndImmediate(
        context.instruction.operands,
        context.fskip,
      )
    const registerValue = this.getRegisterValueAs64(
      context.registers,
      registerB,
    )
    // Unsigned comparison: reg'_A = reg_B > immed_X
    const result = registerValue > immediateX ? 1n : 0n

    context.log('Executing SET_GT_U_IMM instruction', {
      registerD: registerA,
      registerA: registerB,
      immediate: immediateX.toString(),
      registerValue: registerValue.toString(),
      result: result.toString(),
    })
    this.setRegisterValueWith64BitResult(context.registers, registerA, result)

    return { resultCode: null }
  }
}

export class SET_GT_S_IMMInstruction extends BaseInstruction {
  readonly opcode = OPCODES.SET_GT_S_IMM
  readonly name = 'SET_GT_S_IMM'
  readonly description = 'Set if greater than immediate (signed)'

  execute(context: InstructionContext): InstructionResult {
    // Gray Paper pvm.tex: set_gt_s_imm: reg'_A = signed(reg_B) > signed(immed_X)
    // Format: Two Registers & One Immediate (lines 459-471)
    // l_X = min(4, max(0, ℓ - 1)) where ℓ = fskip
    // immed_X = sext{l_X}{decode[l_X]{instructions[ι+2:l_X]}}
    const { registerA, registerB, immediateX } =
      this.parseTwoRegistersAndImmediate(
        context.instruction.operands,
        context.fskip,
      )
    const registerValue = this.getRegisterValueAs64(
      context.registers,
      registerB,
    )

    // Signed comparison: reg'_A = signed(reg_B) > signed(immed_X)
    const result = this.signedCompare(registerValue, immediateX) > 0 ? 1n : 0n

    context.log('Executing SET_GT_S_IMM instruction', {
      registerD: registerA,
      registerA: registerB,
      immediate: immediateX.toString(),
      registerValue: registerValue.toString(),
      result: result.toString(),
    })
    this.setRegisterValueWith64BitResult(context.registers, registerA, result)

    return { resultCode: null }
  }
}
