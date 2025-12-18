/**
 * State work reports serialization
 *
 * *** DO NOT REMOVE - GRAY PAPER FORMULA ***
 * Gray Paper Section: merklization.tex (Equation C(10))
 * Formula:
 *
 * C(10) ↦ encode{
 *   sq{build{
 *     maybe{tup{rs_workreport, encode[4]{rs_timestamp}}}
 *   }{
 *     tup{rs_workreport, rs_timestamp} orderedin reports
 *   }}
 * }
 *
 * Gray Paper Section: reporting_assurance.tex (Equation 18-23)
 * Reports state structure:
 *
 * reports ∈ sequence[Ccorecount]{
 *   optional{tup{
 *     isa{rs_workreport}{workreport},
 *     isa{rs_timestamp}{timeslot}
 *   }}
 * }
 *
 * Implements Gray Paper state work reports serialization as specified
 * Reference: graypaper/text/merklization.tex and reporting_assurance.tex
 *
 * *** IMPLEMENTER EXPLANATION ***
 * State work reports track pending work reports per core that have been
 * reported but are not yet known to be available to a super-majority of validators.
 *
 * Key concepts:
 * - **Per-core tracking**: Each core can have at most one pending work report
 * - **Availability pending**: Reports await super-majority validator availability assurance
 * - **Timestamp tracking**: When each report was submitted for timeout handling
 * - **Fixed structure**: Exactly Ccorecount elements (341 cores by default)
 * - **Optional reports**: Each core slot is either None or Some{workreport, timestamp}
 *
 * State vs Extrinsic difference:
 * - **State reports**: Fixed-length sequence of maybe{tup{workreport, timestamp}}
 * - **Extrinsic guarantees**: Variable-length sequence of tup{workreport, timeslot, credential}
 * - **No credentials**: State reports don't include validator signatures
 * - **Core assignment**: State reports are indexed by core, guarantees are not
 *
 * This is critical for JAM's work report lifecycle management that ensures
 * proper core utilization and availability tracking.
 */

import { concatBytes } from '@pbnjam/core'
import type {
  DecodingResult,
  IConfigService,
  PendingReport,
  Reports,
  Safe,
} from '@pbnjam/types'
import { safeError, safeResult } from '@pbnjam/types'
import { decodeFixedLength, encodeFixedLength } from '../core/fixed-length'
import { decodeWorkReport, encodeWorkReport } from '../work-package/work-report'

/**
 * Encode state work reports according to Gray Paper specification.
 *
 * Gray Paper merklization.tex equation C(10):
 * C(10) ↦ encode{sq{build{maybe{tup{rs_workreport, encode[4]{rs_timestamp}}}}{tup{rs_workreport, rs_timestamp} orderedin reports}}
 *
 * Gray Paper reporting_assurance.tex equation 18-23:
 * reports ∈ sequence[Ccorecount]{optional{tup{isa{rs_workreport}{workreport}, isa{rs_timestamp}{timeslot}}}}
 *
 * State work reports track pending work reports per core that have been
 * reported but are not yet known to be available to a super-majority of validators.
 *
 * Field encoding per Gray Paper:
 * 1. Fixed-length sequence of Ccorecount elements
 * 2. Each element is optional{tup{workreport, timestamp}}
 * 3. Work report encoded using standard workreport encoding
 * 4. Timestamp encoded as 4-byte fixed-length integer
 *
 * State semantics:
 * - **Per-core tracking**: Each core can have at most one pending work report
 * - **Availability pending**: Reports await super-majority validator availability assurance
 * - **Timestamp tracking**: When each report was submitted for timeout handling
 * - **Fixed structure**: Exactly Ccorecount elements (341 cores by default)
 * - **Optional reports**: Each core slot is either None or Some{workreport, timestamp}
 *
 * State vs Extrinsic difference:
 * - **State reports**: Fixed-length sequence of maybe{tup{workreport, timestamp}}
 * - **Extrinsic guarantees**: Variable-length sequence of tup{workreport, timeslot, credential}
 * - **No credentials**: State reports don't include validator signatures
 * - **Core assignment**: State reports are indexed by core, guarantees are not
 *
 * ✅ CORRECT: Uses fixed-length sequence encoding for Ccorecount cores
 * ✅ CORRECT: Each element is optional{tup{workreport, timestamp}}
 * ✅ CORRECT: Work report encoded using standard Gray Paper compliant function
 * ✅ CORRECT: Timestamp encoded as 4-byte fixed-length integer
 * ✅ CORRECT: Supports per-core work report tracking
 *
 * @param reports - Reports state to encode
 * @param configService - Configuration service for core count
 * @returns Encoded octet sequence
 */
