/**
 * CE 143: Preimage Request Protocol
 *
 * Implements the preimage request protocol for JAMNP-S
 * This is a Common Ephemeral (CE) stream for requesting preimages.
 */

import type { Safe, SafePromise } from '@pbnj/core'
import { bytesToHex, hexToBytes, safeError, safeResult } from '@pbnj/core'
import { decodePreimage, encodePreimage } from '@pbnj/serialization'
import type {
  IClockService,
  IPreimageHolderService,
  Preimage,
  PreimageRequest,
} from '@pbnj/types'
import { NetworkingProtocol } from './protocol'

/**
 * Preimage request protocol handler
 */
export class PreimageRequestProtocol extends NetworkingProtocol<
  PreimageRequest,
  Preimage
> {
  private readonly preimageHolderService: IPreimageHolderService
  private readonly clockService: IClockService
  constructor(
    preimageHolderService: IPreimageHolderService,
    clockService: IClockService,
  ) {
    super()
    this.preimageHolderService = preimageHolderService
    this.clockService = clockService
  }

  /**
   * Process preimage request and generate response
   */
  async processRequest(request: PreimageRequest): SafePromise<Preimage> {
    const [error, preimage] = await this.preimageHolderService.getPreimage(
      request.hash,
    )
    if (error) {
      return safeError(error)
    }
    if (preimage) {
      return safeResult(preimage)
    }

    const [error2, preimageFromDatabase] =
      await this.preimageHolderService.getPreimage(request.hash)
    if (error2) {
      return safeError(error2)
    }
    if (preimageFromDatabase) {
      return safeResult(preimageFromDatabase)
    }
    return safeError(new Error('Preimage not found'))
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

  async processResponse(response: Preimage): SafePromise<void> {
    this.preimageHolderService.storePreimage(
      response,
      this.clockService.getCurrentSlot(),
    )
    return safeResult(undefined)
  }
}
