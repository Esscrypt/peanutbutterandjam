/**
 * Ticket Holder Service
 *
 * Handles ticket accumulation and clearing according to Gray Paper Eq. 321-329
 */

import type { RingVRFProverWasm, RingVRFVerifierWasm } from '@pbnj/bandersnatch-vrf'
import {
  bytesToHex,
  type EventBusService,
  type Hex,
  hexToBytes,
  logger,
} from '@pbnj/core'
import type {
  CE131TicketDistributionProtocol,
  CE132TicketDistributionProtocol,
} from '@pbnj/networking'
import {
  determineProxyValidator,
  generateTicketsForEpoch,
  getTicketIdFromProof,
  verifyTicket,
} from '@pbnj/safrole'
import {
  BaseService,
  type ITicketService,
  type Safe,
  type SafePromise,
  type SafroleTicket,
  type SafroleTicketWithoutProof,
  type StreamKind,
  safeError,
  safeResult,
  type TicketDistributionRequest,
} from '@pbnj/types'
import type { ClockService } from './clock-service'
import type { ConfigService } from './config-service'
import type { EntropyService } from './entropy'
import type { KeyPairService } from './keypair-service'
import type { NetworkingService } from './networking-service'
import type { ValidatorSetManager } from './validator-set'

/**
 * Ticket holder service implementation
 *
 * Implements Gray Paper Eq. 321-329:
 * ticketaccumulator' = sort_by(x_st_id, n ∪ {ticketaccumulator | e' = e, ∅ | e' > e})^Cepochlen
 */
export class TicketService extends BaseService implements ITicketService {
  private ticketAccumulator: SafroleTicketWithoutProof[] = []
  private ticketToHolderPublicKey: Map<Hex, Hex> = new Map()
  private proxyValidatorTickets: SafroleTicket[] = []

  private configService: ConfigService
  private eventBusService: EventBusService
  private keyPairService: KeyPairService | null
  private entropyService: EntropyService
  private validatorSetManager: ValidatorSetManager | null = null
  private networkingService: NetworkingService | null
  private ce131TicketDistributionProtocol: CE131TicketDistributionProtocol | null
  private ce132TicketDistributionProtocol: CE132TicketDistributionProtocol | null
  private clockService: ClockService
  private prover: RingVRFProverWasm
  private localValidatorIndex: number | null = null
  private ringVerifier: RingVRFVerifierWasm
  constructor(options: {
    configService: ConfigService
    eventBusService: EventBusService
    keyPairService: KeyPairService | null
    entropyService: EntropyService
    networkingService: NetworkingService | null
    ce131TicketDistributionProtocol: CE131TicketDistributionProtocol | null
    ce132TicketDistributionProtocol: CE132TicketDistributionProtocol | null
    validatorSetManager: ValidatorSetManager | null
    clockService: ClockService
    prover: RingVRFProverWasm
    ringVerifier: RingVRFVerifierWasm
  }) {
    super('ticket-holder-service')
    this.configService = options.configService
    this.eventBusService = options.eventBusService
    this.keyPairService = options.keyPairService
    this.entropyService = options.entropyService
    this.networkingService = options.networkingService
    this.ce131TicketDistributionProtocol =
      options.ce131TicketDistributionProtocol
    this.ce132TicketDistributionProtocol =
      options.ce132TicketDistributionProtocol
    this.clockService = options.clockService
    this.prover = options.prover
    this.validatorSetManager = options.validatorSetManager
    this.ringVerifier = options.ringVerifier
    this.eventBusService.addFirstPhaseTicketDistributionCallback(
      this.handleFirstPhaseTicketDistribution.bind(this),
    )
    this.eventBusService.addSecondPhaseTicketDistributionCallback(
      this.handleSecondPhaseTicketDistribution.bind(this),
    )
    this.eventBusService.addTicketDistributionRequestCallback(
      this.handleTicketDistributionRequest.bind(this),
    )
  }

  start(): Safe<boolean> {
    if (!this.keyPairService) {
      return safeError(new Error('Key pair service not set'))
    }
    if (!this.validatorSetManager) {
      return safeError(new Error('Validator set manager not set'))
    }
    const publicKey =
      this.keyPairService.getLocalKeyPair().ed25519KeyPair.publicKey

    const [validatorIndexError, validatorIndex] =
      this.validatorSetManager.getValidatorIndex(bytesToHex(publicKey))
    if (validatorIndexError) {
      throw new Error('Failed to get validator index')
    }
    this.localValidatorIndex = validatorIndex

    return safeResult(true)
  }

  setValidatorSetManager(validatorSetManager: ValidatorSetManager): void {
    this.validatorSetManager = validatorSetManager
  }

