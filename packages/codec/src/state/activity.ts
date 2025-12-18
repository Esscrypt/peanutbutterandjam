/**
 * Activity Serialization
 *
 * *** DO NOT REMOVE - GRAY PAPER FORMULA ***
 * Gray Paper Section: Chapter 11 - Activity Statistics
 * Formula (Equation 11):
 *
 * activity ≡ ⟨valstatsaccumulator, valstatsprevious, corestats, servicestats⟩
 *
 * Activity statistics track validator performance and core/service activity.
 * This includes validator statistics for current and previous epochs,
 * core statistics for data availability and processing, and service statistics.
 *
 * Structure per Gray Paper equation 11:
 * - valstatsaccumulator: sequence of validator statistics (current epoch)
 * - valstatsprevious: sequence of validator statistics (previous epoch)
 * - corestats: sequence of core statistics
 * - servicestats: sequence of (serviceId, serviceStats) tuples
 *
 * Encoding:
 * - Each component is encoded as a sequence using encodeSequenceGeneric
 * - Validator stats contain: blocks, tickets, preimagecount, preimagesize, guarantees, assurances
 * - Core stats contain: daLoad, popularity, importCount, extrinsicCount, extrinsicSize, exportCount, bundleLength
 * - Service stats contain: provision, refinement, accumulation, importCount, extrinsicCount, extrinsicSize, exportCount
 *
 * ✅ CORRECT: Encodes activity statistics with proper Gray Paper structure
 * ✅ CORRECT: Uses sequences instead of lengths for validator stats
 * ✅ CORRECT: Properly encodes all fields of each statistic type
 */

import { concatBytes } from '@pbnjam/core'
import type {
  Activity,
  CoreStats,
  DecodingResult,
  IConfigService,
  Safe,
  ServiceStats,
  ValidatorStats,
} from '@pbnjam/types'
import { safeError, safeResult } from '@pbnjam/types'
import { decodeFixedLength, encodeFixedLength } from '../core/fixed-length'
import { decodeNatural, encodeNatural } from '../core/natural-number'
import {
  decodeSequenceGeneric,
  decodeVariableSequence,
  encodeSequenceGeneric,
  encodeVariableSequence,
} from '../core/sequence'

/**
 * Encode validator statistics according to Gray Paper equation 12-20
 * Each validator stat contains: blocks, tickets, preimagecount, preimagesize, guarantees, assurances
 *
 * Gray Paper: encode[4]{valstatsaccumulator, valstatsprevious}
 * According to serialization.tex line 114:
 * encode[l]{tuple{a, b, ...}} ≡ encode[l]{a} ∥ encode[l]{b} ∥ ...
 * This means each field in the tuple should be encoded as encode[4] (4-byte fixed-length)
 */
function encodeValidatorStats(validatorStat: ValidatorStats): Safe<Uint8Array> {
  const parts: Uint8Array[] = []

  // Gray Paper: encode[4]{valstatsaccumulator, valstatsprevious}
  // Each field in the validator stats tuple should be encode[4] (4-byte fixed-length)
  // blocks: encode[4]{N}
  const [error1, blocksData] = encodeFixedLength(
    BigInt(validatorStat.blocks),
    4n,
  )
  if (error1) return safeError(error1)
  parts.push(blocksData)

  // tickets: encode[4]{N}
  const [error2, ticketsData] = encodeFixedLength(
    BigInt(validatorStat.tickets),
    4n,
  )
  if (error2) return safeError(error2)
  parts.push(ticketsData)

  // preimagecount: encode[4]{N}
  const [error3, preimageCountData] = encodeFixedLength(
    BigInt(validatorStat.preimageCount),
    4n,
  )
  if (error3) return safeError(error3)
  parts.push(preimageCountData)

  // preimagesize: encode[4]{N}
  const [error4, preimageSizeData] = encodeFixedLength(
    BigInt(validatorStat.preimageSize),
    4n,
  )
  if (error4) return safeError(error4)
  parts.push(preimageSizeData)

  // guarantees: encode[4]{N}
  const [error5, guaranteesData] = encodeFixedLength(
    BigInt(validatorStat.guarantees),
    4n,
  )
  if (error5) return safeError(error5)
  parts.push(guaranteesData)

  // assurances: encode[4]{N}
  const [error6, assurancesData] = encodeFixedLength(
    BigInt(validatorStat.assurances),
    4n,
  )
  if (error6) return safeError(error6)
  parts.push(assurancesData)

  return safeResult(concatBytes(parts))
}

