/**
 * Alignment helper functions (AssemblyScript)
 * Gray Paper reference: equation 766
 */

import { MEMORY_CONFIG, ZONE_SIZE } from './config'

/**
 * Align to page boundary
 * Gray Paper: rnp(x ∈ ℕ) ≡ Cpvmpagesize * ceil(x / Cpvmpagesize)
 */
export function alignToPage(size: u32): u32 {
  return u32(Math.ceil(f64(size) / f64(MEMORY_CONFIG.PAGE_SIZE))) * MEMORY_CONFIG.PAGE_SIZE
}

/**
 * Align to zone boundary  
 * Gray Paper: rnq(x ∈ ℕ) ≡ Cpvminitzonesize * ceil(x / Cpvminitzonesize)
 */
export function alignToZone(size: u32): u32 {
  return u32(Math.ceil(f64(size) / f64(ZONE_SIZE))) * ZONE_SIZE
}
