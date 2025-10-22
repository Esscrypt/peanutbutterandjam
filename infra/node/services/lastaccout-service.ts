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
import { BaseService, type IConfigService } from '@pbnj/types'
import type { Hex } from 'viem'

/**
 * LastAccout Service Interface
 */
export interface ILastAccoutService {
  getLastAccout(): Hex
  setLastAccout(hash: Hex): void

  // Hash operations
  updateLastAccout(hash: Hex): void
  clearLastAccout(): void
  isValidHash(hash: Hex): boolean

  // Statistics
  getStats(): {
    hasLastAccout: boolean
    lastAccoutLength: number
  }
}

/**
 * LastAccout Service Implementation
 */
export class LastAccoutService
  extends BaseService
  implements ILastAccoutService
{
  private lastAccout: Hex

  constructor(_configService: IConfigService) {
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

  /**
   * Update last accumulation output hash
   *
   * This is called when new accumulation occurs and produces output
   */
  updateLastAccout(hash: Hex): void {
    this.setLastAccout(hash)
    logger.info('Last accumulation output updated', {
      previousHash: this.lastAccout,
      newHash: hash,
    })
  }

  /**
   * Clear last accumulation output hash
   *
   * Resets to zero hash (used during state resets)
   */
  clearLastAccout(): void {
    this.lastAccout =
      '0x0000000000000000000000000000000000000000000000000000000000000000'
    logger.debug('Last accumulation output cleared')
  }

  /**
   * Validate if hash is properly formatted
   *
   * Checks if hash is a valid 32-byte hex string
   */
  isValidHash(hash: Hex): boolean {
    // Check if it's a valid hex string with 0x prefix
    if (!hash.startsWith('0x')) {
      return false
    }

    // Check if it's exactly 64 hex characters (32 bytes)
    const hexContent = hash.slice(2)
    if (hexContent.length !== 64) {
      return false
    }

    // Check if all characters are valid hex
    return /^[0-9a-fA-F]+$/.test(hexContent)
  }

  /**
   * Get service statistics
   */
  getStats(): {
    hasLastAccout: boolean
    lastAccoutLength: number
  } {
    const isZeroHash =
      this.lastAccout ===
      '0x0000000000000000000000000000000000000000000000000000000000000000'

    return {
      hasLastAccout: !isZeroHash,
      lastAccoutLength: this.lastAccout.length,
    }
  }
}
