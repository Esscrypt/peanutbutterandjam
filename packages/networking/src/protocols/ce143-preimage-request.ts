/**
 * CE 143: Preimage Request Protocol
 *
 * Implements the preimage request protocol for JAMNP-S
 * This is a Common Ephemeral (CE) stream for requesting preimages.
 */

import type { Hex, Safe, SafePromise } from '@pbnj/core'
import { bytesToHex, hexToBytes, safeError, safeResult } from '@pbnj/core'
import { decodePreimage, encodePreimage } from '@pbnj/serialization'
import type { PreimageStore } from '@pbnj/state'
import type { Preimage, PreimageRequest } from '@pbnj/types'
import { NetworkingProtocol } from './protocol'

/**
 * Preimage request protocol handler
 */
export class PreimageRequestProtocol extends NetworkingProtocol<
  PreimageRequest,
  Preimage
> {
  private preimages: Map<Hex, Preimage> = new Map()
  private preimageStore: PreimageStore

  constructor(preimageStore: PreimageStore) {
    super()
    this.preimageStore = preimageStore
  }

  /**
   * Store preimage in local store and persist to database
   */
  async storePreimage(
    hash: Hex,
    serviceIndex: bigint,
    preimage: Preimage,
  ): Promise<void> {
    this.preimages.set(hash, preimage)

    await this.preimageStore.storePreimage(preimage, hash, serviceIndex)
  }

  /**
   * Get preimage from local store
   */
  getPreimage(hash: Hex): Preimage | undefined {
    return this.preimages.get(hash)
  }

  /**
   * Process preimage request and generate response
   */
  async processRequest(request: PreimageRequest): SafePromise<Preimage> {
    if (this.preimages.has(request.hash)) {
      return safeResult(this.preimages.get(request.hash)!)
    }

    const [error, preimageFromDatabase] = await this.preimageStore.getPreimage(
      request.hash,
    )
    if (error) {
      return safeError(error)
    }
    if (preimageFromDatabase) {
      return safeResult(preimageFromDatabase)
    }
    return safeError(new Error('Preimage not found'))
  }

  /**
   * Create preimage request message
   */
  // createPreimageRequest(hash: Hex): PreimageRequest {
  //   return {
  //     hash,
  //   }
  // }

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

  async processResponse(_response: Preimage): SafePromise<void> {
    return safeResult(undefined)
  }
}