/**
 * Decode validator statistics according to Gray Paper equation 12-20
 *
 * Gray Paper: encode[4]{valstatsaccumulator, valstatsprevious}
 * Each field in the validator stats tuple should be decode[4] (4-byte fixed-length)
 */
function decodeValidatorStats(
  data: Uint8Array,
): Safe<DecodingResult<ValidatorStats>> {
  let currentData = data

  // Gray Paper: encode[4]{valstatsaccumulator, valstatsprevious}
  // Each field in the validator stats tuple should be decode[4] (4-byte fixed-length)
  // blocks: decode[4]{N}
  const [error1, blocksResult] = decodeFixedLength(currentData, 4n)
  if (error1) return safeError(error1)
  currentData = blocksResult.remaining

  // tickets: decode[4]{N}
  const [error2, ticketsResult] = decodeFixedLength(currentData, 4n)
  if (error2) return safeError(error2)
  currentData = ticketsResult.remaining

  // preimagecount: decode[4]{N}
  const [error3, preimageCountResult] = decodeFixedLength(currentData, 4n)
  if (error3) return safeError(error3)
  currentData = preimageCountResult.remaining

  // preimagesize: decode[4]{N}
  const [error4, preimageSizeResult] = decodeFixedLength(currentData, 4n)
  if (error4) return safeError(error4)
  currentData = preimageSizeResult.remaining

  // guarantees: decode[4]{N}
  const [error5, guaranteesResult] = decodeFixedLength(currentData, 4n)
  if (error5) return safeError(error5)
  currentData = guaranteesResult.remaining

  // assurances: decode[4]{N}
  const [error6, assurancesResult] = decodeFixedLength(currentData, 4n)
  if (error6) return safeError(error6)
  currentData = assurancesResult.remaining

  const validatorStat: ValidatorStats = {
    blocks: Number(blocksResult.value),
    tickets: Number(ticketsResult.value),
    preimageCount: Number(preimageCountResult.value),
    preimageSize: Number(preimageSizeResult.value),
    guarantees: Number(guaranteesResult.value),
    assurances: Number(assurancesResult.value),
  }

  return safeResult({
    value: validatorStat,
    remaining: currentData,
    consumed: data.length - currentData.length,
  })
}

/**
 * Encode core statistics according to Gray Paper
 */
function encodeCoreStats(coreStat: CoreStats): Safe<Uint8Array> {
  const parts: Uint8Array[] = []

  // daLoad: N
  const [error1, daLoadData] = encodeNatural(BigInt(coreStat.daLoad))
  if (error1) return safeError(error1)
  parts.push(daLoadData)

  // popularity: N
  const [error2, popularityData] = encodeNatural(BigInt(coreStat.popularity))
  if (error2) return safeError(error2)
  parts.push(popularityData)

  // importCount: N
  const [error3, importCountData] = encodeNatural(BigInt(coreStat.importCount))
  if (error3) return safeError(error3)
  parts.push(importCountData)

  // extrinsicCount: N
  const [error4, extrinsicCountData] = encodeNatural(
    BigInt(coreStat.extrinsicCount),
  )
  if (error4) return safeError(error4)
  parts.push(extrinsicCountData)

  // extrinsicSize: N
  const [error5, extrinsicSizeData] = encodeNatural(
    BigInt(coreStat.extrinsicSize),
  )
  if (error5) return safeError(error5)
  parts.push(extrinsicSizeData)

  // exportCount: N
  const [error6, exportCountData] = encodeNatural(BigInt(coreStat.exportCount))
  if (error6) return safeError(error6)
  parts.push(exportCountData)

  // bundleLength: N
  const [error7, bundleLengthData] = encodeNatural(
    BigInt(coreStat.bundleLength),
  )
  if (error7) return safeError(error7)
  parts.push(bundleLengthData)

  // gasUsed: N
  const [error8, gasUsedData] = encodeNatural(BigInt(coreStat.gasUsed))
  if (error8) return safeError(error8)
  parts.push(gasUsedData)

  return safeResult(concatBytes(parts))
}

