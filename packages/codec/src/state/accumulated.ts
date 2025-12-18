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

import { bytesToHex, concatBytes, hexToBytes } from '@pbnjam/core'
import type {
  Accumulated,
  AccumulatedItem,
  DecodingResult,
  IConfigService,
  Safe,
} from '@pbnjam/types'
import { safeError, safeResult } from '@pbnjam/types'
import type { Hex } from 'viem'
import { decodeNatural, encodeNatural } from '../core/natural-number'
import { decodeSequenceGeneric, encodeSequenceGeneric } from '../core/sequence'

/**
 * Convert Accumulated to AccumulatedItem[]
 * Each Set<Hex> is converted to concatenated 32-byte hashes
 */
function convertAccumulatedToAccumulatedItems(
  accumulated: Accumulated,
): AccumulatedItem[] {
  return accumulated.packages.map((hashes) => {
    if (hashes.size === 0) {
      return { data: new Uint8Array(0) }
    }

    // Concatenate all hashes into a single byte array
    const hashArrays: Uint8Array[] = []
    for (const hash of hashes) {
      const hashBytes = hexToBytes(hash)
      hashArrays.push(hashBytes)
    }

    const data = concatBytes(hashArrays)
    return { data }
  })
}

/**
 * Encode accumulated according to Gray Paper C(15):
 * sq{build{var{i}}{i ∈ accumulated}}
 *
 * Gray Paper: accumulated ∈ sequence[C_epochlen]{protoset{hash}}
 * This is a FIXED-LENGTH sequence of C_epochlen elements (no sequence length prefix)
 * Each element i is encoded as var{i} (variable-length with length prefix)
 */
export function encodeAccumulated(
  accumulated: Accumulated,
  configService: IConfigService,
): Safe<Uint8Array> {
  try {
    // Gray Paper: accumulated ∈ sequence[C_epochlen]{protoset{hash}}
    // This is a FIXED-LENGTH sequence, so we encode exactly C_epochlen elements
    const epochLen = configService.epochDuration

    // Handle undefined or null accumulated
    if (!accumulated || !accumulated.packages) {
      // Return empty accumulated (all empty sets)
      const emptyAccumulated: Accumulated = {
        packages: new Array(epochLen).fill(null).map(() => new Set<Hex>()),
      }
      accumulated = emptyAccumulated
    }

    // Convert Accumulated to AccumulatedItem[]
    const items = convertAccumulatedToAccumulatedItems(accumulated)

    // Pad or truncate to exactly C_epochlen elements
    const paddedAccumulated = Array.from(items)
    while (paddedAccumulated.length < epochLen) {
      paddedAccumulated.push({ data: new Uint8Array(0) })
    }
    const accumulatedToEncode = paddedAccumulated.slice(0, epochLen)

    // Gray Paper: sq{build{var{i}}{i ∈ accumulated}}
    // Fixed-length sequence (no length prefix), each element encoded as var{i}
    const [error, encodedData] = encodeSequenceGeneric(
      accumulatedToEncode,
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
 * Convert AccumulatedItem[] to Accumulated
 * Each AccumulatedItem.data contains concatenated 32-byte hashes
 */
function convertAccumulatedItemsToAccumulated(
  items: AccumulatedItem[],
): Accumulated {
  const packages: Set<Hex>[] = items.map((item) => {
    const hashes = new Set<Hex>()
    const data = item.data

    // Each hash is 32 bytes, split data into 32-byte chunks
    for (let i = 0; i < data.length; i += 32) {
      if (i + 32 <= data.length) {
        const hashBytes = data.slice(i, i + 32)
        const hashHex = bytesToHex(hashBytes)
        hashes.add(hashHex)
      }
    }

    return hashes
  })

  return { packages }
}

/**
 * Decode accumulated according to Gray Paper C(15):
 * sq{build{var{i}}{i ∈ accumulated}}
 *
 * Gray Paper: accumulated ∈ sequence[C_epochlen]{protoset{hash}}
 * This is a FIXED-LENGTH sequence of C_epochlen elements (no sequence length prefix)
 * Each element i is decoded as var{i} (variable-length with length prefix)
 *
 * Returns Accumulated directly (not AccumulatedItem[])
 */
export function decodeAccumulated(
  data: Uint8Array,
  configService: IConfigService,
): Safe<DecodingResult<Accumulated>> {
  // Gray Paper: accumulated ∈ sequence[C_epochlen]{protoset{hash}}
  // This is a FIXED-LENGTH sequence, so we decode exactly C_epochlen elements
  const epochLen = configService.epochDuration

  // Gray Paper: decode sq{build{var{i}}{i ∈ accumulated}}
  // Fixed-length sequence (no length prefix), each element decoded as var{i}
  const [error, decodedData] = decodeSequenceGeneric<AccumulatedItem>(
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
    epochLen,
  )
  if (error) return safeError(error)

  // Convert AccumulatedItem[] to Accumulated
  const accumulated = convertAccumulatedItemsToAccumulated(decodedData.value)

  return safeResult({
    value: accumulated,
    remaining: decodedData.remaining,
    consumed: decodedData.consumed,
  })
}
