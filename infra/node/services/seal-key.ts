/**
 * Seal Key Service Implementation
 *
 * Implements Gray Paper seal key sequence management according to safrole.tex
 * Manages sealtickets sequence and implements F() fallback function and Z() sequencer
 * Reference: Gray Paper Eq. 202-228 (The Slot Key Sequence)
 */

import {
  blake2bHash,
  bytesToHex,
  type EpochTransitionEvent,
  type EventBusService,
  hexToBytes,
  logger,
  type RevertEpochTransitionEvent,
} from '@pbnjam/core'
import { generateFallbackKeySequence, isSafroleTicket } from '@pbnjam/safrole'
import {
  BaseService,
  type ISealKeyService,
  type Safe,
  type SafroleTicketWithoutProof,
  safeError,
  safeResult,
  type ValidatorPublicKeys,
} from '@pbnjam/types'
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
export class SealKeyService extends BaseService implements ISealKeyService {
  private readonly sealTicketForPhase: Map<bigint, SafroleTicketWithoutProof> =
    new Map()
  private readonly fallbackKeyForPhase: Map<bigint, Uint8Array> = new Map()

  // Store winnersMark from block header - will be used to set seal keys on next epoch transition
  // Gray Paper Eq. 262-266: H_winnersmark = Z(ticketaccumulator) when e' = e ∧ m < Cepochtailstart ≤ m' ∧ |ticketaccumulator| = Cepochlen
  // Gray Paper Eq. 202-207: sealtickets' = Z(ticketaccumulator) when e' = e + 1 ∧ m ≥ Cepochtailstart ∧ |ticketaccumulator| = Cepochlen
  private pendingWinnersMark: SafroleTicketWithoutProof[] | null = null
  // Store state before epoch transition for revert
  private preTransitionSealTickets: Map<
    bigint,
    SafroleTicketWithoutProof
  > | null = null
  private preTransitionFallbackKeys: Map<bigint, Uint8Array> | null = null

