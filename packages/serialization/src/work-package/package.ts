/**
 * Work package serialization
 *
 * *** DO NOT REMOVE - GRAY PAPER FORMULA ***
 * Gray Paper Section: Appendix D.1 - Block Serialization
 * Formula (Equation 242-264):
 *
 * encode(WP ∈ workpackage) ≡ encode(
 *   encode[4](WP_authcodehost),
 *   WP_authcodehash,
 *   WP_context,
 *   var{WP_authtoken},
 *   var{WP_authconfig},
 *   var{WP_workitems}
 * )
 *
 * encode(WI ∈ workitem) ≡ encode(
 *   encode[4](WI_serviceindex),
 *   WI_codehash,
 *   encode[8](WI_refgaslimit),
 *   encode[8](WI_accgaslimit),
 *   encode[2](WI_exportcount),
 *   var{WI_payload},
 *   var{encodeImportRefs(WI_importsegments)},
 *   var{⟨⟨h, encode[4](i)⟩ | ⟨h, i⟩ ∈ WI_extrinsics⟩}
 * )
 *
 * Work packages define computation tasks and their execution context.
 *
 * *** IMPLEMENTER EXPLANATION ***
 * Work packages are JAM's fundamental units of computation. They specify
 * what computation to perform and provide all necessary context and data.
 *
 * Work Package structure:
 * 1. **Auth code host** (4 bytes): Service hosting authorization logic
 * 2. **Auth code hash**: Hash of authorization code to execute
 * 3. **Context**: Execution environment (state roots, time, prerequisites)
 * 4. **Auth token** (variable): Authorization-specific data/proof
 * 5. **Auth config** (variable): Configuration for authorization
 * 6. **Work items** (variable): List of actual computation tasks
 *
 * Work Item structure (nested):
 * 1. **Service index** (4 bytes): Which service executes this item
 * 2. **Code hash**: Hash of code to execute
 * 3. **Refine gas limit** (8 bytes): Gas limit for refine phase
 * 4. **Accumulate gas limit** (8 bytes): Gas limit for accumulate phase
 * 5. **Export count** (2 bytes): Number of exports this item produces
 * 6. **Payload** (variable): Input data for the computation
 * 7. **Import segments** (variable): References to data from other items
 * 8. **Extrinsics** (variable): External data references
 *
 * This structure enables complex, multi-step computations while maintaining
 * deterministic gas accounting and data flow dependencies.
 */

import {
  bytesToHex,
  concatBytes,
  hexToBytes,
  type Safe,
  safeError,
  safeResult,
} from '@pbnj/core'
import type {
  DecodingResult,
  ExtrinsicReference,
  WorkItem,
  WorkPackage,
} from '@pbnj/types'
import { decodeFixedLength, encodeFixedLength } from '../core/fixed-length'
import { decodeNatural, encodeNatural } from '../core/natural-number'
import {
  decodeImportReference,
  encodeImportReference,
} from '../pvm/import-reference'
import { decodeRefineContext, encodeRefineContext } from './context'
/**
 * Encode work item according to Gray Paper specification.
 *
 * Gray Paper formula: encode{WI} = encode{
 *   encode[4]{WI_serviceindex}, WI_codehash, encode[8]{WI_refgaslimit},
 *   encode[8]{WI_accgaslimit}, encode[2]{WI_exportcount}, var{WI_payload},
 *   var{encodeimportrefs{WI_importsegments}}, var{sequence of (hash, encode[4]{length})}
 * }
 *
 * Field order per Gray Paper:
 * 1. encode[4]{serviceindex} - 4-byte fixed-length service ID
 * 2. codehash - 32-byte hash
 * 3. encode[8]{refgaslimit} - 8-byte fixed-length gas limit
 * 4. encode[8]{accgaslimit} - 8-byte fixed-length gas limit
 * 5. encode[2]{exportcount} - 2-byte fixed-length export count
 * 6. var{payload} - variable-length blob with length prefix
 * 7. var{importsegments} - variable-length sequence with length prefix
 * 8. var{extrinsics} - variable-length sequence of (hash, encode[4]{length})
 *
 * ✅ CORRECT: Field order matches Gray Paper
 * ✅ CORRECT: Uses proper fixed-length and variable-length encoding
 */
