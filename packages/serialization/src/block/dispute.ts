/**
 * Dispute serialization
 *
 * Implements Gray Paper dispute serialization
 * Reference: graypaper/text/dispute.tex
 */

import { bytesToHex, hexToBytes } from '@pbnj/core'
import { encodeNatural } from '../core/natural-number'
import type {
  Dispute,
  Judgment,
  OctetSequence,
  ValidityDispute,
} from '../types'

/**
 * Encode judgment
 *
 * @param judgment - Judgment to encode
 * @returns Encoded octet sequence
 */
export function encodeJudgment(judgment: Judgment): OctetSequence {
  const parts: Uint8Array[] = []

  // Validity (variable length)
  parts.push(encodeNatural(BigInt(judgment.validity.length))) // Length prefix
  parts.push(judgment.validity)

  // Judge index (8 bytes)
  parts.push(encodeNatural(judgment.judgeIndex))

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
): OctetSequence {
  const parts: Uint8Array[] = []

  // Report hash (32 bytes)
  parts.push(hexToBytes(validityDispute.reportHash))

  // Epoch index (8 bytes)
  parts.push(encodeNatural(validityDispute.epochIndex))

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
export function encodeDispute(dispute: Dispute): OctetSequence {
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
export function decodeDispute(data: OctetSequence): {
  value: Dispute
  remaining: OctetSequence
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
export function decodeValidityDispute(data: OctetSequence): {
  value: ValidityDispute
  remaining: OctetSequence
} {
  let currentData = data

  // Report hash (32 bytes)
  const reportHash = bytesToHex(currentData.slice(0, 32))
  currentData = currentData.slice(32)

  // Epoch index (8 bytes)
  const epochIndex = BigInt(
    `0x${Array.from(currentData.slice(0, 8))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')}`,
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
export function decodeJudgment(data: OctetSequence): {
  value: Judgment
  remaining: OctetSequence
} {
  let currentData = data

  // Validity (variable length)
  const validityLength = BigInt(
    `0x${Array.from(currentData.slice(0, 8))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')}`,
  )
  currentData = currentData.slice(8)
  const validity = currentData.slice(0, Number(validityLength))
  currentData = currentData.slice(Number(validityLength))

  // Judge index (8 bytes)
  const judgeIndex = BigInt(
    `0x${Array.from(currentData.slice(0, 8))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')}`,
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
