/**
 * Branching Instructions
 *
 * BRANCH_*_IMM variants - Branch if condition with immediate
 */

import {
  OPCODE_BRANCH_EQ,
  OPCODE_BRANCH_EQ_IMM,
  OPCODE_BRANCH_GE_S,
  OPCODE_BRANCH_GE_S_IMM,
  OPCODE_BRANCH_GE_U,
  OPCODE_BRANCH_GE_U_IMM,
  OPCODE_BRANCH_GT_S_IMM,
  OPCODE_BRANCH_GT_U_IMM,
  OPCODE_BRANCH_LE_S_IMM,
  OPCODE_BRANCH_LE_U_IMM,
  OPCODE_BRANCH_LT_S,
  OPCODE_BRANCH_LT_S_IMM,
  OPCODE_BRANCH_LT_U,
  OPCODE_BRANCH_LT_U_IMM,
  OPCODE_BRANCH_NE,
  OPCODE_BRANCH_NE_IMM,
} from '../config'
import { InstructionContext, InstructionResult } from '../types'
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
  opcode: i32 = OPCODE_BRANCH_EQ_IMM
  name: string = 'BRANCH_EQ_IMM'

  execute(context: InstructionContext): InstructionResult {
    const parseResult = this.parseBranchOperands(context.operands, context.programCounter)
    const registerA: u8 = parseResult.registerA
    const immediateX = parseResult.immediateX
    const targetAddress = parseResult.targetAddress
    const registerValue = this.getRegisterValueAs64(
      context.registers,
      registerA,
    )

    // Branch if register equals immediate
    if (registerValue === immediateX) {
      // Gray Paper: Branches must target basic block starts
      const validationResult = this.validateBranchTarget(targetAddress, context)
      if (validationResult) {
        return validationResult
      }

      context.programCounter = targetAddress
    }
    // else: not branching - PVM will advance PC normally

    return new InstructionResult(-1)
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
  opcode: i32 = OPCODE_BRANCH_NE_IMM
  name: string = 'BRANCH_NE_IMM'


  execute(context: InstructionContext): InstructionResult {
    const parseResult = this.parseBranchOperands(context.operands, context.programCounter)
    const registerA: u8 = parseResult.registerA
    const immediateX = parseResult.immediateX
    const targetAddress = parseResult.targetAddress
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

      context.programCounter = targetAddress
    }
    // else: not branching - PVM will advance PC normally

    return new InstructionResult(-1)
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
  opcode: i32 = OPCODE_BRANCH_LT_U_IMM
  name: string = 'BRANCH_LT_U_IMM'


  execute(context: InstructionContext): InstructionResult {
    const parseResult = this.parseBranchOperands(context.operands, context.programCounter)
    const registerA: u8 = parseResult.registerA
    const immediateX = parseResult.immediateX
    const targetAddress = parseResult.targetAddress
    const registerValue = this.getRegisterValueAs64(
      context.registers,
      registerA,
    )

    // Branch if register less than immediate (unsigned)
    if (u64(registerValue) < u64(immediateX)) {
      // Gray Paper: Branches must target basic block starts
      const validationResult = this.validateBranchTarget(targetAddress, context)
      if (validationResult) {
        return validationResult
      }

      context.programCounter = targetAddress
    }
    // else: not branching - PVM will advance PC normally

    return new InstructionResult(-1)
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
  opcode: i32 = OPCODE_BRANCH_LE_U_IMM
  name: string = 'BRANCH_LE_U_IMM'


  execute(context: InstructionContext): InstructionResult {
    const parseResult = this.parseBranchOperands(context.operands, context.programCounter)
    const registerA: u8 = parseResult.registerA
    const immediateX = parseResult.immediateX
    const targetAddress = parseResult.targetAddress
    const registerValue = this.getRegisterValueAs64(
      context.registers,
      registerA,
    )

    // Branch if register less or equal immediate (unsigned)
    if (u64(registerValue) <= u64(immediateX)) {
      // Gray Paper: Branches must target basic block starts
      const validationResult = this.validateBranchTarget(targetAddress, context)
      if (validationResult) { 

        return validationResult
      }

      context.programCounter = targetAddress
    }
    // else: not branching - PVM will advance PC normally

    return new InstructionResult(-1)
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
  opcode: i32 = OPCODE_BRANCH_GE_U_IMM
  name: string = 'BRANCH_GE_U_IMM'


  execute(context: InstructionContext): InstructionResult {
    const parseResult = this.parseBranchOperands(context.operands, context.programCounter)
    const registerA: u8 = parseResult.registerA
    const immediateX = parseResult.immediateX
    const targetAddress = parseResult.targetAddress
    const registerValue = this.getRegisterValueAs64(
      context.registers,
      registerA,
    )

    // Branch if register greater or equal immediate (unsigned)
    if (u64(registerValue) >= u64(immediateX)) {
      // Gray Paper: Branches must target basic block starts
      const validationResult = this.validateBranchTarget(targetAddress, context)
      if (validationResult) {

        return validationResult
      }

      context.programCounter = targetAddress
    }
    // else: not branching - PVM will advance PC normally

    return new InstructionResult(-1)
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
  opcode: i32 = OPCODE_BRANCH_GT_U_IMM
  name: string = 'BRANCH_GT_U_IMM'


  execute(context: InstructionContext): InstructionResult {
    const parseResult = this.parseBranchOperands(context.operands, context.programCounter)
    const registerA: u8 = parseResult.registerA
    const immediateX = parseResult.immediateX
    const targetAddress = parseResult.targetAddress
    const registerValue = this.getRegisterValueAs64(
      context.registers,
      registerA,
    )

    // Branch if register greater than immediate (unsigned)
    if (u64(registerValue) > u64(immediateX)) {
      // Gray Paper: Branches must target basic block starts
      const validationResult = this.validateBranchTarget(targetAddress, context)
      if (validationResult) {

        return validationResult
      }

      context.programCounter = targetAddress
    }
    // else: not branching - PVM will advance PC normally

    return new InstructionResult(-1)
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
  opcode: i32 = OPCODE_BRANCH_LT_S_IMM
  name: string = 'BRANCH_LT_S_IMM'


  execute(context: InstructionContext): InstructionResult {
    const parseResult = this.parseBranchOperands(context.operands, context.programCounter)
    const registerA: u8 = parseResult.registerA
    const immediateX = parseResult.immediateX
    const targetAddress = parseResult.targetAddress
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

      context.programCounter = targetAddress
    }
    // else: not branching - PVM will advance PC normally

    return new InstructionResult(-1)
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
  opcode: i32 = OPCODE_BRANCH_LE_S_IMM
  name: string = 'BRANCH_LE_S_IMM'


  execute(context: InstructionContext): InstructionResult {
    const parseResult = this.parseBranchOperands(context.operands, context.programCounter)
    const registerA: u8 = parseResult.registerA
    const immediateX = parseResult.immediateX
    const targetAddress = parseResult.targetAddress
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

      context.programCounter = targetAddress
    }
    // else: not branching - PVM will advance PC normally

    return new InstructionResult(-1)
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
  opcode: i32 = OPCODE_BRANCH_GE_S_IMM
  name: string = 'BRANCH_GE_S_IMM'


  execute(context: InstructionContext): InstructionResult {
    const parseResult = this.parseBranchOperands(context.operands, context.programCounter)
    const registerA: u8 = parseResult.registerA
    const immediateX = parseResult.immediateX
    const targetAddress = parseResult.targetAddress
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

      context.programCounter = targetAddress
    }
    // else: not branching - PVM will advance PC normally

    return new InstructionResult(-1)
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
  opcode: i32 = OPCODE_BRANCH_GT_S_IMM
  name: string = 'BRANCH_GT_S_IMM'


  execute(context: InstructionContext): InstructionResult {
    const parseResult = this.parseBranchOperands(context.operands, context.programCounter)
    const registerA: u8 = parseResult.registerA
    const immediateX = parseResult.immediateX
    const targetAddress = parseResult.targetAddress
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

      context.programCounter = targetAddress
    }
    // else: not branching - PVM will advance PC normally

    return new InstructionResult(-1)
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
  opcode: i32 = OPCODE_BRANCH_EQ
  name: string = 'BRANCH_EQ'


  execute(context: InstructionContext): InstructionResult {
    const parseResult = this.parseRegisterBranchOperands(context.operands, context.programCounter)
    const registerA: u8 = parseResult.registerA
    const registerB: u8 = parseResult.registerB
    const targetAddress = parseResult.targetAddress
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

      context.programCounter = targetAddress
    }
    // else: not branching - PVM will advance PC normally

    return new InstructionResult(-1)
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
  opcode: i32 = OPCODE_BRANCH_NE
  name: string = 'BRANCH_NE'


  execute(context: InstructionContext): InstructionResult {
    const parseResult = this.parseRegisterBranchOperands(context.operands, context.programCounter)
    const registerA: u8 = parseResult.registerA
    const registerB: u8 = parseResult.registerB
    const targetAddress = parseResult.targetAddress
    const registerValueA = this.getRegisterValueAs64(
      context.registers,
      registerA,
    )
    const registerValueB = this.getRegisterValueAs64(
      context.registers,
      registerB,
    )

    // Branch if two registers are not equal
    if (registerValueA !== registerValueB) {
      // Gray Paper: Branches must target basic block starts
      const validationResult = this.validateBranchTarget(targetAddress, context)
      if (validationResult) {
        return validationResult
      }

      context.programCounter = targetAddress
    }
    // else: not branching - PVM will advance PC normally

    return new InstructionResult(-1)
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
  opcode: i32 = OPCODE_BRANCH_LT_U
  name: string = 'BRANCH_LT_U'

  execute(context: InstructionContext): InstructionResult {
    const parseResult = this.parseRegisterBranchOperands(context.operands, context.programCounter)
    const registerA: u8 = parseResult.registerA
    const registerB: u8 = parseResult.registerB
    const targetAddress = parseResult.targetAddress
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

      context.programCounter = targetAddress
    }
    // else: not branching - PVM will advance PC normally

    return new InstructionResult(-1)
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
  opcode: i32 = OPCODE_BRANCH_LT_S
  name: string = 'BRANCH_LT_S'


  execute(context: InstructionContext): InstructionResult {
    const parseResult = this.parseRegisterBranchOperands(context.operands, context.programCounter)
    const registerA: u8 = parseResult.registerA
    const registerB: u8 = parseResult.registerB
    const targetAddress = parseResult.targetAddress
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

      context.programCounter = targetAddress
    }
    // else: not branching - PVM will advance PC normally

    return new InstructionResult(-1)
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
  opcode: i32 = OPCODE_BRANCH_GE_U
  name: string = 'BRANCH_GE_U'


  execute(context: InstructionContext): InstructionResult {
    const parseResult = this.parseRegisterBranchOperands(context.operands, context.programCounter)
    const registerA: u8 = parseResult.registerA
    const registerB: u8 = parseResult.registerB
    const targetAddress = parseResult.targetAddress
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

      context.programCounter = targetAddress
    }
    // else: not branching - PVM will advance PC normally

    return new InstructionResult(-1)
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
  opcode: i32 = OPCODE_BRANCH_GE_S
  name: string = 'BRANCH_GE_S'


  execute(context: InstructionContext): InstructionResult {
    const parseResult = this.parseRegisterBranchOperands(context.operands, context.programCounter)
    const registerA: u8 = parseResult.registerA
    const registerB: u8 = parseResult.registerB
    const targetAddress = parseResult.targetAddress
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

      context.programCounter = targetAddress
    }
    // else: not branching - PVM will advance PC normally

    return new InstructionResult(-1)
  }
}
