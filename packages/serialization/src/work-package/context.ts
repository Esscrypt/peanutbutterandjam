/**
 * Work context serialization
 *
 * *** DO NOT REMOVE - GRAY PAPER FORMULA ***
 * Gray Paper Section: Appendix D.1 - Block Serialization
 * Formula (Equation 199-206):
 *
 * encode(WC ∈ workcontext) ≡ encode(
 *   WC_anchorhash,
 *   WC_anchorpoststate,
 *   WC_anchoraccoutlog,
 *   WC_lookupanchorhash,
 *   encode[4](WC_lookupanchortime),
 *   var{WC_prerequisites}
 * )
 *
 * Work context provides the execution environment and dependencies
 * for work package processing.
 *
 * *** IMPLEMENTER EXPLANATION ***
 * Work context defines the execution environment for work packages.
 * It provides all the blockchain state and dependency information
 * needed for deterministic computation.
 *
 * Work Context structure:
 * 1. **Anchor hash**: Hash of the anchor block (recent finalized block)
 * 2. **Anchor post-state**: State root after anchor block execution
 * 3. **Anchor account log**: Hash of account changes at anchor
 * 4. **Lookup anchor hash**: Hash of block used for state lookups
 * 5. **Lookup anchor time** (4 bytes): When lookup anchor was created
 * 6. **Prerequisites** (variable): List of work package dependencies
 *
 * Key concepts:
 * - Anchor blocks: Recent finalized blocks providing stable state
 * - State separation: Execution state vs lookup state for efficiency
 * - Dependencies: Prerequisites ensure proper execution ordering
 * - Deterministic time: Fixed time reference prevents non-determinism
 *
 * This context ensures that work package execution is:
 * - Deterministic: Same context → same results
 * - Consistent: All validators use same state references
 * - Efficient: State lookups reference specific known blocks
 */

import { bytesToHex, hexToBytes } from '@pbnj/core'
import type { WorkContext } from '@pbnj/types'
import { encodeNatural } from '../core/natural-number'

/**
 * Encode work context
 *
 * @param context - Work context to encode
 * @returns Encoded octet sequence
 */
export function encodeWorkContext(context: WorkContext): Uint8Array {
  const parts: Uint8Array[] = []

  // Anchor (32 bytes)
  parts.push(hexToBytes(context.anchorhash))

  // State root (32 bytes)
  parts.push(hexToBytes(context.anchorpoststate))

  // Beefy root (32 bytes)
  parts.push(hexToBytes(context.anchoraccoutlog))

  // Lookup anchor (32 bytes)
  parts.push(hexToBytes(context.lookupanchorhash))

  // Lookup anchor slot (8 bytes)
  parts.push(encodeNatural(BigInt(context.lookupanchortime)))

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

  // Anchor (32 bytes)
  const anchor = bytesToHex(remaining.slice(0, 32))
  remaining = remaining.slice(32)

  // State root (32 bytes)
  const stateRoot = bytesToHex(remaining.slice(0, 32))
  remaining = remaining.slice(32)

  // Beefy root (32 bytes)
  const beefyRoot = bytesToHex(remaining.slice(0, 32))
  remaining = remaining.slice(32)

  // Lookup anchor (32 bytes)
  const lookupAnchor = bytesToHex(remaining.slice(0, 32))
  remaining = remaining.slice(32)

  // Lookup anchor slot (8 bytes)
  const lookupAnchorSlot = Number(
    BigInt(
      `0x${Array.from(remaining.slice(0, 8))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')}`,
    ),
  )
  remaining = remaining.slice(8)

  // Prerequisites (variable length)
  const prerequisitesLength = BigInt(
    `0x${Array.from(remaining.slice(0, 8))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')}`,
  )
  remaining = remaining.slice(8)
  // Parse prerequisites (not currently used in return object)
  remaining = remaining.slice(Number(prerequisitesLength))

  return {
    value: {
      anchorhash: anchor,
      anchorpoststate: stateRoot,
      anchoraccoutlog: beefyRoot,
      lookupanchorhash: lookupAnchor,
      lookupanchortime: Number(lookupAnchorSlot),
      prerequisites: [], // Simplified - not handling complex prerequisites yet
    },
    remaining,
  }
}
