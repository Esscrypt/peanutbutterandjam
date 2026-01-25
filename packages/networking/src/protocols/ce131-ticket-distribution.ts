/**
 * CE 131: Ticket Distribution Protocol (Generator to Proxy Validator)
 *
 * Implements the first step of Safrole ticket distribution for JAMNP-S
 * Generator validator sends ticket to deterministically-selected proxy validator
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { decodeFixedLength, encodeFixedLength } from '@pbnjam/codec'
import {
  bytesToHex,
  concatBytes,
  type EventBusService,
  getTicketIdFromProof,
  type Hex,
  logger,
} from '@pbnjam/core'
import type {
  IConfigService,
  IEntropyService,
  IValidatorSetManager,
  Safe,
  SafePromise,
  TicketDistributionRequest,
} from '@pbnjam/types'
import { safeError, safeResult } from '@pbnjam/types'
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
  private readonly configService: IConfigService | null
  private readonly entropyService: IEntropyService | null
  private readonly validatorSetManager: IValidatorSetManager | null
  constructor(
    eventBusService: EventBusService,
    configService: IConfigService | null = null,
    entropyService: IEntropyService | null = null,
    validatorSetManager: IValidatorSetManager | null = null,
  ) {
    super()

    this.eventBusService = eventBusService
    this.configService = configService
    this.entropyService = entropyService
    this.validatorSetManager = validatorSetManager

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
    // JAMNP-S spec: "Attempt = 0 OR 1 (Single byte)"
    // Only tickets with entryIndex 0 or 1 can be distributed via network protocol
    const entryIndexNum = Number(distribution.ticket.entryIndex)
    if (entryIndexNum !== 0 && entryIndexNum !== 1) {
      const maxTicketsPerExtrinsic = this.configService?.maxTicketsPerExtrinsic
      const ticketsPerValidator = this.configService?.ticketsPerValidator
      logger.error('[CE131] Invalid entryIndex for network distribution', {
        entryIndex: entryIndexNum,
        entryIndexBigInt: distribution.ticket.entryIndex.toString(),
        epochIndex: distribution.epochIndex.toString(),
        maxTicketsPerExtrinsic: maxTicketsPerExtrinsic ?? 'unknown',
        ticketsPerValidator: ticketsPerValidator ?? 'unknown',
        error:
          'JAMNP-S protocol only supports entryIndex 0 or 1. Tickets with higher entryIndex values cannot be distributed via CE131/CE132.',
        note: 'Only the first two tickets (entryIndex 0 and 1) can be distributed via network protocols.',
      })
      return safeError(
        new Error(
          `Invalid entryIndex for network distribution: ${entryIndexNum}. JAMNP-S protocol only supports entryIndex 0 or 1.`,
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
    logger.info('[CE131] Processing ticket distribution request', {
      peerPublicKey: `${peerPublicKey.slice(0, 20)}...`,
      epochIndex: data.epochIndex.toString(),
      entryIndex: data.ticket.entryIndex.toString(),
    })

    // Log ticket to JSON file
    try {
      const ticketId = getTicketIdFromProof(data.ticket.proof)

      // Get entropy values if available
      let entropy2: Hex | null = null
      let entropy3: Hex | null = null
      if (this.entropyService) {
        try {
          const entropy2Bytes = this.entropyService.getEntropy2()
          entropy2 = bytesToHex(entropy2Bytes)
        } catch (error) {
          logger.debug('[CE131] Failed to get entropy2', {
            error: error instanceof Error ? error.message : String(error),
          })
        }
        try {
          const entropy3Bytes = this.entropyService.getEntropy3()
          entropy3 = bytesToHex(entropy3Bytes)
        } catch (error) {
          logger.debug('[CE131] Failed to get entropy3', {
            error: error instanceof Error ? error.message : String(error),
          })
        }
      }

      // Get validator set info if available
      let activeValidators: Array<{ ed25519: Hex; bandersnatch: Hex }> | null =
        null
      let epochRoot: Hex | null = null
      if (this.validatorSetManager) {
        try {
          const validators = this.validatorSetManager.getActiveValidators()
          activeValidators = validators.map((v) => ({
            ed25519: v.ed25519,
            bandersnatch: v.bandersnatch,
          }))
        } catch (error) {
          logger.debug('[CE131] Failed to get active validators', {
            error: error instanceof Error ? error.message : String(error),
          })
        }
        try {
          epochRoot = this.validatorSetManager.getEpochRoot()
        } catch (error) {
          logger.debug('[CE131] Failed to get epoch root', {
            error: error instanceof Error ? error.message : String(error),
          })
        }
      }

      const logEntry = {
        timestamp: new Date().toISOString(),
        protocol: 'CE131',
        peerPublicKey: peerPublicKey,
        epochIndex: data.epochIndex.toString(),
        entryIndex: data.ticket.entryIndex.toString(),
        ticketId: ticketId,
        proofLength: data.ticket.proof.length,
        proof: bytesToHex(data.ticket.proof), // Store full proof as hex for verification
        proofFirstBytes: Array.from(data.ticket.proof.slice(0, 16))
          .map((b) => `0x${b.toString(16).padStart(2, '0')}`)
          .join(' '),
        entropy2: entropy2,
        entropy3: entropy3,
        activeValidators: activeValidators,
        epochRoot: epochRoot,
      }

      // Write to JSON file (append mode)
      const logDir = path.join(process.cwd(), 'logs')
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true })
      }

      const logFile = path.join(logDir, 'ce131-tickets-received.json')
      let logEntries: unknown[] = []

      // Read existing entries if file exists
      if (fs.existsSync(logFile)) {
        try {
          const existingContent = fs.readFileSync(logFile, 'utf-8')
          logEntries = JSON.parse(existingContent)
        } catch (error) {
          logger.warn(
            '[CE131] Failed to parse existing log file, starting fresh',
            {
              error: error instanceof Error ? error.message : String(error),
            },
          )
        }
      }

      // Append new entry
      logEntries.push(logEntry)

      // Write back to file
      fs.writeFileSync(logFile, JSON.stringify(logEntries, null, 2), 'utf-8')

      logger.debug('[CE131] Logged ticket to JSON file', {
        logFile,
        ticketId,
      })
    } catch (error) {
      logger.error('[CE131] Failed to log ticket to JSON file', {
        error: error instanceof Error ? error.message : String(error),
      })
      // Don't fail the request if logging fails
    }

    this.eventBusService.emitTicketDistributionRequest(data, peerPublicKey)

    // For CE 131, we just acknowledge receipt
    // The actual forwarding happens in CE 132
    return safeResult(undefined)
  }

  async processResponse(_response: undefined): SafePromise<void> {
    return safeResult(undefined)
  }
}
