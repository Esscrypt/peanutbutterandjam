// /**
//  * Grid Structure Computation
//  *
//  * Computes the validator grid structure for block/preimage announcements
//  * Handles neighbor detection and grid positioning
//  */

// import { type Safe, type SafePromise, safeResult } from '@pbnj/core'
// import type {
//   GridPosition,
//   ValidatorGrid,
//   ValidatorMetadata,
// } from '@pbnj/types'
// import { BaseService } from '@pbnj/types'
// import type { EventBusService, GridUpdateEvent, ValidatorSetChangeEvent } from './event-bus'

// /**
//  * Grid structure manager for JAMNP-S multi-epoch grid management
//  *
//  * Manages three conceptually identical grids as per JAMNP-S spec:
//  * - Previous epoch validators
//  * - Current epoch validators
//  * - Next epoch validators
//  */
// export class GridStructureManager extends BaseService {
//   // Multi-epoch grid management for JAMNP-S spec compliance
//   private previousEpochGrid: ValidatorGrid | null = null
//   private currentEpochGrid: ValidatorGrid | null = null
//   private nextEpochGrid: ValidatorGrid | null = null
//   private eventBusService: EventBusService
//   // Epoch-specific validator sets
//   private previousEpochValidators: Map<bigint, ValidatorMetadata> = new Map()
//   private currentEpochValidators: Map<bigint, ValidatorMetadata> = new Map()
//   private nextEpochValidators: Map<bigint, ValidatorMetadata> = new Map()

//   constructor(options: {
//     eventBusService: EventBusService
//   }) {
//     super('grid-structure-manager')
//     this.eventBusService = options.eventBusService
//   }

//   override start(): Safe<boolean> {
//     this.eventBusService.onGridUpdate(this.handleGridStructureUpdate)
//     this.eventBusService.onValidatorSetChange(this.handleValidatorSetChange)
//     return safeResult(true)
//   }

//   override stop(): Safe<boolean> {
//     this.eventBusService.removeGridUpdateCallback(
//       this.handleGridStructureUpdate,
//     )
//     return safeResult(true)
//   }

//   /**
//    * Apply grid structure update after JAMNP-S timing requirements are met
//    */
//   private async handleGridStructureUpdate(
//     _event: GridUpdateEvent,
//   ): SafePromise<void> {

//     // Rotate grids according to JAMNP-S specification
//     this.rotateGrids()

//     return safeResult(undefined)
//   }

//   /**
//    * Compute grid structure for validators
//    * Internal method used by epoch-specific grid management
//    */
//   private computeGridStructureInternal(
//     validators: Map<bigint, ValidatorMetadata>,
//   ): ValidatorGrid {
//     const validatorCount = BigInt(validators.size)
//     if (validatorCount === 0n) {
//       throw new Error('Cannot compute grid structure with zero validators')
//     }

//     // Compute grid dimensions according to JAMNP-S spec: W = floor(sqrt(V))
//     const { rows, columns } = this.computeGridDimensions(validatorCount)

//     // Create grid positions
//     const positions = new Map<bigint, GridPosition>()
//     const validatorIndices = Array.from(validators.keys()).sort((a, b) =>
//       Number(a - b),
//     )

//     for (let i = 0; i < validatorIndices.length; i++) {
//       const validatorIndex = validatorIndices[i]
//       // JAMNP-S spec: row = index / W, column = index % W
//       const row = Math.floor(Number(validatorIndex) / Number(columns))
//       const column = Number(validatorIndex) % Number(columns)

//       positions.set(validatorIndex, {
//         row: BigInt(row),
//         column: BigInt(column),
//       })
//     }

//     return {
//       rows,
//       columns,
//       positions,
//     }
//   }

//   /**
//    * Compute optimal grid dimensions according to Gray Paper specification
//    * W = floor(sqrt(V)) where V is the number of validators
//    */
//   private computeGridDimensions(validatorCount: bigint): {
//     rows: bigint
//     columns: bigint
//   } {
//     // Gray Paper specification: W = floor(sqrt(V))
//     const W = Math.floor(Math.sqrt(Number(validatorCount)))
//     const columns = W
//     const rows = Math.ceil(Number(validatorCount) / Number(W))

//     return { rows: BigInt(rows), columns: BigInt(columns) }
//   }

//   /**
//    * Rotate grids according to JAMNP-S epoch transition rules
//    * Called when transitioning to a new epoch
//    */
//   rotateGrids(): void {
//     // Move: next -> current, current -> previous
//     this.previousEpochGrid = this.currentEpochGrid
//     this.currentEpochGrid = this.nextEpochGrid
//     this.nextEpochGrid = null

//     // Update validator sets accordingly
//     this.previousEpochValidators = this.currentEpochValidators
//     this.currentEpochValidators = this.nextEpochValidators
//     this.nextEpochValidators = new Map()
//   }

//   /**
//    * Update grid for specific epoch
//    */
//   updateEpochGrid(
//     epoch: 'previous' | 'current' | 'next',
//     validators: Map<bigint, ValidatorMetadata>,
//   ): ValidatorGrid {
//     const grid = this.computeGridStructureInternal(validators)

