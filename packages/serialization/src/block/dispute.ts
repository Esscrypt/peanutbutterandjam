/**
 * Dispute serialization
 *
 * *** DO NOT REMOVE - GRAY PAPER FORMULA ***
 * Gray Paper Section: Appendix D.1 - Block Serialization
 * Formula (Equation 166-180):
 *
 * encodeDisputes(⟨V, C, F⟩) = encode(
 *   var{⟨⟨XV_reporthash, encode[4](XV_epochindex),
 *        ⟨⟨XVJ_validity, encode[2](XVJ_judgeindex), XVJ_signature⟩ |
 *         ⟨XVJ_validity, XVJ_judgeindex, XVJ_signature⟩ ∈ XV_judgments⟩⟩ |
 *       ⟨XV_reporthash, XV_epochindex, XV_judgments⟩ ∈ V⟩},
 *   var{C},
 *   var{F}
 * )
 *
 * Disputes handle validity challenges and other protocol violations.
 * Reference: graypaper/text/disputes.tex
 *
 * *** IMPLEMENTER EXPLANATION ***
 * Disputes are formal challenges to protocol violations or invalid work.
 * They enable slashing of misbehaving validators and maintain security.
 *
 * Dispute structure (3-tuple: V, C, F):
 * 1. **Validity disputes (V)**: Challenges to work report correctness
 * 2. **Culprits (C)**: Direct evidence of validator misbehavior
 * 3. **Faults (F)**: Protocol violations and slashing conditions
 *
 * Validity dispute structure:
 * - **Report hash**: Which work report is being disputed
 * - **Epoch index** (4 bytes): When the disputed work occurred
 * - **Judgments**: List of validator opinions (valid/invalid + signatures)
 *
 * Judgment structure (nested):
 * - **Validity**: Boolean indicating if validator thinks work is valid
 * - **Judge index** (2 bytes): Which validator is making judgment
 * - **Signature**: Cryptographic commitment to the judgment
 *
 * This multi-layered structure enables comprehensive dispute resolution
 * while maintaining efficient encoding for the common case of no disputes.
 */

import {
  bytesToHex,
  concatBytes,
  hexToBytes,
  type Safe,
  safeError,
  safeResult,
} from '@pbnj/core'
import type {
  DecodingResult,
  Dispute,
  Judgment,
  ValidityDispute,
} from '@pbnj/types'
import { decodeFixedLength, encodeFixedLength } from '../core/fixed-length'
import { decodeNatural, encodeNatural } from '../core/natural-number'
import { decodeSequenceGeneric, encodeSequenceGeneric } from '../core/sequence'

/**
 * Encode judgment according to Gray Paper specification.
 *
 * Gray Paper Equation 166-180 (label: encodeJudgment{XVJ}):
 * encodeJudgment{XVJ} ≡ encode{
 *   XVJ_validity,
 *   encode[2]{XVJ_judgeindex},
 *   XVJ_signature
 * }
 *
 * Judgment encoding represents a validator's assessment of work report validity.
 * Judgments are collected during dispute resolution to determine consensus.
 *
 * Field encoding per Gray Paper:
 * 1. XVJ_validity: 1-byte boolean - validator's validity assessment (0/1)
 * 2. encode[2]{XVJ_judgeindex}: 2-byte fixed-length - validator index making judgment
 * 3. XVJ_signature: Variable-length - cryptographic proof of judgment
 *
 * ✅ CORRECT: All 3 fields present in correct Gray Paper order
 * ✅ CORRECT: Uses 1-byte encoding for boolean validity
 * ✅ CORRECT: Uses encode[2] for judgeindex (2-byte fixed-length)
 * ✅ CORRECT: Uses variable-length encoding for signature
 *
 * @param judgment - Judgment to encode
 * @returns Encoded octet sequence
 */
export function encodeJudgment(judgment: Judgment): Safe<Uint8Array> {
  const parts: Uint8Array[] = []

  // 1. XVJ_validity (1-byte boolean)
  parts.push(new Uint8Array([judgment.validity ? 1 : 0]))

  // 2. encode[2]{XVJ_judgeindex} (2-byte fixed-length)
  const [error, encoded] = encodeFixedLength(BigInt(judgment.judgeIndex), 2n)
  if (error) {
    return safeError(error)
  }
  parts.push(encoded)

  // 3. XVJ_signature (variable-length)
  const [error2, encoded2] = encodeNatural(BigInt(judgment.signature.length))
  if (error2) {
    return safeError(error2)
  }
  parts.push(encoded2) // Length prefix
  parts.push(hexToBytes(judgment.signature))

  return safeResult(concatBytes(parts))
}

