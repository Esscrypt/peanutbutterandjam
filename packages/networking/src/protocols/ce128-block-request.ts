/**
 * CE 128: Block Request Protocol
 *
 * Implements the block request protocol for JAMNP-S
 * This is a Common Ephemeral (CE) stream for requesting sequences of blocks.
 */

import type { EventBusService, Hex, Safe, SafePromise } from '@pbnj/core'
import {
  bytesToHex,
  concatBytes,
  hexToBytes,
  safeError,
  safeResult,
} from '@pbnj/core'
import {
  decodeBlock,
  decodeFixedLength,
  decodeNatural,
  encodeBlock,
  encodeFixedLength,
  encodeNatural,
} from '@pbnj/serialization'
import type {
  Block,
  BlockRequest,
  BlockResponse,
  IConfigService,
} from '@pbnj/types'
import { BlockRequestDirection } from '@pbnj/types'
import { NetworkingProtocol } from './protocol'
/**
 * Block request protocol handler
 */
export class BlockRequestProtocol extends NetworkingProtocol<
  BlockRequest,
  BlockResponse
> {
  private readonly eventBusService: EventBusService
  private readonly configService: IConfigService
  constructor(eventBusService: EventBusService, configService: IConfigService) {
    super()
    this.eventBusService = eventBusService
    this.configService = configService
  }

  /**
   * Process block request and generate response
   */
  async processRequest(
    request: BlockRequest,
    peerPublicKey: Hex,
  ): SafePromise<void> {
    this.eventBusService.emitBlocksRequested(request, peerPublicKey)
    return safeResult(undefined)
  }

  /**
   * Serialize block request message
   */
  serializeRequest(request: BlockRequest): Safe<Uint8Array> {
    // Serialize according to JAMNP-S specification
    const parts: Uint8Array[] = []

    parts.push(hexToBytes(request.headerHash))

    const [error, direction] = encodeFixedLength(BigInt(request.direction), 1n)
    if (error) {
      return safeError(error)
    }
    parts.push(direction)

    const [error2, maximumBlocks] = encodeFixedLength(request.maximumBlocks, 4n)
    if (error2) {
      return safeError(error2)
    }
    parts.push(maximumBlocks)

    return safeResult(concatBytes(parts))
  }

  /**
   * Deserialize block request message
   */
  deserializeRequest(data: Uint8Array): Safe<BlockRequest> {
    let currentData = data
    const headerHash = bytesToHex(currentData.slice(0, 32))
    currentData = currentData.slice(32)

    const [error2, direction] = decodeFixedLength(currentData, 1n)
    if (error2) {
      return safeError(error2)
    }
    currentData = direction.remaining
    const directionValue =
      direction.value === 0n
        ? BlockRequestDirection.ASCENDING_EXCLUSIVE
        : BlockRequestDirection.DESCENDING_INCLUSIVE
    const [error3, maximumBlocksResult] = decodeFixedLength(currentData, 4n)
    if (error3) {
      return safeError(error3)
    }

    return safeResult({
      headerHash: headerHash,
      direction: directionValue as BlockRequestDirection,
      maximumBlocks: maximumBlocksResult.value,
    })
  }

  /**
   * Deserialize block response message
   */
  deserializeResponse(data: Uint8Array): Safe<BlockResponse> {
    let currentData = data
    const [error, numberOfBlocksResult] = decodeNatural(currentData)
    if (error) {
      return safeError(error)
    }
    const numBlocks = numberOfBlocksResult.value
    currentData = numberOfBlocksResult.remaining

    // Read each block
    const blocks: Block[] = []
    for (let i = 0; i < numBlocks; i++) {
      const [error, block] = decodeBlock(currentData, this.configService)
      if (error) {
        return safeError(error)
      }
      blocks.push(block.value)
    }

    return safeResult({ blocks })
  }

  /**
   * Serialize block response message
   * According to JAMNP-S specification: <-- [Block] where each Block = As in GP
   */
  //   Direction = 0 (Ascending exclusive) OR 1 (Descending inclusive) (Single byte)
  // Maximum Blocks = u32
  // Block = As in GP

  // Node -> Node

  // --> Header Hash ++ Direction ++ Maximum Blocks
  // --> FIN
  // <-- [Block]
  // <-- FIN
  serializeResponse(response: BlockResponse): Safe<Uint8Array> {
    // Serialize according to JAMNP-S specification

    const parts: Uint8Array[] = []
    const [error, numberOfBlocks] = encodeNatural(
      BigInt(response.blocks.length),
    )
    if (error) {
      return safeError(error)
    }
    parts.push(numberOfBlocks)

    // Write each serialized block (already Gray Paper encoded)
    for (const block of response.blocks) {
      const [error, encodedBlock] = encodeBlock(block, this.configService)
      if (error) {
        return safeError(error)
      }
      parts.push(encodedBlock)
    }

    return safeResult(concatBytes(parts))
  }

  async processResponse(
    response: BlockResponse,
    peerPublicKey: Hex,
  ): SafePromise<void> {
    this.eventBusService.emitBlocksReceived(response.blocks, peerPublicKey)

    return safeResult(undefined)
  }
}
