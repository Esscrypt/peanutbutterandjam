/**
 * Work digest serialization
 *
 * *** DO NOT REMOVE - GRAY PAPER FORMULA ***
 * Gray Paper Section: Appendix D.1 - Block Serialization
 * Formula (Equation 216-229):
 *
 * encode(WD ∈ workdigest) ≡ encode(
 *   encode[4](WD_serviceindex),
 *   WD_codehash,
 *   WD_payloadhash,
 *   encode[8](WD_gaslimit),
 *   encodeResult(WD_result),
 *   WD_gasused,      // Variable length for space efficiency
 *   WD_importcount,  // Variable length for space efficiency
 *   WD_xtcount,      // Variable length for space efficiency
 *   WD_xtsize,       // Variable length for space efficiency
 *   WD_exportcount   // Variable length for space efficiency
 * )
 *
 * Work digests provide compact summaries of work item execution results.
 * Some fields use variable-length encoding for space efficiency.
 *
 * *** IMPLEMENTER EXPLANATION ***
 * Work digests are compact summaries that allow validators to verify
 * work item results without storing or transmitting the full output data.
 *
 * Work Digest structure:
 * 1. **Service index** (4 bytes): Which service executed this work item
 * 2. **Code hash**: Hash of the code that was executed
 * 3. **Payload hash**: Hash of the input data
 * 4. **Gas limit** (8 bytes): Maximum gas this item was allowed to use
 * 5. **Result**: Either success data or error code (see encodeResult)
 * 6. **Gas used** (variable): Actual gas consumed during execution
 * 7. **Import count** (variable): Number of imports this item used
 * 8. **Extrinsic count** (variable): Number of extrinsics referenced
 * 9. **Extrinsic size** (variable): Total size of extrinsic data
 * 10. **Export count** (variable): Number of exports this item produced
 *
 * Space optimization:
 * - Fixed fields use exact sizes (4/8 bytes for indices/limits)
 * - Counters use variable-length encoding (often small numbers)
 * - This saves significant space when most items use small values
 *
 * Digests enable efficient work report validation and compact storage
 * while preserving all information needed for consensus verification.
 */

import {
  bytesToBigInt,
  bytesToHex,
  hexToBytes,
  type Safe,
  safeError,
  safeResult,
} from '@pbnj/core'
import type { WorkDigest, WorkError, WorkResult } from '@pbnj/types'
import { encodeNatural } from '../core/natural-number'

/**
 * Encode work digest
 *
 * @param digest - Work digest to encode
 * @returns Encoded octet sequence
 */
