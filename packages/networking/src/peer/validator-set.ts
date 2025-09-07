/**
 * Validator Set Management
 *
 * Manages current, previous, and next epoch validator sets
 * Handles epoch transitions and validator metadata
 */

import type { ConnectionEndpoint, ValidatorMetadata } from '@pbnj/types'

/**
 * Validator set manager
 */
export class ValidatorSetManager {
  private currentEpoch = 0n
  private currentValidators: Map<bigint, ValidatorMetadata> = new Map()
  private previousValidators: Map<bigint, ValidatorMetadata> = new Map()
  private nextValidators: Map<bigint, ValidatorMetadata> = new Map()
  private epochTransitionPending = false

  /**
   * Get current epoch index
   */
  getCurrentEpoch(): bigint {
    return this.currentEpoch
  }

  /**
   * Get current validator set
   */
  getCurrentValidators(): Map<bigint, ValidatorMetadata> {
    return new Map(this.currentValidators)
  }

  /**
   * Get previous validator set
   */
  getPreviousValidators(): Map<bigint, ValidatorMetadata> {
    return new Map(this.previousValidators)
  }

  /**
   * Get next validator set
   */
  getNextValidators(): Map<bigint, ValidatorMetadata> {
    return new Map(this.nextValidators)
  }

  /**
   * Get all validators that should be connected (current + previous + next)
   */
  getAllConnectedValidators(): Map<bigint, ValidatorMetadata> {
    const allValidators = new Map<bigint, ValidatorMetadata>()

    // Add current validators
    for (const [index, metadata] of this.currentValidators) {
      allValidators.set(index, metadata)
    }

    // Add previous validators
    for (const [index, metadata] of this.previousValidators) {
      if (!allValidators.has(index)) {
        allValidators.set(index, metadata)
      }
    }

    // Add next validators
    for (const [index, metadata] of this.nextValidators) {
      if (!allValidators.has(index)) {
        allValidators.set(index, metadata)
      }
    }

    return allValidators
  }

  /**
   * Check if a validator is in the current set
   */
  isCurrentValidator(validatorIndex: bigint): boolean {
    return this.currentValidators.has(validatorIndex)
  }

  /**
   * Check if a validator is in the previous set
   */
  isPreviousValidator(validatorIndex: bigint): boolean {
    return this.previousValidators.has(validatorIndex)
  }

  /**
   * Check if a validator is in the next set
   */
  isNextValidator(validatorIndex: bigint): boolean {
    return this.nextValidators.has(validatorIndex)
  }

  /**
   * Check if a validator should be connected (in any of the three sets)
   */
  shouldConnectToValidator(validatorIndex: bigint): boolean {
    return (
      this.isCurrentValidator(validatorIndex) ||
      this.isPreviousValidator(validatorIndex) ||
      this.isNextValidator(validatorIndex)
    )
  }

  /**
   * Get validator metadata
   */
  getValidatorMetadata(validatorIndex: bigint): ValidatorMetadata | undefined {
    return (
      this.currentValidators.get(validatorIndex) ||
      this.previousValidators.get(validatorIndex) ||
      this.nextValidators.get(validatorIndex)
    )
  }

  /**
   * Update current validator set
   */
  updateCurrentValidators(validators: Map<bigint, ValidatorMetadata>): void {
    this.currentValidators = new Map(validators)
  }

  /**
   * Update previous validator set
   */
  updatePreviousValidators(validators: Map<bigint, ValidatorMetadata>): void {
    this.previousValidators = new Map(validators)
  }

  /**
   * Update next validator set
   */
  updateNextValidators(validators: Map<bigint, ValidatorMetadata>): void {
    this.nextValidators = new Map(validators)
  }

  /**
   * Prepare for epoch transition
   */
  prepareEpochTransition(
    newEpoch: bigint,
    newValidators: Map<bigint, ValidatorMetadata>,
  ): void {
    if (newEpoch <= this.currentEpoch) {
      throw new Error(
        `New epoch ${newEpoch} must be greater than current epoch ${this.currentEpoch}`,
      )
    }

    // Store current validators as previous
    this.previousValidators = new Map(this.currentValidators)

    // Store new validators as next
    this.nextValidators = new Map(newValidators)

    this.epochTransitionPending = true
  }

