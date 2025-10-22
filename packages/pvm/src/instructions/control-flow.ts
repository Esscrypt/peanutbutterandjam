/**
 * Control Flow Instructions
 *
 * NOP, HALT, ERROR, CALL, RETURN, JUMP, JUMP_IF, JUMP_IF_NOT
 */

import { logger } from '@pbnj/core'
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
  readonly description = 'Panic the PVM'

  execute(context: InstructionContext): InstructionResult {
    logger.debug('Executing TRAP instruction')

    // Gray Paper: TRAP costs 1 gas and sets ε = panic
    context.gas -= 1n

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

  execute(context: InstructionContext): InstructionResult {
    logger.debug('Executing FALLTHROUGH instruction')

    // Gray Paper: FALLTHROUGH costs 1 gas, no other mutations (just continues)
    context.gas -= 1n

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
    // For JUMP: operands[0] = offset (sign-extended immediate)
    // Gray Paper: immed_X = ι + sign_extend(offset)
    const offset = this.getImmediateValue(context.instruction.operands, 0)
    const targetAddress = context.pc + offset

    logger.debug('Executing JUMP instruction', { offset, targetAddress })

    // Mutate context directly
    context.pc = targetAddress
    context.gas -= 1n

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
 */
export class JUMP_INDInstruction extends BaseInstruction {
  readonly opcode = OPCODES.JUMP_IND
  readonly name = 'JUMP_IND'
  readonly description = 'Indirect jump using register + immediate'
  execute(context: InstructionContext): InstructionResult {
    const registerA = this.getRegisterA(context.instruction.operands)
    const immediate = this.getImmediateValue(context.instruction.operands, 1)
    const registerValue = this.getRegisterValueAs64(
      context.registers,
      registerA,
    )

    // Gray Paper djump logic (equation 11):
    // a = (register + immediate) % 2^32
    const a = (registerValue + immediate) % 2n ** 32n

    // Check for HALT condition: a = 2^32 - 2^16
    const HALT_ADDRESS = 2n ** 32n - 2n ** 16n
    if (a === HALT_ADDRESS) {
      context.gas -= 1n
      return { resultCode: RESULT_CODES.HALT }
    }

    // Check for PANIC conditions:
    // - a = 0
    // - a > len(j) × 2
    // - a mod 2 ≠ 0
    const maxAddress = BigInt(context.jumpTable.length) * 2n
    if (a === 0n || a > maxAddress || a % 2n !== 0n) {
      context.gas -= 1n
      return { resultCode: RESULT_CODES.PANIC }
    }

    // Calculate jump table index: (a / 2) - 1
    const index = Number(a / 2n - 1n)

    // Check if index is valid
    if (index < 0 || index >= context.jumpTable.length) {
      context.gas -= 1n
      return { resultCode: RESULT_CODES.PANIC }
    }

    // Get target from jump table
    const targetAddress = context.jumpTable[index]

    logger.debug('Executing JUMP_IND instruction', {
      registerA,
      registerValue,
      immediate,
      a,
      index,
      targetAddress,
      jumpTableLength: context.jumpTable.length,
    })

    // Mutate context directly
    context.pc = targetAddress
    context.gas -= 1n

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
    const { registerA, immediateX, immediateY } =
      this.parseRegisterAndTwoImmediates(
        context.instruction.operands,
        context.fskip,
      )
    const targetAddress = context.pc + immediateY

    logger.debug('Executing LOAD_IMM_JUMP instruction', {
      registerA,
      immediateX,
      immediateY,
      targetAddress,
    })
    this.setRegisterValueWith64BitResult(
      context.registers,
      registerA,
      immediateX,
    )

    // Mutate context directly
    context.pc = targetAddress
    context.gas -= 1n

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

    console.log('LOAD_IMM_JUMP_IND: Parsed values', {
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

    console.log('LOAD_IMM_JUMP_IND: Jump calculation', {
      registerBValue,
      immediateY,
      a,
      currentPC: context.pc,
    })

    // Gray Paper djump logic (equation 11):
    // Check for HALT condition: a = 2^32 - 2^16
    const HALT_ADDRESS = 2n ** 32n - 2n ** 16n
    if (a === HALT_ADDRESS) {
      context.gas -= 1n
      return { resultCode: RESULT_CODES.HALT }
    }

    // Check for PANIC conditions:
    // - a = 0
    // - a > len(j) × 2
    // - a mod 2 ≠ 0
    const maxAddress = BigInt(context.jumpTable.length) * 2n
    if (a === 0n || a > maxAddress || a % 2n !== 0n) {
      context.gas -= 1n
      return { resultCode: RESULT_CODES.PANIC }
    }

    // Calculate jump table index: (a / 2) - 1
    const index = Number(a / 2n - 1n)

    // Check if index is valid
    if (index < 0 || index >= context.jumpTable.length) {
      context.gas -= 1n
      return { resultCode: RESULT_CODES.PANIC }
    }

    // Get target from jump table
    const targetAddress = context.jumpTable[index]

    console.log('LOAD_IMM_JUMP_IND: Dynamic jump', {
      a,
      index,
      targetAddress,
      jumpTableLength: context.jumpTable.length,
    })

    context.pc = targetAddress

    context.gas -= 1n
    return { resultCode: null }
  }

  disassemble(operands: Uint8Array): string {
    const { registerA, registerB, immediateX, immediateY } =
      this.parseTwoRegistersAndTwoImmediates(operands, 4)
    return `${this.name} r${registerA} r${registerB} ${immediateX} ${immediateY}`
  }
}
