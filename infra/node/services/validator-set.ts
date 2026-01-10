/**
 * Validator Set Management
 *
 * Manages current, previous, and next epoch validator sets
 * Handles epoch transitions and validator metadata
 */

import { getRingRoot, type RingVRFProverWasm } from '@pbnjam/bandersnatch-vrf'
import {
  bytesToHex,
  type EpochTransitionEvent,
  type EventBusService,
  type Hex,
  hexToBytes,
  logger,
  type RevertEpochTransitionEvent,
  type ValidatorSetChangeEvent,
  zeroHash,
} from '@pbnjam/core'
import { isSafroleTicket } from '@pbnjam/safrole'
import {
  BaseService,
  type ConnectionEndpoint,
  type IValidatorSetManager,
  type Safe,
  type SafePromise,
  safeError,
  safeResult,
  type ValidatorPublicKeys,
} from '@pbnjam/types'
import type { ConfigService } from './config-service'
import type { SealKeyService } from './seal-key'
import type { TicketService } from './ticket-service'

/**
 * Validator set manager
 */
export class ValidatorSetManager
  extends BaseService
  implements IValidatorSetManager
{
  private readonly eventBusService: EventBusService
  private readonly sealKeyService: SealKeyService | null
  private ticketService: TicketService | null
  private readonly ringProver: RingVRFProverWasm
  private readonly configService: ConfigService
  // private entropyService: EntropyService | null
  // private clockService: ClockService | null

  // Gray Paper validator set definitions (preamble.tex lines 763-765)
  private activeSet: ValidatorPublicKeys[] = [] // κ - currently active validators
  private previousSet: ValidatorPublicKeys[] = [] // λ - previously active validators
  private pendingSet: ValidatorPublicKeys[] = [] // γ_P - next epoch validators
  private stagingSet: ValidatorPublicKeys[] = [] // ι - validators to be drawn from next

  private readonly offenders: Set<number> = new Set()
  // Store offender ed25519 keys for epoch root computation (before clearing)
  private offenderEd25519Keys: Set<Hex> = new Set()
  // Map of public keys to validator indices
  private readonly publicKeysToValidatorIndex: Map<Hex, number> = new Map()

  // Initialize to 144-byte zero epoch root (Gray Paper: ringroot ⊂ blob[144])
  private epochRoot: Hex = `0x${'00'.repeat(144)}` as Hex
  // Store bound callback for removal
  private readonly boundHandleEpochTransition: (
    event: EpochTransitionEvent,
  ) => SafePromise<void>
  // Store state before epoch transition for revert
  private preTransitionState: {
    activeSet: ValidatorPublicKeys[]
    pendingSet: ValidatorPublicKeys[]
    previousSet: ValidatorPublicKeys[]
    epochRoot: Hex
  } | null = null

  constructor(options: {
    eventBusService: EventBusService
    sealKeyService: SealKeyService | null
    ringProver: RingVRFProverWasm
    ticketService: TicketService | null
    configService: ConfigService
    initialValidators: ValidatorPublicKeys[] | null
  }) {
    super('validator-set-manager')
    this.eventBusService = options.eventBusService
    this.sealKeyService = options.sealKeyService
    this.ticketService = options.ticketService
    this.ringProver = options.ringProver
    this.configService = options.configService
    // this.entropyService = options.entropyService
    // this.clockService = options.clockService

    if (options.initialValidators) {
      // Gray Paper: Validator sets must have exactly Cvalcount elements
      // Pad with null keys if we have fewer validators than Cvalcount
      const validatorCount = this.configService.numValidators
      const paddedValidators = this.padValidatorSet(
        options.initialValidators,
        validatorCount,
      )

      this.activeSet = [...paddedValidators]
      // At genesis, pendingSet should also be initialized from initialValidators
      // Gray Paper: pendingSet' is set during epoch transitions, but at genesis
      // we need to initialize it from the initial validators
      this.pendingSet = [...paddedValidators]
      // Staging set and previous set should be initialized with null keys at genesis
      // They will be populated during epoch transitions
      const nullValidators = this.createNullValidatorSet(validatorCount)
      this.stagingSet = [...nullValidators]
      this.previousSet = [...nullValidators]
      // Populate publicKeysToValidatorIndex map for offender lookups
      this.updatePublicKeysToValidatorIndex(this.activeSet)
    }

    // Bind the callback and store it for later removal
    this.boundHandleEpochTransition = this.handleEpochTransition.bind(this)
    this.eventBusService.addEpochTransitionCallback(
      this.boundHandleEpochTransition,
    )
    this.eventBusService.addRevertEpochTransitionCallback(
      this.handleRevertEpochTransition.bind(this),
    )
  }

  /**
   * Handle revert epoch transition event
   * Restores validator sets to their state before the epoch transition
   */
  private handleRevertEpochTransition(
    event: RevertEpochTransitionEvent,
  ): Safe<void> {
    if (!this.preTransitionState) {
      logger.warn(
        '[ValidatorSetManager] No pre-transition state to revert to',
        { slot: event.slot.toString() },
      )
      return safeResult(undefined)
    }

    logger.info('[ValidatorSetManager] Reverting epoch transition', {
      slot: event.slot.toString(),
    })

    // Restore previous state
    this.activeSet = [...this.preTransitionState.activeSet]
    this.pendingSet = [...this.preTransitionState.pendingSet]
    this.previousSet = [...this.preTransitionState.previousSet]
    this.epochRoot = this.preTransitionState.epochRoot

    // Update publicKeysToValidatorIndex map
    this.updatePublicKeysToValidatorIndex(this.activeSet)

    // Clear saved state
    this.preTransitionState = null

    return safeResult(undefined)
  }

  setTicketService(ticketService: TicketService): void {
    this.ticketService = ticketService
  }

  override stop(): Safe<boolean> {
    this.eventBusService.removeEpochTransitionCallback(
      this.boundHandleEpochTransition,
    )
    return safeResult(true)
  }

  /**
   * Handle epoch transition events
   * Implements Gray Paper equations (115-118): Key rotation on epoch transition
   * ⟨pendingSet', activeSet', previousSet', epochRoot'⟩ ≡ (Φ(stagingSet), pendingSet, activeSet, z)
   *
   * Gray Paper Eq. 115-118:
   * - pendingSet' = Φ(stagingSet) (from epoch mark, already filtered)
   * - activeSet' = pendingSet (current pending becomes active)
   * - previousSet' = activeSet (current active becomes previous)
   * - epochRoot' = getRingRoot({k_bs | k ∈ pendingSet'})
   *
   * Gray Paper Eq. 248-257: epoch mark contains [(k_bs, k_ed) | k ∈ pendingSet']
   * The epoch mark's pendingSet' is already Φ(stagingSet), so we use it directly.
   */
  private async handleEpochTransition(
    event: EpochTransitionEvent,
  ): SafePromise<void> {
    if (!event.epochMark) {
      return safeError(new Error('Epoch mark is not present'))
    }

    // Save current sets before rotation (Gray Paper Eq. 115-117)
    const oldActiveSet = [...this.activeSet]
    const oldPendingSet = [...this.pendingSet]
    const oldStagingSet = [...this.stagingSet] // Save staging set to preserve BLS and metadata
    const oldPreviousSet = [...this.previousSet]
    const oldEpochRoot = this.epochRoot

    // Save state for potential revert
    this.preTransitionState = {
      activeSet: oldActiveSet,
      pendingSet: oldPendingSet,
      previousSet: oldPreviousSet,
      epochRoot: oldEpochRoot,
    }

    logger.info(
      '[ValidatorSetManager] Epoch transition - rotating validator sets',
      {
        slot: event.slot.toString(),
        oldActiveSetSize: oldActiveSet.length,
        oldPendingSetSize: oldPendingSet.length,
        oldStagingSetSize: oldStagingSet.length,
        epochMarkValidatorsCount: event.epochMark.validators.length,
        oldActiveSetKeys: oldActiveSet.slice(0, 10).map((_, i) => i),
        oldPendingSetKeys: oldPendingSet.slice(0, 10).map((_, i) => i),
      },
    )

    // Extract pendingSet' from epoch mark
    // Gray Paper Eq. 248-257: epoch mark contains [(k_vk_bs, k_vk_ed)] | k ∈ pendingset'
    // The epoch mark's pendingSet' is already Φ(stagingSet)
    // ValidatorKeyPair from epoch mark needs to be converted to ValidatorPublicKeys
    // Note: Epoch mark only contains bandersnatch and ed25519 keys, not bls or metadata
    // We need to look up validators from the old staging set to preserve BLS and metadata
    const pendingSetPrime: ValidatorPublicKeys[] =
      event.epochMark.validators.map((v) => {
        // Try to find the validator in the old staging set by bandersnatch or ed25519 key
        // This preserves BLS and metadata for non-null validators
        let foundValidator: ValidatorPublicKeys | undefined
        for (const validator of oldStagingSet) {
          if (
            validator.bandersnatch === v.bandersnatch ||
            validator.ed25519 === v.ed25519
          ) {
            foundValidator = validator
            break
          }
        }

        // If found, use the full validator info; otherwise use null keys for BLS and metadata
        if (foundValidator) {
          return {
            bandersnatch: v.bandersnatch,
            ed25519: v.ed25519,
            bls: foundValidator.bls,
            metadata: foundValidator.metadata,
          }
        }

        // Validator not found in staging set
        // Use zero hash for BLS and metadata
        return {
          bandersnatch: v.bandersnatch,
          ed25519: v.ed25519,
          bls: `0x${'00'.repeat(144)}` as Hex,
          metadata: `0x${'00'.repeat(128)}` as Hex,
        }
      })

    // Rotate validator sets according to Gray Paper equations (115-117)
    // previousSet' = activeSet (current active becomes previous)
    this.previousSet = oldActiveSet

    // activeSet' = pendingSet (current pending becomes active)
    // Arrays preserve order naturally, so we can use the array directly
    this.activeSet = oldPendingSet
    // Update publicKeysToValidatorIndex map with new indices
    this.updatePublicKeysToValidatorIndex(this.activeSet)

    // pendingSet' = Φ(stagingSet) (from epoch mark, already filtered)
    this.pendingSet = pendingSetPrime
    // Update publicKeysToValidatorIndex map with new pending set
    this.updatePublicKeysToValidatorIndex(this.pendingSet)

    // Staging set persists across epoch transitions
    // Validators are added to staging set via accumulation outputs (designate host function)
    // The staging set will be used to create the next pendingSet' on the next epoch transition
    // We do NOT clear it to null validators - it should be populated from accumulation outputs
    // If no validators have been added via accumulation, it will remain as it was

    // Store offender ed25519 keys before clearing (needed for epoch root computation)
    // Gray Paper: Offender keys are replaced with padding point during ring commitment computation
    this.offenderEd25519Keys = new Set<Hex>()
    for (const offenderIndex of this.offenders) {
      // Find the offender's ed25519 key from the old active set (before rotation)
      if (offenderIndex >= 0 && offenderIndex < oldActiveSet.length) {
        this.offenderEd25519Keys.add(oldActiveSet[offenderIndex].ed25519)
      }
      // Also check old pending set (in case offender was in pending)
      if (offenderIndex >= 0 && offenderIndex < oldPendingSet.length) {
        this.offenderEd25519Keys.add(oldPendingSet[offenderIndex].ed25519)
      }
    }

    // Clear offenders
    this.offenders.clear()

    // Calculate new epoch root - Gray Paper equation (118)
    // epochRoot' = getRingRoot({k_bs | k ∈ pendingSet'})
    // Invalid keys (zeros) and offender keys are replaced with padding point
    this.epochRoot = await this.getEpochRoot()

    // Emit validator set change event
    // Calculate epoch from slot: epoch = slot / epochDuration
    const newEpoch = event.slot / BigInt(this.configService.epochDuration)
    // Convert array to Map for the event (for backwards compatibility with event handlers)
    const validatorSetChangeEvent: ValidatorSetChangeEvent = {
      timestamp: Date.now(),
      epoch: newEpoch,
      validators: this.activeSet,
    }
    this.eventBusService.emitValidatorSetChange(validatorSetChangeEvent)

    return safeResult(undefined)
  }

  /**
   * Get current validator set
   */
  getActiveValidators(): ValidatorPublicKeys[] {
    return [...this.activeSet]
  }

  getPendingValidators(): ValidatorPublicKeys[] {
    return [...this.pendingSet]
  }

  getActiveValidatorKeys(): Uint8Array[] {
    return this.activeSet.map((validator) => hexToBytes(validator.bandersnatch))
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
  getAllConnectedValidators(): ValidatorPublicKeys[] {
    const allValidators: ValidatorPublicKeys[] = []
    const seenKeys = new Set<Hex>()

    // Add active validators
    for (const validator of this.activeSet) {
      if (!seenKeys.has(validator.ed25519)) {
        allValidators.push(validator)
        seenKeys.add(validator.ed25519)
      }
    }

    // Add previous validators
    for (const validator of this.previousSet) {
      if (!seenKeys.has(validator.ed25519)) {
        allValidators.push(validator)
        seenKeys.add(validator.ed25519)
      }
    }

    // Add pending validators
    for (const validator of this.pendingSet) {
      if (!seenKeys.has(validator.ed25519)) {
        allValidators.push(validator)
        seenKeys.add(validator.ed25519)
      }
    }

    return allValidators
  }

  /**
   * Get staging validator set (validators to be drawn from next)
   */
  getStagingValidators(): ValidatorPublicKeys[] {
    return [...this.stagingSet]
  }

  setStagingSet(validatorSet: ValidatorPublicKeys[]): void {
    this.stagingSet = [...validatorSet]

    // Populate publicKeysToValidatorIndex map for offender lookups
    this.updatePublicKeysToValidatorIndex(this.stagingSet)
  }

  setPendingSet(validatorSet: ValidatorPublicKeys[]): void {
    this.pendingSet = [...validatorSet]
    // Populate publicKeysToValidatorIndex map for offender lookups
    this.updatePublicKeysToValidatorIndex(this.pendingSet)
  }

  setActiveSet(validatorSet: ValidatorPublicKeys[]): void {
    this.activeSet = [...validatorSet]
    // Populate publicKeysToValidatorIndex map for offender lookups
    this.updatePublicKeysToValidatorIndex(this.activeSet)
  }

  setPreviousSet(validatorSet: ValidatorPublicKeys[]): void {
    this.previousSet = [...validatorSet]
    // Populate publicKeysToValidatorIndex for previous validators
    // Only add entries that don't already exist (prioritize active set)
    // This ensures offenders are mapped to the correct index from the active set
    for (let index = 0; index < this.previousSet.length; index++) {
      const validator = this.previousSet[index]
      if (!this.publicKeysToValidatorIndex.has(validator.ed25519)) {
        this.publicKeysToValidatorIndex.set(validator.ed25519, index)
      }
    }
  }

  getPreviousValidators(): ValidatorPublicKeys[] {
    return [...this.previousSet]
  }

  /**
   * Update the publicKeysToValidatorIndex map from a validator set
   * This is needed for offender lookups by Ed25519 public key
   */
  private updatePublicKeysToValidatorIndex(
    validators: ValidatorPublicKeys[],
  ): void {
    for (let index = 0; index < validators.length; index++) {
      const validator = validators[index]
      this.publicKeysToValidatorIndex.set(validator.ed25519, index)
    }
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
   * Check if a validator index is in the offenders set
   */
  isOffender(validatorIndex: number): boolean {
    return this.offenders.has(validatorIndex)
  }

  /**
   * Check if validator set change is pending
   * Returns true if there are validators in staging set or offenders
   */
  isValidatorSetChangePending(): boolean {
    return this.stagingSet.length > 0 || this.offenders.size > 0
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
  isValidatorElectedForSlot(publicKey: Hex, slotIndex: bigint): Safe<boolean> {
    if (!this.sealKeyService) {
      return safeError(new Error('Seal key service not found'))
    }
    const validatorIndex = this.publicKeysToValidatorIndex.get(publicKey)
    if (!validatorIndex) {
      return safeError(
        new Error('Validator not found in public keys to validator index map'),
      )
    }
    // First check if the validator exists in the active set
    if (validatorIndex < 0 || validatorIndex >= this.activeSet.length) {
      return safeError(new Error('Validator not in active set'))
    }

    // Get the seal key for this slot from the seal key service
    const [sealKeyError, sealKey] =
      this.sealKeyService.getSealKeyForSlot(slotIndex)
    if (sealKeyError) {
      return safeError(new Error('No seal key found for slot'))
    }

    if (!sealKey) {
      return safeError(new Error('No seal key found for slot'))
    }

    if (isSafroleTicket(sealKey)) {
      if (!this.ticketService) {
        return safeError(new Error('Ticket service not found'))
      }
      const [ticketHolderError, ticketHolderPublicKey] =
        this.ticketService.getTicketHolder(sealKey)
      if (ticketHolderError) {
        return safeError(new Error('No ticket holder found for seal key'))
      }
      if (!ticketHolderPublicKey) {
        return safeError(new Error('No ticket holder found for seal key'))
      }
      return safeResult(ticketHolderPublicKey === publicKey)
    } else {
      // fallback -> check public key match
      return safeResult(bytesToHex(sealKey as Uint8Array) === publicKey)
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
  getEpochRoot(): Hex {
    // Calculate ring root from public keys only (Gray Paper compliant)
    // No private key needed - this is deterministic
    // Extract keys in order (arrays preserve order)
    // Convert to array of Bandersnatch keys for ring root computation
    // Gray Paper bandersnatch.tex line 20: Invalid keys (zeros or offenders) are replaced with padding point
    // The bandersnatch-vrf library will automatically replace zero keys with padding point
    // So we just need to set offender and invalid keys to all zeros here
    const zeroKeyBytes = hexToBytes(zeroHash)

    const bandersnatchKeys = this.pendingSet.map((validator) => {
      const bandersnatchKey = hexToBytes(validator.bandersnatch)

      // Check if key is invalid (all zeros) - keep as zero, library will replace with padding
      const isInvalidKey = bandersnatchKey.every((byte) => byte === 0)
      if (isInvalidKey) {
        return zeroKeyBytes
      }

      // Check if validator is an offender - set to zero, library will replace with padding
      // Gray Paper: Offender keys are replaced with padding point during ring commitment computation
      if (this.offenderEd25519Keys.has(validator.ed25519)) {
        logger.debug(
          '[ValidatorSetManager] Setting offender key to zero (will be replaced with padding point)',
          { ed25519: validator.ed25519 },
        )
        return zeroKeyBytes
      }

      return bandersnatchKey
    })

    // If pending set is empty, return a zero-padded 144-byte epoch root
    // Gray Paper: epochRoot must be 144 bytes (ringroot ⊂ blob[144])
    if (bandersnatchKeys.length === 0) {
      logger.warn(
        'Pending set is empty, returning zero-padded 144-byte epoch root',
      )
      // Return 144 bytes of zeros (288 hex chars)
      return `0x${'00'.repeat(144)}` as Hex
    }

    const [epochRootError, epochRoot] = getRingRoot(
      bandersnatchKeys,
      this.ringProver,
    )
    if (epochRootError) {
      logger.error('Failed to get epoch root', { error: epochRootError })
      // Return zero-padded 144-byte epoch root instead of 32-byte zeroHash
      // Gray Paper: epochRoot must be 144 bytes
      return `0x${'00'.repeat(144)}` as Hex
    }

    const epochRootHex = bytesToHex(epochRoot)

    // Verify epoch root is 144 bytes (safety check)
    if (hexToBytes(epochRootHex).length !== 144) {
      logger.error(
        `Epoch root is not 144 bytes: got ${hexToBytes(epochRootHex).length} bytes`,
      )
      return `0x${'00'.repeat(144)}` as Hex
    }

    return epochRootHex
  }

  setEpochRoot(epochRoot: Hex): void {
    // Validate epoch root is 144 bytes (Gray Paper: ringroot ⊂ blob[144])
    const epochRootBytes = hexToBytes(epochRoot)
    if (epochRootBytes.length !== 144) {
      logger.error(
        `setEpochRoot: Epoch root must be 144 bytes, got ${epochRootBytes.length} bytes`,
      )
      throw new Error(
        `Epoch root must be 144 bytes, got ${epochRootBytes.length} bytes`,
      )
    }
    this.epochRoot = epochRoot
  }

  /**
   * Get stored epoch root without recomputing
   * This preserves the exact value from test vectors
   */
  getStoredEpochRoot(): Hex {
    return this.epochRoot
  }

  /**
   * Get validator key by index
   *
   * IMPORTANT: For fallback key sequence generation, this must return validators
   * from the active set by their position (0-indexed), not by Map key.
   * Gray Paper: cyclic{k[index]}_bs requires sequential indexing starting from 0.
   */
  getValidatorAtIndex(validatorIndex: number): Safe<ValidatorPublicKeys> {
    // For fallback key sequence, we need validators from active set by position
    if (validatorIndex < 0 || validatorIndex >= this.activeSet.length) {
      return safeError(
        new Error(
          `Validator index ${validatorIndex} out of bounds (active set size: ${this.activeSet.length})`,
        ),
      )
    }
    return safeResult(this.activeSet[validatorIndex])
  }

  getValidatorByEd25519PublicKey(
    ed25519PublicKey: Hex,
  ): Safe<ValidatorPublicKeys> {
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
   * Create a null validator key (all zeros)
   * Gray Paper equation (122-123): null keys replace blacklisted validators
   * Gray Paper: vk_bls ∈ blskey ≡ vk[64:144] - BLS key must be 144 bytes
   */
  private createNullValidator(): ValidatorPublicKeys {
    return {
      bandersnatch: zeroHash, // 32 bytes
      ed25519: zeroHash, // 32 bytes
      bls: `0x${'00'.repeat(144)}` as Hex, // 144 bytes (not 32!)
      metadata: `0x${'00'.repeat(128)}` as Hex, // 128 bytes
    }
  }

  /**
   * Create a set of null validators of the specified length
   * Used to pad validator sets to Cvalcount
   *
   * Gray Paper: null keys replace blacklisted validators (equation 122-123)
   * Each validator key is 336 bytes with all fields zeroed
   */
  public createNullValidatorSet(count: number): ValidatorPublicKeys[] {
    return Array.from({ length: count }, () => this.createNullValidator())
  }

  /**
   * Pad validator set to exactly Cvalcount elements with null keys
   * Gray Paper: Validator sets must have fixed length Cvalcount
   */
  private padValidatorSet(
    validators: ValidatorPublicKeys[],
    targetCount: number,
  ): ValidatorPublicKeys[] {
    if (validators.length >= targetCount) {
      return validators.slice(0, targetCount)
    }
    const padded = [...validators]
    const nullValidators = this.createNullValidatorSet(
      targetCount - validators.length,
    )
    padded.push(...nullValidators)
    return padded
  }

  /**
   * Check if a validator is in the current active set
   * Implements Gray Paper activeSet lookup
   */
  isValidatorActive(validatorIndex: number): boolean {
    return validatorIndex >= 0 && validatorIndex < this.activeSet.length
  }

  /**
   * Check if a validator is in the previous set
   * Implements Gray Paper previousSet lookup
   */
  isValidatorPrevious(validatorIndex: number): boolean {
    return validatorIndex >= 0 && validatorIndex < this.previousSet.length
  }

  /**
   * Check if a validator is in the pending set
   * Implements Gray Paper pendingSet lookup
   */
  isValidatorPending(validatorIndex: number): boolean {
    return validatorIndex >= 0 && validatorIndex < this.pendingSet.length
  }

  /**
   * Get validator count for current active set
   * Implements Gray Paper |activeSet|
   */
  getActiveValidatorCount(): number {
    return this.activeSet.length
  }

  /**
   * Get validator count for pending set
   * Implements Gray Paper |pendingSet|
   */
  getPendingValidatorCount(): number {
    return this.pendingSet.length
  }

  /**
   * Get validator count for previous set
   * Implements Gray Paper |previousSet|
   */
  getPreviousValidatorCount(): number {
    return this.previousSet.length
  }

  /**
   * Get validator count for staging set
   * Implements Gray Paper |stagingSet|
   */
  getStagingValidatorCount(): number {
    return this.stagingSet.length
  }

  /**
   * Get all neighbor validator indexes from the active set
   * Implements JAMNP-S grid structure neighbor algorithm
   *
   * JAMNP-S Specification:
   * - Grid size W = floor(sqrt(V)) where V is number of validators
   * - Two validators are neighbors if they share the same row OR column
   * - Row = index / W, Column = index % W
   *
   * @param validatorIndex - The validator index to find neighbors for
   * @returns Array of neighbor validator indexes from the active set
   */
  getActiveSetNeighbors(validatorIndex: number): number[] {
    const neighbors: number[] = []
    const totalValidators = this.configService.numValidators
    const W = Math.floor(Math.sqrt(totalValidators)) // Grid width

    // Calculate grid coordinates for the given validator
    const row = Math.floor(validatorIndex / W)
    const col = validatorIndex % W

    logger.debug('Calculating neighbors for validator', {
      validatorIndex,
      totalValidators,
      gridWidth: W,
      row,
      col,
    })

    // Find all neighbors in the active set
    for (let index = 0; index < this.activeSet.length; index++) {
      // Skip self
      if (index === validatorIndex) {
        continue
      }

      // Calculate grid coordinates for this validator
      const neighborRow = Math.floor(index / W)
      const neighborCol = index % W

      // Check if they are neighbors (same row OR same column)
      const isRowNeighbor = neighborRow === row
      const isColNeighbor = neighborCol === col

      if (isRowNeighbor || isColNeighbor) {
        neighbors.push(index)
      }
    }

    return neighbors.sort((a, b) => a - b) // Return sorted array
  }

  /**
   * Get all neighbor validator indexes across all connected validator sets
   * (active, previous, pending) based on JAMNP-S grid structure
   *
   * @param validatorIndex - The validator index to find neighbors for
   * @returns Array of neighbor validator indexes from all connected sets
   */
  getAllConnectedNeighbors(
    validatorIndex: number,
  ): { index: number; publicKey: Hex }[] {
    const neighbors: { index: number; publicKey: Hex }[] = []
    const totalValidators = this.configService.numValidators
    const W = Math.floor(Math.sqrt(totalValidators)) // Grid width

    // Calculate grid coordinates for the given validator
    const row = Math.floor(validatorIndex / W)
    const col = validatorIndex % W

    // Get all connected validators (active + previous + pending)
    const allConnectedValidators = this.getAllConnectedValidators()

    // Find all neighbors across all connected sets
    for (let index = 0; index < allConnectedValidators.length; index++) {
      const validator = allConnectedValidators[index]
      // Skip self
      if (index === validatorIndex) {
        continue
      }

      // Calculate grid coordinates for this validator
      const neighborRow = Math.floor(index / W)
      const neighborCol = index % W

      // Check if they are neighbors (same row OR same column)
      const isRowNeighbor = neighborRow === row
      const isColNeighbor = neighborCol === col

      if (isRowNeighbor || isColNeighbor) {
        neighbors.push({ index, publicKey: validator.ed25519 })
      }
    }

    logger.info('Found all connected neighbors', {
      validatorIndex,
      neighborCount: neighbors.length,
      neighbors: neighbors.sort((a, b) => a.index - b.index),
    })

    return neighbors.sort((a, b) => a.index - b.index) // Return sorted array
  }

  getConnectionEndpointFromMetadata(
    validatorIndex: number,
  ): Safe<ConnectionEndpoint> {
    const allValidators = this.getAllConnectedValidators()
    if (validatorIndex < 0 || validatorIndex >= allValidators.length) {
      return safeError(
        new Error(`Validator not found for index ${validatorIndex}`),
      )
    }
    const validator = allValidators[validatorIndex]
    // first 16 bytes of metadata are the ipv6 address
    // last 2 bytes of metadata are the port
    const ipv6Address = validator.metadata.slice(0, 16)
    const port = validator.metadata.slice(16, 18)
    return safeResult({
      host: ipv6Address.toString(),
      port: Number.parseInt(port.toString()),
      publicKey: hexToBytes(validator.ed25519),
    })
  }
}
