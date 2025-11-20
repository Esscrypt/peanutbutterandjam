/**
 * Control Flow Instructions
 *
 * NOP, HALT, ERROR, CALL, RETURN, JUMP, JUMP_IF, JUMP_IF_NOT
 */

import {
  HALT_ADDRESS,
  OPCODE_FALLTHROUGH,
  OPCODE_JUMP,
  OPCODE_JUMP_IND,
  OPCODE_LOAD_IMM_JUMP,
  OPCODE_LOAD_IMM_JUMP_IND,
  OPCODE_TRAP,
  RESULT_CODE_HALT,
  RESULT_CODE_PANIC,
} from '../config'
import { InstructionContext, InstructionResult } from '../types'
import { BaseInstruction } from './base'

/**
 * TRAP instruction (opcode 0x00)
 * Panics the PVM as specified in Gray Paper
 */
export class TRAPInstruction extends BaseInstruction {
  opcode: i32 = OPCODE_TRAP
  name: string = 'TRAP'

  execute(_context: InstructionContext): InstructionResult {
    return new InstructionResult(RESULT_CODE_PANIC)
  }
}

/**
 * FALLTHROUGH instruction (opcode 0x01)
 * No operation as specified in Gray Paper
 */
export class FALLTHROUGHInstruction extends BaseInstruction {
  opcode: i32 = OPCODE_FALLTHROUGH
  name: string = 'FALLTHROUGH'

  execute(_context: InstructionContext): InstructionResult {
    return new InstructionResult(-1)
  }
}

/**
 * JUMP instruction (opcode 0x40)
 * Unconditional jump with offset as specified in Gray Paper
 * 
 * Gray Paper (pvm.tex line 322):
 * Format: "One Offset" (lines 308-314)
 * immed_X ≡ ι + signfunc{l_X}(decode[l_X]{instructions[ι+1:l_X]})
 * Mutation: branch(immed_X, ⊤)
 */
export class JUMPInstruction extends BaseInstruction {
  opcode: i32 = OPCODE_JUMP
  name: string = 'JUMP'

  execute(context: InstructionContext): InstructionResult {
    // Gray Paper: Instructions with Arguments of One Offset
    // immed_X = ι + signfunc{l_X}(decode[l_X]{instructions[ι+1:l_X]})
    const targetAddress = this.parseOneOffset(
      context.operands,
      context.fskip,
      context.programCounter,
    )

    // Gray Paper: Static jumps must target basic block starts
    // Use validateBranchTarget for consistent validation with other branch instructions
    const validationResult = this.validateBranchTarget(targetAddress, context)
    if (validationResult !== null) {
      return validationResult
    }

    // Mutate context directly
    context.programCounter = targetAddress

    return new InstructionResult(-1)
  }
}

/**
 * JUMP_IND instruction (opcode 0x50)
 * Indirect jump as specified in Gray Paper
 *
 * Gray Paper (pvm.tex line 343):
 * Format: "One Register & One Immediate" (lines 326-335)
 * r_A = min(12, instructions[ι+1] mod 16)
 * l_X = min(4, max(0, ℓ - 1))
 * immed_X ≡ sext{l_X}{decode[l_X]{instructions[ι+2:l_X]}}
 * Mutation: djump((reg_A + immed_X) mod 2^32)
 *
 * Where djump(a) is defined in equations 211-216:
 * djump(a) ⟹ (ε, ι') = {
 *   (halt, ι)                                 when a = 2^32 - 2^16
 *   (panic, ι)                                when a = 0 ∨ a > len(j)·2 ∨ a mod 2 ≠ 0 ∨ j_{(a/2)-1} ∉ basicblocks
 *   (continue, j_{(a/2)-1})                   otherwise
 * }
 */
export class JUMP_INDInstruction extends BaseInstruction {
  opcode: i32 = OPCODE_JUMP_IND
  name: string = 'JUMP_IND'

