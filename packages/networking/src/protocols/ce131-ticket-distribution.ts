/**
 * CE 131: Ticket Distribution Protocol (Generator to Proxy Validator)
 *
 * Implements the first step of Safrole ticket distribution for JAMNP-S
 * Generator validator sends ticket to deterministically-selected proxy validator
 */

import { concatBytes, type EventBusService, type Hex } from '@pbnj/core'

import { decodeFixedLength, encodeFixedLength } from '@pbnj/codec'
import type { Safe, SafePromise, TicketDistributionRequest } from '@pbnj/types'
import { safeError, safeResult } from '@pbnj/types'
import { NetworkingProtocol } from './protocol'

/**
 * CE 131: Generator to Proxy Validator Ticket Distribution
 */
// Attempt = 0 OR 1 (Single byte) -> entryIndex
// Bandersnatch RingVRF Proof = [u8; 784]
// Ticket = Attempt ++ Bandersnatch RingVRF Proof (As in GP)

// Validator -> Validator

// --> Epoch Index ++ Ticket (Epoch index should identify the epoch that the ticket will be used in)
// --> FIN
// <-- FIN
/**
 * Event-driven handler for CE131 Ticket Distribution Protocol
 */
export class CE131TicketDistributionProtocol extends NetworkingProtocol<
  TicketDistributionRequest,
  void
> {
  private readonly eventBusService: EventBusService
  constructor(eventBusService: EventBusService) {
    super()

    this.eventBusService = eventBusService

    this.initializeEventHandlers()
  }

  /**
   * Serialize ticket distribution message
   */
  serializeRequest(distribution: TicketDistributionRequest): Safe<Uint8Array> {
    // Serialize according to JAMNP-S specification
    const parts: Uint8Array[] = []

    // Encode epoch index (4 bytes)
    const [epochError, encodedEpochIndex] = encodeFixedLength(
      distribution.epochIndex,
      4n,
    )
    if (epochError) {
      return safeError(epochError)
    }
    parts.push(encodedEpochIndex)

    // Encode entry index (single byte: 0 or 1)
    const entryIndexByte = new Uint8Array(1)
    entryIndexByte[0] = Number(distribution.ticket.entryIndex)
    parts.push(entryIndexByte)

    // Add proof (784 bytes)
    parts.push(distribution.ticket.proof)

    return safeResult(concatBytes(parts))
  }

  /**
   * Deserialize ticket distribution message
   */
  deserializeRequest(data: Uint8Array): Safe<TicketDistributionRequest> {
    let currentData = data

    // Decode epoch index (4 bytes)
    const [epochError, epochResult] = decodeFixedLength(currentData, 4n)
    if (epochError) {
      return safeError(epochError)
    }
    currentData = epochResult.remaining
    const epochIndex = epochResult.value

    // Decode attempt (single byte: 0 or 1)
    if (currentData.length < 1) {
      return safeError(new Error('Insufficient data for attempt byte'))
    }
    const attemptByte = currentData[0]
    if (attemptByte !== 0 && attemptByte !== 1) {
      return safeError(new Error('Invalid attempt value: must be 0 or 1'))
    }
    currentData = currentData.slice(1)

    // Decode proof (784 bytes)
    if (currentData.length < 784) {
      return safeError(
        new Error('Insufficient data for Bandersnatch RingVRF proof'),
      )
    }
    const proof = currentData.slice(0, 784)

    return safeResult({
      epochIndex,
      ticket: {
        entryIndex: BigInt(attemptByte),
        proof,
      },
    })
  }

  /**
   * Serialize response (same as request for this protocol)
   */
  serializeResponse(_distribution: undefined): Safe<Uint8Array> {
    return safeResult(new Uint8Array(0))
  }

  /**
   * Deserialize response (same as request for this protocol)
   */
  deserializeResponse(_data: Uint8Array): Safe<undefined> {
    return safeResult(undefined)
  }

  /**
   * Process ticket distribution request
   */
  async processRequest(
    data: TicketDistributionRequest,
    peerPublicKey: Hex,
  ): SafePromise<void> {
    this.eventBusService.emitTicketDistributionRequest(data, peerPublicKey)

    // For CE 131, we just acknowledge receipt
    // The actual forwarding happens in CE 132
    return safeResult(undefined)
  }

  async processResponse(_response: undefined): SafePromise<void> {
    return safeResult(undefined)
  }
}
