/**
 * Ticket Holder Service
 *
 * Handles ticket accumulation and clearing according to Gray Paper Eq. 321-329
 */

import type {
  RingVRFProverW3F,
  RingVRFProverWasm,
  RingVRFVerifierW3F,
  RingVRFVerifierWasm,
} from '@pbnjam/bandersnatch-vrf'
import {
  bytesToHex,
  type EpochTransitionEvent,
  type EventBusService,
  getEd25519KeyPairWithFallback,
  type Hex,
  hexToBytes,
  logger,
  type RevertEpochTransitionEvent,
} from '@pbnjam/core'
import type {
  CE131TicketDistributionProtocol,
  CE132TicketDistributionProtocol,
} from '@pbnjam/networking'
import {
  calculateSlotPhase,
  determineProxyValidator,
  generateTicketsForEpoch,
  getTicketIdFromProof,
  verifyTicket,
} from '@pbnjam/safrole'
import {
  ADDITIONAL_ERRORS,
  BaseService,
  CONSENSUS_CONSTANTS,
  type ITicketService,
  SAFROLE_ERRORS,
  type Safe,
  type SafePromise,
  type SafroleTicket,
  type SafroleTicketWithoutProof,
  type StreamKind,
  safeError,
  safeResult,
  type TicketDistributionRequest,
} from '@pbnjam/types'
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
  // Store state before epoch transition for revert
  private preTransitionTicketAccumulator: SafroleTicketWithoutProof[] | null =
    null

  private configService: ConfigService
  private eventBusService: EventBusService
  private keyPairService: KeyPairService | null
  private entropyService: EntropyService
  private validatorSetManager: ValidatorSetManager | null = null
  private networkingService: NetworkingService | null
  private ce131TicketDistributionProtocol: CE131TicketDistributionProtocol | null
  private ce132TicketDistributionProtocol: CE132TicketDistributionProtocol | null
  private clockService: ClockService
  private prover: RingVRFProverWasm | RingVRFProverW3F
  private localValidatorIndex: number | null = null
  private ringVerifier: RingVRFVerifierWasm | RingVRFVerifierW3F
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
    prover: RingVRFProverWasm | RingVRFProverW3F
    ringVerifier: RingVRFVerifierWasm | RingVRFVerifierW3F
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
    this.eventBusService.addEpochTransitionCallback(
      this.handleEpochTransition.bind(this),
    )
    this.eventBusService.addRevertEpochTransitionCallback(
      this.handleRevertEpochTransition.bind(this),
    )
  }

  start(): Safe<boolean> {
    if (!this.validatorSetManager) {
      return safeError(new Error('Validator set manager not set'))
    }
    // Get Ed25519 public key using helper with fallback logic
    const [keyPairError, ed25519KeyPair] = getEd25519KeyPairWithFallback(
      this.configService,
      this.keyPairService || undefined,
    )
    if (keyPairError || !ed25519KeyPair) {
      return safeError(keyPairError || new Error('Key pair service not set'))
    }
    const publicKey = ed25519KeyPair.publicKey

    const [validatorIndexError, validatorIndex] =
      this.validatorSetManager.getValidatorIndex(bytesToHex(publicKey))
    if (validatorIndexError) {
      // If the local node is not a validator, log a warning and continue
      // This allows non-validator nodes to run (e.g., for development/testing)
      logger.warn(
        'Local node is not a validator in the genesis state. Ticket service will operate in non-validator mode.',
        {
          publicKey: bytesToHex(publicKey),
          error: validatorIndexError.message,
        },
      )
      this.localValidatorIndex = null
      return safeResult(true)
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
    this.eventBusService.removeEpochTransitionCallback(
      this.handleEpochTransition.bind(this),
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

    // Check if we are the proxy validator for this ticket
    // Proxy validator is selected from the next epoch's validator list
    const nextEpochValidators = this.validatorSetManager.getPendingValidators()
    if (nextEpochValidators.length === 0) {
      return safeError(
        new Error(
          'Next epoch validator list is empty - cannot verify proxy validator',
        ),
      )
    }

    const intendedProxyValidatorIndexInNextEpoch = determineProxyValidator(
      safroleTicket,
      this.validatorSetManager,
    )

    // Find the proxy validator in the current epoch's validator set
    const proxyValidator =
      nextEpochValidators[intendedProxyValidatorIndexInNextEpoch]
    if (!proxyValidator) {
      return safeError(
        new Error(
          `Proxy validator not found at index ${intendedProxyValidatorIndexInNextEpoch}`,
        ),
      )
    }

    const currentValidators = this.validatorSetManager.getActiveValidators()
    let intendedProxyValidatorIndex: number | null = null
    for (const [index, validator] of currentValidators.entries()) {
      if (validator.ed25519 === proxyValidator.ed25519) {
        intendedProxyValidatorIndex = index
        break
      }
    }

    if (intendedProxyValidatorIndex === null) {
      return safeError(
        new Error('Proxy validator not found in current epoch validator set'),
      )
    }

    // Get our validator index using helper with fallback logic
    let ourIndex: number | null = null
    if (this.configService.validatorIndex !== undefined) {
      const [ourIndexError] = this.validatorSetManager.getValidatorAtIndex(
        this.configService.validatorIndex,
      )
      if (ourIndexError) {
        return safeError(new Error('Local node is not a validator'))
      }
      ourIndex = this.configService.validatorIndex
    } else {
      // Get Ed25519 public key using helper with fallback logic
      const [keyPairError, ed25519KeyPair] = getEd25519KeyPairWithFallback(
        this.configService,
        this.keyPairService || undefined,
      )
      if (keyPairError || !ed25519KeyPair) {
        return safeError(keyPairError || new Error('Key pair service not set'))
      }
      const ourPublicKey = bytesToHex(ed25519KeyPair.publicKey)
      const [ourIndexError, ourIndexResult] =
        this.validatorSetManager.getValidatorIndex(ourPublicKey)
      if (
        ourIndexError ||
        ourIndexResult === null ||
        ourIndexResult === undefined
      ) {
        return safeError(new Error('Local node is not a validator'))
      }
      ourIndex = ourIndexResult
    }

    // Determine if this is CE 131 (Generator → Proxy Validator) or CE 132 (Proxy → All Validators)
    // CE 131: We are the proxy validator receiving from generator → add to proxyValidatorTickets
    // CE 132: We are any validator receiving from proxy → add to ticketAccumulator (for winnersMark)

    if (intendedProxyValidatorIndex === ourIndex) {
      // We are the proxy validator
      // Check if we already have this ticket in proxyValidatorTickets
      // If yes, this is CE 132 (we're receiving our own forwarded ticket)
      // If no, this is CE 131 (we're receiving from generator)
      const alreadyHaveTicket = this.proxyValidatorTickets.some(
        (t) => t.id === safroleTicket.id,
      )

      if (!alreadyHaveTicket) {
        // CE 131: First time receiving as proxy validator → add to proxyValidatorTickets for forwarding
        this.addProxyValidatorTicket(safroleTicket)
      }
      // If alreadyHaveTicket is true, we'll fall through to add to accumulator (CE 132 case)
    }

    // CE 132: All validators (including proxy) should add to ticketAccumulator
    // This includes:
    // 1. Non-proxy validators receiving from proxy
    // 2. Proxy validator receiving its own forwarded ticket (CE 132)
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
    // Filter out tickets with entryIndex >= maxTicketsPerExtrinsic
    // Only tickets with entryIndex < maxTicketsPerExtrinsic can be distributed via network
    const entryIndexNum = Number(ticket.entryIndex)
    const maxTickets = this.configService.maxTicketsPerExtrinsic
    if (entryIndexNum >= maxTickets) {
      logger.warn(
        'Skipping ticket with entryIndex >= maxTicketsPerExtrinsic from proxy validator tickets',
        {
          entryIndex: entryIndexNum,
          entryIndexBigInt: ticket.entryIndex.toString(),
          ticketId: ticket.id,
          maxTicketsPerExtrinsic: maxTickets,
          ticketsPerValidator: this.configService.ticketsPerValidator,
        },
      )
      return
    }
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

  validateTickets(tickets: SafroleTicket[], targetSlot: bigint): Safe<void> {
    // Get current slot for phase calculation
    const currentSlot = this.clockService.getLatestReportedBlockTimeslot()

    // Gray Paper Eq. 28 - Strict monotonic slot progression: τ' > τ
    // This implements the core constraint that slots must be strictly increasing
    if (targetSlot <= currentSlot) {
      return safeError(new Error(SAFROLE_ERRORS.BAD_SLOT))
    }

    // Gray Paper Eq. 28 - Validate slot progression is exactly +1 (no gaps allowed)
    // This ensures τ' = τ + 1, maintaining strict monotonicity without gaps
    if (targetSlot !== currentSlot + 1n) {
      return safeError(new Error(ADDITIONAL_ERRORS.INVALID_SLOT_PROGRESSION))
    }

    // Gray Paper Eq. 33-34 - Calculate slot phase: e remainder m = τ/Cepochlen
    const newPhase = calculateSlotPhase(targetSlot, this.configService)

    // Gray Paper Eq. 295-298 - Epoch tail validation: |xttickets| = 0 when m' ≥ Cepochtailstart
    // EPOCH_TAIL_START is the same as CONTEST_DURATION
    if (newPhase.phase >= BigInt(this.configService.contestDuration)) {
      if (tickets.length > 0) {
        return safeError(new Error(SAFROLE_ERRORS.UNEXPECTED_TICKET))
      }
    } else {
      // Gray Paper Eq. 295-298 - Enforce ticket limit: |xttickets| ≤ Cmaxblocktickets when m' < Cepochtailstart
      const maxTicketsPerBlock = Number(CONSENSUS_CONSTANTS.MAX_BLOCK_TICKETS)
      if (tickets.length > maxTicketsPerBlock) {
        return safeError(new Error(ADDITIONAL_ERRORS.TOO_MANY_EXTRINSICS))
      }
    }

    // Gray Paper Eq. 291 - Validate entry index bounds: xt_entryindex ∈ Nmax{Cticketentries}
    // Nmax{Cticketentries} means natural numbers less than Cticketentries (0 to Cticketentries-1)
    for (const ticket of tickets) {
      if (
        ticket.entryIndex < 0n ||
        ticket.entryIndex >= this.configService.maxTicketsPerExtrinsic
      ) {
        return safeError(
          new Error(ADDITIONAL_ERRORS.INVALID_TICKET_ENTRY_INDEX),
        )
      }
    }

    // Check for duplicate entry indices (additional validation)
    // Gray Paper Eq. 315-317: Check for duplicate entry indices
    const entryIndices = tickets.map((t) => t.entryIndex)
    const uniqueIndices = new Set(entryIndices)
    if (uniqueIndices.size !== entryIndices.length) {
      return safeError(new Error(SAFROLE_ERRORS.DUPLICATE_TICKET))
    }

    if (tickets.length > 1) {
      for (let i = 1; i < tickets.length; i++) {
        if (tickets[i].entryIndex < tickets[i - 1].entryIndex) {
          return safeError(new Error(SAFROLE_ERRORS.BAD_TICKET_ORDER))
        }
      }
    }

    return safeResult(undefined)
  }

  /**
   * Add tickets to accumulator according to Gray Paper Eq. 321-324
   *
   * Gray Paper Logic:
   * ticketaccumulator' = sorted union of new tickets + existing accumulator ^Cepochlen
   *
   * Constraints:
   * - Gray Paper Eq. 291: Entry index bounds: xt_entryindex ∈ Nmax{Cticketentries}
   * - Gray Paper Eq. 295-298: Epoch tail validation: |xttickets| = 0 when m' ≥ Cepochtailstart
   * - Gray Paper Eq. 295-298: Ticket limit: |xttickets| ≤ Cmaxblocktickets when m' < Cepochtailstart
   * - Gray Paper Eq. 315: No duplicate ticket IDs in new tickets
   * - Gray Paper Eq. 316: No duplicate ticket IDs between new and existing tickets
   * - Gray Paper Eq. 322: Sort by ticket ID (ascending order)
   * - Gray Paper Eq. 322: Truncate to Cepochlen (600 tickets)
   * - Ticket attempt ordering: entry indices must be sequential starting from 0
   *
   * @param newTickets - Tickets from block extrinsic to add to accumulator
   * @param slot - Optional slot number for phase calculation (defaults to current slot + 1)
   * @returns Updated ticket accumulator
   */
  applyTickets(
    newTickets: SafroleTicket[],
    targetSlot: bigint,
    validateTickets = false,
  ): Safe<SafroleTicketWithoutProof[]> {
    if (!this.validatorSetManager) {
      return safeError(new Error('Validator set manager not set'))
    }

    if (validateTickets) {
      const [validateError] = this.validateTickets(newTickets, targetSlot)
      if (validateError) {
        return safeError(validateError)
      }
    }

    // Verify ticket proofs BEFORE checking for duplicates
    // Gray Paper: Verify each ticket proof before processing duplicates
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
        return safeError(new Error(SAFROLE_ERRORS.BAD_TICKET_PROOF))
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
    // Note: Accumulator is automatically cleared on epoch transition via handleEpochTransition
    // Gray Paper Eq. 322: Union of new tickets and existing accumulator
    const unionTickets = [...validNewTickets, ...this.ticketAccumulator]

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
   * Handle epoch transition event
   * Clears ticket accumulator according to Gray Paper Eq. 321-329: ticketaccumulator' = ∅ when e' > e
   */
  private handleEpochTransition(event: EpochTransitionEvent): Safe<void> {
    // Save state before clearing for potential revert
    this.preTransitionTicketAccumulator = [...this.ticketAccumulator]

    // Gray Paper Eq. 321-329: ticketaccumulator' = ∅ when e' > e
    this.clearTicketAccumulator()

    logger.debug(
      '[TicketService] Epoch transition - ticket accumulator cleared',
      {
        slot: event.slot.toString(),
        previousAccumulatorSize: this.preTransitionTicketAccumulator.length,
      },
    )

    return safeResult(undefined)
  }

  /**
   * Handle revert epoch transition event
   * Restores ticket accumulator to its state before the epoch transition
   */
  private handleRevertEpochTransition(
    event: RevertEpochTransitionEvent,
  ): Safe<void> {
    if (!this.preTransitionTicketAccumulator) {
      logger.warn(
        '[TicketService] No pre-transition ticket accumulator to revert to',
        {
          slot: event.slot.toString(),
        },
      )
      return safeResult(undefined)
    }

    // Restore ticket accumulator to pre-transition state
    this.ticketAccumulator = [...this.preTransitionTicketAccumulator]
    this.preTransitionTicketAccumulator = null

    logger.debug(
      '[TicketService] Epoch transition reverted - ticket accumulator restored',
      {
        slot: event.slot.toString(),
        restoredAccumulatorSize: this.ticketAccumulator.length,
      },
    )

    return safeResult(undefined)
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
    // Get next epoch's validator list (pendingSet) for proxy selection
    // JAMNP-S spec: "The proxy validator is selected from the next epoch's validator list"
    const nextEpochValidators = this.validatorSetManager.getPendingValidators()
    if (nextEpochValidators.length === 0) {
      return safeError(
        new Error(
          'Next epoch validator list is empty - cannot determine proxy validators',
        ),
      )
    }

    // Get current epoch's validators for distribution
    const currentValidators = this.validatorSetManager.getActiveValidators()

    for (const ticket of tickets) {
      // Determine proxy validator using JAMNP-S specification:
      // "The index of the proxy validator for a ticket is determined by interpreting
      // the last 4 bytes of the ticket's VRF output as a big-endian unsigned integer,
      // modulo the number of validators"
      // Proxy validator is selected from the next epoch's validator list
      const proxyValidatorIndexInNextEpoch = determineProxyValidator(
        ticket,
        this.validatorSetManager,
      )

      // Map proxy validator index from next epoch to current epoch validator index
      // We need to find the proxy validator's index in the current epoch's validator set
      const proxyValidator = nextEpochValidators[proxyValidatorIndexInNextEpoch]
      if (!proxyValidator) {
        logger.warn('Proxy validator not found in next epoch validator list', {
          proxyIndex: proxyValidatorIndexInNextEpoch,
          nextEpochValidatorsCount: nextEpochValidators.length,
        })
        continue
      }

      // Find the proxy validator's index in the current epoch's validator set
      let proxyValidatorIndexInCurrentEpoch: number | null = null
      for (const [index, validator] of currentValidators.entries()) {
        if (validator.ed25519 === proxyValidator.ed25519) {
          proxyValidatorIndexInCurrentEpoch = index
          break
        }
      }

      // If proxy validator is not in current epoch's validator set, skip
      if (proxyValidatorIndexInCurrentEpoch === null) {
        logger.warn(
          'Proxy validator not found in current epoch validator set',
          {
            proxyEd25519: proxyValidator.ed25519,
          },
        )
        continue
      }

      // If the generating validator is chosen as the proxy validator,
      // then the first step should effectively be skipped and the generating validator should
      // distribute the ticket to the current validators itself (CE 132)
      if (
        this.localValidatorIndex !== null &&
        proxyValidatorIndexInCurrentEpoch === Number(this.localValidatorIndex)
      ) {
        // Skip CE 131 and perform CE 132 directly
        // Add ticket to proxy validator tickets so it gets distributed in second phase
        this.addProxyValidatorTicket(ticket)
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
        BigInt(proxyValidatorIndexInCurrentEpoch),
        131 as StreamKind, // CE 131: Generating validator to proxy validator
        serializedRequest,
      )
    }

    return safeResult(undefined)
  }

  /**
   * Execute second step ticket distribution (CE 132)
   *
   * JAMNP-S spec: "Forwarding should be evenly spaced out from this point until
   * half-way through the Safrole lottery period. Forwarding may be stopped if
   * the ticket is included in a finalized block."
   *
   * Safrole lottery period: slots 0 to contestDuration (500)
   * Halfway point: contestDuration / 2 (250)
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
    const currentSlot = this.clockService.getCurrentSlot()
    const currentPhase = currentSlot % BigInt(this.configService.epochDuration)

    // Calculate forwarding window
    // Start: max(⌊E/20⌋, 1) slots after connectivity changes (handled by clock service)
    // End: halfway through Safrole lottery period (contestDuration / 2)
    const forwardingEndPhase = Math.floor(
      this.configService.contestDuration / 2,
    )

    // If we're past the forwarding window, don't forward
    if (Number(currentPhase) >= forwardingEndPhase) {
      logger.debug('Past forwarding window, skipping CE 132 distribution', {
        currentPhase: currentPhase.toString(),
        forwardingEndPhase,
      })
      return safeResult(undefined)
    }

    // Calculate number of forwarding intervals
    // Space out forwarding evenly from current phase to halfway point
    const remainingPhases = forwardingEndPhase - Number(currentPhase)

    for (const ticket of ticketsToForward) {
      // Double-check before serialization (should already be filtered in addProxyValidatorTicket)
      // Filter out tickets with entryIndex >= maxTicketsPerExtrinsic
      const entryIndexNum = Number(ticket.entryIndex)
      const maxTickets = this.configService.maxTicketsPerExtrinsic
      if (entryIndexNum >= maxTickets) {
        logger.warn(
          'Skipping ticket with entryIndex >= maxTicketsPerExtrinsic during CE132 forwarding',
          {
            entryIndex: entryIndexNum,
            entryIndexBigInt: ticket.entryIndex.toString(),
            ticketId: ticket.id,
            epochIndex: currentEpoch.toString(),
            maxTicketsPerExtrinsic: maxTickets,
          },
        )
        continue
      }

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
        logger.error('Failed to serialize ticket for CE132 distribution', {
          error: serializeError.message,
          entryIndex: entryIndexNum,
          ticketId: ticket.id,
        })
        return safeError(serializeError)
      }

      // Space out forwarding evenly across remaining phases
      // Send to validators in batches to avoid overwhelming the network
      // validators is a Map<number, ValidatorPublicKeys>
      const validatorsArray = Array.from(validators.keys())
      const batchSize = Math.max(
        1,
        Math.floor(validatorsArray.length / remainingPhases),
      )

      for (let i = 0; i < validatorsArray.length; i += batchSize) {
        const batch = validatorsArray.slice(i, i + batchSize)
        const batchIndex = Math.floor(i / batchSize)

        // Calculate delay for this batch (evenly spaced)
        const delayMs =
          batchIndex * (this.configService.slotDuration / remainingPhases)

        if (delayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, delayMs))
        }

        // Send to batch of validators
        for (const validatorIndex of batch) {
          const [sendError, success] = await this.networkingService.sendMessage(
            BigInt(validatorIndex),
            132 as StreamKind, // CE 132: Proxy validator to all current validators
            serializedRequest,
          )
          if (sendError) {
            logger.error('Failed to send ticket distribution request', {
              error: sendError.message,
              validatorIndex,
            })
          }
          if (!success) {
            logger.error('Failed to send ticket distribution request', {
              error: 'Failed to send ticket distribution request',
              validatorIndex,
            })
          }
        }
      }
    }

    return safeResult(undefined)
  }
}
