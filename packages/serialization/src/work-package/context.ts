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

import {
  bytesToHex,
  concatBytes,
  type Hex,
  hexToBytes,
  type Safe,
  safeError,
  safeResult,
} from '@pbnj/core'
import type { DecodingResult, RefineContext } from '@pbnj/types'
import { decodeFixedLength, encodeFixedLength } from '../core/fixed-length'
import { decodeNatural, encodeNatural } from '../core/natural-number'

/**
 * Encode refine context according to Gray Paper specification.
 *
 * Gray Paper Equation 199-206 (label: encode{WC ∈ workcontext}):
 * encode{WC ∈ workcontext} ≡ encode{
 *   WC_anchorhash,
 *   WC_anchorpoststate,
 *   WC_anchoraccoutlog,
 *   WC_lookupanchorhash,
 *   encode[4]{WC_lookupanchortime},
 *   var{WC_prerequisites}
 * }
 *
 * Refine context describes the context of the chain at the point that the
 * report's corresponding work-package was evaluated. It identifies two
 * historical blocks (anchor and lookup-anchor) and any prerequisite work-packages.
 *
 * Field encoding per Gray Paper:
 * 1. WC_anchorhash: 32-byte hash - anchor block header hash
 * 2. WC_anchorpoststate: 32-byte hash - anchor block posterior state-root
 * 3. WC_anchoraccoutlog: 32-byte hash - anchor block accumulation output log super-peak
 * 4. WC_lookupanchorhash: 32-byte hash - lookup-anchor block header hash
 * 5. encode[4]{WC_lookupanchortime}: 4-byte fixed-length - lookup-anchor block timeslot
 * 6. var{WC_prerequisites}: variable-length sequence - hash of prerequisite work-packages
 *
 * ✅ CORRECT: All 6 fields present in correct Gray Paper order
 * ✅ CORRECT: Hash fields use raw 32-byte encoding
 * ✅ CORRECT: Uses encode[4] for lookupanchortime (4-byte fixed-length)
 * ✅ CORRECT: Uses var{} for prerequisites (variable-length with prefix)
 * ❌ INCOMPLETE: Prerequisites encoding needs full implementation
 */
export function encodeRefineContext(context: RefineContext): Safe<Uint8Array> {
  const parts: Uint8Array[] = []

  // Anchor (32 bytes)
  parts.push(hexToBytes(context.anchor))

  // State root (32 bytes)
  parts.push(hexToBytes(context.state_root))

  // Beefy root (32 bytes)
  parts.push(hexToBytes(context.beefy_root))

  // Lookup anchor (32 bytes)
  parts.push(hexToBytes(context.lookup_anchor))

  // Lookup anchor slot - encode[4]{lookupanchortime} (Gray Paper compliant)
  const [error, encoded] = encodeFixedLength(context.lookup_anchor_slot, 4n)
  if (error) {
    return safeError(error)
  }
  parts.push(encoded)

  // Prerequisites (variable length) - var{WC_prerequisites}
  const [error2, lengthEncoded] = encodeNatural(
    BigInt(context.prerequisites.length),
  )
  if (error2) {
    return safeError(error2)
  }
  parts.push(lengthEncoded) // Length prefix

  // Encode each prerequisite as 32-byte hash
  for (const prerequisite of context.prerequisites) {
    parts.push(hexToBytes(prerequisite))
  }

  return safeResult(concatBytes(parts))
}

/**
 * Decode refine context according to Gray Paper specification.
 *
 * Gray Paper Equation 199-206 (label: decode{WC ∈ workcontext}):
 * Inverse of encode{WC ∈ workcontext} ≡ decode{
 *   WC_anchorhash,
 *   WC_anchorpoststate,
 *   WC_anchoraccoutlog,
 *   WC_lookupanchorhash,
 *   decode[4]{WC_lookupanchortime},
 *   var{WC_prerequisites}
 * }
 *
 * Decodes refine context from octet sequence back to structured data.
 * Must exactly reverse the encoding process to maintain round-trip compatibility.
 *
 * Field decoding per Gray Paper:
 * 1. WC_anchorhash: 32-byte hash - anchor block header hash
 * 2. WC_anchorpoststate: 32-byte hash - anchor block posterior state-root
 * 3. WC_anchoraccoutlog: 32-byte hash - anchor block accumulation output log super-peak
 * 4. WC_lookupanchorhash: 32-byte hash - lookup-anchor block header hash
 * 5. decode[4]{WC_lookupanchortime}: 4-byte fixed-length - lookup-anchor block timeslot
 * 6. var{WC_prerequisites}: variable-length sequence - hash of prerequisite work-packages
 *
 * ✅ CORRECT: All 6 fields decoded in correct Gray Paper order
 * ✅ CORRECT: Hash fields use raw 32-byte decoding
 * ✅ CORRECT: Uses decode[4] for lookupanchortime (4-byte fixed-length)
 * ✅ CORRECT: Uses var{} for prerequisites (variable-length with prefix)
 */
export function decodeRefineContext(
  data: Uint8Array,
): Safe<DecodingResult<RefineContext>> {
  let currentData = data

  // Anchor hash (32 bytes)
  if (currentData.length < 32) {
    return safeError(new Error('Insufficient data for anchor hash'))
  }
  const anchor = bytesToHex(currentData.slice(0, 32))
  currentData = currentData.slice(32)

  // State root (32 bytes)
  if (currentData.length < 32) {
    return safeError(new Error('Insufficient data for state root'))
  }
  const state_root = bytesToHex(currentData.slice(0, 32))
  currentData = currentData.slice(32)

  // Beefy root (32 bytes)
  if (currentData.length < 32) {
    return safeError(new Error('Insufficient data for beefy root'))
  }
  const beefy_root = bytesToHex(currentData.slice(0, 32))
  currentData = currentData.slice(32)

  // Lookup anchor hash (32 bytes)
  if (currentData.length < 32) {
    return safeError(new Error('Insufficient data for lookup anchor hash'))
  }
  const lookup_anchor = bytesToHex(currentData.slice(0, 32))
  currentData = currentData.slice(32)

  // Lookup anchor slot - decode[4]{lookupanchortime} (4-byte fixed-length)
  if (currentData.length < 4) {
    return safeError(new Error('Insufficient data for lookup anchor slot'))
  }
  const [error, slotResult] = decodeFixedLength(currentData, 4n)
  if (error) {
    return safeError(error)
  }
  const lookup_anchor_slot = slotResult.value
  currentData = slotResult.remaining

  // Prerequisites (variable length) - var{WC_prerequisites}
  const [error2, prerequisitesLengthResult] = decodeNatural(currentData)
  if (error2) {
    return safeError(error2)
  }
  const prerequisitesLength = prerequisitesLengthResult.value
  currentData = prerequisitesLengthResult.remaining

  const prerequisites: Hex[] = []
  for (let i = 0; i < Number(prerequisitesLength); i++) {
    if (currentData.length < 32) {
      return safeError(new Error(`Insufficient data for prerequisite ${i}`))
    }
    const prerequisite = bytesToHex(currentData.slice(0, 32))
    currentData = currentData.slice(32)
    prerequisites.push(prerequisite)
  }

  return safeResult({
    value: {
      anchor,
      state_root,
      beefy_root,
      lookup_anchor,
      lookup_anchor_slot,
      prerequisites,
    },
    remaining: currentData,
    consumed: data.length - currentData.length,
  })
}
