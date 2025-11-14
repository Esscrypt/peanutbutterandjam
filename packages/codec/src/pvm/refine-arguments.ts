/**
 * Refine Arguments Serialization
 *
 * *** DO NOT REMOVE - GRAY PAPER FORMULA ***
 * Gray Paper Section: Appendix B.6 - PVM Invocations
 * Formula (Equation 85):
 *
 * 𝐚 = encode{c, i, w_wi¬serviceindex, var{w_wi¬payload}, blake{p}}
 *
 * Refine arguments are encoded parameters passed to the Ψ_M marshalling
 * invocation during refine execution. They contain all necessary context
 * for the PVM to execute the refine operation.
 *
 * *** IMPLEMENTER EXPLANATION ***
 * Refine arguments encode the complete context needed for PVM refine execution.
 * They are passed to Ψ_M as the argument blob and contain all parameters
 * required by the refine invocation.
 *
 * Refine Arguments structure:
 * 1. **Core index (c)** (4 bytes): Core performing the refinement
 * 2. **Work item index (i)** (4 bytes): Index of work item being refined
 * 3. **Service index** (4 bytes): Service executing the work item
 * 4. **Payload** (variable): Authorizer trace data with length discriminator
 * 5. **Work package hash** (32 bytes): Blake hash of the work package
 *
 * Key concepts:
 * - **Core assignment**: Which core is performing the refinement
 * - **Work item identification**: Which specific item to refine
 * - **Service context**: Which service code to execute
 * - **Authorizer trace**: Variable-length authorization data
 * - **Package integrity**: Hash ensures work package hasn't changed
 *
 * Variable encoding:
 * - **var{w_wi¬payload}**: Length discriminator (4 bytes) + payload data
 * - **blake{p}**: 32-byte Blake2b hash of encoded work package
 *
 * This structure enables the PVM to execute refine operations with
 * complete context and integrity verification.
 */

import { blake2bHash, concatBytes, hexToBytes } from '@pbnj/core'
import type { DecodingResult, Safe, WorkItem, WorkPackage } from '@pbnj/types'
import { safeError, safeResult } from '@pbnj/types'
import { encodeWorkPackage } from '../work-package/package'

/**
 * Refine arguments structure for encoding/decoding
 */
export interface RefineArguments {
  /** Core index performing the refinement */
  coreIndex: bigint
  /** Index of work item being refined */
  workItemIndex: bigint
  /** Service index from work item */
  serviceIndex: bigint
  /** Authorizer trace payload */
  payload: Uint8Array
  /** Blake hash of work package */
  workPackageHash: Uint8Array
}

/**
 * Encode refine arguments according to Gray Paper equation 85
 *
 * Gray Paper: 𝐚 = encode{c, i, w_wi¬serviceindex, var{w_wi¬payload}, blake{p}}
 *
 * @param coreIndex - Core performing the refinement
 * @param workItemIndex - Index of work item being refined
 * @param workItem - Work item containing service index and payload
 * @param workPackage - Work package to hash
 * @returns Encoded refine arguments as Uint8Array
 */
export function encodeRefineArguments(
  coreIndex: bigint,
  workItemIndex: bigint,
  workItem: WorkItem,
  workPackage: WorkPackage,
): Safe<Uint8Array> {
  try {
    // 1. Core index (c) - encode as 4-byte little-endian
    const coreIndexBytes = new ArrayBuffer(4)
    const coreIndexView = new DataView(coreIndexBytes)
    coreIndexView.setUint32(0, Number(coreIndex), true)

    // 2. Work item index (i) - encode as 4-byte little-endian
    const workItemIndexBytes = new ArrayBuffer(4)
    const workItemIndexView = new DataView(workItemIndexBytes)
    workItemIndexView.setUint32(0, Number(workItemIndex), true)

    // 3. Service index from work item (w_wi¬serviceindex) - encode as 4-byte little-endian
    const serviceIndexBytes = new ArrayBuffer(4)
    const serviceIndexView = new DataView(serviceIndexBytes)
    serviceIndexView.setUint32(0, Number(workItem.serviceindex), true)

    // 4. Variable-length payload (var{w_wi¬payload}) - length discriminator + payload
    const payloadLengthBytes = new ArrayBuffer(4)
    const payloadLengthView = new DataView(payloadLengthBytes)
    payloadLengthView.setUint32(0, workItem.payload.length, true)

    // 5. Blake hash of work package (blake{p}) - 32-byte hash
    const [workPackageError, workPackageEncoded] =
      encodeWorkPackage(workPackage)
    if (workPackageError) {
      return safeError(
        new Error(`Failed to encode work package: ${workPackageError.message}`),
      )
    }

    const [workPackageHashError, workPackageHash] =
      blake2bHash(workPackageEncoded)
    if (workPackageHashError) {
      return safeError(
        new Error(
          `Failed to hash work package: ${workPackageHashError.message}`,
        ),
      )
    }
    const workPackageHashBytes = hexToBytes(workPackageHash)

    // Concatenate all parts: c + i + serviceIndex + var{payload} + blake{p}
    const parts = [
      new Uint8Array(coreIndexBytes),
      new Uint8Array(workItemIndexBytes),
      new Uint8Array(serviceIndexBytes),
      new Uint8Array(payloadLengthBytes),
      workItem.payload,
      workPackageHashBytes,
    ]

    return safeResult(concatBytes(parts))
  } catch (error) {
    return safeError(
      new Error(
        `Failed to encode refine arguments: ${error instanceof Error ? error.message : 'Unknown error'}`,
      ),
    )
  }
}

