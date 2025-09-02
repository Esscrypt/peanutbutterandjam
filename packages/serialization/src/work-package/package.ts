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
  bytesToBigInt,
  bytesToHex,
  type Hex,
  hexToBytes,
  type Safe,
  safeError,
  safeResult,
} from '@pbnj/core'
import type {
  Authorizer,
  ExtrinsicReference,
  WorkContext,
  SerializationWorkItem as WorkItem,
} from '@pbnj/types'
import { encodeNatural } from '../core/natural-number'
import {
  decodeImportReference,
  encodeImportReference,
} from '../pvm/import-reference'
import { encodeWorkContext } from './context'

// Define the WorkPackage interface for serialization
interface SerializationWorkPackage {
  authorization: Hex
  auth_code_host: bigint
  authorizer: Authorizer
  context: WorkContext
  items: WorkItem[]
}

export function encodeWorkItem(workItem: WorkItem): Safe<Uint8Array> {
  const parts: Uint8Array[] = []

  // Service (8 bytes)
  const [error1, encoded1] = encodeNatural(BigInt(workItem.serviceindex || 0))
  if (error1) {
    return safeError(error1)
  }
  parts.push(encoded1)

  // Code hash (32 bytes) - convert hex to bytes
  parts.push(hexToBytes(workItem.codehash))

  // Refine gas limit (8 bytes)
  const [error2, encoded2] = encodeNatural(BigInt(workItem.refgaslimit || 0))
  if (error2) {
    return safeError(error2)
  }
  parts.push(encoded2)

  // Accumulate gas limit (8 bytes)
  const [error3, encoded3] = encodeNatural(BigInt(workItem.accgaslimit || 0))
  if (error3) {
    return safeError(error3)
  }
  parts.push(encoded3)

  // Export count (8 bytes)
  const [error4, encoded4] = encodeNatural(BigInt(workItem.exportcount || 0))
  if (error4) {
    return safeError(error4)
  }
  parts.push(encoded4)

  // Payload (variable length) - convert hex to bytes
  const payloadBytes = hexToBytes(workItem.payload)
  const [error5, encoded5] = encodeNatural(BigInt(payloadBytes.length)) // Length prefix
  if (error5) {
    return safeError(error5)
  }
  parts.push(encoded5)
  parts.push(payloadBytes)

  // Import segments (array of import references)
  const [error6, encoded6] = encodeNatural(
    BigInt(workItem.importsegments.length),
  ) // Array length
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

  // Extrinsic (array of extrinsic references)
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
 * Encode extrinsic reference
 *
 * @param extrinsicRef - Extrinsic reference to encode
 * @returns Encoded octet sequence
 */
export function encodeExtrinsicReference(
  extrinsicRef: ExtrinsicReference,
): Safe<Uint8Array> {
  const parts: Uint8Array[] = []

  // Hash (32 bytes) - convert hex to bytes
  parts.push(hexToBytes(extrinsicRef.hash))

  // Len (8 bytes)
  const [error, encoded] = encodeNatural(BigInt(extrinsicRef.length))
  if (error) {
    return safeError(error)
  }
  parts.push(encoded)

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
 * Encode work package
 *
 * @param workPackage - Work package to encode
 * @returns Encoded octet sequence
 */
export function encodeWorkPackage(
  workPackage: SerializationWorkPackage,
): Safe<Uint8Array> {
  const parts: Uint8Array[] = []

  // Auth code host (8 bytes)
  const [error1, encoded1] = encodeNatural(BigInt(workPackage.auth_code_host))
  if (error1) {
    return safeError(error1)
  }
  parts.push(encoded1)

  // Auth code hash (32 bytes) - convert hex to bytes
  parts.push(hexToBytes(workPackage.authorizer.code_hash))

  // Context
  const [error2, encoded2] = encodeWorkContext(workPackage.context)
  if (error2) {
    return safeError(error2)
  }
  parts.push(encoded2)

  // Auth token (variable length) - convert hex to bytes
  const authTokenBytes = hexToBytes(workPackage.authorization as `0x${string}`)
  const [error3, encoded3] = encodeNatural(BigInt(authTokenBytes.length)) // Length prefix
  if (error3) {
    return safeError(error3)
  }
  parts.push(encoded3)
  parts.push(authTokenBytes)

  // Auth config (variable length) - convert hex to bytes
  const authConfigBytes = hexToBytes(workPackage.authorizer.params)
  const [error4, encoded4] = encodeNatural(BigInt(authConfigBytes.length)) // Length prefix
  if (error4) {
    return safeError(error4)
  }
  parts.push(encoded4)
  parts.push(authConfigBytes)

  // Work items (array of work items)
  const [error5, encoded5] = encodeNatural(BigInt(workPackage.items.length)) // Array length
  if (error5) {
    return safeError(error5)
  }
  parts.push(encoded5)
  for (const workItem of workPackage.items) {
    const [error5, encoded5] = encodeWorkItem(workItem)
    if (error5) {
      return safeError(error5)
    }
    parts.push(encoded5)
  }

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
 * Decode work package
 *
 * @param data - Octet sequence to decode
 * @returns Decoded work package and remaining data
 */
export function decodeWorkPackage(data: Uint8Array): Safe<{
  value: SerializationWorkPackage
  remaining: Uint8Array
}> {
  let currentData = data

  // Auth code host (8 bytes)
  const authCodeHost = bytesToBigInt(currentData.slice(0, 8))
  currentData = currentData.slice(8)

  // Auth code hash (32 bytes)
  const authCodeHash = bytesToHex(currentData.slice(0, 32))
  currentData = currentData.slice(32)

  // Context (fixed size)
  const [error6, context] = decodeWorkContext(currentData.slice(0, 200))
  if (error6) {
    return safeError(error6)
  }
  currentData = currentData.slice(200)

  // Auth token (variable length)
  const authTokenLength = bytesToBigInt(currentData.slice(0, 8))
  currentData = currentData.slice(8)
  const authToken = bytesToHex(currentData.slice(0, Number(authTokenLength)))
  currentData = currentData.slice(Number(authTokenLength))

  // Auth config (variable length)
  const authConfigLength = bytesToBigInt(currentData.slice(0, 8))
  currentData = currentData.slice(8)
  const authConfig = bytesToHex(currentData.slice(0, Number(authConfigLength)))
  currentData = currentData.slice(Number(authConfigLength))

  // Work items (array of work items)
  const workItemsLength = bytesToBigInt(currentData.slice(0, 8))
  currentData = currentData.slice(8)
  const workItems: WorkItem[] = []
  for (let i = 0; i < Number(workItemsLength); i++) {
    const [workItemError, result] = decodeWorkItem(currentData)
    if (workItemError) {
      return safeError(workItemError)
    }
    workItems.push(result.value)
    currentData = result.remaining
  }

  return safeResult({
    value: {
      authorization: authToken,
      auth_code_host: authCodeHost,
      authorizer: {
        code_hash: authCodeHash as `0x${string}`,
        params: authConfig as `0x${string}`,
        publicKey:
          '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
        weight: 0n,
      },
      context,
      items: workItems,
    },
    remaining: currentData,
  })
}

/**
 * Decode work item
 *
 * @param data - Octet sequence to decode
 * @returns Decoded work item and remaining data
 */
export function decodeWorkItem(data: Uint8Array): Safe<{
  value: WorkItem
  remaining: Uint8Array
}> {
  let currentData = data

  // Service index (8 bytes)
  const serviceIndex = BigInt(
    `0x${Array.from(currentData.slice(0, 8))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')}`,
  )
  currentData = currentData.slice(8)

  // Code hash (32 bytes)
  const codeHash = bytesToHex(currentData.slice(0, 32))
  currentData = currentData.slice(32)

  // Ref gas limit (8 bytes)
  const refGasLimit = BigInt(
    `0x${Array.from(currentData.slice(0, 8))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')}`,
  )
  currentData = currentData.slice(8)

  // Acc gas limit (8 bytes)
  const accGasLimit = BigInt(
    `0x${Array.from(currentData.slice(0, 8))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')}`,
  )
  currentData = currentData.slice(8)

  // Export count (8 bytes)
  const exportCount = BigInt(
    `0x${Array.from(currentData.slice(0, 8))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')}`,
  )
  currentData = currentData.slice(8)

  // Payload (variable length)
  const payloadLength = BigInt(
    `0x${Array.from(currentData.slice(0, 8))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')}`,
  )
  currentData = currentData.slice(8)
  const payload = bytesToHex(currentData.slice(0, Number(payloadLength)))
  currentData = currentData.slice(Number(payloadLength))

  // Import segments (array of import references)
  const importSegmentsLength = BigInt(
    `0x${Array.from(currentData.slice(0, 8))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')}`,
  )
  currentData = currentData.slice(8)
  const importSegments = []
  for (let i = 0; i < Number(importSegmentsLength); i++) {
    const [error, result] = decodeImportReference(currentData)
    if (error) {
      return safeError(error)
    }
    importSegments.push(result.value)
    currentData = result.remaining
  }

  // Extrinsics (array of extrinsic references)
  const extrinsicsLength = BigInt(
    `0x${Array.from(currentData.slice(0, 8))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')}`,
  )
  currentData = currentData.slice(8)
  const extrinsics = []
  for (let i = 0; i < Number(extrinsicsLength); i++) {
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
      exportcount: exportCount,
      payload,
      importsegments: importSegments,
      extrinsics: extrinsics,
    },
    remaining: currentData,
  })
}

/**
 * Decode extrinsic reference
 *
 * @param data - Octet sequence to decode
 * @returns Decoded extrinsic reference and remaining data
 */
export function decodeExtrinsicReference(data: Uint8Array): Safe<{
  value: ExtrinsicReference
  remaining: Uint8Array
}> {
  // Hash (32 bytes)
  const hash = bytesToHex(data.slice(0, 32))
  const remaining = data.slice(32)

  // Len (8 bytes)
  const len = BigInt(
    `0x${Array.from(remaining.slice(0, 8))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')}`,
  )

  return safeResult({
    value: {
      hash,
      length: len,
    },
    remaining: remaining.slice(8),
  })
}

// Helper function for decoding work context
function decodeWorkContext(data: Uint8Array): Safe<WorkContext> {
  // Simplified implementation - in practice this would use the proper decoder
  return safeResult({
    anchorhash: bytesToHex(data.slice(0, 32)),
    anchorpoststate: bytesToHex(data.slice(32, 64)),
    anchoraccoutlog: bytesToHex(data.slice(64, 96)),
    lookupanchorhash: bytesToHex(data.slice(96, 128)),
    lookupanchortime: bytesToBigInt(data.slice(128, 136)),
    prerequisites: [], // Simplified - not handling complex prerequisites yet
  })
}
