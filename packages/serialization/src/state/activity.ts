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
 * - Service stats contain: provision, refinement, accumulation, transfer, importCount, exportCount
 *
 * ✅ CORRECT: Encodes activity statistics with proper Gray Paper structure
 * ✅ CORRECT: Uses sequences instead of lengths for validator stats
 * ✅ CORRECT: Properly encodes all fields of each statistic type
 */

import { concatBytes, type Safe, safeError, safeResult } from '@pbnj/core'
import type {
  Activity,
  CoreStats,
  DecodingResult,
  ServiceStats,
  ValidatorStats,
} from '@pbnj/types'
import { decodeNatural, encodeNatural } from '../core/natural-number'
import {
  decodeVariableSequence,
  encodeVariableSequence,
} from '../core/sequence'

/**
 * Encode validator statistics according to Gray Paper equation 12-20
 * Each validator stat contains: blocks, tickets, preimagecount, preimagesize, guarantees, assurances
 */
function encodeValidatorStats(validatorStat: ValidatorStats): Safe<Uint8Array> {
  const parts: Uint8Array[] = []

  // blocks: N
  const [error1, blocksData] = encodeNatural(BigInt(validatorStat.blocks))
  if (error1) return safeError(error1)
  parts.push(blocksData)

  // tickets: N
  const [error2, ticketsData] = encodeNatural(BigInt(validatorStat.tickets))
  if (error2) return safeError(error2)
  parts.push(ticketsData)

  // preimagecount: N
  const [error3, preimageCountData] = encodeNatural(
    BigInt(validatorStat.preimageCount),
  )
  if (error3) return safeError(error3)
  parts.push(preimageCountData)

  // preimagesize: N
  const [error4, preimageSizeData] = encodeNatural(
    BigInt(validatorStat.preimageSize),
  )
  if (error4) return safeError(error4)
  parts.push(preimageSizeData)

  // guarantees: N
  const [error5, guaranteesData] = encodeNatural(
    BigInt(validatorStat.guarantees),
  )
  if (error5) return safeError(error5)
  parts.push(guaranteesData)

  // assurances: N
  const [error6, assurancesData] = encodeNatural(
    BigInt(validatorStat.assurances),
  )
  if (error6) return safeError(error6)
  parts.push(assurancesData)

  return safeResult(concatBytes(parts))
}

/**
 * Decode validator statistics according to Gray Paper equation 12-20
 */
