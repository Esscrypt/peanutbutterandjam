/**
 * Control Flow Instructions
 *
 * NOP, HALT, ERROR, CALL, RETURN, JUMP, JUMP_IF, JUMP_IF_NOT
 */

import type { InstructionContext, InstructionResult } from '@pbnj/types'
import { OPCODES, RESULT_CODES } from '../config'
import { BaseInstruction } from './base'

/**
 * TRAP instruction (opcode 0x00)
 * Panics the PVM as specified in Gray Paper
 */
export class TRAPInstruction extends BaseInstruction {
  readonly opcode = OPCODES.TRAP
  readonly name = 'TRAP'

  execute(_context: InstructionContext): InstructionResult {
    _context.log('TRAP: Panic the PVM')

    return {
      resultCode: RESULT_CODES.PANIC,
    }
  }
}

/**
 * FALLTHROUGH instruction (opcode 0x01)
 * No operation as specified in Gray Paper
 */
export class FALLTHROUGHInstruction extends BaseInstruction {
  readonly opcode = OPCODES.FALLTHROUGH
  readonly name = 'FALLTHROUGH'

  execute(_context: InstructionContext): InstructionResult {
    _context.log('FALLTHROUGH: No operation')

    return {
      resultCode: null, // Continue execution
    }
  }
}

/**
 * JUMP instruction (opcode 0x40)
 * Unconditional jump with offset as specified in Gray Paper
 */
export class JUMPInstruction extends BaseInstruction {
  readonly opcode = OPCODES.JUMP
  readonly name = 'JUMP'
  readonly description = 'Unconditional jump with offset'
  execute(context: InstructionContext): InstructionResult {
    // Gray Paper: Instructions with Arguments of One Offset
    // immed_X = ι + signfunc{l_X}(decode[l_X]{instructions[ι+1:l_X]})
    const targetAddress = this.parseOneOffset(
      context.instruction.operands,
      context.fskip,
      context.pc,
    )

    // Gray Paper: Static jumps must target basic block starts
    // Use validateBranchTarget for consistent validation with other branch instructions
    const validationResult = this.validateBranchTarget(targetAddress, context)
    if (validationResult !== null) {
      context.log('JUMP: Target address not a valid basic block start', {
        targetAddress,
        validationResult,
      })
      return validationResult
    }

    context.log('JUMP: Jumping to valid basic block start', {
      targetAddress,
      targetOpcode: BigInt(context.code[Number(targetAddress)]),
      currentPC: context.pc,
    })

    // Mutate context directly
    context.pc = targetAddress

    return {
      resultCode: null,
    }
  }
}

/**
 * JUMP_IND instruction (opcode 0x50)
 * Indirect jump as specified in Gray Paper
 *
 * Gray Paper formula (pvm.tex line 343):
 * djump((reg_A + immed_X) mod 2^32)
 *
 * Where djump(a) is defined in equation 11:
 * djump(a) = {
 *   halt, ι' = ι                    if a = 2^32 - 2^16
 *   panic, ι' = ι                   if a = 0 ∨ a > len(j) × 2 ∨ a mod 2 ≠ 0 ∨ j[(a/2)-1] ∉ basicblocks
 *   continue, ι' = j[(a/2)-1]       otherwise
 * }
 */
