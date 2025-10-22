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
  type Safe,
  safeError,
  safeResult,
} from '@pbnj/core'
import {
  AUTHORIZATION_CONSTANTS,
  type AuthPool,
  type AuthQueue,
  BaseService,
  type IConfigService,
} from '@pbnj/types'
import type { Hex } from 'viem'

/**
 * AuthPool Service Interface
 */
export interface IAuthPoolService {
  getAuthPool(): AuthPool
  setAuthPool(authPool: AuthPool): void

  // Core operations
  addAuthorizationToCore(coreIndex: number, authHash: Hex): Safe<void>
  removeAuthorizationFromCore(coreIndex: number, authHash: Hex): Safe<void>
  getCoreAuthorizations(coreIndex: number): Hex[]
  clearCoreAuthorizations(coreIndex: number): void

  // Pool management
  isCorePoolFull(coreIndex: number): boolean
  getCorePoolSize(coreIndex: number): number
  getAvailableSlots(coreIndex: number): number

  // State transition operations (Gray Paper compliant)
  rotatePoolFromQueue(coreIndex: number, queueHash: Hex): Safe<void>
  removeUsedAuthorizations(coreIndex: number, usedAuths: Hex[]): Safe<void>

  // Block transition event handler (called once per block after accumulation)
  onBlockTransition(
    timeslot: bigint,
    authQueue: AuthQueue,
    guaranteedWorkReports: Map<number, Hex>,
  ): Safe<void>
}

/**
 * AuthPool Service Implementation
 */
export class AuthPoolService extends BaseService implements IAuthPoolService {
  private authPool: AuthPool
  private readonly configService: IConfigService
  private readonly eventBusService?: EventBusService
  private authQueueCache?: AuthQueue

  constructor(
    configService: IConfigService,
    eventBusService?: EventBusService,
  ) {
    super('auth-pool-service')
    this.configService = configService
    this.eventBusService = eventBusService

    // Initialize as 2D array: authPool[coreIndex][authIndex]
    // Outer array size: C_corecount (341 cores)
    this.authPool = Array.from({ length: configService.numCores }, () => [])

    // Subscribe to block processed events for automatic state transitions
    if (this.eventBusService) {
      this.eventBusService.addBlockProcessedCallback(this.handleBlockProcessed)
      logger.info('AuthPoolService subscribed to block processed events')
    }
  }

