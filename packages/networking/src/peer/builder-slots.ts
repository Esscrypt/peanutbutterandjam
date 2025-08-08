/**
 * Builder Slots Management
 *
 * Manages builder connections and slots for work package submission
 * Handles builder registration, slot assignment, and connection management
 */

import type {
  ValidatorIndex,
  CoreIndex,
  NodeType,
  ValidatorMetadata
} from '@pbnj/types'

/**
 * Builder information interface
 */
interface BuilderInfo {
  validatorIndex: ValidatorIndex
  metadata: ValidatorMetadata
  isConnected: boolean
  connectionId: string | null
  lastActivity: number
  assignedSlots: CoreIndex[]
}

/**
 * Builder slots manager
 */
export class BuilderSlotsManager {
  private builders: Map<ValidatorIndex, BuilderInfo> = new Map()
  private slotAssignments: Map<CoreIndex, ValidatorIndex> = new Map()
  private maxSlotsPerBuilder: number = 10

  constructor() {}

  /**
   * Set local validator information
   */
  setLocalValidator(_validatorIndex: ValidatorIndex, _nodeType: NodeType): void {
    // Store local validator info for future use
    // TODO: Implement local validator tracking
  }

  /**
   * Register a new builder
   */
  registerBuilder(validatorIndex: ValidatorIndex, metadata: ValidatorMetadata): void {
    const builderInfo: BuilderInfo = {
      validatorIndex,
      metadata,
      isConnected: false,
      connectionId: null,
      lastActivity: Date.now(),
      assignedSlots: []
    }

    this.builders.set(validatorIndex, builderInfo)
  }

  /**
   * Unregister a builder
   */
  unregisterBuilder(validatorIndex: ValidatorIndex): void {
    // Remove slot assignments
    const builder = this.builders.get(validatorIndex)
    if (builder) {
      for (const slot of builder.assignedSlots) {
        this.slotAssignments.delete(slot)
      }
    }

    // Remove builder
    this.builders.delete(validatorIndex)
  }

  /**
   * Get builder information
   */
  getBuilder(validatorIndex: ValidatorIndex): BuilderInfo | undefined {
    return this.builders.get(validatorIndex)
  }

  /**
   * Get all builders
   */
  getAllBuilders(): Map<ValidatorIndex, BuilderInfo> {
    return new Map(this.builders)
  }

  /**
   * Get connected builders
   */
  getConnectedBuilders(): Map<ValidatorIndex, BuilderInfo> {
    const connected = new Map<ValidatorIndex, BuilderInfo>()
    
    for (const builder of this.builders.values()) {
      if (builder.isConnected) {
        connected.set(builder.validatorIndex, builder)
      }
    }
    
    return connected
  }

  /**
   * Mark builder as connected
   */
  markBuilderConnected(validatorIndex: ValidatorIndex, connectionId: string): void {
    const builder = this.builders.get(validatorIndex)
    if (builder) {
      builder.isConnected = true
      builder.connectionId = connectionId
      builder.lastActivity = Date.now()
    }
  }

  /**
   * Mark builder as disconnected
   */
  markBuilderDisconnected(validatorIndex: ValidatorIndex): void {
    const builder = this.builders.get(validatorIndex)
    if (builder) {
      builder.isConnected = false
      builder.connectionId = null
      builder.lastActivity = Date.now()
    }
  }

  /**
   * Update builder last activity
   */
  updateBuilderActivity(validatorIndex: ValidatorIndex): void {
    const builder = this.builders.get(validatorIndex)
    if (builder) {
      builder.lastActivity = Date.now()
    }
  }

  /**
   * Assign a slot to a builder
   */
  assignSlotToBuilder(coreIndex: CoreIndex, validatorIndex: ValidatorIndex): boolean {
    const builder = this.builders.get(validatorIndex)
    if (!builder) {
      return false
    }

    // Check if slot is already assigned
    if (builder.assignedSlots.includes(coreIndex)) {
      return false
    }

    // Check if builder has reached max slots
    if (builder.assignedSlots.length >= this.maxSlotsPerBuilder) {
      return false
    }

    // Assign slot
    builder.assignedSlots.push(coreIndex)
    this.slotAssignments.set(coreIndex, validatorIndex)
    return true
  }

