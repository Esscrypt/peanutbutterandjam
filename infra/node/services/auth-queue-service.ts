/**
 * AuthQueue Service
 *
 * Manages the authorization queue according to Gray Paper specifications.
 *
 * Gray Paper Reference: authorization.tex (Equation 19)
 * authqueue ∈ sequence[C_corecount]{sequence[C_authqueuesize]{hash}}
 *
 * Structure: 2D array [C_corecount][C_authqueuesize]
 * - Outer array: C_corecount = 341 cores
 * - Inner arrays: C_authqueuesize = 80 hashes per core (max)
 *
 * Operations:
 * - assign: Core assignment (Ω_A) - updates authqueue for specific core
 * - bless: Service blessing (Ω_B) - authorization management
 * - designate: Validator designation (Ω_D) - validator assignment
 */

import { logger } from '@pbnjam/core'
import {
  AUTHORIZATION_CONSTANTS,
  type AuthQueue,
  BaseService,
  type IAuthQueueService,
  type Safe,
  safeError,
  safeResult,
} from '@pbnjam/types'
import type { Hex } from 'viem'
import type { ConfigService } from './config-service'
/**
 * AuthQueue Service Implementation
 */
export class AuthQueueService extends BaseService implements IAuthQueueService {
  private authQueue: AuthQueue
  private readonly configService: ConfigService

  constructor(options: { configService: ConfigService }) {
    super('auth-queue-service')
    this.configService = options.configService

    // Initialize as 2D array: authQueue[coreIndex][authIndex]
    // Outer array size: C_corecount (341 cores)
    this.authQueue = Array.from(
      { length: this.configService.numCores },
      () => [],
    )
  }

  /**
   * Get current auth queue
   */
  getAuthQueue(): AuthQueue {
    return this.authQueue
  }

  /**
   * Set auth queue
   * Validates structure: must be 2D array with correct dimensions
   */
  setAuthQueue(authQueue: AuthQueue): void {
    // Validate outer array size
    if (authQueue.length !== this.configService.numCores) {
      logger.warn('Auth queue size mismatch', {
        expected: this.configService.numCores,
        actual: authQueue.length,
      })
    }

    // Validate inner array sizes and truncate if necessary
    for (let coreIndex = 0; coreIndex < authQueue.length; coreIndex++) {
      const coreQueue = authQueue[coreIndex]
      if (coreQueue.length > AUTHORIZATION_CONSTANTS.C_AUTHQUEUESIZE) {
        logger.warn('Core queue overflow detected, truncating', {
          coreIndex,
          size: coreQueue.length,
          max: AUTHORIZATION_CONSTANTS.C_AUTHQUEUESIZE,
        })
        authQueue[coreIndex] = coreQueue.slice(
          0,
          AUTHORIZATION_CONSTANTS.C_AUTHQUEUESIZE,
        )
      }
    }

    this.authQueue = authQueue
  }

  /**
   * Get authorizations for a specific core
   */
  getCoreAuthorizations(coreIndex: number): Hex[] {
    if (coreIndex < 0 || coreIndex >= this.authQueue.length) {
      return []
    }
    return [...this.authQueue[coreIndex]]
  }

  /**
   * Add single authorization to core queue
   */
  addAuthorization(coreIndex: number, authHash: Hex): Safe<void> {
    // Validate core index
    if (coreIndex < 0 || coreIndex >= this.configService.numCores) {
      return safeError(new Error(`Invalid core index: ${coreIndex}`))
    }

    // Validate authorization hash
    if (!this.isValidAuthHash(authHash)) {
      return safeError(new Error(`Invalid authorization hash: ${authHash}`))
    }

    const coreQueue = this.authQueue[coreIndex]

    // Check overflow: cannot exceed C_AUTHQUEUESIZE (80)
    if (coreQueue.length >= AUTHORIZATION_CONSTANTS.C_AUTHQUEUESIZE) {
      return safeError(
        new Error(
          `Core queue overflow: ${coreQueue.length} >= ${AUTHORIZATION_CONSTANTS.C_AUTHQUEUESIZE}`,
        ),
      )
    }

    // Check for duplicates
    if (coreQueue.includes(authHash)) {
      return safeError(new Error(`Authorization already exists: ${authHash}`))
    }

    // Add authorization
    coreQueue.push(authHash)

    return safeResult(undefined)
  }

  /**
   * Remove authorization from core queue
   */
  removeAuthorization(coreIndex: number, authHash: Hex): Safe<void> {
    // Validate core index
    if (coreIndex < 0 || coreIndex >= this.configService.numCores) {
      return safeError(new Error(`Invalid core index: ${coreIndex}`))
    }

    const coreQueue = this.authQueue[coreIndex]
    const index = coreQueue.indexOf(authHash)

    if (index === -1) {
      return safeError(new Error(`Authorization not found: ${authHash}`))
    }

    // Remove authorization
    coreQueue.splice(index, 1)

    return safeResult(undefined)
  }

  /**
   * Get current queue size for a core
   */
  getQueueSize(coreIndex: number): number {
    if (coreIndex < 0 || coreIndex >= this.authQueue.length) {
      return 0
    }
    return this.authQueue[coreIndex].length
  }

  /**
   * Check if core queue is full
   */
  isQueueFull(coreIndex: number): boolean {
    return (
      this.getQueueSize(coreIndex) >= AUTHORIZATION_CONSTANTS.C_AUTHQUEUESIZE
    )
  }

  /**
   * Get last authorization from queue (for pool promotion)
   *
   * Gray Paper: During state transition, the last element of the queue
   * is moved to the pool (cyclic rotation with timeslot indexing)
   */
  getLastAuthorization(coreIndex: number): Hex | null {
    if (coreIndex < 0 || coreIndex >= this.authQueue.length) {
      return null
    }

    const coreQueue = this.authQueue[coreIndex]
    if (coreQueue.length === 0) {
      return null
    }

    return coreQueue[coreQueue.length - 1]
  }

  /**
   * Validate authorization hash format
   */
  private isValidAuthHash(hash: Hex): boolean {
    // Check if it's a valid 32-byte hex string
    return /^0x[0-9a-fA-F]{64}$/.test(hash)
  }

  /**
   * Get service statistics
   */
  getStats(): {
    totalCores: number
    totalAuthorizations: number
    averageQueueSize: number
    fullCores: number
    emptyCores: number
    utilizationRate: number
  } {
    const totalCores = this.authQueue.length
    let totalAuthorizations = 0
    let fullCores = 0
    let emptyCores = 0

    for (const coreQueue of this.authQueue) {
      totalAuthorizations += coreQueue.length
      if (coreQueue.length === AUTHORIZATION_CONSTANTS.C_AUTHQUEUESIZE) {
        fullCores++
      }
      if (coreQueue.length === 0) {
        emptyCores++
      }
    }

    const averageQueueSize =
      totalCores > 0 ? totalAuthorizations / totalCores : 0
    const maxCapacity = totalCores * AUTHORIZATION_CONSTANTS.C_AUTHQUEUESIZE
    const utilizationRate =
      maxCapacity > 0 ? totalAuthorizations / maxCapacity : 0

    return {
      totalCores,
      totalAuthorizations,
      averageQueueSize,
      fullCores,
      emptyCores,
      utilizationRate,
    }
  }
}
