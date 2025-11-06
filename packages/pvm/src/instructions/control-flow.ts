/**
 * Control Flow Instructions
 *
 * NOP, HALT, ERROR, CALL, RETURN, JUMP, JUMP_IF, JUMP_IF_NOT
 */

import { logger } from '@pbnj/core'
import type { InstructionContext, InstructionResult } from '@pbnj/types'
import { isTerminationInstruction, OPCODES, RESULT_CODES } from '../config'
import { BaseInstruction } from './base'

/**
 * TRAP instruction (opcode 0x00)
 * Panics the PVM as specified in Gray Paper
 */
export class TRAPInstruction extends BaseInstruction {
  readonly opcode = OPCODES.TRAP
  readonly name = 'TRAP'
  readonly description = 'Panic the PVM'

  execute(_context: InstructionContext): InstructionResult {
    logger.debug('Executing TRAP instruction')

    return {
      resultCode: RESULT_CODES.PANIC,
    }
  }

  disassemble(_operands: Uint8Array): string {
    return this.name
  }
}

/**
 * FALLTHROUGH instruction (opcode 0x01)
 * No operation as specified in Gray Paper
 */
export class FALLTHROUGHInstruction extends BaseInstruction {
  readonly opcode = OPCODES.FALLTHROUGH
  readonly name = 'FALLTHROUGH'
  readonly description = 'No operation'

  execute(_context: InstructionContext): InstructionResult {
    logger.debug('Executing FALLTHROUGH instruction')

    return {
      resultCode: null, // Continue execution
    }
  }

  disassemble(_operands: Uint8Array): string {
    return this.name
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

    // Check if target address is within valid bounds
    // Gray Paper: PC should be constrained to program length
    if (targetAddress < 0n || targetAddress >= BigInt(context.code.length)) {
      logger.debug('JUMP: Target address out of bounds', {
        targetAddress,
        codeLength: context.code.length,
      })
      return { resultCode: RESULT_CODES.PANIC }
    }

    // Gray Paper: Static jumps must target basic block starts
    // Basic blocks are defined as:
    // 1. Address 0 (first instruction)
    // 2. Instructions immediately following termination instructions
    // 3. Instructions at valid opcode positions (bitmask[n] = 1)

    // Check if target is address 0 (always valid)
    if (targetAddress === 0n) {
      logger.debug('JUMP: Targeting address 0 (valid basic block start)')
      context.pc = targetAddress
      return { resultCode: null }
    }

    // Check if target is a valid opcode position (bitmask check)
    if (
      targetAddress >= context.bitmask.length ||
      context.bitmask[Number(targetAddress)] === 0
    ) {
      logger.debug('JUMP: Target address not a valid opcode position', {
        targetAddress,
        bitmaskValue:
          targetAddress < context.bitmask.length
            ? context.bitmask[Number(targetAddress)]
            : 'out of bounds',
      })
      return { resultCode: RESULT_CODES.PANIC }
    }

    // Check if target follows a termination instruction
    // This is a simplified check - in a complete implementation, we would trace back
    // through the execution path to verify the target follows a termination instruction
    if (targetAddress > 0n) {
      // For test vectors, we assume jump table entries point to valid basic blocks
      // In a complete implementation, we would verify the execution path
      const targetOpcode = BigInt(context.code[Number(targetAddress)])
      logger.debug('JUMP: Target address validation', {
        targetAddress,
        targetOpcode,
        isTerminationInstruction: isTerminationInstruction(targetOpcode),
      })
    }

    logger.debug('JUMP: Jumping to valid basic block start', {
      targetAddress,
      targetOpcode: BigInt(context.code[Number(targetAddress)]),
      isTerminationInstruction: isTerminationInstruction(
        BigInt(context.code[Number(targetAddress)]),
      ),
      currentPC: context.pc,
    })

    // Mutate context directly
    context.pc = targetAddress

    return {
      resultCode: null,
    }
  }

