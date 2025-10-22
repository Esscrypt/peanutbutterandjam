/**
 * Clock Service for JAM Node
 *
 * Manages slot timing and epoch calculations according to Gray Paper specifications
 * Extracted from MainService to provide centralized timing functionality
 */

import {
  type AssuranceDistributionEvent,
  type AuditTrancheEvent,
  type EventBusService,
  logger,
  type SafePromise,
  safeResult,
} from '@pbnj/core'
import {
  AUDIT_CONSTANTS,
  BaseService,
  type IClockService,
  JAM_COMMON_ERA_START_TIME,
  type TicketDistributionEvent,
} from '@pbnj/types'
import type { ConfigService } from './config-service'
import type { ValidatorSetManager } from './validator-set'

/**
 * Clock service implementation
 */
export class ClockService extends BaseService implements IClockService {
  private eventBusService: EventBusService
  private validatorSetManager: ValidatorSetManager | null = null
  private configService: ConfigService
  private slotTimer: NodeJS.Timeout | null = null
  private conectivityChangeTimer: NodeJS.Timeout | null = null
  private ticketDistributionFirstStepTimer: NodeJS.Timeout | null = null
  private ticketDistributionSecondStepTimer: NodeJS.Timeout | null = null
  private assuranceDistributionTimer: NodeJS.Timeout | null = null
  private auditTimer: NodeJS.Timeout | null = null
  private currentSlot = 0n
  private currentEpoch = 0n

  constructor(options: {
    eventBusService: EventBusService
    configService: ConfigService
  }) {
    super('clock-service')
    this.eventBusService = options.eventBusService
    this.configService = options.configService
  }

  setValidatorSetManager(validatorSetManager: ValidatorSetManager): void {
    this.validatorSetManager = validatorSetManager
  }

  /**
   * Initialize the clock service
   */
  async init(): SafePromise<boolean> {
    logger.info('Initializing clock service...')

    // Calculate initial slot and epoch from current time
    this.calculateCurrentSlotAndEpoch()

    this.setInitialized(true)
    logger.info('Clock service initialized successfully')

    return safeResult(true)
  }

  /**
   * Start the clock service
   */
  async start(): SafePromise<boolean> {
    super.start()
    if (this.running) {
      logger.debug('Clock service already running')
      return safeResult(true)
    }

    logger.info('Starting clock service...')

    // Start slot timing
    this.startSlotTiming()

    // Start assurance distribution timing
    this.startAssuranceDistributionTiming()

    //audit timing
    this.startAuditTiming()

    this.setRunning(true)
    logger.info('Clock service started successfully')

    return safeResult(true)
  }

  /**
   * Stop the clock service
   */
  async stop(): SafePromise<boolean> {
    // Stop slot timing
    this.stopSlotTiming()

    // Clear epoch transition timer if it exists
    if (this.conectivityChangeTimer) {
      clearTimeout(this.conectivityChangeTimer)
      this.conectivityChangeTimer = null
    }

    // Clear ticket distribution timers
    this.clearTicketDistributionTimers()

    // Clear assurance distribution timer
    if (this.assuranceDistributionTimer) {
      clearTimeout(this.assuranceDistributionTimer)
      this.assuranceDistributionTimer = null
    }

    // Clear audit timer
    if (this.auditTimer) {
      clearTimeout(this.auditTimer)
      this.auditTimer = null
    }

    super.stop()
    return safeResult(true)
  }

  /**
   * Get current slot number
   */
  getCurrentSlot(): bigint {
    return this.currentSlot
  }

  /**
   * Get current epoch number
   */
  getCurrentEpoch(): bigint {
    return this.currentEpoch
  }

  /**
   * Get current phase within epoch (slot % epoch_length)
   */
  getCurrentPhase(): bigint {
    return this.currentSlot % BigInt(this.configService.epochDuration)
  }

  /**
   * Get slot duration
  /**
   * Get slot index from wall clock time
   * Implements Gray Paper formula: slot = floor((wall_clock - JAM_COMMON_ERA_START_TIME) / SLOT_DURATION)
   */
  getSlotFromWallClock(): bigint {
    const now = Date.now()
    const timeSinceCommonEra = now - JAM_COMMON_ERA_START_TIME
    const slotNumber = Math.floor(
      timeSinceCommonEra / this.configService.slotDuration,
    )
    return BigInt(Math.max(0, slotNumber)) // Ensure non-negative
  }

  /**
   * Get epoch index from slot index
   * Implements Gray Paper formula: epoch = floor(slot / C_epoch_len)
   */
  getEpochFromSlot(slot: bigint): bigint {
    return slot / BigInt(this.configService.epochDuration)
  }

  /**
   * Get phase within epoch from slot index
   * Implements Gray Paper formula: phase = slot % C_epoch_len
   */
  getPhaseFromSlot(slot: bigint): bigint {
    return slot % BigInt(this.configService.epochDuration)
  }

