/**
 * Seal Key Service Implementation
 *
 * Implements Gray Paper seal key sequence management according to safrole.tex
 * Manages sealtickets sequence and implements F() fallback function and Z() sequencer
 * Reference: Gray Paper Eq. 202-228 (The Slot Key Sequence)
 */

import type { EpochTransitionEvent, EventBusService } from '@pbnj/core'
import { generateFallbackKeySequence } from '@pbnj/safrole'
import {
  BaseService,
  type Safe,
  type SafroleTicket,
  safeError,
  safeResult,
} from '@pbnj/types'
import type { ConfigService } from './config-service'
import type { EntropyService } from './entropy'
import type { TicketService } from './ticket-service'
import type { ValidatorSetManager } from './validator-set'

/**
 * Seal Key Service
 *
 * Manages the seal key sequence (sealtickets) according to Gray Paper specifications.
 * Implements the slot key sequence logic, fallback function F(), and outside-in sequencer Z().
 */
export class SealKeyService extends BaseService {
  private readonly sealTicketForPhase: Map<bigint, SafroleTicket> = new Map()
  private readonly fallbackKeyForPhase: Map<bigint, Uint8Array> = new Map()

  // Dependencies
  private readonly eventBusService: EventBusService
  private readonly entropyService: EntropyService
  private validatorSetManager!: ValidatorSetManager // Initialized in init method
  private readonly ticketHolderService: TicketService
  private readonly configService: ConfigService
  constructor(
    eventBusService: EventBusService,
    entropyService: EntropyService,
    ticketHolderService: TicketService,
    configService: ConfigService,
  ) {
    super('seal-key-service')
    this.eventBusService = eventBusService
    this.entropyService = entropyService
    this.ticketHolderService = ticketHolderService
    this.configService = configService
    // Register for epoch transition events
    this.eventBusService.addEpochTransitionCallback(this.handleEpochTransition)
  }

  /**
   * Handle epoch transition events
   * Updates seal key sequence according to Gray Paper Eq. 202-207
   */
  private readonly handleEpochTransition = (
    _event: EpochTransitionEvent,
  ): Safe<void> => {
    this.calculateNewSealKeySequence()

    // after calculating the sequence for the new epoch, clear the ticket accumulator
    this.ticketHolderService.clearTicketAccumulator()

    return safeResult(undefined)
  }

  /**
   * Calculate new seal key sequence according to Gray Paper Eq. 202-207
   *
   * Gray Paper: sealtickets' ≡ {
   *   Z(ticketaccumulator) when e' = e + 1 ∧ m ≥ EPOCH_TAIL_START ∧ |ticketaccumulator| = EPOCH_LENGTH
   *   sealtickets when e' = e
   *   F(entropy_2, activeset') otherwise
   * }
   *
   * Where m = previous slot's phase within the epoch (Gray Paper line 33)
   */
  /**
   * Calculate new seal key sequence according to Gray Paper Eq. 202-207
   *
   * This implements the exact equation from the Gray Paper:
   * sealtickets' ≡ {
   *   Z(ticketaccumulator) when e' = e + 1 ∧ m ≥ EPOCH_TAIL_START ∧ |ticketaccumulator| = EPOCH_LENGTH
   *   sealtickets when e' = e
   *   F(entropy_2, activeset') otherwise
   * }
   */
  private calculateNewSealKeySequence() {
    if (this.ticketHolderService.isAccumulatorFull()) {
      const [error, reorderedTickets] = this.applyOutsideInSequencer(
        this.ticketHolderService.getTicketAccumulator(),
      )
      if (error) {
        return safeError(error)
      }

      // Generate seal keys for ALL 600 slots in the epoch
      const sealKeys: SafroleTicket[] = []
      for (let phase = 0; phase < this.configService.epochDuration; phase++) {
        const ticket = reorderedTickets[phase]
        this.sealTicketForPhase.set(BigInt(phase), ticket)
      }
      return safeResult(sealKeys)
    }

    const entropy2 = this.entropyService.getEntropy2()

    const [error, fallbackKeys] = generateFallbackKeySequence(
      entropy2,
      this.validatorSetManager,
      this.configService,
    )
    if (error) {
      return safeError(error)
    }
    for (let phase = 0; phase < this.configService.epochDuration; phase++) {
      const ticket = fallbackKeys[phase]
      this.fallbackKeyForPhase.set(BigInt(phase), ticket)
    }
    return safeResult(fallbackKeys)
  }

  /**
   * Apply outside-in sequencer according to Gray Paper Eq. 211-215
   *
   * Gray Paper: Z: sequence → sequence
   * Z(s) = [s[0], s[|s|-1], s[1], s[|s|-2], ...]
   *
   * This function reorders the sequence by taking elements from the outside in:
   * - First element (index 0)
   * - Last element (index |s|-1)
   * - Second element (index 1)
   * - Second-to-last element (index |s|-2)
   * - And so on...
   */
  private applyOutsideInSequencer(
    tickets: SafroleTicket[],
  ): Safe<SafroleTicket[]> {
    const result: SafroleTicket[] = []
    const length = tickets.length

    // Handle edge cases
    if (length === 0) return safeResult([])
    if (length === 1) return safeResult([...tickets])

    // Apply the outside-in sequencing
    for (let i = 0; i < length; i++) {
      // For even positions (0, 2, 4...), take from the front: 0, 1, 2...
      // For odd positions (1, 3, 5...), take from the back: length-1, length-2...
      const index =
        i % 2 === 0 ? Math.floor(i / 2) : length - 1 - Math.floor((i - 1) / 2)

      // Ensure index is valid (should always be true with correct math)
      if (index >= 0 && index < length) {
        result.push(tickets[index])
      }
    }

    return safeResult(result)
  }

  /**
   * Get seal key for a specific slot
   * Returns the seal key (ticket or Bandersnatch key) for the given slot
   */
  getSealKeyForSlot(slot: bigint): Safe<SafroleTicket | Uint8Array> {
    const phase = slot % BigInt(this.configService.epochDuration)

    const ticket = this.sealTicketForPhase.get(phase)
    if (ticket) {
      return safeResult(ticket)
    }
    const fallbackKey = this.fallbackKeyForPhase.get(phase)
    if (fallbackKey) {
      return safeResult(fallbackKey)
    }

    return safeError(new Error('No ticket or Bandersnatch key found for slot'))
  }

  getSealKeys(): (SafroleTicket | Uint8Array)[] {
    const sealKeys: (SafroleTicket | Uint8Array)[] = []
    for (let phase = 0; phase < this.configService.epochDuration; phase++) {
      const ticket = this.sealTicketForPhase.get(BigInt(phase))
      if (ticket) {
        sealKeys.push(ticket)
      } else {
        const fallbackKey = this.fallbackKeyForPhase.get(BigInt(phase))
        if (fallbackKey) {
          sealKeys.push(fallbackKey)
        }
      }
    }
    return sealKeys
  }

  /**
   * Initialize seal key service
   */
  setValidatorSetManager(validatorSetManager: ValidatorSetManager): void {
    this.validatorSetManager = validatorSetManager
  }
}
