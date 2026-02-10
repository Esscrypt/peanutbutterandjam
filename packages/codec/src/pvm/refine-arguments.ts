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
 * Refine Arguments structure (GP encode = concat of encodings):
 * 1. **Core index (c)**: encode(c) — variable-length natural (GP eq 29–37)
 * 2. **Work item index (i)**: encode(i) — variable-length natural
 * 3. **Service index (w_wi¬serviceindex)**: encode(serviceindex) — variable-length natural
 * 4. **var{w_wi¬payload}**: encode{var{x}} = encode{len(x)} concat encode{x} — length as variable-length natural, then payload blob
 * 5. **blake{p}**: 32-byte Blake2b hash of encoded work package
 *
 * Key concepts:
 * - **Core assignment**: Which core is performing the refinement
 * - **Work item identification**: Which specific item to refine
 * - **Service context**: Which service code to execute
 * - **Authorizer trace**: Variable-length authorization data
 * - **Package integrity**: Hash ensures work package hasn't changed
 *
 * Variable encoding (GP serialization eq 51):
 * - **var{w_wi¬payload}**: encode{len(payload)} (variable-length natural) + payload data
 * - **blake{p}**: 32-byte Blake2b hash of encoded work package
 *
 * This structure enables the PVM to execute refine operations with
 * complete context and integrity verification.
 */

import { blake2bHash, concatBytes, hexToBytes } from '@pbnjam/core'
import type { DecodingResult, Safe, WorkItem, WorkPackage } from '@pbnjam/types'
import { safeError, safeResult } from '@pbnjam/types'
import { decodeNatural, encodeNatural } from '../core/natural-number'
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
    // 1. Core index (c) — encode(c) variable-length natural (GP)
    const [coreErr, coreIndexBytes] = encodeNatural(coreIndex)
    if (coreErr) return safeError(coreErr)

    // 2. Work item index (i) — encode(i) variable-length natural (GP)
    const [workItemErr, workItemIndexBytes] = encodeNatural(workItemIndex)
    if (workItemErr) return safeError(workItemErr)

    // 3. Service index (w_wi¬serviceindex) — encode(serviceindex) variable-length natural (GP)
    const [serviceErr, serviceIndexBytes] = encodeNatural(workItem.serviceindex)
    if (serviceErr) return safeError(serviceErr)

    // 4. var{w_wi¬payload} = encode{len(payload)} concat payload (GP eq 51)
    const [payloadLenErr, payloadLengthBytes] = encodeNatural(
      BigInt(workItem.payload.length),
    )
    if (payloadLenErr) return safeError(payloadLenErr)

    // 5. Blake hash of work package (blake{p}) — 32-byte hash
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

    // Concatenate all parts: encode(c) || encode(i) || encode(serviceindex) || var{payload} || blake{p}
    const parts = [
      coreIndexBytes,
      workItemIndexBytes,
      serviceIndexBytes,
      payloadLengthBytes,
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
    if (data.length < 1 + 1 + 1 + 1 + 32) {
      return safeError(new Error('Insufficient data for refine arguments'))
    }

    let offset = 0
    let rest = data

    // 1. Core index (c) — variable-length natural
    const [coreErr, coreDec] = decodeNatural(rest)
    if (coreErr) return safeError(coreErr)
    const coreIndex = coreDec!.value
    offset += coreDec!.consumed
    rest = coreDec!.remaining

    // 2. Work item index (i) — variable-length natural
    const [workItemErr, workItemDec] = decodeNatural(rest)
    if (workItemErr) return safeError(workItemErr)
    const workItemIndex = workItemDec!.value
    offset += workItemDec!.consumed
    rest = workItemDec!.remaining

    // 3. Service index — variable-length natural
    const [serviceErr, serviceDec] = decodeNatural(rest)
    if (serviceErr) return safeError(serviceErr)
    const serviceIndex = serviceDec!.value
    offset += serviceDec!.consumed
    rest = serviceDec!.remaining

    // 4. var{payload} — length (variable-length natural) + payload
    const [lenErr, lenDec] = decodeNatural(rest)
    if (lenErr) return safeError(lenErr)
    const payloadLength = Number(lenDec!.value)
    offset += lenDec!.consumed
    rest = lenDec!.remaining

    if (payloadLength < 0 || rest.length < payloadLength + 32) {
      return safeError(new Error('Invalid payload length in refine arguments'))
    }

    const payload = rest.slice(0, payloadLength)
    offset += payloadLength
    rest = rest.slice(payloadLength)

    // 5. Work package hash (32 bytes)
    const workPackageHash = rest.slice(0, 32)
    offset += 32
    rest = rest.slice(32)

    const result: RefineArguments = {
      coreIndex,
      workItemIndex,
      serviceIndex,
      payload,
      workPackageHash,
    }

    return safeResult({
      value: result,
      remaining: rest,
      consumed: offset,
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
