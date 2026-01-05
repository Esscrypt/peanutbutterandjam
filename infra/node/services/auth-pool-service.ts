/**
 * AuthPool Service
 *
 * Manages the authorization pool according to Gray Paper specifications.
 *
 * Gray Paper Reference: authorization.tex (Equation 18)
 * authpool ∈ sequence[C_corecount]{sequence[C_authpoolsize]{hash}}
 *
 * Structure: 2D array [C_corecount][C_authpoolsize]
 * - Outer array: C_corecount = 341 cores
 * - Inner arrays: C_authpoolsize = 8 hashes per core (max)
 *
 * Operations:
 * - State transition: Move authorizations from queue to pool during block processing
 * - Pool management: Maintain fixed-size pools per core (C_authpoolsize = 8)
 * - Authorization removal: Remove used authorizations when work reports are guaranteed
 * - Cyclic rotation: Remove oldest, append newest from queue
 */

import {
  type BlockProcessedEvent,
  type EventBusService,
  logger,
} from '@pbnjam/core'
import {
  AUTHORIZATION_CONSTANTS,
  type AuthPool,
  BaseService,
  type Guarantee,
  type IConfigService,
  type Safe,
  safeError,
  safeResult,
} from '@pbnjam/types'
import type { Hex } from 'viem'
import type { AuthQueueService } from './auth-queue-service'
import type { ConfigService } from './config-service'
import type { WorkReportService } from './work-report-service'

/**
 * AuthPool Service Implementation
 */
export class AuthPoolService extends BaseService {
  private authPool: AuthPool
  private readonly configService: IConfigService
  private readonly eventBusService: EventBusService
  private readonly authQueueService: AuthQueueService | null = null
  private readonly workReportService: WorkReportService | null = null

  constructor(options: {
    configService: ConfigService
    workReportService: WorkReportService
    eventBusService: EventBusService
    authQueueService: AuthQueueService
  }) {
    super('auth-pool-service')
    this.configService = options.configService
    this.workReportService = options.workReportService
    this.eventBusService = options.eventBusService
    this.authQueueService = options.authQueueService
    // Initialize as 2D array: authPool[coreIndex][authIndex]
    // Outer array size: C_corecount (341 cores)
    this.authPool = Array.from(
      { length: this.configService.numCores },
      () => [],
    )

    // Subscribe to block processed events for automatic state transitions
    if (this.eventBusService) {
      this.eventBusService.addBlockProcessedCallback(this.handleBlockProcessed)
      logger.info('AuthPoolService subscribed to block processed events')
    }
  }

  /**
   * Apply block transition to auth pool
   * Public method that can be called directly or from event handler
   *
   * Gray Paper Eq. 26-27: authpool'[c] ≡ tail(F(c)) + [authqueue'[c][H_timeslot]]^C_authpoolsize
   * This MUST happen for EVERY block, even empty ones, as authpool is part of the state
   *
   * @param timeslot - Current timeslot (H_timeslot)
   * @param guarantees - Block body guarantees (optional, for setting authorizer hashes)
   * @returns Result of the transition operation
   */
  applyBlockTransition(timeslot: bigint, guarantees: Guarantee[]): Safe<void> {
    if (!this.authQueueService) {
      return safeError(new Error('Auth queue service not found'))
    }
    if (!this.workReportService) {
      return safeError(new Error('Work report service not found'))
    }

    // Extract guaranteed work reports from block body and set authorizer hashes
    // This is needed for authpool transition to remove used authorizers
    for (const guarantee of guarantees) {
      const coreIndex = Number(guarantee.report.core_index)
      const authorizer = guarantee.report.authorizer_hash
      this.workReportService.setAuthorizerHashByCore(coreIndex, authorizer)
    }

    // Trigger the block transition
    return this.onBlockTransition(timeslot)
  }

  /**
   * Handle block processed event from event bus
   * Automatically triggers auth pool state transition
   *
   * Gray Paper: This is called once per block after accumulation completes
   */
  private readonly handleBlockProcessed = async (
    event: BlockProcessedEvent,
  ): Promise<Safe<void>> => {
    return this.applyBlockTransition(event.slot, event.body.guarantees)
  }

  /**
   * Get current auth pool
   */
  getAuthPool(): AuthPool {
    return this.authPool
  }

