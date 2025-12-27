/**
 * Implications and ImplicationsPair Serialization
 *
 * *** DO NOT REMOVE - GRAY PAPER FORMULA ***
 * Gray Paper Section: pvm_invocations.tex, equations 126-133
 * Formula (Equation 126):
 *
 * implications ≡ tuple{
 *   im_id: serviceid,           // Service account ID
 *   im_state: partialstate,     // Partial blockchain state
 *   im_nextfreeid: serviceid,   // Next free service ID
 *   im_xfers: defxfers,         // Deferred transfers
 *   im_yield: optional<hash>,   // Yield result (optional)
 *   im_provisions: protoset<tuple{serviceid, blob}> // Provisions
 * }
 *
 * ImplicationsPair = implications × implications
 * encode{ImplicationsPair} = encode{Implications} || encode{Implications}
 *
 * According to Gray Paper serialization rules (serialization.tex):
 * - Tuples are encoded as concatenation: encode{tuple{a, b}} = encode{a} || encode{b}
 * - Optional values use maybe{} discriminator: maybe{x} = {0 when x = none, ⟨1, x⟩ otherwise}
 * - Sequences use var{} discriminator: var{x} = ⟨len(x), x⟩
 * - Sets are encoded as sorted sequences
 *
 * *** IMPLEMENTER EXPLANATION ***
 * Implications represent the context state for PVM accumulation invocations.
 * They track partial state changes, deferred transfers, yield results, and provisions.
 *
 * ImplicationsPair contains two Implications:
 * - Regular dimension (imX): Normal execution path
 * - Exceptional dimension (imY): Used for checkpoint/rollback scenarios
 *
 * Field encoding order per Gray Paper:
 * 1. im_id: encode[4]{serviceid} (4-byte fixed-length)
 * 2. im_state: encode{partialstate} (complex structure)
 * 3. im_nextfreeid: encode[4]{serviceid} (4-byte fixed-length)
 * 4. im_xfers: encode{var{sequence{defxfer}}} (variable-length sequence)
 * 5. im_yield: encode{maybe{hash}} (optional 32-byte hash)
 * 6. im_provisions: encode{var{sequence{sorted(serviceid, blob)}}} (protected set as sorted sequence)
 */

import { concatBytes } from '@pbnjam/core'
import type {
  DecodingResult,
  IConfigService,
  Implications,
  ImplicationsPair,
  Safe,
} from '@pbnjam/types'
import { safeError, safeResult } from '@pbnjam/types'
import { decodeOptional, encodeOptional } from '../core/discriminator'
import { decodeFixedLength, encodeFixedLength } from '../core/fixed-length'
import { decodeNatural, encodeNatural } from '../core/natural-number'
import {
  decodeVariableSequence,
  encodeVariableSequence,
} from '../core/sequence'
import {
  decodeDeferredTransfer,
  encodeDeferredTransfer,
} from './deferred-transfer'
import { decodePartialState, encodePartialState } from './partial-state'

/**
 * Encode Implications according to Gray Paper specification.
 *
 * Gray Paper Equation 126-133:
 * encode{implications} ≡ encode{
 *   encode[4]{im_id},
 *   encode{im_state},
 *   encode[4]{im_nextfreeid},
 *   encode{var{im_xfers}},
 *   encode{maybe{im_yield}},
 *   encode{var{im_provisions}}
 * }
 *
 * @param implications - Implications to encode
 * @param configService - Configuration service for core/validator counts
 * @returns Encoded octet sequence
 */