  execute(context: InstructionContext): InstructionResult {
    const parseResult = this.parseOneRegisterAndImmediate(context.operands, context.fskip)
    const registerA: u8 = parseResult.registerA
    const immediateX = parseResult.immediateX
    const registerValue = this.getRegisterValueAs64(
      context.registers,
      registerA,
    )

    // Gray Paper djump logic (equation 211-216):
    // djump(a) ⟹ (ε, ι') = {
    //   (halt, ι) when a = 2^32 - 2^16
    //   (panic, ι) otherwhen a = 0 ∨ a > len(j)·2 ∨ a mod 2 ≠ 0 ∨ j_{(a/2) - 1} ∉ basicblocks
    //   (continue, j_{(a/2) - 1}) otherwise
    // }
    // a = (register + immediateX) % 2^32
    const a = u64((registerValue + immediateX) & u64(0xffffffff))

    // Check for HALT condition: a = 2^32 - 2^16
    if (a === u64(HALT_ADDRESS)) {
      return new InstructionResult(RESULT_CODE_HALT)
    }

    // Check for PANIC conditions:
    // - a = 0
    // - a > len(j) × 2
    // - a mod 2 ≠ 0
    const maxAddress = u32(context.jumpTable.length) * 2
    if (a === u64(0) || a > u64(maxAddress) || (a % u64(2)) !== u64(0)) {
      return new InstructionResult(RESULT_CODE_PANIC)
    }

    // Calculate jump table index: (a / 2) - 1
    const index = i32((a / u64(2)) - u64(1))

    // Check if index is valid
    if (index < 0 || index >= context.jumpTable.length) {
      return new InstructionResult(RESULT_CODE_PANIC)
    }

    // Get target from jump table
    const targetAddress = context.jumpTable[index]

    // Gray Paper: Validate that target is a valid basic block start
    // This is the same validation as LOAD_IMM_JUMP and other branch instructions
    // basicblocks = ({0} ∪ {n + 1 + Fskip(n) : n is termination instruction})
    //               ∩ {n : bitmask[n] = 1 and c[n] in valid opcodes}
    const validationResult = this.validateBranchTarget(targetAddress, context)
    if (validationResult !== null) {
      return validationResult
    }

    // Mutate context directly
    context.programCounter = targetAddress

    return new InstructionResult(-1)
  }
}

/**
 * LOAD_IMM_JUMP instruction (opcode 0x80)
 * Load immediate and jump as specified in Gray Paper
 * 
 * Gray Paper (pvm.tex line 404):
 * Format: "One Register, One Immediate and One Offset" (lines 385-396)
 * r_A = min(12, instructions[ι+1] mod 16)
 * l_X = min(4, ⌊instructions[ι+1]/16⌋ mod 8)
 * immed_X = sext{l_X}{decode[l_X]{instructions[ι+2:l_X]}}
 * l_Y = min(4, max(0, ℓ - l_X - 1))
 * immed_Y = ι + signfunc{l_Y}(decode[l_Y]{instructions[ι+2+l_X:l_Y]})
 * Mutation: branch(immed_Y, ⊤), reg_A' = immed_X
 */
export class LOAD_IMM_JUMPInstruction extends BaseInstruction {
  opcode: i32 = OPCODE_LOAD_IMM_JUMP
  name: string = 'LOAD_IMM_JUMP'

  execute(context: InstructionContext): InstructionResult {
    const parseResult = this.parseRegisterAndTwoImmediates(
        context.operands,
        context.fskip,
      )
    const registerA: u8 = parseResult.registerA
    const immediateX = parseResult.immediateX
    const immediateY = parseResult.immediateY

    // Interpret immediateY as a signed offset
    // If MSB is set in the original value, treat it as negative
    // This ensures context.programCounter + signedOffset effectively subtracts when needed
    const signedOffset = this.toSigned64(immediateY)
    const targetAddress = u32(i32(context.programCounter) + i32(signedOffset))

    // Gray Paper: Static jumps must target basic block starts
    // Use validateBranchTarget to check if target is in basicblocks
    // Gray Paper equation 200-204: branch(b, C) → panic if b not in basicblocks
    // basicblocks = ({0} ∪ {n + 1 + Fskip(n) : n is termination instruction})
    //               ∩ {n : bitmask[n] = 1 and c[n] in valid opcodes}
    const validationResult = this.validateBranchTarget(targetAddress, context)
    if (validationResult !== null) {
      return validationResult
    }

    // Set register A to immediateX (Gray Paper: reg_A' = immed_X)
    this.setRegisterValueWith64BitResult(
      context.registers,
      registerA,
      immediateX,
    )

    // Mutate context directly - set PC to target address
    context.programCounter = targetAddress

    return new InstructionResult(-1)
  }
}

