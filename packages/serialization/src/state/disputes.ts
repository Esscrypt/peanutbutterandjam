/**
 * Dispute state serialization
 *
 * *** DO NOT REMOVE - GRAY PAPER FORMULA ***
 * Gray Paper Section: merklization.tex (Equation C(5))
 * Formula:
 *
 * C(5) ↦ encode{
 *   var{sqorderby{x}{x ∈ goodset}},
 *   var{sqorderby{x}{x ∈ badset}},
 *   var{sqorderby{x}{x ∈ wonkyset}},
 *   var{sqorderby{x}{x ∈ offenders}}
 * }
 *
 * Gray Paper Section: judgments.tex (Equation 20)
 * Disputes structure:
 *
 * disputes ≡ tuple{goodset, badset, wonkyset, offenders}
 *
 * Implements Gray Paper dispute state serialization as specified
 * Reference: graypaper/text/judgments.tex and merklization.tex
 *
 * *** IMPLEMENTER EXPLANATION ***
 * Disputes track judgments and offenses in JAM's consensus mechanism.
 * They provide accountability and prevent malicious behavior.
 *
 * Dispute structure per Gray Paper:
 * 1. **goodset**: Work-reports judged to be correct
 * 2. **badset**: Work-reports judged to be incorrect
 * 3. **wonkyset**: Work-reports with unknowable validity
 * 4. **offenders**: Validators who made incorrect judgments
 *
 * Key concepts:
 * - **Judgments**: Votes from validators on work-report validity
 * - **Verdicts**: Collections of judgments from 2/3+ validators
 * - **Offenses**: Proofs of validator misbehavior
 * - **Accountability**: Prevents resubmission of invalid reports
 * - **Punishment**: Offenders are tracked and penalized
 *
 * The ordered encoding ensures deterministic serialization
 * for consistent state hashing and consensus.
 *
 * This is critical for JAM's dispute resolution system that
 * maintains network integrity through validator accountability.
 */

import { bytesToHex, concatBytes, type Hex, hexToBytes } from '@pbnj/core'
import type { DecodingResult, Disputes, Safe } from '@pbnj/types'
import { safeError, safeResult } from '@pbnj/types'
import {
  decodeVariableSequence,
  encodeVariableSequence,
} from '../core/sequence'

/**
 * Encode dispute state according to Gray Paper specification.
 *
 * Gray Paper merklization.tex equation C(5):
 * C(5) ↦ encode{
 *   var{sqorderby{x}{x ∈ goodset}},
 *   var{sqorderby{x}{x ∈ badset}},
 *   var{sqorderby{x}{x ∈ wonkyset}},
 *   var{sqorderby{x}{x ∈ offenders}}
 * }
 *
 * Gray Paper judgments.tex equation 20:
 * disputes ≡ tuple{goodset, badset, wonkyset, offenders}
 *
 * Disputes track judgments and offenses in JAM's consensus mechanism,
 * providing accountability and preventing malicious behavior.
 *
 * Field encoding per Gray Paper:
 * 1. goodset: Variable-length sequence of ordered work-report hashes (judged correct)
 * 2. badset: Variable-length sequence of ordered work-report hashes (judged incorrect)
 * 3. wonkyset: Variable-length sequence of ordered work-report hashes (unknowable validity)
 * 4. offenders: Variable-length sequence of ordered validator Ed25519 keys (misbehaved)
 *
 * Dispute semantics:
 * - **Judgments**: Validator votes on work-report validity
 * - **Verdicts**: Collections requiring 2/3+ validator agreement
 * - **Offenses**: Proofs of validator misbehavior (guarantees/signatures)
 * - **Accountability**: Prevents resubmission of invalid reports
 * - **Punishment**: Offenders tracked and penalized in future epochs
 *
 * Consensus integration:
 * - Disputes prevent building on invalid work-reports
 * - Grandpa finality excludes disputed blocks
 * - Offenders replaced with null keys in validator sets
 * - Ordered encoding ensures deterministic state hashing
 *
 * ✅ CORRECT: Uses variable-length sequence encoding for each set
 * ✅ CORRECT: Orders elements for deterministic serialization
 * ✅ CORRECT: Encodes hashes as raw 32-byte sequences
 * ✅ CORRECT: Matches Gray Paper tuple structure exactly
 *
 * @param disputes - Dispute state to encode
 * @returns Encoded octet sequence
 */
