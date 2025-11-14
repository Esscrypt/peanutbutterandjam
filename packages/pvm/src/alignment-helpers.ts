import { INIT_CONFIG, MEMORY_CONFIG } from './config'

/**
 * Gray Paper equation 766: Page alignment function
 * rnp(x ∈ ℕ) ≡ Cpvmpagesize * ceil(x / Cpvmpagesize)
 *
 * Aligns a size to the nearest page boundary (4096 bytes).
 * Uses number arithmetic to avoid bigint division precision loss.
 *
 * @param size - Size in bytes to align
 * @returns Aligned size as a multiple of Cpvmpagesize
 */
export function alignToPage(size: number): number {
  const pageSize = MEMORY_CONFIG.PAGE_SIZE
  return Math.ceil(size / pageSize) * pageSize
}

/**
 * Gray Paper equation 766: Zone alignment function
 * rnq(x ∈ ℕ) ≡ Cpvminitzonesize * ceil(x / Cpvminitzonesize)
 *
 * Aligns a size to the nearest zone boundary (65536 bytes).
 * Uses number arithmetic to avoid bigint division precision loss.
 *
 * @param size - Size in bytes to align
 * @returns Aligned size as a multiple of Cpvminitzonesize
 */
export function alignToZone(size: number): number {
  const zoneSize = INIT_CONFIG.ZONE_SIZE
  return Math.ceil(size / zoneSize) * zoneSize
}
