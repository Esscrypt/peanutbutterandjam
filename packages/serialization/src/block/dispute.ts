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

import { bytesToHex, hexToBytes } from '@pbnj/core'
import type { Dispute, Judgment, ValidityDispute } from '@pbnj/types'
import { encodeNatural } from '../core/natural-number'

/**
 * Encode judgment
 *
 * @param judgment - Judgment to encode
 * @returns Encoded octet sequence
 */
export function encodeJudgment(judgment: Judgment): Uint8Array {
  const parts: Uint8Array[] = []

  // Validity (1 byte: 0 for false, 1 for true)
  parts.push(new Uint8Array([judgment.validity ? 1 : 0]))

  // Judge index (8 Uint8Array)
  parts.push(encodeNatural(BigInt(judgment.judgeIndex)))

  // Signature (variable length)
  parts.push(encodeNatural(BigInt(judgment.signature.length))) // Length prefix
  parts.push(judgment.signature)

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
 * Encode validity dispute
 *
 * @param validityDispute - Validity dispute to encode
 * @returns Encoded octet sequence
 */
export function encodeValidityDispute(
  validityDispute: ValidityDispute,
): Uint8Array {
  const parts: Uint8Array[] = []

  // Report hash (32 Uint8Array)
  parts.push(hexToBytes(validityDispute.reportHash))

  // Epoch index (8 Uint8Array)
  parts.push(encodeNatural(BigInt(validityDispute.epochIndex)))

  // Judgments (array of judgments)
  for (const judgment of validityDispute.judgments) {
    parts.push(encodeJudgment(judgment))
  }

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
 * Encode dispute
 *
 * @param dispute - Dispute to encode
 * @returns Encoded octet sequence
 */
export function encodeDispute(dispute: Dispute): Uint8Array {
  const parts: Uint8Array[] = []

  // Validity disputes (array of validity disputes)
  for (const validityDispute of dispute.validityDisputes) {
    parts.push(encodeValidityDispute(validityDispute))
  }

  // Challenge disputes (variable length)
  parts.push(encodeNatural(BigInt(dispute.challengeDisputes.length))) // Length prefix
  parts.push(dispute.challengeDisputes)

  // Finality disputes (variable length)
  parts.push(encodeNatural(BigInt(dispute.finalityDisputes.length))) // Length prefix
  parts.push(dispute.finalityDisputes)

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
 * Decode dispute
 *
 * @param data - Octet sequence to decode
 * @returns Decoded dispute and remaining data
 */
export function decodeDispute(data: Uint8Array): {
  value: Dispute
  remaining: Uint8Array
} {
  let currentData = data

  // Validity disputes (array of validity disputes)
  const validityDisputes = []
  while (currentData.length > 0) {
    try {
      const { value: validityDispute, remaining } =
        decodeValidityDispute(currentData)
      validityDisputes.push(validityDispute)
      currentData = remaining
    } catch {
      break
    }
  }

  // Challenge disputes (variable length)
  const challengeDisputesLength = BigInt(
    `0x${Array.from(currentData.slice(0, 8))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')}`,
  )
  currentData = currentData.slice(8)
  const challengeDisputes = currentData.slice(
    0,
    Number(challengeDisputesLength),
  )
  currentData = currentData.slice(Number(challengeDisputesLength))

  // Finality disputes (variable length)
  const finalityDisputesLength = BigInt(
    `0x${Array.from(currentData.slice(0, 8))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')}`,
  )
  currentData = currentData.slice(8)
  const finalityDisputes = currentData.slice(0, Number(finalityDisputesLength))
  currentData = currentData.slice(Number(finalityDisputesLength))

  return {
    value: {
      validityDisputes,
      challengeDisputes,
      finalityDisputes,
    },
    remaining: currentData,
  }
}

/**
 * Decode validity dispute
 *
 * @param data - Octet sequence to decode
 * @returns Decoded validity dispute and remaining data
 */
export function decodeValidityDispute(data: Uint8Array): {
  value: ValidityDispute
  remaining: Uint8Array
} {
  let currentData = data

  // Report hash (32 Uint8Array)
  const reportHash = bytesToHex(currentData.slice(0, 32))
  currentData = currentData.slice(32)

  // Epoch index (8 Uint8Array)
  const epochIndex = Number(
    BigInt(
      `0x${Array.from(currentData.slice(0, 8))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')}`,
    ),
  )
  currentData = currentData.slice(8)

  // Judgments (array of judgments)
  const judgments = []
  while (currentData.length > 0) {
    try {
      const { value: judgment, remaining } = decodeJudgment(currentData)
      judgments.push(judgment)
      currentData = remaining
    } catch {
      break
    }
  }

  return {
    value: {
      reportHash,
      epochIndex,
      judgments,
    },
    remaining: currentData,
  }
}

/**
 * Decode judgment
 *
 * @param data - Octet sequence to decode
 * @returns Decoded judgment and remaining data
 */
export function decodeJudgment(data: Uint8Array): {
  value: Judgment
  remaining: Uint8Array
} {
  let currentData = data

  // Validity (1 byte: 0 for false, 1 for true)
  const validity = currentData[0] === 1
  currentData = currentData.slice(1)

  // Judge index (8 Uint8Array)
  const judgeIndex = Number(
    BigInt(
      `0x${Array.from(currentData.slice(0, 8))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')}`,
    ),
  )
  currentData = currentData.slice(8)

  // Signature (variable length)
  const signatureLength = BigInt(
    `0x${Array.from(currentData.slice(0, 8))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')}`,
  )
  currentData = currentData.slice(8)
  const signature = currentData.slice(0, Number(signatureLength))
  currentData = currentData.slice(Number(signatureLength))

  return {
    value: {
      validity,
      judgeIndex,
      signature,
    },
    remaining: currentData,
  }
}
