// /**
//  * Builder Slots Management
//  *
//  * Manages builder connections and slots for work package submission
//  * Handles builder registration, slot assignment, and connection management
//  */

// import type { NodeType, ValidatorMetadata } from '@pbnjam/types'

// /**
//  * Builder information interface
//  */
// interface BuilderInfo {
//   validatorIndex: bigint
//   metadata: ValidatorMetadata
//   isConnected: boolean
//   connectionId: string | null
//   lastActivity: number
//   assignedSlots: bigint[]
// }

// /**
//  * Builder slots manager
//  */
// export class BuilderSlotsManager {
//   private builders: Map<bigint, BuilderInfo> = new Map()
//   private slotAssignments: Map<bigint, bigint> = new Map()
//   private maxSlotsPerBuilder = 10

//   /**
//    * Set local validator information
//    */
//   setLocalValidator(_validatorIndex: bigint, _nodeType: NodeType): void {
//     // Store local validator info for future use
//     // TODO: Implement local validator tracking
//   }

//   /**
//    * Register a new builder
//    */
//   registerBuilder(validatorIndex: bigint, metadata: ValidatorMetadata): void {
//     const builderInfo: BuilderInfo = {
//       validatorIndex,
//       metadata,
//       isConnected: false,
//       connectionId: null,
//       lastActivity: Date.now(),
//       assignedSlots: [],
//     }

//     this.builders.set(validatorIndex, builderInfo)
//   }

//   /**
//    * Unregister a builder
//    */
//   unregisterBuilder(validatorIndex: bigint): void {
//     // Remove slot assignments
//     const builder = this.builders.get(validatorIndex)
//     if (builder) {
//       for (const slot of builder.assignedSlots) {
//         this.slotAssignments.delete(slot)
//       }
//     }

//     // Remove builder
//     this.builders.delete(validatorIndex)
//   }

//   /**
//    * Get builder information
//    */
//   getBuilder(validatorIndex: bigint): BuilderInfo | undefined {
//     return this.builders.get(validatorIndex)
//   }

//   /**
//    * Get all builders
//    */
//   getAllBuilders(): Map<bigint, BuilderInfo> {
//     return new Map(this.builders)
//   }

//   /**
//    * Get connected builders
//    */
//   getConnectedBuilders(): Map<bigint, BuilderInfo> {
//     const connected = new Map<bigint, BuilderInfo>()

//     for (const builder of this.builders.values()) {
//       if (builder.isConnected) {
//         connected.set(builder.validatorIndex, builder)
//       }
//     }

//     return connected
//   }

//   /**
//    * Mark builder as connected
//    */
//   markBuilderConnected(validatorIndex: bigint, connectionId: string): void {
//     const builder = this.builders.get(validatorIndex)
//     if (builder) {
//       builder.isConnected = true
//       builder.connectionId = connectionId
//       builder.lastActivity = Date.now()
//     }
//   }

//   /**
//    * Mark builder as disconnected
//    */
//   markBuilderDisconnected(validatorIndex: bigint): void {
//     const builder = this.builders.get(validatorIndex)
//     if (builder) {
//       builder.isConnected = false
//       builder.connectionId = null
//       builder.lastActivity = Date.now()
//     }
//   }

//   /**
//    * Update builder last activity
//    */
//   updateBuilderActivity(validatorIndex: bigint): void {
//     const builder = this.builders.get(validatorIndex)
//     if (builder) {
//       builder.lastActivity = Date.now()
//     }
//   }

//   /**
//    * Assign a slot to a builder
//    */
//   assignSlotToBuilder(coreIndex: bigint, validatorIndex: bigint): boolean {
//     const builder = this.builders.get(validatorIndex)
//     if (!builder) {
//       return false
//     }

//     // Check if slot is already assigned
//     if (builder.assignedSlots.includes(coreIndex)) {
//       return false
//     }

//     // Check if builder has reached max slots
//     if (builder.assignedSlots.length >= this.maxSlotsPerBuilder) {
//       return false
//     }

//     // Assign slot
//     builder.assignedSlots.push(coreIndex)
//     this.slotAssignments.set(coreIndex, validatorIndex)
//     return true
//   }

