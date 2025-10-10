/**
 * TheTime serialization
 *
 * *** DO NOT REMOVE - GRAY PAPER FORMULA ***
 * Gray Paper Section: merklization.tex (Equation C(11))
 * Formula:
 *
 * C(11) ↦ encode[4]{thetime}
 *
 * The time represents the current block timestamp in the JAM protocol.
 * It's used for temporal ordering, epoch calculations, and time-based
 * state transitions.
 *
 * Structure per Gray Paper Equation (merklization.tex:59):
 * - thetime ∈ timeslot
 * - timeslot: 4-byte unsigned integer representing block timestamp
 *
 * Encoding:
 * - Fixed-length 4-byte little-endian encoding
 * - Represents block timestamp in seconds since epoch
 *
 * ✅ CORRECT: Uses encode[4]{thetime} per Gray Paper C(11)
 * ✅ CORRECT: 4-byte fixed-length little-endian encoding
 * ✅ CORRECT: Supports temporal ordering and epoch calculations
 *
 * Implements Gray Paper thetime serialization as specified
 * Reference: graypaper/text/merklization.tex
 *
 * *** IMPLEMENTER EXPLANATION ***
 * TheTime tracks the current block timestamp for temporal operations.
 * This is critical for epoch calculations and time-based state transitions.
 *
 * Core components:
 * - **timestamp**: Block timestamp as 4-byte unsigned integer
 * - **encoding**: Fixed-length 4-byte little-endian format
 *
 * Serialization format:
 * 1. **encode[4]{thetime}**: 4-byte fixed-length little-endian encoding
 *
 * This is critical for JAM's temporal ordering and epoch management.
 */

import { type Safe, safeError, safeResult } from '@pbnj/core'
import type { DecodingResult } from '@pbnj/types'

/**
 * Encode the time according to Gray Paper C(11):
 * encode[4]{thetime}
 */
export function encodeTheTime(theTime: bigint): Safe<Uint8Array> {
  try {
    // Gray Paper: encode[4]{thetime} - 4-byte fixed-length little-endian encoding
    const timeBytes = new Uint8Array(4)
    const view = new DataView(timeBytes.buffer)
    view.setUint32(0, Number(theTime), true) // little-endian

    return safeResult(timeBytes)
  } catch (error) {
    return safeError(error as Error)
  }
}

/**
 * Decode the time according to Gray Paper C(11):
 * decode[4]{thetime}
 */
export function decodeTheTime(data: Uint8Array): Safe<DecodingResult<bigint>> {
  try {
    // Gray Paper: decode[4]{thetime} - 4-byte fixed-length little-endian decoding
    if (data.length < 4) {
      return safeError(new Error('Insufficient data for thetime'))
    }

    const timeBytes = data.slice(0, 4)
    const view = new DataView(timeBytes.buffer)
    const theTime = BigInt(view.getUint32(0, true)) // little-endian

    return safeResult({
      value: theTime,
      remaining: data.slice(4),
      consumed: 4,
    })
  } catch (error) {
    return safeError(error as Error)
  }
}
