/**
 * UP 0: Block Announcement Protocol
 *
 * Implements the block announcement protocol for JAMNP-S.
 * This is a Unique Persistent (UP) stream that should be opened between neighbors
 * in the validator grid structure.
 *
 * This implementation is a placeholder and will be replaced with a more complete
 * implementation in the future.
 */

import {
  calculateBlockHashFromHeader,
  decodeAnnouncementFinal,
  decodeHandshake,
  decodeHeader,
  encodeAnnouncementFinal,
  encodeHandshake,
  encodeHeader,
} from '@pbnjam/codec'
import {
  bytesToHex,
  concatBytes,
  type EventBusService,
  type Hex,
  hexToBytes,
  logger,
} from '@pbnjam/core'
import type {
  BlockAnnouncement,
  BlockAnnouncementHandshake,
  IConfigService,
  Safe,
  SafePromise,
} from '@pbnjam/types'
import { safeError, safeResult } from '@pbnjam/types'
import { NetworkingProtocol } from './protocol'

/**
 * Type guard for BlockAnnouncementHandshake
 */
function isBlockAnnouncementHandshake(
  data: BlockAnnouncement | BlockAnnouncementHandshake,
): data is BlockAnnouncementHandshake {
  return 'leaves' in data && !('header' in data)
}

/**
 * Type guard for BlockAnnouncement
 */
function isBlockAnnouncement(
  data: BlockAnnouncement | BlockAnnouncementHandshake,
): data is BlockAnnouncement {
  return 'header' in data && !('leaves' in data)
}

/**
 * Block announcement protocol handler
 */
export class BlockAnnouncementProtocol extends NetworkingProtocol<
  BlockAnnouncement | BlockAnnouncementHandshake,
  void
