/**
 * Guarantee Serialization
 *
 * Implements guarantee encoding from Gray Paper Appendix D.2
 * encode[G](xtguarantees) - Variable-length guarantee sequence
 */

import { decodeFixedLength, encodeFixedLength } from '../core/fixed-length'
import { decodeNatural, encodeNatural } from '../core/natural-number'
import { decodeSequenceGeneric, encodeSequenceGeneric } from '../core/sequence'
import type { Credential, Guarantee, OctetSequence } from '../types'
import { decodeWorkReport, encodeWorkReport } from '../work-package/work-report'

/**
 * Encode single credential using Gray Paper encoding
 *
 * Formula from Gray Paper:
 * encode(credential) ≡ encode{encode[2](v), s}
 *
 * @param credential - Credential to encode
 * @returns Encoded octet sequence
 */
function encodeCredential(credential: Credential): OctetSequence {
  const parts: OctetSequence[] = []

  // Value: encode[2](v)
  parts.push(encodeFixedLength(credential.value, 2))

  // Signature: s (variable-length octet sequence)
  parts.push(encodeNatural(BigInt(credential.signature.length))) // Length prefix
  parts.push(credential.signature)

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
 * Decode single credential using Gray Paper encoding
 *
 * @param data - Octet sequence to decode
 * @returns Decoded credential and remaining data
 */
function decodeCredential(data: OctetSequence): {
  value: Credential
  remaining: OctetSequence
} {
  let currentData = data

  // Value: encode[2](v)
  const { value: credentialValue, remaining: valueRemaining } =
    decodeFixedLength(currentData, 2)
  currentData = valueRemaining

  // Signature: s (variable-length octet sequence)
  const { value: signatureLength, remaining: signatureLengthRemaining } =
    decodeNatural(currentData)
  const signatureLengthNum = Number(signatureLength)
  if (signatureLengthRemaining.length < signatureLengthNum) {
    throw new Error('Insufficient data for credential signature decoding')
  }
  const signature = signatureLengthRemaining.slice(0, signatureLengthNum)
  currentData = signatureLengthRemaining.slice(signatureLengthNum)

  const credential: Credential = {
    value: credentialValue,
    signature,
  }

  return {
    value: credential,
    remaining: currentData,
  }
}

/**
 * Encode single guarantee using Gray Paper encoding
 *
 * Formula from Gray Paper:
 * encode(xg ∈ guarantee) ≡ encode{xg_workreport, encode[4](xg_timeslot), var{sq{build{tuple{encode[2](v), s}}{tuple{v, s} orderedin xg_credential}}}}
 *
 * @param guarantee - Guarantee to encode
 * @returns Encoded octet sequence
 */
function encodeGuarantee(guarantee: Guarantee): OctetSequence {
  const parts: OctetSequence[] = []

  // Work report: xg_workreport
  parts.push(encodeWorkReport(guarantee.workReport))

  // Timeslot: encode[4](xg_timeslot)
  parts.push(encodeFixedLength(guarantee.timeslot, 4))

  // Credentials: var{sq{build{tuple{encode[2](v), s}}{tuple{v, s} orderedin xg_credential}}}
  parts.push(encodeSequenceGeneric(guarantee.credential, encodeCredential))

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
 * Decode single guarantee using Gray Paper encoding
 *
 * @param data - Octet sequence to decode
 * @returns Decoded guarantee and remaining data
 */
function decodeGuarantee(data: OctetSequence): {
  value: Guarantee
  remaining: OctetSequence
} {
  let currentData = data

  // Work report: xg_workreport
  const { value: workReport, remaining: workReportRemaining } =
    decodeWorkReport(currentData)
  currentData = workReportRemaining

  // Timeslot: encode[4](xg_timeslot)
  const { value: timeslot, remaining: timeslotRemaining } = decodeFixedLength(
    currentData,
    4,
  )
  currentData = timeslotRemaining

  // Credentials: var{sq{build{tuple{encode[2](v), s}}{tuple{v, s} orderedin xg_credential}}}
  const { value: credential, remaining: credentialRemaining } =
    decodeSequenceGeneric(currentData, decodeCredential)
  currentData = credentialRemaining

  const guarantee: Guarantee = {
    workReport,
    timeslot,
    credential,
  }

  return {
    value: guarantee,
    remaining: currentData,
  }
}

/**
 * Encode variable-length guarantee sequence using Gray Paper encoding
 *
 * Formula from Gray Paper:
 * encode[G](xtguarantees) ≡ encode{var{sq{build{tuple{xg_workreport, encode[4](xg_timeslot), var{sq{build{tuple{encode[2](v), s}}{tuple{v, s} orderedin xg_credential}}}}}{tuple{xg_workreport, xg_timeslot, xg_credential} orderedin xtguarantees}}}}
 *
 * @param guarantees - Array of guarantees to encode (ordered by work report)
 * @returns Encoded octet sequence
 */
export function encodeGuarantees(guarantees: Guarantee[]): OctetSequence {
  // Sort guarantees by work report as required by Gray Paper
  // For simplicity, we'll sort by the authorizer hash which should be unique
  const sortedGuarantees = [...guarantees].sort((a, b) => {
    return a.workReport.authorizer.localeCompare(b.workReport.authorizer)
  })

  return encodeSequenceGeneric(sortedGuarantees, encodeGuarantee)
}

/**
 * Decode variable-length guarantee sequence using Gray Paper encoding
 *
 * @param data - Octet sequence to decode
 * @returns Decoded guarantees and remaining data
 */
export function decodeGuarantees(data: OctetSequence): {
  value: Guarantee[]
  remaining: OctetSequence
} {
  return decodeSequenceGeneric(data, decodeGuarantee)
}
