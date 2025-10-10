/**
 * Validator Set Management
 *
 * Manages current, previous, and next epoch validator sets
 * Handles epoch transitions and validator metadata
 */

import { getRingRoot, type RingVRFProver } from '@pbnj/bandersnatch-vrf'
import {
  bytesToHex,
  type EpochTransitionEvent,
  type EventBusService,
  type Hex,
  hexToBytes,
  logger,
  type Safe,
  safeError,
  safeResult,
  type ValidatorSetChangeEvent,
  zeroHash,
} from '@pbnj/core'
import { isSafroleTicket } from '@pbnj/safrole'
import {
  BaseService,
  type IValidatorSetManager,
  type ValidatorKeyTuple,
} from '@pbnj/types'
import type { ConfigService } from './config-service'
import type { KeyPairService } from './keypair-service'
import type { SealKeyService } from './seal-key'
import type { TicketHolderService } from './ticket-holder-service'

/**
 * Validator set manager
 */
export class ValidatorSetManager
  extends BaseService
  implements IValidatorSetManager
{
  private readonly eventBusService: EventBusService
  private readonly sealKeyService: SealKeyService
  private readonly keyPairService: KeyPairService
  private readonly ticketHolderService: TicketHolderService
  private readonly ringProver: RingVRFProver
  private readonly configService: ConfigService

  // Gray Paper validator set definitions (preamble.tex lines 763-765)
  private activeSet: Map<number, ValidatorKeyTuple> = new Map() // κ - currently active validators
  private previousSet: Map<number, ValidatorKeyTuple> = new Map() // λ - previously active validators
  private pendingSet: Map<number, ValidatorKeyTuple> = new Map() // γ_P - next epoch validators
  private readonly stagingSet: Map<number, ValidatorKeyTuple> = new Map() // ι - validators to be drawn from next
  private readonly allKnownValidators: Map<number, ValidatorKeyTuple> =
    new Map()
  private readonly offenders: Set<number> = new Set()
  // Map of public keys to validator indices
  private readonly publicKeysToValidatorIndex: Map<Hex, number> = new Map()

  constructor(options: {
    eventBusService: EventBusService
    sealKeyService: SealKeyService
    keyPairService: KeyPairService
    ringProver: RingVRFProver
    ticketHolderService: TicketHolderService
    configService: ConfigService
    initialValidators?: Array<{
      index: number
      keys: ValidatorKeyTuple
    }>
  }) {
    super('validator-set-manager')
    this.eventBusService = options.eventBusService
    this.sealKeyService = options.sealKeyService
    this.keyPairService = options.keyPairService
    this.ticketHolderService = options.ticketHolderService
    this.ringProver = options.ringProver
    this.configService = options.configService

    this.eventBusService.onEpochTransition(this.handleEpochTransition)
    if (options.initialValidators) {
      for (const validator of options.initialValidators) {
        this.activeSet.set(validator.index, {
          bandersnatch: validator.keys.bandersnatch,
          ed25519: validator.keys.ed25519,
        })
        this.allKnownValidators.set(validator.index, {
          bandersnatch: validator.keys.bandersnatch,
          ed25519: validator.keys.ed25519,
        })
        this.publicKeysToValidatorIndex.set(
          validator.keys.ed25519,
          validator.index,
        )
      }
    } else {
      const numValidators = this.configService.numValidators
      for (let i = 0; i < numValidators; i++) {
        const [keyPairError, keyPair] = this.keyPairService.getValidatorAtIndex(
          BigInt(i),
        )
        if (keyPairError) {
          logger.error('Failed to get validator at index', {
            error: keyPairError,
          })
          continue
        }
        this.activeSet.set(i, {
          bandersnatch: keyPair.bandersnatch,
          ed25519: keyPair.ed25519,
        })
        this.allKnownValidators.set(i, {
          bandersnatch: keyPair.bandersnatch,
          ed25519: keyPair.ed25519,
        })
        this.publicKeysToValidatorIndex.set(keyPair.ed25519, i)
      }
    }
  }

  override stop(): Safe<boolean> {
    this.eventBusService.removeEpochTransitionCallback(
      this.handleEpochTransition,
    )
    return safeResult(true)
  }

  /**
   * Handle epoch transition events
   * Implements Gray Paper equations (115-118): Key rotation on epoch transition
   * ⟨pendingSet', activeSet', previousSet', epochRoot'⟩ ≡ (Φ(stagingSet), pendingSet, activeSet, z)
   */
  private handleEpochTransition(event: EpochTransitionEvent): Safe<void> {
    // Step 1: Apply blacklist filter Φ(stagingSet) - Gray Paper equation (119-128)
    const filteredStagingSet = this.applyBlacklistFilter(this.stagingSet)

    // Step 2: Rotate validator sets according to Gray Paper equations (115-117)
    // previousSet' = activeSet (current active becomes previous)
    this.previousSet = new Map(this.activeSet)

    // activeSet' = pendingSet (current pending becomes active)
    this.activeSet = new Map(this.pendingSet)

    // pendingSet' = Φ(stagingSet) (filtered staging becomes pending)
    this.pendingSet = new Map(filteredStagingSet)

    // Step 3: Clear staging set (it's now been promoted to pending)
    this.stagingSet.clear()

    // Step 4: Increment epoch
    // this.currentEpoch = event.newEpoch

    // Step 5: Clear offenders (they've been processed)
    this.offenders.clear()

    // Step 6: Calculate new epoch root - Gray Paper equation (118)
    const [epochRootError, epochRoot] = this.getEpochRoot()
    if (epochRootError) {
      logger.error('Failed to calculate epoch root', { error: epochRootError })
      return safeError(epochRootError)
    }

    // Step 7: Emit validator set change event
    const validatorSetChangeEvent: ValidatorSetChangeEvent = {
      timestamp: Date.now(),
      epoch: event.newEpoch,
      validators: this.activeSet,
    }
    this.eventBusService.emitValidatorSetChange(validatorSetChangeEvent)

    logger.info('Epoch transition completed successfully', {
      newEpoch: event.newEpoch.toString(),
      activeValidatorCount: this.activeSet.size,
      pendingValidatorCount: this.pendingSet.size,
      previousValidatorCount: this.previousSet.size,
      epochRoot: Array.from(epochRoot)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join(''),
    })

    return safeResult(undefined)
  }

  /**
   * Apply blacklist filter Φ(stagingSet) - Gray Paper equation (119-128)
   * Replaces offender keys with null keys (all zeros)
   */
  private applyBlacklistFilter(
    stagingSet: Map<number, ValidatorKeyTuple>,
  ): Map<number, ValidatorKeyTuple> {
    const filtered = new Map<number, ValidatorKeyTuple>()

    for (const [validatorIndex, metadata] of stagingSet) {
      // Check if this validator is in the offenders set
      const isOffender = this.offenders.has(validatorIndex)

      if (isOffender) {
        // Replace with null key (all zeros) - Gray Paper equation (122-123)
        const nullMetadata: ValidatorKeyTuple = {
          bandersnatch: zeroHash,
          ed25519: zeroHash,
        }
        filtered.set(validatorIndex, nullMetadata)

        logger.warn('Validator blacklisted during epoch transition', {
          validatorIndex: validatorIndex.toString(),
          publicKey: metadata.ed25519.toString(),
        })
      } else {
        // Keep original validator
        filtered.set(validatorIndex, metadata)
      }
    }

    return filtered
  }

  /**
   * Get current validator set
   */
  getActiveValidators(): Map<number, ValidatorKeyTuple> {
    return this.activeSet
  }

  getPendingValidators(): Map<number, ValidatorKeyTuple> {
    return this.pendingSet
  }

  getActiveValidatorKeys(): Uint8Array[] {
    return Array.from(this.activeSet.values()).map((validator) =>
      hexToBytes(validator.bandersnatch),
    )
  }

  /**
   *
   * @param ed25519PublicKey - The ed25519 public key to get the validator index for
   * @returns index of the validator
   */
  getValidatorIndex(ed25519PublicKey: Hex): Safe<number> {
    const validatorIndex = this.publicKeysToValidatorIndex.get(ed25519PublicKey)
    if (!validatorIndex) {
      return safeError(
        new Error(
          `Validator index not found for ed25519 public key ${ed25519PublicKey}`,
        ),
      )
    }
    return safeResult(validatorIndex)
  }

  /**
   * Get all validators that should be connected (active + previous + pending)
   */
  getAllConnectedValidators(): Map<number, ValidatorKeyTuple> {
    const allValidators = new Map<number, ValidatorKeyTuple>()

    // Add active validators
    for (const [index, metadata] of this.activeSet) {
      allValidators.set(index, metadata)
    }

    // Add previous validators
    for (const [index, metadata] of this.previousSet) {
      if (!allValidators.has(index)) {
        allValidators.set(index, metadata)
      }
    }

    // Add pending validators
    for (const [index, metadata] of this.pendingSet) {
      if (!allValidators.has(index)) {
        allValidators.set(index, metadata)
      }
    }

    return allValidators
  }

  /**
   * Get staging validator set (validators to be drawn from next)
   */
  getStagingValidators(): Map<number, ValidatorKeyTuple> {
    return new Map(this.stagingSet)
  }

  /**
   * Add validators to staging set
   * These will become the pending set in the next epoch transition
   */
  addToStagingSet(validators: Map<number, ValidatorKeyTuple>): void {
    for (const [index, metadata] of validators) {
      this.stagingSet.set(index, metadata)
    }

    logger.info('Added validators to staging set', {
      count: validators.size,
      totalStaging: this.stagingSet.size,
    })
  }

  /**
   * Remove validators from staging set
   */
  removeFromStagingSet(validatorIndices: number[]): void {
    for (const index of validatorIndices) {
      this.stagingSet.delete(index)
    }

    logger.info('Removed validators from staging set', {
      count: validatorIndices.length,
      totalStaging: this.stagingSet.size,
    })
  }

  /**
   * Add validators to offenders set
   * These will be blacklisted during the next epoch transition
   */
  addOffenders(validatorPublicKeys: Hex[]): void {
    for (const publicKey of validatorPublicKeys) {
      const validatorIndex = this.publicKeysToValidatorIndex.get(publicKey)
      if (!validatorIndex) {
        logger.warn(
          'Validator public key not found in public keys to validator index map',
          { publicKey },
        )
        continue
      }
      this.offenders.add(validatorIndex)
    }

    logger.warn('Added validators to offenders set', {
      count: validatorPublicKeys.length,
      totalOffenders: this.offenders.size,
    })
  }

  /**
   * Remove validators from offenders set
   */
  removeOffenders(validatorPublicKeys: Hex[]): void {
    for (const publicKey of validatorPublicKeys) {
      const validatorIndex = this.publicKeysToValidatorIndex.get(publicKey)
      if (!validatorIndex) {
        logger.warn(
          'Validator public key not found in public keys to validator index map',
          { publicKey },
        )
        continue
      }
      this.offenders.delete(validatorIndex)
    }

    logger.info('Removed validators from offenders set', {
      count: validatorPublicKeys.length,
      totalOffenders: this.offenders.size,
    })
  }

  /**
   * Update current validator set
   */
  updateCurrentValidators(validators: Map<number, ValidatorKeyTuple>): void {
    this.activeSet = new Map(validators)
  }

  /**
   * Check if validator set change is pending
   * Returns true if there are validators in staging set or offenders
   */
  isValidatorSetChangePending(): boolean {
    return this.stagingSet.size > 0 || this.offenders.size > 0
  }

  // ===== GRAY PAPER COMPLIANT VALIDATOR ELECTION METHODS =====

  /**
   * GRAY PAPER VALIDATOR ELECTION EXPLANATION:
   *
   * According to the Gray Paper, validator election works through a "ticket contest" system:
   *
   * 1. **Ticket Contest (Gray Paper Section 2.8.1)**:
   *    - Validators submit tickets during the epoch (before epochTailStart)
   *    - Each ticket contains: (entryIndex, Bandersnatch Ring VRF proof)
   *    - Tickets are scored by their VRF output (high-entropy 32-byte identifier)
   *    - The highest-scoring tickets become the "seal tickets" for the next epoch
   *
   * 2. **Seal Key Sequence (Gray Paper Eq. 144-156)**:
   *    - Two modes: Ticket Mode (preferred) and Fallback Mode
   *    - Ticket Mode: Uses winning tickets from the contest
   *    - Fallback Mode: Uses Bandersnatch keys directly when contest fails
   *
   * 3. **Block Authoring Rights**:
   *    - Each slot has a designated "seal key" from the seal key sequence
   *    - The validator who owns that seal key can author blocks for that slot
   *    - This is determined by: sealKey = sealTickets[slotIndex % epochLength]
   *
   * 4. **Epoch Root Calculation (Gray Paper Eq. 118)**:
   *    - epochRoot = getRingRoot({k_bs | k ∈ pendingSet'})
   *    - This creates a Bandersnatch ring root from all pending validators' Bandersnatch keys
   *    - Used for ticket proof verification in the next epoch
   *
   * NEXT STEPS FOR IMPLEMENTATION:
   * 1. Implement ticket contest management (ticket submission, scoring, selection)
   * 2. Implement seal key sequence generation from winning tickets
   * 3. Implement slot-to-validator mapping based on seal keys
   * 4. Implement proper Bandersnatch ring root calculation using RingVRF
   * 5. Add ticket validation and VRF proof verification
   * 6. Add fallback mode handling when ticket contest fails
   */

  /**
   * Check if a validator is elected to author blocks for the given slot
   * Implements Gray Paper validator election logic according to safrole.tex
   *
   * Gray Paper Eq. 145-156: The Slot Key Sequence
   * - Two modes: Ticket Mode (preferred) and Fallback Mode
   * - Ticket Mode uses winning tickets from the contest
   * - Fallback Mode uses Bandersnatch keys directly when contest fails
   *
   * @param validatorIndex - The validator index to check
   * @param slotIndex - The slot index to check
   * @returns true if the validator is elected for this slot
   * @throws Error if SealKeyService is not available
   */
  isValidatorElectedForSlot(publicKey: Hex, slotIndex: bigint): boolean {
    const validatorIndex = this.publicKeysToValidatorIndex.get(publicKey)
    if (!validatorIndex) {
      logger.warn('Validator not found in public keys to validator index map', {
        publicKey: publicKey,
      })
      return false
    }
    // First check if the validator exists in the active set
    const validator = this.activeSet.get(validatorIndex)
    if (!validator) {
      logger.debug('Validator not in active set', {
        validatorIndex: validatorIndex.toString(),
        slotIndex: slotIndex.toString(),
      })
      return false
    }

    // Get the seal key for this slot from the seal key service
    const [sealKeyError, sealKey] =
      this.sealKeyService.getSealKeyForSlot(slotIndex)
    if (sealKeyError) {
      logger.warn('No seal key found for slot', {
        slotIndex: slotIndex.toString(),
      })
      return false
    }

    if (!sealKey) {
      logger.warn('No seal key found for slot', {
        slotIndex: slotIndex.toString(),
      })
      return false
    }

    if (isSafroleTicket(sealKey)) {
      const [ticketHolderError, ticketHolderPublicKey] =
        this.ticketHolderService.getTicketHolder(sealKey)
      if (ticketHolderError) {
        logger.warn('No ticket holder found for seal key')
        return false
      }
      if (!ticketHolderPublicKey) {
        logger.warn('No ticket holder found for seal key')
        return false
      }
      return ticketHolderPublicKey === publicKey
    } else {
      // fallback -> check public key match
      return bytesToHex(sealKey) === publicKey
    }
  }

  /**
   * Get the epoch root for the current pending validator set
   * Implements Gray Paper equation (118): z = getRingRoot({k_bs | k ∈ pendingSet'})
   *
   * The epoch root is a Bandersnatch ring root composed from the Bandersnatch keys
   * of all validators in the pending set. This root is used for:
   * 1. Ticket proof verification in the next epoch
   * 2. Ring VRF proof validation
   * 3. Anonymous validator authentication
   *
   * @returns The epoch root as a 32-byte hash
   */
  getEpochRoot(): Safe<Uint8Array> {
    // Extract Bandersnatch keys from pending validators
    const bandersnatchKeys: Uint8Array[] = this.pendingSet
      .values()
      .toArray()
      .map((validator) => validator.bandersnatch)
      .filter((key) => !this.isNullKey(hexToBytes(key)))
      .map((key) => hexToBytes(key))

    // Calculate ring root using Bandersnatch VRF with secret key parameter
    return getRingRoot(
      bandersnatchKeys,
      this.keyPairService,
      this,
      this.ringProver,
    )
  }

  /**
   * Get validator key by index
   */
  getValidatorAtIndex(validatorIndex: number): Safe<ValidatorKeyTuple> {
    const keyPair = this.getAllConnectedValidators().get(validatorIndex)
    if (!keyPair) {
      return safeError(
        new Error(`Validator key pair not found for index ${validatorIndex}`),
      )
    }
    return safeResult(keyPair)
  }

  getValidatorByEd25519PublicKey(
    ed25519PublicKey: Hex,
  ): Safe<ValidatorKeyTuple> {
    const keyPair = this.getAllConnectedValidators()
      .values()
      .toArray()
      .find((keyPair) => keyPair.ed25519 === ed25519PublicKey)
    if (!keyPair) {
      return safeError(
        new Error(
          `Validator key pair not found for ed25519 public key ${ed25519PublicKey}`,
        ),
      )
    }
    return safeResult(keyPair)
  }

  /**
   * Check if a key is a null key (all zeros)
   * Gray Paper equation (122-123): null keys replace blacklisted validators
   */
  private isNullKey(key: Uint8Array): boolean {
    return key.every((byte) => byte === 0)
  }

  /**
   * Check if a validator is in the current active set
   * Implements Gray Paper activeSet lookup
   */
  isValidatorActive(validatorIndex: number): boolean {
    return this.activeSet.has(validatorIndex)
  }

  /**
   * Check if a validator is in the previous set
   * Implements Gray Paper previousSet lookup
   */
  isValidatorPrevious(validatorIndex: number): boolean {
    return this.previousSet.has(validatorIndex)
  }

  /**
   * Check if a validator is in the pending set
   * Implements Gray Paper pendingSet lookup
   */
  isValidatorPending(validatorIndex: number): boolean {
    return this.pendingSet.has(validatorIndex)
  }

  /**
   * Get validator count for current active set
   * Implements Gray Paper |activeSet|
   */
  getActiveValidatorCount(): number {
    return this.activeSet.size
  }

  /**
   * Get validator count for pending set
   * Implements Gray Paper |pendingSet|
   */
  getPendingValidatorCount(): number {
    return this.pendingSet.size
  }

  /**
   * Get validator count for previous set
   * Implements Gray Paper |previousSet|
   */
  getPreviousValidatorCount(): number {
    return this.previousSet.size
  }

  /**
   * Get validator count for staging set
   * Implements Gray Paper |stagingSet|
   */
  getStagingValidatorCount(): number {
    return this.stagingSet.size
  }
}