  /**
   * Set auth pool
   * Validates structure: must be 2D array with correct dimensions
   */
  setAuthPool(authPool: AuthPool): void {
    // Validate outer array size
    if (authPool.length !== this.configService.numCores) {
      logger.warn('Auth pool size mismatch', {
        expected: this.configService.numCores,
        actual: authPool.length,
      })
    }

    // Validate inner array sizes and truncate if necessary
    for (let coreIndex = 0; coreIndex < authPool.length; coreIndex++) {
      const corePool = authPool[coreIndex]
      if (corePool.length > AUTHORIZATION_CONSTANTS.C_AUTHPOOLSIZE) {
        logger.warn('Core pool overflow detected, truncating', {
          coreIndex,
          size: corePool.length,
          max: AUTHORIZATION_CONSTANTS.C_AUTHPOOLSIZE,
        })
        authPool[coreIndex] = corePool.slice(
          0,
          AUTHORIZATION_CONSTANTS.C_AUTHPOOLSIZE,
        )
      }
    }

    this.authPool = authPool
  }

  /**
   * Add authorization to a specific core
   *
   * Gray Paper: authpool[c] maintains up to C_authpoolsize authorizations
   */
  addAuthorizationToCore(coreIndex: number, authHash: Hex): Safe<void> {
    // Validate core index
    if (coreIndex < 0 || coreIndex >= this.configService.numCores) {
      return safeError(
        new Error(
          `Invalid core index: ${coreIndex} (must be 0 to ${this.configService.numCores - 1})`,
        ),
      )
    }

    // Validate authorization hash
    if (!this.isValidAuthHash(authHash)) {
      return safeError(new Error(`Invalid authorization hash: ${authHash}`))
    }

    // Check overflow: cannot exceed C_AUTHPOOLSIZE (8)
    const corePool = this.authPool[coreIndex]
    if (corePool.length >= AUTHORIZATION_CONSTANTS.C_AUTHPOOLSIZE) {
      return safeError(
        new Error(
          `Core ${coreIndex} pool overflow: ${corePool.length} >= ${AUTHORIZATION_CONSTANTS.C_AUTHPOOLSIZE}`,
        ),
      )
    }

    // Check for duplicates
    if (corePool.includes(authHash)) {
      return safeError(
        new Error(
          `Authorization already exists in core ${coreIndex}: ${authHash}`,
        ),
      )
    }

    // Add authorization
    corePool.push(authHash)

    logger.debug('Authorization added to core pool', {
      coreIndex,
      authHash,
      poolSize: corePool.length,
    })

    return safeResult(undefined)
  }

  /**
   * Remove authorization from a specific core
   */
  removeAuthorizationFromCore(coreIndex: number, authHash: Hex): Safe<void> {
    // Validate core index
    if (coreIndex < 0 || coreIndex >= this.configService.numCores) {
      return safeError(new Error(`Invalid core index: ${coreIndex}`))
    }

    const corePool = this.authPool[coreIndex]
    const authIndex = corePool.indexOf(authHash)

    if (authIndex === -1) {
      return safeError(
        new Error(`Authorization not found in core ${coreIndex}: ${authHash}`),
      )
    }

    // Remove authorization
    corePool.splice(authIndex, 1)

    logger.debug('Authorization removed from core pool', {
      coreIndex,
      authHash,
      poolSize: corePool.length,
    })

    return safeResult(undefined)
  }

  /**
   * Get authorizations for a specific core
   */
  getCoreAuthorizations(coreIndex: number): Hex[] {
    if (coreIndex < 0 || coreIndex >= this.authPool.length) {
      return []
    }
    return [...this.authPool[coreIndex]]
  }

  /**
   * Clear all authorizations for a specific core
   */
  clearCoreAuthorizations(coreIndex: number): void {
    if (coreIndex >= 0 && coreIndex < this.authPool.length) {
      this.authPool[coreIndex] = []
      logger.debug('Core authorizations cleared', { coreIndex })
    }
  }

  /**
   * Get current pool size for a core
   */
  getCorePoolSize(coreIndex: number): number {
    if (coreIndex < 0 || coreIndex >= this.authPool.length) {
      return 0
    }
    return this.authPool[coreIndex].length
  }

  /**
   * Get available slots for a core
   */
  getAvailableSlots(coreIndex: number): number {
    return (
      AUTHORIZATION_CONSTANTS.C_AUTHPOOLSIZE - this.getCorePoolSize(coreIndex)
    )
  }

