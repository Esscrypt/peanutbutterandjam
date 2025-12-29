import {
  banderout,
  generateEntropyVRFSignature,
} from '@pbnjam/bandersnatch-vrf'
import {
  type BlockProcessedEvent,
  blake2bHash,
  type EpochTransitionEvent,
  type EventBusService,
  hexToBytes,
  logger,
  type RevertEpochTransitionEvent,
  zeroHash,
} from '@pbnjam/core'
import {
  BaseService,
  type BlockHeader,
  type EntropyState,
  type EpochMark,
  type Safe,
  safeError,
  safeResult,
} from '@pbnjam/types'

/**
 * EntropyService - Manages Gray Paper entropy tracking
 *
 * Tracks entropyaccumulator and historical entropy values (entropy_1, entropy_2, entropy_3)
 * Updates per block and rotates on epoch transitions
 */
export class EntropyService extends BaseService {
  private entropy: EntropyState = {
    accumulator: zeroHash,
    entropy1: zeroHash,
    entropy2: zeroHash,
    entropy3: zeroHash,
  }
  // Event handlers
  private eventBusService: EventBusService
  // Store state before epoch transition for revert
  private preTransitionEntropy: EntropyState | null = null

  constructor(eventBusService: EventBusService) {
    super('entropy-service')
    this.eventBusService = eventBusService
    this.eventBusService.addBlockProcessedCallback(
      this.handleBlockProcessing.bind(this),
    )
    this.eventBusService.addEpochTransitionCallback(
      this.handleEpochTransition.bind(this),
    )
    this.eventBusService.addRevertEpochTransitionCallback(
      this.handleRevertEpochTransition.bind(this),
    )
    this.eventBusService.addBestBlockChangedCallback(
      this.handleBestBlockChanged.bind(this),
    )
  }

  /**
   * Update entropy accumulator with VRF output from each block
   * Gray Paper: entropyaccumulator' = blake(entropyaccumulator || banderout(H_vrfsig))
   *
   * Note: This is a fallback handler for slot changes. The primary entropy updates
   * should happen via handleBestBlockChanged when actual block headers are available.
   */
  private handleBlockProcessing(event: BlockProcessedEvent): Safe<void> {
    const [updateError] = this.updateEntropyAccumulator(
      hexToBytes(event.header.vrfSig),
    )
    if (updateError) {
      return safeError(updateError)
    }
    return safeResult(undefined)
  }

  /**
   * Rotate entropy values on epoch transition
   * Gray Paper: (entropy'_1, entropy'_2, entropy'_3) = (entropy_0, entropy_1, entropy_2)
   */
  private handleEpochTransition(event: EpochTransitionEvent): Safe<void> {
    // Save state before rotation for potential revert
    this.preTransitionEntropy = { ...this.entropy }
    this.rotateEntropyHistory(event.epochMark)

    return safeResult(undefined)
  }

  /**
   * Handle revert epoch transition event
   * Restores entropy to its state before the epoch transition
   */
  private handleRevertEpochTransition(
    event: RevertEpochTransitionEvent,
  ): Safe<void> {
    if (!this.preTransitionEntropy) {
      logger.warn('[EntropyService] No pre-transition entropy to revert to', {
        slot: event.slot.toString(),
      })
      return safeResult(undefined)
    }

    logger.info('[EntropyService] Reverting epoch transition', {
      slot: event.slot.toString(),
    })

    // Restore previous entropy state
    this.entropy = { ...this.preTransitionEntropy }
    this.preTransitionEntropy = null

    return safeResult(undefined)
  }

  /**
   * Update entropy accumulator when best block changes
   * Gray Paper: entropyaccumulator' = blake(entropyaccumulator || banderout(H_vrfsig))
   * This is the PRIMARY mechanism for entropy updates per Gray Paper Eq. 174
   */
  private handleBestBlockChanged(blockHeader: BlockHeader): Safe<void> {
    const [updateError] = this.updateEntropyAccumulator(
      hexToBytes(blockHeader.vrfSig),
    )
    if (updateError) {
      return safeError(updateError)
    }
    return safeResult(undefined)
  }

  /**
   * Update entropy accumulator with VRF output
   * Gray Paper: entropyaccumulator' = blake(entropyaccumulator || banderout(H_vrfsig))
   */
  private updateEntropyAccumulator(vrfOutput: Uint8Array): Safe<Uint8Array> {
    const [banderoutError, banderoutResult] = banderout(vrfOutput)
    if (banderoutError) {
      return safeError(banderoutError)
    }
    if (!banderoutResult) {
      return safeError(new Error('Banderout result is undefined'))
    }

    // accumulator is Hex string (32 bytes = 64 hex chars + "0x" = 66 chars)
    // banderoutResult is 32 bytes
    const accumulatorBytes = hexToBytes(this.entropy.accumulator)
    const combined = new Uint8Array(
      accumulatorBytes.length + banderoutResult.length,
    )

    combined.set(accumulatorBytes, 0)
    combined.set(banderoutResult, accumulatorBytes.length)

    const [hashError, hashData] = blake2bHash(combined)
    if (hashError) {
      return safeError(hashError)
    }
    if (!hashData) {
      return safeError(new Error('Hash data is undefined'))
    }

    // hashData is already Hex string from blake2bHash
    this.entropy.accumulator = hashData

    // Return as bytes for compatibility with function signature
    return safeResult(hexToBytes(hashData))
  }