//     switch (epoch) {
//       case 'previous':
//         this.previousEpochGrid = grid
//         this.previousEpochValidators = new Map(validators)
//         break
//       case 'current':
//         this.currentEpochGrid = grid
//         this.currentEpochValidators = new Map(validators)
//         break
//       case 'next':
//         this.nextEpochGrid = grid
//         this.nextEpochValidators = new Map(validators)
//         break
//     }

//     return grid
//   }

//   /**
//    * Get grid for specific epoch
//    */
//   getGridForEpoch(
//     epoch: 'previous' | 'current' | 'next',
//   ): ValidatorGrid | null {
//     switch (epoch) {
//       case 'previous':
//         return this.previousEpochGrid
//       case 'current':
//         return this.currentEpochGrid
//       case 'next':
//         return this.nextEpochGrid
//     }
//   }

//   /**
//    * Get validators for specific epoch
//    */
//   getValidatorsForEpoch(
//     epoch: 'previous' | 'current' | 'next',
//   ): Map<bigint, ValidatorMetadata> {
//     switch (epoch) {
//       case 'previous':
//         return this.previousEpochValidators
//       case 'current':
//         return this.currentEpochValidators
//       case 'next':
//         return this.nextEpochValidators
//     }
//   }

//   /**
//    * Check if two validators are neighbors according to JAMNP-S spec
//    * Two validators are neighbors if:
//    * 1. They are in the same epoch and either have the same row or same column
//    * 2. They are in different epochs but have the same index
//    */
//   areNeighbors(
//     validatorA: bigint,
//     validatorB: bigint,
//     epochA: 'previous' | 'current' | 'next' = 'current',
//     epochB: 'previous' | 'current' | 'next' = 'current',
//   ): boolean {
//     // Same epoch: check grid neighbors (same row or column)
//     if (epochA === epochB) {
//       const grid = this.getGridForEpoch(epochA)
//       if (!grid) {
//         return false
//       }

//       const posA = grid.positions.get(validatorA)
//       const posB = grid.positions.get(validatorB)

//       if (!posA || !posB) {
//         return false
//       }

//       // Same row or same column
//       return posA.row === posB.row || posA.column === posB.column
//     }

//     // Different epochs: check if same index
//     return validatorA === validatorB
//   }

//   /**
//    * Get all neighbors of a validator in the current epoch
//    */
//   getNeighbors(validatorIndex: bigint): bigint[] {
//     return this.getNeighborsInEpoch(validatorIndex, 'current')
//   }

//   /**
//    * Get all neighbors of a validator in a specific epoch
//    */
//   getNeighborsInEpoch(
//     validatorIndex: bigint,
//     epoch: 'previous' | 'current' | 'next',
//   ): bigint[] {
//     const grid = this.getGridForEpoch(epoch)
//     if (!grid) {
//       return []
//     }

//     const neighbors: bigint[] = []
//     const position = grid.positions.get(validatorIndex)

//     if (!position) {
//       return neighbors
//     }

//     // Check all validators in the same row
//     for (const [index, pos] of grid.positions) {
//       if (index !== validatorIndex && pos.row === position.row) {
//         neighbors.push(index)
//       }
//     }

//     // Check all validators in the same column
//     for (const [index, pos] of grid.positions) {
//       if (index !== validatorIndex && pos.column === position.column) {
//         neighbors.push(index)
//       }
//     }

//     return neighbors
//   }

//   /**
//    * Get validator at a specific grid position in current epoch
//    */
//   getValidatorAtPosition(row: bigint, column: bigint): bigint | undefined {
//     return this.getValidatorAtPositionForEpoch(row, column, 'current')
//   }

//   /**
//    * Get validator at a specific grid position for specific epoch
//    */
//   getValidatorAtPositionForEpoch(
//     row: bigint,
//     column: bigint,
//     epoch: 'previous' | 'current' | 'next',
//   ): bigint | undefined {
//     const grid = this.getGridForEpoch(epoch)
//     if (!grid) {
//       return undefined
//     }

//     for (const [index, position] of grid.positions) {
//       if (position.row === row && position.column === column) {
//         return index
//       }
//     }

//     return undefined
//   }

//   /**
//    * Get all grid positions for current epoch
//    */
//   getAllPositions(): Map<bigint, GridPosition> {
//     return this.getAllPositionsForEpoch('current')
//   }

//   /**
//    * Get all grid positions for specific epoch
//    */
//   getAllPositionsForEpoch(
//     epoch: 'previous' | 'current' | 'next',
//   ): Map<bigint, GridPosition> {
//     const grid = this.getGridForEpoch(epoch)
//     if (!grid) {
//       return new Map()
//     }

//     return new Map(grid.positions)
//   }

//   /**
//    * Check if a position is valid in the current epoch grid
//    */
//   isValidPosition(row: bigint, column: bigint): boolean {
//     return this.isValidPositionForEpoch(row, column, 'current')
//   }

//   /**
//    * Check if a position is valid in the specific epoch grid
//    */
//   isValidPositionForEpoch(
//     row: bigint,
//     column: bigint,
//     epoch: 'previous' | 'current' | 'next',
//   ): boolean {
//     const grid = this.getGridForEpoch(epoch)
//     if (!grid) {
//       return false
//     }

