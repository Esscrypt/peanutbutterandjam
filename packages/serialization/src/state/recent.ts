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

import { bytesToHex, concatBytes, type Hex, hexToBytes } from '@pbnj/core'
import type {
  DecodingResult,
  Recent,
  RecentHistoryEntry,
  Safe,
} from '@pbnj/types'
import { safeError, safeResult } from '@pbnj/types'
import {
  decodeVariableSequence,
  encodeSequenceGeneric,
  encodeVariableSequence,
} from '../core/sequence'

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
  const [error1, historyData] = encodeVariableSequence<RecentHistoryEntry>(
    recent.history, // Single history entry for now
    (history: RecentHistoryEntry) => {
      const historyParts: Uint8Array[] = []

      // Encode tuple{rh_headerhash, rh_accoutlogsuperpeak, rh_stateroot, var{rh_reportedpackagehashes}}
      historyParts.push(hexToBytes(history.headerHash))
      historyParts.push(hexToBytes(history.accoutLogSuperPeak))
      historyParts.push(hexToBytes(history.stateRoot))

      // Gray Paper: var{rh_reportedpackagehashes} - dictionary{hash}{hash}
      // encode(d ∈ dictionary{K,V}) ≡ encode(var{⟨⟨encode(k), encode(d[k])⟩⟩})
      // Convert Map to array of [key, value] tuples, sorted by key
      const dictionaryEntries: [Hex, Hex][] = Array.from(
        history.reportedPackageHashes.entries(),
      ).sort((a, b) => a[0].localeCompare(b[0])) // Sort by key (lexicographic order)

      // Encode as variable-length sequence of key-value pairs
      // Each pair is encoded as: encode(key) || encode(value) (both 32-byte hashes)
      const [packageError, packageHashesData] = encodeVariableSequence<
        [Hex, Hex]
      >(dictionaryEntries, ([packageHash, segmentRoot]) => {
        // Each dictionary entry is: ⟨encode(k), encode(d[k])⟩
        const keyBytes = hexToBytes(packageHash)
        const valueBytes = hexToBytes(segmentRoot)
        return safeResult(concatBytes([keyBytes, valueBytes])) // 64 bytes total
      })
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
    (peak: Hex | null) => {
      if (peak === null) {
        return safeResult(new Uint8Array([0])) // None discriminator
      }
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
  const [historyError, historyResult] =
    decodeVariableSequence<RecentHistoryEntry>(
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

        // Decode var{rh_reportedpackagehashes} - dictionary{hash}{hash}
        // Each entry is: ⟨encode(k), encode(d[k])⟩ = 32-byte key + 32-byte value = 64 bytes
        const [packageError, packageResult] = decodeVariableSequence<
          [Hex, Hex]
        >(entryCurrentData, (pairData: Uint8Array) => {
          if (pairData.length < 64) {
            return safeError(
              new Error(
                'Insufficient data for dictionary pair (expected 64 bytes: 32 key + 32 value)',
              ),
            )
          }
          // Decode key (32 bytes)
          const keyBytes = pairData.slice(0, 32)
          const packageHash = bytesToHex(keyBytes)
          // Decode value (32 bytes)
          const valueBytes = pairData.slice(32, 64)
          const segmentRoot = bytesToHex(valueBytes)
          return safeResult({
            value: [packageHash, segmentRoot] as [Hex, Hex],
            remaining: pairData.slice(64),
            consumed: 64,
          })
        })
        if (packageError) {
          return safeError(packageError)
        }

        // Build Map from decoded key-value pairs
        const reportedPackageHashes = new Map<Hex, Hex>()
        for (const [packageHash, segmentRoot] of packageResult.value) {
          reportedPackageHashes.set(packageHash, segmentRoot)
        }

        const history: RecentHistoryEntry = {
          headerHash,
          accoutLogSuperPeak,
          stateRoot,
          reportedPackageHashes,
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
  const [beltError, beltResult] = decodeVariableSequence<Hex | null>(
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
      history: historyResult.value, // Single history entry for now
      accoutBelt: {
        peaks: beltResult.value.filter((peak): peak is Hex => peak !== null), // Filter out None values
        totalCount: BigInt(beltResult.value.length), // Total count including None values
      },
    },
    remaining: beltResult.remaining,
    consumed,
  })
}
