/**
 * CE 143: Preimage Request Protocol
 *
 * Implements the preimage request protocol for JAMNP-S
 * This is a Common Ephemeral (CE) stream for requesting preimages.
 */

import type { EventBusService, Hex } from '@pbnj/core'
import { bytesToHex, hexToBytes } from '@pbnj/core'
import { decodePreimage, encodePreimage } from '@pbnj/codec'
import type { Preimage, PreimageRequest, Safe, SafePromise } from '@pbnj/types'
import { safeError, safeResult } from '@pbnj/types'
import { NetworkingProtocol } from './protocol'

/**
 * Preimage request protocol handler
 */
export class PreimageRequestProtocol extends NetworkingProtocol<
  PreimageRequest,
  Preimage
> {
  private readonly eventBusService: EventBusService
  constructor(eventBusService: EventBusService) {
    super()
    this.eventBusService = eventBusService

    // Initialize event handlers using the base class method
    this.initializeEventHandlers()
  }

  /**
   * Process preimage request and generate response
   */
  async processRequest(
    request: PreimageRequest,
    peerPublicKey: Hex,
  ): SafePromise<void> {
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
    this.eventBusService.emitPreimageReceived(response, peerPublicKey)
    return safeResult(undefined)
  }
}
