/**
 * CE 129: State Request Protocol
 *
 * Implements the state request protocol for JAMNP-S
 * This is a Common Ephemeral (CE) stream for requesting ranges of state trie data.
 */

import type { EventBusService, Hex } from '@pbnj/core'
import { bytesToHex, concatBytes, hexToBytes } from '@pbnj/core'
import { decodeFixedLength, encodeFixedLength } from '@pbnj/serialization'
import type {
  Safe,
  SafePromise,
  StateRequest,
  StateResponse,
} from '@pbnj/types'
import { safeError, safeResult } from '@pbnj/types'
import { NetworkingProtocol } from './protocol'

/**
 * State request protocol handler
 */
export class StateRequestProtocol extends NetworkingProtocol<
  StateRequest,
  StateResponse
> {
  private readonly eventBusService: EventBusService
  constructor(eventBusService: EventBusService) {
    super()
    this.eventBusService = eventBusService

    this.initializeEventHandlers()
  }

  /**
   * Process state request and generate response
   */
  async processRequest(
    request: StateRequest,
    peerPublicKey: Hex,
  ): SafePromise<void> {
    this.eventBusService.emitStateRequested(request, peerPublicKey)
    return safeResult(undefined)
  }

  async processResponse(
    response: StateResponse,
    peerPublicKey: Hex,
  ): SafePromise<void> {
    this.eventBusService.emitStateResponse(response, peerPublicKey)
    // No response processing needed for state request protocol
    return safeResult(undefined)
  }

  /**
   * Serialize state request message
   */
  serializeRequest(request: StateRequest): Safe<Uint8Array> {
    // Serialize according to JAMNP-S specification
    const parts: Uint8Array[] = []
    parts.push(request.headerHash)
    parts.push(request.startKey)
    parts.push(request.endKey)
    const [error, maximumSize] = encodeFixedLength(request.maximumSize, 4n)
    if (error) {
      return safeError(error)
    }
    parts.push(maximumSize)
    return safeResult(concatBytes(parts))
  }

  /**
   * Deserialize state request message
   */
  deserializeRequest(data: Uint8Array): Safe<StateRequest> {
    let currentData = data
    const headerHash = bytesToHex(currentData.slice(0, 32))
    currentData = currentData.slice(32)

    const startKey = bytesToHex(currentData.slice(0, 32))
    currentData = currentData.slice(32)

    const endKey = bytesToHex(currentData.slice(0, 32))
    currentData = currentData.slice(32)

    const maximumSize = bytesToHex(currentData.slice(0, 4))
    currentData = currentData.slice(4)

    return safeResult({
      headerHash: hexToBytes(headerHash),
      startKey: hexToBytes(startKey),
      endKey: hexToBytes(endKey),
      maximumSize: BigInt(maximumSize),
    })
  }

  /**
   * Serialize state response message
   */
  serializeResponse(response: StateResponse): Safe<Uint8Array> {
    // Calculate total size
    const parts: Uint8Array[] = []
    const [error, numberOfBoundaryNodes] = encodeFixedLength(
      BigInt(response.boundaryNodes.length),
      4n,
    )
    if (error) {
      return safeError(error)
    }
    parts.push(numberOfBoundaryNodes)
    for (const node of response.boundaryNodes) {
      parts.push(node)
    }
    const [error2, numberOfKeyValuePairs] = encodeFixedLength(
      BigInt(response.keyValuePairs.length),
      4n,
    )
    if (error2) {
      return safeError(error2)
    }
    parts.push(numberOfKeyValuePairs)
    for (const pair of response.keyValuePairs) {
      const [error3, key] = encodeFixedLength(BigInt(pair.key.length), 4n)
      if (error3) {
        return safeError(error3)
      }
      parts.push(key)
      const [error4, value] = encodeFixedLength(BigInt(pair.value.length), 4n)
      if (error4) {
        return safeError(error4)
      }
      parts.push(value)
    }
    return safeResult(concatBytes(parts))
  }

  /**
   * Deserialize state response message
   */
  deserializeResponse(data: Uint8Array): Safe<StateResponse> {
    let currentData = data
    const [error, numberOfBoundaryNodes] = decodeFixedLength(currentData, 4n)
    if (error) {
      return safeError(error)
    }
    currentData = currentData.slice(4)
    const boundaryNodes: Uint8Array[] = []
    for (let i = 0; i < numberOfBoundaryNodes.value; i++) {
      const node = currentData.slice(0, 32)
      currentData = currentData.slice(32)
      boundaryNodes.push(node)
    }
    const [error2, numberOfKeyValuePairs] = decodeFixedLength(currentData, 4n)
    if (error2) {
      return safeError(error2)
    }
    currentData = currentData.slice(4)
    const keyValuePairs: Array<{ key: Uint8Array; value: Uint8Array }> = []
    for (let i = 0; i < numberOfKeyValuePairs.value; i++) {
      const key = currentData.slice(0, 32)
      currentData = currentData.slice(32)
      const value = currentData.slice(0, 32)
      currentData = currentData.slice(32)
      keyValuePairs.push({ key, value })
    }

    return safeResult({
      boundaryNodes,
      keyValuePairs,
    })
  }
}
