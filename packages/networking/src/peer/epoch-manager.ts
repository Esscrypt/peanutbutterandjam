/**
 * Epoch Transition Manager for JAM Protocol
 *
 * Handles epoch transitions according to Gray Paper specifications
 * Manages validator set changes and connectivity updates
 */

import { logger } from '@pbnj/core'
import type { EpochIndex, ValidatorIndex, ValidatorMetadata } from '@pbnj/types'
import type { GridStructureManager } from './grid-structure'
import type { ValidatorSetManager } from './validator-set'

/**
 * Epoch transition configuration
 */
export interface EpochTransitionConfig {
  /** Number of slots in an epoch */
  slotsPerEpoch: number
  /** Minimum slots to wait before applying connectivity changes */
  minSlotsBeforeChange: number
  /** Connection timeout in milliseconds */
  connectionTimeout: number
}

/**
 * Epoch state information
 */
export interface EpochState {
  /** Current epoch index */
  currentEpoch: EpochIndex
  /** Current slot within epoch */
  currentSlot: number
  /** Whether first block of epoch has been finalized */
  firstBlockFinalized: boolean
  /** Slot when epoch started */
  epochStartSlot: number
  /** Whether connectivity changes have been applied */
  connectivityApplied: boolean
}

/**
 * Manages epoch transitions and validator connectivity changes
 */
export class EpochManager {
  private config: EpochTransitionConfig
  private epochState: EpochState
  private gridStructureManager: GridStructureManager
  private validatorSetManager: ValidatorSetManager
  private pendingConnectivityChanges: Map<ValidatorIndex, ValidatorMetadata> =
    new Map()

  constructor(
    config: EpochTransitionConfig,
    gridStructureManager: GridStructureManager,
    validatorSetManager: ValidatorSetManager,
  ) {
    this.config = config
    this.gridStructureManager = gridStructureManager
    this.validatorSetManager = validatorSetManager

    this.epochState = {
      currentEpoch: 0,
      currentSlot: 0,
      firstBlockFinalized: false,
      epochStartSlot: 0,
      connectivityApplied: false,
    }
  }

  /**
   * Update current slot and handle epoch transitions
   */
  updateSlot(slot: number): void {
    this.epochState.currentSlot = slot

    // Check if we've entered a new epoch
    const newEpoch = Math.floor(slot / this.config.slotsPerEpoch)
    if (newEpoch !== this.epochState.currentEpoch) {
      this.handleEpochTransition(newEpoch, slot)
    }

    // Check if we should apply pending connectivity changes
    this.checkConnectivityChanges(slot)
  }

  /**
   * Handle transition to a new epoch
   */
  private handleEpochTransition(newEpoch: EpochIndex, slot: number): void {
    logger.info('Epoch transition detected', {
      previousEpoch: this.epochState.currentEpoch,
      newEpoch,
      slot,
    })

    this.epochState.currentEpoch = newEpoch
    this.epochState.epochStartSlot = slot
    this.epochState.firstBlockFinalized = false
    this.epochState.connectivityApplied = false

    // Prepare validator set changes for the new epoch
    this.prepareValidatorSetChanges(newEpoch)
  }

  /**
   * Prepare validator set changes for new epoch
   */
  private prepareValidatorSetChanges(epoch: EpochIndex): void {
    try {
      // Get the next validator set (which becomes current in new epoch)
      const newValidators = this.validatorSetManager.getNextValidators()

      // Store as pending changes
      this.pendingConnectivityChanges.clear()
      newValidators.forEach(
        (metadata: ValidatorMetadata, index: ValidatorIndex) => {
          this.pendingConnectivityChanges.set(index, metadata)
        },
      )

      logger.info('Prepared validator set changes for epoch', {
        epoch,
        validatorCount: newValidators.size,
      })
    } catch (error) {
      logger.error('Failed to prepare validator set changes', { epoch, error })
    }
  }