//     return row >= 0 && row < grid.rows && column >= 0 && column < grid.columns
//   }

//   /**
//    * Update current epoch grid structure when validators change
//    */
//   handleValidatorSetChange(
//     event: ValidatorSetChangeEvent,
//   ): Safe<void> {
//     const validators = event.validators
//     this.currentEpochValidators = validators
//     return safeResult(undefined)
//   }

//   /**
//    * Determine preferred initiator between two validators according to Gray Paper
//    * Given two Ed25519 public keys (a, b), the Preferred Initiator P(a, b) ∈ {a, b} is:
//    * P(a, b) ≡ a when (a₃₁ > 127) ⊕ (b₃₁ > 127) ⊕ (a < b)
//    * P(a, b) ≡ b otherwise
//    */
//   static determinePreferredInitiator(
//     publicKeyA: Uint8Array,
//     publicKeyB: Uint8Array,
//   ): 'A' | 'B' {
//     if (publicKeyA.length !== 32 || publicKeyB.length !== 32) {
//       throw new Error('Ed25519 public keys must be 32 bytes')
//     }

//     // Extract the last byte (31st index) from each key
//     const a31 = publicKeyA[31]
//     const b31 = publicKeyB[31]

//     // Compare keys lexicographically (a < b)
//     const aLessThanB = compareKeys(publicKeyA, publicKeyB) < 0

//     // Compute the XOR condition: (a₃₁ > 127) ⊕ (b₃₁ > 127) ⊕ (a < b)
//     const a31Greater127 = a31 > 127
//     const b31Greater127 = b31 > 127
//     const xorResult = (a31Greater127 !== b31Greater127) !== aLessThanB

//     return xorResult ? 'A' : 'B'
//   }

//   /**
//    * Check if current validator should initiate connection to target validator
//    */
//   shouldInitiateConnection(
//     ownPublicKey: Uint8Array,
//     targetPublicKey: Uint8Array,
//   ): boolean {
//     const preferred = GridStructureManager.determinePreferredInitiator(
//       ownPublicKey,
//       targetPublicKey,
//     )
//     return preferred === 'A'
//   }

//   /**
//    * Get neighbors across epochs according to JAMNP-S spec
//    * Two validators are neighbors if they have the same index in different epochs
//    */
//   getCrossEpochNeighbors(validatorIndex: bigint): bigint[] {
//     const neighbors: bigint[] = []

//     // Add validators with same index from other epochs
//     if (this.previousEpochValidators.has(validatorIndex)) {
//       neighbors.push(validatorIndex)
//     }
//     if (this.nextEpochValidators.has(validatorIndex)) {
//       neighbors.push(validatorIndex)
//     }

//     return neighbors
//   }

//   /**
//    * Get all validators that should have block announcement streams (UP 0)
//    * This includes grid neighbors and validators from other epochs with same index
//    * According to JAMNP-S spec: "Both nodes are validators, and are neighbours in the grid structure"
//    * OR "At least one of the nodes is not a validator"
//    */
//   getBlockAnnouncementTargets(validatorIndex: bigint): bigint[] {
//     const targets = new Set<bigint>()

//     // Add grid neighbors from current epoch (validator-to-validator)
//     const gridNeighbors = this.getNeighbors(validatorIndex)
//     gridNeighbors.forEach((neighbor) => targets.add(neighbor))

//     // Add cross-epoch neighbors (same index in other epochs)
//     const crossEpochNeighbors = this.getCrossEpochNeighbors(validatorIndex)
//     crossEpochNeighbors.forEach((neighbor) => targets.add(neighbor))

//     // Note: Non-validator nodes are handled at a higher level in the networking service
//     // This method focuses on validator-to-validator connections as per spec

//     return Array.from(targets).sort((a, b) => Number(a - b))
//   }

//   /**
//    * Check if a connection should be established for block announcements
//    * According to JAMNP-S spec: "Both nodes are validators, and are neighbours in the grid structure"
//    * OR "At least one of the nodes is not a validator"
//    */
//   shouldEstablishBlockAnnouncementConnection(
//     validatorA: bigint,
//     validatorB: bigint,
//     isValidatorA: boolean,
//     isValidatorB: boolean,
//   ): boolean {
//     // If at least one node is not a validator, establish connection
//     if (!isValidatorA || !isValidatorB) {
//       return true
//     }

//     // If both are validators, check if they are neighbors in current epoch
//     return this.areNeighbors(validatorA, validatorB, 'current', 'current')
//   }
// }

// /**
//  * Compare two Ed25519 public keys lexicographically
//  * Returns -1 if keyA < keyB, 0 if equal, 1 if keyA > keyB
//  */
// function compareKeys(keyA: Uint8Array, keyB: Uint8Array): number {
//   for (let i = 0; i < Math.min(keyA.length, keyB.length); i++) {
//     if (keyA[i] < keyB[i]) return -1
//     if (keyA[i] > keyB[i]) return 1
//   }
//   return keyA.length - keyB.length
// }
