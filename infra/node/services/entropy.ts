import {
  extractSealOutput,
  generateEntropyVRFSignature,
} from '@pbnj/bandersnatch-vrf'
import {
  blake2bHash,
  bytesToHex,
  type EventBusService,
  hexToBytes,
  logger,
  type Safe,
  safeError,
  safeResult,
} from '@pbnj/core'
import type { EpochTransitionEvent, SlotChangeEvent } from '@pbnj/events'
import { BaseService, type BlockHeader } from '@pbnj/types'

/**
 * EntropyService - Manages Gray Paper entropy tracking
 *
 * Tracks entropyaccumulator and historical entropy values (entropy_1, entropy_2, entropy_3)
 * Updates per block and rotates on epoch transitions
 */
export class EntropyService extends BaseService {
  private entropyAccumulator: Uint8Array = new Uint8Array(32).fill(0)
  private entropy1: Uint8Array = new Uint8Array(32).fill(0) // Most recent epoch
  private entropy2: Uint8Array = new Uint8Array(32).fill(0) // Used for validator operations
  private entropy3: Uint8Array = new Uint8Array(32).fill(0) // Used for seal verification

  // Event handlers
  private eventBusService: EventBusService

  constructor(eventBusService: EventBusService) {
    super('entropy-service')
    this.eventBusService = eventBusService
    this.eventBusService.onSlotChange(this.handleSlotChange)
    this.eventBusService.onEpochTransition(this.handleEpochTransition)
    this.eventBusService.onBestBlockChanged(this.handleBestBlockChanged)
    this.eventBusService.onFinalizedBlockChanged(
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
  private handleSlotChange(event: SlotChangeEvent): Safe<void> {
    try {
      // TODO: This handler should ideally not update entropy directly
      // Entropy should be updated via handleBestBlockChanged with actual block headers
      // For now, we'll skip entropy updates on slot changes without block headers

      logger.debug(
        'Slot change received, but entropy updates require block headers',
        {
          slot: event.slot,
          epoch: event.epoch,
        },
      )

      return safeResult(undefined)
    } catch (error) {
      logger.error('Failed to handle slot change in entropy service', { error })
      return safeError(error as Error)
    }
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
        entropy1Length: this.entropy1.length,
        entropy2Length: this.entropy2.length,
        entropy3Length: this.entropy3.length,
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
    try {
      // Extract VRF output directly from the block header
      const vrfOutput = blockHeader.vrfSig
      this.updateEntropyAccumulator(hexToBytes(vrfOutput))

      logger.debug('Entropy accumulator updated on best block change', {
        slot: blockHeader.timeslot,
        authorIndex: blockHeader.authorIndex,
        vrfSig: blockHeader.vrfSig,
        entropyAccumulator: bytesToHex(this.entropyAccumulator),
      })

      return safeResult(undefined)
    } catch (error) {
      logger.error('Failed to handle best block change in entropy service', {
        error,
      })
      return safeError(error as Error)
    }
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
  private updateEntropyAccumulator(vrfOutput: Uint8Array): void {
    const combined = new Uint8Array(
      this.entropyAccumulator.length + vrfOutput.length,
    )
    combined.set(this.entropyAccumulator, 0)
    combined.set(vrfOutput, this.entropyAccumulator.length)

    const [hashError, hashData] = blake2bHash(combined)
    if (hashError) {
      logger.error('Failed to hash entropy accumulator', { error: hashError })
    } else {
      this.entropyAccumulator = hexToBytes(hashData)
    }
  }

  /**
   * Rotate entropy history on epoch transition
   * Gray Paper: (entropy'_1, entropy'_2, entropy'_3) = (entropy_0, entropy_1, entropy_2)
   */
  private rotateEntropyHistory(): void {
    // Store current accumulator as entropy_0 before rotation
    const entropy0 = new Uint8Array(this.entropyAccumulator)

    // Rotate: entropy_3 = entropy_2, entropy_2 = entropy_1, entropy_1 = entropy_0
    this.entropy3 = new Uint8Array(this.entropy2)
    this.entropy2 = new Uint8Array(this.entropy1)
    this.entropy1 = entropy0
  }

  /**
   * Get entropy_2 for validator operations (Gray Paper compliant)
   * Used for: validator set operations, core assignments, fallback seal generation
   */
  getEntropy2(): Uint8Array {
    return new Uint8Array(this.entropy2)
  }

  /**
   * Get entropy_3 for seal verification (Gray Paper compliant)
   * Used for: seal verification, ticket condition checks
   */
  getEntropy3(): Uint8Array {
    return new Uint8Array(this.entropy3)
  }

  /**
   * Get current entropy accumulator
   */
  getEntropyAccumulator(): Uint8Array {
    return new Uint8Array(this.entropyAccumulator)
  }

  /**
   * Get entropy_1 (most recent epoch entropy)
   */
  getEntropy1(): Uint8Array {
    return new Uint8Array(this.entropy1)
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
    const [extractError, sealOutput] = extractSealOutput(sealSignature)
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