//   /**
//    * Unassign a slot from a builder
//    */
//   unassignSlotFromBuilder(coreIndex: bigint, validatorIndex: bigint): boolean {
//     const builder = this.builders.get(validatorIndex)
//     if (!builder) {
//       return false
//     }

//     const index = builder.assignedSlots.indexOf(coreIndex)
//     if (index === -1) {
//       return false
//     }

//     // Remove slot from builder's assigned slots
//     builder.assignedSlots.splice(index, 1)
//     this.slotAssignments.delete(coreIndex)
//     return true
//   }

//   /**
//    * Get builder assigned to a slot
//    */
//   getBuilderForSlot(coreIndex: bigint): bigint | undefined {
//     return this.slotAssignments.get(coreIndex)
//   }

//   /**
//    * Get all builders for a slot (for future multi-builder support)
//    */
//   getBuildersForSlot(coreIndex: bigint): bigint[] {
//     const builders: bigint[] = []

//     for (const [slot, validatorIndex] of this.slotAssignments.entries()) {
//       if (slot === coreIndex) {
//         builders.push(validatorIndex)
//       }
//     }

//     return builders
//   }

//   /**
//    * Get slots assigned to a builder
//    */
//   getSlotsForBuilder(validatorIndex: bigint): bigint[] {
//     const builder = this.builders.get(validatorIndex)
//     if (!builder) {
//       return []
//     }
//     return builder.assignedSlots
//   }

//   /**
//    * Get all slot assignments
//    */
//   getAllSlotAssignments(): Map<bigint, bigint> {
//     return new Map(this.slotAssignments)
//   }

//   /**
//    * Check if a slot is assigned
//    */
//   isSlotAssigned(coreIndex: bigint): boolean {
//     return this.slotAssignments.has(coreIndex)
//   }

//   /**
//    * Check if a builder is assigned to a slot
//    */
//   isBuilderAssignedToSlot(validatorIndex: bigint, coreIndex: bigint): boolean {
//     const builder = this.builders.get(validatorIndex)
//     if (!builder) {
//       return false
//     }
//     return builder.assignedSlots.includes(coreIndex)
//   }

//   /**
//    * Get available slots (not assigned to any builder)
//    */
//   getAvailableSlots(totalSlots: number): bigint[] {
//     const available: bigint[] = []

//     for (let i = 0; i < totalSlots; i++) {
//       if (!this.slotAssignments.has(BigInt(i))) {
//         available.push(BigInt(i))
//       }
//     }

//     return available
//   }

//   /**
//    * Get overloaded builders (with more than max slots)
//    */
//   getOverloadedBuilders(): Array<{
//     validatorIndex: bigint
//     slotCount: number
//   }> {
//     const overloaded: Array<{
//       validatorIndex: bigint
//       slotCount: number
//     }> = []

//     for (const builder of this.builders.values()) {
//       if (builder.assignedSlots.length > this.maxSlotsPerBuilder) {
//         overloaded.push({
//           validatorIndex: builder.validatorIndex,
//           slotCount: builder.assignedSlots.length,
//         })
//       }
//     }

//     return overloaded
//   }

//   /**
//    * Get underutilized builders (with fewer than max slots)
//    */
//   getUnderutilizedBuilders(): Array<{
//     validatorIndex: bigint
//     slotCount: number
//   }> {
//     const underutilized: Array<{
//       validatorIndex: bigint
//       slotCount: number
//     }> = []

//     for (const builder of this.builders.values()) {
//       if (builder.assignedSlots.length < this.maxSlotsPerBuilder) {
//         underutilized.push({
//           validatorIndex: builder.validatorIndex,
//           slotCount: builder.assignedSlots.length,
//         })
//       }
//     }

//     return underutilized
//   }

//   /**
//    * Rebalance slot assignments
//    */
//   rebalanceSlotAssignments(): void {
//     const overloaded = this.getOverloadedBuilders()
//     const underutilized = this.getUnderutilizedBuilders()

//     // Sort overloaded by slot count (highest first)
//     overloaded.sort((a, b) => b.slotCount - a.slotCount)

