/**
 * Instruction Registry
 *
 * Central registry that imports and manages all PVM instruction handlers.
 * Acts as a dispatcher for the PVM runtime.
 */


import {
  AND_INVInstruction,
  OR_INVInstruction,
  XNORInstruction,
} from './advanced-bitwise'
import {
  ADD_IMM_32Instruction,
  ADD_IMM_64Instruction,
  MUL_IMM_32Instruction,
  MUL_IMM_64Instruction,
} from './arithmetic'
import {
  ADD_32Instruction,
  DIV_S_32Instruction,
  DIV_U_32Instruction,
  MUL_32Instruction,
  REM_S_32Instruction,
  REM_U_32Instruction,
  SUB_32Instruction,
} from './arithmetic-32'
import {
  ADD_64Instruction,
  DIV_S_64Instruction,
  DIV_U_64Instruction,
  MUL_64Instruction,
  REM_S_64Instruction,
  REM_U_64Instruction,
  SUB_64Instruction,
} from './arithmetic-64'
import type { PVMInstructionHandler } from './base'
import {
  AND_IMMInstruction,
  OR_IMMInstruction,
  XOR_IMMInstruction,
} from './bitwise'
import {
  ANDInstruction,
  ORInstruction,
  XORInstruction,
} from './bitwise-register'
import {
  BRANCH_EQ_IMMInstruction,
  BRANCH_EQInstruction,
  BRANCH_GE_S_IMMInstruction,
  BRANCH_GE_SInstruction,
  BRANCH_GE_U_IMMInstruction,
  BRANCH_GE_UInstruction,
  BRANCH_GT_S_IMMInstruction,
  BRANCH_GT_U_IMMInstruction,
  BRANCH_LE_S_IMMInstruction,
  BRANCH_LE_U_IMMInstruction,
  BRANCH_LT_S_IMMInstruction,
  BRANCH_LT_SInstruction,
  BRANCH_LT_U_IMMInstruction,
  BRANCH_LT_UInstruction,
  BRANCH_NE_IMMInstruction,
  BRANCH_NEInstruction,
} from './branching'
import {
  SET_GT_S_IMMInstruction,
  SET_GT_U_IMMInstruction,
  SET_LT_S_IMMInstruction,
  SET_LT_U_IMMInstruction,
} from './comparison'
import { SET_LT_SInstruction, SET_LT_UInstruction } from './comparison-register'
import { CMOV_IZ_IMMInstruction, CMOV_NZ_IMMInstruction } from './conditional'
import { CMOV_IZInstruction, CMOV_NZInstruction } from './conditional-register'
// Import all instruction classes
import {
  FALLTHROUGHInstruction,
  JUMP_INDInstruction,
  JUMPInstruction,
  LOAD_IMM_JUMP_INDInstruction,
  LOAD_IMM_JUMPInstruction,
  TRAPInstruction,
} from './control-flow'
import {
  LOAD_I8Instruction,
  LOAD_I16Instruction,
  LOAD_I32Instruction,
  LOAD_IMM_64Instruction,
  LOAD_IMMInstruction,
  LOAD_U8Instruction,
  LOAD_U16Instruction,
  LOAD_U32Instruction,
  LOAD_U64Instruction,
  STORE_IMM_IND_U8Instruction,
  STORE_IMM_IND_U16Instruction,
  STORE_IMM_IND_U32Instruction,
  STORE_IMM_IND_U64Instruction,
  STORE_IMM_U8Instruction,
  STORE_IMM_U16Instruction,
  STORE_IMM_U32Instruction,
  STORE_IMM_U64Instruction,
  STORE_U8Instruction,
  STORE_U16Instruction,
  STORE_U32Instruction,
  STORE_U64Instruction,
} from './memory'
import {
  LOAD_IND_I8Instruction,
  LOAD_IND_I16Instruction,
  LOAD_IND_I32Instruction,
  LOAD_IND_U8Instruction,
  LOAD_IND_U16Instruction,
  LOAD_IND_U32Instruction,
  LOAD_IND_U64Instruction,
  STORE_IND_U8Instruction,
  STORE_IND_U16Instruction,
  STORE_IND_U32Instruction,
  STORE_IND_U64Instruction,
} from './memory-indirect'
import {
  MAX_UInstruction,
  MAXInstruction,
  MIN_UInstruction,
  MINInstruction,
} from './min-max'
import {
  MUL_UPPER_S_SInstruction,
  MUL_UPPER_S_UInstruction,
  MUL_UPPER_U_UInstruction,
} from './multiplication-upper'
import {
  COUNT_SET_BITS_32Instruction,
  COUNT_SET_BITS_64Instruction,
  LEADING_ZERO_BITS_32Instruction,
  LEADING_ZERO_BITS_64Instruction,
  MOVE_REGInstruction,
  REVERSE_BYTESInstruction,
  SBRKInstruction,
  SIGN_EXTEND_8Instruction,
  SIGN_EXTEND_16Instruction,
  TRAILING_ZERO_BITS_32Instruction,
  TRAILING_ZERO_BITS_64Instruction,
  ZERO_EXTEND_16Instruction,
} from './register'
import {
  ROT_L_32Instruction,
  ROT_L_64Instruction,
  ROT_R_32Instruction,
  ROT_R_64Instruction,
} from './rotation-register'
import {
  ROT_R_32_IMM_ALTInstruction,
  ROT_R_32_IMMInstruction,
  ROT_R_64_IMM_ALTInstruction,
  ROT_R_64_IMMInstruction,
} from './rotations'
import {
  NEG_ADD_IMM_32Instruction,
  SHAR_R_IMM_32Instruction,
  SHLO_L_IMM_32Instruction,
  SHLO_R_IMM_32Instruction,
} from './shifts'
import {
  SHAR_R_32Instruction,
  SHLO_L_32Instruction,
  SHLO_R_32Instruction,
} from './shifts-32-register'
import {
  NEG_ADD_IMM_64Instruction,
  SHAR_R_IMM_64Instruction,
  SHLO_L_IMM_64Instruction,
  SHLO_R_IMM_64Instruction,
} from './shifts-64'
import {
  SHAR_R_64Instruction,
  SHLO_L_64Instruction,
  SHLO_R_64Instruction,
} from './shifts-64-register'
import {
  SHAR_R_IMM_ALT_32Instruction,
  SHLO_L_IMM_ALT_32Instruction,
  SHLO_R_IMM_ALT_32Instruction,
} from './shifts-alt'
import {
  SHAR_R_IMM_ALT_64Instruction,
  SHLO_L_IMM_ALT_64Instruction,
  SHLO_R_IMM_ALT_64Instruction,
} from './shifts-alt-64'
import { ECALLIInstruction } from './system'

