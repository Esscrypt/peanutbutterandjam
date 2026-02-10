/**
 * Batch Block Request Helpers
 *
 * Simplified functions for requesting batches of blocks
 */

import { type Hex, logger } from '@pbnjam/core'
import type {
  IBlockRequestProtocol,
  INetworkingService,
  IStateRequestProtocol,
  SafePromise,
} from '@pbnjam/types'
import { safeError, safeResult } from '@pbnjam/types'
import {
  isSequentialChain,
  type Leaf,
  requestBlock,
  requestBlockSequence,
  requestStateForBlock,
} from './helpers'

/**
 * Request a batch of blocks following the state-then-block flow
 *
 * Simplified version that:
 * 1. Validates if leaves form a sequential chain
 * 2. Requests state for the first block
 * 3. After state is set, requests blocks (single or sequence)
 *
 * @param leaves - Array of leaves (hash and slot) to request, sorted by slot
 * @param peerPublicKey - Public key of the peer to request from
 * @param stateRequestProtocol - State request protocol instance
 * @param networkingService - Networking service instance
 * @param pendingBlockRequests - Map to track pending block requests (blockHash -> peerPublicKey)
 * @param pendingStateRequests - Map to track pending state requests (blockHash -> peerPublicKey)
 * @param pendingChainRequests - Map to track sequential chain requests (blockHash -> chainLength)
 * @returns Promise that resolves when all state requests are initiated
 */
export async function requestBatchOfBlocks(
  leaves: Leaf[],
  peerPublicKey: Hex,
  stateRequestProtocol: IStateRequestProtocol,
  networkingService: INetworkingService,
  pendingBlockRequests: Map<Hex, Hex>,
  pendingStateRequests: Map<Hex, Hex>,
  pendingChainRequests: Map<Hex, number>,
): Promise<void> {
  if (leaves.length === 0) {
    return
  }

  // Validate if leaves form a sequential chain
  const isSequential = isSequentialChain(leaves)

  if (isSequential && leaves.length > 1) {
    // Sequential chain: request state for first block, then request entire sequence
    const firstLeaf = leaves[0]
    const blockHash = firstLeaf.hash

    // Track pending requests (we only need the hash and peerPublicKey)
    pendingBlockRequests.set(blockHash, peerPublicKey)
    pendingStateRequests.set(blockHash, peerPublicKey)
    pendingChainRequests.set(blockHash, leaves.length)

    // Request state for first block
    const [stateError] = await requestStateForBlock(
      blockHash,
      peerPublicKey,
      stateRequestProtocol,
      networkingService,
    )

    if (stateError) {
      logger.error('Failed to request state for sequential chain', {
        blockHash: `${blockHash.substring(0, 18)}...`,
        chainLength: leaves.length,
        error: stateError.message,
      })
      // Clean up pending requests on error
      pendingBlockRequests.delete(blockHash)
      pendingStateRequests.delete(blockHash)
      pendingChainRequests.delete(blockHash)
    } else {
      logger.debug('State request initiated for sequential chain', {
        blockHash: `${blockHash.substring(0, 18)}...`,
        chainLength: leaves.length,
        startSlot: firstLeaf.slot.toString(),
        endSlot: leaves[leaves.length - 1].slot.toString(),
      })
    }
  } else {
    // Non-sequential or single block: request state for each block individually
    const requestPromises = leaves.map(async (leaf) => {
      const blockHash = leaf.hash

      // Track pending requests (we only need the hash and peerPublicKey)
      pendingBlockRequests.set(blockHash, peerPublicKey)
      pendingStateRequests.set(blockHash, peerPublicKey)

      // Request state for this block
      const [stateError] = await requestStateForBlock(
        blockHash,
        peerPublicKey,
        stateRequestProtocol,
        networkingService,
      )

      if (stateError) {
        logger.error('Failed to request state for leaf in batch', {
          blockHash: `${blockHash.substring(0, 18)}...`,
          error: stateError.message,
        })
        // Clean up pending requests on error
        pendingBlockRequests.delete(blockHash)
        pendingStateRequests.delete(blockHash)
      } else {
        logger.debug('State request initiated for leaf', {
          blockHash: `${blockHash.substring(0, 18)}...`,
          slot: leaf.slot.toString(),
        })
      }
    })

    // Wait for all state requests to be initiated
    await Promise.all(requestPromises)
  }
}

/**
 * Handle state response and trigger block request
 *
 * Called after state is set to request the corresponding block(s)
 *
 * @param blockHash - Block hash that state was requested for
 * @param peerPublicKey - Public key of the peer
 * @param blockRequestProtocol - Block request protocol instance
 * @param networkingService - Networking service instance
 * @param pendingChainRequests - Map to track sequential chain requests
 * @returns Promise that resolves when block request is sent
 */
export async function handleStateResponseAndRequestBlock(
  blockHash: Hex,
  peerPublicKey: Hex,
  blockRequestProtocol: IBlockRequestProtocol,
  networkingService: INetworkingService,
  pendingChainRequests: Map<Hex, number>,
): SafePromise<void> {
  // Check if this is part of a sequential chain request
  const chainLength = pendingChainRequests.get(blockHash)
  if (chainLength && chainLength > 1) {
    // Request entire sequence in one CE128 request
    pendingChainRequests.delete(blockHash)
    const [error] = await requestBlockSequence(
      blockHash,
      BigInt(chainLength),
      peerPublicKey,
      blockRequestProtocol,
      networkingService,
    )
    if (error) {
      logger.error('Failed to request block sequence after state set', {
        blockHash: `${blockHash.substring(0, 18)}...`,
        chainLength,
        error: error.message,
      })
      return safeError(error)
    }
    logger.debug('Requested block sequence after state set', {
      blockHash: `${blockHash.substring(0, 18)}...`,
      chainLength,
    })
    return safeResult(undefined)
  } else {
    // Single block request
    return await requestBlock(
      blockHash,
      peerPublicKey,
      blockRequestProtocol,
      networkingService,
    )
  }
}
