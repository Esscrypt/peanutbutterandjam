/**
 * CE 143: Preimage Request Protocol
 *
 * Implements the preimage request protocol for JAMNP-S
 * This is a Common Ephemeral (CE) stream for requesting preimages.
 */

import { decodePreimage, encodePreimage } from '@pbnjam/codec'
import type { EventBusService, Hex } from '@pbnjam/core'
import { blake2bHash, bytesToHex, hexToBytes, logger } from '@pbnjam/core'
import type {
  IServiceAccountService,
  Preimage,
  PreimageRequest,
  Safe,
  SafePromise,
} from '@pbnjam/types'
import { safeError, safeResult } from '@pbnjam/types'
import { NetworkingProtocol } from './protocol'

/**
 * Preimage request protocol handler
 */
export class PreimageRequestProtocol extends NetworkingProtocol<
  PreimageRequest,
  Preimage
> {
  private readonly eventBusService: EventBusService
  private readonly serviceAccountService?: IServiceAccountService | null
  // Track event IDs for request/response linking
  private readonly requestEventIds: Map<string, bigint> = new Map()

  constructor(
    eventBusService: EventBusService,
    serviceAccountService?: IServiceAccountService | null,
  ) {
    super()
    this.eventBusService = eventBusService
    this.serviceAccountService = serviceAccountService

    // Initialize event handlers using the base class method
    this.initializeEventHandlers()
  }

  /**
   * Generate a unique key for tracking request event IDs
   */
  private getRequestKey(peerPublicKey: Hex, hash: Hex): string {
    return `${peerPublicKey}:${hash}`
  }

  /**
   * Process preimage request and generate response
   */
  async processRequest(
    request: PreimageRequest,
    peerPublicKey: Hex,
  ): SafePromise<void> {
    logger.info('[CE143] Processing preimage request', {
      peerPublicKey: `${peerPublicKey.slice(0, 20)}...`,
      hash: request.hash,
    })

    // Emit JIP-3 receiving preimage request event
    const eventId = await this.eventBusService.emitReceivingPreimageRequest(
      hexToBytes(peerPublicKey),
    )

    // Store event ID for linking with response
    const requestKey = this.getRequestKey(peerPublicKey, request.hash)
    this.requestEventIds.set(requestKey, eventId)

    // Check if preimage is already pending (received but not yet accumulated)
    if (this.serviceAccountService) {
      const pendingPreimages = this.serviceAccountService.getPendingPreimages()
      const pendingPreimage = pendingPreimages.find((preimage: Preimage) => {
        const [hashError, preimageHash] = blake2bHash(hexToBytes(preimage.blob))
        return !hashError && preimageHash === request.hash
      })

      if (pendingPreimage) {
        // Preimage is already pending (received but not accumulated)
        // The service account service will handle the request via handlePreimageRequested
        // which checks stored preimages in service accounts
      }
    }

    // Emit JIP-3 preimage request received event
    await this.eventBusService.emitPreimageRequestReceived(
      eventId,
      hexToBytes(request.hash),
    )

    // Legacy event for backwards compatibility
    this.eventBusService.emitPreimageRequested(request, peerPublicKey)

    return safeResult(undefined)
  }

  /**
   * Serialize preimage request message
   */
  serializeRequest(request: PreimageRequest): Safe<Uint8Array> {
    return safeResult(hexToBytes(request.hash))
  }

  /**
   * Deserialize preimage request message
   */
  deserializeRequest(data: Uint8Array): Safe<PreimageRequest> {
    const hash = bytesToHex(data.slice(0, 32))

    return safeResult({
      hash: hash,
    })
  }

  /**
   * Serialize preimage response message
   */
  serializeResponse(response: Preimage): Safe<Uint8Array> {
    return encodePreimage(response)
  }

  /**
   * Deserialize preimage response message
   */
  deserializeResponse(data: Uint8Array): Safe<Preimage> {
    const [error, preimage] = decodePreimage(data)
    if (error) {
      return safeError(error)
    }
    return safeResult(preimage.value)
  }

  async processResponse(
    response: Preimage,
    peerPublicKey: Hex,
  ): SafePromise<void> {
    // Note: We need the hash from the original request to look up the event ID
    // Since the response doesn't include the hash, we'll use the first available event ID for this peer
    // In a full implementation, the response would include the request hash
    let eventId: bigint | undefined
    for (const [key, id] of this.requestEventIds.entries()) {
      if (key.startsWith(`${peerPublicKey}:`)) {
        eventId = id
        this.requestEventIds.delete(key)
        break
      }
    }

    // If no event ID found, generate a new one (fallback)
    if (eventId === undefined) {
      eventId = BigInt(Date.now())
    }

    // Emit JIP-3 preimage transferred event
    // Preimage.blob is a Hex string, convert to bytes to get length
    const preimageBytes = hexToBytes(response.blob)
    await this.eventBusService.emitPreimageTransferred(
      eventId,
      BigInt(preimageBytes.length),
    )

    // Legacy event for backwards compatibility
    this.eventBusService.emitPreimageReceived(response, peerPublicKey)
    return safeResult(undefined)
  }
}
