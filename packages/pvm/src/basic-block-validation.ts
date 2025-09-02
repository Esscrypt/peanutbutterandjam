/**
 * Basic Block Validation Implementation
 *
 * Validates that jumps target valid basic block starts
 * as required by the Gray Paper specifications
 */

import { logger } from '@pbnj/core'
import type { BasicBlock, JumpTableEntry } from '@pbnj/types'

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
  analyzeBasicBlocks(instructionData: Uint8Array): BasicBlock[] {
    const basicBlocks: BasicBlock[] = []
    let currentBlockStart = 0n
    let currentInstructions: Uint8Array = new Uint8Array()

    for (let i = 0n; i < BigInt(instructionData.length); i++) {
      const opcode = instructionData[Number(i)]
      currentInstructions.set([opcode], Number(i))

      // Check if this instruction is a jump or halt
      if (
        this.isJumpInstruction(BigInt(opcode)) ||
        this.isHaltInstruction(BigInt(opcode))
      ) {
        // End current basic block
        basicBlocks.push({
          startAddress: currentBlockStart,
          endAddress: i + 1n,
          instructions: new Uint8Array(currentInstructions),
        })

        // Start new basic block at next instruction (if any)
        if (i + 1n < BigInt(instructionData.length)) {
          currentBlockStart = i + 1n
          currentInstructions = new Uint8Array()
        }
      }
    }

    // Add final block if there are remaining instructions
    if (currentInstructions.length > 0) {
      basicBlocks.push({
        startAddress: currentBlockStart,
        endAddress: BigInt(instructionData.length),
        instructions: new Uint8Array(currentInstructions),
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
    instructionData: Uint8Array,
    basicBlocks: BasicBlock[],
  ): JumpTableEntry[] {
    const jumpEntries: JumpTableEntry[] = []
    const validTargets = new Set(basicBlocks.map((block) => block.startAddress))

    for (let i = 0n; i < BigInt(instructionData.length); i++) {
      const opcode = instructionData[Number(i)]

      if (this.isJumpInstruction(BigInt(opcode))) {
        const targetAddress = this.extractJumpTarget(
          instructionData,
          i,
          BigInt(opcode),
        )

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
  validateAllJumps(instructionData: Uint8Array): boolean {
    const basicBlocks = this.analyzeBasicBlocks(instructionData)
    const jumpEntries = this.validateJumpTargets(instructionData, basicBlocks)

    return jumpEntries.every((entry) => entry.isValid)
  }

  /**
   * Check if instruction is a jump instruction
   */
  private isJumpInstruction(opcode: bigint): boolean {
    // Jump instructions: JUMP, JUMP_IF, JUMP_IF_NOT, CALL
    return [0x04n, 0x05n, 0x06n, 0x03n].includes(opcode)
  }

  /**
   * Check if instruction is a halt instruction
   */
  private isHaltInstruction(opcode: bigint): boolean {
    // Halt instruction: HALT
    return opcode === 0x01n
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
    instructionData: Uint8Array,
    instructionIndex: bigint,
    opcode: bigint,
  ): bigint | null {
    try {
      switch (opcode) {
        case 0x04n: // JUMP
          // JUMP has immediate target address
          if (instructionIndex + 1n < BigInt(instructionData.length)) {
            return BigInt(instructionData[Number(instructionIndex + 1n)])
          }
          break

        case 0x05n: // JUMP_IF
        case 0x06n: // JUMP_IF_NOT
          // Conditional jumps have immediate target address
          if (instructionIndex + 1n < BigInt(instructionData.length)) {
            return BigInt(instructionData[Number(instructionIndex + 1n)])
          }
          break

        case 0x03n: // CALL
          // CALL has immediate target address
          if (instructionIndex + 1n < BigInt(instructionData.length)) {
            return BigInt(instructionData[Number(instructionIndex + 1n)])
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