/**
 * Decode core statistics according to Gray Paper
 */
function decodeCoreStats(data: Uint8Array): Safe<DecodingResult<CoreStats>> {
  let currentData = data

  // daLoad: N
  const [error1, daLoadResult] = decodeNatural(currentData)
  if (error1) return safeError(error1)
  currentData = daLoadResult.remaining

  // popularity: N
  const [error2, popularityResult] = decodeNatural(currentData)
  if (error2) return safeError(error2)
  currentData = popularityResult.remaining

  // importCount: N
  const [error3, importCountResult] = decodeNatural(currentData)
  if (error3) return safeError(error3)
  currentData = importCountResult.remaining

  // extrinsicCount: N
  const [error4, extrinsicCountResult] = decodeNatural(currentData)
  if (error4) return safeError(error4)
  currentData = extrinsicCountResult.remaining

  // extrinsicSize: N
  const [error5, extrinsicSizeResult] = decodeNatural(currentData)
  if (error5) return safeError(error5)
  currentData = extrinsicSizeResult.remaining

  // exportCount: N
  const [error6, exportCountResult] = decodeNatural(currentData)
  if (error6) return safeError(error6)
  currentData = exportCountResult.remaining

  // bundleLength: N
  const [error7, bundleLengthResult] = decodeNatural(currentData)
  if (error7) return safeError(error7)
  currentData = bundleLengthResult.remaining

  // gasUsed: N
  const [error8, gasUsedResult] = decodeNatural(currentData)
  if (error8) return safeError(error8)
  currentData = gasUsedResult.remaining

  const coreStat: CoreStats = {
    daLoad: Number(daLoadResult.value),
    popularity: Number(popularityResult.value),
    importCount: Number(importCountResult.value),
    extrinsicCount: Number(extrinsicCountResult.value),
    extrinsicSize: Number(extrinsicSizeResult.value),
    exportCount: Number(exportCountResult.value),
    bundleLength: Number(bundleLengthResult.value),
    gasUsed: Number(gasUsedResult.value),
  }

  return safeResult({
    value: coreStat,
    remaining: currentData,
    consumed: data.length - currentData.length,
  })
}

/**
 * Encode service statistics according to Gray Paper
 *
 * *** DO NOT REMOVE - GRAY PAPER FORMULA ***
 * Gray Paper Section: statistics.tex lines 91-101
 * Formula:
 *
 * servicestats ∈ dictionary{serviceid}{tuple{
 *   provision: tuple{N, N},
 *   refinement: tuple{N, gas},
 *   importcount: N,
 *   xtcount: N,
 *   xtsize: N,
 *   exportcount: N,
 *   accumulation: tuple{N, gas}
 * }}
 *
 * According to Gray Paper serialization.tex line 20:
 * encode{tuple{a, b, ...}} ≡ encode{a} ∥ encode{b} ∥ ...
 *
 * Encoding order (Gray Paper statistics.tex line 91-101 - type definition):
 * 1. provision: encode(N) ∥ encode(N) - tuple{N, N}
 * 2. refinement: encode(N) ∥ encode(gas) - tuple{N, gas}
 * 3. importcount: encode(N)
 * 4. xtcount: encode(N)
 * 5. xtsize: encode(N)
 * 6. exportcount: encode(N)
 * 7. accumulation: encode(N) ∥ encode(gas) - tuple{N, gas}
 *
 * Note: gas is encoded as a natural number (N)
 * Note: TypeScript ServiceStats interface uses tuples to match Gray Paper
 *       provision: [count, size] - tuple{N, N}
 *       refinement: [count, gas] - tuple{N, gas}
 *       accumulation: [count, gas] - tuple{N, gas}
 */
