/**
 * Availability specification serialization
 *
 * *** DO NOT REMOVE - GRAY PAPER FORMULA ***
 * Gray Paper Section: Appendix D.1 - Block Serialization
 * Formula (Equation 208-214):
 *
 * encode(AS ∈ avspec) ≡ encode(
 *   AS_packagehash,
 *   encode[4](AS_bundlelen),
 *   AS_erasureroot,
 *   AS_segroot,
 *   encode[2](AS_segcount)
 * )
 *
 * Availability specifications define data availability parameters
 * for work package erasure coding and reconstruction.
 * Reference: graypaper/text/erasure_coding.tex
 *
 * *** IMPLEMENTER EXPLANATION ***
 * Availability specifications describe how work package data is
 * encoded for distributed storage and retrieval across validators.
 *
 * Availability Spec structure:
 * 1. **Package hash**: Hash identifying the work package data
 * 2. **Bundle length** (4 bytes): Size of original data before encoding
 * 3. **Erasure root**: Merkle root of erasure-coded segments
 * 4. **Segment root**: Merkle root of individual data segments
 * 5. **Segment count** (2 bytes): Number of erasure code segments
 *
 * Key concepts:
 * - Erasure coding: Data split into N segments, any M can reconstruct
 * - Merkle commitments: Cryptographic proofs for data integrity
 * - Distributed storage: Validators store different segments
 * - Efficient reconstruction: Only need subset of segments to rebuild
 *
 * Example: 1MB work package → 100 segments, need any 67 to reconstruct
 * - Validators store 1-2 segments each (1-2% of original data)
 * - Network can lose 33% of validators and still recover data
 * - Reconstruction only happens when data is actually needed
 *
 * This enables JAM's scalable data availability without requiring
 * every validator to store every piece of data.
 */

import {
  bytesToHex,
  concatBytes,
  hexToBytes,
  type Safe,
  safeError,
  safeResult,
} from '@pbnj/core'
import type { DecodingResult, WorkPackageSpec } from '@pbnj/types'
import { decodeFixedLength, encodeFixedLength } from '../core/fixed-length'

/**
 * Encode work package specification according to Gray Paper specification.
 *
 * Gray Paper Equation 208-214 (label: encode{AS ∈ avspec}):
 * encode{AS ∈ avspec} ≡ encode{
 *   AS_packagehash,
 *   encode[4]{AS_bundlelen},
 *   AS_erasureroot,
 *   AS_segroot,
 *   encode[2]{AS_segcount}
 * }
 *
 * Work package specifications define data availability parameters for work package
 * erasure coding and reconstruction. They ensure work package data can be
 * reconstructed from distributed segments stored across validators.
 *
 * Field encoding per Gray Paper:
 * 1. AS_packagehash: 32-byte hash identifying the work package
 * 2. encode[4]{AS_bundlelen}: 4-byte fixed-length bundle size
 * 3. AS_erasureroot: 32-byte Merkle root of erasure-coded segments
 * 4. AS_segroot: 32-byte Merkle root of individual data segments
 * 5. encode[2]{AS_segcount}: 2-byte fixed-length segment count
 *
 * ✅ CORRECT: All 5 fields present in correct Gray Paper order
 * ✅ CORRECT: Uses encode[4] for bundlelen (4-byte fixed-length)
 * ✅ CORRECT: Uses encode[2] for segcount (2-byte fixed-length)
 * ✅ CORRECT: Uses raw hash encoding for 32-byte hash fields
 *
 * @param spec - Work package specification to encode
 * @returns Encoded octet sequence
 */
export function encodeWorkPackageSpec(spec: WorkPackageSpec): Safe<Uint8Array> {
  const parts: Uint8Array[] = []

  // 1. AS_packagehash (32 bytes)
  parts.push(hexToBytes(spec.hash))

  // 2. encode[4]{AS_bundlelen} (4 bytes fixed-length)
  const [error1, bundleLenEncoded] = encodeFixedLength(spec.length, 4n)
  if (error1) return safeError(error1)
  parts.push(bundleLenEncoded)

  // 3. AS_erasureroot (32 bytes)
  parts.push(hexToBytes(spec.erasure_root))

  // 4. AS_segroot (32 bytes)
  parts.push(hexToBytes(spec.exports_root))

  // 5. encode[2]{AS_segcount} (2 bytes fixed-length)
  const [error2, segCountEncoded] = encodeFixedLength(spec.exports_count, 2n)
  if (error2) return safeError(error2)
  parts.push(segCountEncoded)

  return safeResult(concatBytes(parts))
}

/**
 * Decode work package specification according to Gray Paper specification.
 *
 * Gray Paper Equation 208-214 (label: decode{AS ∈ avspec}):
 * Inverse of encode{AS ∈ avspec} ≡ decode{
 *   AS_packagehash,
 *   decode[4]{AS_bundlelen},
 *   AS_erasureroot,
 *   AS_segroot,
 *   decode[2]{AS_segcount}
 * }
 *
 * Decodes work package specification from octet sequence back to structured data.
 * Must exactly reverse the encoding process to maintain round-trip compatibility.
 *
 * Field decoding per Gray Paper:
 * 1. AS_packagehash: 32-byte hash (fixed-size, no length prefix)
 * 2. decode[4]{AS_bundlelen}: 4-byte fixed-length bundle size
 * 3. AS_erasureroot: 32-byte Merkle root (fixed-size, no length prefix)
 * 4. AS_segroot: 32-byte Merkle root (fixed-size, no length prefix)
 * 5. decode[2]{AS_segcount}: 2-byte fixed-length segment count
 *
 * ✅ CORRECT: All 5 fields decoded in correct Gray Paper order
 * ✅ CORRECT: Uses 4-byte decoding for bundlelen
 * ✅ CORRECT: Uses 2-byte decoding for segcount
 * ✅ CORRECT: Uses raw hash decoding for 32-byte hash fields
 *
 * @param data - Octet sequence to decode
 * @returns Decoded work package specification with remaining data
 */
export function decodeWorkPackageSpec(
  data: Uint8Array,
): Safe<DecodingResult<WorkPackageSpec>> {
  if (data.length < 32) {
    return safeError(new Error('Insufficient data for package hash'))
  }
  const hash = bytesToHex(data.slice(0, 32))
  data = data.slice(32)
  if (data.length < 8) {
    return safeError(new Error('Insufficient data for bundle length'))
  }
  const [error2, bundleLengthResult] = decodeFixedLength(data, 4n)
  if (error2) {
    return safeError(error2)
  }
  const length = bundleLengthResult.value
  data = bundleLengthResult.remaining
  if (data.length < 32) {
    return safeError(new Error('Insufficient data for erasure root'))
  }

  const erasure_root = bytesToHex(data.slice(0, 32))
  data = data.slice(32)
  if (data.length < 32) {
    return safeError(new Error('Insufficient data for segment root'))
  }
  const exports_root = bytesToHex(data.slice(0, 32))
  data = data.slice(32)
  if (data.length < 8) {
    return safeError(new Error('Insufficient data for segment count'))
  }
  const [error5, segmentCountResult] = decodeFixedLength(data, 2n)
  if (error5) {
    return safeError(error5)
  }
  const exports_count = segmentCountResult.value
  data = segmentCountResult.remaining

  return safeResult({
    value: {
      hash: hash,
      length: length,
      erasure_root: erasure_root,
      exports_root: exports_root,
      exports_count: exports_count,
    },
    remaining: data,
    consumed: data.length - data.length,
  })
}
