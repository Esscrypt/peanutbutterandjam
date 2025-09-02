/**
 * Grid Structure Computation
 *
 * Computes the validator grid structure for block/preimage announcements
 * Handles neighbor detection and grid positioning
 */

import type {
  GridPosition,
  ValidatorGrid,
  ValidatorIndex,
  ValidatorMetadata,
} from '@pbnj/types'

/**
 * Grid structure manager
 */
export class GridStructureManager {
  private grid: ValidatorGrid | null = null
  private validators: Map<ValidatorIndex, ValidatorMetadata> = new Map()

  /**
   * Compute grid structure for current validators
   */
  computeGridStructure(
    validators: Map<ValidatorIndex, ValidatorMetadata>,
  ): ValidatorGrid {
    this.validators = new Map(validators)

    const validatorCount = validators.size
    if (validatorCount === 0) {
      throw new Error('Cannot compute grid structure with zero validators')
    }

    // Compute grid dimensions
    const { rows, columns } = this.computeGridDimensions(validatorCount)

    // Create grid positions
    const positions = new Map<ValidatorIndex, GridPosition>()
    const validatorIndices = Array.from(validators.keys()).sort((a, b) => a - b)

    for (let i = 0; i < validatorIndices.length; i++) {
      const validatorIndex = validatorIndices[i]
      const row = Math.floor(i / columns)
      const column = i % columns

      positions.set(validatorIndex, { row, column })
    }

    this.grid = {
      rows,
      columns,
      positions,
    }

    return this.grid
  }

  /**
   * Compute optimal grid dimensions according to Gray Paper specification
   * W = floor(sqrt(V)) where V is the number of validators
   */
  private computeGridDimensions(validatorCount: number): {
    rows: number
    columns: number
  } {
    // Gray Paper specification: W = floor(sqrt(V))
    const W = Math.floor(Math.sqrt(validatorCount))
    const columns = W
    const rows = Math.ceil(validatorCount / W)

    return { rows, columns }
  }

  /**
   * Get current grid structure
   */
  getGrid(): ValidatorGrid | null {
    return this.grid
  }

  /**
   * Check if two validators are neighbors in the grid
   */
  areNeighbors(
    validatorA: ValidatorIndex,
    validatorB: ValidatorIndex,
  ): boolean {
    if (!this.grid) {
      return false
    }

    const posA = this.grid.positions.get(validatorA)
    const posB = this.grid.positions.get(validatorB)

    if (!posA || !posB) {
      return false
    }

    // Same row or same column
    return posA.row === posB.row || posA.column === posB.column
  }

  /**
   * Get all neighbors of a validator
   */
  getNeighbors(validatorIndex: ValidatorIndex): ValidatorIndex[] {
    if (!this.grid) {
      return []
    }

    const neighbors: ValidatorIndex[] = []
    const position = this.grid.positions.get(validatorIndex)

    if (!position) {
      return neighbors
    }

    // Check all validators in the same row
    for (const [index, pos] of this.grid.positions) {
      if (index !== validatorIndex && pos.row === position.row) {
        neighbors.push(index)
      }
    }

    // Check all validators in the same column
    for (const [index, pos] of this.grid.positions) {
      if (index !== validatorIndex && pos.column === position.column) {
        neighbors.push(index)
      }
    }

    return neighbors
  }

  /**
   * Get validators in the same row
   */
  getValidatorsInRow(row: number): ValidatorIndex[] {
    if (!this.grid) {
      return []
    }

    const validators: ValidatorIndex[] = []

    for (const [index, position] of this.grid.positions) {
      if (position.row === row) {
        validators.push(index)
      }
    }

    return validators.sort((a, b) => a - b)
  }

  /**
   * Get validators in the same column
   */
  getValidatorsInColumn(column: number): ValidatorIndex[] {
    if (!this.grid) {
      return []
    }

    const validators: ValidatorIndex[] = []

    for (const [index, position] of this.grid.positions) {
      if (position.column === column) {
        validators.push(index)
      }
    }

    return validators.sort((a, b) => a - b)
  }

  /**
   * Get grid position for a validator
   */
  getValidatorPosition(
    validatorIndex: ValidatorIndex,
  ): GridPosition | undefined {
    return this.grid?.positions.get(validatorIndex)
  }

  /**
   * Get validator at a specific grid position
   */
  getValidatorAtPosition(
    row: number,
    column: number,
  ): ValidatorIndex | undefined {
    if (!this.grid) {
      return undefined
    }

    for (const [index, position] of this.grid.positions) {
      if (position.row === row && position.column === column) {
        return index
      }
    }

    return undefined
  }

  /**
   * Get grid dimensions
   */
  getGridDimensions(): { rows: number; columns: number } | null {
    if (!this.grid) {
      return null
    }

    return {
      rows: this.grid.rows,
      columns: this.grid.columns,
    }
  }

  /**
   * Get all grid positions
   */
  getAllPositions(): Map<ValidatorIndex, GridPosition> {
    if (!this.grid) {
      return new Map()
    }

    return new Map(this.grid.positions)
  }

  /**
   * Check if a position is valid in the grid
   */
  isValidPosition(row: number, column: number): boolean {
    if (!this.grid) {
      return false
    }

    return (
      row >= 0 &&
      row < this.grid.rows &&
      column >= 0 &&
      column < this.grid.columns
    )
  }

