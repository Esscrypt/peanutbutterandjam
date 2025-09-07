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
  bytesToHex,
  hexToBytes,
  type Safe,
  safeError,
  safeResult,
} from '@pbnj/core'
import type { DecodingResult, WorkDigest, WorkError } from '@pbnj/types'
import { decodeFixedLength, encodeFixedLength } from '../core/fixed-length'
import { decodeNatural, encodeNatural } from '../core/natural-number'

/**
 * Encode work digest according to Gray Paper specification.
 *
 * Gray Paper Equation 216-229 (label: encode{WD ∈ workdigest}):
 * encode{WD ∈ workdigest} ≡ encode{
 *   encode[4]{WD_serviceindex},
 *   WD_codehash,
 *   WD_payloadhash,
 *   encode[8]{WD_gaslimit},
 *   encodeResult{WD_result},
 *   WD_gasused,      // Variable length (natural encoding)
 *   WD_importcount,  // Variable length (natural encoding)
 *   WD_xtcount,      // Variable length (natural encoding)
 *   WD_xtsize,       // Variable length (natural encoding)
 *   WD_exportcount   // Variable length (natural encoding)
 * }
 *
 * Work digests are compact summaries of work item execution results.
 * They contain all information needed for consensus verification without
 * storing the full execution output data.
 *
 * Field encoding per Gray Paper:
 * 1. encode[4]{WD_serviceindex}: 4-byte fixed-length service identifier
 * 2. WD_codehash: 32-byte hash of executed code
 * 3. WD_payloadhash: 32-byte hash of input payload
 * 4. encode[8]{WD_gaslimit}: 8-byte fixed-length gas limit
 * 5. encodeResult{WD_result}: Variable-length result (blob or error)
 * 6. WD_gasused: Variable-length (natural) actual gas consumed
 * 7. WD_importcount: Variable-length (natural) number of imports
 * 8. WD_xtcount: Variable-length (natural) number of extrinsics
 * 9. WD_xtsize: Variable-length (natural) total extrinsic size
 * 10. WD_exportcount: Variable-length (natural) number of exports
 *
 * ✅ CORRECT: All 10 fields present in correct Gray Paper order
 * ✅ CORRECT: Uses encode[4] for serviceindex (4-byte fixed-length)
 * ✅ CORRECT: Uses encode[8] for gaslimit (8-byte fixed-length)
 * ✅ CORRECT: Uses variable-length encoding for counters (space efficient)
 * ✅ CORRECT: Uses raw hash encoding for 32-byte hash fields
 *
 * @param digest - Work digest to encode
 * @returns Encoded octet sequence
 */
