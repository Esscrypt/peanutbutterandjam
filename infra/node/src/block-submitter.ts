/**
 * Block Submitter
 *
 * Submits blocks to the network according to JAM Protocol specifications
 * Reference: Gray Paper block submission specifications
 */

import { blake2bHash, logger } from '@pbnj/core'
import { encodeBlockBody, encodeHeader } from '@pbnj/serialization'
import type {
  BlockAuthoringBlock as Block,
  BlockAuthoringConfig,
  BlockAuthoringError,
  SubmissionResult,
} from '@pbnj/types'
import { BlockAuthoringErrorType, PropagationStatus } from '@pbnj/types'

/**
 * Block Submitter
 */
export class BlockSubmitter {
  /**
   * Submit block to network
   */
  async submit(
    block: Block,
    _config: BlockAuthoringConfig,
  ): Promise<SubmissionResult> {
    logger.debug('Submitting block', {
      blockSlot: block.header.slot,
    })

    try {
      // Validate block before submission
      const validationResult = await this.validateBlock(block)
      if (!validationResult.valid) {
        logger.error('Block validation failed', {
          blockSlot: block.header.slot,
          errors: validationResult.errors,
        })

        const validationError: BlockAuthoringError = {
          type: BlockAuthoringErrorType.INVALID_HEADER,
          message: 'Block validation failed',
          details: { errors: validationResult.errors },
          recoverable: false,
        }

        return {
          success: false,
          error: validationError,
          propagationStatus: PropagationStatus.REJECTED,
        }
      }

      // Serialize block according to Gray Paper specifications
      const serializedBlock = await this.serializeBlock(block)

      // Submit to network peers
      const submissionResult = await this.submitToNetwork(
        serializedBlock,
        block.header.slot,
      )

      if (!submissionResult.success) {
        throw new Error(`Network submission failed: ${submissionResult.error}`)
      }

      const blockHash = (await this.calculateBlockHash(block)) as `0x${string}`

      logger.debug('Block submitted successfully', {
        blockSlot: block.header.slot,
        blockHash,
        peerCount: submissionResult.peerCount,
      })

      return {
        success: true,
        blockHash,
        propagationStatus: PropagationStatus.CONFIRMED,
      }
    } catch (error) {
      logger.error('Block submission failed', {
        blockSlot: block.header.slot,
        error,
      })

      const submissionError: BlockAuthoringError = {
        type: BlockAuthoringErrorType.SUBMISSION_FAILED,
        message: 'Block submission failed',
        details: {
          error: error instanceof Error ? error.message : String(error),
        },
        recoverable: true,
      }

      return {
        success: false,
        error: submissionError,
        propagationStatus: PropagationStatus.REJECTED,
      }
    }
  }

  /**
   * Validate block before submission
   */
  private async validateBlock(
    block: Block,
  ): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = []

    // Validate block header
    if (!block.header.slot || block.header.slot <= 0) {
      errors.push('Invalid block number')
    }

    if (!block.header.parent || block.header.parent.length !== 66) {
      // 0x + 64 hex chars
      errors.push('Invalid parent hash')
    }

    if (
      !block.header.parent_state_root ||
      block.header.parent_state_root.length !== 66
    ) {
      errors.push('Invalid state root')
    }

    if (
      !block.header.extrinsic_hash ||
      block.header.extrinsic_hash.length !== 66
    ) {
      errors.push('Invalid extrinsics root')
    }

    if (!block.header.slot || block.header.slot <= 0) {
      errors.push('Invalid timestamp')
    }

    if (block.header.author_index < 0) {
      errors.push('Invalid author index')
    }

    // Validate block body
    if (!Array.isArray(block.body)) {
      errors.push('Invalid block body')
    }

    // Check extrinsic limits
    if (block.body.length > 1000) {
      // TODO: Get from config
      errors.push('Too many extrinsics')
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  }

