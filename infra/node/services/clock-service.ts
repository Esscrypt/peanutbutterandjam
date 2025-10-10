/**
 * Clock Service for JAM Node
 *
 * Manages slot timing and epoch calculations according to Gray Paper specifications
 * Extracted from MainService to provide centralized timing functionality
 */

import {
  type EventBusService,
  logger,
  type SafePromise,
  safeResult,
} from '@pbnj/core'
import {
  BaseService,
  type IClockService,
  JAM_COMMON_ERA_START_TIME,
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
  private scheduleTicketDistribution(_epochTransitionEvent: any): void {
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

    logger.info('Scheduling ticket distribution', {
      firstStepDelaySlots,
      secondStepDelaySlots,
      firstStepDelayMs,
      secondStepDelayMs,
      slot: this.currentSlot.toString(),
      epoch: this.currentEpoch.toString(),
    })

    // Schedule first step (CE 131)
    this.ticketDistributionFirstStepTimer = setTimeout(() => {
      this.eventBusService.emitTicketDistribution({
        timestamp: Date.now(),
        slot: this.currentSlot,
        epoch: this.currentEpoch,
        phase: 'first-step',
        delaySlots: BigInt(firstStepDelaySlots),
        totalValidators: this.validatorSetManager!.getActiveValidators().size,
      })
      logger.info('Ticket distribution first step event emitted', {
        slot: this.currentSlot.toString(),
        epoch: this.currentEpoch.toString(),
        delaySlots: firstStepDelaySlots,
      })
      this.ticketDistributionFirstStepTimer = null
    }, firstStepDelayMs)

    // Schedule second step (CE 132)
    this.ticketDistributionSecondStepTimer = setTimeout(() => {
      this.eventBusService.emitTicketDistribution({
        timestamp: Date.now(),
        slot: this.currentSlot,
        epoch: this.currentEpoch,
        phase: 'second-step',
        delaySlots: BigInt(secondStepDelaySlots),
        totalValidators: this.validatorSetManager!.getActiveValidators().size,
      })
      logger.info('Ticket distribution second step event emitted', {
        slot: this.currentSlot.toString(),
        epoch: this.currentEpoch.toString(),
        delaySlots: secondStepDelaySlots,
      })
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
