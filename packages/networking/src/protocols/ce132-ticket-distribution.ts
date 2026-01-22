/**
 * CE 132: Ticket Distribution Protocol (Proxy Validator to All Current Validators)
 *
 * Implements the second step of Safrole ticket distribution for JAMNP-S
 * Proxy validator forwards ticket to all current validators
 */

import { decodeFixedLength, encodeFixedLength } from '@pbnjam/codec'
import {
  concatBytes,
  type EventBusService,
  type Hex,
  logger,
} from '@pbnjam/core'
import type {
  IConfigService,
  Safe,
  SafePromise,
  TicketDistributionRequest,
} from '@pbnjam/types'
import { safeError, safeResult } from '@pbnjam/types'
import { NetworkingProtocol } from './protocol'

/**
 * CE 132: Proxy Validator to All Current Validators Ticket Distribution
 */
// Attempt = 0 OR 1 (Single byte)
// Bandersnatch RingVRF Proof = [u8; 784]
// Ticket = Attempt ++ Bandersnatch RingVRF Proof (As in GP)

// Validator -> Validator

// --> Epoch Index ++ Ticket (Epoch index should identify the epoch that the ticket will be used in)
// --> FIN
// <-- FIN
export class CE132TicketDistributionProtocol extends NetworkingProtocol<
  TicketDistributionRequest,
  void
