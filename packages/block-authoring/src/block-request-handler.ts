/**
 * Block Request Handler
 *
 * Handles block requests by serializing and sending them via the networking service
 */

import type { Hex } from '@pbnjam/core'
import { logger } from '@pbnjam/core'
import type {
  BlockRequest,
  IBlockRequestProtocol,
  INetworkingService,
  StreamKind,
} from '@pbnjam/types'

/**
 * Handle a block request by serializing and sending it via the networking service
 *
 * @param request - Block request to send
 * @param peerPublicKey - Public key of the peer to send the request to
 * @param blockRequestProtocol - Block request protocol instance for serialization
 * @param networkingService - Networking service instance for sending messages
 * @returns Promise that resolves when the request is sent (or fails)
 */
export async function handleBlockRequest(
  request: BlockRequest,
  peerPublicKey: Hex,
  blockRequestProtocol: IBlockRequestProtocol,
  networkingService: INetworkingService,
): Promise<void> {
  try {
    // Serialize the block request
    const [serializeError, serializedRequest] =
      blockRequestProtocol.serializeRequest(request)
    if (serializeError) {
      logger.error('Failed to serialize block request', {
        error: serializeError.message,
        headerHash: request.headerHash,
      })
      return
    }

    // Send request via networking service (CE128, kind 128)
    const [sendError] = await networkingService.sendMessageByPublicKey(
      peerPublicKey,
      128 as StreamKind, // CE128 block request protocol
      serializedRequest,
    )
    if (sendError) {
      logger.error('Failed to send block request', {
        error: sendError.message,
        peerPublicKey: `${peerPublicKey.substring(0, 20)}...`,
        headerHash: request.headerHash,
      })
      return
    }

    logger.debug('Block request sent', {
      peerPublicKey: `${peerPublicKey.substring(0, 20)}...`,
      headerHash: `${request.headerHash.substring(0, 18)}...`,
      direction: request.direction,
      maximumBlocks: request.maximumBlocks.toString(),
    })

    // Close the stream to send FIN after the request
    const [closeError] =
      await networkingService.closeStreamForPeer(peerPublicKey)
    if (closeError) {
      logger.error('Failed to close stream after block request', {
        error: closeError.message,
        peerPublicKey: `${peerPublicKey.substring(0, 20)}...`,
        headerHash: request.headerHash,
      })
    }
  } catch (error) {
    logger.error('Error handling block request', {
      error: error instanceof Error ? error.message : String(error),
      peerPublicKey: `${peerPublicKey.substring(0, 20)}...`,
    })
  }
}
