/**
 * Branching Instructions
 *
 * BRANCH_*_IMM variants - Branch if condition with immediate
 */

import type { InstructionContext, InstructionResult } from '@pbnj/types'
import { OPCODES } from '../config'
import { BaseInstruction } from './base'

/**
 * BRANCH_EQ_IMM instruction (opcode 0x81)
 * Branch if register equals immediate as specified in Gray Paper
 * 
 * Gray Paper (pvm.tex line 405):
 * Format: "One Register, One Immediate and One Offset" (lines 385-396)
 * immed_Y = ι + signfunc{l_Y}(decode[l_Y]{instructions[ι+2+l_X:l_Y]})
 * Mutation: branch(immed_Y, reg_A = immed_X)
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

    context.log('BRANCH_EQ_IMM: Branch if register equals immediate', {
      operands: context.instruction.operands,
      pc: context.pc,
      registers: Array.from(context.registers.slice(0, 13)).map(r => r.toString()),
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
        context.log('BRANCH_NE_IMM: Not valid basic block start', {
          registerA,
          immediateX,
          registerValue,
          targetAddress,
          currentPC: context.pc,
        })
        return validationResult
      }

      context.log('BRANCH_EQ_IMM: Branching to valid basic block start', {
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
 * 
 * Gray Paper (pvm.tex line 406):
 * Format: "One Register, One Immediate and One Offset" (lines 385-396)
 * immed_Y = ι + signfunc{l_Y}(decode[l_Y]{instructions[ι+2+l_X:l_Y]})
 * Mutation: branch(immed_Y, reg_A ≠ immed_X)
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
        context.log('BRANCH_NE_IMM: Not valid basic block start', {
          registerA,
          immediateX,
          registerValue,
          targetAddress,
          currentPC: context.pc,
        })
        return validationResult
      }

      context.log('BRANCH_NE_IMM: Branching to valid basic block start', {
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
}

/**
 * BRANCH_LT_U_IMM instruction (opcode 0x83)
 * Branch if register less than immediate (unsigned) as specified in Gray Paper
 * 
 * Gray Paper (pvm.tex line 407):
 * Format: "One Register, One Immediate and One Offset" (lines 385-396)
 * immed_Y = ι + signfunc{l_Y}(decode[l_Y]{instructions[ι+2+l_X:l_Y]})
 * Mutation: branch(immed_Y, reg_A < immed_X)
 */
export class BRANCH_LT_U_IMMInstruction extends BaseInstruction {
  readonly opcode = OPCODES.BRANCH_LT_U_IMM
  readonly name = 'BRANCH_LT_U_IMM'
  readonly description = 'Branch if register less than immediate (unsigned)'

