/**
 * Gas metering implementation for PVM
 *
 * Implements gas metering as specified in Gray Paper
 */

import { logger } from '@pbnj/core'
import type { Gas } from '@pbnj/types'
import { PVM_CONSTANTS } from '@pbnj/types'

/**
 * Gas costs for PVM instructions as specified in the Gray Paper
 * Most instructions cost 1 gas unit, but some may have different costs
 */
export const INSTRUCTION_GAS_COSTS: Record<number, Gas> = {
  // Basic instructions (all cost 1 gas)
  0x00: 1n, // trap
  0x01: 1n, // fallthrough

  // Host call instruction
  0x10: 1n, // ecalli

  // Load immediate instructions
  0x20: 1n, // load_imm_64

  // Store immediate instructions
  0x30: 1n, // store_imm_u8
  0x31: 1n, // store_imm_u16
  0x32: 1n, // store_imm_u32
  0x33: 1n, // store_imm_u64

  // Jump instructions
  0x40: 1n, // jump

  // Register and immediate instructions
  0x50: 1n, // jump_ind
  0x51: 1n, // load_imm
  0x52: 1n, // load_u8
  0x53: 1n, // load_i8
  0x54: 1n, // load_u16
  0x55: 1n, // load_i16
  0x56: 1n, // load_u32
  0x57: 1n, // load_i32
  0x58: 1n, // load_u64
  0x59: 1n, // store_u8
  0x60: 1n, // store_u16
  0x61: 1n, // store_u32
  0x62: 1n, // store_u64

  // Store immediate indirect instructions
  0x70: 1n, // store_imm_ind_u8
  0x71: 1n, // store_imm_ind_u16
  0x72: 1n, // store_imm_ind_u32
  0x73: 1n, // store_imm_ind_u64

  // Load immediate jump and branch instructions
  0x80: 1n, // load_imm_jump
  0x81: 1n, // branch_eq_imm
  0x82: 1n, // branch_ne_imm
  0x83: 1n, // branch_lt_u_imm
  0x84: 1n, // branch_le_u_imm
  0x85: 1n, // branch_ge_u_imm
  0x86: 1n, // branch_gt_u_imm
  0x87: 1n, // branch_lt_s_imm
  0x88: 1n, // branch_le_s_imm
  0x89: 1n, // branch_ge_s_imm
  0x8a: 1n, // branch_gt_s_imm

  // Two register instructions
  0x64: 1n, // move_reg
  0x65: 1n, // sbrk
  0x66: 1n, // count_set_bits_64
  0x67: 1n, // count_set_bits_32
  0x68: 1n, // leading_zero_bits_64
  0x69: 1n, // leading_zero_bits_32
  0x6a: 1n, // trailing_zero_bits_64
  0x6b: 1n, // trailing_zero_bits_32
  0x6c: 1n, // sign_extend_8
  0x6d: 1n, // sign_extend_16
  0x6e: 1n, // zero_extend_16
  0x6f: 1n, // reverse_bytes

  // Two register and immediate instructions
  0x78: 1n, // store_ind_u8
  0x79: 1n, // store_ind_u16
  0x7a: 1n, // store_ind_u32
  0x7b: 1n, // store_ind_u64
  0x7c: 1n, // load_ind_u8
  0x7d: 1n, // load_ind_i8
  0x7e: 1n, // load_ind_u16
  0x7f: 1n, // load_ind_i16
  0x90: 1n, // load_ind_u32
  0x91: 1n, // load_ind_i32
  0x92: 1n, // load_ind_u64
  0x93: 1n, // add_imm_32
  0x94: 1n, // and_imm
  0x95: 1n, // xor_imm
  0x96: 1n, // or_imm
  0x97: 1n, // mul_imm_32
  0x98: 1n, // set_lt_u_imm
  0x99: 1n, // set_lt_s_imm
  0x9a: 1n, // shlo_l_imm_32
  0x9b: 1n, // shlo_r_imm_32
}

/**
 * Get gas cost for an instruction
 */
export function getInstructionGasCost(opcode: number): Gas {
  return INSTRUCTION_GAS_COSTS[opcode] || PVM_CONSTANTS.MIN_GAS_COST
}

/**
 * Calculate total gas cost for a sequence of instructions
 */
export function calculateTotalGasCost(
  instructions: Array<{ opcode: number }>,
): Gas {
  return instructions.reduce((total, instruction) => {
    return total + getInstructionGasCost(instruction.opcode)
  }, 0n)
}

/**
 * Check if gas limit is sufficient for instructions
 */
export function isGasSufficient(
  instructions: Array<{ opcode: number }>,
  gasLimit: Gas,
): boolean {
  const requiredGas = calculateTotalGasCost(instructions)
  return requiredGas <= gasLimit
}

/**
 * Gas metering utilities for memory access
 */
export const MEMORY_GAS_COSTS = {
  // Base cost for memory access
  BASE_READ_COST: 1n,
  BASE_WRITE_COST: 1n,

  // Additional cost per octet accessed
  PER_OCTET_COST: 1n,

  // Cost for memory allocation (sbrk)
  ALLOCATION_COST: 1n,
} as const

/**
 * Calculate gas cost for memory read operation
 */
export function calculateMemoryReadCost(_address: number, size: number): Gas {
  return (
    MEMORY_GAS_COSTS.BASE_READ_COST +
    BigInt(size) * MEMORY_GAS_COSTS.PER_OCTET_COST
  )
}

/**
 * Calculate gas cost for memory write operation
 */
export function calculateMemoryWriteCost(_address: number, size: number): Gas {
  return (
    MEMORY_GAS_COSTS.BASE_WRITE_COST +
    BigInt(size) * MEMORY_GAS_COSTS.PER_OCTET_COST
  )
}

/**
 * Calculate gas cost for memory allocation
 */
export function calculateAllocationCost(size: number): Gas {
  return (
    MEMORY_GAS_COSTS.ALLOCATION_COST +
    BigInt(size) * MEMORY_GAS_COSTS.PER_OCTET_COST
  )
}
