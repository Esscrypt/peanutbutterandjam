/**
 * Branching Instructions
 *
 * BRANCH_*_IMM variants - Branch if condition with immediate
 */

import { logger } from '@pbnj/core'
import type { InstructionContext, InstructionResult } from '@pbnj/types'
import { OPCODES, RESULT_CODES } from '../config'
import { BaseInstruction } from './base'

/**
 * BRANCH_EQ_IMM instruction (opcode 0x81)
 * Branch if register equals immediate as specified in Gray Paper
 */
export class BRANCH_EQ_IMMInstruction extends BaseInstruction {
  readonly opcode = OPCODES.BRANCH_EQ_IMM
  readonly name = 'BRANCH_EQ_IMM'
  readonly description = 'Branch if register equals immediate'

  execute(context: InstructionContext): InstructionResult {
    const registerA = this.getRegisterA(context.instruction.operands)
    const immediateX = this.getImmediateValue(context.instruction.operands, 1)
    const offset = this.getImmediateValue(context.instruction.operands, 2, 2)
    const registerValue = this.getRegisterValue(context.registers, registerA)
    const shouldBranch = registerValue === immediateX
    const targetAddress = shouldBranch
      ? context.instructionPointer + Number(offset)
      : context.instructionPointer + 1

    logger.debug('Executing BRANCH_EQ_IMM instruction', {
      registerA,
      immediateX,
      offset,
      shouldBranch,
      targetAddress,
    })

    return {
      resultCode: RESULT_CODES.HALT,
      newInstructionPointer: targetAddress,
      newGasCounter: context.gasCounter - 1n,
    }
  }

  validate(operands: Uint8Array): boolean {
    return operands.length >= 4 // Need register, immediate, and offset
  }

  disassemble(operands: Uint8Array): string {
    const registerA = this.getRegisterA(operands)
    const immediateX = this.getImmediateValue(operands, 1)
    const offset = this.getImmediateValue(operands, 2, 2)
    return `${this.name} r${registerA} ${immediateX} ${offset}`
  }
}

/**
 * BRANCH_NE_IMM instruction (opcode 0x82)
 * Branch if register not equals immediate as specified in Gray Paper
 */
export class BRANCH_NE_IMMInstruction extends BaseInstruction {
  readonly opcode = OPCODES.BRANCH_NE_IMM
  readonly name = 'BRANCH_NE_IMM'
  readonly description = 'Branch if register not equals immediate'

  execute(context: InstructionContext): InstructionResult {
    const registerA = this.getRegisterA(context.instruction.operands)
    const immediateX = this.getImmediateValue(context.instruction.operands, 1)
    const offset = this.getImmediateValue(context.instruction.operands, 2, 2)
    const registerValue = this.getRegisterValue(context.registers, registerA)
    const shouldBranch = registerValue !== immediateX
    const targetAddress = shouldBranch
      ? context.instructionPointer + Number(offset)
      : context.instructionPointer + 1

    logger.debug('Executing BRANCH_NE_IMM instruction', {
      registerA,
      immediateX,
      offset,
      shouldBranch,
      targetAddress,
    })

    return {
      resultCode: RESULT_CODES.HALT,
      newInstructionPointer: targetAddress,
      newGasCounter: context.gasCounter - 1n,
    }
  }

  validate(operands: Uint8Array): boolean {
    return operands.length >= 4 // Need register, immediate, and offset
  }

  disassemble(operands: Uint8Array): string {
    const registerA = this.getRegisterA(operands)
    const immediateX = this.getImmediateValue(operands, 1)
    const offset = this.getImmediateValue(operands, 2, 2)
    return `${this.name} r${registerA} ${immediateX} ${offset}`
  }
}

/**
 * BRANCH_LT_U_IMM instruction (opcode 0x83)
 * Branch if register less than immediate (unsigned) as specified in Gray Paper
 */
export class BRANCH_LT_U_IMMInstruction extends BaseInstruction {
  readonly opcode = OPCODES.BRANCH_LT_U_IMM
  readonly name = 'BRANCH_LT_U_IMM'
  readonly description = 'Branch if register less than immediate (unsigned)'

