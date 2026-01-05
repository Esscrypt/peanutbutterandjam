/**
 * Header Constructor
 *
 * Constructs block headers according to JAM Protocol specifications
 * Reference: Gray Paper header specifications
 */

import { encodeHeader, encodeUnsignedHeader } from '@pbnjam/codec'
import {
  blake2bHash,
  bytesToHex,
  concatBytes,
  type Hex,
  hexToBytes,
  logger,
  zeroHash,
} from '@pbnjam/core'
import type {
  BlockHeader,
  Extrinsic,
  IConfigService,
  Safe,
  UnsignedBlockHeader,
} from '@pbnjam/types'
import { BaseService, safeError, safeResult } from '@pbnjam/types'
import type { NodeGenesisManager } from './genesis-manager'
import type { KeyPairService } from './keypair-service'
import type { ValidatorSetManager } from './validator-set'
/**
 * Header Constructor
 */
export class HeaderConstructor extends BaseService {
  private keyPairService: KeyPairService
  private validatorSetManagerService: ValidatorSetManager
  private genesisManagerService: NodeGenesisManager
  constructor(options: {
    keyPairService: KeyPairService
    validatorSetManagerService: ValidatorSetManager
    genesisManagerService: NodeGenesisManager
  }) {
    super('header-constructor')
    this.keyPairService = options.keyPairService
    this.validatorSetManagerService = options.validatorSetManagerService
    this.genesisManagerService = options.genesisManagerService
  }

  /**
   * Construct a new block header
   */
  construct(
    parent: BlockHeader | null,
    extrinsics: Extrinsic[],
    config: IConfigService,
  ): Safe<UnsignedBlockHeader> {
    // If no parent header, create genesis header

    if (!parent) {
      const [genesisHeaderError, genesisHeader] =
        this.genesisManagerService.getGenesisHeader()
      if (genesisHeaderError) {
        return safeError(genesisHeaderError)
      }
      parent = genesisHeader
    }

    logger.debug('Constructing block header', {
      extrinsicsCount: extrinsics.length,
      isGenesis: !parent,
    })

    const [encodeError, encodedHeader] = encodeHeader(parent, config)
    if (encodeError) {
      return safeError(encodeError)
    }

    // Calculate parent hash or use genesis parent hash
    const [parentHashError, parentHash] = blake2bHash(encodedHeader)
    if (parentHashError) {
      return safeError(parentHashError)
    }

    // Calculate state root (placeholder for now)
    // const [stateRootError, stateRoot] = this.calculateStateRoot(effectiveParent)
    // if (stateRootError) {
    //   return safeError(stateRootError)
    // }

    // Calculate extrinsics root
    const [extrinsicsRootError, extrinsicsRoot] =
      this.calculateExtrinsicsRoot(extrinsics)
    if (extrinsicsRootError) {
      return safeError(extrinsicsRootError)
    }

    // Calculate next slot
    const timestamp = this.calculateTimestamp(
      parent.timeslot,
      BigInt(config.slotDuration),
    )

    const [authorIndexError, authorIndex] =
      this.validatorSetManagerService.getValidatorIndex(
        bytesToHex(
          this.keyPairService.getLocalKeyPair().ed25519KeyPair.publicKey,
        ),
      )
    if (authorIndexError) {
      return safeError(authorIndexError)
    }
    // Create new header
    const header: UnsignedBlockHeader = {
      parent: parentHash,
      priorStateRoot: zeroHash, // TODO: Calculate state root
      extrinsicHash: extrinsicsRoot,
      timeslot: timestamp, // JAM uses time slot instead of sequential block numbers
      epochMark: null,
      winnersMark: null,
      offendersMark: [],
      authorIndex: BigInt(authorIndex),
      vrfSig: zeroHash,
    }

    // Generate signature for the header
    const [sealError, _seal] = this.signHeader(header, config)
    if (sealError) {
      return safeError(sealError)
    }

    logger.debug('Header constructed', {
      blockSlot: header.timeslot,
      parentHash: header.parent,
      extrinsicsRoot: header.extrinsicHash,
    })

    return safeResult(header)
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
        return safeError(error)
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
   * Generate signature for block header
   */
  private signHeader(
    header: UnsignedBlockHeader,
    config: IConfigService,
  ): Safe<Hex> {
    const [headerBytesError, headerBytes] = encodeUnsignedHeader(header, config)
    if (headerBytesError) {
      return safeError(headerBytesError)
    }
    const [headerHashError, headerHash] = blake2bHash(headerBytes)
    if (headerHashError) {
      return safeError(headerHashError)
    }

    const [signError, signature] = this.keyPairService.signMessage(
      hexToBytes(headerHash),
    )
    if (signError) {
      return safeError(signError)
    }
    if (!signature) {
      return safeError(new Error('Signature is undefined'))
    }
    return safeResult(bytesToHex(signature))
  }
}