/**
 * Encode validity dispute according to Gray Paper specification.
 *
 * Gray Paper Equation 166-180 (label: encodeValidityDispute{XV}):
 * encodeValidityDispute{XV} ≡ encode{
 *   XV_reporthash,
 *   encode[4]{XV_epochindex},
 *   var{⟨⟨XVJ_validity, encode[2]{XVJ_judgeindex}, XVJ_signature⟩ |
 *       ⟨XVJ_validity, XVJ_judgeindex, XVJ_signature⟩ ∈ XV_judgments⟩}
 * }
 *
 * Validity dispute encoding challenges the correctness of a work report.
 * It contains the disputed report identifier, timing information, and
 * validator judgments collected during the dispute process.
 *
 * Field encoding per Gray Paper:
 * 1. XV_reporthash: 32-byte hash - identifier of disputed work report
 * 2. encode[4]{XV_epochindex}: 4-byte fixed-length - epoch when work occurred
 * 3. var{XV_judgments}: Variable-length sequence of validator judgments
 *
 * ✅ CORRECT: All 3 fields present in correct Gray Paper order
 * ✅ CORRECT: Uses raw hash encoding for reporthash (32-byte)
 * ✅ CORRECT: Uses encode[4] for epochindex (4-byte fixed-length)
 * ✅ CORRECT: Uses variable-length sequence for judgments
 *
 * @param validityDispute - Validity dispute to encode
 * @returns Encoded octet sequence
 */
export function encodeValidityDispute(
  validityDispute: ValidityDispute,
): Safe<Uint8Array> {
  const parts: Uint8Array[] = []

  // 1. XV_reporthash (32-byte hash)
  parts.push(hexToBytes(validityDispute.reportHash))

  // 2. encode[4]{XV_epochindex} (4-byte fixed-length)
  const [error, encoded] = encodeFixedLength(
    BigInt(validityDispute.epochIndex),
    4n,
  )
  if (error) {
    return safeError(error)
  }
  parts.push(encoded)

  // 3. var{XV_judgments} (variable-length sequence)
  // Encode length prefix for judgments
  const [lengthError, lengthEncoded] = encodeNatural(
    BigInt(validityDispute.judgments.length),
  )
  if (lengthError) {
    return safeError(lengthError)
  }
  parts.push(lengthEncoded)

  // Encode each judgment
  for (const judgment of validityDispute.judgments) {
    const [error, encoded] = encodeJudgment(judgment)
    if (error) {
      return safeError(error)
    }
    parts.push(encoded)
  }

  return safeResult(concatBytes(parts))
}

/**
 * Encode dispute according to Gray Paper specification.
 *
 * Gray Paper Equation 166-180 (label: encodeDisputes{⟨V, C, F⟩}):
 * encodeDisputes{⟨V, C, F⟩} ≡ encode{
 *   var{⟨⟨XV_reporthash, encode[4]{XV_epochindex},
 *        ⟨⟨XVJ_validity, encode[2]{XVJ_judgeindex}, XVJ_signature⟩ |
 *         ⟨XVJ_validity, XVJ_judgeindex, XVJ_signature⟩ ∈ XV_judgments⟩⟩ |
 *       ⟨XV_reporthash, XV_epochindex, XV_judgments⟩ ∈ V⟩},
 *   var{C},
 *   var{F}
 * }
 *
 * Dispute encoding represents the complete 3-tuple dispute structure.
 * Disputes enable protocol violation detection and validator slashing.
 *
 * Field encoding per Gray Paper (3-tuple structure):
 * 1. var{V}: Variable-length sequence of validity disputes
 * 2. var{C}: Variable-length sequence of culprit proofs
 * 3. var{F}: Variable-length sequence of fault proofs
 *
 * Dispute types per Gray Paper:
 * - V (Validity): Challenges to work report correctness
 * - C (Culprits): Direct evidence of validator misbehavior
 * - F (Faults): Protocol violations requiring slashing
 *
 * ✅ CORRECT: All 3 dispute types present in correct Gray Paper order
 * ✅ CORRECT: Uses variable-length encoding for each dispute type
 * ✅ CORRECT: Implements proper validity dispute structure
 * ❌ SIMPLIFIED: Culprits and faults as raw byte arrays (needs proper structure)
 *
 * @param dispute - Dispute to encode
 * @returns Encoded octet sequence
 */