  /**
   * Get grid statistics
   */
  getGridStatistics(): {
    totalValidators: number
    rows: number
    columns: number
    averageNeighborsPerValidator: number
    maxNeighborsPerValidator: number
    minNeighborsPerValidator: number
  } | null {
    if (!this.grid) {
      return null
    }

    const totalValidators = this.grid.positions.size
    const neighborCounts: number[] = []

    for (const [validatorIndex] of this.grid.positions) {
      const neighbors = this.getNeighbors(validatorIndex)
      neighborCounts.push(neighbors.length)
    }

    const averageNeighbors =
      neighborCounts.reduce((sum, count) => sum + count, 0) /
      neighborCounts.length
    const maxNeighbors = Math.max(...neighborCounts)
    const minNeighbors = Math.min(...neighborCounts)

    return {
      totalValidators,
      rows: this.grid.rows,
      columns: this.grid.columns,
      averageNeighborsPerValidator: averageNeighbors,
      maxNeighborsPerValidator: maxNeighbors,
      minNeighborsPerValidator: minNeighbors,
    }
  }

  /**
   * Clear grid structure
   */
  clearGrid(): void {
    this.grid = null
    this.validators.clear()
  }

  /**
   * Update grid structure when validators change
   */
  updateGridStructure(
    validators: Map<ValidatorIndex, ValidatorMetadata>,
  ): ValidatorGrid {
    return this.computeGridStructure(validators)
  }

  /**
   * Determine preferred initiator between two validators according to Gray Paper
   * Given two Ed25519 public keys (a, b), the Preferred Initiator P(a, b) ∈ {a, b} is:
   * P(a, b) ≡ a when (a₃₁ > 127) ⊕ (b₃₁ > 127) ⊕ (a < b)
   * P(a, b) ≡ b otherwise
   */
  static determinePreferredInitiator(
    publicKeyA: Uint8Array,
    publicKeyB: Uint8Array,
  ): 'A' | 'B' {
    if (publicKeyA.length !== 32 || publicKeyB.length !== 32) {
      throw new Error('Ed25519 public keys must be 32 bytes')
    }

    // Extract the last byte (31st index) from each key
    const a31 = publicKeyA[31]
    const b31 = publicKeyB[31]

    // Compare keys lexicographically (a < b)
    const aLessThanB = compareKeys(publicKeyA, publicKeyB) < 0

    // Compute the XOR condition: (a₃₁ > 127) ⊕ (b₃₁ > 127) ⊕ (a < b)
    const a31Greater127 = a31 > 127
    const b31Greater127 = b31 > 127
    const xorResult = (a31Greater127 !== b31Greater127) !== aLessThanB

    return xorResult ? 'A' : 'B'
  }

  /**
   * Check if current validator should initiate connection to target validator
   */
  shouldInitiateConnection(
    ownPublicKey: Uint8Array,
    targetPublicKey: Uint8Array,
  ): boolean {
    const preferred = GridStructureManager.determinePreferredInitiator(
      ownPublicKey,
      targetPublicKey,
    )
    return preferred === 'A'
  }

  /**
   * Get neighbors across epochs (including previous, current, and next validators)
   * Two validators are neighbors if they have the same index in different epochs
   */
  getCrossEpochNeighbors(
    validatorIndex: ValidatorIndex,
    previousEpochValidators: Map<ValidatorIndex, ValidatorMetadata>,
    _currentEpochValidators: Map<ValidatorIndex, ValidatorMetadata>,
    nextEpochValidators: Map<ValidatorIndex, ValidatorMetadata>,
  ): ValidatorIndex[] {
    const neighbors: ValidatorIndex[] = []

    // Add validators with same index from other epochs
    if (previousEpochValidators.has(validatorIndex)) {
      neighbors.push(validatorIndex)
    }
    if (nextEpochValidators.has(validatorIndex)) {
      neighbors.push(validatorIndex)
    }

    return neighbors
  }

  /**
   * Get all validators that should have block announcement streams (UP 0)
   * This includes grid neighbors and validators from other epochs with same index
   */
  getBlockAnnouncementTargets(
    validatorIndex: ValidatorIndex,
    previousEpochValidators: Map<ValidatorIndex, ValidatorMetadata>,
    currentEpochValidators: Map<ValidatorIndex, ValidatorMetadata>,
    nextEpochValidators: Map<ValidatorIndex, ValidatorMetadata>,
  ): ValidatorIndex[] {
    const targets = new Set<ValidatorIndex>()

    // Add grid neighbors from current epoch
    const gridNeighbors = this.getNeighbors(validatorIndex)
    gridNeighbors.forEach((neighbor) => targets.add(neighbor))

    // Add cross-epoch neighbors (same index in other epochs)
    const crossEpochNeighbors = this.getCrossEpochNeighbors(
      validatorIndex,
      previousEpochValidators,
      currentEpochValidators,
      nextEpochValidators,
    )
    crossEpochNeighbors.forEach((neighbor) => targets.add(neighbor))

    return Array.from(targets).sort((a, b) => a - b)
  }
}

/**
 * Compare two Ed25519 public keys lexicographically
 * Returns -1 if keyA < keyB, 0 if equal, 1 if keyA > keyB
 */
function compareKeys(keyA: Uint8Array, keyB: Uint8Array): number {
  for (let i = 0; i < Math.min(keyA.length, keyB.length); i++) {
    if (keyA[i] < keyB[i]) return -1
    if (keyA[i] > keyB[i]) return 1
  }
  return keyA.length - keyB.length
}
