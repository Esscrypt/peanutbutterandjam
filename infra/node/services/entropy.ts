import { banderout, generateEntropyVRFSignature } from '@pbnj/bandersnatch-vrf'
import {
  type BlockProcessedEvent,
  blake2bHash,
  type EventBusService,
  hexToBytes,
  logger,
  type Safe,
  safeError,
  safeResult,
  zeroHash,
} from '@pbnj/core'
import type { EpochTransitionEvent } from '@pbnj/events'
import { BaseService, type BlockHeader, type EntropyState } from '@pbnj/types'

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

  constructor(eventBusService: EventBusService) {
    super('entropy-service')
    this.eventBusService = eventBusService
    this.eventBusService.addBlockProcessedCallback(this.handleBlockProcessing)
    this.eventBusService.addEpochTransitionCallback(this.handleEpochTransition)
    this.eventBusService.addBestBlockChangedCallback(
      this.handleBestBlockChanged,
    )
    this.eventBusService.addFinalizedBlockChangedCallback(
      this.handleFinalizedBlockChanged,
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
    try {
      this.rotateEntropyHistory()
      logger.info('Entropy history rotated on epoch transition', {
        newEpoch: event.newEpoch,
        entropy1Length: this.entropy.entropy1,
        entropy2Length: this.entropy.entropy2.length,
        entropy3Length: this.entropy.entropy3.length,
      })
      return safeResult(undefined)
    } catch (error) {
      logger.error('Failed to handle epoch transition in entropy service', {
        error,
      })
      return safeError(error as Error)
    }
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
   * Handle finalized block changes (secondary processing)
   * Finalization doesn't directly update entropy, but may trigger additional processing
   */
  private handleFinalizedBlockChanged(blockHeader: BlockHeader): Safe<void> {
    try {
      logger.debug('Finalized block changed', {
        slot: blockHeader.timeslot,
        authorIndex: blockHeader.authorIndex,
        parent: blockHeader.parent,
      })

      // TODO: Additional processing for finalized blocks if needed
      // For now, entropy is updated on best block changes, not finalization

      return safeResult(undefined)
    } catch (error) {
      logger.error(
        'Failed to handle finalized block change in entropy service',
        { error },
      )
      return safeError(error as Error)
    }
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

    const combined = new Uint8Array(
      this.entropy.accumulator.length + banderoutResult.length,
    )

    combined.set(hexToBytes(this.entropy.accumulator), 0)
    combined.set(banderoutResult, 32) // 32 bytes of vrfOutput is already in banderoutResult

    const [hashError, hashData] = blake2bHash(combined)
    if (hashError) {
      return safeError(hashError)
    } else {
      this.entropy.accumulator = hashData
    }

    return safeResult(hexToBytes(hashData))
  }

  /**
   * Rotate entropy history on epoch transition
   * Gray Paper: (entropy'_1, entropy'_2, entropy'_3) = (entropy_0, entropy_1, entropy_2)
   */
  private rotateEntropyHistory(): void {
    // Rotate: entropy_3 = entropy_2, entropy_2 = entropy_1, entropy_1 = entropy_0
    this.entropy.entropy3 = this.entropy.entropy2
    this.entropy.entropy2 = this.entropy.entropy1
    this.entropy.entropy1 = this.entropy.accumulator
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
