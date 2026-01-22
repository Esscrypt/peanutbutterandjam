/**
 * Chain Manager Helpers
 *
 * Utility functions for chain management operations
 */

import type { Hex } from '@pbnjam/core'
import { hexToBytes } from '@pbnjam/core'
import type {
  BlockRequest,
  IBlockRequestProtocol,
  INetworkingService,
  IStateRequestProtocol,
  SafePromise,
  StateRequest,
  StreamKind,
} from '@pbnjam/types'
import { BlockRequestDirection, safeError, safeResult } from '@pbnjam/types'

// CE128 = 128, CE129 = 129
// const CE128_STREAM_KIND = 128 as StreamKind
const CE129_STREAM_KIND = 129 as StreamKind

/**
 * Leaf structure for block requests
 */
export interface Leaf {
  hash: Hex
  slot: bigint
}

/**
 * Check if leaves form a sequential chain (consecutive slots)
 *
 * @param leaves - Array of leaves to check, must be sorted by slot
 * @returns true if all leaves have consecutive slots
 */
export function isSequentialChain(leaves: Leaf[]): boolean {
  if (leaves.length <= 1) {
    return true
  }

  for (let i = 1; i < leaves.length; i++) {
    if (leaves[i].slot !== leaves[i - 1].slot + 1n) {
      return false
    }
  }

  return true
}

/**
 * Request state for a block via CE129
 *
 * @param blockHash - Block hash to request state for
 * @param peerPublicKey - Public key of the peer to request from
 * @param stateRequestProtocol - State request protocol instance
 * @param networkingService - Networking service instance
 * @returns Safe result indicating success or failure
 */
export async function requestStateForBlock(
  blockHash: Hex,
  peerPublicKey: Hex,
  stateRequestProtocol: IStateRequestProtocol,
  networkingService: INetworkingService,
): SafePromise<void> {
  // Create state request: request all state (startKey = 0x00..., endKey = 0xff...)
  const stateRequest: StateRequest = {
    headerHash: new Uint8Array(32), // Will be converted from hex
    startKey: new Uint8Array(31).fill(0x00), // All zeros
    endKey: new Uint8Array(31).fill(0xff), // All ones
    maximumSize: BigInt(10 * 1024 * 1024), // 10MB max
  }

  stateRequest.headerHash = hexToBytes(blockHash)

  // Serialize state request
  const [serializeError, serializedRequest] =
    stateRequestProtocol.serializeRequest(stateRequest)
  if (serializeError) {
    return safeError(serializeError)
  }

  // Send state request via networking service (CE129, kind 129)
  const [sendError] = await networkingService.sendMessageByPublicKey(
    peerPublicKey,
    CE129_STREAM_KIND,
    serializedRequest,
  )
  if (sendError) {
    return safeError(sendError)
  }

  // Close the stream to send FIN after the request
  const [closeError] = await networkingService.closeStreamForPeer(peerPublicKey)
  if (closeError) {
    return safeError(closeError)
  }

  return safeResult(undefined)
}

/**
 * Request a single block via CE128
 *
 * @param blockHash - Block hash to request
 * @param peerPublicKey - Public key of the peer to request from
 * @param blockRequestProtocol - Block request protocol instance
 * @param networkingService - Networking service instance
 * @returns Safe result indicating success or failure
 */
export async function requestBlock(
  blockHash: Hex,
  peerPublicKey: Hex,
  blockRequestProtocol: IBlockRequestProtocol,
  networkingService: INetworkingService,
): SafePromise<void> {
  // Create block request
  const blockRequest: BlockRequest = {
    headerHash: blockHash,
    direction: BlockRequestDirection.ASCENDING_EXCLUSIVE,
    maximumBlocks: 1n,
  }

  // Serialize block request
  const [serializeError, serializedRequest] =
    blockRequestProtocol.serializeRequest(blockRequest)
  if (serializeError) {
    return safeError(serializeError)
  }

  // Send block request via networking service (CE128, kind 128)
  const [sendError] = await networkingService.sendMessageByPublicKey(
    peerPublicKey,
    128 as StreamKind, // CE128 block request protocol
    serializedRequest,
  )
  if (sendError) {
    return safeError(sendError)
  }

  return safeResult(undefined)
}

/**
 * Request a sequence of blocks via CE128
 *
 * @param startBlockHash - Starting block hash for the sequence
 * @param blockCount - Number of blocks to request in the sequence
 * @param peerPublicKey - Public key of the peer to request from
 * @param blockRequestProtocol - Block request protocol instance
 * @param networkingService - Networking service instance
 * @returns Safe result indicating success or failure
 */
export async function requestBlockSequence(
  startBlockHash: Hex,
  blockCount: bigint,
  peerPublicKey: Hex,
  blockRequestProtocol: IBlockRequestProtocol,
  networkingService: INetworkingService,
): SafePromise<void> {
  // Create block request for sequence
  const blockRequest: BlockRequest = {
    headerHash: startBlockHash,
    direction: BlockRequestDirection.ASCENDING_EXCLUSIVE,
    maximumBlocks: blockCount,
  }

  // Serialize block request
  const [serializeError, serializedRequest] =
    blockRequestProtocol.serializeRequest(blockRequest)
  if (serializeError) {
    return safeError(serializeError)
  }

  // Send block request via networking service (CE128, kind 128)
  const [sendError] = await networkingService.sendMessageByPublicKey(
    peerPublicKey,
    128 as StreamKind, // CE128 block request protocol
    serializedRequest,
  )
  if (sendError) {
    return safeError(sendError)
  }

  return safeResult(undefined)
}
