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

import { bytesToHex, hexToBytes } from '@pbnj/core'
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
  authorization: string // hex string
  auth_code_host: number
  authorizer: Authorizer
  context: WorkContext
  items: WorkItem[]
}

export function encodeWorkItem(workItem: WorkItem): Uint8Array {
  const parts: Uint8Array[] = []

  // Service (8 bytes)
  parts.push(encodeNatural(BigInt(workItem.serviceindex || 0)))

  // Code hash (32 bytes) - convert hex to bytes
  parts.push(hexToBytes(workItem.codehash))

  // Refine gas limit (8 bytes)
  parts.push(encodeNatural(BigInt(workItem.refgaslimit || 0)))

  // Accumulate gas limit (8 bytes)
  parts.push(encodeNatural(BigInt(workItem.accgaslimit || 0)))

  // Export count (8 bytes)
  parts.push(encodeNatural(BigInt(workItem.exportcount || 0)))

  // Payload (variable length) - convert hex to bytes
  const payloadBytes = hexToBytes(workItem.payload)
  parts.push(encodeNatural(BigInt(payloadBytes.length))) // Length prefix
  parts.push(payloadBytes)

  // Import segments (array of import references)
  parts.push(encodeNatural(BigInt(workItem.importsegments.length))) // Array length
  for (const importRef of workItem.importsegments) {
    parts.push(encodeImportReference(importRef))
  }

  // Extrinsic (array of extrinsic references)
  parts.push(encodeNatural(BigInt(workItem.extrinsics.length))) // Array length
  for (const extrinsicRef of workItem.extrinsics) {
    parts.push(encodeExtrinsicReference(extrinsicRef))
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
 * Encode extrinsic reference
 *
 * @param extrinsicRef - Extrinsic reference to encode
 * @returns Encoded octet sequence
 */
export function encodeExtrinsicReference(
  extrinsicRef: ExtrinsicReference,
): Uint8Array {
  const parts: Uint8Array[] = []

  // Hash (32 bytes) - convert hex to bytes
  parts.push(hexToBytes(extrinsicRef.hash))

  // Len (8 bytes)
  parts.push(encodeNatural(BigInt(extrinsicRef.length)))

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
 * Encode work package
 *
 * @param workPackage - Work package to encode
 * @returns Encoded octet sequence
 */
export function encodeWorkPackage(
  workPackage: SerializationWorkPackage,
): Uint8Array {
  const parts: Uint8Array[] = []

  // Auth code host (8 bytes)
  parts.push(encodeNatural(BigInt(workPackage.auth_code_host)))

  // Auth code hash (32 bytes) - convert hex to bytes
  parts.push(hexToBytes(workPackage.authorizer.code_hash))

  // Context
  parts.push(encodeWorkContext(workPackage.context))

  // Auth token (variable length) - convert hex to bytes
  const authTokenBytes = hexToBytes(workPackage.authorization as `0x${string}`)
  parts.push(encodeNatural(BigInt(authTokenBytes.length))) // Length prefix
  parts.push(authTokenBytes)

  // Auth config (variable length) - convert hex to bytes
  const authConfigBytes = hexToBytes(workPackage.authorizer.params)
  parts.push(encodeNatural(BigInt(authConfigBytes.length))) // Length prefix
  parts.push(authConfigBytes)

  // Work items (array of work items)
  parts.push(encodeNatural(BigInt(workPackage.items.length))) // Array length
  for (const workItem of workPackage.items) {
    parts.push(encodeWorkItem(workItem))
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
 * Decode work package
 *
 * @param data - Octet sequence to decode
 * @returns Decoded work package and remaining data
 */
export function decodeWorkPackage(data: Uint8Array): {
  value: SerializationWorkPackage
  remaining: Uint8Array
} {
  let currentData = data

  // Auth code host (8 bytes)
  const authCodeHost = BigInt(
    `0x${Array.from(currentData.slice(0, 8))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')}`,
  )
  currentData = currentData.slice(8)

  // Auth code hash (32 bytes)
  const authCodeHash = bytesToHex(currentData.slice(0, 32))
  currentData = currentData.slice(32)

  // Context (fixed size)
  const context = decodeWorkContext(currentData.slice(0, 200))
  currentData = currentData.slice(200)

  // Auth token (variable length)
  const authTokenLength = BigInt(
    `0x${Array.from(currentData.slice(0, 8))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')}`,
  )
  currentData = currentData.slice(8)
  const authToken = bytesToHex(currentData.slice(0, Number(authTokenLength)))
  currentData = currentData.slice(Number(authTokenLength))

  // Auth config (variable length)
  const authConfigLength = BigInt(
    `0x${Array.from(currentData.slice(0, 8))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')}`,
  )
  currentData = currentData.slice(8)
  const authConfig = bytesToHex(currentData.slice(0, Number(authConfigLength)))
  currentData = currentData.slice(Number(authConfigLength))

  // Work items (array of work items)
  const workItemsLength = BigInt(
    `0x${Array.from(currentData.slice(0, 8))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')}`,
  )
  currentData = currentData.slice(8)
  const workItems = []
  for (let i = 0; i < Number(workItemsLength); i++) {
    const { value: workItem, remaining } = decodeWorkItem(currentData)
    workItems.push(workItem)
    currentData = remaining
  }

  return {
    value: {
      authorization: authToken,
      auth_code_host: Number(authCodeHost),
      authorizer: {
        code_hash: authCodeHash as `0x${string}`,
        params: authConfig as `0x${string}`,
        publicKey:
          '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
        weight: 0,
      },
      context,
      items: workItems,
    },
    remaining: currentData,
  }
}

/**
 * Decode work item
 *
 * @param data - Octet sequence to decode
 * @returns Decoded work item and remaining data
 */
export function decodeWorkItem(data: Uint8Array): {
  value: WorkItem
  remaining: Uint8Array
} {
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
    const { value: importRef, remaining } = decodeImportReference(currentData)
    importSegments.push(importRef)
    currentData = remaining
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
    const { value: extrinsicRef, remaining } =
      decodeExtrinsicReference(currentData)
    extrinsics.push(extrinsicRef)
    currentData = remaining
  }

  return {
    value: {
      serviceindex: Number(serviceIndex),
      codehash: codeHash,
      refgaslimit: refGasLimit,
      accgaslimit: accGasLimit,
      exportcount: Number(exportCount),
      payload,
      importsegments: importSegments,
      extrinsics: extrinsics,
    },
    remaining: currentData,
  }
}

/**
 * Decode extrinsic reference
 *
 * @param data - Octet sequence to decode
 * @returns Decoded extrinsic reference and remaining data
 */
export function decodeExtrinsicReference(data: Uint8Array): {
  value: ExtrinsicReference
  remaining: Uint8Array
} {
  // Hash (32 bytes)
  const hash = bytesToHex(data.slice(0, 32))
  const remaining = data.slice(32)

  // Len (8 bytes)
  const len = BigInt(
    `0x${Array.from(remaining.slice(0, 8))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')}`,
  )

  return {
    value: {
      hash,
      length: Number(len),
    },
    remaining: remaining.slice(8),
  }
}

// Helper function for decoding work context
function decodeWorkContext(data: Uint8Array): WorkContext {
  // Simplified implementation - in practice this would use the proper decoder
  return {
    anchorhash: bytesToHex(data.slice(0, 32)),
    anchorpoststate: bytesToHex(data.slice(32, 64)),
    anchoraccoutlog: bytesToHex(data.slice(64, 96)),
    lookupanchorhash: bytesToHex(data.slice(96, 128)),
    lookupanchortime: Number(
      BigInt(
        `0x${Array.from(data.slice(128, 136))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('')}`,
      ),
    ),
    prerequisites: [], // Simplified - not handling complex prerequisites yet
  }
}