  execute(context: InstructionContext): InstructionResult {
    const registerA = this.getRegisterA(context.instruction.operands)
    const immediateX = this.getImmediateValue(context.instruction.operands, 1)
    const offset = this.getImmediateValue(context.instruction.operands, 2, 2)
    const registerValue = this.getRegisterValue(context.registers, registerA)
    const shouldBranch = registerValue < immediateX
    const targetAddress = shouldBranch
      ? context.instructionPointer + Number(offset)
      : context.instructionPointer + 1

    logger.debug('Executing BRANCH_LT_U_IMM instruction', {
      registerA,
      immediateX,
      offset,
      shouldBranch,
      targetAddress,
    })

    return {
      resultCode: RESULT_CODES.HALT,
      newInstructionPointer: targetAddress,
      newGasCounter: context.gasCounter - 1n,
    }
  }

  validate(operands: Uint8Array): boolean {
    return operands.length >= 4 // Need register, immediate, and offset
  }

  disassemble(operands: Uint8Array): string {
    const registerA = this.getRegisterA(operands)
    const immediateX = this.getImmediateValue(operands, 1)
    const offset = this.getImmediateValue(operands, 2, 2)
    return `${this.name} r${registerA} ${immediateX} ${offset}`
  }
}

/**
 * BRANCH_LE_U_IMM instruction (opcode 0x84)
 * Branch if register less or equal immediate (unsigned) as specified in Gray Paper
 */
export class BRANCH_LE_U_IMMInstruction extends BaseInstruction {
  readonly opcode = OPCODES.BRANCH_LE_U_IMM
  readonly name = 'BRANCH_LE_U_IMM'
  readonly description = 'Branch if register less or equal immediate (unsigned)'

  execute(context: InstructionContext): InstructionResult {
    const registerA = this.getRegisterA(context.instruction.operands)
    const immediateX = this.getImmediateValue(context.instruction.operands, 1)
    const offset = this.getImmediateValue(context.instruction.operands, 2, 2)
    const registerValue = this.getRegisterValue(context.registers, registerA)
    const shouldBranch = registerValue <= immediateX
    const targetAddress = shouldBranch
      ? context.instructionPointer + Number(offset)
      : context.instructionPointer + 1

    logger.debug('Executing BRANCH_LE_U_IMM instruction', {
      registerA,
      immediateX,
      offset,
      shouldBranch,
      targetAddress,
    })

    return {
      resultCode: RESULT_CODES.HALT,
      newInstructionPointer: targetAddress,
      newGasCounter: context.gasCounter - 1n,
    }
  }

  validate(operands: Uint8Array): boolean {
    return operands.length >= 4 // Need register, immediate, and offset
  }

  disassemble(operands: Uint8Array): string {
    const registerA = this.getRegisterA(operands)
    const immediateX = this.getImmediateValue(operands, 1)
    const offset = this.getImmediateValue(operands, 2, 2)
    return `${this.name} r${registerA} ${immediateX} ${offset}`
  }
}

/**
 * BRANCH_GE_U_IMM instruction (opcode 0x85)
 * Branch if register greater or equal immediate (unsigned) as specified in Gray Paper
 */
export class BRANCH_GE_U_IMMInstruction extends BaseInstruction {
  readonly opcode = OPCODES.BRANCH_GE_U_IMM
  readonly name = 'BRANCH_GE_U_IMM'
  readonly description =
    'Branch if register greater or equal immediate (unsigned)'

  execute(context: InstructionContext): InstructionResult {
    const registerA = this.getRegisterA(context.instruction.operands)
    const immediateX = this.getImmediateValue(context.instruction.operands, 1)
    const offset = this.getImmediateValue(context.instruction.operands, 2, 2)
    const registerValue = this.getRegisterValue(context.registers, registerA)
    const shouldBranch = registerValue >= immediateX
    const targetAddress = shouldBranch
      ? context.instructionPointer + Number(offset)
      : context.instructionPointer + 1

    logger.debug('Executing BRANCH_GE_U_IMM instruction', {
      registerA,
      immediateX,
      offset,
      shouldBranch,
      targetAddress,
    })

    return {
      resultCode: RESULT_CODES.HALT,
      newInstructionPointer: targetAddress,
      newGasCounter: context.gasCounter - 1n,
    }
  }

