/**
 * Validation utilities for CLI arguments
 */

/**
 * Validates if a string is a valid hex string (with or without 0x prefix)
 * @param hex - The hex string to validate
 * @returns true if valid hex, false otherwise
 */
export function isValidHex(hex: string): boolean {
  if (!hex || typeof hex !== 'string') {
    return false
  }

  // Remove 0x prefix if present
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex

  // Check if it's a valid hex string (even length, only hex characters)
  return /^[0-9a-fA-F]+$/.test(cleanHex) && cleanHex.length % 2 === 0
}

/**
 * Validates if a string is a valid file path
 * @param path - The path to validate
 * @returns true if valid path, false otherwise
 */
export function isValidPath(path: string): boolean {
  if (!path || typeof path !== 'string') {
    return false
  }

  // Basic path validation - should not be empty and should not contain invalid characters
  return path.length > 0 && !/[<>:"|?*]/.test(path)
}

/**
 * Validates if a number is a valid Unix timestamp
 * @param timestamp - The timestamp to validate
 * @returns true if valid timestamp, false otherwise
 */
export function isValidTimestamp(timestamp: number): boolean {
  if (typeof timestamp !== 'number' || Number.isNaN(timestamp)) {
    return false
  }

  // Unix timestamp should be positive and reasonable (not too far in the future)
  const now = Math.floor(Date.now() / 1000)
  const maxFuture = now + 365 * 24 * 60 * 60 // 1 year in the future

  return timestamp > 0 && timestamp <= maxFuture
}
