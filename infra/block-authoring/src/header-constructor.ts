/**
 * Header Constructor
 *
 * Constructs block headers according to JAM Protocol specifications
 * Reference: Gray Paper header specifications
 */

import type { Hex } from '@pbnj/core'
import { blake2bHash, logger, merkleRoot } from '@pbnj/core'
import type { BlockAuthoringConfig, BlockHeader, Extrinsic } from './types'

/**
 * Header Constructor
 */
export class HeaderConstructor {
  /**
   * Construct a new block header
   */
  async construct(
    parent: BlockHeader | null,
    extrinsics: Extrinsic[],
    config: BlockAuthoringConfig,
  ): Promise<BlockHeader> {
    // If no parent header, create genesis header
    const effectiveParent = parent || this.createGenesisHeader(config)

    logger.debug('Constructing block header', {
      parentNumber: effectiveParent.number,
      extrinsicsCount: extrinsics.length,
      isGenesis: !parent,
    })

    // Calculate parent hash or use genesis parent hash
    const parentHash = await this.calculateParentHash(effectiveParent)

    // Calculate state root (placeholder for now)
    const stateRoot = await this.calculateStateRoot(effectiveParent)

    // Calculate extrinsics root
    const extrinsicsRoot = await this.calculateExtrinsicsRoot(extrinsics)

    // Calculate timestamp
    const timestamp = this.calculateTimestamp(
      effectiveParent.timestamp,
      config.slotDuration,
    )

    // Create new header
    const header: BlockHeader = {
      number: effectiveParent.number + 1,
      parentHash: parentHash as `0x${string}`,
      stateRoot: stateRoot as `0x${string}`,
      extrinsicsRoot: extrinsicsRoot as `0x${string}`,
      timestamp,
      author: config.validatorKey,
      signature: '', // Will be set after header creation
    }

    // Generate signature for the header
    header.signature = await this.generateSignature(header, config)

    logger.debug('Header constructed', {
      blockNumber: header.number,
      parentHash: header.parentHash,
      extrinsicsRoot: header.extrinsicsRoot,
    })

    return header
  }

  /**
   * Calculate parent hash
   */
  private async calculateParentHash(parent: BlockHeader): Promise<Hex> {
    // TODO: Implement proper hash calculation using serialization
    return `0x${parent.number.toString(16).padStart(64, '0')}`
  }

  /**
   * Calculate state root
   */
  private async calculateStateRoot(parent: BlockHeader): Promise<Hex> {
    // TODO: Implement proper state root calculation
    return `0x${parent.stateRoot}`
  }

  /**
   * Calculate extrinsics root
   */
  private async calculateExtrinsicsRoot(
    extrinsics: Extrinsic[],
  ): Promise<string> {
    if (extrinsics.length === 0) {
      return '0x0000000000000000000000000000000000000000000000000000000000000000'
    }

    // Use Merkle root helper from core package
    const extrinsicHashes = extrinsics.map((extrinsic) => {
      // Hash the extrinsic data
      return blake2bHash(extrinsic.data)
    })

    return merkleRoot(extrinsicHashes)
  }

  /**
   * Calculate timestamp
   */
  private calculateTimestamp(
    parentTimestamp: number,
    slotDuration: number,
  ): number {
    // Ensure timestamp is in the future and follows slot duration
    const currentTime = Date.now()
    const nextSlotTime =
      Math.ceil(currentTime / (slotDuration * 1000)) * (slotDuration * 1000)
    return Math.max(nextSlotTime, parentTimestamp + slotDuration * 1000)
  }

  /**
   * Create genesis header
   */
  private createGenesisHeader(config: BlockAuthoringConfig): BlockHeader {
    const genesisHeader: BlockHeader = {
      number: 0,
      parentHash:
        '0x0000000000000000000000000000000000000000000000000000000000000000',
      stateRoot:
        '0x0000000000000000000000000000000000000000000000000000000000000000',
      extrinsicsRoot:
        '0x0000000000000000000000000000000000000000000000000000000000000000',
      timestamp: Date.now(),
      author: config.validatorKey,
      signature:
        '0x0000000000000000000000000000000000000000000000000000000000000000',
    }

    logger.debug('Created genesis header', {
      number: genesisHeader.number,
      timestamp: genesisHeader.timestamp,
    })

    return genesisHeader
  }

  /**
   * Generate signature for block header
   */
  private async generateSignature(
    header: BlockHeader,
    _config: BlockAuthoringConfig,
  ): Promise<string> {
    // TODO: Implement proper signature generation
    // This should use the validator's private key to sign the header
    // For now, return a placeholder signature

    // Create a hash of the header for signing
    const headerData = {
      number: header.number,
      parentHash: header.parentHash,
      stateRoot: header.stateRoot,
      extrinsicsRoot: header.extrinsicsRoot,
      timestamp: header.timestamp,
      author: header.author,
    }

    const headerBytes = new TextEncoder().encode(JSON.stringify(headerData))
    const headerHash = blake2bHash(headerBytes)

    // TODO: Use actual cryptographic signing
    // For now, return a placeholder signature
    return `0x${headerHash.slice(2).padStart(128, '0')}`
  }
}