export function encodeWorkItem(workItem: WorkItem): Safe<Uint8Array> {
  const parts: Uint8Array[] = []

  // 1. encode[4]{serviceindex} - 4-byte fixed-length service ID
  const [error1, encoded1] = encodeFixedLength(
    BigInt(workItem.serviceindex || 0),
    4n,
  )
  if (error1) {
    return safeError(error1)
  }
  parts.push(encoded1)

  // 2. codehash - 32-byte hash
  parts.push(hexToBytes(workItem.codehash))

  // 3. encode[8]{refgaslimit} - 8-byte fixed-length gas limit
  const [error2, encoded2] = encodeFixedLength(
    BigInt(workItem.refgaslimit || 0),
    8n,
  )
  if (error2) {
    return safeError(error2)
  }
  parts.push(encoded2)

  // 4. encode[8]{accgaslimit} - 8-byte fixed-length gas limit
  const [error3, encoded3] = encodeFixedLength(
    BigInt(workItem.accgaslimit || 0),
    8n,
  )
  if (error3) {
    return safeError(error3)
  }
  parts.push(encoded3)

  // 5. encode[2]{exportcount} - 2-byte fixed-length export count
  const [error4, encoded4] = encodeFixedLength(
    BigInt(workItem.exportcount || 0),
    2n,
  )
  if (error4) {
    return safeError(error4)
  }
  parts.push(encoded4)

  // 6. var{payload} - variable-length blob with length prefix
  const payloadBytes = workItem.payload
  const [error5, encoded5] = encodeNatural(BigInt(payloadBytes.length))
  if (error5) {
    return safeError(error5)
  }
  parts.push(encoded5)
  parts.push(payloadBytes)

  // 7. var{importsegments} - variable-length sequence with length prefix
  const [error6, encoded6] = encodeNatural(
    BigInt(workItem.importsegments.length),
  )
  if (error6) {
    return safeError(error6)
  }
  parts.push(encoded6)
  for (const importRef of workItem.importsegments) {
    const [error7, encoded7] = encodeImportReference(importRef)
    if (error7) {
      return safeError(error7)
    }
    parts.push(encoded7)
  }

  // 8. var{extrinsics} - variable-length sequence of (hash, encode[4]{length})
  const [error8, encoded8] = encodeNatural(BigInt(workItem.extrinsics.length)) // Array length
  if (error8) {
    return safeError(error8)
  }
  parts.push(encoded8)
  for (const extrinsicRef of workItem.extrinsics) {
    const [error9, encoded9] = encodeExtrinsicReference(extrinsicRef)
    if (error9) {
      return safeError(error9)
    }
    parts.push(encoded9)
  }

  return safeResult(concatBytes(parts))
}

/**
 * Encode extrinsic reference
 *
 * @param extrinsicRef - Extrinsic reference to encode
 * @returns Encoded octet sequence
 */
/**
 * Encode extrinsic reference according to Gray Paper specification.
 *
 * Gray Paper formula: (h, encode[4]{i}) where (h, i) ∈ WI_extrinsics
 *
 * Structure:
 * - h: hash (32 bytes)
 * - encode[4]{i}: 4-byte fixed-length length
 *
 * ✅ CORRECT: Hash field (32 bytes)
 * ✅ CORRECT: Uses 4-byte fixed-length encoding for length field
 */
export function encodeExtrinsicReference(
  extrinsicRef: ExtrinsicReference,
): Safe<Uint8Array> {
  const parts: Uint8Array[] = []

  // Hash (32 bytes) - convert hex to bytes
  parts.push(hexToBytes(extrinsicRef.hash))

  // encode[4]{length} - 4-byte fixed-length length (Gray Paper compliant)
  const [error, encoded] = encodeFixedLength(BigInt(extrinsicRef.length), 4n)
  if (error) {
    return safeError(error)
  }
  parts.push(encoded)

  return safeResult(concatBytes(parts))
}