//     // Sort underutilized by slot count (lowest first)
//     underutilized.sort((a, b) => a.slotCount - b.slotCount)

//     // Move slots from overloaded to underutilized builders
//     for (const overloadedBuilder of overloaded) {
//       const builder = this.builders.get(overloadedBuilder.validatorIndex)
//       if (!builder) continue

//       // Get excess slots
//       const excessSlots = builder.assignedSlots.slice(this.maxSlotsPerBuilder)

//       for (const slot of excessSlots) {
//         // Find an underutilized builder
//         const underutilizedBuilder = underutilized.find((u) => {
//           const b = this.builders.get(u.validatorIndex)
//           return b && b.assignedSlots.length < this.maxSlotsPerBuilder
//         })

//         if (underutilizedBuilder) {
//           // Move slot
//           this.unassignSlotFromBuilder(slot, overloadedBuilder.validatorIndex)
//           this.assignSlotToBuilder(slot, underutilizedBuilder.validatorIndex)

//           // Update counts
//           overloadedBuilder.slotCount--
//           underutilizedBuilder.slotCount++
//         } else {
//           break // No more underutilized builders
//         }
//       }
//     }
//   }

//   /**
//    * Get builder statistics
//    */
//   getStatistics(): {
//     totalBuilders: number
//     connectedBuilders: number
//     disconnectedBuilders: number
//     totalSlotAssignments: number
//     averageSlotsPerBuilder: number
//     maxSlotsPerBuilder: number
//     overloadedBuilders: number
//     underutilizedBuilders: number
//   } {
//     const totalBuilders = this.builders.size
//     const connectedBuilders = this.getConnectedBuilders().size
//     const disconnectedBuilders = totalBuilders - connectedBuilders
//     const totalSlotAssignments = this.slotAssignments.size

//     let totalSlots = 0n
//     for (const builder of this.builders.values()) {
//       totalSlots += BigInt(builder.assignedSlots.length)
//     }

//     const averageSlotsPerBuilder =
//       totalBuilders > 0 ? Number(totalSlots / BigInt(totalBuilders)) : 0
//     const overloaded = this.getOverloadedBuilders().length
//     const underutilized = this.getUnderutilizedBuilders().length

//     return {
//       totalBuilders: Number(totalBuilders),
//       connectedBuilders: Number(connectedBuilders),
//       disconnectedBuilders: Number(disconnectedBuilders),
//       totalSlotAssignments: Number(totalSlotAssignments),
//       averageSlotsPerBuilder: Number(averageSlotsPerBuilder),
//       maxSlotsPerBuilder: this.maxSlotsPerBuilder,
//       overloadedBuilders: Number(overloaded),
//       underutilizedBuilders: Number(underutilized),
//     }
//   }

//   /**
//    * Set maximum slots per builder
//    */
//   setMaxSlotsPerBuilder(maxSlots: number): void {
//     this.maxSlotsPerBuilder = maxSlots
//   }

//   /**
//    * Set maximum builders per slot
//    */
//   setMaxBuildersPerSlot(_maxBuilders: number): void {
//     // This method is no longer used as maxBuildersPerSlot is removed.
//     // Keeping it for now to avoid breaking existing calls, but it will have no effect.
//   }

//   /**
//    * Clean up inactive builders
//    */
//   cleanupInactiveBuilders(maxInactiveTime = 300000): void {
//     // 5 minutes
//     const now = Date.now()
//     const toRemove: bigint[] = []

//     for (const [validatorIndex, builder] of this.builders) {
//       if (
//         now - builder.lastActivity > maxInactiveTime &&
//         !builder.isConnected
//       ) {
//         toRemove.push(validatorIndex)
//       }
//     }

//     for (const validatorIndex of toRemove) {
//       this.unregisterBuilder(validatorIndex)
//     }
//   }

//   /**
//    * Reset all slot assignments
//    */
//   resetSlotAssignments(): void {
//     this.slotAssignments.clear()

//     for (const builder of this.builders.values()) {
//       builder.assignedSlots = []
//     }
//   }
// }