export class JUMP_INDInstruction extends BaseInstruction {
  readonly opcode = OPCODES.JUMP_IND
  readonly name = 'JUMP_IND'
  readonly description = 'Indirect jump using register + immediate'
  execute(context: InstructionContext): InstructionResult {
    const { registerA, immediateX } = this.parseOneRegisterAndImmediate(
      context.instruction.operands,
      context.fskip,
    )
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
    const a = (registerValue + immediateX) & 0xffffffffn

    context.log('JUMP_IND: Jump calculation', {
      registers: Array.from(context.registers.slice(0, 13)).map(r => r.toString()),
      registerA,
      registerValue,
      immediateX,
      a,
      HALT_ADDRESS: 2n ** 32n - 2n ** 16n,
      pc: context.pc,
    })

    // Check for HALT condition: a = 2^32 - 2^16
    const HALT_ADDRESS = 2n ** 32n - 2n ** 16n

    if (a === HALT_ADDRESS) {
      return { resultCode: RESULT_CODES.HALT }
    }

    // Check for PANIC conditions:
    // - a = 0
    // - a > len(j) × 2
    // - a mod 2 ≠ 0
    const maxAddress = BigInt(context.jumpTable.length) * 2n
    if (a === 0n || a > maxAddress || a % 2n !== 0n) {
      return { resultCode: RESULT_CODES.PANIC }
    }

    // Calculate jump table index: (a / 2) - 1
    const index = Number(a / 2n - 1n)

    // Check if index is valid
    if (index < 0 || index >= context.jumpTable.length) {
      return { resultCode: RESULT_CODES.PANIC }
    }

    // Get target from jump table
    const targetAddress = context.jumpTable[index]

    // Gray Paper: Validate that target is a valid basic block start
    // This is the same validation as LOAD_IMM_JUMP and other branch instructions
    // basicblocks = ({0} ∪ {n + 1 + Fskip(n) : n is termination instruction})
    //               ∩ {n : bitmask[n] = 1 and c[n] in valid opcodes}
    const validationResult = this.validateBranchTarget(targetAddress, context)
    if (validationResult !== null) {
      context.log('JUMP_IND: Target address not a valid basic block start', {
        targetAddress,
        index,
        jumpTableEntry: targetAddress.toString(),
      })
      return validationResult
    }

    context.log('JUMP_IND: Indirect jump using register + immediate', {
      registerA,
      registerValue,
      immediateX,
      a,
      index,
      targetAddress,
      currentPC: context.pc,
      validationResult,
    })

    // Mutate context directly
    context.pc = targetAddress

    return {
      resultCode: null,
    }
  }
}

/**
 * LOAD_IMM_JUMP instruction (opcode 0x80)
 * Load immediate and jump as specified in Gray Paper
 */
export class LOAD_IMM_JUMPInstruction extends BaseInstruction {
  readonly opcode = OPCODES.LOAD_IMM_JUMP
  readonly name = 'LOAD_IMM_JUMP'
  readonly description = 'Load immediate into register and jump'
  execute(context: InstructionContext): InstructionResult {
    const { registerA, immediateX, immediateY, lengthY } =
      this.parseRegisterAndTwoImmediates(
        context.instruction.operands,
        context.fskip,
      )

    // Interpret immediateY as a signed offset
    // If MSB is set in the original value, treat it as negative
    // This ensures context.pc + signedOffset effectively subtracts when needed
    const signedOffset = this.toSigned64(immediateY)
    const targetAddress = context.pc + signedOffset

    context.log('LOAD_IMM_JUMP: Load immediate into register and jump', {
      registerA,
      immediateX,
      immediateY,
      lengthY,
      signedOffset,
      targetAddress,
      currentPC: context.pc.toString(),
    })

    // Gray Paper: Static jumps must target basic block starts
    // Use validateBranchTarget to check if target is in basicblocks
    // Gray Paper equation 200-204: branch(b, C) → panic if b not in basicblocks
    // basicblocks = ({0} ∪ {n + 1 + Fskip(n) : n is termination instruction})
    //               ∩ {n : bitmask[n] = 1 and c[n] in valid opcodes}
    const validationResult = this.validateBranchTarget(targetAddress, context)
    if (validationResult !== null) {
      context.log(
        'LOAD_IMM_JUMP: Target address not a valid basic block start',
        {
          targetAddress,
        },
      )
      return validationResult
    }

    context.log('LOAD_IMM_JUMP: Jumping to valid basic block start', {
      targetAddress,
      currentPC: context.pc,
    })

    // Set register A to immediateX (Gray Paper: reg_A' = immed_X)
    this.setRegisterValueWith64BitResult(
      context.registers,
      registerA,
      immediateX,
    )

    // Mutate context directly - set PC to target address
    context.pc = targetAddress

    return { resultCode: null }
  }
}

/**
 * LOAD_IMM_JUMP_IND instruction (opcode 0x180)
 * Load immediate and indirect jump as specified in Gray Paper
 */