  stop(): Safe<boolean> {
    this.eventBusService.removeFirstPhaseTicketDistributionCallback(
      this.handleFirstPhaseTicketDistribution.bind(this),
    )
    this.eventBusService.removeSecondPhaseTicketDistributionCallback(
      this.handleSecondPhaseTicketDistribution.bind(this),
    )

    this.eventBusService.removeTicketDistributionRequestCallback(
      this.handleTicketDistributionRequest.bind(this),
    )
    return safeResult(true)
  }

  private async handleTicketDistributionRequest(
    request: TicketDistributionRequest,
    peerPublicKey: Hex,
  ): SafePromise<void> {
    if (!this.validatorSetManager) {
      return safeError(new Error('Validator set manager not set'))
    }
    if (!this.keyPairService) {
      return safeError(new Error('Key pair service not set'))
    }
    const safroleTicket: SafroleTicket = {
      id: getTicketIdFromProof(request.ticket.proof),
      entryIndex: request.ticket.entryIndex,
      proof: bytesToHex(request.ticket.proof),
    }

    // check if the ticket is valid against the proof
    const [verifyError, isValid] = verifyTicket(
      safroleTicket,
      this.entropyService,
      this.validatorSetManager,
      this.ringVerifier,
    )
    if (verifyError) {
      return safeError(verifyError)
    }
    if (!isValid) {
      return safeError(new Error('Invalid ticket'))
    }

    //check if we are the proxy validator for this epoch
    const intendedProxyValidatorIndex = determineProxyValidator(
      safroleTicket,
      this.validatorSetManager,
    )

    // compare against our index
    const ourPublicKey = bytesToHex(
      this.keyPairService.getLocalKeyPair().ed25519KeyPair.publicKey,
    )
    const ourIndex = this.validatorSetManager.getValidatorIndex(ourPublicKey)

    if (intendedProxyValidatorIndex !== Number(ourIndex)) {
      return safeError(new Error('Not the intended proxy validator'))
    }

    this.addReceivedTicket(safroleTicket, peerPublicKey)

    return safeResult(undefined)
  }

  setTicketAccumulator(ticketAccumulator: SafroleTicketWithoutProof[]): void {
    this.ticketAccumulator = ticketAccumulator
  }

  getTicketAccumulator(): SafroleTicketWithoutProof[] {
    return this.ticketAccumulator
  }

  getProxyValidatorTickets(): SafroleTicket[] {
    return this.proxyValidatorTickets
  }

  /**
   * Get tickets received via CE131/CE132 that can be included in block extrinsics
   *
   * @returns Array of received tickets sorted by ID
   */
  getReceivedTickets(): SafroleTicketWithoutProof[] {
    // Return tickets sorted by ID for consistent ordering
    return this.sortTicketsByID(this.ticketAccumulator)
  }

  /**
   * Add ticket to accumulator with proper sorting
   * Gray Paper Eq. 321-329: Maintains sorted order by ticket ID
   *
   * Note: No size limit enforcement here - that's handled by the state transition
   * logic according to Gray Paper Eq. 321-329: ^Cepochlen truncation
   */
  addReceivedTicket(ticket: SafroleTicket, publicKey: Hex): void {
    // Insert ticket in correct position to maintain sorted order
    const insertIndex = this.findInsertionIndex(ticket.id)
    this.ticketAccumulator.splice(insertIndex, 0, ticket)
    this.ticketToHolderPublicKey.set(ticket.id, publicKey)
  }

  addProxyValidatorTicket(ticket: SafroleTicket): void {
    this.proxyValidatorTickets.push(ticket)
  }

  getTicketHolder(ticket: SafroleTicket): Safe<Hex> {
    const publicKey = this.ticketToHolderPublicKey.get(ticket.id)
    if (!publicKey) {
      return safeError(new Error('Ticket not found'))
    }
    return safeResult(publicKey)
  }

  /**
   * Find the correct insertion index to maintain sorted order by ticket ID
   * Uses binary search for O(log n) performance
   */
  private findInsertionIndex(ticketId: string): number {
    let left = 0
    let right = this.ticketAccumulator.length

    while (left < right) {
      const mid = Math.floor((left + right) / 2)
      if (this.ticketAccumulator[mid].id < ticketId) {
        left = mid + 1
      } else {
        right = mid
      }
    }

    return left
  }