/**
 * Decode refine arguments from encoded data
 *
 * @param data - Encoded refine arguments
 * @returns Decoded refine arguments structure
 */
export function decodeRefineArguments(
  data: Uint8Array,
): Safe<DecodingResult<RefineArguments>> {
  try {
    if (data.length < 48) {
      // Minimum: 4+4+4+4+32 = 48 bytes
      return safeError(new Error('Insufficient data for refine arguments'))
    }

    let offset = 0

    // 1. Core index (4 bytes)
    const coreIndexView = new DataView(data.buffer, offset, 4)
    const coreIndex = BigInt(coreIndexView.getUint32(0, true))
    offset += 4

    // 2. Work item index (4 bytes)
    const workItemIndexView = new DataView(data.buffer, offset, 4)
    const workItemIndex = BigInt(workItemIndexView.getUint32(0, true))
    offset += 4

    // 3. Service index (4 bytes)
    const serviceIndexView = new DataView(data.buffer, offset, 4)
    const serviceIndex = BigInt(serviceIndexView.getUint32(0, true))
    offset += 4

    // 4. Payload length discriminator (4 bytes)
    const payloadLengthView = new DataView(data.buffer, offset, 4)
    const payloadLength = payloadLengthView.getUint32(0, true)
    offset += 4

    // Validate payload length
    if (offset + payloadLength + 32 > data.length) {
      return safeError(new Error('Invalid payload length in refine arguments'))
    }

    // 5. Payload data (variable length)
    const payload = data.slice(offset, offset + payloadLength)
    offset += payloadLength

    // 6. Work package hash (32 bytes)
    const workPackageHash = data.slice(offset, offset + 32)

    const result: RefineArguments = {
      coreIndex,
      workItemIndex,
      serviceIndex,
      payload,
      workPackageHash,
    }

    return safeResult({
      value: result,
      remaining: data.slice(offset + 32),
      consumed: offset + 32,
    })
  } catch (error) {
    return safeError(
      new Error(
        `Failed to decode refine arguments: ${error instanceof Error ? error.message : 'Unknown error'}`,
      ),
    )
  }
}

/**
 * Create refine arguments from individual parameters
 *
 * @param coreIndex - Core performing the refinement
 * @param workItemIndex - Index of work item being refined
 * @param workItem - Work item containing service index and payload
 * @param workPackage - Work package to hash
 * @returns Refine arguments structure
 */
export function createRefineArguments(
  coreIndex: bigint,
  workItemIndex: bigint,
  workItem: WorkItem,
  workPackage: WorkPackage,
): Safe<RefineArguments> {
  try {
    // Calculate work package hash
    const [workPackageError, workPackageEncoded] =
      encodeWorkPackage(workPackage)
    if (workPackageError) {
      return safeError(
        new Error(`Failed to encode work package: ${workPackageError.message}`),
      )
    }

    const [workPackageHashError, workPackageHash] =
      blake2bHash(workPackageEncoded)
    if (workPackageHashError) {
      return safeError(
        new Error(
          `Failed to hash work package: ${workPackageHashError.message}`,
        ),
      )
    }
    const workPackageHashBytes = hexToBytes(workPackageHash)

    const result: RefineArguments = {
      coreIndex,
      workItemIndex,
      serviceIndex: workItem.serviceindex,
      payload: workItem.payload,
      workPackageHash: workPackageHashBytes,
    }

    return safeResult(result)
  } catch (error) {
    return safeError(
      new Error(
        `Failed to create refine arguments: ${error instanceof Error ? error.message : 'Unknown error'}`,
      ),
    )
  }
}