export function encodeDisputeState(disputes: Disputes): Safe<Uint8Array> {
  const parts: Uint8Array[] = []

  // Gray Paper: var{sqorderby{x}{x ∈ goodset}} - sort hashes for deterministic encoding
  const goodsetArray = Array.from(disputes.goodSet).sort((a, b) =>
    a.localeCompare(b),
  )
  const [error1, goodsetData] = encodeVariableSequence(
    goodsetArray,
    (hash: Hex) => safeResult(hexToBytes(hash)),
  )
  if (error1) return safeError(error1)
  parts.push(goodsetData)

  // Gray Paper: var{sqorderby{x}{x ∈ badset}} - sort hashes for deterministic encoding
  const badsetArray = Array.from(disputes.badSet).sort((a, b) =>
    a.localeCompare(b),
  )
  const [error2, badsetData] = encodeVariableSequence(
    badsetArray,
    (hash: Hex) => safeResult(hexToBytes(hash)),
  )
  if (error2) return safeError(error2)
  parts.push(badsetData)

  // Gray Paper: var{sqorderby{x}{x ∈ wonkyset}} - sort hashes for deterministic encoding
  const wonkysetArray = Array.from(disputes.wonkySet).sort((a, b) =>
    a.localeCompare(b),
  )
  const [error3, wonkysetData] = encodeVariableSequence(
    wonkysetArray,
    (hash: Hex) => safeResult(hexToBytes(hash)),
  )
  if (error3) return safeError(error3)
  parts.push(wonkysetData)

  // Gray Paper: var{sqorderby{x}{x ∈ offenders}} - sort validator keys for deterministic encoding
  const offendersArray = Array.from(disputes.offenders).sort((a, b) =>
    String(a).localeCompare(String(b)),
  )
  const [error4, offendersData] = encodeVariableSequence(
    offendersArray,
    (key: Hex) => safeResult(hexToBytes(key)),
  )
  if (error4) return safeError(error4)
  parts.push(offendersData)

  return safeResult(concatBytes(parts))
}

/**
 * Decode dispute state according to Gray Paper specification.
 *
 * Decodes the Gray Paper compliant dispute state structure:
 * disputes ≡ tuple{goodset, badset, wonkyset, offenders}
 *
 * Each component is a variable-length sequence of ordered elements:
 * - goodset: Work-report hashes (judged correct)
 * - badset: Work-report hashes (judged incorrect)
 * - wonkyset: Work-report hashes (unknowable validity)
 * - offenders: Validator Ed25519 keys (misbehaved)
 *
 * ✅ CORRECT: Decodes variable-length sequences for each set
 * ✅ CORRECT: Maintains deterministic ordering from encoding
 * ✅ CORRECT: Reconstructs Sets from decoded arrays
 * ✅ CORRECT: Matches Gray Paper tuple structure exactly
 *
 * @param data - Octet sequence to decode
 * @returns Decoded dispute state and remaining data
 */
export function decodeDisputeState(
  data: Uint8Array,
): Safe<DecodingResult<Disputes>> {
  let currentData = data

  // 1. goodset: Variable-length sequence of ordered work-report hashes
  const [error1, goodsetResult] = decodeVariableSequence<Uint8Array>(
    currentData,
    (data) => {
      if (data.length < 32) {
        return safeError(new Error('Insufficient data for work-report hash'))
      }
      const hash = data.slice(0, 32)
      return safeResult({
        value: hash,
        remaining: data.slice(32),
        consumed: 32,
      })
    },
  )
  if (error1) return safeError(error1)
  const goodset = new Set(goodsetResult.value.map((hash) => bytesToHex(hash)))
  currentData = goodsetResult.remaining

  // 2. badset: Variable-length sequence of ordered work-report hashes
  const [error2, badsetResult] = decodeVariableSequence<Uint8Array>(
    currentData,
    (data) => {
      if (data.length < 32) {
        return safeError(new Error('Insufficient data for work-report hash'))
      }
      const hash = data.slice(0, 32)
      return safeResult({
        value: hash,
        remaining: data.slice(32),
        consumed: 32,
      })
    },
  )
  if (error2) return safeError(error2)
  const badset = new Set(badsetResult.value.map((hash) => bytesToHex(hash)))
  currentData = badsetResult.remaining

  // 3. wonkyset: Variable-length sequence of ordered work-report hashes
  const [error3, wonkysetResult] = decodeVariableSequence<Uint8Array>(
    currentData,
    (data) => {
      if (data.length < 32) {
        return safeError(new Error('Insufficient data for work-report hash'))
      }
      const hash = data.slice(0, 32)
      return safeResult({
        value: hash,
        remaining: data.slice(32),
        consumed: 32,
      })
    },
  )
  if (error3) return safeError(error3)
  const wonkyset = new Set(wonkysetResult.value.map((hash) => bytesToHex(hash)))
  currentData = wonkysetResult.remaining

  // 4. offenders: Variable-length sequence of ordered validator Ed25519 keys
  const [error4, offendersResult] = decodeVariableSequence<Uint8Array>(
    currentData,
    (data) => {
      if (data.length < 32) {
        return safeError(new Error('Insufficient data for validator key'))
      }
      const key = data.slice(0, 32)
      return safeResult({
        value: key,
        remaining: data.slice(32),
        consumed: 32,
      })
    },
  )
  if (error4) return safeError(error4)
  const offenders = new Set(offendersResult.value.map((key) => bytesToHex(key)))
  currentData = offendersResult.remaining

  const consumed = data.length - currentData.length

  return safeResult({
    value: {
      goodSet: goodset,
      badSet: badset,
      wonkySet: wonkyset,
      offenders: offenders,
    },
    remaining: currentData,
    consumed,
  })
}
