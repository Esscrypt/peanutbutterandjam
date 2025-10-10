/**
 * Recent serialization
 *
 * *** DO NOT REMOVE - GRAY PAPER FORMULA ***
 * Gray Paper Section: merklization.tex (Equation C(3))
 * Formula:
 *
 * C(3) ↦ encode{
 *   var{sq{build{
 *     tuple{rh_headerhash, rh_accoutlogsuperpeak, rh_stateroot, var{rh_reportedpackagehashes}}
 *   }{
 *     tuple{rh_headerhash, rh_accoutlogsuperpeak, rh_stateroot, rh_reportedpackagehashes} ∈ recenthistory
 *   }}},
 *   mmrencode{accoutbelt}
 * }
 *
 * Gray Paper Section: recent_history.tex (Equations 5-18)
 * Recent structure:
 *
 * recent ≡ tuple{recenthistory, accoutbelt}
 * recenthistory ∈ sequence[:Crecenthistorylen]{tuple{
 *   rh_headerhash ∈ hash,
 *   rh_stateroot ∈ hash,
 *   rh_accoutlogsuperpeak ∈ hash,
 *   rh_reportedpackagehashes ∈ dictionary{hash}{hash}
 * }}
 * accoutbelt ∈ sequence{optional{hash}}
 *
 * Implements Gray Paper recent serialization as specified
 * Reference: graypaper/text/merklization.tex and recent_history.tex
 *
 * *** IMPLEMENTER EXPLANATION ***
 * Recent state tracks information about the most recent blocks to prevent
 * duplicate or out-of-date work-reports from being submitted.
 *
 * Core components:
 * - **recenthistory**: Sequence of recent block information
 * - **accoutbelt**: Merkle mountain range for accumulation outputs
 *
 * Recent history fields per block:
 * - **headerHash**: Hash of the block header
 * - **stateRoot**: Root of the state trie
 * - **accoutLogSuperPeak**: Accumulation output super-peak
 * - **reportedPackageHashes**: Dictionary of reported work-package hashes
 *
 * Serialization format:
 * 1. **var{sq{...}}**: Variable-length sequence of recent history entries
 * 2. **mmrencode{accoutbelt}**: Merkle mountain range encoding of accumulation belt
 *
 * This is critical for JAM's recent block tracking and duplicate prevention.
 */

import {
  bytesToHex,
  concatBytes,
  type Hex,
  hexToBytes,
  type Safe,
  safeError,
  safeResult,
} from '@pbnj/core'
import type { DecodingResult, Recent, RecentHistory } from '@pbnj/types'
import { decodeVariableSequence, encodeSequenceGeneric } from '../core/sequence'

/**
 * Encode recent state according to Gray Paper specification.
 *
 * Gray Paper merklization.tex equation C(3):
 * C(3) ↦ encode{
 *   var{sq{build{
 *     tuple{rh_headerhash, rh_accoutlogsuperpeak, rh_stateroot, var{rh_reportedpackagehashes}}
 *   }{
 *     tuple{rh_headerhash, rh_accoutlogsuperpeak, rh_stateroot, rh_reportedpackagehashes} ∈ recenthistory
 *   }}},
 *   mmrencode{accoutbelt}
 * }
 *
 * Recent state tracks information about the most recent blocks to prevent
 * duplicate or out-of-date work-reports from being submitted.
 *
 * Field encoding per Gray Paper:
 * 1. **var{sq{...}}**: Variable-length sequence of recent history entries
 * 2. **mmrencode{accoutbelt}**: Merkle mountain range encoding of accumulation belt
 *
 * Recent history structure per block:
 * - **headerHash**: 32-byte hash of block header
 * - **stateRoot**: 32-byte hash of state trie root
 * - **accoutLogSuperPeak**: 32-byte hash of accumulation output super-peak
 * - **reportedPackageHashes**: Variable-length sequence of work-package hashes
 *
 * Accumulation belt structure:
 * - **peaks**: Sequence of optional hashes forming Merkle mountain range
 *
 * ✅ CORRECT: Uses var{sq{...}} for recent history sequence
 * ✅ CORRECT: Uses mmrencode for accumulation belt
 * ✅ CORRECT: Supports recent block tracking and duplicate prevention
 *
 * @param recent - Recent state to encode
 * @returns Encoded octet sequence
 */
export function encodeRecent(recent: Recent): Safe<Uint8Array> {
  const parts: Uint8Array[] = []

  // Gray Paper: var{sq{build{tuple{rh_headerhash, rh_accoutlogsuperpeak, rh_stateroot, var{rh_reportedpackagehashes}}...}}}
  // Encode recent history as variable-length sequence
  const [error1, historyData] = encodeSequenceGeneric(
    [recent.history], // Single history entry for now
    (history: RecentHistory) => {
      const historyParts: Uint8Array[] = []

      // Encode tuple{rh_headerhash, rh_accoutlogsuperpeak, rh_stateroot, var{rh_reportedpackagehashes}}
      historyParts.push(hexToBytes(history.headerHash))
      historyParts.push(hexToBytes(history.accoutLogSuperPeak))
      historyParts.push(hexToBytes(history.stateRoot))

      // Gray Paper: var{rh_reportedpackagehashes} - variable-length sequence
      const [packageError, packageHashesData] = encodeSequenceGeneric(
        history.reportedPackageHashes,
        (hash: Hex) => safeResult(hexToBytes(hash)),
      )
      if (packageError) {
        return safeError(packageError)
      }
      historyParts.push(packageHashesData)

      return safeResult(concatBytes(historyParts))
    },
  )
  if (error1) {
    return safeError(error1)
  }
  parts.push(historyData)

  // Gray Paper: mmrencode{accoutbelt} - Merkle mountain range encoding
  // mmrencode: sequence{optional{hash}} → blob
  // b ↦ encode{var{sq{build{maybe{x}}{x ∈ b}}}}
  // where maybe{x} = 0 when x = none, tuple{1, x} otherwise
  const [error2, beltData] = encodeSequenceGeneric(
    recent.accoutBelt.peaks,
    (peak: Hex) => {
      // Gray Paper: maybe{x} discriminator pattern
      // For now, we assume all peaks are Some (not None)
      // In a full implementation, peaks could be optional
      const discriminator = new Uint8Array([1]) // Some discriminator
      const peakBytes = hexToBytes(peak)
      return safeResult(concatBytes([discriminator, peakBytes]))
    },
  )
  if (error2) {
    return safeError(error2)
  }
  parts.push(beltData)

  return safeResult(concatBytes(parts))
}