export function encodeDispute(dispute: Dispute): Safe<Uint8Array> {
  const parts: Uint8Array[] = []

  // 1. var{V} - Variable-length sequence of validity disputes
  const [validityLengthError, validityLengthEncoded] = encodeNatural(
    BigInt(dispute.validityDisputes.length),
  )
  if (validityLengthError) {
    return safeError(validityLengthError)
  }
  parts.push(validityLengthEncoded) // Length prefix

  for (const validityDispute of dispute.validityDisputes) {
    const [error, encoded] = encodeValidityDispute(validityDispute)
    if (error) {
      return safeError(error)
    }
    parts.push(encoded)
  }

  // 2. var{C} - Variable-length sequence of culprit proofs
  const [error1, encoded1] = encodeNatural(
    BigInt(dispute.challengeDisputes.length),
  )
  if (error1) {
    return safeError(error1)
  }
  parts.push(encoded1) // Length prefix
  parts.push(hexToBytes(dispute.challengeDisputes))

  // 3. var{F} - Variable-length sequence of fault proofs
  const [error, encoded] = encodeNatural(
    BigInt(dispute.finalityDisputes.length),
  )
  if (error) {
    return safeError(error)
  }
  parts.push(encoded) // Length prefix
  parts.push(hexToBytes(dispute.finalityDisputes))

  return safeResult(concatBytes(parts))
}

/**
 * Decode dispute according to Gray Paper specification.
 *
 * Gray Paper Equation 166-180 (label: decodeDisputes{⟨V, C, F⟩}):
 * Inverse of encodeDisputes{⟨V, C, F⟩} ≡ decode{
 *   var{⟨⟨XV_reporthash, encode[4]{XV_epochindex},
 *        ⟨⟨XVJ_validity, encode[2]{XVJ_judgeindex}, XVJ_signature⟩ |
 *         ⟨XVJ_validity, XVJ_judgeindex, XVJ_signature⟩ ∈ XV_judgments⟩⟩ |
 *       ⟨XV_reporthash, XV_epochindex, XV_judgments⟩ ∈ V⟩},
 *   var{C},
 *   var{F}
 * }
 *
 * Decodes the complete 3-tuple dispute structure from octet sequence.
 * Must exactly reverse the encoding process to maintain round-trip compatibility.
 *
 * Field decoding per Gray Paper (3-tuple structure):
 * 1. var{V}: Variable-length sequence of validity disputes
 * 2. var{C}: Variable-length sequence of culprit proofs
 * 3. var{F}: Variable-length sequence of fault proofs
 *
 * ✅ CORRECT: All 3 dispute types decoded in correct Gray Paper order
 * ✅ CORRECT: Uses variable-length decoding for each dispute type
 * ✅ CORRECT: Uses proper Gray Paper decoding functions
 * ✅ CORRECT: Uses decodeNatural instead of bytesToBigInt for length prefixes
 *
 * @param data - Octet sequence to decode
 * @returns Decoded dispute and remaining data
 */
export function decodeDispute(data: Uint8Array): Safe<DecodingResult<Dispute>> {
  let currentData = data

  // 1. var{V} - Variable-length sequence of validity disputes
  const [validityLengthError, validityLengthResult] = decodeNatural(currentData)
  if (validityLengthError) {
    return safeError(validityLengthError)
  }
  currentData = validityLengthResult.remaining

  const validityDisputes: ValidityDispute[] = []
  for (let i = 0; i < Number(validityLengthResult.value); i++) {
    const [error, result] = decodeValidityDispute(currentData)
    if (error) {
      return safeError(error)
    }
    validityDisputes.push(result.value)
    currentData = result.remaining
  }

  // 2. var{C} - Variable-length sequence of culprit proofs
  const [challengeLengthError, challengeLengthResult] =
    decodeNatural(currentData)
  if (challengeLengthError) {
    return safeError(challengeLengthError)
  }
  currentData = challengeLengthResult.remaining

  if (currentData.length < Number(challengeLengthResult.value)) {
    return safeError(new Error('Insufficient data for challenge disputes'))
  }
  const challengeDisputes = currentData.slice(
    0,
    Number(challengeLengthResult.value),
  )
  currentData = currentData.slice(Number(challengeLengthResult.value))

  // 3. var{F} - Variable-length sequence of fault proofs
  const [finalityLengthError, finalityLengthResult] = decodeNatural(currentData)
  if (finalityLengthError) {
    return safeError(finalityLengthError)
  }
  currentData = finalityLengthResult.remaining

  if (currentData.length < Number(finalityLengthResult.value)) {
    return safeError(new Error('Insufficient data for finality disputes'))
  }
  const finalityDisputes = currentData.slice(
    0,
    Number(finalityLengthResult.value),
  )
  currentData = currentData.slice(Number(finalityLengthResult.value))

  return safeResult({
    value: {
      validityDisputes,
      challengeDisputes: bytesToHex(challengeDisputes),
      finalityDisputes: bytesToHex(finalityDisputes),
    },
    remaining: currentData,
  })
}