function decodeValidatorStats(
  data: Uint8Array,
): Safe<DecodingResult<ValidatorStats>> {
  let currentData = data

  // blocks: N
  const [error1, blocksResult] = decodeNatural(currentData)
  if (error1) return safeError(error1)
  currentData = blocksResult.remaining

  // tickets: N
  const [error2, ticketsResult] = decodeNatural(currentData)
  if (error2) return safeError(error2)
  currentData = ticketsResult.remaining

  // preimagecount: N
  const [error3, preimageCountResult] = decodeNatural(currentData)
  if (error3) return safeError(error3)
  currentData = preimageCountResult.remaining

  // preimagesize: N
  const [error4, preimageSizeResult] = decodeNatural(currentData)
  if (error4) return safeError(error4)
  currentData = preimageSizeResult.remaining

  // guarantees: N
  const [error5, guaranteesResult] = decodeNatural(currentData)
  if (error5) return safeError(error5)
  currentData = guaranteesResult.remaining

  // assurances: N
  const [error6, assurancesResult] = decodeNatural(currentData)
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
 */
function encodeServiceStats(serviceStat: ServiceStats): Safe<Uint8Array> {
  const parts: Uint8Array[] = []

  // provision: N
  const [error1, provisionData] = encodeNatural(BigInt(serviceStat.provision))
  if (error1) return safeError(error1)
  parts.push(provisionData)

  // refinement: N
  const [error2, refinementData] = encodeNatural(BigInt(serviceStat.refinement))
  if (error2) return safeError(error2)
  parts.push(refinementData)

  // accumulation: N
  const [error3, accumulationData] = encodeNatural(
    BigInt(serviceStat.accumulation),
  )
  if (error3) return safeError(error3)
  parts.push(accumulationData)

  // transfer: N
  const [error4, transferData] = encodeNatural(BigInt(serviceStat.transfer))
  if (error4) return safeError(error4)
  parts.push(transferData)

  // importCount: N
  const [error5, importCountData] = encodeNatural(
    BigInt(serviceStat.importCount),
  )
  if (error5) return safeError(error5)
  parts.push(importCountData)

  // extrinsicCount: N
  const [error6, extrinsicCountData] = encodeNatural(
    BigInt(serviceStat.extrinsicCount),
  )
  if (error6) return safeError(error6)
  parts.push(extrinsicCountData)

  // extrinsicSize: N
  const [error7, extrinsicSizeData] = encodeNatural(
    BigInt(serviceStat.extrinsicSize),
  )
  if (error7) return safeError(error7)
  parts.push(extrinsicSizeData)

  // exportCount: N
  const [error8, exportCountData] = encodeNatural(
    BigInt(serviceStat.exportCount),
  )
  if (error8) return safeError(error8)
  parts.push(exportCountData)

  return safeResult(concatBytes(parts))
}

/**
 * Decode service statistics according to Gray Paper
 */
function decodeServiceStats(
  data: Uint8Array,
): Safe<DecodingResult<ServiceStats>> {
  let currentData = data

  // provision: N
  const [error1, provisionResult] = decodeNatural(currentData)
  if (error1) return safeError(error1)
  currentData = provisionResult.remaining

  // refinement: N
  const [error2, refinementResult] = decodeNatural(currentData)
  if (error2) return safeError(error2)
  currentData = refinementResult.remaining

  // accumulation: N
  const [error3, accumulationResult] = decodeNatural(currentData)
  if (error3) return safeError(error3)
  currentData = accumulationResult.remaining

  // transfer: N
  const [error4, transferResult] = decodeNatural(currentData)
  if (error4) return safeError(error4)
  currentData = transferResult.remaining

  // importCount: N
  const [error5, importCountResult] = decodeNatural(currentData)
  if (error5) return safeError(error5)
  currentData = importCountResult.remaining

  // extrinsicCount: N
  const [error6, extrinsicCountResult] = decodeNatural(currentData)
  if (error6) return safeError(error6)
  currentData = extrinsicCountResult.remaining

  // extrinsicSize: N
  const [error7, extrinsicSizeResult] = decodeNatural(currentData)
  if (error7) return safeError(error7)
  currentData = extrinsicSizeResult.remaining

  // exportCount: N
  const [error8, exportCountResult] = decodeNatural(currentData)
  if (error8) return safeError(error8)
  currentData = exportCountResult.remaining

  const serviceStat: ServiceStats = {
    provision: Number(provisionResult.value),
    refinement: Number(refinementResult.value),
    accumulation: Number(accumulationResult.value),
    transfer: Number(transferResult.value),
    importCount: Number(importCountResult.value),
    extrinsicCount: Number(extrinsicCountResult.value),
    extrinsicSize: Number(extrinsicSizeResult.value),
    exportCount: Number(exportCountResult.value),
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
 */
export function encodeActivity(activity: Activity): Safe<Uint8Array> {
  const parts: Uint8Array[] = []

  // valstatsaccumulator: variable-length sequence of validator statistics
  const [error1, validatorStatsAccumulatorData] = encodeVariableSequence(
    activity.validatorStatsAccumulator,
    encodeValidatorStats,
  )
  if (error1) return safeError(error1)
  parts.push(validatorStatsAccumulatorData)

  // valstatsprevious: variable-length sequence of validator statistics
  const [error2, validatorStatsPreviousData] = encodeVariableSequence(
    activity.validatorStatsPrevious,
    encodeValidatorStats,
  )
  if (error2) return safeError(error2)
  parts.push(validatorStatsPreviousData)

  // corestats: variable-length sequence of core statistics
  const [error3, coreStatsData] = encodeVariableSequence(
    activity.coreStats,
    encodeCoreStats,
  )
  if (error3) return safeError(error3)
  parts.push(coreStatsData)

  // servicestats: variable-length sequence of (serviceId, serviceStats) tuples
  const serviceStatsTuples: Array<{ serviceId: bigint; stats: ServiceStats }> =
    []
  for (const [serviceId, serviceStat] of activity.serviceStats) {
    serviceStatsTuples.push({ serviceId, stats: serviceStat })
  }

  const [error4, serviceStatsData] = encodeVariableSequence(
    serviceStatsTuples,
    (tuple) => {
      const tupleParts: Uint8Array[] = []

      // Encode service ID
      const [error5, serviceIdData] = encodeNatural(tuple.serviceId)
      if (error5) return safeError(error5)
      tupleParts.push(serviceIdData)

      // Encode service stats
      const [error6, serviceStatsData] = encodeServiceStats(tuple.stats)
      if (error6) return safeError(error6)
      tupleParts.push(serviceStatsData)

      return safeResult(concatBytes(tupleParts))
    },
  )
  if (error4) return safeError(error4)
  parts.push(serviceStatsData)

  return safeResult(concatBytes(parts))
}

/**
 * Decode activity according to Gray Paper equation 11:
 * activity ≡ ⟨valstatsaccumulator, valstatsprevious, corestats, servicestats⟩
 */
export function decodeActivity(
  data: Uint8Array,
): Safe<DecodingResult<Activity>> {
  let currentData = data

  // valstatsaccumulator: variable-length sequence of validator statistics
  const [error1, validatorStatsAccumulatorResult] = decodeVariableSequence(
    currentData,
    decodeValidatorStats,
  )
  if (error1) return safeError(error1)
  currentData = validatorStatsAccumulatorResult.remaining

  // valstatsprevious: variable-length sequence of validator statistics
  const [error2, validatorStatsPreviousResult] = decodeVariableSequence(
    currentData,
    decodeValidatorStats,
  )
  if (error2) return safeError(error2)
  currentData = validatorStatsPreviousResult.remaining

  // corestats: variable-length sequence of core statistics
  const [error3, coreStatsResult] = decodeVariableSequence(
    currentData,
    decodeCoreStats,
  )
  if (error3) return safeError(error3)
  currentData = coreStatsResult.remaining

  // servicestats: variable-length sequence of (serviceId, serviceStats) tuples
  const [error4, serviceStatsTuplesResult] = decodeVariableSequence(
    currentData,
    (data) => {
      let tupleData = data

      // Decode service ID
      const [error5, serviceIdResult] = decodeNatural(tupleData)
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
    },
  )
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