  /**
   * Remove used authorizations when work reports are guaranteed
   *
   * Gray Paper: Remove authorizations that were used to justify guaranteed work-packages
   */
  removeUsedAuthorizations(coreIndex: number, usedAuths: Hex[]): Safe<void> {
    for (const authHash of usedAuths) {
      const result = this.removeAuthorizationFromCore(coreIndex, authHash)
      if (result[0]) {
        // Log warning but continue with other authorizations
        logger.warn('Failed to remove used authorization', {
          coreIndex,
          authHash,
          error: result[0].message,
        })
      }
    }

    logger.debug('Used authorizations removed from pool', {
      coreIndex,
      removedCount: usedAuths.length,
    })

    return safeResult(undefined)
  }

  /**
   * Validate authorization hash format
   */
  private isValidAuthHash(hash: Hex): boolean {
    // Check if it's a valid 32-byte hex string
    return /^0x[0-9a-fA-F]{64}$/.test(hash)
  }

  /**
   * Block transition event handler (called once per block after accumulation)
   *
   * Gray Paper Reference: authorization.tex (Equation 26-27)
   *
   * Formula:
   * ∀ c ∈ coreindex : authpool'[c] ≡ tail(F(c)) + [authqueue'[c][H_timeslot]]^C_authpoolsize
   *
   * Where:
   * F(c) = authpool[c] \ {g_workreport_authorizer} if ∃g ∈ guarantees : g_workreport_core = c
   *        authpool[c]                              otherwise
   *
   * Process:
   * 1. For each core that has a guaranteed work-report, remove the used authorizer
   * 2. Remove the first (oldest) element from the pool
   * 3. Append the element from authqueue[c][timeslot % C_authqueuesize] to the pool
   * 4. Ensure pool doesn't exceed C_authpoolsize (8 elements)
   *
   * @param timeslot - Current timeslot (H_timeslot)
   * @param authQueue - Post-accumulation auth queue state (authqueue')
   * @param guaranteedWorkReports - Map of coreIndex -> authorizer hash for guaranteed reports
   */
  onBlockTransition(timeslot: bigint): Safe<void> {
    if (!this.workReportService) {
      return safeError(new Error('Work report service not found'))
    }
    if (!this.authQueueService) {
      return safeError(new Error('Auth queue service not found'))
    }

    // Process each core
    // Gray Paper Formula (authorization.tex, Equation 26-27):
    // authpool'[c] ≡ ←{F(c) ++ cyclic{authqueue'[c][H_timeslot]}}^C_authpoolsize
    //
    // Where F(c) removes used authorizer if present:
    // F(c) = authpool[c] \ {g_workreport_authorizer} if ∃g ∈ guarantees
    //        authpool[c]                              otherwise
    //
    // The ← (overleftarrow) with ^C_authpoolsize means: take rightmost C_authpoolsize elements
    // This naturally drops the oldest (leftmost) element when pool would exceed size

    for (let coreIndex = 0; coreIndex < this.authPool.length; coreIndex++) {
      const corePool = this.authPool[coreIndex]

      // Step 1: Apply F(c) - remove used authorizer if present
      const usedAuthorizer =
        this.workReportService.getAuthorizerHashByCore(coreIndex) ?? null
      if (usedAuthorizer) {
        const authIndex = corePool.indexOf(usedAuthorizer)
        if (authIndex !== -1) {
          corePool.splice(authIndex, 1)
        }
      }

      // Step 2: Get authorization from queue using cyclic indexing
      // authqueue'[c][H_timeslot mod C_authqueuesize]
      const coreQueue = this.authQueueService.getAuthQueue()[coreIndex] || []
      if (coreQueue.length > 0) {
        const queueIndex = Number(
          timeslot % BigInt(AUTHORIZATION_CONSTANTS.C_AUTHQUEUESIZE),
        )
        const queueHash = coreQueue[queueIndex % coreQueue.length]

        if (queueHash) {
          // Step 3: Append authorization from queue
          corePool.push(queueHash)

          // Step 4: Take rightmost C_authpoolsize elements (drop oldest if overflow)
          if (corePool.length > AUTHORIZATION_CONSTANTS.C_AUTHPOOLSIZE) {
            corePool.shift() // Remove leftmost (oldest)
          }
        }
      }
    }

    return safeResult(undefined)
  }
}
