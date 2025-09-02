/**
 * Header Constructor
 *
 * Constructs block headers according to JAM Protocol specifications
 * Reference: Gray Paper header specifications
 */

import type { Hex, Safe } from '@pbnj/core'
import {
  blake2bHash,
  concatBytes,
  hexToBytes,
  logger,
  safeError,
  safeResult,
  zeroHash,
} from '@pbnj/core'
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
  construct(
    parent: BlockHeader | null,
    extrinsics: Extrinsic[],
    config: BlockAuthoringConfig,
  ): Safe<BlockHeader> {
    // If no parent header, create genesis header
    const effectiveParent = parent || this.createGenesisHeader(config)

    logger.debug('Constructing block header', {
      parentSlot: effectiveParent.slot,
      extrinsicsCount: extrinsics.length,
      isGenesis: !parent,
    })

    // Calculate parent hash or use genesis parent hash
    const [parentHashError, parentHash] =
      this.calculateParentHash(effectiveParent)
    if (parentHashError) {
      return safeError(parentHashError)
    }

    // Calculate state root (placeholder for now)
    const [stateRootError, stateRoot] = this.calculateStateRoot(effectiveParent)
    if (stateRootError) {
      return safeError(stateRootError)
    }

    // Calculate extrinsics root
    const [extrinsicsRootError, extrinsicsRoot] =
      this.calculateExtrinsicsRoot(extrinsics)
    if (extrinsicsRootError) {
      return safeError(extrinsicsRootError)
    }

    // Calculate next slot
    const timestamp = this.calculateTimestamp(
      effectiveParent.slot,
      config.slotDuration,
    )

    // Create new header
    const header: BlockHeader = {
      parent: parentHash as `0x${string}`,
      parent_state_root: stateRoot as `0x${string}`,
      extrinsic_hash: extrinsicsRoot,
      slot: timestamp, // JAM uses time slot instead of sequential block numbers
      epoch_mark: null,
      tickets_mark: null,
      offenders_mark: [],
      author_index: 0n, // TODO: Map validatorKey to author_index
      entropy_source: `0x${'00'.repeat(32)}` as `0x${string}`,
      seal: `0x${'00'.repeat(32)}` as `0x${string}`,
    }

    // Generate signature for the header
    const [sealError, seal] = this.generateSignature(header, config)
    if (sealError) {
      return safeError(sealError)
    }
    header.seal = seal as `0x${string}`

    logger.debug('Header constructed', {
      blockSlot: header.slot,
      parentHash: header.parent,
      extrinsicsRoot: header.extrinsic_hash,
    })

    return safeResult(header)
  }

  /**
   * Calculate parent hash
   */
  private calculateParentHash(parent: BlockHeader): Safe<Hex> {
    // TODO: Implement proper hash calculation using serialization
    return safeResult(
      `0x${parent.slot.toString(16).padStart(64, '0')}` as `0x${string}`,
    )
  }

  /**
   * Calculate state root
   */
  private calculateStateRoot(parent: BlockHeader): Safe<Hex> {
    // TODO: Implement proper state root calculation
    return safeResult(parent.parent_state_root)
  }

  /**
   * Calculate extrinsics root
   */
  private calculateExtrinsicsRoot(extrinsics: Extrinsic[]): Safe<Hex> {
    if (extrinsics.length === 0) {
      return safeResult(zeroHash)
    }

    // Calculate Merkle root of extrinsic hashes
    const extrinsicHashResults = extrinsics.map((extrinsic) => {
      // Hash the extrinsic data
      return blake2bHash(extrinsic.data)
    })

    const extrinsicHashes: Hex[] = []
    for (const [error, hash] of extrinsicHashResults) {
      if (error) {
        throw error
      }
      extrinsicHashes.push(hash)
    }

    // Simple Merkle root calculation (for now, just hash all hashes together)
    // if (extrinsicHashes.length === 0) {
    //   const [merklizeError, merklized] = merklize(extrinsicHashes)
    //   if (merklizeError) {
    //     return safeError(merklizeError)
    //   }
    //   return safeResult(merklized)
    // }

    // For simplicity, just hash all extrinsic hashes together
    const combinedHashes = concatBytes(
      extrinsicHashes.map((hash) => hexToBytes(hash)),
    )
    // return JSON.stringify(combinedHashes)
    const [blake2bHashError, blake2bHashed] = blake2bHash(combinedHashes)
    if (blake2bHashError) {
      return safeError(blake2bHashError)
    }
    return safeResult(blake2bHashed)
  }

  /**
   * Calculate timestamp
   */
  private calculateTimestamp(
    parentTimestamp: bigint,
    slotDuration: bigint,
  ): bigint {
    // Ensure timestamp is in the future and follows slot duration
    const currentTime = Date.now()
    const nextSlotTime =
      Math.ceil(Number(currentTime) / (Number(slotDuration) * 1000)) *
      (Number(slotDuration) * 1000)
    return BigInt(
      Math.max(
        nextSlotTime,
        Number(parentTimestamp) + Number(slotDuration) * 1000,
      ),
    )
  }

  /**
   * Create genesis header
   */
  private createGenesisHeader(_config: BlockAuthoringConfig): BlockHeader {
    const genesisHeader: BlockHeader = {
      parent: zeroHash,
      parent_state_root: zeroHash,
      extrinsic_hash: zeroHash,
      slot: 0n, // Genesis block starts at slot 0
      epoch_mark: null,
      tickets_mark: null,
      offenders_mark: [],
      author_index: 0n, // TODO: Map validatorKey to author_index
      entropy_source: zeroHash,
      seal: zeroHash,
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
  private generateSignature(
    header: BlockHeader,
    _config: BlockAuthoringConfig,
  ): Safe<Hex> {
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
    const [headerHashError, headerHash] = blake2bHash(headerBytes)

    // TODO: Use actual cryptographic signing
    // For now, return a placeholder signature
    if (headerHashError) {
      return safeError(headerHashError)
    }
    return safeResult(headerHash)
  }
}