  /**
   * Rotate entropy history on epoch transition
   * Gray Paper Eq. 179-181: (entropy'_1, entropy'_2, entropy'_3) = (entropy_0, entropy_1, entropy_2) when e' > e
   *
   * Where:
   * - entropy_0 = accumulator at end of previous epoch (from epoch mark's entropyAccumulator)
   * - entropy_1 = entropy_1 at end of previous epoch (saved before rotation)
   * - entropy_2 = entropy_2 at end of previous epoch (saved before rotation)
   *
   * Note: The epoch mark's entropy1 field contains tickets_entropy, which should equal
   * the old entropy1. We use it as a validation check but rely on the saved old values for rotation.
   */
  rotateEntropyHistory(epochMark: EpochMark | null): void {
    if (epochMark) {
      // Save old values before rotation (these are entropy_1, entropy_2 at end of previous epoch)
      const oldEntropy1 = this.entropy.entropy1
      const oldEntropy2 = this.entropy.entropy2

      // Set accumulator from epoch mark (entropy_0 = accumulator at end of previous epoch)
      this.entropy.accumulator = epochMark.entropyAccumulator

      // Rotate according to Gray Paper: (entropy'_1, entropy'_2, entropy'_3) = (entropy_0, entropy_1, entropy_2)
      this.entropy.entropy1 = this.entropy.accumulator // entropy'_1 = entropy_0
      this.entropy.entropy2 = oldEntropy1 // entropy'_2 = entropy_1 (old entropy1)
      this.entropy.entropy3 = oldEntropy2 // entropy'_3 = entropy_2 (old entropy2)

      // Validation: epoch mark's tickets_entropy should equal old entropy1
      if (epochMark.entropy1 !== oldEntropy1) {
        logger.warn('[EntropyService] tickets_entropy mismatch', {
          ticketsEntropy: epochMark.entropy1,
          oldEntropy1: oldEntropy1,
        })
      }
    } else {
      // No epoch mark: rotate using current accumulator
      // Rotate: entropy_3 = entropy_2, entropy_2 = entropy_1, entropy_1 = entropy_0
      this.entropy.entropy3 = this.entropy.entropy2
      this.entropy.entropy2 = this.entropy.entropy1
      this.entropy.entropy1 = this.entropy.accumulator
    }
  }

  /**
   * Get entropy_2 for validator operations (Gray Paper compliant)
   * Used for: validator set operations, core assignments, fallback seal generation
   */
  getEntropy2(): Uint8Array {
    return hexToBytes(this.entropy.entropy2)
  }

  /**
   * Get entropy_3 for seal verification (Gray Paper compliant)
   * Used for: seal verification, ticket condition checks
   */
  getEntropy3(): Uint8Array {
    return hexToBytes(this.entropy.entropy3)
  }

  /**
   * Get current entropy accumulator
   */
  getEntropyAccumulator(): Uint8Array {
    return hexToBytes(this.entropy.accumulator)
  }

  getEntropy(): EntropyState {
    return this.entropy
  }

  setEntropy(entropy: EntropyState): void {
    this.entropy = entropy
  }

  /**
   * Get entropy_1 (most recent epoch entropy)
   */
  getEntropy1(): Uint8Array {
    return hexToBytes(this.entropy.entropy1)
  }

  /**
   * Generate VRF entropy according to Gray Paper Eq. 158
   * Used by consensus and other services that need VRF entropy
   *
   * Gray Paper: H_vrfsig ∈ bssignature(H_authorbskey, Xentropy ∥ banderout(H_sealsig), [])
   * Where Xentropy = "$jam_entropy"
   *
   * Note: Slot is not used as per Gray Paper specification - VRF signature is deterministic
   * based only on secret key, seal signature output, and hardcoded context.
   */
  generateVRFEntropy(
    secretKey: Uint8Array,
    sealSignature: Uint8Array,
  ): Safe<Uint8Array> {
    // Extract VRF output from seal signature using banderout function
    const [extractError, sealOutput] = banderout(sealSignature)
    if (extractError) {
      return safeError(extractError)
    }

    // Generate VRF signature using dedicated entropy VRF function
    // Gray Paper: H_vrfsig ∈ bssignature(H_authorbskey, Xentropy ∥ banderout(H_sealsig), [])
    const [vrfError, vrfResult] = generateEntropyVRFSignature(
      secretKey,
      sealOutput,
    )
    if (vrfError) {
      return safeError(vrfError)
    }

    // Extract entropy from VRF output using banderout function
    // Gray Paper: banderout(s ∈ bssignature) ∈ hash ≡ output(x ∣ x ∈ bssignature)[:32]
    // Update entropy accumulator with VRF output (Gray Paper compliance)
    this.updateEntropyAccumulator(vrfResult.banderoutResult)

    return safeResult(vrfResult.banderoutResult)
  }
}