export function encodeWorkDigest(digest: WorkDigest): Safe<Uint8Array> {
  const parts: Uint8Array[] = []

  // 1. encode[4]{WD_serviceindex} (4-byte fixed-length)
  const [error1, serviceIndexEncoded] = encodeFixedLength(
    BigInt(digest.serviceIndex),
    4n,
  )
  if (error1) {
    return safeError(error1)
  }
  parts.push(serviceIndexEncoded)

  // 2. WD_codehash (32-byte hash)
  parts.push(hexToBytes(digest.codeHash))

  // 3. WD_payloadhash (32-byte hash)
  parts.push(hexToBytes(digest.payloadHash))

  // 4. encode[8]{WD_gaslimit} (8-byte fixed-length)
  const [error2, gasLimitEncoded] = encodeFixedLength(
    BigInt(digest.gasLimit),
    8n,
  )
  if (error2) {
    return safeError(error2)
  }
  parts.push(gasLimitEncoded)

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
export function decodeWorkDigest(
  data: Uint8Array,
): Safe<DecodingResult<WorkDigest>> {
  // 1. encode[4]{WD_serviceindex} (4 bytes fixed-length) - Gray Paper compliant
  if (data.length < 4) {
    return safeError(
      new Error('[decodeWorkDigest] Insufficient data for service index'),
    )
  }
  const [error, serviceIndexResult] = decodeFixedLength(data, 4n)
  if (error) {
    return safeError(error)
  }
  const serviceIndex = serviceIndexResult.value
  data = serviceIndexResult.remaining

  // 2. WD_codehash (32 bytes) - Gray Paper compliant
  if (data.length < 32) {
    return safeError(
      new Error('[decodeWorkDigest] Insufficient data for code hash'),
    )
  }
  const codeHash = bytesToHex(data.slice(0, 32))
  data = data.slice(32)

  // 3. WD_payloadhash (32 bytes) - Gray Paper compliant
  if (data.length < 32) {
    return safeError(
      new Error('[decodeWorkDigest] Insufficient data for payload hash'),
    )
  }
  const payloadHash = bytesToHex(data.slice(0, 32))
  data = data.slice(32)

  // 4. encode[8]{WD_gaslimit} (8 bytes fixed-length) - Gray Paper compliant
  if (data.length < 8) {
    return safeError(
      new Error('[decodeWorkDigest] Insufficient data for gas limit'),
    )
  }
  const [error2, gasLimitResult] = decodeFixedLength(data, 8n)
  if (error2) {
    return safeError(error2)
  }
  const gasLimit = gasLimitResult.value
  data = gasLimitResult.remaining

  // 5. encodeResult{WD_result} (variable-length) - Gray Paper compliant
  if (data.length < 1) {
    return safeError(
      new Error('[decodeWorkDigest] Insufficient data for result length'),
    )
  }
  const [error3, resultLengthResult] = decodeNatural(data)
  if (error3) {
    return safeError(error3)
  }
  const resultLength = resultLengthResult.value
  data = resultLengthResult.remaining

  if (data.length < Number(resultLength)) {
    return safeError(
      new Error('[decodeWorkDigest] Insufficient data for result'),
    )
  }

  const resultBytes = data.slice(0, Number(resultLength))
  data = data.slice(Number(resultLength))

  // Try to decode as error string first (Gray Paper error discriminators)
  let result: Uint8Array | WorkError
  try {
    const resultString = new TextDecoder().decode(resultBytes)
    const knownErrors = [
      'oversize',
      'bad_exports',
      'invalid_result',
      'gas_limit_exceeded',
      'infinity',
      'panic',
      'bad',
      'big',
    ]
    if (knownErrors.includes(resultString)) {
      result = resultString as WorkError
    } else {
      result = resultBytes
    }
  } catch {
    result = resultBytes
  }

  // 6. WD_gasused (variable-length natural) - Gray Paper compliant
  if (data.length < 1) {
    return safeError(
      new Error('[decodeWorkDigest] Insufficient data for gas used'),
    )
  }
  const [error4, gasUsedResult] = decodeNatural(data)
  if (error4) {
    return safeError(error4)
  }
  const gasUsed = gasUsedResult.value
  data = gasUsedResult.remaining

  // 7. WD_importcount (variable-length natural) - Gray Paper compliant
  if (data.length < 1) {
    return safeError(
      new Error('[decodeWorkDigest] Insufficient data for import count'),
    )
  }
  const [error5, importCountResult] = decodeNatural(data)
  if (error5) {
    return safeError(error5)
  }
  const importCount = importCountResult.value
  data = importCountResult.remaining

  // 8. WD_xtcount (variable-length natural) - Gray Paper compliant
  if (data.length < 1) {
    return safeError(
      new Error('[decodeWorkDigest] Insufficient data for extrinsic count'),
    )
  }
  const [error6, extrinsicCountResult] = decodeNatural(data)
  if (error6) {
    return safeError(error6)
  }
  const extrinsicCount = extrinsicCountResult.value
  data = extrinsicCountResult.remaining

  // 9. WD_xtsize (variable-length natural) - Gray Paper compliant
  if (data.length < 1) {
    return safeError(
      new Error('[decodeWorkDigest] Insufficient data for extrinsic size'),
    )
  }
  const [error7, extrinsicSizeResult] = decodeNatural(data)
  if (error7) {
    return safeError(error7)
  }
  const extrinsicSize = extrinsicSizeResult.value
  data = extrinsicSizeResult.remaining

  // 10. WD_exportcount (variable-length natural) - Gray Paper compliant
  if (data.length < 1) {
    return safeError(
      new Error('[decodeWorkDigest] Insufficient data for export count'),
    )
  }
  const [error8, exportCountResult] = decodeNatural(data)
  if (error8) {
    return safeError(error8)
  }
  const exportCount = exportCountResult.value
  data = exportCountResult.remaining

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
    remaining: data,
  })
}