  validate(operands: Uint8Array): boolean {
    return operands.length >= 4 // Need register, immediate, and offset
  }

  disassemble(operands: Uint8Array): string {
    const registerA = this.getRegisterA(operands)
    const immediateX = this.getImmediateValue(operands, 1)
    const offset = this.getImmediateValue(operands, 2, 2)
    return `${this.name} r${registerA} ${immediateX} ${offset}`
  }
}

/**
 * BRANCH_GT_U_IMM instruction (opcode 0x86)
 * Branch if register greater than immediate (unsigned) as specified in Gray Paper
 */
export class BRANCH_GT_U_IMMInstruction extends BaseInstruction {
  readonly opcode = OPCODES.BRANCH_GT_U_IMM
  readonly name = 'BRANCH_GT_U_IMM'
  readonly description = 'Branch if register greater than immediate (unsigned)'

  execute(context: InstructionContext): InstructionResult {
    const registerA = this.getRegisterA(context.instruction.operands)
    const immediateX = this.getImmediateValue(context.instruction.operands, 1)
    const offset = this.getImmediateValue(context.instruction.operands, 2, 2)
    const registerValue = this.getRegisterValue(context.registers, registerA)
    const shouldBranch = registerValue > immediateX
    const targetAddress = shouldBranch
      ? context.instructionPointer + Number(offset)
      : context.instructionPointer + 1

    logger.debug('Executing BRANCH_GT_U_IMM instruction', {
      registerA,
      immediateX,
      offset,
      shouldBranch,
      targetAddress,
    })

    return {
      resultCode: RESULT_CODES.HALT,
      newInstructionPointer: targetAddress,
      newGasCounter: context.gasCounter - 1n,
    }
  }

  validate(operands: Uint8Array): boolean {
    return operands.length >= 4 // Need register, immediate, and offset
  }

  disassemble(operands: Uint8Array): string {
    const registerA = this.getRegisterA(operands)
    const immediateX = this.getImmediateValue(operands, 1)
    const offset = this.getImmediateValue(operands, 2, 2)
    return `${this.name} r${registerA} ${immediateX} ${offset}`
  }
}

/**
 * BRANCH_LT_S_IMM instruction (opcode 0x87)
 * Branch if register less than immediate (signed) as specified in Gray Paper
 */
export class BRANCH_LT_S_IMMInstruction extends BaseInstruction {
  readonly opcode = OPCODES.BRANCH_LT_S_IMM
  readonly name = 'BRANCH_LT_S_IMM'
  readonly description = 'Branch if register less than immediate (signed)'

  execute(context: InstructionContext): InstructionResult {
    const registerA = this.getRegisterA(context.instruction.operands)
    const immediateX = this.getImmediateValue(context.instruction.operands, 1)
    const offset = this.getImmediateValue(context.instruction.operands, 2, 2)
    const registerValue = this.getRegisterValue(context.registers, registerA)
    // Convert to signed comparison
    const signedRegister =
      registerValue > 2n ** 63n - 1n ? registerValue - 2n ** 64n : registerValue
    const signedImmediate =
      immediateX > 2n ** 63n - 1n ? immediateX - 2n ** 64n : immediateX
    const shouldBranch = signedRegister < signedImmediate
    const targetAddress = shouldBranch
      ? context.instructionPointer + Number(offset)
      : context.instructionPointer + 1

    logger.debug('Executing BRANCH_LT_S_IMM instruction', {
      registerA,
      immediateX,
      offset,
      shouldBranch,
      targetAddress,
    })

    return {
      resultCode: RESULT_CODES.HALT,
      newInstructionPointer: targetAddress,
      newGasCounter: context.gasCounter - 1n,
    }
  }

  validate(operands: Uint8Array): boolean {
    return operands.length >= 4 // Need register, immediate, and offset
  }

  disassemble(operands: Uint8Array): string {
    const registerA = this.getRegisterA(operands)
    const immediateX = this.getImmediateValue(operands, 1)
    const offset = this.getImmediateValue(operands, 2, 2)
    return `${this.name} r${registerA} ${immediateX} ${offset}`
  }
}