export function encodeImplications(
  implications: Implications,
  configService: IConfigService,
): Safe<Uint8Array> {
  const parts: Uint8Array[] = []

  // im_id: encode[4]{serviceid} (4-byte fixed-length)
  const [error1, encodedId] = encodeFixedLength(implications.id, 4n)
  if (error1) {
    return safeError(error1)
  }
  parts.push(encodedId)

  // im_state: encode{partialstate}
  const [error2, encodedState] = encodePartialState(
    implications.state,
    configService,
  )
  if (error2) {
    return safeError(error2)
  }
  parts.push(encodedState)

  // im_nextfreeid: encode[4]{serviceid} (4-byte fixed-length)
  const [error3, encodedNextFreeId] = encodeFixedLength(
    implications.nextfreeid,
    4n,
  )
  if (error3) {
    return safeError(error3)
  }
  parts.push(encodedNextFreeId)

  // im_xfers: encode{var{sequence{defxfer}}}
  // var{x} = ⟨len(x), x⟩, so we encode length then sequence
  const [error4, encodedXfers] = encodeVariableSequence(
    implications.xfers,
    encodeDeferredTransfer,
  )
  if (error4) {
    return safeError(error4)
  }
  parts.push(encodedXfers)

  // im_yield: encode{maybe{hash}}
  // maybe{x} = {0 when x = none, ⟨1, x⟩ otherwise}
  // hash is 32 bytes
  const yieldHash = implications.yield
  const [error5, encodedYield] = encodeOptional(
    yieldHash,
    (hash: Uint8Array) => {
      if (hash.length !== 32) {
        return safeError(
          new Error(`Yield hash must be 32 bytes, got ${hash.length}`),
        )
      }
      return safeResult(hash)
    },
  )
  if (error5) {
    return safeError(error5)
  }
  parts.push(encodedYield)

  // im_provisions: encode{var{sequence{sorted(serviceid, blob)}}}
  // protoset is encoded as a sorted sequence of tuples
  // Each tuple is: encode[4]{serviceid} || encode{var{blob}}
  // The blob needs a length prefix since it's variable length
  // Set iteration returns values directly (no .entries() needed)
  const provisionsArray = Array.from(implications.provisions)
  // Gray Paper: protoset requires canonical sorted encoding
  // Sort by (serviceid, blob) lexicographically
  provisionsArray.sort((a, b) => {
    // First compare by serviceId
    if (a[0] < b[0]) return -1
    if (a[0] > b[0]) return 1
    // If serviceIds are equal, compare blobs lexicographically
    const minLen = Math.min(a[1].length, b[1].length)
    for (let i = 0; i < minLen; i++) {
      if (a[1][i] < b[1][i]) return -1
      if (a[1][i] > b[1][i]) return 1
    }
    // Shorter blob comes first if prefixes match
    return a[1].length - b[1].length
  })

  const [error6, encodedProvisions] = encodeVariableSequence(
    provisionsArray,
    ([serviceId, blob]: [bigint, Uint8Array]) => {
      const provisionParts: Uint8Array[] = []
      // encode[4]{serviceid}
      const [error, encodedId] = encodeFixedLength(serviceId, 4n)
      if (error) {
        return safeError(error)
      }
      provisionParts.push(encodedId)
      // encode{var{blob}} = encode{len(blob)} || blob
      const [lengthError, encodedLength] = encodeNatural(BigInt(blob.length))
      if (lengthError) {
        return safeError(lengthError)
      }
      provisionParts.push(encodedLength)
      // blob (identity encoding)
      provisionParts.push(blob)
      return safeResult(concatBytes(provisionParts))
    },
  )
  if (error6) {
    return safeError(error6)
  }
  parts.push(encodedProvisions)

  return safeResult(concatBytes(parts))
}

/**
 * Decode Implications according to Gray Paper specification.
 *
 * Gray Paper Equation 126-133:
 * decode{implications} ≡ decode{
 *   decode[4]{im_id},
 *   decode{im_state},
 *   decode[4]{im_nextfreeid},
 *   decode{var{im_xfers}},
 *   decode{maybe{im_yield}},
 *   decode{var{im_provisions}}
 * }
 *
 * @param data - Octet sequence to decode
 * @param configService - Configuration service for core/validator counts
 * @returns Decoded implications and remaining data
 */