  /**
   * Set the auth queue cache (called by state service after accumulation)
   * This allows the pool service to access the post-accumulation queue state
   */
  setAuthQueueCache(authQueue: AuthQueue): void {
    this.authQueueCache = authQueue
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
    try {
      if (!this.authQueueCache) {
        logger.warn('Auth queue cache not set, skipping auth pool transition', {
          slot: event.slot.toString(),
        })
        return safeResult(undefined)
      }

      // Extract guaranteed work reports from block body
      // todo: get those from the work package manager service
      const guaranteedWorkReports = new Map<number, Hex>()
      for (const guarantee of event.body.guarantees) {
        const coreIndex = Number(guarantee.report.core_index)
        const authorizer = guarantee.report.authorizer_hash
        guaranteedWorkReports.set(coreIndex, authorizer)
      }

      logger.debug('Triggering auth pool block transition', {
        slot: event.slot.toString(),
        guaranteedWorkReportsCount: guaranteedWorkReports.size,
        queueCacheValid: !!this.authQueueCache,
      })

      // Trigger the block transition
      const [error] = this.onBlockTransition(
        event.slot,
        this.authQueueCache,
        guaranteedWorkReports,
      )

      if (error) {
        logger.error('Auth pool block transition failed', {
          slot: event.slot.toString(),
          error: error.message,
        })
        return safeError(error)
      }

      logger.info('Auth pool block transition completed successfully', {
        slot: event.slot.toString(),
        totalAuthorizations: this.authPool.reduce(
          (sum, pool) => sum + pool.length,
          0,
        ),
      })

      return safeResult(undefined)
    } catch (error) {
      logger.error(
        'Error handling block processed event in auth pool service',
        {
          error: error instanceof Error ? error.message : String(error),
          slot: event.slot.toString(),
        },
      )
      return safeError(error as Error)
    }
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
    logger.debug('Auth pool updated', {
      coreCount: authPool.length,
      totalAuthorizations: authPool.reduce((sum, pool) => sum + pool.length, 0),
    })
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
   * Check if core pool is full
   */
  isCorePoolFull(coreIndex: number): boolean {
    if (coreIndex < 0 || coreIndex >= this.authPool.length) {
      return false
    }
    return (
      this.authPool[coreIndex].length >= AUTHORIZATION_CONSTANTS.C_AUTHPOOLSIZE
    )
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
   * Rotate pool from queue during state transition (Gray Paper compliant)
   *
   * Gray Paper Operation: authpool'[c] = tail(authpool[c]) + [queueHash]
   * - Remove the first (oldest) authorization from the pool
   * - Append the new authorization from the queue to the end
   *
   * This implements the cyclic rotation described in the test vector:
   * 1. Remove first element from pool
   * 2. Append last element from queue
   *
   * @param coreIndex - Core index
   * @param queueHash - Authorization hash from the queue to append
   */
  rotatePoolFromQueue(coreIndex: number, queueHash: Hex): Safe<void> {
    // Validate core index
    if (coreIndex < 0 || coreIndex >= this.configService.numCores) {
      return safeError(new Error(`Invalid core index: ${coreIndex}`))
    }

    // Validate authorization hash
    if (!this.isValidAuthHash(queueHash)) {
      return safeError(new Error(`Invalid authorization hash: ${queueHash}`))
    }

    const corePool = this.authPool[coreIndex]

    // Remove first element (if pool is not empty)
    if (corePool.length > 0) {
      const removed = corePool.shift()
      logger.debug('Removed oldest authorization from pool', {
        coreIndex,
        removedHash: removed,
        remainingSize: corePool.length,
      })
    }

    // Check overflow before appending
    if (corePool.length >= AUTHORIZATION_CONSTANTS.C_AUTHPOOLSIZE) {
      return safeError(
        new Error(
          `Core ${coreIndex} pool overflow after rotation: ${corePool.length} >= ${AUTHORIZATION_CONSTANTS.C_AUTHPOOLSIZE}`,
        ),
      )
    }

    // Append new authorization from queue
    corePool.push(queueHash)

    logger.debug('Rotated authorization from queue to pool', {
      coreIndex,
      newHash: queueHash,
      poolSize: corePool.length,
    })

    return safeResult(undefined)
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
  onBlockTransition(
    timeslot: bigint,
    authQueue: AuthQueue,
    guaranteedWorkReports: Map<number, Hex>,
  ): Safe<void> {
    try {
      logger.debug('Auth pool block transition starting', {
        timeslot: timeslot.toString(),
        guaranteedWorkReportsCount: guaranteedWorkReports.size,
      })

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
        const usedAuthorizer = guaranteedWorkReports.get(coreIndex)
        if (usedAuthorizer) {
          const authIndex = corePool.indexOf(usedAuthorizer)
          if (authIndex !== -1) {
            corePool.splice(authIndex, 1)
            logger.debug('Removed used authorizer from pool', {
              coreIndex,
              authorizer: usedAuthorizer,
              poolSize: corePool.length,
            })
          }
        }

        // Step 2: Get authorization from queue using cyclic indexing
        // authqueue'[c][H_timeslot mod C_authqueuesize]
        const coreQueue = authQueue[coreIndex] || []
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
              const removed = corePool.shift() // Remove leftmost (oldest)
              logger.debug(
                'Dropped oldest authorization due to pool overflow',
                {
                  coreIndex,
                  removedHash: removed,
                  poolSize: corePool.length,
                },
              )
            }

            logger.debug('Rotated authorization from queue to pool', {
              coreIndex,
              newHash: queueHash,
              poolSize: corePool.length,
            })
          }
        }
      }

      logger.debug('Auth pool block transition completed', {
        timeslot: timeslot.toString(),
        totalAuthorizations: this.authPool.reduce(
          (sum, pool) => sum + pool.length,
          0,
        ),
      })

      return safeResult(undefined)
    } catch (error) {
      return safeError(error as Error)
    }
  }

  /**
   * Get service statistics
   */
  getStats(): {
    totalCores: number
    totalAuthorizations: number
    averagePoolSize: number
    fullCores: number
    emptyCores: number
    utilizationRate: number
  } {
    const totalCores = this.authPool.length
    let totalAuthorizations = 0
    let fullCores = 0
    let emptyCores = 0

    for (const corePool of this.authPool) {
      totalAuthorizations += corePool.length
      if (corePool.length === AUTHORIZATION_CONSTANTS.C_AUTHPOOLSIZE) {
        fullCores++
      }
      if (corePool.length === 0) {
        emptyCores++
      }
    }

    const averagePoolSize =
      totalCores > 0 ? totalAuthorizations / totalCores : 0
    const maxCapacity = totalCores * AUTHORIZATION_CONSTANTS.C_AUTHPOOLSIZE
    const utilizationRate =
      maxCapacity > 0 ? totalAuthorizations / maxCapacity : 0

    return {
      totalCores,
      totalAuthorizations,
      averagePoolSize,
      fullCores,
      emptyCores,
      utilizationRate,
    }
  }
}