function encodeServiceStats(serviceStat: ServiceStats): Safe<Uint8Array> {
  const parts: Uint8Array[] = []

  // Gray Paper statistics.tex line 91-101: servicestats tuple order (type definition)
  // According to serialization.tex line 20: encode{tuple{a, b, ...}} ≡ encode{a} ∥ encode{b} ∥ ...
  // The order in the tuple matches the type definition in statistics.tex line 91-101:
  // 1. provision: tuple{N, N}
  // 2. refinement: tuple{N, gas}
  // 3. importcount: N
  // 4. xtcount: N
  // 5. xtsize: N
  // 6. exportcount: N
  // 7. accumulation: tuple{N, gas}

  // 1. provision: tuple{N, N}
  // encode{tuple{N, N}} ≡ encode{N} ∥ encode{N}
  const [error1, provisionData1] = encodeNatural(
    BigInt(serviceStat.provision[0]),
  ) // count
  if (error1) return safeError(error1)
  parts.push(provisionData1)
  const [error2, provisionData2] = encodeNatural(
    BigInt(serviceStat.provision[1]),
  ) // size
  if (error2) return safeError(error2)
  parts.push(provisionData2)

  // 2. refinement: tuple{N, gas}
  // encode{tuple{N, gas}} ≡ encode{N} ∥ encode{gas}
  const [error3, refinementData1] = encodeNatural(
    BigInt(serviceStat.refinement[0]),
  ) // count
  if (error3) return safeError(error3)
  parts.push(refinementData1)
  const [error4, refinementData2] = encodeNatural(
    BigInt(serviceStat.refinement[1]),
  ) // gas
  if (error4) return safeError(error4)
  parts.push(refinementData2)

  // 3. importcount: N
  const [error5, importCountData] = encodeNatural(
    BigInt(serviceStat.importCount),
  )
  if (error5) return safeError(error5)
  parts.push(importCountData)

  // 4. xtcount: N
  const [error6, extrinsicCountData] = encodeNatural(
    BigInt(serviceStat.extrinsicCount),
  )
  if (error6) return safeError(error6)
  parts.push(extrinsicCountData)

  // 5. xtsize: N
  const [error7, extrinsicSizeData] = encodeNatural(
    BigInt(serviceStat.extrinsicSize),
  )
  if (error7) return safeError(error7)
  parts.push(extrinsicSizeData)

  // 6. exportcount: N
  const [error8, exportCountData] = encodeNatural(
    BigInt(serviceStat.exportCount),
  )
  if (error8) return safeError(error8)
  parts.push(exportCountData)

  // 7. accumulation: tuple{N, gas}
  // encode{tuple{N, gas}} ≡ encode{N} ∥ encode{gas}
  // Gray Paper: accumulation = ifnone{accumulationstatistics[s], tuple{0, 0}}
  // If accumulation is not set, use tuple{0, 0}
  const accumulation = serviceStat.accumulation || [0, 0]
  const [error9, accumulationData1] = encodeNatural(
    BigInt(accumulation[0]), // count
  )
  if (error9) return safeError(error9)
  parts.push(accumulationData1)
  const [error10, accumulationData2] = encodeNatural(BigInt(accumulation[1])) // gas
  if (error10) return safeError(error10)
  parts.push(accumulationData2)

  return safeResult(concatBytes(parts))
}