export function encodeWorkDigest(digest: WorkDigest): Safe<Uint8Array> {
  const parts: Uint8Array[] = []

  // Service index (8 Uint8Array)
  const [error, encoded] = encodeNatural(BigInt(digest.serviceIndex))
  if (error) {
    return safeError(error)
  }
  parts.push(encoded)

  // Code hash (32 Uint8Array)
  parts.push(hexToBytes(digest.codeHash as `0x${string}`))

  // Payload hash (32 Uint8Array)
  parts.push(hexToBytes(digest.payloadHash as `0x${string}`))

  // Gas limit (8 Uint8Array)
  const [error2, encoded2] = encodeNatural(BigInt(digest.gasLimit))
  if (error2) {
    return safeError(error2)
  }
  parts.push(encoded2)

  // Result (variable length)
  if (typeof digest.result === 'string') {
    // Error result
    const errorUint8Array = new TextEncoder().encode(digest.result)
    const [error3, encoded3] = encodeNatural(BigInt(errorUint8Array.length))
    if (error3) {
      return safeError(error3)
    }
    parts.push(encoded3)
    parts.push(errorUint8Array)
  } else {
    // Success result (octet sequence)
    const [error4, encoded4] = encodeNatural(BigInt(digest.result.length))
    if (error4) {
      return safeError(error4)
    }
    parts.push(encoded4)
    parts.push(digest.result)
  }

  // Gas used (8 Uint8Array)
  const [error5, encoded5] = encodeNatural(BigInt(digest.gasUsed))
  if (error5) {
    return safeError(error5)
  }
  parts.push(encoded5)

  // Import count (8 Uint8Array)
  const [error6, encoded6] = encodeNatural(BigInt(digest.importCount))
  if (error6) {
    return safeError(error6)
  }
  parts.push(encoded6)

  // Extrinsic count (8 Uint8Array)
  const [error7, encoded7] = encodeNatural(BigInt(digest.extrinsicCount))
  if (error7) {
    return safeError(error7)
  }
  parts.push(encoded7)

  // Extrinsic size (8 Uint8Array)
  const [error8, encoded8] = encodeNatural(BigInt(digest.extrinsicSize))
  if (error8) {
    return safeError(error8)
  }
  parts.push(encoded8)

  // Export count (8 Uint8Array)
  const [error9, encoded9] = encodeNatural(BigInt(digest.exportCount))
  if (error9) {
    return safeError(error9)
  }
  parts.push(encoded9)

  // Concatenate all parts
  const totalLength = parts.reduce((sum, part) => sum + part.length, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0

  for (const part of parts) {
    result.set(part, offset)
    offset += part.length
  }

  return safeResult(result)
}

/**
 * Decode work digest
 *
 * @param data - Octet sequence to decode
 * @returns Decoded work digest and remaining data
 */
export function decodeWorkDigest(data: Uint8Array): Safe<{
  value: WorkDigest
  remaining: Uint8Array
}> {
  let currentData = data

  // Service index (8 Uint8Array)
  const serviceIndex = bytesToBigInt(currentData.slice(0, 8))
  currentData = currentData.slice(8)

  // Code hash (32 Uint8Array)
  const codeHash = bytesToHex(currentData.slice(0, 32))
  currentData = currentData.slice(32)

  // Payload hash (32 Uint8Array)
  const payloadHash = bytesToHex(currentData.slice(0, 32))
  currentData = currentData.slice(32)

  // Gas limit (8 Uint8Array)
  const gasLimit = bytesToBigInt(currentData.slice(0, 8))
  currentData = currentData.slice(8)

  // Result (variable length)
  const resultLength = bytesToBigInt(currentData.slice(0, 8))
  currentData = currentData.slice(8)

  const resultData = currentData.slice(0, Number(resultLength))
  currentData = currentData.slice(Number(resultLength))

  // Try to decode as string first (error), fallback to Uint8Array (success)
  let result: WorkResult
  try {
    const resultString = new TextDecoder().decode(resultData)
    if (
      ['infinity', 'panic', 'bad_exports', 'oversize', 'bad', 'big'].includes(
        resultString,
      )
    ) {
      result = resultString as WorkError
    } else {
      result = resultData
    }
  } catch {
    result = resultData
  }

  // Gas used (8 Uint8Array)
  const gasUsed = bytesToBigInt(currentData.slice(0, 8))
  currentData = currentData.slice(8)

  // Import count (8 Uint8Array)
  const importCount = bytesToBigInt(currentData.slice(0, 8))
  currentData = currentData.slice(8)

  // Extrinsic count (8 Uint8Array)
  const extrinsicCount = bytesToBigInt(currentData.slice(0, 8))
  currentData = currentData.slice(8)

  // Extrinsic size (8 Uint8Array)
  const extrinsicSize = bytesToBigInt(currentData.slice(0, 8))
  currentData = currentData.slice(8)

  // Export count (8 Uint8Array)
  const exportCount = bytesToBigInt(currentData.slice(0, 8))
  currentData = currentData.slice(8)

  return safeResult({
    value: {
      serviceIndex,
      codeHash,
      payloadHash,
      gasLimit,
      result,
      gasUsed,
      importCount,
      extrinsicCount,
      extrinsicSize,
      exportCount,
    },
    remaining: currentData,
  })
}
