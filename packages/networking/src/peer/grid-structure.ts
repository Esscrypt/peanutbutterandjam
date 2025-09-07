/**
 * Grid Structure Computation
 *
 * Computes the validator grid structure for block/preimage announcements
 * Handles neighbor detection and grid positioning
 */

import type {
  GridPosition,
  ValidatorGrid,
  ValidatorMetadata,
} from '@pbnj/types'

/**
 * Grid structure manager
 */
export class GridStructureManager {
  private grid: ValidatorGrid | null = null
  private validators: Map<bigint, ValidatorMetadata> = new Map()

  /**
   * Compute grid structure for current validators
   */
  computeGridStructure(
    validators: Map<bigint, ValidatorMetadata>,
  ): ValidatorGrid {
    this.validators = new Map(validators)

    const validatorCount = BigInt(validators.size)
    if (validatorCount === 0n) {
      throw new Error('Cannot compute grid structure with zero validators')
    }

    // Compute grid dimensions
    const { rows, columns } = this.computeGridDimensions(validatorCount)

    // Create grid positions
    const positions = new Map<bigint, GridPosition>()
    const validatorIndices = Array.from(validators.keys()).sort((a, b) =>
      Number(a - b),
    )

    for (let i = 0; i < validatorIndices.length; i++) {
      const validatorIndex = validatorIndices[i]
      const row = Math.floor(i / Number(columns))
      const column = i % Number(columns)

      positions.set(validatorIndex, {
        row: BigInt(row),
        column: BigInt(column),
      })
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
  private computeGridDimensions(validatorCount: bigint): {
    rows: bigint
    columns: bigint
  } {
    // Gray Paper specification: W = floor(sqrt(V))
    const W = Math.floor(Math.sqrt(Number(validatorCount)))
    const columns = W
    const rows = Math.ceil(Number(validatorCount) / Number(W))

    return { rows: BigInt(rows), columns: BigInt(columns) }
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
  areNeighbors(validatorA: bigint, validatorB: bigint): boolean {
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
  getNeighbors(validatorIndex: bigint): bigint[] {
    if (!this.grid) {
      return []
    }

    const neighbors: bigint[] = []
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
  getValidatorsInRow(row: bigint): bigint[] {
    if (!this.grid) {
      return []
    }

    const validators: bigint[] = []

    for (const [index, position] of this.grid.positions) {
      if (position.row === row) {
        validators.push(index)
      }
    }

    return validators.sort((a, b) => Number(a - b))
  }

  /**
   * Get validators in the same column
   */
  getValidatorsInColumn(column: bigint): bigint[] {
    if (!this.grid) {
      return []
    }

    const validators: bigint[] = []

    for (const [index, position] of this.grid.positions) {
      if (position.column === column) {
        validators.push(index)
      }
    }

    return validators.sort((a, b) => Number(a - b))
  }

  /**
   * Get grid position for a validator
   */
  getValidatorPosition(validatorIndex: bigint): GridPosition | undefined {
    return this.grid?.positions.get(validatorIndex)
  }

  /**
   * Get validator at a specific grid position
   */
  getValidatorAtPosition(row: bigint, column: bigint): bigint | undefined {
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
  getGridDimensions(): { rows: bigint; columns: bigint } | null {
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
  getAllPositions(): Map<bigint, GridPosition> {
    if (!this.grid) {
      return new Map()
    }

    return new Map(this.grid.positions)
  }

  /**
   * Check if a position is valid in the grid
   */
  isValidPosition(row: bigint, column: bigint): boolean {
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
    totalValidators: bigint
    rows: bigint
    columns: bigint
    averageNeighborsPerValidator: bigint
    maxNeighborsPerValidator: bigint
    minNeighborsPerValidator: bigint
  } | null {
    if (!this.grid) {
      return null
    }

    const totalValidators = this.grid.positions.size
    const neighborCounts: bigint[] = []

    for (const [validatorIndex] of this.grid.positions) {
      const neighbors = this.getNeighbors(validatorIndex)
      neighborCounts.push(BigInt(neighbors.length))
    }

    const averageNeighbors =
      neighborCounts.reduce((sum, count) => sum + count, 0n) /
      BigInt(neighborCounts.length)
    const maxNeighbors = Math.max(...neighborCounts.map(Number))
    const minNeighbors = Math.min(...neighborCounts.map(Number))

    return {
      totalValidators: BigInt(totalValidators),
      rows: this.grid.rows,
      columns: this.grid.columns,
      averageNeighborsPerValidator: BigInt(averageNeighbors),
      maxNeighborsPerValidator: BigInt(maxNeighbors),
      minNeighborsPerValidator: BigInt(minNeighbors),
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
    validators: Map<bigint, ValidatorMetadata>,
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
    validatorIndex: bigint,
    previousEpochValidators: Map<bigint, ValidatorMetadata>,
    _currentEpochValidators: Map<bigint, ValidatorMetadata>,
    nextEpochValidators: Map<bigint, ValidatorMetadata>,
  ): bigint[] {
    const neighbors: bigint[] = []

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
    validatorIndex: bigint,
    previousEpochValidators: Map<bigint, ValidatorMetadata>,
    currentEpochValidators: Map<bigint, ValidatorMetadata>,
    nextEpochValidators: Map<bigint, ValidatorMetadata>,
  ): bigint[] {
    const targets = new Set<bigint>()

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

    return Array.from(targets).sort((a, b) => Number(a - b))
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
