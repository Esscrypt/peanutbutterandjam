/**
 * Gas Cost Model Helpers
 *
 * Helper functions for managing gas costs in the new gas cost model.
 * The new model charges gas at the start of basic blocks instead of per instruction.
 */

import type { PVMInstruction } from '@pbnjam/types'
import { isTerminationInstruction } from './config'
import type { NewGasCostCalculator } from './gas-cost-calculator'

/**
 * Check if we're entering a new basic block
 *
 * @param currentPc - Current program counter
 * @param currentBasicBlockPc - PC of the current basic block (null if not in a block)
 * @returns true if entering a new basic block
 */
export function isEnteringNewBasicBlock(
  currentPc: number,
  currentBasicBlockPc: bigint | null,
): boolean {
  return (
    currentBasicBlockPc === null || currentBasicBlockPc !== BigInt(currentPc)
  )
}

/**
 * Charge gas for a basic block (new gas cost model)
 *
 * @param gasCostCalculator - Gas cost calculator instance
 * @param instructionsWithPc - Parsed instructions with their PCs
 * @param currentPc - Current program counter
 * @param gasCounter - Current gas counter (will be modified)
 * @returns Tuple of (success, blockCost) where success indicates if we had enough gas
 */
export function chargeGasForBasicBlock(
  gasCostCalculator: NewGasCostCalculator,
  instructionsWithPc: Array<{ instruction: PVMInstruction; pc: number }>,
  currentPc: number,
  gasCounter: bigint,
): { success: boolean; blockCost: number; newGasCounter: bigint } {
  // #region agent log
  fetch('http://127.0.0.1:10000/ingest/3fca1dc3-0561-4f6b-af77-e67afc81f2d7', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      location: 'gas-cost-helpers.ts:35',
      message: 'chargeGasForBasicBlock entry',
      data: { currentPc, gasBefore: gasCounter.toString() },
      timestamp: Date.now(),
      sessionId: 'debug-session',
      runId: 'run1',
      hypothesisId: 'B',
    }),
  }).catch(() => {})
  // #endregion
  // Calculate using the calculator
  const blocks = gasCostCalculator.identifyBasicBlocks(instructionsWithPc)
  const currentBlock = blocks.find((block) => block.startPc === currentPc)

  if (!currentBlock) {
    // #region agent log
    fetch(
      'http://127.0.0.1:10000/ingest/3fca1dc3-0561-4f6b-af77-e67afc81f2d7',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'gas-cost-helpers.ts:45',
          message: 'block not found fallback',
          data: { currentPc },
          timestamp: Date.now(),
          sessionId: 'debug-session',
          runId: 'run1',
          hypothesisId: 'D',
        }),
      },
    ).catch(() => {})
    // #endregion
    // Fallback: charge 1 gas if block not found
    if (gasCounter < 1n) {
      return { success: false, blockCost: 1, newGasCounter: gasCounter }
    }
    return { success: true, blockCost: 1, newGasCounter: gasCounter - 1n }
  }

  // #region agent log
  fetch('http://127.0.0.1:10000/ingest/3fca1dc3-0561-4f6b-af77-e67afc81f2d7', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      location: 'gas-cost-helpers.ts:52',
      message: 'block found',
      data: {
        startPc: currentBlock.startPc,
        instructionCount: currentBlock.instructions.length,
        hasUnlikely: currentBlock.hasUnlikely,
      },
      timestamp: Date.now(),
      sessionId: 'debug-session',
      runId: 'run1',
      hypothesisId: 'B',
    }),
  }).catch(() => {})
  // #endregion

  const blockCost = gasCostCalculator.calculateBlockCost(currentBlock)

  // #region agent log
  fetch('http://127.0.0.1:10000/ingest/3fca1dc3-0561-4f6b-af77-e67afc81f2d7', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      location: 'gas-cost-helpers.ts:55',
      message: 'block cost calculated',
      data: {
        blockCost,
        hasUnlikely: currentBlock.hasUnlikely,
        gasBefore: gasCounter.toString(),
      },
      timestamp: Date.now(),
      sessionId: 'debug-session',
      runId: 'run1',
      hypothesisId: 'A',
    }),
  }).catch(() => {})
  // #endregion

  // Check if we have enough gas for the block
  if (gasCounter < BigInt(blockCost)) {
    return { success: false, blockCost, newGasCounter: gasCounter }
  }

  // Charge gas for the entire block
  const newGasCounter = gasCounter - BigInt(blockCost)
  // #region agent log
  fetch('http://127.0.0.1:10000/ingest/3fca1dc3-0561-4f6b-af77-e67afc81f2d7', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      location: 'gas-cost-helpers.ts:64',
      message: 'gas charged',
      data: {
        blockCost,
        gasBefore: gasCounter.toString(),
        gasAfter: newGasCounter.toString(),
      },
      timestamp: Date.now(),
      sessionId: 'debug-session',
      runId: 'run1',
      hypothesisId: 'A',
    }),
  }).catch(() => {})
  // #endregion
  return {
    success: true,
    blockCost,
    newGasCounter,
  }
}

/**
 * Check if an instruction is a basic block terminator
 *
 * Gray Paper (pvm.tex §7.2): Basic block termination is determined by instruction opcode,
 * not by execution result. Termination instructions (set T) include:
 * - trap, fallthrough
 * - jump, jump_ind
 * - load_imm_jump, load_imm_jump_ind
 * - branch_eq, branch_ne, branch_ge_u, branch_ge_s, branch_lt_u, branch_lt_s
 * - branch_eq_imm, branch_ne_imm
 * - branch_lt_u_imm, branch_lt_s_imm, branch_le_u_imm, branch_le_s_imm
 * - branch_ge_u_imm, branch_ge_s_imm, branch_gt_u_imm, branch_gt_s_imm
 *
 * @param instruction - PVM instruction to check
 * @returns true if this instruction terminates a basic block
 */
export function isBasicBlockTerminator(instruction: PVMInstruction): boolean {
  return isTerminationInstruction(instruction.opcode)
}