  /**
   * Serialize block according to Gray Paper specifications
   */
  private async serializeBlock(block: Block): Promise<Uint8Array> {
    // JAM header is already in the correct format for serialization
    // Convert BlockHeader to JamHeader format expected by encodeHeader
    const jamHeader = {
      parent: block.header.parent,
      parent_state_root: block.header.parent_state_root,
      extrinsic_hash: block.header.extrinsic_hash,
      slot: block.header.slot,
      epoch_mark: block.header.epoch_mark,
      winners_mark: block.header.tickets_mark
        ? ((Array.isArray(block.header.tickets_mark)
            ? block.header.tickets_mark
            : [block.header.tickets_mark]) as any)
        : null,
      offenders_mark: block.header.offenders_mark,
      author_index: block.header.author_index,
      vrf_sig: block.header.entropy_source,
      seal_sig: block.header.seal,
    }

    // 1. Serialize header
    const headerUint8Array = encodeHeader(jamHeader)

    // 2. Serialize body (extrinsics)
    const extrinsicsData = block.body.map((ext) => ext.data)
    const bodyUint8Array = encodeBlockBody({ extrinsics: extrinsicsData })

    // 3. Concatenate header and body
    const serializedBlock = new Uint8Array(
      headerUint8Array.length + bodyUint8Array.length,
    )
    serializedBlock.set(headerUint8Array, 0)
    serializedBlock.set(bodyUint8Array, headerUint8Array.length)

    return serializedBlock
  }

  /**
   * Submit block to network peers
   */
  private async submitToNetwork(
    serializedBlock: Uint8Array,
    blockNumber: number,
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
   * Simulate network submission (legacy method)
   */
  private async simulateNetworkSubmission(_block: Block): Promise<void> {
    // Simulate network latency
    const latency = Math.random() * 100 + 50 // 50-150ms
    await new Promise((resolve) => setTimeout(resolve, latency))

    // Simulate occasional failures
    if (Math.random() < 0.1) {
      // 10% failure rate
      throw new Error('Network submission failed')
    }
  }

  /**
   * Legacy method - kept for backward compatibility
   */
  async submitLegacy(
    block: Block,
    _config: BlockAuthoringConfig,
  ): Promise<SubmissionResult> {
    logger.debug('Submitting block (legacy method)', {
      blockSlot: block.header.slot,
    })

    try {
      await this.simulateNetworkSubmission(block)
      const blockHash = (await this.calculateBlockHash(block)) as `0x${string}`

      return {
        success: true,
        blockHash,
        propagationStatus: PropagationStatus.CONFIRMED,
      }
    } catch (error) {
      const submissionError: BlockAuthoringError = {
        type: BlockAuthoringErrorType.SUBMISSION_FAILED,
        message: 'Legacy block submission failed',
        details: {
          error: error instanceof Error ? error.message : String(error),
        },
        recoverable: true,
      }

      return {
        success: false,
        error: submissionError,
        propagationStatus: PropagationStatus.REJECTED,
      }
    }
  }

  /**
   * Calculate block hash
   */
  private async calculateBlockHash(block: Block): Promise<string> {
    // According to Gray Paper, block hash is calculated from the header
    // This involves:
    // 1. Serializing the block header
    // 2. Calculating the Blake2b hash
    // 3. Returning the hash

    // Convert BlockHeader to JamHeader format expected by encodeHeader
    const jamHeader = {
      parent: block.header.parent,
      parent_state_root: block.header.parent_state_root,
      extrinsic_hash: block.header.extrinsic_hash,
      slot: block.header.slot,
      epoch_mark: block.header.epoch_mark,
      winners_mark: block.header.tickets_mark
        ? ((Array.isArray(block.header.tickets_mark)
            ? block.header.tickets_mark
            : [block.header.tickets_mark]) as any)
        : null,
      offenders_mark: block.header.offenders_mark,
      author_index: block.header.author_index,
      vrf_sig: block.header.entropy_source,
      seal_sig: block.header.seal,
    }

    const headerUint8Array = encodeHeader(jamHeader)
    return blake2bHash(headerUint8Array)
  }

  /**
   * Check block propagation status
   */
  async checkPropagationStatus(_blockHash: string): Promise<PropagationStatus> {
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
  ): Promise<SubmissionResult> {
    logger.debug('Retrying block submission', {
      blockSlot: block.header.slot,
      retryCount,
    })

    if (retryCount >= 3) {
      const error: BlockAuthoringError = {
        type: BlockAuthoringErrorType.SUBMISSION_FAILED,
        message: 'Max retry attempts exceeded',
        details: { retryCount },
        recoverable: false,
      }

      return {
        success: false,
        error,
        propagationStatus: PropagationStatus.REJECTED,
      }
    }

    // Wait before retry
    const delay = 2 ** retryCount * 1000 // Exponential backoff
    await new Promise((resolve) => setTimeout(resolve, delay))

    return this.submit(block, config)
  }
}
