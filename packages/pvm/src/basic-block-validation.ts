/**
 * Basic Block Validation Implementation
 *
 * Validates that jumps target valid basic block starts
 * as required by the Gray Paper specifications
 */

import { logger } from '@pbnj/core'
import type { BasicBlock, JumpTableEntry } from './types'

/**
 * Basic Block Validator
 *
 * Analyzes instruction data to identify basic blocks and validate jump targets
 */
export class BasicBlockValidator {
  /**
   * Analyze instruction data to identify basic blocks
   *
   * @param instructionData - Program instruction data
   * @returns Array of basic blocks
   */
  analyzeBasicBlocks(instructionData: number[]): BasicBlock[] {
    const basicBlocks: BasicBlock[] = []
    let currentBlockStart = 0
    let currentInstructions: number[] = []

    for (let i = 0; i < instructionData.length; i++) {
      const opcode = instructionData[i]
      currentInstructions.push(opcode)

      // Check if this instruction is a jump or halt
      if (this.isJumpInstruction(opcode) || this.isHaltInstruction(opcode)) {
        // End current basic block
        basicBlocks.push({
          startAddress: currentBlockStart,
          endAddress: i + 1,
          instructions: [...currentInstructions],
        })

        // Start new basic block at next instruction (if any)
        if (i + 1 < instructionData.length) {
          currentBlockStart = i + 1
          currentInstructions = []
        }
      }
    }

    // Add final block if there are remaining instructions
    if (currentInstructions.length > 0) {
      basicBlocks.push({
        startAddress: currentBlockStart,
        endAddress: instructionData.length,
        instructions: currentInstructions,
      })
    }

    return basicBlocks
  }

  /**
   * Validate jump targets against basic blocks
   *
   * @param instructionData - Program instruction data
   * @param basicBlocks - Identified basic blocks
   * @returns Array of jump table entries with validation results
   */
  validateJumpTargets(
    instructionData: number[],
    basicBlocks: BasicBlock[],
  ): JumpTableEntry[] {
    const jumpEntries: JumpTableEntry[] = []
    const validTargets = new Set(basicBlocks.map((block) => block.startAddress))

    for (let i = 0; i < instructionData.length; i++) {
      const opcode = instructionData[i]

      if (this.isJumpInstruction(opcode)) {
        const targetAddress = this.extractJumpTarget(instructionData, i, opcode)

        if (targetAddress !== null) {
          const isValid = validTargets.has(targetAddress)

          jumpEntries.push({
            address: i,
            targetAddress,
            isValid,
          })

          if (!isValid) {
            logger.warn('Invalid jump target', {
              jumpAddress: i,
              targetAddress,
              validTargets: Array.from(validTargets),
            })
          }
        }
      }
    }

    return jumpEntries
  }

  /**
   * Check if all jumps target valid basic block starts
   *
   * @param instructionData - Program instruction data
   * @returns True if all jumps are valid, false otherwise
   */
  validateAllJumps(instructionData: number[]): boolean {
    const basicBlocks = this.analyzeBasicBlocks(instructionData)
    const jumpEntries = this.validateJumpTargets(instructionData, basicBlocks)

    return jumpEntries.every((entry) => entry.isValid)
  }

  /**
   * Check if instruction is a jump instruction
   */
  private isJumpInstruction(opcode: number): boolean {
    // Jump instructions: JUMP, JUMP_IF, JUMP_IF_NOT, CALL
    return [0x04, 0x05, 0x06, 0x03].includes(opcode)
  }

  /**
   * Check if instruction is a halt instruction
   */
  private isHaltInstruction(opcode: number): boolean {
    // Halt instruction: HALT
    return opcode === 0x01
  }

  /**
   * Extract jump target address from instruction
   *
   * @param instructionData - Program instruction data
   * @param instructionIndex - Index of jump instruction
   * @param opcode - Jump instruction opcode
   * @returns Target address or null if invalid
   */
  private extractJumpTarget(
    instructionData: number[],
    instructionIndex: number,
    opcode: number,
  ): number | null {
    try {
      switch (opcode) {
        case 0x04: // JUMP
          // JUMP has immediate target address
          if (instructionIndex + 1 < instructionData.length) {
            return instructionData[instructionIndex + 1]
          }
          break

        case 0x05: // JUMP_IF
        case 0x06: // JUMP_IF_NOT
          // Conditional jumps have immediate target address
          if (instructionIndex + 1 < instructionData.length) {
            return instructionData[instructionIndex + 1]
          }
          break

        case 0x03: // CALL
          // CALL has immediate target address
          if (instructionIndex + 1 < instructionData.length) {
            return instructionData[instructionIndex + 1]
          }
          break
      }
    } catch (error) {
      logger.error('Error extracting jump target', {
        error,
        instructionIndex,
        opcode,
      })
    }

    return null
  }
}