> {
  private readonly configService: IConfigService
  private readonly eventBusService: EventBusService

  /**
   * Consumer: ChainManagerService handles block announcements via event subscription
   */
  constructor(configService: IConfigService, eventBusService: EventBusService) {
    super()
    this.configService = configService
    this.eventBusService = eventBusService

    // Initialize event handlers using the base class method
    this.initializeEventHandlers()
  }

  /**
   * Serialize request (either handshake or announcement)
   */
  serializeRequest(
    data: BlockAnnouncement | BlockAnnouncementHandshake,
  ): Safe<Uint8Array> {
    try {
      if (isBlockAnnouncementHandshake(data)) {
        // It's a handshake
        logger.debug('[UP0] Serializing handshake request', {
          finalBlockSlot: data.finalBlockSlot.toString(),
          leavesCount: data.leaves.length,
        })
        return this.serializeHandshake(data)
      } else if (isBlockAnnouncement(data)) {
        // It's a block announcement
        logger.debug('[UP0] Serializing block announcement request', {
          finalBlockSlot: data.finalBlockSlot.toString(),
          headerParent: `${data.header.parent.slice(0, 20)}...`,
        })
        return this.serializeBlockAnnouncement(data)
      } else {
        return safeError(
          new Error('Unknown message type: neither handshake nor announcement'),
        )
      }
    } catch (error) {
      logger.error('[UP0] Failed to serialize request', {
        error: error instanceof Error ? error.message : String(error),
      })
      return safeError(
        error instanceof Error ? error : new Error(String(error)),
      )
    }
  }

  /**
   * Deserialize request (either handshake or announcement)
   */
  deserializeRequest(
    data: Uint8Array,
  ): Safe<BlockAnnouncement | BlockAnnouncementHandshake> {
    // Try to decode as handshake first (Final ++ len++[Leaf])
    // Handshake starts with Final which is 36 bytes (32 hash + 4 slot)
    // Then has variable-length sequence
    const [handshakeError, handshakeResult] = this.deserializeHandshake(data)
    if (!handshakeError && handshakeResult) {
      logger.info('[UP0] Successfully decoded as handshake', {
        finalBlockSlot: handshakeResult.finalBlockSlot.toString(),
        leavesCount: handshakeResult.leaves.length,
      })
      return safeResult(handshakeResult)
    }

    logger.debug('[UP0] Handshake decode failed, trying as announcement', {
      handshakeError: handshakeError?.message,
    })

    // If handshake fails, try as announcement (Header ++ Final)
    const [announcementError, announcementResult] =
      this.deserializeBlockAnnouncement(data)
    if (announcementError) {
      logger.error('[UP0] Failed to decode as handshake or announcement', {
        handshakeError: handshakeError?.message,
        announcementError: announcementError.message,
        dataLength: data.length,
      })
      return safeError(
        new Error(
          `Failed to decode as handshake or announcement: handshake=${handshakeError?.message}, announcement=${announcementError.message}`,
        ),
      )
    }

    logger.info('[UP0] Successfully decoded as block announcement', {
      finalBlockSlot: announcementResult.finalBlockSlot.toString(),
      headerParent: `${announcementResult.header.parent.slice(0, 20)}...`,
    })

    return safeResult(announcementResult)
  }

  /**
   * Serialize response (void)
   */
  serializeResponse(_data: undefined): Safe<Uint8Array> {
    return safeResult(new Uint8Array())
  }

  /**
   * Deserialize response (void)
   */
  deserializeResponse(_data: Uint8Array): Safe<void> {
    return safeResult(undefined)
  }

  /**
   * Process request (either handshake or announcement)
   */
  async processRequest(
    data: BlockAnnouncement | BlockAnnouncementHandshake,
    peerPublicKey: Hex,
  ): SafePromise<void> {
    try {
      if (isBlockAnnouncementHandshake(data)) {
        // // It's a handshake
        logger.info('[UP0] Processing handshake request', {
          peerPublicKey: `${peerPublicKey.slice(0, 20)}...`,
          finalBlockSlot: data.finalBlockSlot.toString(),
          leavesCount: data.leaves.length,
        })

        // Emit handshake event for chain manager consumption
        await this.eventBusService.emitBlockAnnouncementHandshake(
          hexToBytes(peerPublicKey),
          data,
        )
      } else if (isBlockAnnouncement(data)) {
        // It's a block announcement
        logger.info('[UP0] Processing block announcement request', {
          peerPublicKey: `${peerPublicKey.slice(0, 20)}...`,
          finalBlockSlot: data.finalBlockSlot.toString(),
          headerParent: `${data.header.parent.slice(0, 20)}...`,
          headerSlot: data.header.timeslot.toString(),
        })

        // Emit JIP-3 block announced event (for telemetry)
        const [hashError, headerHash] = calculateBlockHashFromHeader(
          data.header,
          this.configService,
        )
        if (!hashError) {
          await this.eventBusService.emitBlockAnnounced(
            hexToBytes(peerPublicKey),
            'remote', // Received from peer
            data.header.timeslot,
            hexToBytes(headerHash),
          )
        }

        // Emit block announcement with header for chain manager consumption
        await this.eventBusService.emitBlockAnnouncementWithHeader(
          hexToBytes(peerPublicKey),
          data.header,
        )
      } else {
        logger.error('[UP0] Unknown message type', {
          peerPublicKey: `${peerPublicKey.slice(0, 20)}...`,
          dataKeys: Object.keys(data),
        })
        return safeError(
          new Error('Unknown message type: neither handshake nor announcement'),
        )
      }
      return safeResult(undefined)
    } catch (error) {
      logger.error('[UP0] Error processing request', {
        peerPublicKey: `${peerPublicKey.slice(0, 20)}...`,
        error: error instanceof Error ? error.message : String(error),
      })
      return safeError(
        error instanceof Error ? error : new Error(String(error)),
      )
    }
  }

  /**
   * Process response (void)
   */
  async processResponse(
    _data: undefined,
    _peerPublicKey: Hex,
  ): SafePromise<void> {
    return safeResult(undefined)
  }

  /**
   * Serialize handshake message
   * Format: Final ++ len++[Leaf]
   * Where Final = Header Hash ++ Slot, Leaf = Header Hash ++ Slot
   */
  serializeHandshake(handshake: BlockAnnouncementHandshake): Safe<Uint8Array> {
    logger.debug('[UP0] Serializing handshake', {
      finalBlockSlot: handshake.finalBlockSlot.toString(),
      finalBlockHash: bytesToHex(handshake.finalBlockHash),
      leavesCount: handshake.leaves.length,
    })

    // Convert to codec format
    const handshakeData = {
      final: {
        headerHash: handshake.finalBlockHash,
        slot: handshake.finalBlockSlot,
      },
      leaves: handshake.leaves.map((leaf) => ({
        headerHash: leaf.hash,
        slot: leaf.slot,
      })),
    }

    const [error, encoded] = encodeHandshake(handshakeData)
    if (error) {
      logger.error('[UP0] Failed to encode handshake', {
        error: error.message,
      })
      return safeError(error)
    }

    logger.debug('[UP0] Handshake encoded successfully', {
      encodedLength: encoded.length,
    })

    return safeResult(encoded)
  }

  /**
   * Deserialize handshake message
   * Format: Final ++ len++[Leaf]
   * Where Final = Header Hash ++ Slot, Leaf = Header Hash ++ Slot
   */
  deserializeHandshake(data: Uint8Array): Safe<BlockAnnouncementHandshake> {
    logger.debug('[UP0] Deserializing handshake', {
      dataLength: data.length,
      dataPreview: bytesToHex(data.slice(0, Math.min(36, data.length))),
    })

    const [error, result] = decodeHandshake(data)
    if (error) {
      logger.debug('[UP0] Failed to decode handshake', {
        error: error.message,
        dataLength: data.length,
      })
      return safeError(error)
    }

    // Convert from codec format
    const handshake = {
      finalBlockHash: result.value.final.headerHash,
      finalBlockSlot: result.value.final.slot,
      leaves: result.value.leaves.map((leaf) => ({
        hash: leaf.headerHash,
        slot: leaf.slot,
      })),
    }

    logger.debug('[UP0] Handshake decoded successfully', {
      finalBlockSlot: handshake.finalBlockSlot.toString(),
      finalBlockHash: bytesToHex(handshake.finalBlockHash),
      leavesCount: handshake.leaves.length,
      consumed: result.consumed,
    })

    return safeResult(handshake)
  }

  /**
   * Serialize block announcement message
   * Format: Header ++ Final
   * Where Final = Header Hash ++ Slot
   */
  serializeBlockAnnouncement(
    announcement: BlockAnnouncement,
  ): Safe<Uint8Array> {
    // Encode header (Gray Paper format)
    const [headerError, encodedHeader] = encodeHeader(
      announcement.header,
      this.configService,
    )
    if (headerError) {
      logger.error('[UP0] Failed to encode header', {
        error: headerError.message,
      })
      return safeError(headerError)
    }

    // Encode Final
    const final = {
      headerHash: hexToBytes(announcement.finalBlockHash),
      slot: announcement.finalBlockSlot,
    }
    const [finalError, encodedFinal] = encodeAnnouncementFinal(final)
    if (finalError) {
      logger.error('[UP0] Failed to encode final', {
        error: finalError.message,
      })
      return safeError(finalError)
    }

    // Combine: [Header][Final]
    const encoded = concatBytes([encodedHeader, encodedFinal])
    logger.debug('[UP0] Block announcement encoded successfully', {
      headerLength: encodedHeader.length,
      finalLength: encodedFinal.length,
      totalLength: encoded.length,
    })

    return safeResult(encoded)
  }

  /**
   * Deserialize block announcement message
   * Format: Header ++ Final
   * Where Final = Header Hash ++ Slot
   */
  deserializeBlockAnnouncement(data: Uint8Array): Safe<BlockAnnouncement> {
    // Decode header (Gray Paper format)
    const [headerError, decodedHeader] = decodeHeader(data, this.configService)
    if (headerError) {
      logger.debug('[UP0] Failed to decode header', {
        error: headerError.message,
        dataLength: data.length,
      })
      return safeError(headerError)
    }
    const header = decodedHeader.value

    // Decode Final
    const [finalError, finalResult] = decodeAnnouncementFinal(
      decodedHeader.remaining,
    )
    if (finalError) {
      logger.debug('[UP0] Failed to decode final', {
        error: finalError.message,
        remainingLength: decodedHeader.remaining.length,
      })
      return safeError(finalError)
    }

    const announcement = {
      header,
      finalBlockHash: bytesToHex(finalResult.value.headerHash),
      finalBlockSlot: finalResult.value.slot,
    }

    logger.debug('[UP0] Block announcement decoded successfully', {
      finalBlockSlot: announcement.finalBlockSlot.toString(),
      finalBlockHash: announcement.finalBlockHash,
      headerSlot: announcement.header.timeslot.toString(),
    })

    return safeResult(announcement)
  }
}
