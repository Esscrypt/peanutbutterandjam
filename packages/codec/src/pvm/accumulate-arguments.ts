/**
 * Accumulate Arguments Serialization
 *
 * *** DO NOT REMOVE - GRAY PAPER FORMULA ***
 * Gray Paper Section: pvm_invocations.tex equation 163
 * Formula: encode{t, s, len(i)}
 *
 * All values use variable-length natural number encoding (encodeNatural):
 * - t (timeslot): encodeNatural
 * - s (serviceId): encodeNatural
 * - len(i) (input length): encodeNatural
 *
 * Note: This differs from fixed-length encodings used elsewhere (e.g. encode[4] in headers).
 * The general encode{} notation uses variable-length encoding.
 *
 * *** IMPLEMENTER EXPLANATION ***
 * Accumulate arguments encode the parameters needed to execute an accumulation invocation:
 * - Timeslot: Current block's timeslot
 * - Service ID: The service account ID being accumulated
 * - Input length: Length of the accumulate inputs sequence
 *
 * All three values use variable-length natural number encoding for space efficiency.
 */

import type { DecodingResult, Safe } from '@pbnjam/types'
import { safeError, safeResult } from '@pbnjam/types'
import { decodeNatural } from '../core/natural-number'

/**
 * Decoded accumulate arguments structure
 */
export interface DecodedAccumulateArgs {
  timeslot: bigint
  serviceId: bigint
  inputLength: bigint
}

/**
 * Decode accumulate arguments according to Gray Paper specification
 *
 * Gray Paper pvm_invocations.tex equation 163: encode{t, s, len(i)}
 * All values use variable-length natural number encoding (decodeNatural):
 * - t (timeslot): decodeNatural (variable)
 * - s (serviceId): decodeNatural (variable)
 * - len(i) (input length): decodeNatural (variable)
 *
 * Note: This differs from fixed-length encodings used elsewhere (e.g. encode[4] in headers).
 * The general encode{} notation uses variable-length encoding.
 *
 * @param args - Encoded accumulate arguments
 * @returns Decoding result with timeslot, serviceId, and inputLength, or error if decoding fails
 */
export function decodeAccumulateArgs(
  args: Uint8Array,
): Safe<DecodingResult<DecodedAccumulateArgs>> {
  if (args.length < 1) {
    return safeError(new Error('Insufficient data for accumulate arguments'))
  }

  let offset = 0

  // 1. Decode timeslot - Gray Paper: encode{t} (variable-length natural number)
  const timeslotResult = decodeNatural(args.slice(offset))
  if (timeslotResult[0]) {
    return safeError(
      new Error(`Failed to decode timeslot: ${timeslotResult[0].message}`),
    )
  }
  const timeslot = timeslotResult[1].value
  offset += timeslotResult[1].consumed

  // 2. Decode service ID - Gray Paper: encode{s} (variable-length natural number)
  if (offset >= args.length) {
    return safeError(new Error('Insufficient data for service ID'))
  }
  const serviceIdResult = decodeNatural(args.slice(offset))
  if (serviceIdResult[0]) {
    return safeError(
      new Error(`Failed to decode service ID: ${serviceIdResult[0].message}`),
    )
  }
  const serviceId = serviceIdResult[1].value
  offset += serviceIdResult[1].consumed

  // 3. Decode input length - Gray Paper: encode{len(i)} (variable-length natural number)
  if (offset >= args.length) {
    return safeError(new Error('Insufficient data for input length'))
  }
  const inputLengthResult = decodeNatural(args.slice(offset))
  if (inputLengthResult[0]) {
    return safeError(
      new Error(
        `Failed to decode input length: ${inputLengthResult[0].message}`,
      ),
    )
  }
  const inputLength = inputLengthResult[1].value
  offset += inputLengthResult[1].consumed

  return safeResult({
    value: {
      timeslot,
      serviceId,
      inputLength,
    },
    remaining: args.slice(offset),
    consumed: offset,
  })
}