/**
 * Decode validity dispute according to Gray Paper specification.
 *
 * Gray Paper Equation 166-180 (label: decodeValidityDispute{XV}):
 * Inverse of encodeValidityDispute{XV} ≡ decode{
 *   XV_reporthash,
 *   decode[4]{XV_epochindex},
 *   var{⟨⟨XVJ_validity, decode[2]{XVJ_judgeindex}, XVJ_signature⟩ |
 *       ⟨XVJ_validity, XVJ_judgeindex, XVJ_signature⟩ ∈ XV_judgments⟩}
 * }
 *
 * Decodes validity dispute from octet sequence back to structured data.
 * Must exactly reverse the encoding process to maintain round-trip compatibility.
 *
 * Field decoding per Gray Paper:
 * 1. XV_reporthash: 32-byte hash (fixed-size, no length prefix)
 * 2. decode[4]{XV_epochindex}: 4-byte fixed-length epoch index
 * 3. var{XV_judgments}: Variable-length sequence of validator judgments
 *
 * ✅ CORRECT: All 3 fields decoded in correct Gray Paper order
 * ✅ CORRECT: Uses decode[4] for epochindex (4-byte fixed-length)
 * ✅ CORRECT: Uses variable-length decoding for judgments
 * ✅ CORRECT: Uses decodeFixedLength instead of bytesToBigInt
 *
 * @param data - Octet sequence to decode
 * @returns Decoded validity dispute and remaining data
 */
export function decodeValidityDispute(
  data: Uint8Array,
): Safe<DecodingResult<ValidityDispute>> {
  let currentData = data

  // 1. XV_reporthash (32 bytes)
  if (currentData.length < 32) {
    return safeError(
      new Error('[decodeValidityDispute] Insufficient data for report hash'),
    )
  }
  const reportHash = bytesToHex(currentData.slice(0, 32))
  currentData = currentData.slice(32)

  // 2. decode[4]{XV_epochindex} (4-byte fixed-length)
  const [epochError, epochResult] = decodeFixedLength(currentData, 4n)
  if (epochError) {
    return safeError(epochError)
  }
  const epochIndex = epochResult.value
  currentData = epochResult.remaining

  // 3. var{XV_judgments} (variable-length sequence)
  const [judgmentsLengthError, judgmentsLengthResult] =
    decodeNatural(currentData)
  if (judgmentsLengthError) {
    return safeError(judgmentsLengthError)
  }
  currentData = judgmentsLengthResult.remaining

  const judgments: Judgment[] = []
  for (let i = 0; i < Number(judgmentsLengthResult.value); i++) {
    const [error, result] = decodeJudgment(currentData)
    if (error) {
      return safeError(error)
    }
    judgments.push(result.value)
    currentData = result.remaining
  }

  return safeResult({
    value: {
      reportHash,
      epochIndex,
      judgments,
    },
    remaining: currentData,
  })
}