/**
 * Instruction Registry
 *
 * Singleton registry for all PVM instruction handlers.
 * Maps opcodes to their corresponding instruction implementations.
 */
export class InstructionRegistry {
  private handlers: Map<bigint, PVMInstructionHandler> = new Map()

  constructor() {
    this.registerInstructions()
  }
  /**
   * Register all instruction handlers
   */
  private registerInstructions(): void {
    // Control flow instructions
    this.register(new TRAPInstruction())
    this.register(new FALLTHROUGHInstruction())
    this.register(new JUMPInstruction())
    this.register(new JUMP_INDInstruction())
    this.register(new LOAD_IMM_JUMPInstruction())
    this.register(new LOAD_IMM_JUMP_INDInstruction())

    // System instructions
    this.register(new ECALLIInstruction())

    // Memory instructions
    this.register(new LOAD_IMM_64Instruction())
    this.register(new STORE_IMM_U8Instruction())
    this.register(new STORE_IMM_U16Instruction())
    this.register(new STORE_IMM_U32Instruction())
    this.register(new STORE_IMM_U64Instruction())
    this.register(new LOAD_IMMInstruction())
    this.register(new LOAD_U8Instruction())
    this.register(new LOAD_I8Instruction())
    this.register(new LOAD_U16Instruction())
    this.register(new LOAD_I16Instruction())
    this.register(new LOAD_U32Instruction())
    this.register(new LOAD_I32Instruction())
    this.register(new LOAD_U64Instruction())
    this.register(new STORE_U8Instruction())
    this.register(new STORE_U16Instruction())
    this.register(new STORE_U32Instruction())
    this.register(new STORE_U64Instruction())
    this.register(new STORE_IMM_IND_U8Instruction())
    this.register(new STORE_IMM_IND_U16Instruction())
    this.register(new STORE_IMM_IND_U32Instruction())
    this.register(new STORE_IMM_IND_U64Instruction())

    // Indirect memory instructions
    this.register(new STORE_IND_U8Instruction())
    this.register(new STORE_IND_U16Instruction())
    this.register(new STORE_IND_U32Instruction())
    this.register(new STORE_IND_U64Instruction())
    this.register(new LOAD_IND_U8Instruction())
    this.register(new LOAD_IND_I8Instruction())
    this.register(new LOAD_IND_U16Instruction())
    this.register(new LOAD_IND_I16Instruction())
    this.register(new LOAD_IND_U32Instruction())
    this.register(new LOAD_IND_I32Instruction())
    this.register(new LOAD_IND_U64Instruction())

    // Arithmetic instructions
    this.register(new ADD_IMM_32Instruction())
    this.register(new MUL_IMM_32Instruction())
    this.register(new ADD_IMM_64Instruction())
    this.register(new MUL_IMM_64Instruction())

    // Bitwise instructions
    this.register(new AND_IMMInstruction())
    this.register(new XOR_IMMInstruction())
    this.register(new OR_IMMInstruction())

    // Comparison instructions
    this.register(new SET_LT_U_IMMInstruction())
    this.register(new SET_LT_S_IMMInstruction())
    this.register(new SET_GT_U_IMMInstruction())
    this.register(new SET_GT_S_IMMInstruction())

    // Conditional instructions
    this.register(new CMOV_IZ_IMMInstruction())
    this.register(new CMOV_NZ_IMMInstruction())

    // Shift instructions
    this.register(new SHLO_L_IMM_32Instruction())
    this.register(new SHLO_R_IMM_32Instruction())
    this.register(new SHAR_R_IMM_32Instruction())
    this.register(new NEG_ADD_IMM_32Instruction())

    // Alternative shift instructions
    this.register(new SHLO_L_IMM_ALT_32Instruction())
    this.register(new SHLO_R_IMM_ALT_32Instruction())
    this.register(new SHAR_R_IMM_ALT_32Instruction())

    // 64-bit shift instructions
    this.register(new SHLO_L_IMM_64Instruction())
    this.register(new SHLO_R_IMM_64Instruction())
    this.register(new SHAR_R_IMM_64Instruction())
    this.register(new NEG_ADD_IMM_64Instruction())

    // Alternative 64-bit shift instructions
    this.register(new SHLO_L_IMM_ALT_64Instruction())
    this.register(new SHLO_R_IMM_ALT_64Instruction())
    this.register(new SHAR_R_IMM_ALT_64Instruction())

    // Rotation instructions
    this.register(new ROT_R_64_IMMInstruction())
    this.register(new ROT_R_64_IMM_ALTInstruction())
    this.register(new ROT_R_32_IMMInstruction())
    this.register(new ROT_R_32_IMM_ALTInstruction())

    // Branching instructions
    this.register(new BRANCH_EQ_IMMInstruction())
    this.register(new BRANCH_NE_IMMInstruction())
    this.register(new BRANCH_LT_U_IMMInstruction())
    this.register(new BRANCH_LE_U_IMMInstruction())
    this.register(new BRANCH_GE_U_IMMInstruction())
    this.register(new BRANCH_GT_U_IMMInstruction())
    this.register(new BRANCH_LT_S_IMMInstruction())
    this.register(new BRANCH_LE_S_IMMInstruction())
    this.register(new BRANCH_GE_S_IMMInstruction())
    this.register(new BRANCH_GT_S_IMMInstruction())

    // Register-based branching instructions
    this.register(new BRANCH_EQInstruction())
    this.register(new BRANCH_NEInstruction())
    this.register(new BRANCH_LT_UInstruction())
    this.register(new BRANCH_LT_SInstruction())
    this.register(new BRANCH_GE_UInstruction())
    this.register(new BRANCH_GE_SInstruction())

    // 32-bit arithmetic instructions
    this.register(new ADD_32Instruction())
    this.register(new SUB_32Instruction())
    this.register(new MUL_32Instruction())
    this.register(new DIV_U_32Instruction())
    this.register(new DIV_S_32Instruction())
    this.register(new REM_U_32Instruction())
    this.register(new REM_S_32Instruction())

    // 32-bit shift instructions
    this.register(new SHLO_L_32Instruction())
    this.register(new SHLO_R_32Instruction())
    this.register(new SHAR_R_32Instruction())

    // 64-bit arithmetic instructions
    this.register(new ADD_64Instruction())
    this.register(new SUB_64Instruction())
    this.register(new MUL_64Instruction())
    this.register(new DIV_U_64Instruction())
    this.register(new DIV_S_64Instruction())
    this.register(new REM_U_64Instruction())
    this.register(new REM_S_64Instruction())

    // 64-bit shift instructions
    this.register(new SHLO_L_64Instruction())
    this.register(new SHLO_R_64Instruction())
    this.register(new SHAR_R_64Instruction())

    // Bitwise instructions
    this.register(new ANDInstruction())
    this.register(new XORInstruction())
    this.register(new ORInstruction())

    // Multiplication upper bits instructions
    this.register(new MUL_UPPER_S_SInstruction())
    this.register(new MUL_UPPER_U_UInstruction())
    this.register(new MUL_UPPER_S_UInstruction())

    // Comparison instructions
    this.register(new SET_LT_UInstruction())
    this.register(new SET_LT_SInstruction())

    // Conditional move instructions
    this.register(new CMOV_IZInstruction())
    this.register(new CMOV_NZInstruction())

    // Rotation instructions
    this.register(new ROT_L_64Instruction())
    this.register(new ROT_L_32Instruction())
    this.register(new ROT_R_64Instruction())
    this.register(new ROT_R_32Instruction())

    // Advanced bitwise instructions
    this.register(new AND_INVInstruction())
    this.register(new OR_INVInstruction())
    this.register(new XNORInstruction())

    // Min/Max instructions
    this.register(new MINInstruction())
    this.register(new MIN_UInstruction())
    this.register(new MAXInstruction())
    this.register(new MAX_UInstruction())

    // Register operations
    this.register(new MOVE_REGInstruction())
    this.register(new SBRKInstruction())
    this.register(new COUNT_SET_BITS_64Instruction())
    this.register(new COUNT_SET_BITS_32Instruction())
    this.register(new LEADING_ZERO_BITS_64Instruction())
    this.register(new LEADING_ZERO_BITS_32Instruction())
    this.register(new TRAILING_ZERO_BITS_64Instruction())
    this.register(new TRAILING_ZERO_BITS_32Instruction())
    this.register(new SIGN_EXTEND_8Instruction())
    this.register(new SIGN_EXTEND_16Instruction())
    this.register(new ZERO_EXTEND_16Instruction())
    this.register(new REVERSE_BYTESInstruction())
  }

  /**
   * Register an instruction handler
   */
  register(handler: PVMInstructionHandler): void {
    this.handlers.set(handler.opcode, handler)
  }

  /**
   * Get instruction handler by opcode
   */
  getHandler(opcode: bigint): PVMInstructionHandler | undefined {
    return this.handlers.get(opcode)
  }

  /**
   * Check if opcode is registered
   */
  hasHandler(opcode: bigint): boolean {
    return this.handlers.has(opcode)
  }

  /**
   * Get all registered opcodes
   */
  getRegisteredOpcodes(): bigint[] {
    return Array.from(this.handlers.keys())
  }

  /**
   * Get all registered handlers
   */
  getAllHandlers(): PVMInstructionHandler[] {
    return Array.from(this.handlers.values())
  }

  /**
   * Clear all handlers (for testing)
   */
  clear(): void {
    this.handlers.clear()
  }
}
