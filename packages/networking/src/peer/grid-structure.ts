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
   * Compute optimal grid dimensions
   */
  private computeGridDimensions(validatorCount: number): {
    rows: number
    columns: number
  } {
    // Try to make the grid as square as possible
    const sqrt = Math.sqrt(validatorCount)
    const rows = Math.ceil(sqrt)
    const columns = Math.ceil(validatorCount / rows)

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
}
