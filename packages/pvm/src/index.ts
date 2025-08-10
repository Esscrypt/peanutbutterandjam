/**
 * PVM Package Exports
 *
 * Gray Paper compliant Polkadot Virtual Machine implementation
 */

// Logger
export { logger } from '@pbnj/core'
// Re-export types from centralized types package
export * from '@pbnj/types'
// Argument invocation system
export { ArgumentInvocationSystem } from './argument-invocation'
// Basic block validation
export { BasicBlockValidator } from './basic-block-validation'
export { PVMCallStack } from './call-stack'
// Configuration constants
export {
  DEFAULTS,
  FAULT_TYPES,
  GAS_CONFIG,
  INIT_CONFIG,
  INSTRUCTION_CONFIG,
  INSTRUCTION_GAS_COSTS,
  INSTRUCTION_LENGTHS,
  MEMORY_CONFIG,
  MEMORY_GAS_COSTS,
  OPCODES,
  REGISTER_CONFIG,
  RESULT_CODES,
} from './config'
// Gas metering utilities
export {
  calculateAllocationCost,
  calculateMemoryReadCost,
  calculateMemoryWriteCost,
  calculateTotalGasCost,
  getInstructionGasCost,
  isGasSufficient,
} from './gas-metering'
// Host call system
export { DefaultHostCallHandler, HostCallSystem } from './host-call'
// Advanced bitwise instructions
export {
  AND_INVInstruction,
  OR_INVInstruction,
  XNORInstruction,
} from './instructions/advanced-bitwise'
// Arithmetic instructions
export {
  ADD_IMM_32Instruction,
  ADD_IMM_64Instruction,
  MUL_IMM_32Instruction,
  MUL_IMM_64Instruction,
} from './instructions/arithmetic'
// 32-bit arithmetic instructions
export {
  ADD_32Instruction,
  DIV_S_32Instruction,
  DIV_U_32Instruction,
  MUL_32Instruction,
  REM_S_32Instruction,
  REM_U_32Instruction,
  SUB_32Instruction,
} from './instructions/arithmetic-32'
// 64-bit arithmetic instructions
export {
  ADD_64Instruction,
  DIV_S_64Instruction,
  DIV_U_64Instruction,
  MUL_64Instruction,
  REM_S_64Instruction,
  REM_U_64Instruction,
  SUB_64Instruction,
} from './instructions/arithmetic-64'
export type { PVMInstructionHandler } from './instructions/base'
// Bitwise instructions
export {
  AND_IMMInstruction,
  OR_IMMInstruction,
  XOR_IMMInstruction,
} from './instructions/bitwise'
// Bitwise instructions
export {
  ANDInstruction,
  ORInstruction,
  XORInstruction,
} from './instructions/bitwise-register'
// Branching instructions
export {
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
} from './instructions/branching'
// Comparison instructions
export {
  SET_GT_S_IMMInstruction,
  SET_GT_U_IMMInstruction,
  SET_LT_S_IMMInstruction,
  SET_LT_U_IMMInstruction,
} from './instructions/comparison'
// Comparison instructions
export {
  SET_LT_SInstruction,
  SET_LT_UInstruction,
} from './instructions/comparison-register'
// Conditional instructions
export {
  CMOV_IZ_IMMInstruction,
  CMOV_NZ_IMMInstruction,
} from './instructions/conditional'
// Conditional move instructions
export {
  CMOV_IZInstruction,
  CMOV_NZInstruction,
} from './instructions/conditional-register'
// Control flow instructions
export {
  FALLTHROUGHInstruction,
  JUMP_INDInstruction,
  JUMPInstruction,
  LOAD_IMM_JUMP_INDInstruction,
  LOAD_IMM_JUMPInstruction,
  TRAPInstruction,
} from './instructions/control-flow'
// Memory instructions
export {
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
} from './instructions/memory'
// Indirect memory instructions
export {
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
} from './instructions/memory-indirect'
// Min/Max instructions
export {
  MAX_UInstruction,
  MAXInstruction,
  MIN_UInstruction,
  MINInstruction,
} from './instructions/min-max'
// Multiplication upper bits instructions
export {
  MUL_UPPER_S_SInstruction,
  MUL_UPPER_S_UInstruction,
  MUL_UPPER_U_UInstruction,
} from './instructions/multiplication-upper'
// Register operations
export {
  COUNT_SET_BITS_32Instruction,
  COUNT_SET_BITS_64Instruction,
  LEADING_ZERO_BITS_32Instruction,
  LEADING_ZERO_BITS_64Instruction,
  MOVE_REGInstruction,
  REVERSE_Uint8ArrayInstruction,
  SBRKInstruction,
  SIGN_EXTEND_8Instruction,
  SIGN_EXTEND_16Instruction,
  TRAILING_ZERO_BITS_32Instruction,
  TRAILING_ZERO_BITS_64Instruction,
  ZERO_EXTEND_16Instruction,
} from './instructions/register'
// Instruction registry and handlers
export { InstructionRegistry } from './instructions/registry'
// Rotation instructions
export {
  ROT_L_32Instruction,
  ROT_L_64Instruction,
  ROT_R_32Instruction,
  ROT_R_64Instruction,
} from './instructions/rotation-register'
// Rotation instructions
export {
  ROT_R_32_IMM_ALTInstruction,
  ROT_R_32_IMMInstruction,
  ROT_R_64_IMM_ALTInstruction,
  ROT_R_64_IMMInstruction,
} from './instructions/rotations'
// Shift instructions
export {
  NEG_ADD_IMM_32Instruction,
  SHAR_R_IMM_32Instruction,
  SHLO_L_IMM_32Instruction,
  SHLO_R_IMM_32Instruction,
} from './instructions/shifts'
// 32-bit shift instructions
export {
  SHAR_R_32Instruction,
  SHLO_L_32Instruction,
  SHLO_R_32Instruction,
} from './instructions/shifts-32-register'
// 64-bit shift instructions
export {
  NEG_ADD_IMM_64Instruction,
  SHAR_R_IMM_64Instruction,
  SHLO_L_IMM_64Instruction,
  SHLO_R_IMM_64Instruction,
} from './instructions/shifts-64'
// 64-bit shift instructions
export {
  SHAR_R_64Instruction,
  SHLO_L_64Instruction,
  SHLO_R_64Instruction,
} from './instructions/shifts-64-register'
// Alternative shift instructions
export {
  SHAR_R_IMM_ALT_32Instruction,
  SHLO_L_IMM_ALT_32Instruction,
  SHLO_R_IMM_ALT_32Instruction,
} from './instructions/shifts-alt'
// Alternative 64-bit shift instructions
export {
  SHAR_R_IMM_ALT_64Instruction,
  SHLO_L_IMM_ALT_64Instruction,
  SHLO_R_IMM_ALT_64Instruction,
} from './instructions/shifts-alt-64'
// System instructions
export { ECALLIInstruction } from './instructions/system'
// Accumulate invocation system
export { AccumulateInvocationSystem } from './invocations/accumulate'
// Is-Authorized invocation system
export { IsAuthorizedInvocationSystem } from './invocations/is-authorized'
// Refine invocation system
export { RefineInvocationSystem } from './invocations/refine'
// Program initialization
export { ProgramInitializer } from './program-init'
// Core PVM runtime
export { PVM } from './pvm'
// RAM and Call Stack implementations
export { PVMRAM } from './ram'