  /**
   * Unassign a slot from a builder
   */
  unassignSlotFromBuilder(coreIndex: CoreIndex, validatorIndex: ValidatorIndex): boolean {
    const builder = this.builders.get(validatorIndex)
    if (!builder) {
      return false
    }

    const index = builder.assignedSlots.indexOf(coreIndex)
    if (index === -1) {
      return false
    }

    // Remove slot from builder's assigned slots
    builder.assignedSlots.splice(index, 1)
    this.slotAssignments.delete(coreIndex)
    return true
  }

  /**
   * Get builder assigned to a slot
   */
  getBuilderForSlot(coreIndex: CoreIndex): ValidatorIndex | undefined {
    return this.slotAssignments.get(coreIndex)
  }

  /**
   * Get all builders for a slot (for future multi-builder support)
   */
  getBuildersForSlot(coreIndex: CoreIndex): ValidatorIndex[] {
    const builders: ValidatorIndex[] = []
    
    for (const [slot, validatorIndex] of this.slotAssignments.entries()) {
      if (slot === coreIndex) {
        builders.push(validatorIndex)
      }
    }
    
    return builders
  }

  /**
   * Get slots assigned to a builder
   */
  getSlotsForBuilder(validatorIndex: ValidatorIndex): CoreIndex[] {
    const builder = this.builders.get(validatorIndex)
    if (!builder) {
      return []
    }
    return builder.assignedSlots
  }

  /**
   * Get all slot assignments
   */
  getAllSlotAssignments(): Map<CoreIndex, ValidatorIndex> {
    return new Map(this.slotAssignments)
  }

  /**
   * Check if a slot is assigned
   */
  isSlotAssigned(coreIndex: CoreIndex): boolean {
    return this.slotAssignments.has(coreIndex)
  }

  /**
   * Check if a builder is assigned to a slot
   */
  isBuilderAssignedToSlot(validatorIndex: ValidatorIndex, coreIndex: CoreIndex): boolean {
    const builder = this.builders.get(validatorIndex)
    if (!builder) {
      return false
    }
    return builder.assignedSlots.includes(coreIndex)
  }

  /**
   * Get available slots (not assigned to any builder)
   */
  getAvailableSlots(totalSlots: number): CoreIndex[] {
    const available: CoreIndex[] = []
    
    for (let i = 0; i < totalSlots; i++) {
      if (!this.slotAssignments.has(i as CoreIndex)) {
        available.push(i as CoreIndex)
      }
    }
    
    return available
  }

  /**
   * Get overloaded builders (with more than max slots)
   */
  getOverloadedBuilders(): Array<{ validatorIndex: ValidatorIndex; slotCount: number }> {
    const overloaded: Array<{ validatorIndex: ValidatorIndex; slotCount: number }> = []
    
    for (const builder of this.builders.values()) {
      if (builder.assignedSlots.length > this.maxSlotsPerBuilder) {
        overloaded.push({ validatorIndex: builder.validatorIndex, slotCount: builder.assignedSlots.length })
      }
    }
    
    return overloaded
  }

  /**
   * Get underutilized builders (with fewer than max slots)
   */
  getUnderutilizedBuilders(): Array<{ validatorIndex: ValidatorIndex; slotCount: number }> {
    const underutilized: Array<{ validatorIndex: ValidatorIndex; slotCount: number }> = []
    
    for (const builder of this.builders.values()) {
      if (builder.assignedSlots.length < this.maxSlotsPerBuilder) {
        underutilized.push({ validatorIndex: builder.validatorIndex, slotCount: builder.assignedSlots.length })
      }
    }
    
    return underutilized
  }

