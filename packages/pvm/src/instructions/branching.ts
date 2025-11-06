/**
 * Branching Instructions
 *
 * BRANCH_*_IMM variants - Branch if condition with immediate
 */

import { logger } from '@pbnj/core'
import type { InstructionContext, InstructionResult } from '@pbnj/types'
import { OPCODES } from '../config'
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
    const { registerA, immediateX, targetAddress } = this.parseBranchOperands(
      context.instruction.operands,
      context.pc,
    )
    const registerValue = this.getRegisterValueAs64(
      context.registers,
      registerA,
    )

    logger.debug('Executing BRANCH_EQ_IMM instruction', {
      bitmask: context.bitmask,
      opcode: this.opcode,
      name: this.name,
      description: this.description,
      operands: context.instruction.operands,
      pc: context.pc,
      registers: context.registers,
      registerA,
      immediateX,
      targetAddress: targetAddress.toString(),
      registerValue: registerValue.toString(),
    })
    // Branch if register equals immediate
    if (registerValue === immediateX) {
      // Gray Paper: Branches must target basic block starts
      const validationResult = this.validateBranchTarget(targetAddress, context)
      if (validationResult) {
        return validationResult
      }

      logger.debug('BRANCH_EQ_IMM: Branching to valid basic block start', {
        targetAddress,
        currentPC: context.pc,
      })

      context.pc = targetAddress
    }
    // else: not branching - PVM will advance PC normally

    return { resultCode: null }
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
    const { registerA, immediateX, targetAddress } = this.parseBranchOperands(
      context.instruction.operands,
      context.pc,
    )
    const registerValue = this.getRegisterValueAs64(
      context.registers,
      registerA,
    )

    // Branch if register not equals immediate
    if (registerValue !== immediateX) {
      // Gray Paper: Branches must target basic block starts
      const validationResult = this.validateBranchTarget(targetAddress, context)
      if (validationResult) {
        return validationResult
      }

      logger.debug('BRANCH_NE_IMM: Branching to valid basic block start', {
        registerA,
        immediateX,
        registerValue,
        targetAddress,
        currentPC: context.pc,
      })

      context.pc = targetAddress
    }
    // else: not branching - PVM will advance PC normally

    return { resultCode: null }
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
    const { registerA, immediateX, targetAddress } =
      this.parseBranchOperandsUnsigned(context.instruction.operands, context.pc)
    const registerValue = this.getRegisterValueAs64(
      context.registers,
      registerA,
    )

    // Branch if register less than immediate (unsigned)
    if (registerValue < immediateX) {
      // Gray Paper: Branches must target basic block starts
      const validationResult = this.validateBranchTarget(targetAddress, context)
      if (validationResult) {
        return validationResult
      }

      logger.debug('BRANCH_LT_U_IMM: Branching to valid basic block start', {
        targetAddress,
        currentPC: context.pc,
      })

      context.pc = targetAddress
    }
    // else: not branching - PVM will advance PC normally

    return { resultCode: null }
  }

  disassemble(operands: Uint8Array): string {
    const { registerA, immediateX, offset } = this.parseBranchOperands(
      operands,
      0n,
    )
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
    const { registerA, immediateX, targetAddress } =
      this.parseBranchOperandsUnsigned(context.instruction.operands, context.pc)
    const registerValue = this.getRegisterValueAs64(
      context.registers,
      registerA,
    )

    // Branch if register less or equal immediate (unsigned)
    if (registerValue <= immediateX) {
      // Gray Paper: Branches must target basic block starts
      const validationResult = this.validateBranchTarget(targetAddress, context)
      if (validationResult) {
        return validationResult
      }

      logger.debug('BRANCH_LE_U_IMM: Branching to valid basic block start', {
        targetAddress,
        currentPC: context.pc,
      })

      context.pc = targetAddress
    }
    // else: not branching - PVM will advance PC normally

    return { resultCode: null }
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
    const { registerA, immediateX, targetAddress } =
      this.parseBranchOperandsUnsigned(context.instruction.operands, context.pc)
    const registerValue = this.getRegisterValueAs64(
      context.registers,
      registerA,
    )

    // Branch if register greater or equal immediate (unsigned)
    if (registerValue >= immediateX) {
      // Gray Paper: Branches must target basic block starts
      const validationResult = this.validateBranchTarget(targetAddress, context)
      if (validationResult) {
        return validationResult
      }

      logger.debug('BRANCH_GE_U_IMM: Branching to valid basic block start', {
        targetAddress,
        currentPC: context.pc,
      })

      context.pc = targetAddress
    }
    // else: not branching - PVM will advance PC normally

    return { resultCode: null }
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
    const { registerA, immediateX, targetAddress } =
      this.parseBranchOperandsUnsigned(context.instruction.operands, context.pc)
    const registerValue = this.getRegisterValueAs64(
      context.registers,
      registerA,
    )

    // Branch if register greater than immediate (unsigned)
    if (registerValue > immediateX) {
      // Gray Paper: Branches must target basic block starts
      const validationResult = this.validateBranchTarget(targetAddress, context)
      if (validationResult) {
        return validationResult
      }

      logger.debug('BRANCH_GT_U_IMM: Branching to valid basic block start', {
        targetAddress,
        currentPC: context.pc,
      })

      context.pc = targetAddress
    }
    // else: not branching - PVM will advance PC normally

    return { resultCode: null }
  }

  disassemble(operands: Uint8Array): string {
    const { registerA, immediateX, offset } = this.parseBranchOperands(
      operands,
      0n,
    )
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
    const { registerA, immediateX, targetAddress } = this.parseBranchOperands(
      context.instruction.operands,
      context.pc,
    )
    const registerValue = this.getRegisterValueAs64(
      context.registers,
      registerA,
    )

    // Branch if register less than immediate (signed)
    if (this.signedCompare(registerValue, immediateX) < 0) {
      // Gray Paper: Branches must target basic block starts
      const validationResult = this.validateBranchTarget(targetAddress, context)
      if (validationResult) {
        return validationResult
      }

      logger.debug('BRANCH_LT_S_IMM: Branching to valid basic block start', {
        targetAddress,
        currentPC: context.pc,
      })

      context.pc = targetAddress
    }
    // else: not branching - PVM will advance PC normally

    return { resultCode: null }
  }
  disassemble(operands: Uint8Array): string {
    const { registerA, immediateX, offset } = this.parseBranchOperands(
      operands,
      0n,
    )
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
    const { registerA, immediateX, targetAddress } = this.parseBranchOperands(
      context.instruction.operands,
      context.pc,
    )
    const registerValue = this.getRegisterValueAs64(
      context.registers,
      registerA,
    )

    // Branch if register less or equal immediate (signed)
    if (this.signedCompare(registerValue, immediateX) <= 0) {
      // Gray Paper: Branches must target basic block starts
      const validationResult = this.validateBranchTarget(targetAddress, context)
      if (validationResult) {
        return validationResult
      }

      logger.debug('BRANCH_LE_S_IMM: Branching to valid basic block start', {
        targetAddress,
        currentPC: context.pc,
      })

      context.pc = targetAddress
    }
    // else: not branching - PVM will advance PC normally

    return { resultCode: null }
  }

  disassemble(operands: Uint8Array): string {
    const registerA = this.getRegisterA(operands)
    const immediateX = this.getImmediateValue(operands, 1)
    const offset = this.getImmediateValue(operands, 0)
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
    const { registerA, immediateX, targetAddress } = this.parseBranchOperands(
      context.instruction.operands,
      context.pc,
    )
    const registerValue = this.getRegisterValueAs64(
      context.registers,
      registerA,
    )

    // Branch if register greater or equal immediate (signed)
    if (this.signedCompare(registerValue, immediateX) >= 0) {
      // Gray Paper: Branches must target basic block starts
      const validationResult = this.validateBranchTarget(targetAddress, context)
      if (validationResult) {
        return validationResult
      }

      logger.debug('BRANCH_GE_S_IMM: Branching to valid basic block start', {
        targetAddress,
        currentPC: context.pc,
      })

      context.pc = targetAddress
    }
    // else: not branching - PVM will advance PC normally

    return { resultCode: null }
  }

  disassemble(operands: Uint8Array): string {
    const { registerA, immediateX, offset } = this.parseBranchOperands(
      operands,
      0n,
    )
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
    const { registerA, immediateX, targetAddress } = this.parseBranchOperands(
      context.instruction.operands,
      context.pc,
    )
    const registerValue = this.getRegisterValueAs64(
      context.registers,
      registerA,
    )

    // Branch if register greater than immediate (signed)
    if (this.signedCompare(registerValue, immediateX) > 0) {
      // Gray Paper: Branches must target basic block starts
      const validationResult = this.validateBranchTarget(targetAddress, context)
      if (validationResult) {
        return validationResult
      }

      logger.debug('BRANCH_GT_S_IMM: Branching to valid basic block start', {
        targetAddress,
        currentPC: context.pc,
      })

      context.pc = targetAddress
    }
    // else: not branching - PVM will advance PC normally

    return { resultCode: null }
  }

  disassemble(operands: Uint8Array): string {
    const registerA = this.getRegisterA(operands)
    const immediateX = this.getImmediateValue(operands, 0)
    const offset = this.getImmediateValue(operands, 0)
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
    const { registerA, registerB, targetAddress } =
      this.parseRegisterBranchOperands(context.instruction.operands, context.pc)
    const registerValueA = this.getRegisterValueAs64(
      context.registers,
      registerA,
    )
    const registerValueB = this.getRegisterValueAs64(
      context.registers,
      registerB,
    )

    // Branch if two registers are equal
    if (registerValueA === registerValueB) {
      // Gray Paper: Branches must target basic block starts
      const validationResult = this.validateBranchTarget(targetAddress, context)
      if (validationResult) {
        return validationResult
      }

      logger.debug('BRANCH_EQ: Branching to valid basic block start', {
        targetAddress,
        currentPC: context.pc,
      })

      context.pc = targetAddress
    }
    // else: not branching - PVM will advance PC normally

    return { resultCode: null }
  }

  disassemble(operands: Uint8Array): string {
    const { registerA, registerB, offset } = this.parseRegisterBranchOperands(
      operands,
      0n,
    )
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
    const { registerA, registerB, targetAddress } =
      this.parseRegisterBranchOperands(context.instruction.operands, context.pc)
    const registerValueA = this.getRegisterValueAs64(
      context.registers,
      registerA,
    )
    const registerValueB = this.getRegisterValueAs64(
      context.registers,
      registerB,
    )

    console.log('Executing BRANCH_NE instruction', {
      operands: Array.from(context.instruction.operands),
      currentPC: context.pc,
      registerA,
      registerB,
      registerValueA,
      registerValueB,
      targetAddress,
    })

    // Branch if two registers are not equal
    if (registerValueA !== registerValueB) {
      // Gray Paper: Branches must target basic block starts
      const validationResult = this.validateBranchTarget(targetAddress, context)
      if (validationResult) {
        return validationResult
      }

      logger.debug('BRANCH_NE: Branching to valid basic block start', {
        targetAddress,
        currentPC: context.pc,
      })

      context.pc = targetAddress
    }
    // else: not branching - PVM will advance PC normally

    return { resultCode: null }
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
    const { registerA, registerB, targetAddress } =
      this.parseRegisterBranchOperands(context.instruction.operands, context.pc)
    const registerValueA = this.getRegisterValueAs64(
      context.registers,
      registerA,
    )
    const registerValueB = this.getRegisterValueAs64(
      context.registers,
      registerB,
    )
    // Branch if register A less than register B (unsigned)
    if (registerValueA < registerValueB) {
      // Gray Paper: Branches must target basic block starts
      const validationResult = this.validateBranchTarget(targetAddress, context)
      if (validationResult) {
        return validationResult
      }

      logger.debug('BRANCH_LT_U: Branching to valid basic block start', {
        targetAddress,
        currentPC: context.pc,
      })

      context.pc = targetAddress
    }
    // else: not branching - PVM will advance PC normally

    return { resultCode: null }
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
    const { registerA, registerB, targetAddress } =
      this.parseRegisterBranchOperands(context.instruction.operands, context.pc)
    const registerValueA = this.getRegisterValueAs64(
      context.registers,
      registerA,
    )
    const registerValueB = this.getRegisterValueAs64(
      context.registers,
      registerB,
    )
    // Branch if register A less than register B (signed)
    if (this.signedCompare(registerValueA, registerValueB) < 0) {
      // Gray Paper: Branches must target basic block starts
      const validationResult = this.validateBranchTarget(targetAddress, context)
      if (validationResult) {
        return validationResult
      }

      logger.debug('BRANCH_LT_S: Branching to valid basic block start', {
        targetAddress,
        currentPC: context.pc,
      })

      context.pc = targetAddress
    }
    // else: not branching - PVM will advance PC normally

    return { resultCode: null }
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
    const { registerA, registerB, targetAddress } =
      this.parseRegisterBranchOperands(context.instruction.operands, context.pc)
    const registerValueA = this.getRegisterValueAs64(
      context.registers,
      registerA,
    )
    const registerValueB = this.getRegisterValueAs64(
      context.registers,
      registerB,
    )
    // Branch if register A greater or equal register B (unsigned)
    if (registerValueA >= registerValueB) {
      // Gray Paper: Branches must target basic block starts
      const validationResult = this.validateBranchTarget(targetAddress, context)
      if (validationResult) {
        return validationResult
      }

      logger.debug('BRANCH_GE_U: Branching to valid basic block start', {
        targetAddress,
        currentPC: context.pc,
      })

      context.pc = targetAddress
    }
    // else: not branching - PVM will advance PC normally

    return { resultCode: null }
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
    const { registerA, registerB, targetAddress } =
      this.parseRegisterBranchOperands(context.instruction.operands, context.pc)
    const registerValueA = this.getRegisterValueAs64(
      context.registers,
      registerA,
    )
    const registerValueB = this.getRegisterValueAs64(
      context.registers,
      registerB,
    )
    // Branch if register A greater or equal register B (signed)
    if (this.signedCompare(registerValueA, registerValueB) >= 0) {
      // Gray Paper: Branches must target basic block starts
      const validationResult = this.validateBranchTarget(targetAddress, context)
      if (validationResult) {
        return validationResult
      }

      logger.debug('BRANCH_GE_S: Branching to valid basic block start', {
        targetAddress,
        currentPC: context.pc,
      })

      context.pc = targetAddress
    }
    // else: not branching - PVM will advance PC normally

    return { resultCode: null }
  }
}