/**
 * Decode service statistics according to Gray Paper
 *
 * *** DO NOT REMOVE - GRAY PAPER FORMULA ***
 * Gray Paper Section: statistics.tex lines 91-101
 * Formula:
 *
 * servicestats ∈ dictionary{serviceid}{tuple{
 *   provision: tuple{N, N},
 *   refinement: tuple{N, gas},
 *   importcount: N,
 *   xtcount: N,
 *   xtsize: N,
 *   exportcount: N,
 *   accumulation: tuple{N, gas}
 * }}
 *
 * According to Gray Paper serialization.tex line 20:
 * encode{tuple{a, b, ...}} ≡ encode{a} ∥ encode{b} ∥ ...
 *
 * Decoding order:
 * 1. provision: decode(N) ∥ decode(N) - tuple{N, N}
 * 2. refinement: decode(N) ∥ decode(gas) - tuple{N, gas}
 * 3. importcount: decode(N)
 * 4. xtcount: decode(N)
 * 5. xtsize: decode(N)
 * 6. exportcount: decode(N)
 * 7. accumulation: decode(N) ∥ decode(gas) - tuple{N, gas}
 *
 * Note: gas is decoded as a natural number (N)
 * Note: TypeScript ServiceStats interface uses tuples to match Gray Paper
 *       provision: [count, size] - tuple{N, N}
 *       refinement: [count, gas] - tuple{N, gas}
 *       accumulation: [count, gas] - tuple{N, gas}
 */
function decodeServiceStats(
  data: Uint8Array,
): Safe<DecodingResult<ServiceStats>> {
  let currentData = data

  // Gray Paper statistics.tex line 91-101: servicestats tuple order (type definition)
  // According to serialization.tex line 20: decode{tuple{a, b, ...}} ≡ decode{a} ∥ decode{b} ∥ ...
  // The order in the tuple matches the type definition in statistics.tex line 91-101:
  // 1. provision: tuple{N, N}
  // 2. refinement: tuple{N, gas}
  // 3. importcount: N
  // 4. xtcount: N
  // 5. xtsize: N
  // 6. exportcount: N
  // 7. accumulation: tuple{N, gas}

  // 1. provision: tuple{N, N}
  // decode{tuple{N, N}} ≡ decode{N} ∥ decode{N}
  const [error1, provisionResult1] = decodeNatural(currentData)
  if (error1) return safeError(error1)
  currentData = provisionResult1.remaining
  const [error2, provisionResult2] = decodeNatural(currentData)
  if (error2) return safeError(error2)
  currentData = provisionResult2.remaining

  // 2. refinement: tuple{N, gas}
  // decode{tuple{N, gas}} ≡ decode{N} ∥ decode{gas}
  const [error3, refinementResult1] = decodeNatural(currentData)
  if (error3) return safeError(error3)
  currentData = refinementResult1.remaining
  const [error4, refinementResult2] = decodeNatural(currentData)
  if (error4) return safeError(error4)
  currentData = refinementResult2.remaining

  // 3. importcount: N
  const [error5, importCountResult] = decodeNatural(currentData)
  if (error5) return safeError(error5)
  currentData = importCountResult.remaining

  // 4. xtcount: N
  const [error6, extrinsicCountResult] = decodeNatural(currentData)
  if (error6) return safeError(error6)
  currentData = extrinsicCountResult.remaining

  // 5. xtsize: N
  const [error7, extrinsicSizeResult] = decodeNatural(currentData)
  if (error7) return safeError(error7)
  currentData = extrinsicSizeResult.remaining

  // 6. exportcount: N
  const [error8, exportCountResult] = decodeNatural(currentData)
  if (error8) return safeError(error8)
  currentData = exportCountResult.remaining

  // 7. accumulation: tuple{N, gas}
  // decode{tuple{N, gas}} ≡ decode{N} ∥ decode{gas}
  const [error9, accumulationResult1] = decodeNatural(currentData)
  if (error9) return safeError(error9)
  currentData = accumulationResult1.remaining
  const [error10, accumulationResult2] = decodeNatural(currentData)
  if (error10) return safeError(error10)
  currentData = accumulationResult2.remaining

  const serviceStat: ServiceStats = {
    provision: [Number(provisionResult1.value), Number(provisionResult2.value)], // tuple{N, N} - [count, size]
    refinement: [
      Number(refinementResult1.value),
      Number(refinementResult2.value),
    ], // tuple{N, gas} - [count, gas]
    importCount: Number(importCountResult.value),
    extrinsicCount: Number(extrinsicCountResult.value),
    extrinsicSize: Number(extrinsicSizeResult.value),
    exportCount: Number(exportCountResult.value),
    accumulation: [
      Number(accumulationResult1.value),
      Number(accumulationResult2.value),
    ], // tuple{N, gas} - [count, gas]
  }

  return safeResult({
    value: serviceStat,
    remaining: currentData,
    consumed: data.length - currentData.length,
  })
}