  /**
   * Check if a slot represents an epoch transition
   */
  isEpochTransition(slotIndex: bigint, previousSlotIndex: bigint): boolean {
    const currentEpoch = this.getEpochFromSlot(slotIndex)
    const previousEpoch = this.getEpochFromSlot(previousSlotIndex)
    return currentEpoch > previousEpoch
  }

  /**
   * Calculate current slot and epoch from wall clock time
   */
  private calculateCurrentSlotAndEpoch(): void {
    this.currentSlot = this.getSlotFromWallClock()
    this.currentEpoch = this.getEpochFromSlot(this.currentSlot)
  }

  /**
   * Start slot timing
   */
  private startSlotTiming(): void {
    if (this.slotTimer) {
      clearInterval(this.slotTimer)
    }

    this.slotTimer = setInterval(() => {
      this.processSlot()
    }, this.configService.slotDuration)

    logger.info(
      `Started slot timing with ${this.configService.slotDuration}ms interval`,
    )
  }

  /**
   * Start audit timing
   * Gray Paper: Every Ctrancheseconds = 8 seconds following a new time slot
   */
  private startAuditTiming(): void {
    if (this.auditTimer) {
      clearInterval(this.auditTimer)
    }

    // Gray Paper: Ctrancheseconds = 8 seconds between audit tranches
    const AUDIT_TRANCHE_SECONDS = 8000 // 8 seconds in milliseconds

    this.auditTimer = setInterval(() => {
      this.processAuditTranche()
    }, AUDIT_TRANCHE_SECONDS)

    logger.info(
      `Started audit timing with ${AUDIT_TRANCHE_SECONDS}ms interval (8 seconds)`,
    )
  }

  /**
   * Process audit tranche
   * Gray Paper: Calculate tranche number using n = floor((wallclock - slot_seconds * timeslot) / Ctrancheseconds)
   */
  private processAuditTranche(): void {
    const now = Date.now()
    const wallclock = now - JAM_COMMON_ERA_START_TIME
    const slotSeconds = this.configService.slotDuration
    const trancheSeconds = AUDIT_CONSTANTS.C_TRANCHESECONDS * 1000 // Ctrancheseconds = 8 seconds

    // Gray Paper formula: n = floor((wallclock - slot_seconds * timeslot) / Ctrancheseconds)
    const trancheNumber = Math.floor(
      (wallclock - slotSeconds * Number(this.currentSlot)) / trancheSeconds,
    )

    const auditTrancheEvent: AuditTrancheEvent = {
      timestamp: now,
      slot: this.currentSlot,
      epoch: this.currentEpoch,
      phase: this.getCurrentPhase(),
      trancheNumber,
      wallclock,
    }

    this.eventBusService.emitAuditTranche(auditTrancheEvent)
  }

  /**
   * Start assurance distribution timing
   */
  private startAssuranceDistributionTiming(): void {
    if (this.assuranceDistributionTimer) {
      clearInterval(this.assuranceDistributionTimer)
    }

    // Validators distribute assurances ~2 seconds before each slot
    this.assuranceDistributionTimer = setInterval(() => {
      this.processAssuranceDistribution()
    }, this.configService.slotDuration - 2000)

    logger.info(
      `Started assurance distribution timing with ${this.configService.slotDuration}ms interval`,
    )
  }

  /**
   * Process assurance distribution
   */
  private processAssuranceDistribution(): void {
    const assuranceDistributionEvent: AssuranceDistributionEvent = {
      timestamp: Date.now(),
      slot: this.currentSlot,
      epoch: this.currentEpoch,
      phase: this.getCurrentPhase(),
    }
    this.eventBusService.emitAssuranceDistribution(assuranceDistributionEvent)
  }

  /**
   * Stop slot timing
   */
  private stopSlotTiming(): void {
    if (this.slotTimer) {
      clearInterval(this.slotTimer)
      this.slotTimer = null
      logger.info('Stopped slot timing')
    }
  }

