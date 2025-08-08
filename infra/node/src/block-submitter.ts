/**
 * Block Submitter
 *
 * Submits blocks to the network according to JAM Protocol specifications
 * Reference: Gray Paper block submission specifications
 */

import { blake2bHash, logger } from '@pbnj/core'
import { encodeBlockBody, encodeBlockHeader } from '@pbnj/serialization'
import type {
  Block,
  BlockAuthoringConfig,
  BlockAuthoringError,
  SubmissionResult,
} from './types'
import { BlockAuthoringErrorType, PropagationStatus } from './types'

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
      blockNumber: block.header.number,
    })

    try {
      // Validate block before submission
      const validationResult = await this.validateBlock(block)
      if (!validationResult.valid) {
        logger.error('Block validation failed', {
          blockNumber: block.header.number,
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
        block.header.number,
      )

      if (!submissionResult.success) {
        throw new Error(`Network submission failed: ${submissionResult.error}`)
      }

      const blockHash = (await this.calculateBlockHash(block)) as `0x${string}`

      logger.debug('Block submitted successfully', {
        blockNumber: block.header.number,
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
        blockNumber: block.header.number,
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
    if (!block.header.number || block.header.number <= 0) {
      errors.push('Invalid block number')
    }

    if (!block.header.parentHash || block.header.parentHash.length !== 66) {
      // 0x + 64 hex chars
      errors.push('Invalid parent hash')
    }

    if (!block.header.stateRoot || block.header.stateRoot.length !== 66) {
      errors.push('Invalid state root')
    }

    if (
      !block.header.extrinsicsRoot ||
      block.header.extrinsicsRoot.length !== 66
    ) {
      errors.push('Invalid extrinsics root')
    }

    if (!block.header.timestamp || block.header.timestamp <= 0) {
      errors.push('Invalid timestamp')
    }

    if (!block.header.author || block.header.author.length === 0) {
      errors.push('Invalid author')
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
    // Convert core BlockHeader to serialization BlockHeader format
    const serializationHeader = {
      parentHash: block.header.parentHash,
      priorStateRoot: block.header.stateRoot,
      extrinsicHash: block.header.extrinsicsRoot,
      timeslot: BigInt(block.header.timestamp),
      epochMark: undefined,
      winnersMark: undefined,
      authorIndex: BigInt(0), // TODO: Get from block
      vrfSignature:
        '0x0000000000000000000000000000000000000000000000000000000000000000' as const,
      offendersMark: new Uint8Array(0),
      sealSignature: block.header.signature as `0x${string}`,
    }

    // 1. Serialize header
    const headerBytes = encodeBlockHeader(serializationHeader)

    // 2. Serialize body (extrinsics)
    const extrinsicsData = block.body.map((ext) => ext.data)
    const bodyBytes = encodeBlockBody({ extrinsics: extrinsicsData })

    // 3. Concatenate header and body
    const serializedBlock = new Uint8Array(
      headerBytes.length + bodyBytes.length,
    )
    serializedBlock.set(headerBytes, 0)
    serializedBlock.set(bodyBytes, headerBytes.length)

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
      blockNumber: block.header.number,
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

    // Convert core BlockHeader to serialization BlockHeader format
    const serializationHeader = {
      parentHash: block.header.parentHash,
      priorStateRoot: block.header.stateRoot,
      extrinsicHash: block.header.extrinsicsRoot,
      timeslot: BigInt(block.header.timestamp),
      epochMark: undefined,
      winnersMark: undefined,
      authorIndex: BigInt(0), // TODO: Get from block
      vrfSignature:
        '0x0000000000000000000000000000000000000000000000000000000000000000' as const,
      offendersMark: new Uint8Array(0),
      sealSignature: block.header.signature as `0x${string}`,
    }

    const headerBytes = encodeBlockHeader(serializationHeader)
    return blake2bHash(headerBytes)
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
      blockNumber: block.header.number,
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
