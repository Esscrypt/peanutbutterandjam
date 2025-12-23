/**
 * Ready Serialization
 *
 * *** DO NOT REMOVE - GRAY PAPER FORMULA ***
 * Gray Paper Section: Chapter 14 - Ready Work Reports
 * Formula (Equation 34, C(14)):
 *
 * ready ∈ sequence[C_epochlen]{sequence{⟨workreport, protoset{hash}⟩}}
 *
 * C(14) ↦ encode{
 *   sequence{
 *     var{sequence{⟨request, var{data}⟩}}
 *   }
 * }
 *
 * Ready work-reports are reports that are ready for accumulation processing.
 * Each ready item contains a work report and its unaccumulated dependencies.
 * The structure is a sequence of epoch slots, each containing a sequence of ready items.
 *
 * Structure per Gray Paper:
 * - Outer sequence: epoch slots (fixed length C_epochlen)
 * - Inner sequence: ready items per slot (variable length with length prefix)
 * - Each ready item: ⟨workreport, protoset{hash}⟩ tuple
 *   - workreport: the work report data
 *   - protoset{hash}: set of work-package hashes (dependencies)
 *
 * Encoding:
 * - Each epoch slot is encoded as a variable-length sequence
 * - Each ready item is encoded as a tuple with variable-length data
 * - Uses proper Gray Paper var{} notation with length discriminators
 *
 * ✅ CORRECT: Encodes ready work-reports with proper Gray Paper structure
 * ✅ CORRECT: Uses variable-length sequences with length prefixes
 * ✅ CORRECT: Handles work report and dependency set properly
 */

import { bytesToHex, concatBytes, type Hex, hexToBytes } from '@pbnjam/core'
import type {
  DecodingResult,
  IConfigService,
  Ready,
  ReadyItem,
  Safe,
  WorkReport,
} from '@pbnjam/types'
import { safeError, safeResult } from '@pbnjam/types'
import {
  decodeSequenceGeneric,
  decodeVariableSequence,
  encodeSequenceGeneric,
  encodeVariableSequence,
} from '../core/sequence'
import { decodeWorkReport, encodeWorkReport } from '../work-package/work-report'

/**
 * Encode a single ready item according to Gray Paper:
 * ⟨workreport, protoset{hash}⟩
 */
function encodeReadyItem(
  workReport: WorkReport,
  dependencies: Set<Hex>,
): Safe<Uint8Array> {
  const parts: Uint8Array[] = []

  // Encode work report as variable-length data
  const [error1, workReportData] = encodeWorkReport(workReport)
  if (error1) return safeError(error1)
  parts.push(workReportData)

  // Encode dependencies as variable-length sequence of hashes
  const dependencyArray = Array.from(dependencies)
  const [error2, dependenciesData] = encodeVariableSequence(
    dependencyArray,
    (hash: Hex) => {
      // Convert hex string to bytes using hexToBytes
      return safeResult(hexToBytes(hash))
    },
  )
  if (error2) return safeError(error2)
  parts.push(dependenciesData)

  return safeResult(concatBytes(parts))
}

/**
 * Decode a single ready item according to Gray Paper:
 * ⟨workreport, protoset{hash}⟩
 */
function decodeReadyItem(data: Uint8Array): Safe<DecodingResult<ReadyItem>> {
  let currentData = data

  // Decode work report
  const [error1, workReportResult] = decodeWorkReport(currentData)
  if (error1) return safeError(error1)
  currentData = workReportResult.remaining

  // Decode dependencies as variable-length sequence of hashes
  const [error2, dependenciesResult] = decodeVariableSequence<Hex>(
    currentData,
    (data) => {
      if (data.length < 32) {
        return safeError(new Error('Insufficient data for hash decoding'))
      }

      // Convert bytes to hex string
      const hashBytes = data.slice(0, 32)
      const hashHex = bytesToHex(hashBytes)

      return safeResult({
        value: hashHex,
        remaining: data.slice(32),
        consumed: 32,
      })
    },
  )
  if (error2) return safeError(error2)
  currentData = dependenciesResult.remaining

  const dependencies = new Set(dependenciesResult.value)

  return safeResult({
    value: { workReport: workReportResult.value, dependencies },
    remaining: currentData,
    consumed: data.length - currentData.length,
  })
}

/**
 * Encode ready according to Gray Paper equation 34 and C(14):
 * ready ∈ sequence[C_epochlen]{sequence{⟨workreport, protoset{hash}⟩}}
 */
export function encodeReady(
  ready: Ready,
  configService: IConfigService,
): Safe<Uint8Array> {
  // Ensure we have exactly C_epochlen slots (pad with empty arrays if needed)
  if (
    ready.epochSlots.keys().toArray().length !== configService.epochDuration
  ) {
    return safeError(new Error('Invalid epoch slots length'))
  }

  // Encode each epoch slot as a variable-length sequence of ready items
  // Outer sequence is fixed-length (C_epochlen), inner sequences are variable-length
  const [error, encodedData] = encodeSequenceGeneric(
    ready.epochSlots.values().toArray(),
    (slotItems) => {
      // Encode the slot as a variable-length sequence of ready items
      return encodeVariableSequence(slotItems, (item) =>
        encodeReadyItem(item.workReport, item.dependencies),
      )
    },
  )
  if (error) return safeError(error)

  return safeResult(encodedData)
}

/**
 * Decode ready according to Gray Paper equation 34 and C(14):
 * ready ∈ sequence[C_epochlen]{sequence{⟨workreport, protoset{hash}⟩}}
 */
export function decodeReady(
  data: Uint8Array,
  configService: IConfigService,
): Safe<DecodingResult<Ready>> {
  // Decode as fixed-length sequence of epoch slots
  // Outer sequence is fixed-length (C_epochlen), inner sequences are variable-length
  const [error, result] = decodeSequenceGeneric<ReadyItem[]>(
    data,
    (slotData) => {
      // Decode each slot as a variable-length sequence of ready items
      return decodeVariableSequence<ReadyItem>(slotData, decodeReadyItem)
    },
    configService.epochDuration, // Fixed length: C_epochlen
  )
  if (error) {
    return safeError(error)
  }

  const ready: Ready = {
    epochSlots: result.value,
  }

  return safeResult({
    value: ready,
    remaining: result.remaining,
    consumed: result.consumed,
  })
}