/**
 * BRANCH_LE_S_IMM instruction (opcode 0x88)
 * Branch if register less or equal immediate (signed) as specified in Gray Paper
 */
export class BRANCH_LE_S_IMMInstruction extends BaseInstruction {
  readonly opcode = OPCODES.BRANCH_LE_S_IMM
  readonly name = 'BRANCH_LE_S_IMM'
  readonly description = 'Branch if register less or equal immediate (signed)'

  execute(context: InstructionContext): InstructionResult {
    const registerA = this.getRegisterA(context.instruction.operands)
    const immediateX = this.getImmediateValue(context.instruction.operands, 1)
    const offset = this.getImmediateValue(context.instruction.operands, 2, 2)
    const registerValue = this.getRegisterValue(context.registers, registerA)
    // Convert to signed comparison
    const signedRegister =
      registerValue > 2n ** 63n - 1n ? registerValue - 2n ** 64n : registerValue
    const signedImmediate =
      immediateX > 2n ** 63n - 1n ? immediateX - 2n ** 64n : immediateX
    const shouldBranch = signedRegister <= signedImmediate
    const targetAddress = shouldBranch
      ? context.instructionPointer + Number(offset)
      : context.instructionPointer + 1

    logger.debug('Executing BRANCH_LE_S_IMM instruction', {
      registerA,
      immediateX,
      offset,
      shouldBranch,
      targetAddress,
    })

    return {
      resultCode: RESULT_CODES.HALT,
      newInstructionPointer: targetAddress,
      newGasCounter: context.gasCounter - 1n,
    }
  }

  validate(operands: Uint8Array): boolean {
    return operands.length >= 4 // Need register, immediate, and offset
  }

  disassemble(operands: Uint8Array): string {
    const registerA = this.getRegisterA(operands)
    const immediateX = this.getImmediateValue(operands, 1)
    const offset = this.getImmediateValue(operands, 2, 2)
    return `${this.name} r${registerA} ${immediateX} ${offset}`
  }
}

/**
 * BRANCH_GE_S_IMM instruction (opcode 0x89)
 * Branch if register greater or equal immediate (signed) as specified in Gray Paper
 */
export class BRANCH_GE_S_IMMInstruction extends BaseInstruction {
  readonly opcode = OPCODES.BRANCH_GE_S_IMM
  readonly name = 'BRANCH_GE_S_IMM'
  readonly description =
    'Branch if register greater or equal immediate (signed)'

  execute(context: InstructionContext): InstructionResult {
    const registerA = this.getRegisterA(context.instruction.operands)
    const immediateX = this.getImmediateValue(context.instruction.operands, 1)
    const offset = this.getImmediateValue(context.instruction.operands, 2, 2)
    const registerValue = this.getRegisterValue(context.registers, registerA)
    // Convert to signed comparison
    const signedRegister =
      registerValue > 2n ** 63n - 1n ? registerValue - 2n ** 64n : registerValue
    const signedImmediate =
      immediateX > 2n ** 63n - 1n ? immediateX - 2n ** 64n : immediateX
    const shouldBranch = signedRegister >= signedImmediate
    const targetAddress = shouldBranch
      ? context.instructionPointer + Number(offset)
      : context.instructionPointer + 1

    logger.debug('Executing BRANCH_GE_S_IMM instruction', {
      registerA,
      immediateX,
      offset,
      shouldBranch,
      targetAddress,
    })

    return {
      resultCode: RESULT_CODES.HALT,
      newInstructionPointer: targetAddress,
      newGasCounter: context.gasCounter - 1n,
    }
  }

  validate(operands: Uint8Array): boolean {
    return operands.length >= 4 // Need register, immediate, and offset
  }

  disassemble(operands: Uint8Array): string {
    const registerA = this.getRegisterA(operands)
    const immediateX = this.getImmediateValue(operands, 1)
    const offset = this.getImmediateValue(operands, 2, 2)
    return `${this.name} r${registerA} ${immediateX} ${offset}`
  }
}

/**
 * BRANCH_GT_S_IMM instruction (opcode 0x8A)
 * Branch if register greater than immediate (signed) as specified in Gray Paper
 */