> {
  private readonly eventBusService: EventBusService
  private readonly configService: IConfigService | null
  constructor(
    eventBusService: EventBusService,
    configService: IConfigService | null = null,
  ) {
    super()

    if (!eventBusService) {
      throw new Error(
        'CE132TicketDistributionProtocol: eventBusService is required',
      )
    }

    this.eventBusService = eventBusService
    this.configService = configService

    // Set up event handlers directly in the constructor
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

    // Encode entry index (single byte)
    // Check against configService.maxTicketsPerExtrinsic to validate range
    const entryIndexNum = Number(distribution.ticket.entryIndex)
    const maxTickets = this.configService?.maxTicketsPerExtrinsic ?? 16 // Default to 16 if configService not available

    // Validate entryIndex is within valid range (0 to maxTickets-1, but single byte limits to 0-255)
    // However, we should check against maxTickets to ensure it's not exceeding configured limit
    if (entryIndexNum < 0 || entryIndexNum > 255) {
      logger.error(
        '[CE132] Invalid entryIndex for network distribution (out of byte range)',
        {
          entryIndex: entryIndexNum,
          entryIndexBigInt: distribution.ticket.entryIndex.toString(),
          epochIndex: distribution.epochIndex.toString(),
          error: 'entryIndex must be between 0 and 255 (single byte limit)',
        },
      )
      return safeError(
        new Error(
          `Invalid entryIndex for network distribution: ${entryIndexNum}. Must be between 0 and 255.`,
        ),
      )
    }

    if (entryIndexNum >= maxTickets) {
      const maxTicketsPerExtrinsic = this.configService?.maxTicketsPerExtrinsic
      const ticketsPerValidator = this.configService?.ticketsPerValidator
      logger.error(
        '[CE132] Invalid entryIndex for network distribution (exceeds maxTickets)',
        {
          entryIndex: entryIndexNum,
          entryIndexBigInt: distribution.ticket.entryIndex.toString(),
          epochIndex: distribution.epochIndex.toString(),
          maxTicketsPerExtrinsic: maxTicketsPerExtrinsic ?? 'unknown',
          ticketsPerValidator: ticketsPerValidator ?? 'unknown',
          error: `entryIndex ${entryIndexNum} exceeds maxTicketsPerExtrinsic (${maxTickets})`,
          note: 'Tickets with entryIndex >= maxTicketsPerExtrinsic cannot be distributed via network protocols.',
        },
      )
      return safeError(
        new Error(
          `Invalid entryIndex for network distribution: ${entryIndexNum}. Exceeds maxTicketsPerExtrinsic (${maxTickets}).`,
        ),
      )
    }
    const entryIndexByte = new Uint8Array(1)
    entryIndexByte[0] = entryIndexNum
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

    // Decode attempt (single byte)
    // Check against configService.maxTicketsPerExtrinsic to validate range
    if (currentData.length < 1) {
      return safeError(new Error('Insufficient data for attempt byte'))
    }
    const attemptByte = currentData[0]
    const maxTickets = this.configService?.maxTicketsPerExtrinsic ?? 16 // Default to 16 if configService not available

    // Validate attemptByte is within valid range (0 to maxTickets-1, but single byte limits to 0-255)
    if (attemptByte < 0 || attemptByte > 255) {
      logger.error(
        '[CE132] Invalid attempt byte received (out of byte range)',
        {
          attemptByte,
          attemptByteHex: `0x${attemptByte.toString(16).padStart(2, '0')}`,
          epochIndex: epochIndex.toString(),
          error: 'attemptByte must be between 0 and 255 (single byte limit)',
        },
      )
      return safeError(
        new Error(
          `Invalid attempt value: must be between 0 and 255, received ${attemptByte} (0x${attemptByte.toString(16).padStart(2, '0')})`,
        ),
      )
    }

    // Only error if it exceeds maxTickets (allow values 0, 1, 2, ... up to maxTickets-1)
    if (attemptByte >= maxTickets) {
      const maxTicketsPerExtrinsic = this.configService?.maxTicketsPerExtrinsic
      const ticketsPerValidator = this.configService?.ticketsPerValidator
      logger.error(
        '[CE132] Invalid attempt byte received (exceeds maxTickets)',
        {
          attemptByte,
          attemptByteHex: `0x${attemptByte.toString(16).padStart(2, '0')}`,
          epochIndex: epochIndex.toString(),
          maxTicketsPerExtrinsic: maxTicketsPerExtrinsic ?? 'unknown',
          ticketsPerValidator: ticketsPerValidator ?? 'unknown',
          dataLength: currentData.length,
          dataPreview: Array.from(
            currentData.slice(0, Math.min(16, currentData.length)),
          )
            .map((b) => `0x${b.toString(16).padStart(2, '0')}`)
            .join(' '),
          error: `attemptByte ${attemptByte} exceeds maxTicketsPerExtrinsic (${maxTickets})`,
          note: 'This indicates a peer is sending tickets with entryIndex >= maxTicketsPerExtrinsic.',
        },
      )
      return safeError(
        new Error(
          `Invalid attempt value: ${attemptByte} exceeds maxTicketsPerExtrinsic (${maxTickets})`,
        ),
      )
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
    return safeResult(new Uint8Array())
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
    logger.info('[CE132] Processing ticket distribution request', {
      peerPublicKey: `${peerPublicKey.slice(0, 20)}...`,
      epochIndex: data.epochIndex.toString(),
      entryIndex: data.ticket.entryIndex.toString(),
    })

    // Store the received ticket
    if (!this.eventBusService) {
      logger.error('[CE132] eventBusService is not initialized', {
        peerPublicKey: `${peerPublicKey.slice(0, 20)}...`,
        hasEventBusService: !!this.eventBusService,
      })
      return safeError(
        new Error(
          'eventBusService is not initialized in CE132TicketDistributionProtocol',
        ),
      )
    }

    if (!this.eventBusService.emitTicketDistributionRequest) {
      logger.error(
        '[CE132] emitTicketDistributionRequest method not found on eventBusService',
        {
          peerPublicKey: `${peerPublicKey.slice(0, 20)}...`,
          eventBusServiceType: typeof this.eventBusService,
          eventBusServiceMethods: this.eventBusService
            ? Object.getOwnPropertyNames(
                Object.getPrototypeOf(this.eventBusService),
              )
            : [],
        },
      )
      return safeError(
        new Error(
          'emitTicketDistributionRequest method not found on eventBusService',
        ),
      )
    }

    try {
      await this.eventBusService.emitTicketDistributionRequest(
        data,
        peerPublicKey,
      )
    } catch (error) {
      logger.error('[CE132] Error emitting ticket distribution request', {
        peerPublicKey: `${peerPublicKey.slice(0, 20)}...`,
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
      })
      return safeError(
        error instanceof Error
          ? error
          : new Error(
              `Failed to emit ticket distribution request: ${String(error)}`,
            ),
      )
    }

    // For CE 132, we just acknowledge receipt
    // The actual processing happens in TicketService
    return safeResult(undefined)
  }

  async processResponse(_response: undefined): SafePromise<void> {
    return safeResult(undefined)
  }
}
