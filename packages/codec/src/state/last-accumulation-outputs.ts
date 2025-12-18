/**
 * LastAccountOut serialization
 *
 * *** DO NOT REMOVE - GRAY PAPER FORMULA ***
 * Gray Paper Section: merklization.tex (Equation C(16))
 * Formula:
 *
 * C(16) ↦ encode{var{sq{build{tuple{encode[4]{s}, encode{h}}}{tuple{s, h} ∈ lastaccout}}}}
 *
 * The last account out tracks the most recent account outputs from accumulation
 * operations. It maintains a history of service account outputs for auditing
 * and state transition verification.
 *
 * Structure per Gray Paper Equation (merklization.tex:84):
 * - lastaccout ∈ sequence{tuple{serviceid, hash}}
 * - Each entry: tuple{encode[4]{s}, encode{h}} where s ∈ serviceid, h ∈ hash
 *
 * Encoding:
 * - Variable-length sequence of last account out entries
 * - Each entry: tuple{encode[4]{serviceId}, encode{hash}}
 * - serviceId: 4-byte fixed-length service identifier
 * - hash: 32-byte account output hash
 *
 * ✅ CORRECT: Encodes variable-length sequence per Gray Paper C(16)
 * ✅ CORRECT: Uses tuple{encode[4]{s}, encode{h}} structure
 * ✅ CORRECT: Supports accumulation output tracking and auditing
 *
 * Implements Gray Paper lastaccout serialization as specified
 * Reference: graypaper/text/merklization.tex
 *
 * *** IMPLEMENTER EXPLANATION ***
 * LastAccountOut tracks the most recent account outputs from accumulation
 * operations. This is critical for auditing and state transition verification.
 *
 * Core components:
 * - **serviceId**: 4-byte service identifier
 * - **hash**: 32-byte account output hash
 * - **sequence**: Variable-length sequence of account outputs
 *
 * Serialization format:
 * 1. **var{sq{...}}**: Variable-length sequence with natural number length prefix
 * 2. **tuple{encode[4]{s}, encode{h}}**: Each entry as tuple of service ID and hash
 *
 * This is critical for JAM's accumulation output tracking and audit trail.
 */

import { bytesToHex, concatBytes, type Hex, hexToBytes } from '@pbnjam/core'
import type {
  DecodingResult,
  LastAccumulationOutput,
  Safe,
} from '@pbnjam/types'
import { safeError, safeResult } from '@pbnjam/types'
import {
  decodeVariableSequence,
  encodeVariableSequence,
} from '../core/sequence'

/**
 * Encode last account out according to Gray Paper C(16):
 * var{sq{build{tuple{encode[4]{s}, encode{h}}}{tuple{s, h} ∈ lastaccout}}}
 */
export function encodeLastAccumulationOutputs(
  lastAccumulationOutput: Map<bigint, Hex>,
): Safe<Uint8Array> {
  try {
    // Gray Paper: var{sq{build{tuple{encode[4]{s}, encode{h}}}{tuple{s, h} ∈ lastaccout}}}
    // Variable-length sequence of tuples
    const [error, encodedData] = encodeVariableSequence(
      Array.from(lastAccumulationOutput.entries()).map(([serviceId, hash]) => ({
        serviceId,
        hash,
      })),
      (item: LastAccumulationOutput) => {
        const parts: Uint8Array[] = []

        // Gray Paper: encode[4]{s} - 4-byte fixed-length service ID
        const serviceIdBytes = new Uint8Array(4)
        const view = new DataView(serviceIdBytes.buffer)
        view.setUint32(0, Number(item.serviceId), true) // little-endian
        parts.push(serviceIdBytes)

        // Gray Paper: encode{h} - 32-byte hash
        parts.push(hexToBytes(item.hash))

        return safeResult(concatBytes(parts))
      },
    )
    if (error) return safeError(error)

    return safeResult(encodedData)
  } catch (error) {
    return safeError(error as Error)
  }
}

/**
 * Decode last account out according to Gray Paper C(16):
 * var{sq{build{tuple{encode[4]{s}, encode{h}}}{tuple{s, h} ∈ lastaccout}}}
 */
export function decodeLastAccumulationOutputs(
  data: Uint8Array,
): Safe<DecodingResult<LastAccumulationOutput[]>> {
  try {
    // Gray Paper: decode var{sq{build{tuple{encode[4]{s}, encode{h}}}{tuple{s, h} ∈ lastaccout}}}
    // Variable-length sequence of tuples
    const [error, decodedData] = decodeVariableSequence<LastAccumulationOutput>(
      data,
      (itemData: Uint8Array) => {
        // Gray Paper: decode tuple{encode[4]{s}, encode{h}}
        if (itemData.length < 36) {
          // 4 bytes serviceId + 32 bytes hash
          return safeError(
            new Error('Insufficient data for last accumulation output entry'),
          )
        }

        // Decode encode[4]{s} - 4-byte fixed-length service ID
        const serviceIdBytes = itemData.slice(0, 4)
        const view = new DataView(serviceIdBytes.buffer)
        const serviceId = BigInt(view.getUint32(0, true)) // little-endian

        // Decode encode{h} - 32-byte hash
        const hashBytes = itemData.slice(4, 36)
        const hash = bytesToHex(hashBytes)

        const remaining = itemData.slice(36)

        return safeResult({
          value: { serviceId, hash },
          remaining,
          consumed: 36,
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
