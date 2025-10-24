import { logger } from '@pbnj/core'
import type { InstructionContext, InstructionResult } from '@pbnj/types'
import { OPCODES } from '../config'
import { BaseInstruction } from './base'

export class SET_LT_U_IMMInstruction extends BaseInstruction {
  readonly opcode = OPCODES.SET_LT_U_IMM
  readonly name = 'SET_LT_U_IMM'
  readonly description = 'Set if less than immediate (unsigned)'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterA(context.instruction.operands) // Destination is low nibble of operands[0]
    const registerA = this.getRegisterB(context.instruction.operands) // Source is high nibble of operands[0]
    const immediate = this.getImmediateValueUnsigned(
      context.instruction.operands,
      1,
    )
    const registerValue = this.getRegisterValueAs64(
      context.registers,
      registerA,
    )
    const result = registerValue < immediate ? 1n : 0n

    logger.debug('Executing SET_LT_U_IMM instruction', {
      registerD,
      registerA,
      immediate,
      registerValue,
      result,
    })
    this.setRegisterValueWith64BitResult(context.registers, registerD, result)

    // Mutate context directly
    

    return { resultCode: null }
  }

  disassemble(operands: Uint8Array): string {
    const registerD = this.getRegisterD(operands)
    const registerA = this.getRegisterA(operands)
    const immediate = this.getImmediateValueUnsigned(operands, 1)
    return `${this.name} r${registerD} r${registerA} ${immediate}`
  }
}

export class SET_LT_S_IMMInstruction extends BaseInstruction {
  readonly opcode = OPCODES.SET_LT_S_IMM
  readonly name = 'SET_LT_S_IMM'
  readonly description = 'Set if less than immediate (signed)'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterA(context.instruction.operands) // Destination is low nibble of operands[0]
    const registerA = this.getRegisterB(context.instruction.operands) // Source is high nibble of operands[0]
    const immediate = this.getImmediateValue(context.instruction.operands, 1)
    const registerValue = this.getRegisterValueAs64(
      context.registers,
      registerA,
    )

    // Use signedCompare helper for proper signed comparison
    const result = this.signedCompare(registerValue, immediate) < 0 ? 1n : 0n

    logger.debug('Executing SET_LT_S_IMM instruction', {
      registerD,
      registerA,
      immediate,
      registerValue,
      result,
    })
    this.setRegisterValueWith64BitResult(context.registers, registerD, result)

    // Mutate context directly
    

    return { resultCode: null }
  }

  disassemble(operands: Uint8Array): string {
    const registerD = this.getRegisterD(operands)
    const registerA = this.getRegisterA(operands)
    const immediate = this.getImmediateValue(operands, 1)
    return `${this.name} r${registerD} r${registerA} ${immediate}`
  }
}

export class SET_GT_U_IMMInstruction extends BaseInstruction {
  readonly opcode = OPCODES.SET_GT_U_IMM
  readonly name = 'SET_GT_U_IMM'
  readonly description = 'Set if greater than immediate (unsigned)'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterA(context.instruction.operands) // Destination is low nibble of operands[0]
    const registerA = this.getRegisterB(context.instruction.operands) // Source is high nibble of operands[0]
    const immediate = this.getImmediateValueUnsigned(
      context.instruction.operands,
      1,
    )
    const registerValue = this.getRegisterValueAs64(
      context.registers,
      registerA,
    )
    const result = registerValue > immediate ? 1n : 0n

    logger.debug('Executing SET_GT_U_IMM instruction', {
      registerD,
      registerA,
      immediate,
      registerValue,
      result,
    })
    this.setRegisterValueWith64BitResult(context.registers, registerD, result)

    // Mutate context directly
    

    return { resultCode: null }
  }

  disassemble(operands: Uint8Array): string {
    const registerD = this.getRegisterD(operands)
    const registerA = this.getRegisterA(operands)
    const immediate = this.getImmediateValueUnsigned(operands, 1)
    return `${this.name} r${registerD} r${registerA} ${immediate}`
  }
}

export class SET_GT_S_IMMInstruction extends BaseInstruction {
  readonly opcode = OPCODES.SET_GT_S_IMM
  readonly name = 'SET_GT_S_IMM'
  readonly description = 'Set if greater than immediate (signed)'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterA(context.instruction.operands) // Destination is low nibble of operands[0]
    const registerA = this.getRegisterB(context.instruction.operands) // Source is high nibble of operands[0]
    const immediate = this.getImmediateValue(context.instruction.operands, 1)
    const registerValue = this.getRegisterValueAs64(
      context.registers,
      registerA,
    )

    // Use signedCompare helper for proper signed comparison
    const result = this.signedCompare(registerValue, immediate) > 0 ? 1n : 0n

    logger.debug('Executing SET_GT_S_IMM instruction', {
      registerD,
      registerA,
      immediate,
      registerValue,
      result,
    })
    this.setRegisterValueWith64BitResult(context.registers, registerD, result)

    // Mutate context directly
    

    return { resultCode: null }
  }

  disassemble(operands: Uint8Array): string {
    const registerD = this.getRegisterD(operands)
    const registerA = this.getRegisterA(operands)
    const immediate = this.getImmediateValue(operands, 1)
    return `${this.name} r${registerD} r${registerA} ${immediate}`
  }
}