/**
 * LOAD_IMM_JUMP_IND instruction (opcode 0x180)
 * Load immediate and indirect jump as specified in Gray Paper
 * 
 * Gray Paper (pvm.tex lines 583-586):
 * Format: "Two Registers and Two Immediates" (lines 560-575)
 * r_A = min(12, instructions[ι+1] mod 16)
 * r_B = min(12, ⌊instructions[ι+1]/16⌋)
 * l_X = min(4, instructions[ι+2] mod 8)
 * immed_X = sext{l_X}{decode[l_X]{instructions[ι+3:l_X]}}
 * l_Y = min(4, max(0, ℓ - l_X - 2))
 * immed_Y = sext{l_Y}{decode[l_Y]{instructions[ι+3+l_X:l_Y]}}
 * Mutation: djump((reg_B + immed_Y) mod 2^32), reg_A' = immed_X
 */
export class LOAD_IMM_JUMP_INDInstruction extends BaseInstruction {
  opcode: i32 = OPCODE_LOAD_IMM_JUMP_IND
  name: string = 'LOAD_IMM_JUMP_IND'

  execute(context: InstructionContext): InstructionResult {
    // Gray Paper: Instructions with Arguments of Two Registers and Two Immediates
    // r_A = min(12, (instructions[ι+1]) mod 16)
    // r_B = min(12, ⌊instructions[ι+1]/16⌋)
    // l_X = min(4, instructions[ι+2] mod 8)
    // immed_X = sext{l_X}{decode[l_X]{instructions[ι+3:l_X]}}
    // l_Y = min(4, max(0, ℓ - l_X - 2))
    // immed_Y = sext{l_Y}{decode[l_Y]{instructions[ι+3+l_X:l_Y]}}
    const parseResult = this.parseTwoRegistersAndTwoImmediates(
        context.operands,
        context.fskip,
      )
    const registerA = parseResult.registerA
    const registerB = parseResult.registerB
    const immediateX = parseResult.immediateX
    const immediateY = parseResult.immediateY

    // Gray Paper: djump((reg_B + immed_Y) mod 2^32)
    // Read register B value BEFORE potentially overwriting it
    const registerBValue = this.getRegisterValueAs64(
      context.registers,
      registerB,
    )

    // Gray Paper: reg_A' = immed_X
    this.setRegisterValueWith64BitResult(
      context.registers,
      registerA,
      immediateX,
    )

    const a = u64((registerBValue + immediateY) & u64(0xffffffff)) // mod 2^32

    // Gray Paper djump logic (equation 11):
    // Check for HALT condition: a = 2^32 - 2^16
    if (a === u64(HALT_ADDRESS)) {
      return new InstructionResult(RESULT_CODE_HALT)
    }

    // Check for PANIC conditions:
    // - a = 0
    // - a > len(j) × 2
    // - a mod 2 ≠ 0
    const maxAddress = u32(context.jumpTable.length) * 2
    if (a === u64(0) || a > u64(maxAddress) || (a % u64(2)) !== u64(0)) {
      return new InstructionResult(RESULT_CODE_PANIC)
    }

    // Calculate jump table index: (a / 2) - 1
    const index = i32((a / u64(2)) - u64(1))

    // Check if index is valid
    if (index < 0 || index >= context.jumpTable.length) {
      return new InstructionResult(RESULT_CODE_PANIC)
    }

    // Get target from jump table
    const targetAddress = context.jumpTable[index]

    // Gray Paper: Validate that target is a valid basic block start
    // This is the same validation as LOAD_IMM_JUMP, JUMP_IND, and other branch instructions
    // According to Gray Paper equation 11: j[(a/2)-1] ∉ basicblocks → panic
    // basicblocks = ({0} ∪ {n + 1 + Fskip(n) : n is termination instruction})
    //               ∩ {n : bitmask[n] = 1 and c[n] in valid opcodes}
    const validationResult = this.validateBranchTarget(targetAddress, context)
    if (validationResult !== null) {
      return validationResult
    }

    context.programCounter = targetAddress

    return new InstructionResult(-1)
  }
}
