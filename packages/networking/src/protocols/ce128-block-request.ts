/**
 * CE 128: Block Request Protocol
 *
 * Implements the block request protocol for JAMNP-S
 * This is a Common Ephemeral (CE) stream for requesting sequences of blocks.
 */

import {
  calculateBlockHashFromHeader,
  decodeBlock,
  decodeFixedLength,
  decodeNatural,
  encodeBlock,
  encodeFixedLength,
  encodeNatural,
} from '@pbnjam/codec'
import type { EventBusService, Hex } from '@pbnjam/core'
import { bytesToHex, concatBytes, hexToBytes, logger } from '@pbnjam/core'
import type {
  Block,
  BlockRequest,
  BlockResponse,
  IChainManagerService,
  IConfigService,
  Safe,
  SafePromise,
} from '@pbnjam/types'
import { BlockRequestDirection, safeError, safeResult } from '@pbnjam/types'
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
  private readonly chainManagerService?: IChainManagerService | null

  constructor(
    eventBusService: EventBusService,
    configService: IConfigService,
    chainManagerService?: IChainManagerService,
  ) {
    super()
    this.eventBusService = eventBusService
    this.configService = configService
    this.chainManagerService = chainManagerService || null
  }

  /**
   * Process block request and generate response
   */
  async processRequest(
    request: BlockRequest,
    peerPublicKey: Hex,
  ): SafePromise<void> {
    try {
      // Emit JIP-3 receiving block request event
      const eventId = await this.eventBusService.emitReceivingBlockRequest(
        hexToBytes(peerPublicKey),
      )

      // Emit JIP-3 block request received event
      await this.eventBusService.emitBlockRequestReceived(
        eventId,
        hexToBytes(request.headerHash),
        request.direction === BlockRequestDirection.ASCENDING_EXCLUSIVE
          ? 'ascending_exclusive'
          : 'descending_inclusive',
        request.maximumBlocks,
      )

      // Legacy event for backwards compatibility
      this.eventBusService.emitBlocksRequested(request, peerPublicKey)

      logger.debug('[CE128] Block request processed successfully', {
        peerPublicKey: `${peerPublicKey.slice(0, 20)}...`,
        headerHash: `${request.headerHash.slice(0, 18)}...`,
        direction:
          request.direction === BlockRequestDirection.ASCENDING_EXCLUSIVE
            ? 'ascending_exclusive'
            : 'descending_inclusive',
        maximumBlocks: request.maximumBlocks.toString(),
      })
    } catch (error) {
      logger.error('[CE128] Failed to process block request', {
        peerPublicKey: `${peerPublicKey.slice(0, 20)}...`,
        headerHash: `${request.headerHash.slice(0, 18)}...`,
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
      })
      // Emit error event for chain manager to handle
      try {
        await this.eventBusService.emitBlockRequestFailed(
          BigInt(0), // eventId not available on error
          `Failed to process block request: ${error instanceof Error ? error.message : String(error)}`,
        )
      } catch (emitError) {
        logger.error('[CE128] Failed to emit block request failed event', {
          error:
            emitError instanceof Error ? emitError.message : String(emitError),
        })
      }
      return safeError(
        error instanceof Error
          ? error
          : new Error(`Failed to process block request: ${String(error)}`),
      )
    }
    return safeResult(undefined)
  }

  /**
   * Serialize block request message
   */
  serializeRequest(request: BlockRequest): Safe<Uint8Array> {
    try {
      // Serialize according to JAMNP-S specification
      const parts: Uint8Array[] = []

      parts.push(hexToBytes(request.headerHash))

      const [error, direction] = encodeFixedLength(
        BigInt(request.direction),
        1n,
      )
      if (error) {
        logger.error('[CE128] Failed to encode direction in serializeRequest', {
          headerHash: `${request.headerHash.slice(0, 18)}...`,
          direction: request.direction,
          error: error.message,
        })
        return safeError(error)
      }
      parts.push(direction)

      const [error2, maximumBlocks] = encodeFixedLength(
        request.maximumBlocks,
        4n,
      )
      if (error2) {
        logger.error(
          '[CE128] Failed to encode maximumBlocks in serializeRequest',
          {
            headerHash: `${request.headerHash.slice(0, 18)}...`,
            maximumBlocks: request.maximumBlocks.toString(),
            error: error2.message,
          },
        )
        return safeError(error2)
      }
      parts.push(maximumBlocks)

      return safeResult(concatBytes(parts))
    } catch (error) {
      logger.error('[CE128] Unexpected error in serializeRequest', {
        headerHash: `${request.headerHash.slice(0, 18)}...`,
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
      })
      return safeError(
        error instanceof Error
          ? error
          : new Error(`Unexpected error in serializeRequest: ${String(error)}`),
      )
    }
  }

  /**
   * Deserialize block request message
   */
  deserializeRequest(data: Uint8Array): Safe<BlockRequest> {
    try {
      if (data.length < 32) {
        const error = new Error(
          `Insufficient data for block request deserialization: expected at least 32 bytes, got ${data.length}`,
        )
        logger.error(
          '[CE128] Failed to deserialize block request: insufficient data',
          {
            dataLength: data.length,
            error: error.message,
          },
        )
        return safeError(error)
      }

      let currentData = data
      const headerHash = bytesToHex(currentData.slice(0, 32))
      currentData = currentData.slice(32)

      if (currentData.length < 1) {
        const error = new Error(
          `Insufficient data for direction byte: expected at least 1 byte, got ${currentData.length}`,
        )
        logger.error(
          '[CE128] Failed to deserialize block request: insufficient data for direction',
          {
            headerHash: `${headerHash.slice(0, 18)}...`,
            remainingDataLength: currentData.length,
            error: error.message,
          },
        )
        return safeError(error)
      }

      const [error2, direction] = decodeFixedLength(currentData, 1n)
      if (error2) {
        logger.error(
          '[CE128] Failed to decode direction in deserializeRequest',
          {
            headerHash: `${headerHash.slice(0, 18)}...`,
            error: error2.message,
          },
        )
        return safeError(error2)
      }
      currentData = direction.remaining
      const directionValue =
        direction.value === 0n
          ? BlockRequestDirection.ASCENDING_EXCLUSIVE
          : BlockRequestDirection.DESCENDING_INCLUSIVE

      if (currentData.length < 4) {
        const error = new Error(
          `Insufficient data for maximumBlocks: expected at least 4 bytes, got ${currentData.length}`,
        )
        logger.error(
          '[CE128] Failed to deserialize block request: insufficient data for maximumBlocks',
          {
            headerHash: `${headerHash.slice(0, 18)}...`,
            remainingDataLength: currentData.length,
            error: error.message,
          },
        )
        return safeError(error)
      }

      const [error3, maximumBlocksResult] = decodeFixedLength(currentData, 4n)
      if (error3) {
        logger.error(
          '[CE128] Failed to decode maximumBlocks in deserializeRequest',
          {
            headerHash: `${headerHash.slice(0, 18)}...`,
            error: error3.message,
          },
        )
        return safeError(error3)
      }

      return safeResult({
        headerHash: headerHash,
        direction: directionValue as BlockRequestDirection,
        maximumBlocks: maximumBlocksResult.value,
      })
    } catch (error) {
      logger.error('[CE128] Unexpected error in deserializeRequest', {
        dataLength: data.length,
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
      })
      return safeError(
        error instanceof Error
          ? error
          : new Error(
              `Unexpected error in deserializeRequest: ${String(error)}`,
            ),
      )
    }
  }

  /**
   * Deserialize block response message
   */
  deserializeResponse(data: Uint8Array): Safe<BlockResponse> {
    try {
      if (data.length === 0) {
        const error = new Error('Empty block response data')
        logger.error(
          '[CE128] Failed to deserialize block response: empty data',
          {
            error: error.message,
          },
        )
        return safeError(error)
      }

      let currentData = data
      const [error, numberOfBlocksResult] = decodeNatural(currentData)
      if (error) {
        logger.error(
          '[CE128] Failed to decode number of blocks in deserializeResponse',
          {
            dataLength: data.length,
            error: error.message,
          },
        )
        return safeError(error)
      }
      const numBlocks = numberOfBlocksResult.value
      currentData = numberOfBlocksResult.remaining

      if (numBlocks > 1000n) {
        logger.warn('[CE128] Suspiciously large number of blocks in response', {
          numBlocks: numBlocks.toString(),
          dataLength: data.length,
        })
      }

      // Read each block
      const blocks: Block[] = []
      for (let i = 0; i < numBlocks; i++) {
        if (currentData.length === 0) {
          const error = new Error(
            `Insufficient data for block ${i + 1}/${numBlocks}: expected block data, got 0 bytes remaining`,
          )
          logger.error(
            '[CE128] Failed to deserialize block response: insufficient data for block',
            {
              blockIndex: i,
              totalBlocks: numBlocks.toString(),
              remainingDataLength: currentData.length,
              error: error.message,
            },
          )
          return safeError(error)
        }

        const [blockError, block] = decodeBlock(currentData, this.configService)
        if (blockError) {
          logger.error(
            '[CE128] Failed to decode block in deserializeResponse',
            {
              blockIndex: i,
              totalBlocks: numBlocks.toString(),
              remainingDataLength: currentData.length,
              error: blockError.message,
            },
          )
          return safeError(blockError)
        }
        blocks.push(block.value)
        currentData = block.remaining
      }

      logger.debug('[CE128] Successfully deserialized block response', {
        blockCount: blocks.length,
        totalDataLength: data.length,
      })

      return safeResult({ blocks })
    } catch (error) {
      logger.error('[CE128] Unexpected error in deserializeResponse', {
        dataLength: data.length,
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
      })
      return safeError(
        error instanceof Error
          ? error
          : new Error(
              `Unexpected error in deserializeResponse: ${String(error)}`,
            ),
      )
    }
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
    try {
      // Serialize according to JAMNP-S specification
      const parts: Uint8Array[] = []
      const [error, numberOfBlocks] = encodeNatural(
        BigInt(response.blocks.length),
      )
      if (error) {
        logger.error(
          '[CE128] Failed to encode number of blocks in serializeResponse',
          {
            blockCount: response.blocks.length,
            error: error.message,
          },
        )
        return safeError(error)
      }
      parts.push(numberOfBlocks)

      // Write each serialized block (already Gray Paper encoded)
      for (let i = 0; i < response.blocks.length; i++) {
        const block = response.blocks[i]
        const [blockError, encodedBlock] = encodeBlock(
          block,
          this.configService,
        )
        if (blockError) {
          logger.error('[CE128] Failed to encode block in serializeResponse', {
            blockIndex: i,
            totalBlocks: response.blocks.length,
            slot: block.header.timeslot.toString(),
            error: blockError.message,
          })
          return safeError(blockError)
        }
        parts.push(encodedBlock)
      }

      return safeResult(concatBytes(parts))
    } catch (error) {
      logger.error('[CE128] Unexpected error in serializeResponse', {
        blockCount: response.blocks.length,
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
      })
      return safeError(
        error instanceof Error
          ? error
          : new Error(
              `Unexpected error in serializeResponse: ${String(error)}`,
            ),
      )
    }
  }

  async processResponse(
    response: BlockResponse,
    peerPublicKey: Hex,
  ): SafePromise<void> {
    try {
      logger.info('[CE128] Processing block response', {
        peerPublicKey: `${peerPublicKey.slice(0, 20)}...`,
        blockCount: response.blocks.length,
      })

      if (response.blocks.length === 0) {
        logger.warn('[CE128] Received empty block response', {
          peerPublicKey: `${peerPublicKey.slice(0, 20)}...`,
        })
        // Still emit the event so chain manager can handle empty responses
        this.eventBusService.emitBlocksReceived(response.blocks, peerPublicKey)
        return safeResult(undefined)
      }

      // Log details for each received block
      const blockHashes: Hex[] = []
      for (let i = 0; i < response.blocks.length; i++) {
        const block = response.blocks[i]
        const [hashError, blockHash] = calculateBlockHashFromHeader(
          block.header,
          this.configService,
        )
        if (hashError) {
          logger.error('[CE128] Failed to calculate block hash', {
            peerPublicKey: `${peerPublicKey.slice(0, 20)}...`,
            blockIndex: i,
            error: hashError.message,
            slot: block.header.timeslot.toString(),
            parent: `${block.header.parent.slice(0, 18)}...`,
          })
          // Continue processing other blocks even if one fails
          continue
        }

        blockHashes.push(blockHash)

        const totalExtrinsics =
          block.body.tickets.length +
          block.body.preimages.length +
          block.body.guarantees.length +
          block.body.assurances.length +
          block.body.disputes.length

        logger.info('[CE128] Received block', {
          peerPublicKey: `${peerPublicKey.slice(0, 20)}...`,
          blockIndex: i,
          blockHash: `${blockHash.slice(0, 18)}...`,
          slot: block.header.timeslot.toString(),
          parent: `${block.header.parent.slice(0, 18)}...`,
          extrinsicsCount: totalExtrinsics,
          priorStateRoot: `${block.header.priorStateRoot.slice(0, 18)}...`,
          totalBlocksInResponse: response.blocks.length,
        })
      }

      // Emit event for other services to handle (chain-manager-service listens to this)
      try {
        this.eventBusService.emitBlocksReceived(response.blocks, peerPublicKey)
      } catch (emitError) {
        logger.error('[CE128] Failed to emit blocks received event', {
          peerPublicKey: `${peerPublicKey.slice(0, 20)}...`,
          blockCount: response.blocks.length,
          error:
            emitError instanceof Error ? emitError.message : String(emitError),
        })
        // Continue processing even if event emission fails
      }

      // Import blocks into chain manager (if available)
      // Note: chain-manager-service also handles blocks via the event bus,
      // but we do direct import here for immediate processing
      if (this.chainManagerService) {
        let successCount = 0
        let errorCount = 0
        for (let i = 0; i < response.blocks.length; i++) {
          const block = response.blocks[i]
          const [hashError, blockHash] = calculateBlockHashFromHeader(
            block.header,
            this.configService,
          )
          if (hashError) {
            logger.error('[CE128] Failed to calculate block hash for import', {
              peerPublicKey: `${peerPublicKey.slice(0, 20)}...`,
              blockIndex: i,
              error: hashError.message,
              slot: block.header.timeslot.toString(),
            })
            errorCount++
            continue
          }

          const [importError] =
            await this.chainManagerService.importBlock(block)
          if (importError) {
            // Log error but continue processing other blocks
            // The block importer service will handle full validation and import
            // This is just for chain manager to track the block structure
            logger.error('[CE128] Failed to import block into chain manager', {
              peerPublicKey: `${peerPublicKey.slice(0, 20)}...`,
              blockHash: `${blockHash.slice(0, 18)}...`,
              error: importError.message,
              slot: block.header.timeslot.toString(),
              blockIndex: i,
              totalBlocks: response.blocks.length,
            })
            errorCount++
          } else {
            logger.debug('[CE128] Block imported into chain manager', {
              peerPublicKey: `${peerPublicKey.slice(0, 20)}...`,
              blockHash: `${blockHash.slice(0, 18)}...`,
              slot: block.header.timeslot.toString(),
              blockIndex: i,
            })
            successCount++
          }
        }

        logger.info('[CE128] Block import summary', {
          peerPublicKey: `${peerPublicKey.slice(0, 20)}...`,
          totalBlocks: response.blocks.length,
          successCount,
          errorCount,
        })
      } else {
        logger.debug(
          '[CE128] Chain manager service not available, skipping direct import',
          {
            peerPublicKey: `${peerPublicKey.slice(0, 20)}...`,
            note: 'Blocks will be handled via event bus',
          },
        )
      }

      logger.info('[CE128] Block response processing completed', {
        peerPublicKey: `${peerPublicKey.slice(0, 20)}...`,
        totalBlocks: response.blocks.length,
        blockHashes: blockHashes.map((h) => `${h.slice(0, 18)}...`),
      })

      return safeResult(undefined)
    } catch (error) {
      logger.error('[CE128] Unexpected error in processResponse', {
        peerPublicKey: `${peerPublicKey.slice(0, 20)}...`,
        blockCount: response.blocks.length,
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
      })
      // Still try to emit the blocks so chain manager can attempt to handle them
      try {
        this.eventBusService.emitBlocksReceived(response.blocks, peerPublicKey)
      } catch (emitError) {
        logger.error(
          '[CE128] Failed to emit blocks received event after error',
          {
            error:
              emitError instanceof Error
                ? emitError.message
                : String(emitError),
          },
        )
      }
      return safeError(
        error instanceof Error
          ? error
          : new Error(`Unexpected error in processResponse: ${String(error)}`),
      )
    }
  }
}