  /**
   * Rebalance slot assignments
   */
  rebalanceSlotAssignments(): void {
    const overloaded = this.getOverloadedBuilders()
    const underutilized = this.getUnderutilizedBuilders()
    
    // Sort overloaded by slot count (highest first)
    overloaded.sort((a, b) => b.slotCount - a.slotCount)
    
    // Sort underutilized by slot count (lowest first)
    underutilized.sort((a, b) => a.slotCount - b.slotCount)
    
    // Move slots from overloaded to underutilized builders
    for (const overloadedBuilder of overloaded) {
      const builder = this.builders.get(overloadedBuilder.validatorIndex)
      if (!builder) continue
      
      // Get excess slots
      const excessSlots = builder.assignedSlots.slice(this.maxSlotsPerBuilder)
      
      for (const slot of excessSlots) {
        // Find an underutilized builder
        const underutilizedBuilder = underutilized.find(u => {
          const b = this.builders.get(u.validatorIndex)
          return b && b.assignedSlots.length < this.maxSlotsPerBuilder
        })
        
        if (underutilizedBuilder) {
          // Move slot
          this.unassignSlotFromBuilder(slot, overloadedBuilder.validatorIndex)
          this.assignSlotToBuilder(slot, underutilizedBuilder.validatorIndex)
          
          // Update counts
          overloadedBuilder.slotCount--
          underutilizedBuilder.slotCount++
        } else {
          break // No more underutilized builders
        }
      }
    }
  }

  /**
   * Get builder statistics
   */
  getStatistics(): {
    totalBuilders: number
    connectedBuilders: number
    disconnectedBuilders: number
    totalSlotAssignments: number
    averageSlotsPerBuilder: number
    maxSlotsPerBuilder: number
    overloadedBuilders: number
    underutilizedBuilders: number
  } {
    const totalBuilders = this.builders.size
    const connectedBuilders = this.getConnectedBuilders().size
    const disconnectedBuilders = totalBuilders - connectedBuilders
    const totalSlotAssignments = this.slotAssignments.size
    
    let totalSlots = 0
    for (const builder of this.builders.values()) {
      totalSlots += builder.assignedSlots.length
    }
    
    const averageSlotsPerBuilder = totalBuilders > 0 ? totalSlots / totalBuilders : 0
    const overloaded = this.getOverloadedBuilders().length
    const underutilized = this.getUnderutilizedBuilders().length
    
    return {
      totalBuilders,
      connectedBuilders,
      disconnectedBuilders,
      totalSlotAssignments,
      averageSlotsPerBuilder,
      maxSlotsPerBuilder: this.maxSlotsPerBuilder,
      overloadedBuilders: overloaded,
      underutilizedBuilders: underutilized
    }
  }

  /**
   * Set maximum slots per builder
   */
  setMaxSlotsPerBuilder(maxSlots: number): void {
    this.maxSlotsPerBuilder = maxSlots
  }

  /**
   * Set maximum builders per slot
   */
  setMaxBuildersPerSlot(maxBuilders: number): void {
    // This method is no longer used as maxBuildersPerSlot is removed.
    // Keeping it for now to avoid breaking existing calls, but it will have no effect.
  }

  /**
   * Clean up inactive builders
   */
  cleanupInactiveBuilders(maxInactiveTime: number = 300000): void { // 5 minutes
    const now = Date.now()
    const toRemove: ValidatorIndex[] = []
    
    for (const [validatorIndex, builder] of this.builders) {
      if (now - builder.lastActivity > maxInactiveTime && !builder.isConnected) {
        toRemove.push(validatorIndex)
      }
    }
    
    for (const validatorIndex of toRemove) {
      this.unregisterBuilder(validatorIndex)
    }
  }

  /**
   * Reset all slot assignments
   */
  resetSlotAssignments(): void {
    this.slotAssignments.clear()
    
    for (const builder of this.builders.values()) {
      builder.assignedSlots = []
    }
  }
} 