/**
 * Encode work package according to Gray Paper specification.
 *
 * Gray Paper formula: encode{WP} = encode{
 *   encode[4]{WP_authcodehost}, WP_authcodehash, WP_context,
 *   var{WP_authtoken}, var{WP_authconfig}, var{WP_workitems}
 * }
 *
 * Field order per Gray Paper:
 * 1. encode[4]{authcodehost} - 4-byte fixed-length service ID
 * 2. authcodehash - 32-byte hash
 * 3. context - work context structure
 * 4. var{authtoken} - variable-length blob with length prefix
 * 5. var{authconfig} - variable-length blob with length prefix
 * 6. var{workitems} - variable-length sequence with length prefix
 *
 * ✅ CORRECT: Field order matches Gray Paper
 * ✅ CORRECT: Uses proper fixed-length and variable-length encoding
 */
export function encodeWorkPackage(workPackage: WorkPackage): Safe<Uint8Array> {
  const parts: Uint8Array[] = []

  // 1. encode[4]{authcodehost} - 4-byte fixed-length service ID
  const [error1, encoded1] = encodeFixedLength(workPackage.authCodeHost, 4n)
  if (error1) {
    return safeError(error1)
  }
  parts.push(encoded1)

  // 2. authcodehash - 32-byte hash
  parts.push(hexToBytes(workPackage.authCodeHash))

  // 3. context - work context structure
  const [error2, encoded2] = encodeRefineContext(workPackage.context)
  if (error2) {
    return safeError(error2)
  }
  parts.push(encoded2)

  // 4. var{authtoken} - variable-length blob with length prefix
  const authTokenBytes = hexToBytes(workPackage.authToken)
  const [error3, encoded3] = encodeNatural(BigInt(authTokenBytes.length))
  if (error3) {
    return safeError(error3)
  }
  parts.push(encoded3)
  parts.push(authTokenBytes)

  // 5. var{authconfig} - variable-length blob with length prefix
  const authConfigBytes = hexToBytes(workPackage.authConfig)
  const [error4, encoded4] = encodeNatural(BigInt(authConfigBytes.length))
  if (error4) {
    return safeError(error4)
  }
  parts.push(encoded4)
  parts.push(authConfigBytes)

  // 6. var{workitems} - variable-length sequence with length prefix
  const [error5, encoded5] = encodeNatural(BigInt(workPackage.workItems.length))
  if (error5) {
    return safeError(error5)
  }
  parts.push(encoded5)
  for (const workItem of workPackage.workItems) {
    const [error6, encoded6] = encodeWorkItem(workItem)
    if (error6) {
      return safeError(error6)
    }
    parts.push(encoded6)
  }

  return safeResult(concatBytes(parts))
}

/**
 * Decode work package
 *
 * @param data - Octet sequence to decode
 * @returns Decoded work package and remaining data
 */
/**
 * Decode work package according to Gray Paper specification.
 *
 * Gray Paper formula: decode{WP} reverses encode{WP} = {
 *   encode[4]{WP_authcodehost}, WP_authcodehash, WP_context,
 *   var{WP_authtoken}, var{WP_authconfig}, var{WP_workitems}
 * }
 *
 * Field order per Gray Paper:
 * 1. decode[4]{authcodehost} - 4-byte fixed-length service ID
 * 2. authcodehash - 32-byte hash
 * 3. context - work context structure
 * 4. var{authtoken} - variable-length blob with length prefix
 * 5. var{authconfig} - variable-length blob with length prefix
 * 6. var{workitems} - variable-length sequence with length prefix
 *
 * ✅ CORRECT: Field order matches Gray Paper
 * ✅ CORRECT: Uses proper fixed-length and variable-length decoding
 */