/**
 * Encode activity according to Gray Paper equation 11:
 * activity ≡ ⟨valstatsaccumulator, valstatsprevious, corestats, servicestats⟩
 *
 * Gray Paper: C(13) ↦ encode{encode[4]{valstatsaccumulator, valstatsprevious}, corestats, servicestats}
 * Gray Paper: tuple{valstatsaccumulator, valstatsprevious} ∈ sequence[Cvalcount]{tuple{...}}^2
 *
 * This means valstatsaccumulator and valstatsprevious are FIXED-LENGTH sequences of Cvalcount elements
 * (no length prefix), not variable-length sequences.
 */
export function encodeActivity(
  activity: Activity,
  configService: IConfigService,
): Safe<Uint8Array> {
  const parts: Uint8Array[] = []

  // Gray Paper: encode[4]{valstatsaccumulator, valstatsprevious}
  // According to Gray Paper statistics.tex line 12:
  // tuple{valstatsaccumulator, valstatsprevious} ∈ sequence[Cvalcount]{tuple{...}}^2
  // This means we have 2 fixed-length sequences, each of Cvalcount validator stats
  // The encode[4]{...} notation is ambiguous, but test vectors show no length prefix is used
  const validatorCount = configService.numValidators

  // valstatsaccumulator: fixed-length sequence of Cvalcount validator statistics
  // Gray Paper: sequence[Cvalcount]{tuple{...}} - fixed-length sequence
  const paddedAccumulator = Array.from(activity.validatorStatsAccumulator)
  // Pad to Cvalcount if needed
  while (paddedAccumulator.length < validatorCount) {
    paddedAccumulator.push({
      blocks: 0,
      tickets: 0,
      preimageCount: 0,
      preimageSize: 0,
      guarantees: 0,
      assurances: 0,
    })
  }
  // Truncate to Cvalcount if needed
  const accumulatorToEncode = paddedAccumulator.slice(0, validatorCount)
  const [error1, validatorStatsAccumulatorData] = encodeSequenceGeneric(
    accumulatorToEncode,
    encodeValidatorStats,
  )
  if (error1) return safeError(error1)

  // valstatsprevious: fixed-length sequence of Cvalcount validator statistics
  // Gray Paper: sequence[Cvalcount]{tuple{...}} - fixed-length sequence
  const paddedPrevious = Array.from(activity.validatorStatsPrevious)
  // Pad to Cvalcount if needed
  while (paddedPrevious.length < validatorCount) {
    paddedPrevious.push({
      blocks: 0,
      tickets: 0,
      preimageCount: 0,
      preimageSize: 0,
      guarantees: 0,
      assurances: 0,
    })
  }
  // Truncate to Cvalcount if needed
  const previousToEncode = paddedPrevious.slice(0, validatorCount)
  const [error2, validatorStatsPreviousData] = encodeSequenceGeneric(
    previousToEncode,
    encodeValidatorStats,
  )
  if (error2) return safeError(error2)

  // Gray Paper: encode[4]{valstatsaccumulator, valstatsprevious}
  // According to Gray Paper merklization.tex line 64-65:
  // C(13) ↦ encode{encode[4]{valstatsaccumulator, valstatsprevious}, corestats, servicestats}
  // According to serialization.tex line 114:
  // encode[l]{tuple{a, b, ...}} ≡ encode[l]{a} ∥ encode[l]{b} ∥ ...
  // This means encode[4]{valstatsaccumulator, valstatsprevious} means each field
  // in the validator stats tuples should be encoded as encode[4] (4-byte fixed-length)
  // The sequences are fixed-length (Cvalcount elements each), encoded directly without a length prefix
  parts.push(validatorStatsAccumulatorData)
  parts.push(validatorStatsPreviousData)

  // corestats: fixed-length sequence of Ccorecount core statistics
  // Gray Paper: sequence[Ccorecount]{tuple{...}} - fixed-length sequence, no length prefix
  const coreCount = configService.numCores
  const paddedCoreStats = Array.from(activity.coreStats)
  // Pad to Ccorecount if needed
  while (paddedCoreStats.length < coreCount) {
    paddedCoreStats.push({
      daLoad: 0,
      popularity: 0,
      importCount: 0,
      extrinsicCount: 0,
      extrinsicSize: 0,
      exportCount: 0,
      bundleLength: 0,
      gasUsed: 0,
    })
  }
  // Truncate to Ccorecount if needed
  const coreStatsToEncode = paddedCoreStats.slice(0, coreCount)
  const [error4, coreStatsData] = encodeSequenceGeneric(
    coreStatsToEncode,
    encodeCoreStats,
  )
  if (error4) return safeError(error4)
  parts.push(coreStatsData)

  // servicestats: variable-length sequence of (serviceId, serviceStats) tuples
  // Gray Paper: servicestats ∈ dictionary{serviceid}{tuple{...}}
  // Gray Paper serialization.tex line 79-90: dictionary encoding
  // encode{d ∈ dictionary{K}{V}} ≡ encode{var{sequence{build{tuple{encode{k}, encode{d[k]}}}{k ∈ keys{d}} ordered by k}}}
  // This means: variable-length sequence of (key, value) tuples, ordered by key
  // Note: Gray Paper does NOT specify omitting zero values - encode all keys in the dictionary
  const serviceStatsTuples: Array<{ serviceId: bigint; stats: ServiceStats }> =
    []
  for (const [serviceId, serviceStat] of activity.serviceStats) {
    serviceStatsTuples.push({ serviceId, stats: serviceStat })
  }

  // Gray Paper: ordered by k - sort by service ID before encoding
  serviceStatsTuples.sort((a, b) => {
    if (a.serviceId < b.serviceId) return -1
    if (a.serviceId > b.serviceId) return 1
    return 0
  })

  const [error5, serviceStatsData] = encodeVariableSequence(
    serviceStatsTuples,
    (tuple) => {
      const tupleParts: Uint8Array[] = []

      // Encode service ID
      // Gray Paper merklization.tex line 84: encode[4]{s} - service ID uses 4-byte fixed-length
      // Gray Paper merklization.tex line 116: all non-discriminator numeric serialization in state is done in fixed-length
      const [error6, serviceIdData] = encodeFixedLength(tuple.serviceId, 4n)
      if (error6) return safeError(error6)
      tupleParts.push(serviceIdData)

      // Encode service stats
      const [error7, serviceStatsData] = encodeServiceStats(tuple.stats)
      if (error7) return safeError(error7)
      tupleParts.push(serviceStatsData)

      return safeResult(concatBytes(tupleParts))
    },
  )
  if (error5) return safeError(error5)
  parts.push(serviceStatsData)

  return safeResult(concatBytes(parts))
}