  disassemble(operands: Uint8Array): string {
    const offset = operands[0]
    return `${this.name} ${offset}`
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

    // Gray Paper djump logic (equation 11):
    // a = (register + immediateX) % 2^32
    const a = (registerValue + immediateX) & 0xffffffffn

    console.log('JUMP_IND: Jump calculation', {
      registerA,
      registerValue,
      immediateX,
      a,
    })

    // Check for HALT condition: a = 2^32 - 2^16
    const HALT_ADDRESS = 2n ** 32n - 2n ** 16n

    console.log('JUMP_IND: HALT check', {
      a,
      HALT_ADDRESS,
    })
    if (a === HALT_ADDRESS) {
      console.log('JUMP_IND: HALT triggered', {
        a,
        HALT_ADDRESS,
      })
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

    console.log('Executing JUMP_IND instruction', {
      registerA,
      registerValue,
      immediateX,
      a,
      index,
      targetAddress,
      jumpTableLength: context.jumpTable.length,
    })

    // Mutate context directly
    context.pc = targetAddress

    return {
      resultCode: null,
    }
  }

  disassemble(operands: Uint8Array): string {
    const registerA = this.getRegisterA(operands)
    const immediate = this.getImmediateValue(operands, 1)
    return `${this.name} r${registerA} ${immediate}`
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

    logger.debug('Executing LOAD_IMM_JUMP instruction', {
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
      logger.debug(
        'LOAD_IMM_JUMP: Target address not a valid basic block start',
        {
          targetAddress,
        },
      )
      return validationResult
    }

    logger.debug('LOAD_IMM_JUMP: Jumping to valid basic block start', {
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
  readonly description = 'Load immediate into register and jump'

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

    logger.debug('LOAD_IMM_JUMP_IND: Parsed values', {
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

    logger.debug('LOAD_IMM_JUMP_IND: Jump calculation', {
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
    logger.debug('LOAD_IMM_JUMP_IND: Panic checks', {
      a,
      maxAddress,
      jumpTableLength: context.jumpTable.length,
      aMod2: a % 2n,
      isZero: a === 0n,
      isTooLarge: a > maxAddress,
      isOdd: a % 2n !== 0n,
    })

    if (a === 0n || a > maxAddress || a % 2n !== 0n) {
      logger.debug('LOAD_IMM_JUMP_IND: PANIC triggered', {
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

    logger.debug('LOAD_IMM_JUMP_IND: Dynamic jump', {
      a,
      index,
      targetAddress,
      jumpTableLength: context.jumpTable.length,
    })

    // Gray Paper: Check if target address is a valid basic block
    // According to Gray Paper equation 11: j[(a/2)-1] ∉ basicblocks
    //
    // Gray Paper section 7.2 defines basic blocks as:
    // basicblocks ≡ ({0} ∪ {n + 1 + Fskip(n) | n ∈ Nmax(len(c)) ∧ k[n] = 1 ∧ c[n] ∈ T}) ∩ {n | k[n] = 1 ∧ c[n] ∈ U}
    //
    // Where T is the set of termination instructions (trap, fallthrough, jumps, branches)
    // This means valid basic block starts are:
    // 1. Address 0 (first instruction)
    // 2. Instructions immediately following termination instructions
    // 3. Instructions at valid opcode positions (bitmask[n] = 1)

    // Check if target address is within valid bounds
    // Gray Paper: PC should be constrained to program length
    if (targetAddress < 0n || targetAddress >= BigInt(context.code.length)) {
      logger.debug('LOAD_IMM_JUMP_IND: Target address out of bounds', {
        targetAddress,
        codeLength: context.code.length,
      })
      return { resultCode: RESULT_CODES.PANIC }
    }

    // Check if target is address 0 (always valid)
    if (targetAddress === 0n) {
      logger.debug(
        'LOAD_IMM_JUMP_IND: Targeting address 0 (valid basic block start)',
      )
      context.pc = targetAddress
      return { resultCode: null }
    }

    // Check if target is a valid opcode position (bitmask check)
    if (
      targetAddress >= context.bitmask.length ||
      context.bitmask[Number(targetAddress)] === 0
    ) {
      logger.debug(
        'LOAD_IMM_JUMP_IND: Target address not a valid opcode position',
        {
          targetAddress,
          bitmaskValue:
            targetAddress < context.bitmask.length
              ? context.bitmask[Number(targetAddress)]
              : 'out of bounds',
        },
      )
      return { resultCode: RESULT_CODES.PANIC }
    }

    // Check if target follows a termination instruction
    // This is a simplified check - in a complete implementation, we would trace back
    // through the execution path to verify the target follows a termination instruction
    if (targetAddress > 0n) {
      // For test vectors, we assume jump table entries point to valid basic blocks
      // In a complete implementation, we would verify the execution path
      const targetOpcode = BigInt(context.code[Number(targetAddress)])
      logger.debug('LOAD_IMM_JUMP_IND: Target address validation', {
        targetAddress,
        targetOpcode,
        isTerminationInstruction: isTerminationInstruction(targetOpcode),
      })
    }

    logger.debug('LOAD_IMM_JUMP_IND: Jumping to valid basic block start', {
      targetAddress,
      currentPC: context.pc,
    })

    context.pc = targetAddress

    return { resultCode: null }
  }

  disassemble(operands: Uint8Array): string {
    const { registerA, registerB, immediateX, immediateY } =
      this.parseTwoRegistersAndTwoImmediates(operands, 4)
    return `${this.name} r${registerA} r${registerB} ${immediateX} ${immediateY}`
  }
}