export function decodeWorkPackage(
  data: Uint8Array,
): Safe<DecodingResult<WorkPackage>> {
  let currentData = data

  // 1. decode[4]{authcodehost} - 4-byte fixed-length service ID
  const [error1, authCodeHostResult] = decodeFixedLength(currentData, 4n)
  if (error1) {
    return safeError(error1)
  }
  const authCodeHost = authCodeHostResult.value
  currentData = authCodeHostResult.remaining

  // 2. authcodehash - 32-byte hash
  const authCodeHash = bytesToHex(currentData.slice(0, 32))
  currentData = currentData.slice(32)

  // 3. context - work context structure
  const [error2, contextResult] = decodeRefineContext(currentData)
  if (error2) {
    return safeError(error2)
  }
  const context = contextResult.value
  currentData = contextResult.remaining

  // 4. var{authtoken} - variable-length blob with length prefix
  const [error3, authTokenLengthResult] = decodeNatural(currentData)
  if (error3) {
    return safeError(error3)
  }
  const authTokenLength = Number(authTokenLengthResult.value)
  currentData = authTokenLengthResult.remaining
  const authToken = bytesToHex(currentData.slice(0, authTokenLength))
  currentData = currentData.slice(authTokenLength)

  // 5. var{authconfig} - variable-length blob with length prefix
  const [error4, authConfigLengthResult] = decodeNatural(currentData)
  if (error4) {
    return safeError(error4)
  }
  const authConfigLength = Number(authConfigLengthResult.value)
  currentData = authConfigLengthResult.remaining
  const authConfig = bytesToHex(currentData.slice(0, authConfigLength))
  currentData = currentData.slice(authConfigLength)

  // 6. var{workitems} - variable-length sequence with length prefix
  const [error5, workItemsLengthResult] = decodeNatural(currentData)
  if (error5) {
    return safeError(error5)
  }
  const workItemsLength = Number(workItemsLengthResult.value)
  currentData = workItemsLengthResult.remaining
  const workItems: WorkItem[] = []
  for (let i = 0; i < workItemsLength; i++) {
    const [error6, result] = decodeWorkItem(currentData)
    if (error6) {
      return safeError(error6)
    }
    workItems.push(result.value)
    currentData = result.remaining
  }

  return safeResult({
    value: {
      authToken,
      authCodeHost,
      authCodeHash,
      authConfig,
      context,
      workItems,
    },
    remaining: currentData,
    consumed: data.length - currentData.length,
  })
}

/**
 * Decode work item
 *
 * @param data - Octet sequence to decode
 * @returns Decoded work item and remaining data
 */
/**
 * Decode work item according to Gray Paper specification.
 *
 * Gray Paper formula: decode{WI} reverses encode{WI} = {
 *   encode[4]{WI_serviceindex}, WI_codehash, encode[8]{WI_refgaslimit},
 *   encode[8]{WI_accgaslimit}, encode[2]{WI_exportcount}, var{WI_payload},
 *   var{encodeimportrefs{WI_importsegments}}, var{sequence of (hash, encode[4]{length})}
 * }
 *
 * Field order per Gray Paper:
 * 1. decode[4]{serviceindex} - 4-byte fixed-length service ID
 * 2. codehash - 32-byte hash
 * 3. decode[8]{refgaslimit} - 8-byte fixed-length gas limit
 * 4. decode[8]{accgaslimit} - 8-byte fixed-length gas limit
 * 5. decode[2]{exportcount} - 2-byte fixed-length export count
 * 6. var{payload} - variable-length blob with length prefix
 * 7. var{importsegments} - variable-length sequence with length prefix
 * 8. var{extrinsics} - variable-length sequence of (hash, decode[4]{length})
 *
 * ✅ CORRECT: Field order matches Gray Paper
 * ✅ CORRECT: Uses proper fixed-length and variable-length decoding
 */
