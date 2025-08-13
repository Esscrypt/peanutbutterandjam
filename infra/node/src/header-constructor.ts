/**
 * Header Constructor
 *
 * Constructs block headers according to JAM Protocol specifications
 * Reference: Gray Paper header specifications
 */

import type { Hex } from '@pbnj/core'
import { blake2bHash, logger } from '@pbnj/core'
import type {
  BlockAuthoringConfig,
  SerializationBlockHeader as BlockHeader,
  Extrinsic,
} from '@pbnj/types'

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
      parentSlot: effectiveParent.slot,
      extrinsicsCount: extrinsics.length,
      isGenesis: !parent,
    })

    // Calculate parent hash or use genesis parent hash
    const parentHash = await this.calculateParentHash(effectiveParent)

    // Calculate state root (placeholder for now)
    const stateRoot = await this.calculateStateRoot(effectiveParent)

    // Calculate extrinsics root
    const extrinsicsRoot = await this.calculateExtrinsicsRoot(extrinsics)

    // Calculate next slot
    const timestamp = this.calculateTimestamp(
      effectiveParent.slot,
      config.slotDuration,
    )

    // Create new header
    const header: BlockHeader = {
      parent: parentHash as `0x${string}`,
      parent_state_root: stateRoot as `0x${string}`,
      extrinsic_hash: extrinsicsRoot as `0x${string}`,
      slot: timestamp, // JAM uses time slot instead of sequential block numbers
      epoch_mark: null,
      tickets_mark: null,
      offenders_mark: [],
      author_index: 0, // TODO: Map validatorKey to author_index
      entropy_source: `0x${'00'.repeat(32)}` as `0x${string}`,
      seal: `0x${'00'.repeat(32)}` as `0x${string}`,
    }

    // Generate signature for the header
    header.seal = (await this.generateSignature(
      header,
      config,
    )) as `0x${string}`

    logger.debug('Header constructed', {
      blockSlot: header.slot,
      parentHash: header.parent,
      extrinsicsRoot: header.extrinsic_hash,
    })

    return header
  }

  /**
   * Calculate parent hash
   */
  private async calculateParentHash(parent: BlockHeader): Promise<Hex> {
    // TODO: Implement proper hash calculation using serialization
    return `0x${parent.slot.toString(16).padStart(64, '0')}`
  }

  /**
   * Calculate state root
   */
  private async calculateStateRoot(parent: BlockHeader): Promise<Hex> {
    // TODO: Implement proper state root calculation
    return parent.parent_state_root
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

    // Calculate Merkle root of extrinsic hashes
    const extrinsicHashes = extrinsics.map((extrinsic) => {
      // Hash the extrinsic data
      return blake2bHash(extrinsic.data)
    })

    // Simple Merkle root calculation (for now, just hash all hashes together)
    if (extrinsicHashes.length === 0) {
      return '0x0000000000000000000000000000000000000000000000000000000000000000'
    }

    // For simplicity, just hash all extrinsic hashes together
    const combinedHashes = new TextEncoder().encode(extrinsicHashes.join(''))
    return blake2bHash(combinedHashes)
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
  private createGenesisHeader(_config: BlockAuthoringConfig): BlockHeader {
    const genesisHeader: BlockHeader = {
      parent:
        '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
      parent_state_root:
        '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
      extrinsic_hash:
        '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
      slot: 0, // Genesis block starts at slot 0
      epoch_mark: null,
      tickets_mark: null,
      offenders_mark: [],
      author_index: 0, // TODO: Map validatorKey to author_index
      entropy_source:
        '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
      seal: '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
    }

    logger.debug('Created genesis header', {
      slot: genesisHeader.slot,
      timestamp: genesisHeader.slot,
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
      slot: header.slot,
      parentHash: header.parent,
      stateRoot: header.parent_state_root,
      extrinsicsRoot: header.extrinsic_hash,
      authorIndex: header.author_index,
    }

    const headerBytes = new TextEncoder().encode(JSON.stringify(headerData))
    const headerHash = blake2bHash(headerBytes)

    // TODO: Use actual cryptographic signing
    // For now, return a placeholder signature
    return `0x${headerHash.slice(2).padStart(128, '0')}`
  }
}
