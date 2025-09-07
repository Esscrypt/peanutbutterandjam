/**
 * Block Submitter
 *
 * Submits blocks to the network according to JAM Protocol specifications
 * Reference: Gray Paper block submission specifications
 */

import { logger, type SafePromise, safeError, safeResult } from '@pbnj/core'
import { calculateBlockHash, encodeBlock } from '@pbnj/serialization'
import type { Block, BlockAuthoringConfig, SubmissionResult } from '@pbnj/types'
import { PropagationStatus } from '@pbnj/types'
import { BaseService } from '../interfaces/service'

/**
 * Block Submitter
 */
export class BlockSubmitter extends BaseService {
  /**
   * Submit block to network
   */
  async submit(
    block: Block,
    _config: BlockAuthoringConfig,
  ): SafePromise<SubmissionResult> {
    logger.debug('Submitting block', {
      blockSlot: block.header.timeslot,
    })

    // Validate block before submission
    const validationResult = this.validateBlock(block)
    if (!validationResult.valid) {
      logger.error('Block validation failed', {
        blockSlot: block.header.timeslot,
        errors: validationResult.errors,
      })

      return safeError(new Error('Block validation failed'))
    }

    // Serialize block according to Gray Paper specifications
    const [serializedBlockError, serializedBlock] = encodeBlock(block)
    if (serializedBlockError) {
      return safeError(serializedBlockError)
    }

    // Submit to network peers
    const submissionResult = await this.submitToNetwork(
      serializedBlock,
      block.header.timeslot,
    )

    if (!submissionResult.success) {
      return safeError(
        new Error(`Network submission failed: ${submissionResult.error}`),
      )
    }

    const [blockHashError, blockHash] = calculateBlockHash(block)
    if (blockHashError) {
      return safeError(blockHashError)
    }

    return safeResult({
      blockHash,
      propagationStatus: PropagationStatus.CONFIRMED,
    })

    // const submissionError: BlockAuthoringError = {
    //   type: BlockAuthoringErrorType.SUBMISSION_FAILED,
    //   message: 'Block submission failed',
    //   details: {
    //     error: error instanceof Error ? error.message : String(error),
    //   },
    //   recoverable: true,
    // }
  }

  /**
   * Validate block before submission
   */
  private validateBlock(block: Block): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    // Validate block header
    if (!block.header.timeslot || block.header.timeslot <= 0) {
      errors.push('Invalid block number')
    }

    if (!block.header.parent || block.header.parent.length !== 66) {
      // 0x + 64 hex chars
      errors.push('Invalid parent hash')
    }

    if (
      !block.header.priorStateRoot ||
      block.header.priorStateRoot.length !== 66
    ) {
      errors.push('Invalid state root')
    }

    if (
      !block.header.extrinsicHash ||
      block.header.extrinsicHash.length !== 66
    ) {
      errors.push('Invalid extrinsics root')
    }

    if (!block.header.timeslot || block.header.timeslot <= 0) {
      errors.push('Invalid timestamp')
    }

    if (block.header.authorIndex < 0) {
      errors.push('Invalid author index')
    }

    // Validate block body
    if (!Array.isArray(block.body)) {
      errors.push('Invalid block body')
    }

    // Check extrinsic limits
    // if (block.body.extrinsics.length > 1000) {
    //   // TODO: Get from config
    //   errors.push('Too many extrinsics')
    // }

    return {
      valid: errors.length === 0,
      errors,
    }
  }

  /**
   * Submit block to network peers
   */
  private async submitToNetwork(
    serializedBlock: Uint8Array,
    blockNumber: bigint,
  ): Promise<{ success: boolean; error?: string; peerCount: number }> {
    logger.debug('Submitting to network peers', {
      blockNumber,
      blockSize: serializedBlock.length,
    })

    try {
      // TODO: Implement actual network submission
      // This would involve:
      // 1. Discovering network peers
      // 2. Sending block to each peer
      // 3. Waiting for acknowledgments
      // 4. Handling timeouts and retries

      // Simulate network submission
      const peerCount = Math.floor(Math.random() * 50) + 10 // 10-60 peers
      const successRate = 0.95 // 95% success rate

      // Simulate network latency
      const latency = Math.random() * 200 + 100 // 100-300ms
      await new Promise((resolve) => setTimeout(resolve, latency))

      // Simulate occasional failures
      if (Math.random() > successRate) {
        return {
          success: false,
          error: 'Network submission failed',
          peerCount: 0,
        }
      }

      return {
        success: true,
        peerCount,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        peerCount: 0,
      }
    }
  }

  /**
   * Check block propagation status
   */
  checkPropagationStatus(_blockHash: string): PropagationStatus {
    // TODO: Implement actual propagation status checking
    // This would involve:
    // 1. Querying network peers
    // 2. Checking block inclusion
    // 3. Monitoring propagation

    // Simulate propagation status
    return PropagationStatus.CONFIRMED
  }

  /**
   * Retry block submission
   */
  async retrySubmission(
    block: Block,
    config: BlockAuthoringConfig,
    retryCount: number,
  ): SafePromise<SubmissionResult> {
    logger.debug('Retrying block submission', {
      blockSlot: block.header.timeslot,
      retryCount,
    })

    if (retryCount >= 3) {
      return safeError(new Error('Max retry attempts exceeded'))
    }

    // Wait before retry
    const delay = 2 ** retryCount * 1000 // Exponential backoff
    await new Promise((resolve) => setTimeout(resolve, delay))

    return this.submit(block, config)
  }
}