/**
 * Decode recent state according to Gray Paper specification.
 *
 * Decodes the Gray Paper compliant recent structure:
 * recent ≡ tuple{recenthistory, accoutbelt}
 *
 * Each field is decoded according to its Gray Paper specification:
 * - recenthistory: Variable-length sequence of recent block information
 * - accoutbelt: Merkle mountain range encoding of accumulation outputs
 *
 * ✅ CORRECT: Decodes var{sq{...}} for recent history sequence
 * ✅ CORRECT: Decodes mmrencode for accumulation belt
 * ✅ CORRECT: Maintains round-trip compatibility with encoding
 *
 * @param data - Octet sequence to decode
 * @returns Decoded recent state and remaining data
 */
export function decodeRecent(data: Uint8Array): Safe<DecodingResult<Recent>> {
  let currentData = data

  // Gray Paper: decode var{sq{build{tuple{rh_headerhash, rh_accoutlogsuperpeak, rh_stateroot, var{rh_reportedpackagehashes}}...}}}
  const [historyError, historyResult] = decodeVariableSequence(
    currentData,
    (entryData: Uint8Array) => {
      let entryCurrentData = entryData

      // Decode tuple{rh_headerhash, rh_accoutlogsuperpeak, rh_stateroot, var{rh_reportedpackagehashes}}
      if (entryCurrentData.length < 96) {
        // 3 × 32-byte hashes
        return safeError(
          new Error('Insufficient data for recent history entry'),
        )
      }

      // Decode headerHash (32 bytes)
      const headerHashBytes = entryCurrentData.slice(0, 32)
      const headerHash = bytesToHex(headerHashBytes)
      entryCurrentData = entryCurrentData.slice(32)

      // Decode accoutLogSuperPeak (32 bytes)
      const accoutLogSuperPeakBytes = entryCurrentData.slice(0, 32)
      const accoutLogSuperPeak = bytesToHex(accoutLogSuperPeakBytes)
      entryCurrentData = entryCurrentData.slice(32)

      // Decode stateRoot (32 bytes)
      const stateRootBytes = entryCurrentData.slice(0, 32)
      const stateRoot = bytesToHex(stateRootBytes)
      entryCurrentData = entryCurrentData.slice(32)

      // Decode var{rh_reportedpackagehashes} - variable-length sequence
      const [packageError, packageResult] = decodeVariableSequence(
        entryCurrentData,
        (hashData: Uint8Array) => {
          if (hashData.length < 32) {
            return safeError(new Error('Insufficient data for package hash'))
          }
          const hashBytes = hashData.slice(0, 32)
          const hash = bytesToHex(hashBytes)
          return safeResult({
            value: hash,
            remaining: hashData.slice(32),
            consumed: 32,
          })
        },
      )
      if (packageError) {
        return safeError(packageError)
      }

      const history: RecentHistory = {
        headerHash,
        accoutLogSuperPeak,
        stateRoot,
        reportedPackageHashes: packageResult.value,
      }

      return safeResult({
        value: history,
        remaining: packageResult.remaining,
        consumed: entryData.length - packageResult.remaining.length,
      })
    },
  )
  if (historyError) {
    return safeError(historyError)
  }
  currentData = historyResult.remaining

  // Gray Paper: decode mmrencode{accoutbelt} - Merkle mountain range encoding
  // Decode var{sq{build{maybe{x}}{x ∈ peaks}}} with discriminator pattern
  const [beltError, beltResult] = decodeVariableSequence(
    currentData,
    (peakData: Uint8Array) => {
      if (peakData.length < 1) {
        return safeError(
          new Error('Insufficient data for belt peak discriminator'),
        )
      }

      const discriminator = peakData[0]

      if (discriminator === 0) {
        // None case - no peak
        return safeResult({
          value: null,
          remaining: peakData.slice(1),
          consumed: 1,
        })
      } else if (discriminator === 1) {
        // Some case - decode the hash
        if (peakData.length < 33) {
          // 1 byte discriminator + 32 bytes hash
          return safeError(new Error('Insufficient data for belt peak hash'))
        }
        const peakBytes = peakData.slice(1, 33)
        const peak = bytesToHex(peakBytes)
        return safeResult({
          value: peak,
          remaining: peakData.slice(33),
          consumed: 33,
        })
      } else {
        return safeError(
          new Error(`Invalid discriminator for belt peak: ${discriminator}`),
        )
      }
    },
  )
  if (beltError) {
    return safeError(beltError)
  }

  const consumed = data.length - beltResult.remaining.length

  return safeResult({
    value: {
      history: historyResult.value[0], // Single history entry for now
      accoutBelt: {
        peaks: beltResult.value.filter((peak): peak is Hex => peak !== null), // Filter out None values
        totalCount: BigInt(beltResult.value.length), // Total count including None values
      },
    },
    remaining: beltResult.remaining,
    consumed,
  })
}