export function decodeImplications(
  data: Uint8Array,
  configService: IConfigService,
): Safe<DecodingResult<Implications>> {
  let currentData = data

  // im_id: decode[4]{serviceid} (4-byte fixed-length)
  const [error1, idResult] = decodeFixedLength(currentData, 4n)
  if (error1) {
    return safeError(error1)
  }
  const id = idResult.value
  currentData = idResult.remaining

  // im_state: decode{partialstate}
  const [error2, stateResult] = decodePartialState(currentData, configService)
  if (error2) {
    return safeError(error2)
  }
  const state = stateResult.value
  currentData = stateResult.remaining

  // im_nextfreeid: decode[4]{serviceid} (4-byte fixed-length)
  const [error3, nextFreeIdResult] = decodeFixedLength(currentData, 4n)
  if (error3) {
    return safeError(error3)
  }
  const nextfreeid = nextFreeIdResult.value
  currentData = nextFreeIdResult.remaining

  // im_xfers: decode{var{sequence{defxfer}}}
  const [error4, xfersResult] = decodeVariableSequence(
    currentData,
    decodeDeferredTransfer,
  )
  if (error4) {
    return safeError(error4)
  }
  const xfers = xfersResult.value
  currentData = xfersResult.remaining

  // im_yield: decode{maybe{hash}}
  const [error5, yieldResult] = decodeOptional(
    currentData,
    (data: Uint8Array) => {
      if (data.length < 32) {
        return safeError(
          new Error(
            `Insufficient data for yield hash: need 32 bytes, got ${data.length}`,
          ),
        )
      }
      const hash = data.slice(0, 32)
      return safeResult({
        value: hash,
        remaining: data.slice(32),
        consumed: 32,
      })
    },
  )
  if (error5) {
    return safeError(error5)
  }
  const yieldHash = yieldResult.value
  currentData = yieldResult.remaining

  // im_provisions: decode{var{sequence{sorted(serviceid, blob)}}}
  // Each tuple is: encode[4]{serviceid} || encode{var{blob}}
  // The blob needs a length prefix since it's variable length
  const [error6, provisionsResult] = decodeVariableSequence(
    currentData,
    (data: Uint8Array) => {
      // Decode serviceid: encode[4]{serviceid}
      const [error, idResult] = decodeFixedLength(data, 4n)
      if (error) {
        return safeError(error)
      }
      const serviceId = idResult.value
      let remaining = idResult.remaining

      // Decode blob: encode{var{blob}} = encode{len(blob)} || blob
      // First decode the length (natural number)
      const [lengthError, lengthResult] = decodeNatural(remaining)
      if (lengthError) {
        return safeError(lengthError)
      }
      const blobLength = Number(lengthResult.value)
      remaining = lengthResult.remaining

      // Check we have enough data for the blob
      if (remaining.length < blobLength) {
        return safeError(
          new Error(
            `Insufficient data for provision blob: need ${blobLength} bytes, got ${remaining.length}`,
          ),
        )
      }

      // Decode the blob
      const blob = remaining.slice(0, blobLength)
      remaining = remaining.slice(blobLength)

      return safeResult({
        value: [serviceId, blob] as [bigint, Uint8Array],
        remaining,
        consumed: data.length - remaining.length,
      })
    },
  )
  if (error6) {
    return safeError(error6)
  }

  // Convert array of tuples to Set (Gray Paper: protoset<tuple{serviceid, blob}>)
  const provisions = new Set<[bigint, Uint8Array]>()
  for (const tuple of provisionsResult.value) {
    provisions.add(tuple)
  }
  currentData = provisionsResult.remaining

  const implications: Implications = {
    id,
    state,
    nextfreeid,
    xfers,
    yield: yieldHash,
    provisions,
  }

  return safeResult({
    value: implications,
    remaining: currentData,
    consumed: data.length - currentData.length,
  })
}

/**
 * Encode ImplicationsPair according to Gray Paper specification.
 *
 * Gray Paper: ImplicationsPair = implications × implications
 * encode{ImplicationsPair} = encode{Implications} || encode{Implications}
 *
 * According to Gray Paper serialization.tex:
 * encode{tuple{a, b}} = encode{a} || encode{b}
 *
 * @param pair - ImplicationsPair to encode
 * @param configService - Configuration service for core/validator counts
 * @returns Encoded octet sequence
 */
export function encodeImplicationsPair(
  pair: ImplicationsPair,
  configService: IConfigService,
): Safe<Uint8Array> {
  // Encode regular dimension (first element)
  const [error1, encodedRegular] = encodeImplications(pair[0], configService)
  if (error1) {
    return safeError(error1)
  }

  // Encode exceptional dimension (second element)
  const [error2, encodedExceptional] = encodeImplications(
    pair[1],
    configService,
  )
  if (error2) {
    return safeError(error2)
  }

  // Concatenate: encode{regular} || encode{exceptional}
  return safeResult(concatBytes([encodedRegular, encodedExceptional]))
}

/**
 * Decode ImplicationsPair according to Gray Paper specification.
 *
 * Gray Paper: ImplicationsPair = implications × implications
 * decode{ImplicationsPair} = decode{Implications} || decode{Implications}
 *
 * @param data - Octet sequence to decode
 * @param configService - Configuration service for core/validator counts
 * @returns Decoded implications pair and remaining data
 */
export function decodeImplicationsPair(
  data: Uint8Array,
  configService: IConfigService,
): Safe<DecodingResult<ImplicationsPair>> {
  // Decode regular dimension (first element)
  const [error1, regularResult] = decodeImplications(data, configService)
  if (error1) {
    return safeError(error1)
  }
  const regular = regularResult.value
  const regularRemaining = regularResult.remaining

  // Decode exceptional dimension (second element)
  const [error2, exceptionalResult] = decodeImplications(
    regularRemaining,
    configService,
  )
  if (error2) {
    return safeError(error2)
  }
  const exceptional = exceptionalResult.value
  const exceptionalRemaining = exceptionalResult.remaining

  const pair: ImplicationsPair = [regular, exceptional]

  return safeResult({
    value: pair,
    remaining: exceptionalRemaining,
    consumed: data.length - exceptionalRemaining.length,
  })
}