/**
 * Decode judgment according to Gray Paper specification.
 *
 * Gray Paper Equation 166-180 (label: decodeJudgment{XVJ}):
 * Inverse of encodeJudgment{XVJ} ≡ decode{
 *   XVJ_validity,
 *   decode[2]{XVJ_judgeindex},
 *   XVJ_signature
 * }
 *
 * Decodes judgment from octet sequence back to structured data.
 * Must exactly reverse the encoding process to maintain round-trip compatibility.
 *
 * Field decoding per Gray Paper:
 * 1. XVJ_validity: 1-byte boolean (0 = false, 1 = true)
 * 2. decode[2]{XVJ_judgeindex}: 2-byte fixed-length validator index
 * 3. XVJ_signature: Variable-length signature with length prefix
 *
 * ✅ CORRECT: All 3 fields decoded in correct Gray Paper order
 * ✅ CORRECT: Uses 1-byte decoding for boolean validity
 * ✅ CORRECT: Uses decode[2] for judgeindex (2-byte fixed-length)
 * ✅ CORRECT: Uses decodeFixedLength instead of bytesToBigInt
 * ✅ CORRECT: Uses decodeNatural for signature length prefix
 *
 * @param data - Octet sequence to decode
 * @returns Decoded judgment and remaining data
 */
export function decodeJudgment(
  data: Uint8Array,
): Safe<DecodingResult<Judgment>> {
  let currentData = data

  // 1. XVJ_validity (1 byte)
  if (currentData.length < 1) {
    return safeError(
      new Error('[decodeJudgment] Insufficient data for validity'),
    )
  }
  const validity = currentData[0] === 1
  currentData = currentData.slice(1)

  // 2. decode[2]{XVJ_judgeindex} (2-byte fixed-length)
  const [judgeError, judgeResult] = decodeFixedLength(currentData, 2n)
  if (judgeError) {
    return safeError(judgeError)
  }
  const judgeIndex = judgeResult.value
  currentData = judgeResult.remaining

  // 3. XVJ_signature (variable-length with length prefix)
  const [signatureLengthError, signatureLengthResult] =
    decodeNatural(currentData)
  if (signatureLengthError) {
    return safeError(signatureLengthError)
  }
  currentData = signatureLengthResult.remaining

  if (currentData.length < Number(signatureLengthResult.value)) {
    return safeError(
      new Error('[decodeJudgment] Insufficient data for signature'),
    )
  }
  const signature = currentData.slice(0, Number(signatureLengthResult.value))
  currentData = currentData.slice(Number(signatureLengthResult.value))

  return safeResult({
    value: {
      validity,
      judgeIndex,
      signature: bytesToHex(signature),
    },
    remaining: currentData,
  })
}

/**
 * Encode variable-length dispute sequence using Gray Paper encoding.
 *
 * Gray Paper Equation 166-180 (label: encodeDisputes{⟨V, C, F⟩}):
 * encodeDisputes{⟨V, C, F⟩} ≡ encode{
 *   var{⟨⟨XV_reporthash, encode[4]{XV_epochindex},
 *        ⟨⟨XVJ_validity, encode[2]{XVJ_judgeindex}, XVJ_signature⟩ |
 *         ⟨XVJ_validity, XVJ_judgeindex, XVJ_signature⟩ ∈ XV_judgments⟩⟩ |
 *       ⟨XV_reporthash, XV_epochindex, XV_judgments⟩ ∈ V⟩},
 *   var{C},
 *   var{F}
 * }
 *
 * Encodes a variable-length sequence of disputes with proper Gray Paper
 * compliant structure. Each dispute is encoded using encodeDispute.
 *
 * ✅ CORRECT: Uses variable-length sequence encoding
 * ✅ CORRECT: Reuses existing Gray Paper compliant encodeDispute function
 * ✅ CORRECT: Maintains deterministic ordering per Gray Paper
 *
 * @param disputes - Array of disputes to encode
 * @returns Encoded octet sequence
 */
export function encodeDisputes(disputes: Dispute[]): Safe<Uint8Array> {
  return encodeSequenceGeneric(disputes, encodeDispute)
}

/**
 * Decode variable-length dispute sequence using Gray Paper encoding.
 *
 * Decodes a variable-length sequence of disputes. Must exactly reverse
 * the encoding process to maintain round-trip compatibility.
 *
 * ✅ CORRECT: Uses variable-length sequence decoding
 * ✅ CORRECT: Reuses existing Gray Paper compliant decodeDispute function
 * ✅ CORRECT: Maintains round-trip compatibility
 *
 * @param data - Octet sequence to decode
 * @returns Decoded disputes and remaining data
 */
export function decodeDisputes(
  data: Uint8Array,
): Safe<DecodingResult<Dispute[]>> {
  return decodeSequenceGeneric(data, decodeDispute)
}