  /**
   * Check if connectivity changes should be applied
   * According to Gray Paper: wait until both conditions are met:
   * 1. First block in epoch has been finalized
   * 2. At least max(floor(E / 30), 1) slots have elapsed
   */
  private checkConnectivityChanges(slot: number): void {
    if (this.epochState.connectivityApplied) {
      return
    }

    // Check condition 1: First block finalized
    if (!this.epochState.firstBlockFinalized) {
      return
    }

    // Check condition 2: Minimum slots elapsed
    const slotsElapsed = slot - this.epochState.epochStartSlot
    const minSlots = Math.max(Math.floor(this.config.slotsPerEpoch / 30), 1)

    if (slotsElapsed < minSlots) {
      return
    }

    // Apply connectivity changes
    this.applyConnectivityChanges()
  }

  /**
   * Apply pending connectivity changes
   */
  private applyConnectivityChanges(): void {
    if (this.pendingConnectivityChanges.size === 0) {
      return
    }

    try {
      logger.info('Applying epoch connectivity changes', {
        epoch: this.epochState.currentEpoch,
        validatorCount: this.pendingConnectivityChanges.size,
      })

      // Update validator set
      this.validatorSetManager.updateCurrentValidators(
        this.pendingConnectivityChanges,
      )

      // Update grid structure
      this.gridStructureManager.computeGridStructure(
        this.pendingConnectivityChanges,
      )

      // Mark as applied
      this.epochState.connectivityApplied = true
      this.pendingConnectivityChanges.clear()

      logger.info('Epoch connectivity changes applied successfully')
    } catch (error) {
      logger.error('Failed to apply connectivity changes', { error })
    }
  }

  /**
   * Notify that the first block of the current epoch has been finalized
   */
  notifyFirstBlockFinalized(): void {
    if (!this.epochState.firstBlockFinalized) {
      this.epochState.firstBlockFinalized = true
      logger.info('First block of epoch finalized', {
        epoch: this.epochState.currentEpoch,
      })

      // Check if we can now apply connectivity changes
      this.checkConnectivityChanges(this.epochState.currentSlot)
    }
  }

  /**
   * Get current epoch state
   */
  getEpochState(): EpochState {
    return { ...this.epochState }
  }

  /**
   * Check if we're in the transition period for an epoch
   */
  isInTransitionPeriod(): boolean {
    const slotsElapsed =
      this.epochState.currentSlot - this.epochState.epochStartSlot
    const minSlots = Math.max(Math.floor(this.config.slotsPerEpoch / 30), 1)

    return slotsElapsed < minSlots || !this.epochState.firstBlockFinalized
  }

  /**
   * Get validators that should be connected during transition
   * During transition, maintain old connections until new ones are established
   */
  getTransitionValidators(): Map<ValidatorIndex, ValidatorMetadata> {
    if (this.epochState.connectivityApplied || this.isInTransitionPeriod()) {
      // Return current validators during transition
      return this.validatorSetManager.getCurrentValidators()
    }

    // Return pending validators if transition is complete
    return this.pendingConnectivityChanges
  }

  /**
   * Calculate when safrole ticket distribution should start
   * Should be max(floor(E / 60), 1) slots after connectivity changes
   */
  getSafroleTicketDistributionSlot(): number {
    if (!this.epochState.connectivityApplied) {
      return -1 // Not yet ready
    }

    const connectivitySlot =
      this.epochState.epochStartSlot +
      Math.max(Math.floor(this.config.slotsPerEpoch / 30), 1)

    const ticketDistributionDelay = Math.max(
      Math.floor(this.config.slotsPerEpoch / 60),
      1,
    )

    return connectivitySlot + ticketDistributionDelay
  }

  /**
   * Calculate when ticket forwarding should start
   * Should be max(floor(E / 20), 1) slots after connectivity changes
   */
  getTicketForwardingSlot(): number {
    if (!this.epochState.connectivityApplied) {
      return -1 // Not yet ready
    }

    const connectivitySlot =
      this.epochState.epochStartSlot +
      Math.max(Math.floor(this.config.slotsPerEpoch / 30), 1)

    const forwardingDelay = Math.max(
      Math.floor(this.config.slotsPerEpoch / 20),
      1,
    )

    return connectivitySlot + forwardingDelay
  }
}
