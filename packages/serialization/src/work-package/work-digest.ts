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

import { bytesToHex, hexToBytes } from '@pbnj/core'
import type {
  WorkDigest,
  SerializationWorkError as WorkError,
  WorkResult,
} from '@pbnj/types'
import { encodeNatural } from '../core/natural-number'

/**
 * Encode work digest
 *
 * @param digest - Work digest to encode
 * @returns Encoded octet sequence
 */
export function encodeWorkDigest(digest: WorkDigest): Uint8Array {
  const parts: Uint8Array[] = []

  // Service index (8 Uint8Array)
  parts.push(encodeNatural(BigInt(digest.serviceIndex)))

  // Code hash (32 Uint8Array)
  parts.push(hexToBytes(digest.codeHash as `0x${string}`))

  // Payload hash (32 Uint8Array)
  parts.push(hexToBytes(digest.payloadHash as `0x${string}`))

  // Gas limit (8 Uint8Array)
  parts.push(encodeNatural(BigInt(digest.gasLimit)))

  // Result (variable length)
  if (typeof digest.result === 'string') {
    // Error result
    const errorUint8Array = new TextEncoder().encode(digest.result)
    const lengthEncoded = encodeNatural(BigInt(errorUint8Array.length))
    parts.push(lengthEncoded)
    parts.push(errorUint8Array)
  } else {
    // Success result (octet sequence)
    const lengthEncoded = encodeNatural(BigInt(digest.result.length))
    parts.push(lengthEncoded)
    parts.push(digest.result)
  }

  // Gas used (8 Uint8Array)
  parts.push(encodeNatural(BigInt(digest.gasUsed)))

  // Import count (8 Uint8Array)
  parts.push(encodeNatural(BigInt(digest.importCount)))

  // Extrinsic count (8 Uint8Array)
  parts.push(encodeNatural(BigInt(digest.extrinsicCount)))

  // Extrinsic size (8 Uint8Array)
  parts.push(encodeNatural(BigInt(digest.extrinsicSize)))

  // Export count (8 Uint8Array)
  parts.push(encodeNatural(BigInt(digest.exportCount)))

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
 * Decode work digest
 *
 * @param data - Octet sequence to decode
 * @returns Decoded work digest and remaining data
 */
export function decodeWorkDigest(data: Uint8Array): {
  value: WorkDigest
  remaining: Uint8Array
} {
  let currentData = data

  // Service index (8 Uint8Array)
  const serviceIndex = BigInt(
    `0x${Array.from(currentData.slice(0, 8))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')}`,
  )
  currentData = currentData.slice(8)

  // Code hash (32 Uint8Array)
  const codeHash = bytesToHex(currentData.slice(0, 32))
  currentData = currentData.slice(32)

  // Payload hash (32 Uint8Array)
  const payloadHash = bytesToHex(currentData.slice(0, 32))
  currentData = currentData.slice(32)

  // Gas limit (8 Uint8Array)
  const gasLimit = BigInt(
    `0x${Array.from(currentData.slice(0, 8))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')}`,
  )
  currentData = currentData.slice(8)

  // Result (variable length)
  const resultLength = BigInt(
    `0x${Array.from(currentData.slice(0, 8))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')}`,
  )
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
  const gasUsed = BigInt(
    `0x${Array.from(currentData.slice(0, 8))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')}`,
  )
  currentData = currentData.slice(8)

  // Import count (8 Uint8Array)
  const importCount = BigInt(
    `0x${Array.from(currentData.slice(0, 8))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')}`,
  )
  currentData = currentData.slice(8)

  // Extrinsic count (8 Uint8Array)
  const extrinsicCount = BigInt(
    `0x${Array.from(currentData.slice(0, 8))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')}`,
  )
  currentData = currentData.slice(8)

  // Extrinsic size (8 Uint8Array)
  const extrinsicSize = BigInt(
    `0x${Array.from(currentData.slice(0, 8))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')}`,
  )
  currentData = currentData.slice(8)

  // Export count (8 Uint8Array)
  const exportCount = BigInt(
    `0x${Array.from(currentData.slice(0, 8))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')}`,
  )
  currentData = currentData.slice(8)

  return {
    value: {
      serviceIndex: Number(serviceIndex),
      codeHash,
      payloadHash,
      gasLimit: Number(gasLimit),
      result,
      gasUsed: Number(gasUsed),
      importCount: Number(importCount),
      extrinsicCount: Number(extrinsicCount),
      extrinsicSize: Number(extrinsicSize),
      exportCount: Number(exportCount),
    },
    remaining: currentData,
  }
}