export class BRANCH_GT_S_IMMInstruction extends BaseInstruction {
  readonly opcode = OPCODES.BRANCH_GT_S_IMM
  readonly name = 'BRANCH_GT_S_IMM'
  readonly description = 'Branch if register greater than immediate (signed)'

  execute(context: InstructionContext): InstructionResult {
    const registerA = this.getRegisterA(context.instruction.operands)
    const immediateX = this.getImmediateValue(context.instruction.operands, 1)
    const offset = this.getImmediateValue(context.instruction.operands, 2, 2)
    const registerValue = this.getRegisterValue(context.registers, registerA)
    // Convert to signed comparison
    const signedRegister =
      registerValue > 2n ** 63n - 1n ? registerValue - 2n ** 64n : registerValue
    const signedImmediate =
      immediateX > 2n ** 63n - 1n ? immediateX - 2n ** 64n : immediateX
    const shouldBranch = signedRegister > signedImmediate
    const targetAddress = shouldBranch
      ? context.instructionPointer + Number(offset)
      : context.instructionPointer + 1

    logger.debug('Executing BRANCH_GT_S_IMM instruction', {
      registerA,
      immediateX,
      offset,
      shouldBranch,
      targetAddress,
    })

    return {
      resultCode: RESULT_CODES.HALT,
      newInstructionPointer: targetAddress,
      newGasCounter: context.gasCounter - 1n,
    }
  }

  validate(operands: Uint8Array): boolean {
    return operands.length >= 4 // Need register, immediate, and offset
  }

  disassemble(operands: Uint8Array): string {
    const registerA = this.getRegisterA(operands)
    const immediateX = this.getImmediateValue(operands, 1)
    const offset = this.getImmediateValue(operands, 2, 2)
    return `${this.name} r${registerA} ${immediateX} ${offset}`
  }
}

/**
 * Register-based Branch Instructions
 *
 * BRANCH_* variants - Branch if condition between two registers
 */

/**
 * BRANCH_EQ instruction (opcode 0x170)
 * Branch if two registers are equal as specified in Gray Paper
 */
export class BRANCH_EQInstruction extends BaseInstruction {
  readonly opcode = OPCODES.BRANCH_EQ
  readonly name = 'BRANCH_EQ'
  readonly description = 'Branch if two registers are equal'

  execute(context: InstructionContext): InstructionResult {
    const registerA = this.getRegisterA(context.instruction.operands)
    const registerB = this.getRegisterB(context.instruction.operands)
    const offset = this.getImmediateValue(context.instruction.operands, 2)
    const registerValueA = this.getRegisterValue(context.registers, registerA)
    const registerValueB = this.getRegisterValue(context.registers, registerB)
    const shouldBranch = registerValueA === registerValueB
    const targetAddress = shouldBranch
      ? context.instructionPointer + Number(offset)
      : context.instructionPointer + 1

    logger.debug('Executing BRANCH_EQ instruction', {
      registerA,
      registerB,
      offset,
      shouldBranch,
      targetAddress,
    })

    return {
      resultCode: RESULT_CODES.HALT,
      newInstructionPointer: targetAddress,
      newGasCounter: context.gasCounter - 1n,
    }
  }

  validate(operands: Uint8Array): boolean {
    return operands.length >= 3 // Need two registers and offset
  }

  disassemble(operands: Uint8Array): string {
    const registerA = this.getRegisterA(operands)
    const registerB = this.getRegisterB(operands)
    const offset = this.getImmediateValue(operands, 2)
    return `${this.name} r${registerA} r${registerB} ${offset}`
  }
}

/**
 * BRANCH_NE instruction (opcode 0x171)
 * Branch if two registers are not equal as specified in Gray Paper
 */
export class BRANCH_NEInstruction extends BaseInstruction {
  readonly opcode = OPCODES.BRANCH_NE
  readonly name = 'BRANCH_NE'
  readonly description = 'Branch if two registers are not equal'

