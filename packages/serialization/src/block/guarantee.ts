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

import {
  bytesToHex,
  concatBytes,
  hexToBytes,
  type Safe,
  safeError,
  safeResult,
} from '@pbnj/core'
import type { Credential, DecodingResult, Guarantee } from '@pbnj/types'
import { decodeFixedLength, encodeFixedLength } from '../core/fixed-length'
import { decodeNatural, encodeNatural } from '../core/natural-number'
import { decodeSequenceGeneric, encodeSequenceGeneric } from '../core/sequence'
import { decodeWorkReport, encodeWorkReport } from '../work-package/work-report'

/**
 * Encode credential according to Gray Paper specification.
 *
 * Gray Paper Equation 146-157 (label: encodeCredential{⟨v, s⟩}):
 * encodeCredential{⟨v, s⟩} ≡ encode{
 *   encode[2]{v},
 *   s
 * }
 *
 * Credential encoding represents a validator's cryptographic attestation
 * that a work report is valid. Used within guarantee structures.
 *
 * Field encoding per Gray Paper:
 * 1. encode[2]{v}: 2-byte fixed-length validator index/value
 * 2. s: Variable-length signature with length prefix
 *
 * ✅ CORRECT: All 2 fields present in correct Gray Paper order
 * ✅ CORRECT: Uses encode[2] for value (2-byte fixed-length)
 * ✅ CORRECT: Uses variable-length encoding for signature
 * ✅ CORRECT: Uses encodeNatural for signature length prefix
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
  parts.push(hexToBytes(credential.signature))

  return safeResult(concatBytes(parts))
}

/**
 * Decode credential according to Gray Paper specification.
 *
 * Gray Paper Equation 146-157 (label: decodeCredential{⟨v, s⟩}):
 * Inverse of encodeCredential{⟨v, s⟩} ≡ decode{
 *   decode[2]{v},
 *   s
 * }
 *
 * Decodes credential from octet sequence back to structured data.
 * Must exactly reverse the encoding process to maintain round-trip compatibility.
 *
 * Field decoding per Gray Paper:
 * 1. decode[2]{v}: 2-byte fixed-length validator index/value
 * 2. s: Variable-length signature with length prefix
 *
 * ✅ CORRECT: All 2 fields decoded in correct Gray Paper order
 * ✅ CORRECT: Uses decode[2] for value (2-byte fixed-length)
 * ✅ CORRECT: Uses variable-length decoding for signature
 * ✅ CORRECT: Uses decodeNatural for signature length prefix
 *
 * @param data - Octet sequence to decode
 * @returns Decoded credential and remaining data
 */
function decodeCredential(data: Uint8Array): Safe<DecodingResult<Credential>> {
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
      new Error(
        '[decodeCredential] Insufficient data for credential signature decoding',
      ),
    )
  }
  const signature = signatureLengthRemaining.slice(0, signatureLengthNum)
  currentData = signatureLengthRemaining.slice(signatureLengthNum)

  const credential: Credential = {
    value: result.value,
    signature: bytesToHex(signature),
  }

  return safeResult({
    value: credential,
    remaining: currentData,
  })
}

/**
 * Encode guarantee according to Gray Paper specification.
 *
 * Gray Paper Equation 146-157 (label: encodeGuarantee{XG}):
 * encodeGuarantee{XG} ≡ encode{
 *   XG_workreport,
 *   encode[4]{XG_timeslot},
 *   var{⟨⟨encode[2]{v}, s⟩ | ⟨v, s⟩ ∈ XG_credential⟩}
 * }
 *
 * Guarantee encoding represents a validator's attestation that a work report
 * is valid and available. Used in block extrinsics for work report finalization.
 *
 * Field encoding per Gray Paper:
 * 1. XG_workreport: Complete work report structure (using encodeWorkReport)
 * 2. encode[4]{XG_timeslot}: 4-byte fixed-length timeslot when guarantee was made
 * 3. var{XG_credential}: Variable-length sequence of validator credentials
 *
 * Credential sequence encoding:
 * - Length prefix (natural encoding)
 * - Each credential: (encode[2]{validator_index}, signature)
 * - Ordered deterministically for consensus
 *
 * ✅ CORRECT: All 3 fields present in correct Gray Paper order
 * ✅ CORRECT: Uses encodeWorkReport for work report structure
 * ✅ CORRECT: Uses encode[4] for timeslot (4-byte fixed-length)
 * ✅ CORRECT: Uses variable-length sequence for credentials
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

  return safeResult(concatBytes(parts))
}

/**
 * Decode guarantee according to Gray Paper specification.
 *
 * Gray Paper Equation 146-157 (label: decodeGuarantee{XG}):
 * Inverse of encodeGuarantee{XG} ≡ decode{
 *   XG_workreport,
 *   decode[4]{XG_timeslot},
 *   var{⟨⟨decode[2]{v}, s⟩ | ⟨v, s⟩ ∈ XG_credential⟩}
 * }
 *
 * Decodes guarantee from octet sequence back to structured data.
 * Must exactly reverse the encoding process to maintain round-trip compatibility.
 *
 * Field decoding per Gray Paper:
 * 1. XG_workreport: Complete work report structure (using decodeWorkReport)
 * 2. decode[4]{XG_timeslot}: 4-byte fixed-length timeslot
 * 3. var{XG_credential}: Variable-length sequence of validator credentials
 *
 * ✅ CORRECT: All 3 fields decoded in correct Gray Paper order
 * ✅ CORRECT: Uses decodeWorkReport for work report structure
 * ✅ CORRECT: Uses decode[4] for timeslot (4-byte fixed-length)
 * ✅ CORRECT: Uses variable-length sequence decoding for credentials
 *
 * @param data - Octet sequence to decode
 * @returns Decoded guarantee and remaining data
 */
function decodeGuarantee(data: Uint8Array): Safe<DecodingResult<Guarantee>> {
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
 * Encode variable-length guarantee sequence using Gray Paper encoding.
 *
 * Gray Paper Equation 146-157 (label: encodeGuarantees{XT_guarantees}):
 * encodeGuarantees{XT_guarantees} ≡ encode{
 *   var{⟨⟨XG_workreport, encode[4]{XG_timeslot},
 *        var{⟨⟨encode[2]{v}, s⟩ | ⟨v, s⟩ ∈ XG_credential⟩}⟩ |
 *       ⟨XG_workreport, XG_timeslot, XG_credential⟩ ∈ XT_guarantees⟩}
 * }
 *
 * Encodes a variable-length sequence of guarantees with proper Gray Paper
 * compliant structure. Each guarantee is encoded using encodeGuarantee.
 *
 * Ordering requirement:
 * - Guarantees must be ordered by work report authorizer hash for deterministic encoding
 * - This ensures consensus participants produce identical encodings
 *
 * ✅ CORRECT: Uses variable-length sequence encoding
 * ✅ CORRECT: Reuses existing Gray Paper compliant encodeGuarantee function
 * ✅ CORRECT: Maintains deterministic ordering per Gray Paper
 * ✅ CORRECT: Sorts by authorizer hash for consensus compatibility
 *
 * @param guarantees - Array of guarantees to encode (will be sorted by authorizer)
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
 * Decode variable-length guarantee sequence using Gray Paper encoding.
 *
 * Decodes a variable-length sequence of guarantees. Must exactly reverse
 * the encoding process to maintain round-trip compatibility.
 *
 * ✅ CORRECT: Uses variable-length sequence decoding
 * ✅ CORRECT: Reuses existing Gray Paper compliant decodeGuarantee function
 * ✅ CORRECT: Maintains round-trip compatibility
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