export function encodeStateWorkReports(
  reports: Reports,
  configService: IConfigService,
): Safe<Uint8Array> {
  const coreCount = configService.numCores
  const parts: Uint8Array[] = []

  // Gray Paper: sequence[Ccorecount]{optional{tup{workreport, timestamp}}}
  for (let coreIndex = 0; coreIndex < coreCount; coreIndex++) {
    // Check if this core has a pending report
    const coreReport = reports.coreReports[coreIndex]

    if (coreReport?.workReport && coreReport?.timeslot !== undefined) {
      // Some: encode discriminator (1) + workreport + timestamp
      parts.push(new Uint8Array([1])) // some discriminator

      // Encode the work report using proper Gray Paper compliant function
      const [error1, encodedReport] = encodeWorkReport(coreReport.workReport)
      if (error1) {
        return safeError(error1)
      }
      parts.push(encodedReport)

      // Gray Paper: encode[4]{rs_timestamp} - 4-byte fixed-length timestamp
      const [error2, encodedTimestamp] = encodeFixedLength(
        BigInt(coreReport.timeslot),
        4n,
      )
      if (error2) {
        return safeError(error2)
      }
      parts.push(encodedTimestamp)
    } else {
      // None: encode discriminator (0)
      parts.push(new Uint8Array([0])) // none discriminator
    }
  }

  return safeResult(concatBytes(parts))
}

/**
 * Decode state work reports according to Gray Paper specification.
 *
 * Decodes the Gray Paper compliant state work reports structure:
 * reports ∈ sequence[Ccorecount]{optional{tup{workreport, timestamp}}}
 *
 * Each core slot is decoded as either None or Some{workreport, timestamp}:
 * - None: discriminator 0
 * - Some: discriminator 1 + workreport + 4-byte timestamp
 *
 * ✅ CORRECT: Decodes fixed-length sequence of Ccorecount cores
 * ✅ CORRECT: Each element is optional{tup{workreport, timestamp}}
 * ✅ CORRECT: Work report decoded using standard Gray Paper compliant function
 * ✅ CORRECT: Timestamp decoded as 4-byte fixed-length integer
 * ✅ CORRECT: Maintains round-trip compatibility with encoding
 *
 * @param data - Octet sequence to decode
 * @param configService - Configuration service for core count
 * @returns Decoded reports state and remaining data
 */
export function decodeStateWorkReports(
  data: Uint8Array,
  configService: IConfigService,
): Safe<DecodingResult<Reports>> {
  const coreCount = configService.numCores
  let currentData = data
  const coreReports: (PendingReport | null)[] = new Array(coreCount).fill(null)

  // Gray Paper: sequence[Ccorecount]{optional{tup{workreport, timestamp}}}
  for (let coreIndex = 0; coreIndex < coreCount; coreIndex++) {
    if (currentData.length < 1) {
      return safeError(
        new Error(
          `Insufficient data for core ${coreIndex} discriminator in reports`,
        ),
      )
    }

    const discriminator = currentData[0]
    currentData = currentData.slice(1)

    if (discriminator === 0) {
      // None: do nothing
    } else if (discriminator === 1) {
      // Some: decode workreport + timestamp

      // Decode work report
      const [workReportError, workReportResult] = decodeWorkReport(currentData)
      if (workReportError) {
        return safeError(workReportError)
      }
      currentData = workReportResult.remaining

      // Gray Paper: decode[4]{rs_timestamp} - 4-byte fixed-length timestamp
      const [timestampError, timestampResult] = decodeFixedLength(
        currentData,
        4n,
      )
      if (timestampError) {
        return safeError(timestampError)
      }
      currentData = timestampResult.remaining

      coreReports[coreIndex] = {
        workReport: workReportResult.value,
        timeslot: Number(timestampResult.value),
      }
    } else {
      return safeError(
        new Error(
          `Invalid discriminator ${discriminator} for core ${coreIndex} in reports`,
        ),
      )
    }
  }

  const consumed = data.length - currentData.length

  return safeResult({
    value: { coreReports },
    remaining: currentData,
    consumed,
  })
}