  execute(context: InstructionContext): InstructionResult {
    const registerA = this.getRegisterA(context.instruction.operands)
    const registerB = this.getRegisterB(context.instruction.operands)
    const offset = this.getImmediateValue(context.instruction.operands, 2)
    const registerValueA = this.getRegisterValue(context.registers, registerA)
    const registerValueB = this.getRegisterValue(context.registers, registerB)
    const shouldBranch = registerValueA !== registerValueB
    const targetAddress = shouldBranch
      ? context.instructionPointer + Number(offset)
      : context.instructionPointer + 1

    logger.debug('Executing BRANCH_NE instruction', {
      registerA,
      registerB,
      offset,
      shouldBranch,
      targetAddress,
    })

    return {
      resultCode: RESULT_CODES.HALT,
      newInstructionPointer: targetAddress,
      newGasCounter: context.gasCounter - 1n,
    }
  }

  validate(operands: Uint8Array): boolean {
    return operands.length >= 3 // Need two registers and offset
  }

  disassemble(operands: Uint8Array): string {
    const registerA = this.getRegisterA(operands)
    const registerB = this.getRegisterB(operands)
    const offset = this.getImmediateValue(operands, 2)
    return `${this.name} r${registerA} r${registerB} ${offset}`
  }
}

/**
 * BRANCH_LT_U instruction (opcode 0x172)
 * Branch if register A less than register B (unsigned) as specified in Gray Paper
 */
export class BRANCH_LT_UInstruction extends BaseInstruction {
  readonly opcode = OPCODES.BRANCH_LT_U
  readonly name = 'BRANCH_LT_U'
  readonly description = 'Branch if register A less than register B (unsigned)'

  execute(context: InstructionContext): InstructionResult {
    const registerA = this.getRegisterA(context.instruction.operands)
    const registerB = this.getRegisterB(context.instruction.operands)
    const offset = this.getImmediateValue(context.instruction.operands, 2)
    const registerValueA = this.getRegisterValue(context.registers, registerA)
    const registerValueB = this.getRegisterValue(context.registers, registerB)
    const shouldBranch = registerValueA < registerValueB
    const targetAddress = shouldBranch
      ? context.instructionPointer + Number(offset)
      : context.instructionPointer + 1

    logger.debug('Executing BRANCH_LT_U instruction', {
      registerA,
      registerB,
      offset,
      shouldBranch,
      targetAddress,
    })

    return {
      resultCode: RESULT_CODES.HALT,
      newInstructionPointer: targetAddress,
      newGasCounter: context.gasCounter - 1n,
    }
  }

  validate(operands: Uint8Array): boolean {
    return operands.length >= 3 // Need two registers and offset
  }

  disassemble(operands: Uint8Array): string {
    const registerA = this.getRegisterA(operands)
    const registerB = this.getRegisterB(operands)
    const offset = this.getImmediateValue(operands, 2)
    return `${this.name} r${registerA} r${registerB} ${offset}`
  }
}

/**
 * BRANCH_LT_S instruction (opcode 0x173)
 * Branch if register A less than register B (signed) as specified in Gray Paper
 */
export class BRANCH_LT_SInstruction extends BaseInstruction {
  readonly opcode = OPCODES.BRANCH_LT_S
  readonly name = 'BRANCH_LT_S'
  readonly description = 'Branch if register A less than register B (signed)'

  execute(context: InstructionContext): InstructionResult {
    const registerA = this.getRegisterA(context.instruction.operands)
    const registerB = this.getRegisterB(context.instruction.operands)
    const offset = this.getImmediateValue(context.instruction.operands, 2)
    const registerValueA = this.getRegisterValue(context.registers, registerA)
    const registerValueB = this.getRegisterValue(context.registers, registerB)
    // Convert to signed comparison
    const signedA =
      registerValueA > 2n ** 63n - 1n
        ? registerValueA - 2n ** 64n
        : registerValueA
    const signedB =
      registerValueB > 2n ** 63n - 1n
        ? registerValueB - 2n ** 64n
        : registerValueB
    const shouldBranch = signedA < signedB
    const targetAddress = shouldBranch
      ? context.instructionPointer + Number(offset)
      : context.instructionPointer + 1

    logger.debug('Executing BRANCH_LT_S instruction', {
      registerA,
      registerB,
      offset,
      shouldBranch,
      targetAddress,
    })

    return {
      resultCode: RESULT_CODES.HALT,
      newInstructionPointer: targetAddress,
      newGasCounter: context.gasCounter - 1n,
    }
  }

