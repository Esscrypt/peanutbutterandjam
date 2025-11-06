/**
 * LastAccout Service
 *
 * Manages the last accumulation output according to Gray Paper specifications.
 *
 * Gray Paper Reference: recent_history.tex (Equation 17)
 * lastaccout ∈ sequence{tuple{serviceid, hash}}
 *
 * Note: Current implementation uses Hex (single hash) instead of sequence
 * This service manages the most recent accumulation result hash.
 *
 * Operations:
 * - Last accumulation output: Track the most recent accumulation result
 * - Hash management: Store and retrieve the latest accumulation output hash
 * - State transitions: Update when new accumulation occurs
 */

import { logger } from '@pbnj/core'
import { BaseService } from '@pbnj/types'
import type { Hex } from 'viem'

/**
 * LastAccout Service Implementation
 */
export class LastAccoutService extends BaseService {
  private lastAccout: Hex

  constructor() {
    super('lastaccout-service')
    // Initialize with zero hash
    this.lastAccout =
      '0x0000000000000000000000000000000000000000000000000000000000000000'
  }

  /**
   * Get current last accumulation output hash
   *
   * Gray Paper: lastaccout ∈ sequence{tuple{serviceid, hash}}
   * Note: Current implementation uses single Hex instead of sequence
   */
  getLastAccout(): Hex {
    return this.lastAccout
  }

  /**
   * Set last accumulation output hash
   *
   * Gray Paper: lastaccout ∈ sequence{tuple{serviceid, hash}}
   * Note: Current implementation uses single Hex instead of sequence
   */
  setLastAccout(hash: Hex): void {
    this.lastAccout = hash
    logger.debug('Last accumulation output updated', {
      hash,
      hashLength: hash.length,
    })
  }
}