  /**
   * Add tickets to accumulator according to Gray Paper Eq. 321-324
   *
   * Gray Paper Logic:
   * ticketaccumulator' = sorted union of new tickets + existing accumulator ^Cepochlen
   *
   * Constraints:
   * - Gray Paper Eq. 315: No duplicate ticket IDs in new tickets
   * - Gray Paper Eq. 316: No duplicate ticket IDs between new and existing tickets
   * - Gray Paper Eq. 322: Sort by ticket ID (ascending order)
   * - Gray Paper Eq. 322: Truncate to Cepochlen (600 tickets)
   *
   * @param newTickets - Tickets from block extrinsic to add to accumulator
   * @param isNewEpoch - Whether this is a new epoch (e' > e)
   * @returns Updated ticket accumulator
   */
  applyTickets(
    newTickets: SafroleTicket[],
    isNewEpoch = false,
  ): Safe<SafroleTicketWithoutProof[]> {
    if (!this.validatorSetManager) {
      return safeError(new Error('Validator set manager not set'))
    }
    // for each new ticket, verify the proof
    for (const ticket of newTickets) {
      const [verifyError, isValid] = verifyTicket(
        ticket,
        this.entropyService,
        this.validatorSetManager,
        this.ringVerifier,
      )
      if (verifyError) {
        return safeError(verifyError)
      }
      if (!isValid) {
        return safeError(new Error('Invalid ticket'))
      }
    }
    // Gray Paper Eq. 315: Remove duplicates from new tickets
    const uniqueNewTickets = this.removeDuplicateTickets(newTickets)

    // Gray Paper Eq. 316: Check for duplicates between new and existing tickets
    const [duplicateError, validNewTickets] = this.filterDuplicateTickets(
      uniqueNewTickets,
      this.ticketAccumulator,
    )

    if (duplicateError) {
      return safeError(duplicateError)
    }

    // Gray Paper Eq. 322: Create union of new tickets and existing accumulator
    const existingAccumulator = isNewEpoch
      ? [] // Gray Paper Eq. 322: ∅ when e' > e (new epoch)
      : this.ticketAccumulator // Gray Paper Eq. 322: ticketaccumulator when e' = e (same epoch)

    // Gray Paper Eq. 322: Union of new tickets and existing accumulator
    const unionTickets = [...validNewTickets, ...existingAccumulator]

    // Gray Paper Eq. 322: Sort by ticket ID (ascending order)
    const sortedTickets = this.sortTicketsByID(unionTickets)

    // Gray Paper Eq. 322: Truncate to Cepochlen (600 tickets)
    const truncatedTickets = sortedTickets.slice(
      0,
      this.configService.epochDuration,
    )

    // Update the accumulator
    this.ticketAccumulator = truncatedTickets

    // Update ticket holder mapping for new tickets
    // Note: We don't have the public key here, so we'll need to handle this differently
    // This might need to be passed as a parameter or handled elsewhere

    return safeResult(truncatedTickets)
  }

  /**
   * Remove duplicate tickets from a list (Gray Paper Eq. 315)
   *
   * @param tickets - List of tickets to deduplicate
   * @returns List of unique tickets
   */
  private removeDuplicateTickets(
    tickets: SafroleTicketWithoutProof[],
  ): SafroleTicketWithoutProof[] {
    const seen = new Set<string>()
    const uniqueTickets: SafroleTicketWithoutProof[] = []

    for (const ticket of tickets) {
      if (!seen.has(ticket.id)) {
        seen.add(ticket.id)
        uniqueTickets.push(ticket)
      }
    }

    return uniqueTickets
  }

  /**
   * Filter out tickets that already exist in the accumulator (Gray Paper Eq. 316)
   *
   * @param newTickets - New tickets to check
   * @param existingAccumulator - Current accumulator
   * @returns Valid new tickets (no duplicates)
   */
  private filterDuplicateTickets(
    newTickets: SafroleTicketWithoutProof[],
    existingAccumulator: SafroleTicketWithoutProof[],
  ): Safe<SafroleTicketWithoutProof[]> {
    const existingIds = new Set(existingAccumulator.map((t) => t.id))
    const validTickets: SafroleTicketWithoutProof[] = []

    for (const ticket of newTickets) {
      if (existingIds.has(ticket.id)) {
        return safeError(new Error(`Duplicate ticket ID found: ${ticket.id}`))
      }
      validTickets.push(ticket)
    }

    return safeResult(validTickets)
  }

  /**
   * Sort tickets by ID in ascending order (Gray Paper Eq. 322)
   *
   * @param tickets - Tickets to sort
   * @returns Sorted tickets
   */
  private sortTicketsByID(
    tickets: SafroleTicketWithoutProof[],
  ): SafroleTicketWithoutProof[] {
    return [...tickets].sort((a, b) => {
      // Sort by ticket ID (ascending order)
      // Lower ID = higher score = better ticket
      return a.id.localeCompare(b.id)
    })
  }

  /**
   * Clear ticket accumulator
   * Gray Paper Eq. 321-329: ticketaccumulator' = ∅ when e' > e
   */
  clearTicketAccumulator(): void {
    this.ticketAccumulator = []
  }