  /**
   * Process a new slot
   * Calculates slot/epoch transitions and emits events via EventBusService
   */
  private async processSlot(): Promise<void> {
    if (!this.validatorSetManager) {
      throw new Error('Validator set manager not set')
    }

    const previousSlot = this.currentSlot
    const previousEpoch = this.currentEpoch

    // Recalculate current slot and epoch from wall clock
    this.calculateCurrentSlotAndEpoch()

    const phase = this.getPhaseFromSlot(this.currentSlot)
    const isEpochTransition = this.isEpochTransition(
      this.currentSlot,
      previousSlot,
    )

    // Emit slot change event
    const slotChangeEvent = {
      timestamp: Date.now(),
      slot: this.currentSlot,
      epoch: this.currentEpoch,
      phase,
      previousSlot,
      isEpochTransition,
    }

    await this.eventBusService.emitSlotChange(slotChangeEvent)

    // Emit epoch transition event if needed
    if (isEpochTransition) {
      // Check if validator set change is pending
      const validatorSetChanged =
        this.validatorSetManager!.isValidatorSetChangePending()

      // Calculate previous slot's phase within the previous epoch
      // Gray Paper: m = previous slot's phase within epoch
      const previousSlotPhase = this.getPhaseFromSlot(previousSlot)

      const epochTransitionEvent = {
        timestamp: Date.now(),
        slot: this.currentSlot,
        epoch: this.currentEpoch,
        phase,
        previousEpoch,
        newEpoch: this.currentEpoch,
        previousSlotPhase, // Gray Paper: m - previous slot's phase within epoch
        validatorSetChanged: validatorSetChanged ?? false,
      }

      await this.eventBusService.emitEpochTransition(epochTransitionEvent)

      // Calculate required delay: max(⌊E / 30⌋, 1) slots
      // For Safrole: E = 600, so max(⌊600 / 30⌋, 1) = max(20, 1) = 20 slots
      const requiredDelaySlots = Math.max(
        Math.floor(this.configService.epochDuration / 30),
        1,
      )
      const requiredDelayMs =
        requiredDelaySlots * this.configService.slotDuration // 6 seconds per slot

      // Clear any existing timer
      if (this.conectivityChangeTimer) {
        clearTimeout(this.conectivityChangeTimer)
      }

      // Schedule the grid update with the required delay
      // This will emit the grid update event after the required delay has passed
      this.conectivityChangeTimer = setTimeout(() => {
        const conectivityChangeEvent = {
          ...epochTransitionEvent,
          timestamp: Date.now(), // Update timestamp to current time
        }
        // Emit the grid update event with the epoch transition event data
        this.eventBusService.emitConectivityChange(conectivityChangeEvent)

        this.conectivityChangeTimer = null
      }, requiredDelayMs)

      // Schedule ticket distribution according to JAMNP-S specification
      this.scheduleTicketDistribution(epochTransitionEvent)
    }
  }

  /**
   * Schedule ticket distribution according to JAMNP-S specification
   *
   * JAMNP-S spec:
   * - First step (CE 131): max(⌊E/60⌋, 1) slots after connectivity changes
   * - Second step (CE 132): max(⌊E/20⌋, 1) slots after connectivity changes
   */
  private scheduleTicketDistribution(_epochTransitionEvent: unknown): void {
    // Clear any existing timers
    this.clearTicketDistributionTimers()

    // Calculate delays according to JAMNP-S specification
    const firstStepDelaySlots = Math.max(
      Math.floor(this.configService.epochDuration / 60),
      1,
    )
    const secondStepDelaySlots = Math.max(
      Math.floor(this.configService.epochDuration / 20),
      1,
    )

    const firstStepDelayMs =
      firstStepDelaySlots * this.configService.slotDuration
    const secondStepDelayMs =
      secondStepDelaySlots * this.configService.slotDuration

    // Schedule first step (CE 131)
    this.ticketDistributionFirstStepTimer = setTimeout(() => {
      const firstPhaseTicketDistributionEvent: TicketDistributionEvent = {
        epochIndex: this.currentEpoch,
        phase: Number(this.getCurrentPhase()),
        timestamp: Date.now(),
      }
      this.eventBusService.emitFirstPhaseTicketDistribution(
        firstPhaseTicketDistributionEvent,
      )
      this.ticketDistributionFirstStepTimer = null
    }, firstStepDelayMs)

    // Schedule second step (CE 132)
    this.ticketDistributionSecondStepTimer = setTimeout(() => {
      const secondPhaseTicketDistributionEvent: TicketDistributionEvent = {
        epochIndex: this.currentEpoch,
        phase: Number(this.getCurrentPhase()),
        timestamp: Date.now(),
      }
      this.eventBusService.emitSecondPhaseTicketDistribution(
        secondPhaseTicketDistributionEvent,
      )

      this.ticketDistributionSecondStepTimer = null
    }, secondStepDelayMs)
  }

  /**
   * Clear ticket distribution timers
   */
  private clearTicketDistributionTimers(): void {
    if (this.ticketDistributionFirstStepTimer) {
      clearTimeout(this.ticketDistributionFirstStepTimer)
      this.ticketDistributionFirstStepTimer = null
    }
    if (this.ticketDistributionSecondStepTimer) {
      clearTimeout(this.ticketDistributionSecondStepTimer)
      this.ticketDistributionSecondStepTimer = null
    }
  }

  /**
   * Get clock service status
   */
  getStatus(): {
    currentSlot: bigint
    currentEpoch: bigint
    currentPhase: bigint
    isRunning: boolean
    slotDuration: number
    epochLength: number
    jamCommonEraStartTime: number
  } {
    return {
      currentSlot: this.currentSlot,
      currentEpoch: this.currentEpoch,
      currentPhase: this.getCurrentPhase(),
      isRunning: this.running,
      slotDuration: this.configService.slotDuration,
      epochLength: this.configService.epochDuration,
      jamCommonEraStartTime: JAM_COMMON_ERA_START_TIME,
    }
  }
}