  validate(operands: Uint8Array): boolean {
    return operands.length >= 3 // Need two registers and offset
  }

  disassemble(operands: Uint8Array): string {
    const registerA = this.getRegisterA(operands)
    const registerB = this.getRegisterB(operands)
    const offset = this.getImmediateValue(operands, 2)
    return `${this.name} r${registerA} r${registerB} ${offset}`
  }
}

/**
 * BRANCH_GE_U instruction (opcode 0x174)
 * Branch if register A greater or equal register B (unsigned) as specified in Gray Paper
 */
export class BRANCH_GE_UInstruction extends BaseInstruction {
  readonly opcode = OPCODES.BRANCH_GE_U
  readonly name = 'BRANCH_GE_U'
  readonly description =
    'Branch if register A greater or equal register B (unsigned)'

  execute(context: InstructionContext): InstructionResult {
    const registerA = this.getRegisterA(context.instruction.operands)
    const registerB = this.getRegisterB(context.instruction.operands)
    const offset = this.getImmediateValue(context.instruction.operands, 2)
    const registerValueA = this.getRegisterValue(context.registers, registerA)
    const registerValueB = this.getRegisterValue(context.registers, registerB)
    const shouldBranch = registerValueA >= registerValueB
    const targetAddress = shouldBranch
      ? context.instructionPointer + Number(offset)
      : context.instructionPointer + 1

    logger.debug('Executing BRANCH_GE_U instruction', {
      registerA,
      registerB,
      offset,
      shouldBranch,
      targetAddress,
    })

    return {
      resultCode: RESULT_CODES.HALT,
      newInstructionPointer: targetAddress,
      newGasCounter: context.gasCounter - 1n,
    }
  }

  validate(operands: Uint8Array): boolean {
    return operands.length >= 3 // Need two registers and offset
  }

  disassemble(operands: Uint8Array): string {
    const registerA = this.getRegisterA(operands)
    const registerB = this.getRegisterB(operands)
    const offset = this.getImmediateValue(operands, 2)
    return `${this.name} r${registerA} r${registerB} ${offset}`
  }
}

/**
 * BRANCH_GE_S instruction (opcode 0x175)
 * Branch if register A greater or equal register B (signed) as specified in Gray Paper
 */
export class BRANCH_GE_SInstruction extends BaseInstruction {
  readonly opcode = OPCODES.BRANCH_GE_S
  readonly name = 'BRANCH_GE_S'
  readonly description =
    'Branch if register A greater or equal register B (signed)'

  execute(context: InstructionContext): InstructionResult {
    const registerA = this.getRegisterA(context.instruction.operands)
    const registerB = this.getRegisterB(context.instruction.operands)
    const offset = this.getImmediateValue(context.instruction.operands, 2)
    const registerValueA = this.getRegisterValue(context.registers, registerA)
    const registerValueB = this.getRegisterValue(context.registers, registerB)
    // Convert to signed comparison
    const signedA =
      registerValueA > 2n ** 63n - 1n
        ? registerValueA - 2n ** 64n
        : registerValueA
    const signedB =
      registerValueB > 2n ** 63n - 1n
        ? registerValueB - 2n ** 64n
        : registerValueB
    const shouldBranch = signedA >= signedB
    const targetAddress = shouldBranch
      ? context.instructionPointer + Number(offset)
      : context.instructionPointer + 1

    logger.debug('Executing BRANCH_GE_S instruction', {
      registerA,
      registerB,
      offset,
      shouldBranch,
      targetAddress,
    })

    return {
      resultCode: RESULT_CODES.HALT,
      newInstructionPointer: targetAddress,
      newGasCounter: context.gasCounter - 1n,
    }
  }

  validate(operands: Uint8Array): boolean {
    return operands.length >= 3 // Need two registers and offset
  }

  disassemble(operands: Uint8Array): string {
    const registerA = this.getRegisterA(operands)
    const registerB = this.getRegisterB(operands)
    const offset = this.getImmediateValue(operands, 2)
    return `${this.name} r${registerA} r${registerB} ${offset}`
  }
}
