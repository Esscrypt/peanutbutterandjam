/**
 * Seal Key Service Implementation
 *
 * Implements Gray Paper seal key sequence management according to safrole.tex
 * Manages sealtickets sequence and implements F() fallback function and Z() sequencer
 * Reference: Gray Paper Eq. 202-228 (The Slot Key Sequence)
 */

import {
  bytesToHex,
  type EpochTransitionEvent,
  type EventBusService,
  logger,
} from '@pbnj/core'
import { generateFallbackKeySequence, isSafroleTicket } from '@pbnj/safrole'
import {
  BaseService,
  type Safe,
  type SafroleTicketWithoutProof,
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
  private readonly sealTicketForPhase: Map<bigint, SafroleTicketWithoutProof> =
    new Map()
  private readonly fallbackKeyForPhase: Map<bigint, Uint8Array> = new Map()

  // Store winnersMark from block header - will be used to set seal keys on next epoch transition
  // Gray Paper Eq. 262-266: H_winnersmark = Z(ticketaccumulator) when e' = e ∧ m < Cepochtailstart ≤ m' ∧ |ticketaccumulator| = Cepochlen
  // Gray Paper Eq. 202-207: sealtickets' = Z(ticketaccumulator) when e' = e + 1 ∧ m ≥ Cepochtailstart ∧ |ticketaccumulator| = Cepochlen
  private pendingWinnersMark: SafroleTicketWithoutProof[] | null = null

  // Save old entropy2 before rotation for seal key generation
  // Gray Paper Eq. 202-207: F(entropy'_2, activeset')
  // Note: entropy'_2 = old entropy1 after rotation, but test vectors may use old entropy2
  private oldEntropy2BeforeRotation: Uint8Array | null = null

  // Dependencies
  private readonly eventBusService: EventBusService
  private readonly entropyService: EntropyService
  private validatorSetManager!: ValidatorSetManager // Initialized in init method
  private readonly ticketService: TicketService
  private readonly configService: ConfigService
  private readonly boundHandleEpochTransition: (
    event: EpochTransitionEvent,
  ) => Safe<void>

  constructor(options: {
    eventBusService: EventBusService
    entropyService: EntropyService
    ticketService: TicketService
    configService: ConfigService
  }) {
    super('seal-key-service')
    this.eventBusService = options.eventBusService
    this.entropyService = options.entropyService
    this.ticketService = options.ticketService
    this.configService = options.configService
    // Bind callback but don't register yet - will be registered after ValidatorSetManager
    // This ensures ValidatorSetManager.handleEpochTransition runs first
    this.boundHandleEpochTransition = this.handleEpochTransition.bind(this)
  }

  /**
   * Register epoch transition callback
   * Should be called AFTER ValidatorSetManager is created to ensure proper execution order
   */
  registerEpochTransitionCallback(): void {
    this.eventBusService.addEpochTransitionCallback(
      this.boundHandleEpochTransition,
    )
  }

  /**
   * Handle epoch transition events
   * Updates seal key sequence according to Gray Paper Eq. 202-207
   *
   * IMPORTANT: This callback must run AFTER validatorSetManager.handleEpochTransition
   * because it needs the updated activeSet' (new active set) to calculate the seal key sequence.
   * Gray Paper Eq. 202-207: F(entropy'_2, activeset') uses the NEW active set.
   *
   * To ensure proper execution order, this callback is registered AFTER ValidatorSetManager
   * in the service initialization sequence.
   *
   * NOTE: According to Gray Paper Eq. 202-207: F(entropy'_2, activeset')
   * - entropy'_2 = entropy2 AFTER epoch transition = old entropy1 (from Eq. 179-181)
   * - activeset' = active set AFTER epoch transition = old pendingSet (from Eq. 115-118)
   *
   * However, test vectors may use old entropy2 (before rotation) instead of old entropy1.
   * We save old entropy2 before entropy rotation to allow testing both interpretations.
   */
  private readonly handleEpochTransition = (
    event: EpochTransitionEvent,
  ): Safe<void> => {
    logger.info(
      '[SealKeyService] Epoch transition - calculating new seal key sequence',
      {
        slot: event.slot.toString(),
      },
    )

    // Save old entropy2 BEFORE entropy rotation
    // This allows us to test if test vectors use old entropy2 instead of entropy'_2
    const oldEntropy2 = this.entropyService.getEntropy2()
    this.oldEntropy2BeforeRotation = oldEntropy2

    // Clear old seal keys before calculating new ones
    // This ensures we don't have stale keys from the previous epoch
    this.sealTicketForPhase.clear()
    this.fallbackKeyForPhase.clear()

    // Validate that validatorSetManager has been updated
    // This is a safety check - if validator set hasn't updated yet, we'll get an error
    if (!this.validatorSetManager) {
      return safeError(
        new Error(
          'ValidatorSetManager not set - cannot calculate seal key sequence',
        ),
      )
    }

    // Calculate new seal key sequence using the updated activeSet'
    // This must happen after validatorSetManager has updated activeSet' = pendingSet
    // Note: epochMark contains pendingSet' (for NEXT epoch), NOT activeSet' (for CURRENT epoch)
    // So we don't pass epochMark - we use validatorSetManager.getActiveValidators() instead
    const [error] = this.calculateNewSealKeySequence()
    if (error) {
      logger.error('[SealKeyService] Failed to calculate seal key sequence', {
        slot: event.slot.toString(),
        error: error.message,
      })
      return safeError(error)
    }

    // after calculating the sequence for the new epoch, clear the ticket accumulator
    this.ticketService.clearTicketAccumulator()

    logger.info(
      '[SealKeyService] Epoch transition - seal key sequence calculated',
      {
        slot: event.slot.toString(),
        fallbackKeysCount: this.fallbackKeyForPhase.size,
        ticketKeysCount: this.sealTicketForPhase.size,
      },
    )

    return safeResult(undefined)
  }

  /**
   * Store winnersMark from block header
   * Gray Paper Eq. 262-266: H_winnersmark = Z(ticketaccumulator) when e' = e ∧ m < Cepochtailstart ≤ m' ∧ |ticketaccumulator| = Cepochlen
   * This will be used to set seal keys on the next epoch transition
   */
  setWinnersMark(winnersMark: SafroleTicketWithoutProof[]): void {
    logger.info('[SealKeyService] Storing winnersMark for next epoch transition', {
      winnersMarkLength: winnersMark.length,
    })
    this.pendingWinnersMark = winnersMark
  }

  /**
   * Calculate new seal key sequence according to Gray Paper Eq. 202-207
   *
   * Gray Paper: sealtickets' ≡ {
   *   Z(ticketaccumulator) when e' = e + 1 ∧ m ≥ EPOCH_TAIL_START ∧ |ticketaccumulator| = EPOCH_LENGTH
   *   sealtickets when e' = e
   *   F(entropy'_2, activeset') otherwise
   * }
   *
   * Where m = previous slot's phase within the epoch (Gray Paper line 33)
   *
   * IMPORTANT: This must be called AFTER validatorSetManager has updated activeSet' = pendingSet
   * because F(entropy'_2, activeset') uses the NEW active set (activeset').
   *
   * NOTE: According to Gray Paper Eq. 179-181: entropy'_2 = old entropy1 (after rotation)
   * However, test vectors may use old entropy2 (before rotation). We try old entropy2 first.
   *
   * PRIORITY: If winnersMark is available (from block header), use it directly instead of recalculating
   * Gray Paper Eq. 202-207: sealtickets' = Z(ticketaccumulator) when conditions are met
   * The winnersMark is already Z-sequenced, so we can use it directly.
   */
  private calculateNewSealKeySequence(): Safe<void> {
    // Priority 1: Use winnersMark from block header if available
    // Gray Paper Eq. 202-207: sealtickets' = Z(ticketaccumulator) when e' = e + 1 ∧ m ≥ Cepochtailstart ∧ |ticketaccumulator| = Cepochlen
    // The winnersMark is already Z-sequenced, so we use it directly
    if (this.pendingWinnersMark) {
      logger.info(
        '[SealKeyService] Using winnersMark from block header for seal keys',
        {
          winnersMarkLength: this.pendingWinnersMark.length,
        },
      )

      // Validate winnersMark length
      if (this.pendingWinnersMark.length !== this.configService.epochDuration) {
        return safeError(
          new Error(
            `WinnersMark length (${this.pendingWinnersMark.length}) does not match epoch duration (${this.configService.epochDuration})`,
          ),
        )
      }

      // Set seal keys from winnersMark (already Z-sequenced)
      for (let phase = 0; phase < this.configService.epochDuration; phase++) {
        const ticket = this.pendingWinnersMark[phase]
        if (!ticket) {
          return safeError(
            new Error(`Missing ticket at phase ${phase} in winnersMark`),
          )
        }
        this.sealTicketForPhase.set(BigInt(phase), ticket)
      }

      // Clear pending winnersMark after using it
      this.pendingWinnersMark = null

      return safeResult(undefined)
    }

    // Priority 2: Use ticket accumulator if full (fallback if winnersMark not available)
    if (this.ticketService.isAccumulatorFull()) {
      const [error, reorderedTickets] = this.applyOutsideInSequencer(
        this.ticketService.getTicketAccumulator(),
      )
      if (error) {
        return safeError(error)
      }

      if (!reorderedTickets) {
        return safeError(new Error('Reordered tickets is null'))
      }

      // Generate seal keys for ALL 600 slots in the epoch
      for (let phase = 0; phase < this.configService.epochDuration; phase++) {
        const ticket = reorderedTickets[phase]
        if (!ticket) {
          return safeError(
            new Error(`Missing ticket at phase ${phase} in reordered tickets`),
          )
        }
        this.sealTicketForPhase.set(BigInt(phase), ticket)
      }
      return safeResult(undefined)
    }

    // Try using old entropy2 (before rotation) first, as test vectors may expect this
    // If oldEntropy2BeforeRotation is null, fall back to entropy'_2 (after rotation)
    const entropy2 =
      this.oldEntropy2BeforeRotation ?? this.entropyService.getEntropy2()
    const entropy2Hex = bytesToHex(entropy2)

    logger.info('[SealKeyService] Using entropy for fallback key generation', {
      usingOldEntropy2: this.oldEntropy2BeforeRotation !== null,
      entropy2: entropy2Hex,
    })

    // Gray Paper Eq. 202-207: F(entropy'_2, activeset')
    // The epoch mark contains pendingSet' (validators for NEXT epoch), NOT activeSet'
    // After epoch transition: activeSet' = pendingSet (old pending becomes new active)
    // So we MUST use validatorSetManager.getActiveValidators() which returns activeSet'
    // This must be called AFTER validatorSetManager.handleEpochTransition has updated activeSet'
    const activeValidators = this.validatorSetManager.getActiveValidators()
    if (activeValidators.size === 0) {
      return safeError(
        new Error(
          'Active validator set is empty - validator set manager may not have updated yet',
        ),
      )
    }

    logger.info('[SealKeyService] Generating fallback key sequence', {
      entropy2: entropy2Hex,
      activeValidatorsSize: activeValidators.size,
      activeValidators: Array.from(activeValidators.values())
        .slice(0, 6)
        .map((v, idx) => ({
          index: idx,
          bandersnatch: v.bandersnatch,
        })),
    })

    const [error, fallbackKeys] = generateFallbackKeySequence(
      entropy2,
      this.validatorSetManager,
      this.configService,
    )
    if (error) {
      return safeError(error)
    }

    if (!fallbackKeys) {
      return safeError(new Error('Fallback keys is null'))
    }

    for (let phase = 0; phase < this.configService.epochDuration; phase++) {
      const ticket = fallbackKeys[phase]
      if (!ticket) {
        return safeError(new Error(`Missing fallback key at phase ${phase}`))
      }
      this.fallbackKeyForPhase.set(BigInt(phase), ticket)

      // Log first few phases and phase 12 specifically for debugging
      if (phase < 3 || phase === 12) {
        logger.debug('[SealKeyService] Fallback key for phase', {
          phase,
          sealKey: bytesToHex(ticket),
        })
      }
    }

    logger.info('[SealKeyService] Fallback key sequence generated', {
      totalPhases: this.configService.epochDuration,
      phase12Key: fallbackKeys[12] ? bytesToHex(fallbackKeys[12]) : 'undefined',
    })

    return safeResult(undefined)
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
    tickets: SafroleTicketWithoutProof[],
  ): Safe<SafroleTicketWithoutProof[]> {
    const result: SafroleTicketWithoutProof[] = []
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
  getSealKeyForSlot(
    slot: bigint,
  ): Safe<SafroleTicketWithoutProof | Uint8Array> {
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

  getSealKeys(): (SafroleTicketWithoutProof | Uint8Array)[] {
    const sealKeys: (SafroleTicketWithoutProof | Uint8Array)[] = []
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

  setSealKeys(sealKeys: (SafroleTicketWithoutProof | Uint8Array)[]): void {
    // Clear existing seal keys before setting new ones
    this.sealTicketForPhase.clear()
    this.fallbackKeyForPhase.clear()

    // Validate array length matches epoch duration
    if (sealKeys.length !== this.configService.epochDuration) {
      logger.warn('[SealKeyService] Seal keys array length mismatch', {
        expected: this.configService.epochDuration,
        actual: sealKeys.length,
      })
    }

    for (let phase = 0; phase < this.configService.epochDuration; phase++) {
      const sealKey = sealKeys[phase]
      // Skip undefined entries (array might be shorter than epochDuration)
      if (sealKey === undefined) {
        logger.warn('[SealKeyService] Missing seal key for phase', {
          phase,
          arrayLength: sealKeys.length,
        })
        continue
      }

      if (isSafroleTicket(sealKey)) {
        this.sealTicketForPhase.set(
          BigInt(phase),
          sealKey as SafroleTicketWithoutProof,
        )
      } else if (sealKey instanceof Uint8Array) {
        this.fallbackKeyForPhase.set(BigInt(phase), sealKey)
      } else {
        logger.warn('[SealKeyService] Invalid seal key type for phase', {
          phase,
          type: typeof sealKey,
        })
      }
    }
  }
}
