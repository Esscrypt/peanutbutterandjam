/**
 * Guarantee Serialization
 *
 * *** DO NOT REMOVE - GRAY PAPER FORMULA ***
 * Gray Paper Section: Appendix D.1 - Block Serialization
 * Formula (Equation 146-157):
 *
 * encodeGuarantees(XT_guarantees) = encode(
 *   var{⟨⟨XG_workreport, encode[4](XG_timeslot),
 *        var{⟨⟨encode[2](v), s⟩ | ⟨v, s⟩ ∈ XG_credential⟩}⟩ |
 *       ⟨XG_workreport, XG_timeslot, XG_credential⟩ ∈ XT_guarantees⟩}
 * )
 *
 * Guarantees encode work report validity with validator credentials.
 * Inner tuples contain variable-length sequences requiring discriminators.
 *
 * *** IMPLEMENTER EXPLANATION ***
 * Guarantees are validator attestations that work reports are valid.
 * They provide the security foundation for JAM's compute validation.
 *
 * Guarantee structure:
 * 1. **Work report**: The full work report being guaranteed
 * 2. **Time slot** (4 bytes): When this guarantee was created
 * 3. **Credentials**: List of validator signatures attesting validity
 *
 * Credential structure (nested):
 * - **Validator index** (2 bytes): Which validator signed
 * - **Signature**: Cryptographic signature over work report
 *
 * Key concepts:
 * - Threshold security: Multiple validators must sign
 * - Time bounds: Guarantees expire after certain slots
 * - Slashing risk: Invalid guarantees can result in validator punishment
 * - Economic finality: Guaranteed work reports become economically final
 *
 * The nested variable-length structure allows flexible numbers of
 * validators to participate while maintaining efficient encoding.
 */

import { type Safe, safeError, safeResult } from '@pbnj/core'
import type { Credential, Guarantee } from '@pbnj/types'
import { decodeFixedLength, encodeFixedLength } from '../core/fixed-length'
import { decodeNatural, encodeNatural } from '../core/natural-number'
import { decodeSequenceGeneric, encodeSequenceGeneric } from '../core/sequence'
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
function encodeCredential(credential: Credential): Safe<Uint8Array> {
  const parts: Uint8Array[] = []

  // Value: encode[2](v)
  const [error, encoded] = encodeFixedLength(BigInt(credential.value), 2n)
  if (error) {
    return safeError(error)
  }
  parts.push(encoded)

  // Signature: s (variable-length octet sequence)
  const [error2, encoded2] = encodeNatural(BigInt(credential.signature.length))
  if (error2) {
    return safeError(error2)
  }
  parts.push(encoded2)
  parts.push(credential.signature)

  // Concatenate all parts
  const totalLength = parts.reduce((sum, part) => sum + part.length, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0

  for (const part of parts) {
    result.set(part, offset)
    offset += part.length
  }

  return safeResult(result)
}

/**
 * Decode single credential using Gray Paper encoding
 *
 * @param data - Octet sequence to decode
 * @returns Decoded credential and remaining data
 */
function decodeCredential(data: Uint8Array): Safe<{
  value: Credential
  remaining: Uint8Array
}> {
  let currentData = data

  // Value: encode[2](v)
  const [error, result] = decodeFixedLength(currentData, 2n)
  if (error) {
    return safeError(error)
  }
  currentData = result.remaining

  // Signature: s (variable-length octet sequence)
  const [error2, result2] = decodeNatural(currentData)
  if (error2) {
    return safeError(error2)
  }
  const signatureLength = result2.value
  const signatureLengthRemaining = result2.remaining
  const signatureLengthNum = Number(signatureLength)
  if (signatureLengthRemaining.length < signatureLengthNum) {
    return safeError(
      new Error('Insufficient data for credential signature decoding'),
    )
  }
  const signature = signatureLengthRemaining.slice(0, signatureLengthNum)
  currentData = signatureLengthRemaining.slice(signatureLengthNum)

  const credential: Credential = {
    value: result.value,
    signature,
  }

  return safeResult({
    value: credential,
    remaining: currentData,
  })
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
function encodeGuarantee(guarantee: Guarantee): Safe<Uint8Array> {
  const parts: Uint8Array[] = []

  // Work report: xg_workreport
  const [error1, encoded1] = encodeWorkReport(guarantee.workReport)
  if (error1) {
    return safeError(error1)
  }
  parts.push(encoded1)

  // Timeslot: encode[4](xg_timeslot)
  const [error2, encoded2] = encodeFixedLength(BigInt(guarantee.timeslot), 4n)
  if (error2) {
    return safeError(error2)
  }
  parts.push(encoded2)

  // Credentials: var{sq{build{tuple{encode[2](v), s}}{tuple{v, s} orderedin xg_credential}}}
  const [error3, encoded3] = encodeSequenceGeneric(
    guarantee.credential,
    encodeCredential,
  )
  if (error3) {
    return safeError(error3)
  }
  parts.push(encoded3)

  // Concatenate all parts
  const totalLength = parts.reduce((sum, part) => sum + part.length, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0

  for (const part of parts) {
    result.set(part, offset)
    offset += part.length
  }

  return safeResult(result)
}

/**
 * Decode single guarantee using Gray Paper encoding
 *
 * @param data - Octet sequence to decode
 * @returns Decoded guarantee and remaining data
 */
function decodeGuarantee(data: Uint8Array): Safe<{
  value: Guarantee
  remaining: Uint8Array
}> {
  let currentData = data

  // Work report: xg_workreport
  const [error, result] = decodeWorkReport(currentData)
  if (error) {
    return safeError(error)
  }
  const workReport = result.value
  const workReportRemaining = result.remaining
  currentData = workReportRemaining

  // Timeslot: encode[4](xg_timeslot)
  const [error2, result2] = decodeFixedLength(currentData, 4n)
  if (error2) {
    return safeError(error2)
  }
  const timeslot = result2.value
  const timeslotRemaining = result2.remaining
  currentData = timeslotRemaining

  // Credentials: var{sq{build{tuple{encode[2](v), s}}{tuple{v, s} orderedin xg_credential}}}
  const [error3, result3] = decodeSequenceGeneric(currentData, decodeCredential)
  if (error3) {
    return safeError(error3)
  }
  const credential = result3.value
  const credentialRemaining = result3.remaining
  currentData = credentialRemaining

  const guarantee: Guarantee = {
    workReport,
    timeslot,
    credential,
  }

  return safeResult({
    value: guarantee,
    remaining: currentData,
  })
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
export function encodeGuarantees(guarantees: Guarantee[]): Safe<Uint8Array> {
  // Sort guarantees by work report as required by Gray Paper
  // Sort by the authorizer hash which should be unique
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
export function decodeGuarantees(data: Uint8Array): Safe<{
  value: Guarantee[]
  remaining: Uint8Array
}> {
  return decodeSequenceGeneric(data, decodeGuarantee)
}