  execute(context: InstructionContext): InstructionResult {
    const { registerA, immediateX, targetAddress } = this.parseBranchOperands(
      context.instruction.operands,
      context.pc,
    )
    const registerValue = this.getRegisterValueAs64(
      context.registers,
      registerA,
    )

    // Branch if register less than immediate (unsigned)
    if (registerValue < immediateX) {
      // Gray Paper: Branches must target basic block starts
      const validationResult = this.validateBranchTarget(targetAddress, context)
      if (validationResult) {
        context.log('BRANCH_LT_U_IMM: Not valid basic block start', {
          registerA,
          immediateX,
          registerValue,
          targetAddress,
          currentPC: context.pc,
        })
        return validationResult
      }

      context.log('BRANCH_LT_U_IMM: Branching to valid basic block start', {
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
 * BRANCH_LE_U_IMM instruction (opcode 0x84)
 * Branch if register less or equal immediate (unsigned) as specified in Gray Paper
 * 
 * Gray Paper (pvm.tex line 408):
 * Format: "One Register, One Immediate and One Offset" (lines 385-396)
 * immed_Y = ι + signfunc{l_Y}(decode[l_Y]{instructions[ι+2+l_X:l_Y]})
 * Mutation: branch(immed_Y, reg_A ≤ immed_X)
 */
export class BRANCH_LE_U_IMMInstruction extends BaseInstruction {
  readonly opcode = OPCODES.BRANCH_LE_U_IMM
  readonly name = 'BRANCH_LE_U_IMM'
  readonly description = 'Branch if register less or equal immediate (unsigned)'

  execute(context: InstructionContext): InstructionResult {
    const { registerA, immediateX, targetAddress } = this.parseBranchOperands(
      context.instruction.operands,
      context.pc,
    )
    const registerValue = this.getRegisterValueAs64(
      context.registers,
      registerA,
    )

    // Branch if register less or equal immediate (unsigned)
    if (registerValue <= immediateX) {
      // Gray Paper: Branches must target basic block starts
      const validationResult = this.validateBranchTarget(targetAddress, context)
      if (validationResult) {
        context.log('BRANCH_LE_U_IMM: Not valid basic block start', {
          registerA,
          immediateX,
          registerValue,
          targetAddress,
          currentPC: context.pc,
        })
        return validationResult
      }

      context.log('BRANCH_LE_U_IMM: Branching to valid basic block start', {
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
 * 
 * Gray Paper (pvm.tex line 409):
 * Format: "One Register, One Immediate and One Offset" (lines 385-396)
 * immed_Y = ι + signfunc{l_Y}(decode[l_Y]{instructions[ι+2+l_X:l_Y]})
 * Mutation: branch(immed_Y, reg_A ≥ immed_X)
 */
export class BRANCH_GE_U_IMMInstruction extends BaseInstruction {
  readonly opcode = OPCODES.BRANCH_GE_U_IMM
  readonly name = 'BRANCH_GE_U_IMM'
  readonly description =
    'Branch if register greater or equal immediate (unsigned)'

  execute(context: InstructionContext): InstructionResult {
    const { registerA, immediateX, targetAddress } = this.parseBranchOperands(
      context.instruction.operands,
      context.pc,
    )
    const registerValue = this.getRegisterValueAs64(
      context.registers,
      registerA,
    )

    // Branch if register greater or equal immediate (unsigned)
    if (registerValue >= immediateX) {
      // Gray Paper: Branches must target basic block starts
      const validationResult = this.validateBranchTarget(targetAddress, context)
      if (validationResult) {
        context.log('BRANCH_GE_U_IMM: Not valid basic block start', {
          registerA,
          immediateX,
          registerValue,
          targetAddress,
          currentPC: context.pc,
        })
        return validationResult
      }

      context.log('BRANCH_GE_U_IMM: Branching to valid basic block start', {
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
 * 
 * Gray Paper (pvm.tex line 410):
 * Format: "One Register, One Immediate and One Offset" (lines 385-396)
 * immed_Y = ι + signfunc{l_Y}(decode[l_Y]{instructions[ι+2+l_X:l_Y]})
 * Mutation: branch(immed_Y, reg_A > immed_X)
 */
export class BRANCH_GT_U_IMMInstruction extends BaseInstruction {
  readonly opcode = OPCODES.BRANCH_GT_U_IMM
  readonly name = 'BRANCH_GT_U_IMM'
  readonly description = 'Branch if register greater than immediate (unsigned)'

  execute(context: InstructionContext): InstructionResult {
    const { registerA, immediateX, targetAddress } = this.parseBranchOperands(
      context.instruction.operands,
      context.pc,
    )
    const registerValue = this.getRegisterValueAs64(
      context.registers,
      registerA,
    )

    // Branch if register greater than immediate (unsigned)
    if (registerValue > immediateX) {
      // Gray Paper: Branches must target basic block starts
      const validationResult = this.validateBranchTarget(targetAddress, context)
      if (validationResult) {
        context.log('BRANCH_GT_U_IMM: Not valid basic block start', {
          registerA,
          immediateX,
          registerValue,
          targetAddress,
          currentPC: context.pc,
        })
        return validationResult
      }

      context.log('BRANCH_GT_U_IMM: Branching to valid basic block start', {
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
 * BRANCH_LT_S_IMM instruction (opcode 0x87)
 * Branch if register less than immediate (signed) as specified in Gray Paper
 * 
 * Gray Paper (pvm.tex line 411):
 * Format: "One Register, One Immediate and One Offset" (lines 385-396)
 * immed_Y = ι + signfunc{l_Y}(decode[l_Y]{instructions[ι+2+l_X:l_Y]})
 * Mutation: branch(immed_Y, signed(reg_A) < signed(immed_X))
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
        context.log('BRANCH_LT_S_IMM: Not valid basic block start', {
          registerA,
          immediateX,
          registerValue,
          targetAddress,
          currentPC: context.pc,
        })
        return validationResult
      }

      context.log('BRANCH_LT_S_IMM: Branching to valid basic block start', {
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
 * BRANCH_LE_S_IMM instruction (opcode 0x88)
 * Branch if register less or equal immediate (signed) as specified in Gray Paper
 * 
 * Gray Paper (pvm.tex line 412):
 * Format: "One Register, One Immediate and One Offset" (lines 385-396)
 * immed_Y = ι + signfunc{l_Y}(decode[l_Y]{instructions[ι+2+l_X:l_Y]})
 * Mutation: branch(immed_Y, signed(reg_A) ≤ signed(immed_X))
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
        context.log('BRANCH_LE_S_IMM: Not valid basic block start', {
          registerA,
          immediateX,
          registerValue,
          targetAddress,
          currentPC: context.pc,
        })
        return validationResult
      }

      context.log('BRANCH_LE_S_IMM: Branching to valid basic block start', {
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
 * BRANCH_GE_S_IMM instruction (opcode 0x89)
 * Branch if register greater or equal immediate (signed) as specified in Gray Paper
 * 
 * Gray Paper (pvm.tex line 413):
 * Format: "One Register, One Immediate and One Offset" (lines 385-396)
 * immed_Y = ι + signfunc{l_Y}(decode[l_Y]{instructions[ι+2+l_X:l_Y]})
 * Mutation: branch(immed_Y, signed(reg_A) ≥ signed(immed_X))
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
        context.log('BRANCH_GE_S_IMM: Not valid basic block start', {
          registerA,
          immediateX,
          registerValue,
          targetAddress,
          currentPC: context.pc,
        })
        return validationResult
      }

      context.log('BRANCH_GE_S_IMM: Branching to valid basic block start', {
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
 * BRANCH_GT_S_IMM instruction (opcode 0x8A / 0x90)
 * Branch if register greater than immediate (signed) as specified in Gray Paper
 * 
 * Gray Paper (pvm.tex line 414):
 * Format: "One Register, One Immediate and One Offset" (lines 385-396)
 * immed_Y = ι + signfunc{l_Y}(decode[l_Y]{instructions[ι+2+l_X:l_Y]})
 * Mutation: branch(immed_Y, signed(reg_A) > signed(immed_X))
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
        context.log('BRANCH_GT_S_IMM: Not valid basic block start', {
          registerA,
          immediateX,
          registerValue,
          targetAddress,
          currentPC: context.pc,
        })
        return validationResult
      }

      context.log('BRANCH_GT_S_IMM: Branching to valid basic block start', {
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
 * Register-based Branch Instructions
 *
 * BRANCH_* variants - Branch if condition between two registers
 */

/**
 * BRANCH_EQ instruction (opcode 0x170)
 * Branch if two registers are equal as specified in Gray Paper
 * 
 * Gray Paper (pvm.tex line 551):
 * Format: "Two Registers & One Offset" (lines 531-543)
 * immed_X ≡ ι + signfunc{l_X}(decode[l_X]{instructions[ι+2:l_X]})
 * Mutation: branch(immed_X, reg_A = reg_B)
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
        context.log('BRANCH_EQ: Not valid basic block start', {
          registerA,
          registerB,
          registerValueA,
          registerValueB,
          targetAddress,
          currentPC: context.pc,
        })
        return validationResult
      }

      context.log('BRANCH_EQ: Branching to valid basic block start', {
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
 * BRANCH_NE instruction (opcode 0x171)
 * Branch if two registers are not equal as specified in Gray Paper
 * 
 * Gray Paper (pvm.tex line 552):
 * Format: "Two Registers & One Offset" (lines 531-543)
 * immed_X ≡ ι + signfunc{l_X}(decode[l_X]{instructions[ι+2:l_X]})
 * Mutation: branch(immed_X, reg_A ≠ reg_B)
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

    context.log('BRANCH_NE: Branch if two registers are not equal', {
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
        context.log('BRANCH_NE: Not valid basic block start', {
          registerA,
          registerB,
          registerValueA,
          registerValueB,
          targetAddress,
          currentPC: context.pc,
        })
        return validationResult
      }

      context.log('BRANCH_NE: Branching to valid basic block start', {
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
 * 
 * Gray Paper (pvm.tex line 553):
 * Format: "Two Registers & One Offset" (lines 531-543)
 * immed_X ≡ ι + signfunc{l_X}(decode[l_X]{instructions[ι+2:l_X]})
 * Mutation: branch(immed_X, reg_A < reg_B)
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
        context.log('BRANCH_LT_U: Not valid basic block start', {
          registerA,
          registerB,
          registerValueA,
          registerValueB,
          targetAddress,
          currentPC: context.pc,
        })
        return validationResult
      }

      context.log('BRANCH_LT_U: Branching to valid basic block start', {
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
 * 
 * Gray Paper (pvm.tex line 554):
 * Format: "Two Registers & One Offset" (lines 531-543)
 * immed_X ≡ ι + signfunc{l_X}(decode[l_X]{instructions[ι+2:l_X]})
 * Mutation: branch(immed_X, signed(reg_A) < signed(reg_B))
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
        context.log('BRANCH_LT_S: Not valid basic block start', {
          registerA,
          registerB,
          registerValueA,
          registerValueB,
          targetAddress,
          currentPC: context.pc,
        })
        return validationResult
      }

      context.log('BRANCH_LT_S: Branching to valid basic block start', {
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
 * 
 * Gray Paper (pvm.tex line 555):
 * Format: "Two Registers & One Offset" (lines 531-543)
 * immed_X ≡ ι + signfunc{l_X}(decode[l_X]{instructions[ι+2:l_X]})
 * Mutation: branch(immed_X, reg_A ≥ reg_B)
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
        context.log('BRANCH_GE_U: Not valid basic block start', {
          registerA,
          registerB,
          registerValueA,
          registerValueB,
          targetAddress,
          currentPC: context.pc,
        })
        return validationResult
      }

      context.log('BRANCH_GE_U: Branching to valid basic block start', {
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
 * 
 * Gray Paper (pvm.tex line 556):
 * Format: "Two Registers & One Offset" (lines 531-543)
 * immed_X ≡ ι + signfunc{l_X}(decode[l_X]{instructions[ι+2:l_X]})
 * Mutation: branch(immed_X, signed(reg_A) ≥ signed(reg_B))
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
        context.log('BRANCH_GE_S: Not valid basic block start', {
          registerA,
          registerB,
          registerValueA,
          registerValueB,
          targetAddress,
          currentPC: context.pc,
        })
        return validationResult
      }

      context.log('BRANCH_GE_S: Branching to valid basic block start', {
        targetAddress,
        currentPC: context.pc,
      })

      context.pc = targetAddress
    }
    // else: not branching - PVM will advance PC normally

    return { resultCode: null }
  }
}