/**
 * Decode activity according to Gray Paper equation 11:
 * activity ≡ ⟨valstatsaccumulator, valstatsprevious, corestats, servicestats⟩
 *
 * Gray Paper: C(13) ↦ encode{encode[4]{valstatsaccumulator, valstatsprevious}, corestats, servicestats}
 * Gray Paper: tuple{valstatsaccumulator, valstatsprevious} ∈ sequence[Cvalcount]{tuple{...}}^2
 *
 * This means valstatsaccumulator and valstatsprevious are FIXED-LENGTH sequences of Cvalcount elements
 * (no length prefix), not variable-length sequences.
 */
export function decodeActivity(
  data: Uint8Array,
  configService: IConfigService,
): Safe<DecodingResult<Activity>> {
  let currentData = data

  // Gray Paper: encode[4]{valstatsaccumulator, valstatsprevious}
  // According to serialization.tex line 114:
  // encode[l]{tuple{a, b, ...}} ≡ encode[l]{a} ∥ encode[l]{b} ∥ ...
  // This means encode[4]{valstatsaccumulator, valstatsprevious} means each field
  // in the validator stats tuples should be decoded as decode[4] (4-byte fixed-length)
  // The sequences are fixed-length (Cvalcount elements each), decoded directly without a length prefix
  const validatorCount = configService.numValidators

  // Decode valstatsaccumulator: fixed-length sequence of Cvalcount validator statistics
  const [error1, validatorStatsAccumulatorResult] = decodeSequenceGeneric(
    currentData,
    decodeValidatorStats,
    validatorCount,
  )
  if (error1) return safeError(error1)
  currentData = validatorStatsAccumulatorResult.remaining

  // valstatsprevious: fixed-length sequence of Cvalcount validator statistics
  const [error2, validatorStatsPreviousResult] = decodeSequenceGeneric(
    currentData,
    decodeValidatorStats,
    validatorCount,
  )
  if (error2) return safeError(error2)
  currentData = validatorStatsPreviousResult.remaining

  // corestats: fixed-length sequence of Ccorecount core statistics
  // Gray Paper: sequence[Ccorecount]{tuple{...}} - fixed-length sequence, no length prefix
  const coreCount = configService.numCores
  const [error3, coreStatsResult] = decodeSequenceGeneric(
    currentData,
    decodeCoreStats,
    coreCount,
  )
  if (error3) return safeError(error3)
  currentData = coreStatsResult.remaining

  // servicestats: variable-length sequence of (serviceId, serviceStats) tuples
  type ServiceStatsTuple = { serviceId: bigint; stats: ServiceStats }
  const [error4, serviceStatsTuplesResult] =
    decodeVariableSequence<ServiceStatsTuple>(currentData, (data) => {
      let tupleData = data

      // Decode service ID
      // Gray Paper merklization.tex line 84: encode[4]{s} - service ID uses 4-byte fixed-length
      // Gray Paper merklization.tex line 116: all non-discriminator numeric serialization in state is done in fixed-length
      // Must match encodeActivity which uses encodeFixedLength(serviceId, 4n)
      const [error5, serviceIdResult] = decodeFixedLength(tupleData, 4n)
      if (error5) return safeError(error5)
      tupleData = serviceIdResult.remaining

      // Decode service stats
      const [error6, serviceStatsResult] = decodeServiceStats(tupleData)
      if (error6) return safeError(error6)
      tupleData = serviceStatsResult.remaining

      return safeResult({
        value: {
          serviceId: serviceIdResult.value,
          stats: serviceStatsResult.value,
        },
        remaining: tupleData,
        consumed: data.length - tupleData.length,
      })
    })
  if (error4) return safeError(error4)
  currentData = serviceStatsTuplesResult.remaining

  // Convert service stats tuples back to Map
  const serviceStats = new Map<bigint, ServiceStats>()
  for (const tuple of serviceStatsTuplesResult.value) {
    serviceStats.set(tuple.serviceId, tuple.stats)
  }

  const activity: Activity = {
    validatorStatsAccumulator: validatorStatsAccumulatorResult.value,
    validatorStatsPrevious: validatorStatsPreviousResult.value,
    coreStats: coreStatsResult.value,
    serviceStats,
  }

  return safeResult({
    value: activity,
    remaining: currentData,
    consumed: data.length - currentData.length,
  })
}
