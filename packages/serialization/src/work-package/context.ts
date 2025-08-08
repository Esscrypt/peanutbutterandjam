/**
 * Work context serialization
 *
 * Implements Gray Paper work context serialization
 * Reference: graypaper/text/work_context.tex
 */

import { bytesToHex, hexToBytes } from '@pbnj/core'
import { encodeNatural } from '../core/natural-number'
import type { WorkContext } from '@pbnj/types'



/**
 * Encode work context
 *
 * @param context - Work context to encode
 * @returns Encoded octet sequence
 */
export function encodeWorkContext(context: WorkContext): Uint8Array {
  const parts: Uint8Array[] = []

  // Anchor (32 bytes)
  parts.push(hexToBytes(context.anchor))

  // State root (32 bytes)
  parts.push(hexToBytes(context.state_root))

  // Beefy root (32 bytes)
  parts.push(hexToBytes(context.beefy_root))

  // Lookup anchor (32 bytes)
  parts.push(hexToBytes(context.lookup_anchor))

  // Lookup anchor slot (8 bytes)
  parts.push(encodeNatural(BigInt(context.lookup_anchor_slot)))

  // Prerequisites (variable length)
  parts.push(encodeNatural(BigInt(context.prerequisites.length))) // Length prefix
  // For now, handle prerequisites as empty array - this needs proper implementation
  if (context.prerequisites.length > 0) {
    throw new Error('Prerequisites not yet implemented')
  }

  // Concatenate all parts
  const totalLength = parts.reduce((sum, part) => sum + part.length, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0

  for (const part of parts) {
    result.set(part, offset)
    offset += part.length
  }

  return result
}

/**
 * Decode work context
 *
 * @param data - Octet sequence to decode
 * @returns Decoded work context and remaining data
 */
export function decodeWorkContext(data: Uint8Array): {
  value: WorkContext
  remaining: Uint8Array
} {
  let remaining = data

  // Anchor hash (32 Uint8Array)
  const anchorHash = bytesToHex(remaining.slice(0, 32))
  remaining = remaining.slice(32)

  // Anchor post state (32 Uint8Array)
  const anchorPostState = bytesToHex(remaining.slice(0, 32))
  remaining = remaining.slice(32)

  // Anchor account log (32 Uint8Array)
  const anchorAccountLog = remaining.slice(0, 32)
  remaining = remaining.slice(32)

  // Lookup anchor hash (32 Uint8Array)
  const lookupAnchorHash = bytesToHex(remaining.slice(0, 32))
  remaining = remaining.slice(32)

  // Lookup anchor time (8 Uint8Array)
  const lookupAnchorTime = BigInt(
    `0x${Array.from(remaining.slice(0, 8))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')}`,
  )
  remaining = remaining.slice(8)

  // Prerequisites (variable length)
  const prerequisitesLength = BigInt(
    `0x${Array.from(remaining.slice(0, 8))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')}`,
  )
  remaining = remaining.slice(8)
  const prerequisites = remaining.slice(0, Number(prerequisitesLength))
  remaining = remaining.slice(Number(prerequisitesLength))

  return {
    value: {
      anchorHash,
      anchorPostState,
      anchorAccountLog,
      lookupAnchorHash,
      lookupAnchorTime,
      prerequisites,
    },
    remaining,
  }
}