  /**
   * Apply epoch transition
   */
  applyEpochTransition(): void {
    if (!this.epochTransitionPending) {
      throw new Error('No epoch transition pending')
    }

    // Move next validators to current
    this.currentValidators = new Map(this.nextValidators)

    // Clear next validators
    this.nextValidators.clear()

    // Increment epoch
    this.currentEpoch++

    this.epochTransitionPending = false
  }

  /**
   * Get validators that are leaving (in previous but not in current)
   */
  getLeavingValidators(): bigint[] {
    const leaving: bigint[] = []

    for (const [index] of this.previousValidators) {
      if (!this.currentValidators.has(index)) {
        leaving.push(index)
      }
    }

    return leaving
  }

  /**
   * Get validators that are joining (in current but not in previous)
   */
  getJoiningValidators(): bigint[] {
    const joining: bigint[] = []

    for (const [index] of this.currentValidators) {
      if (!this.previousValidators.has(index)) {
        joining.push(index)
      }
    }

    return joining
  }

  /**
   * Get validators that are staying (in both previous and current)
   */
  getStayingValidators(): bigint[] {
    const staying: bigint[] = []

    for (const [index] of this.currentValidators) {
      if (this.previousValidators.has(index)) {
        staying.push(index)
      }
    }

    return staying
  }

  /**
   * Get validator count for current epoch
   */
  getCurrentValidatorCount(): bigint {
    return BigInt(this.currentValidators.size)
  }

  /**
   * Get validator count for previous epoch
   */
  getPreviousValidatorCount(): bigint {
    return BigInt(this.previousValidators.size)
  }

  /**
   * Get validator count for next epoch
   */
  getNextValidatorCount(): bigint {
    return BigInt(this.nextValidators.size)
  }

  /**
   * Get total number of validators to connect to
   */
  getTotalConnectedValidatorCount(): bigint {
    return BigInt(this.getAllConnectedValidators().size)
  }

  /**
   * Find validator by endpoint
   */
  findValidatorByEndpoint(endpoint: ConnectionEndpoint): bigint | undefined {
    const allValidators = this.getAllConnectedValidators()

    for (const [index, metadata] of allValidators) {
      if (this.endpointsMatch(metadata.endpoint, endpoint)) {
        return index
      }
    }

    return undefined
  }

  /**
   * Check if two endpoints match
   */
  private endpointsMatch(
    a: ConnectionEndpoint,
    b: ConnectionEndpoint,
  ): boolean {
    return a.host === b.host && a.port === b.port
  }

  /**
   * Get validator set summary
   */
  getValidatorSetSummary(): {
    currentEpoch: bigint
    currentCount: bigint
    previousCount: bigint
    nextCount: bigint
    totalConnected: bigint
    epochTransitionPending: boolean
  } {
    return {
      currentEpoch: this.currentEpoch,
      currentCount: this.getCurrentValidatorCount(),
      previousCount: this.getPreviousValidatorCount(),
      nextCount: this.getNextValidatorCount(),
      totalConnected: this.getTotalConnectedValidatorCount(),
      epochTransitionPending: this.epochTransitionPending,
    }
  }

  /**
   * Initialize validator set with provided validators
   * JIP-5 compliant initialization method
   */
  async initializeValidatorSet(
    validators: Array<{
      index: bigint
      publicKey: Uint8Array
      endpoint: ConnectionEndpoint
    }>,
  ): Promise<void> {
    this.currentValidators.clear()

    for (const validator of validators) {
      this.currentValidators.set(validator.index, {
        index: validator.index,
        publicKey: validator.publicKey,
        endpoint: validator.endpoint,
      })
    }

    console.log(
      `Initialized validator set with ${validators.length} validators`,
    )
  }
}