export function decodeWorkItem(
  data: Uint8Array,
): Safe<DecodingResult<WorkItem>> {
  let currentData = data

  // 1. decode[4]{serviceindex} - 4-byte fixed-length service ID
  const [error1, serviceIndexResult] = decodeFixedLength(currentData, 4n)
  if (error1) {
    return safeError(error1)
  }
  const serviceIndex = serviceIndexResult.value
  currentData = serviceIndexResult.remaining

  // 2. codehash - 32-byte hash
  const codeHash = bytesToHex(currentData.slice(0, 32))
  currentData = currentData.slice(32)

  // 3. decode[8]{refgaslimit} - 8-byte fixed-length gas limit
  const [error2, refGasLimitResult] = decodeFixedLength(currentData, 8n)
  if (error2) {
    return safeError(error2)
  }
  const refGasLimit = refGasLimitResult.value
  currentData = refGasLimitResult.remaining

  // 4. decode[8]{accgaslimit} - 8-byte fixed-length gas limit
  const [error3, accGasLimitResult] = decodeFixedLength(currentData, 8n)
  if (error3) {
    return safeError(error3)
  }
  const accGasLimit = accGasLimitResult.value
  currentData = accGasLimitResult.remaining

  // 5. decode[2]{exportcount} - 2-byte fixed-length export count
  const [error4, exportCountResult] = decodeFixedLength(currentData, 2n)
  if (error4) {
    return safeError(error4)
  }
  const exportCount = exportCountResult.value
  currentData = exportCountResult.remaining

  // 6. var{payload} - variable-length blob with length prefix
  const [error5, payloadLengthResult] = decodeNatural(currentData)
  if (error5) {
    return safeError(error5)
  }
  const payloadLength = Number(payloadLengthResult.value)
  currentData = payloadLengthResult.remaining
  const payload = currentData.slice(0, payloadLength)
  currentData = currentData.slice(payloadLength)

  // 7. var{importsegments} - variable-length sequence with length prefix
  const [error6, importSegmentsLengthResult] = decodeNatural(currentData)
  if (error6) {
    return safeError(error6)
  }
  const importSegmentsLength = Number(importSegmentsLengthResult.value)
  currentData = importSegmentsLengthResult.remaining
  const importSegments = []
  for (let i = 0; i < Number(importSegmentsLength); i++) {
    const [error, result] = decodeImportReference(currentData)
    if (error) {
      return safeError(error)
    }
    importSegments.push(result.value)
    currentData = result.remaining
  }

  // 8. var{extrinsics} - variable-length sequence of (hash, encode[4]{length})
  const [error7, extrinsicsLengthResult] = decodeNatural(currentData)
  if (error7) {
    return safeError(error7)
  }
  const extrinsicsLength = Number(extrinsicsLengthResult.value)
  currentData = extrinsicsLengthResult.remaining
  const extrinsics = []
  for (let i = 0; i < extrinsicsLength; i++) {
    const [error, result] = decodeExtrinsicReference(currentData)
    if (error) {
      return safeError(error)
    }
    extrinsics.push(result.value)
    currentData = result.remaining
  }

  return safeResult({
    value: {
      serviceindex: serviceIndex,
      codehash: codeHash,
      refgaslimit: refGasLimit,
      accgaslimit: accGasLimit,
      exportcount: exportCount, // TODO: Decode actual export segments based on exportCount
      payload,
      importsegments: importSegments,
      extrinsics: extrinsics,
    },
    remaining: currentData,
    consumed: data.length - currentData.length,
  })
}

/**
 * Decode extrinsic reference
 *
 * @param data - Octet sequence to decode
 * @returns Decoded extrinsic reference and remaining data
 */
/**
 * Decode extrinsic reference according to Gray Paper specification.
 *
 * Gray Paper formula: (h, encode[4]{i}) where (h, i) ∈ WI_extrinsics
 *
 * Structure:
 * - h: hash (32 bytes)
 * - encode[4]{i}: 4-byte fixed-length length
 *
 * ✅ CORRECT: Hash field (32 bytes)
 * ✅ CORRECT: Uses 4-byte fixed-length decoding for length field
 */
export function decodeExtrinsicReference(
  data: Uint8Array,
): Safe<DecodingResult<ExtrinsicReference>> {
  // Hash (32 bytes)
  const hash = bytesToHex(data.slice(0, 32))
  const currentData = data.slice(32)

  // decode[4]{length} - 4-byte fixed-length length (Gray Paper compliant)
  const [error, lengthResult] = decodeFixedLength(currentData, 4n)
  if (error) {
    return safeError(error)
  }

  return safeResult({
    value: {
      hash,
      length: lengthResult.value,
    },
    remaining: lengthResult.remaining,
    consumed: data.length - currentData.length,
  })
}