export class LOAD_IMM_JUMP_INDInstruction extends BaseInstruction {
  readonly opcode = OPCODES.LOAD_IMM_JUMP_IND
  readonly name = 'LOAD_IMM_JUMP_IND'

  execute(context: InstructionContext): InstructionResult {
    // Gray Paper: Instructions with Arguments of Two Registers and Two Immediates
    // r_A = min(12, (instructions[ι+1]) mod 16)
    // r_B = min(12, ⌊instructions[ι+1]/16⌋)
    // l_X = min(4, instructions[ι+2] mod 8)
    // immed_X = sext{l_X}{decode[l_X]{instructions[ι+3:l_X]}}
    // l_Y = min(4, max(0, ℓ - l_X - 2))
    // immed_Y = sext{l_Y}{decode[l_Y]{instructions[ι+3+l_X:l_Y]}}
    const { registerA, registerB, immediateX, immediateY } =
      this.parseTwoRegistersAndTwoImmediates(
        context.instruction.operands,
        context.fskip,
      )

    context.log('LOAD_IMM_JUMP_IND: Load immediate and indirect jump', {
      registerA,
      registerB,
      immediateX,
      immediateY,
      registerBValue: context.registers[registerB],
    })

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

    const a = (registerBValue + immediateY) & 0xffffffffn // mod 2^32

    context.log('LOAD_IMM_JUMP_IND: Indirect jump calculation', {
      registerBValue,
      immediateY,
      a,
      currentPC: context.pc,
    })

    // Gray Paper djump logic (equation 11):
    // Check for HALT condition: a = 2^32 - 2^16
    const HALT_ADDRESS = 2n ** 32n - 2n ** 16n
    if (a === HALT_ADDRESS) {
      return { resultCode: RESULT_CODES.HALT }
    }

    // Check for PANIC conditions:
    // - a = 0
    // - a > len(j) × 2
    // - a mod 2 ≠ 0
    const maxAddress = BigInt(context.jumpTable.length) * 2n
    context.log('LOAD_IMM_JUMP_IND: Indirect jump panic checks', {
      a,
      maxAddress,
      jumpTableLength: context.jumpTable.length,
      aMod2: a % 2n,
      isZero: a === 0n,
      isTooLarge: a > maxAddress,
      isOdd: a % 2n !== 0n,
    })

    if (a === 0n || a > maxAddress || a % 2n !== 0n) {
      context.log('LOAD_IMM_JUMP_IND: Indirect jump panic triggered', {
        reason: a === 0n ? 'zero' : a > maxAddress ? 'too_large' : 'odd',
      })
      return { resultCode: RESULT_CODES.PANIC }
    }

    // Calculate jump table index: (a / 2) - 1
    const index = Number(a / 2n - 1n)

    // Check if index is valid
    if (index < 0 || index >= context.jumpTable.length) {
      return { resultCode: RESULT_CODES.PANIC }
    }

    // Get target from jump table
    const targetAddress = context.jumpTable[index]

    context.log('LOAD_IMM_JUMP_IND: Indirect jump to valid basic block start', {
      a,
      index,
      targetAddress,
      jumpTableLength: context.jumpTable.length,
    })

    // Gray Paper: Validate that target is a valid basic block start
    // This is the same validation as LOAD_IMM_JUMP, JUMP_IND, and other branch instructions
    // According to Gray Paper equation 11: j[(a/2)-1] ∉ basicblocks → panic
    // basicblocks = ({0} ∪ {n + 1 + Fskip(n) : n is termination instruction})
    //               ∩ {n : bitmask[n] = 1 and c[n] in valid opcodes}
    const validationResult = this.validateBranchTarget(targetAddress, context)
    if (validationResult !== null) {
      context.log(
        'LOAD_IMM_JUMP_IND: Indirect jump target address not a valid basic block start',
        {
          targetAddress,
          index,
          jumpTableEntry: targetAddress.toString(),
        },
      )
      return validationResult
    }

    context.log('LOAD_IMM_JUMP_IND: Jumping to valid basic block start', {
      targetAddress,
      currentPC: context.pc,
    })

    context.pc = targetAddress

    return { resultCode: null }
  }
}