  // Dependencies
  private readonly eventBusService: EventBusService
  private readonly entropyService: EntropyService
  private validatorSetManager!: ValidatorSetManager // Initialized in init method
  private readonly ticketService: TicketService
  private readonly configService: ConfigService
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
    // Register epoch transition callback in constructor
    // Note: Callback execution order depends on service construction order
    // ValidatorSetManager should be constructed before SealKeyService to ensure
    // its handleEpochTransition runs first (updating activeSet' before seal key calculation)
    this.eventBusService.addEpochTransitionCallback(
      this.handleEpochTransition.bind(this),
    )
    this.eventBusService.addRevertEpochTransitionCallback(
      this.handleRevertEpochTransition.bind(this),
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
    // Save state before clearing for potential revert
    this.preTransitionSealTickets = new Map(this.sealTicketForPhase)
    this.preTransitionFallbackKeys = new Map(this.fallbackKeyForPhase)

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
   * Handle revert epoch transition event
   * Restores seal keys to their state before the epoch transition
   */
  private readonly handleRevertEpochTransition = (
    event: RevertEpochTransitionEvent,
  ): Safe<void> => {
    if (!this.preTransitionSealTickets || !this.preTransitionFallbackKeys) {
      logger.warn('[SealKeyService] No pre-transition seal keys to revert to', {
        slot: event.slot.toString(),
      })
      return safeResult(undefined)
    }

    logger.info('[SealKeyService] Reverting epoch transition', {
      slot: event.slot.toString(),
    })

    // Restore previous seal keys
    this.sealTicketForPhase.clear()
    this.fallbackKeyForPhase.clear()
    for (const [phase, ticket] of this.preTransitionSealTickets) {
      this.sealTicketForPhase.set(phase, ticket)
    }
    for (const [phase, key] of this.preTransitionFallbackKeys) {
      this.fallbackKeyForPhase.set(phase, key)
    }

    // Clear saved state
    this.preTransitionSealTickets = null
    this.preTransitionFallbackKeys = null

    return safeResult(undefined)
  }

  /**
   * Store winnersMark from block header
   * Gray Paper Eq. 262-266: H_winnersmark = Z(ticketaccumulator) when e' = e ∧ m < Cepochtailstart ≤ m' ∧ |ticketaccumulator| = Cepochlen
   * This will be used to set seal keys on the next epoch transition
   */
  setWinnersMark(winnersMark: SafroleTicketWithoutProof[]): void {
    logger.info(
      '[SealKeyService] Storing winnersMark for next epoch transition',
      {
        winnersMarkLength: winnersMark.length,
      },
    )
    this.pendingWinnersMark = winnersMark
  }

  /**
   * Get pending winnersMark (if available)
   * Used for pre-computing seal keys before epoch transition
   */
  getPendingWinnersMark(): SafroleTicketWithoutProof[] | null {
    return this.pendingWinnersMark
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
   *
   * @param overrides Optional overrides for pre-computed values (used for validation without state mutation)
   * @param overrides.pendingWinnersMarkOverride Optional: Pre-computed winnersMark (already Z-sequenced)
   * @param overrides.ticketAccumulatorOverride Optional: Pre-computed ticket accumulator (before Z-sequencing)
   * @param overrides.entropy2Override Optional: Pre-computed entropy2 (old entropy2 before rotation for epoch transitions)
   * @param overrides.activeValidatorsOverride Optional: Pre-computed active validator set (new active set for epoch transitions)
   * @param overrides.storeInState Optional: Whether to store the computed seal keys in state (default: true)
   * @returns The computed seal key for the specified phase, or all phases if phase is not specified
   */
  calculateNewSealKeySequence(options?: {
    pendingWinnersMarkOverride?: SafroleTicketWithoutProof[] | null
    ticketAccumulatorOverride?: SafroleTicketWithoutProof[] | null
    entropy2Override?: Uint8Array | null
    activeValidatorsOverride?: Map<number, ValidatorPublicKeys> | null
    storeInState?: boolean
    phase?: number // If specified, only compute and return the seal key for this phase
  }): Safe<
    | SafroleTicketWithoutProof
    | Uint8Array
    | (SafroleTicketWithoutProof | Uint8Array)[]
    | undefined
  > {
    const storeInState = options?.storeInState !== false // Default to true
    const targetPhase = options?.phase

    // Priority 1: Use winnersMark from block header if available
    // Gray Paper Eq. 202-207: sealtickets' = Z(ticketaccumulator) when e' = e + 1 ∧ m ≥ Cepochtailstart ∧ |ticketaccumulator| = Cepochlen
    // The winnersMark is already Z-sequenced, so we use it directly
    const pendingWinnersMark =
      options?.pendingWinnersMarkOverride ?? this.pendingWinnersMark
    if (pendingWinnersMark) {
      logger.info(
        '[SealKeyService] Using winnersMark from block header for seal keys',
        {
          winnersMarkLength: pendingWinnersMark.length,
          hasOverride: options?.pendingWinnersMarkOverride !== undefined,
        },
      )

      // Validate winnersMark length
      if (pendingWinnersMark.length !== this.configService.epochDuration) {
        return safeError(
          new Error(
            `WinnersMark length (${pendingWinnersMark.length}) does not match epoch duration (${this.configService.epochDuration})`,
          ),
        )
      }

      // If phase is specified, return only that phase
      if (targetPhase !== undefined) {
        if (targetPhase >= pendingWinnersMark.length) {
          return safeError(
            new Error(
              `Phase ${targetPhase} >= winnersMark length (${pendingWinnersMark.length})`,
            ),
          )
        }
        const ticket = pendingWinnersMark[targetPhase]
        if (!ticket) {
          return safeError(
            new Error(`Missing ticket at phase ${targetPhase} in winnersMark`),
          )
        }
        return safeResult(ticket)
      }

      // Set seal keys from winnersMark (already Z-sequenced)
      if (storeInState) {
        for (let phase = 0; phase < this.configService.epochDuration; phase++) {
          const ticket = pendingWinnersMark[phase]
          if (!ticket) {
            return safeError(
              new Error(`Missing ticket at phase ${phase} in winnersMark`),
            )
          }
          this.sealTicketForPhase.set(BigInt(phase), ticket)
        }

        // Clear pending winnersMark after using it (only if using state version)
        if (!options?.pendingWinnersMarkOverride) {
          this.pendingWinnersMark = null
        }
      } else {
        // Return all phases without storing in state
        return safeResult([...pendingWinnersMark])
      }

      return safeResult(undefined)
    }

    // Priority 2: Use ticket accumulator if full (fallback if winnersMark not available)
    const ticketAccumulator =
      options?.ticketAccumulatorOverride ??
      (this.ticketService.isAccumulatorFull()
        ? this.ticketService.getTicketAccumulator()
        : null)

    if (
      ticketAccumulator &&
      ticketAccumulator.length >= this.configService.epochDuration
    ) {
      const [error, reorderedTickets] =
        this.applyOutsideInSequencer(ticketAccumulator)
      if (error) {
        return safeError(error)
      }

      if (!reorderedTickets) {
        return safeError(new Error('Reordered tickets is null'))
      }

      // If phase is specified, return only that phase
      if (targetPhase !== undefined) {
        if (targetPhase >= reorderedTickets.length) {
          return safeError(
            new Error(
              `Phase ${targetPhase} >= reordered tickets length (${reorderedTickets.length})`,
            ),
          )
        }
        const ticket = reorderedTickets[targetPhase]
        if (!ticket) {
          return safeError(
            new Error(
              `Missing ticket at phase ${targetPhase} in reordered tickets`,
            ),
          )
        }
        return safeResult(ticket)
      }

      // Generate seal keys for ALL 600 slots in the epoch
      if (storeInState) {
        for (let phase = 0; phase < this.configService.epochDuration; phase++) {
          const ticket = reorderedTickets[phase]
          if (!ticket) {
            return safeError(
              new Error(
                `Missing ticket at phase ${phase} in reordered tickets`,
              ),
            )
          }
          this.sealTicketForPhase.set(BigInt(phase), ticket)
        }
      } else {
        // Return all phases without storing in state
        return safeResult(
          reorderedTickets.slice(0, this.configService.epochDuration),
        )
      }
      return safeResult(undefined)
    }

    // Priority 3: Fallback mode - compute using F(entropy'_2, activeset')
    // Try using old entropy2 (before rotation) first, as test vectors may expect this
    // If oldEntropy2BeforeRotation is null, fall back to entropy'_2 (after rotation)
    const entropy2 =
      options?.entropy2Override ?? this.entropyService.getEntropy2()

    // Gray Paper Eq. 202-207: F(entropy'_2, activeset')
    // The epoch mark contains pendingSet' (validators for NEXT epoch), NOT activeSet'
    // After epoch transition: activeSet' = pendingSet (old pending becomes new active)
    // So we MUST use validatorSetManager.getActiveValidators() which returns activeSet'
    // This must be called AFTER validatorSetManager.handleEpochTransition has updated activeSet'
    const activeValidators =
      options?.activeValidatorsOverride ??
      this.validatorSetManager.getActiveValidators()

    if (activeValidators.size === 0) {
      return safeError(
        new Error(
          'Active validator set is empty - validator set manager may not have updated yet',
        ),
      )
    }

    // For fallback, we need to use generateFallbackKeySequence which requires ValidatorSetManager
    // If we have an override, we need to create a temporary validator set array
    if (options?.activeValidatorsOverride) {
      // Convert Map to array for generateFallbackKeySequence
      // We need to create a temporary ValidatorSetManager-like object or use a different approach
      // For now, let's use the computeFallbackSealKeyForPhase approach from BlockImporterService
      // But we need to generate all phases, not just one
      const fallbackKeys: Uint8Array[] = []
      for (let phase = 0; phase < this.configService.epochDuration; phase++) {
        const [fallbackError, fallbackKey] =
          this.computeFallbackSealKeyForPhase(entropy2, activeValidators, phase)
        if (fallbackError) {
          return safeError(fallbackError)
        }
        if (!fallbackKey) {
          return safeError(new Error(`Missing fallback key at phase ${phase}`))
        }
        fallbackKeys.push(fallbackKey)

        // If phase is specified, return only that phase
        if (targetPhase !== undefined && phase === targetPhase) {
          return safeResult(fallbackKey)
        }
      }

      if (storeInState) {
        for (let phase = 0; phase < this.configService.epochDuration; phase++) {
          const ticket = fallbackKeys[phase]
          if (!ticket) {
            return safeError(
              new Error(`Missing fallback key at phase ${phase}`),
            )
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
      } else {
        return safeResult(fallbackKeys)
      }
    } else {
      // Use the standard generateFallbackKeySequence when using state
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

      // If phase is specified, return only that phase
      if (targetPhase !== undefined) {
        if (targetPhase >= fallbackKeys.length) {
          return safeError(
            new Error(
              `Phase ${targetPhase} >= fallback keys length (${fallbackKeys.length})`,
            ),
          )
        }
        const ticket = fallbackKeys[targetPhase]
        if (!ticket) {
          return safeError(
            new Error(`Missing fallback key at phase ${targetPhase}`),
          )
        }
        return safeResult(ticket)
      }

      if (storeInState) {
        for (let phase = 0; phase < this.configService.epochDuration; phase++) {
          const ticket = fallbackKeys[phase]
          if (!ticket) {
            return safeError(
              new Error(`Missing fallback key at phase ${phase}`),
            )
          }
          this.fallbackKeyForPhase.set(BigInt(phase), ticket)
        }
      } else {
        return safeResult(fallbackKeys)
      }
    }

    return safeResult(undefined)
  }

  /**
   * Compute fallback seal key for a specific phase without mutating state
   * Used when activeValidatorsOverride is provided (for validation without state mutation)
   *
   * Gray Paper Eq. 220-228: F(r, k) = cyclic{k[decode[4]{blake(r ∥ encode[4]{i})}_4]}_bs
   *
   * @param entropy2 - Entropy2 to use (old entropy1 for epoch transitions)
   * @param activeValidators - Active validator set (new active set for epoch transitions)
   * @param phase - Phase index (slot % epochDuration)
   * @returns The Bandersnatch key for this phase
   */
  private computeFallbackSealKeyForPhase(
    entropy2: Uint8Array,
    activeValidators: Map<number, ValidatorPublicKeys>,
    phase: number,
  ): Safe<Uint8Array> {
    // Gray Paper: encode[4]{i} - Encode phase as 4 bytes (little-endian)
    const indexBytes = new Uint8Array(4)
    new DataView(indexBytes.buffer).setUint32(0, phase, true) // true = little-endian

    // Gray Paper: blake(r ∥ encode[4]{i})
    const combined = new Uint8Array(entropy2.length + indexBytes.length)
    combined.set(entropy2, 0)
    combined.set(indexBytes, entropy2.length)

    const [hashError, hashData] = blake2bHash(combined)
    if (hashError) {
      return safeError(hashError)
    }

    // Gray Paper: decode[4]{hash}_4 - Take first 4 bytes of hash as a 32-bit integer
    const hashBytes = hexToBytes(hashData)
    const dataView = new DataView(hashBytes.buffer.slice(0, 4))
    const decodedIndex = dataView.getUint32(0, true) // true = little-endian

    const activeValidatorSize = activeValidators.size
    if (activeValidatorSize === 0) {
      return safeError(
        new Error(
          'Active validator set is empty, cannot compute fallback seal key',
        ),
      )
    }

    // Use the decoded index to select a validator (cyclic indexing)
    const validatorIndex = decodedIndex % activeValidatorSize

    // Gray Paper: cyclic{k[index]}_bs - Get Bandersnatch key from validator
    const validator = activeValidators.get(validatorIndex)
    if (!validator) {
      return safeError(
        new Error(
          `Validator at index ${validatorIndex} not found in active set (size: ${activeValidatorSize})`,
        ),
      )
    }

    return safeResult(hexToBytes(validator.bandersnatch))
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