  /**
   * Get accumulator size
   */
  getAccumulatorSize(): number {
    return this.ticketAccumulator.length
  }

  /**
   * Check if accumulator is at or above the epoch length limit
   * Gray Paper: |ticketaccumulator| ≥ Cepochlen
   *
   * Note: This is used for informational purposes only.
   * Actual truncation is handled by state transition logic.
   */
  isAccumulatorFull(): boolean {
    return this.ticketAccumulator.length >= this.configService.epochDuration
  }

  /**
   * Execute first step ticket distribution (CE 131)
   */
  private handleFirstPhaseTicketDistribution(): Safe<void> {
    if (!this.validatorSetManager) {
      return safeError(new Error('Validator set manager not set'))
    }
    if (!this.keyPairService) {
      return safeError(new Error('Key pair service not set'))
    }
    if (!this.ce131TicketDistributionProtocol) {
      return safeError(new Error('CE 131 ticket distribution protocol not set'))
    }
    if (!this.networkingService) {
      return safeError(new Error('Networking service not set'))
    }
    if (!this.ce132TicketDistributionProtocol) {
      return safeError(new Error('CE 132 ticket distribution protocol not set'))
    }

    const [generateTicketsError, tickets] = generateTicketsForEpoch(
      this.validatorSetManager,
      this.keyPairService,
      this.entropyService,
      this.prover,
      this.configService,
    )
    if (generateTicketsError) {
      return safeError(generateTicketsError)
    }
    if (!tickets) {
      return safeError(new Error('Failed to generate tickets'))
    }
    for (const ticket of tickets) {
      // Determine proxy validator using JAMNP-S specification:
      // "The index of the proxy validator for a ticket is determined by interpreting
      // the last 4 bytes of the ticket's VRF output as a big-endian unsigned integer,
      // modulo the number of validators"
      const proxyValidatorIndex = determineProxyValidator(
        ticket,
        this.validatorSetManager,
      )

      //If the generating validator is chosen as the proxy validator,
      //  then the first step should effectively be skipped and the generating validator should
      //  distribute the ticket to the current validators itself
      if (proxyValidatorIndex === Number(this.localValidatorIndex)) {
        continue
      }

      const currentEpoch = this.clockService.getCurrentEpoch()
      const ticketDistributionRequest: TicketDistributionRequest = {
        epochIndex: currentEpoch,
        ticket: {
          entryIndex: ticket.entryIndex,
          proof: hexToBytes(ticket.proof),
        },
      }
      const [serializeError, serializedRequest] =
        this.ce131TicketDistributionProtocol.serializeRequest(
          ticketDistributionRequest,
        )
      if (serializeError) {
        return safeError(serializeError)
      }

      this.networkingService.sendMessage(
        BigInt(proxyValidatorIndex),
        132 as StreamKind, // Proxy validator to all current validators
        serializedRequest,
      )
    }

    return safeResult(undefined)
  }

  /**
   * Execute second step ticket distribution (CE 132)
   */
  private async handleSecondPhaseTicketDistribution(): SafePromise<void> {
    if (!this.validatorSetManager) {
      return safeError(new Error('Validator set manager not set'))
    }
    if (!this.ce132TicketDistributionProtocol) {
      return safeError(new Error('CE 132 ticket distribution protocol not set'))
    }
    if (!this.networkingService) {
      return safeError(new Error('Networking service not set'))
    }
    // Get current validator set
    const validators = this.validatorSetManager.getActiveValidators()

    const ticketsToForward = this.getProxyValidatorTickets()
    const currentEpoch = this.clockService.getCurrentEpoch()

    for (const ticket of ticketsToForward) {
      const ticketDistributionRequest: TicketDistributionRequest = {
        epochIndex: currentEpoch,
        ticket: {
          entryIndex: ticket.entryIndex,
          proof: hexToBytes(ticket.proof),
        },
      }
      const [serializeError, serializedRequest] =
        this.ce132TicketDistributionProtocol.serializeRequest(
          ticketDistributionRequest,
        )
      if (serializeError) {
        return safeError(serializeError)
      }
      for (const validatorIndex of validators.keys()) {
        const [sendError, success] = await this.networkingService.sendMessage(
          BigInt(validatorIndex),
          132 as StreamKind, // Proxy validator to all current validators
          serializedRequest,
        )
        if (sendError) {
          logger.error('Failed to send ticket distribution request', {
            error: sendError.message,
          })
        }
        if (!success) {
          logger.error('Failed to send ticket distribution request', {
            error: 'Failed to send ticket distribution request',
          })
        }
      }
    }

    return safeResult(undefined)
  }
}
