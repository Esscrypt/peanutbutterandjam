/**
 * Accumulated serialization
 *
 * *** DO NOT REMOVE - GRAY PAPER FORMULA ***
 * Gray Paper Section: merklization.tex (Equation C(15))
 * Formula:
 *
 * C(15) ↦ encode{sq{build{var{i}}{i ∈ accumulated}}}
 *
 * Gray Paper Section: accumulation.tex (Equation 27)
 * Formula:
 *
 * accumulated ∈ sequence[C_epochlen]{protoset{hash}}
 *
 * The accumulated state tracks work-packages that have been successfully
 * accumulated during the current epoch. It maintains a history of accumulated
 * work-package hashes for dependency resolution.
 *
 * Structure per Gray Paper Equation (accumulation.tex:27):
 * - accumulated ∈ sequence[C_epochlen]{protoset{hash}}
 * - C_epochlen = epoch length (from config service)
 * - Each item: variable-length accumulated data
 *
 * Encoding:
 * - Variable-length sequence of accumulated items
 * - Each item: var{i} = tuple{len{i}, i} with natural number length prefix
 * - Items represent accumulated work-package data
 *
 * ✅ CORRECT: Encodes variable-length sequence per Gray Paper C(15)
 * ✅ CORRECT: Uses var{i} encoding for each accumulated item
 * ✅ CORRECT: Supports dependency resolution and work-package tracking
 *
 * Implements Gray Paper accumulated serialization as specified
 * Reference: graypaper/text/merklization.tex and accumulation.tex
 *
 * *** IMPLEMENTER EXPLANATION ***
 * Accumulated tracks work-packages that have been successfully processed
 * during the current epoch. This is critical for dependency resolution.
 *
 * Core components:
 * - **data**: Variable-length blob containing accumulated work-package data
 * - **sequence**: Variable-length sequence of accumulated items
 *
 * Serialization format:
 * 1. **var{sq{...}}**: Variable-length sequence with natural number length prefix
 * 2. **var{i}**: Each item encoded as tuple{len{i}, i} with natural number length prefix
 *
 * This is critical for JAM's work-package dependency resolution and accumulation tracking.
 */

import { concatBytes, type Safe, safeError, safeResult } from '@pbnj/core'
import type { AccumulatedItem, DecodingResult } from '@pbnj/types'
import { decodeNatural, encodeNatural } from '../core/natural-number'
import {
  decodeVariableSequence,
  encodeVariableSequence,
} from '../core/sequence'

/**
 * Encode accumulated according to Gray Paper C(15):
 * sq{build{var{i}}{i ∈ accumulated}}
 */
export function encodeAccumulated(
  accumulated: AccumulatedItem[],
): Safe<Uint8Array> {
  try {
    // Gray Paper: sq{build{var{i}}{i ∈ accumulated}}
    // Variable-length sequence of variable-length accumulated items
    const [error, encodedData] = encodeVariableSequence(
      accumulated,
      (item: AccumulatedItem) => {
        // Gray Paper: var{i} - variable-length blob with natural number length prefix
        // var{x} ≡ tuple{len{x}, x} thus encode{var{x}} ≡ encode{len{x}} ∥ encode{x}
        const [lengthError, lengthEncoded] = encodeNatural(
          BigInt(item.data.length),
        )
        if (lengthError) {
          return safeError(lengthError)
        }

        return safeResult(concatBytes([lengthEncoded, item.data]))
      },
    )
    if (error) return safeError(error)

    return safeResult(encodedData)
  } catch (error) {
    return safeError(error as Error)
  }
}

/**
 * Decode accumulated according to Gray Paper C(15):
 * sq{build{var{i}}{i ∈ accumulated}}
 */
export function decodeAccumulated(
  data: Uint8Array,
): Safe<DecodingResult<AccumulatedItem[]>> {
  try {
    // Gray Paper: decode sq{build{var{i}}{i ∈ accumulated}}
    // Variable-length sequence of variable-length accumulated items
    const [error, decodedData] = decodeVariableSequence(
      data,
      (itemData: Uint8Array) => {
        // Gray Paper: decode var{i} - variable-length blob with natural number length prefix
        // var{x} ≡ tuple{len{x}, x} thus decode{var{x}} ≡ decode{len{x}} ∥ decode{x}
        const [lengthError, lengthResult] = decodeNatural(itemData)
        if (lengthError) {
          return safeError(lengthError)
        }

        const length = Number(lengthResult.value)
        const remainingAfterLength = lengthResult.remaining

        if (remainingAfterLength.length < length) {
          return safeError(new Error('Insufficient data for accumulated item'))
        }

        const itemBytes = remainingAfterLength.slice(0, length)
        const remaining = remainingAfterLength.slice(length)

        return safeResult({
          value: { data: itemBytes },
          remaining,
          consumed: itemData.length - remaining.length,
        })
      },
    )
    if (error) return safeError(error)

    return safeResult({
      value: decodedData.value,
      remaining: decodedData.remaining,
      consumed: decodedData.consumed,
    })
  } catch (error) {
    return safeError(error as Error)
  }
}
