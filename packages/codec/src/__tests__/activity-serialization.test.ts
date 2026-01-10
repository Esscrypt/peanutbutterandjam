/**
 * Activity Serialization Tests
 *
 * Tests for Gray Paper compliant activity encoding/decoding
 */

import { describe, it, expect } from 'bun:test'
import type { Activity, ValidatorStats, CoreStats, ServiceStats } from '@pbnjam/types'
import { encodeActivity, decodeActivity } from '../state/activity'
import type { IConfigService } from '@pbnjam/types'

describe('Activity Serialization', () => {
  const configService: IConfigService = {
    numCores: 341,
    numValidators: 1023,
    epochDuration: 12,
    ticketsPerValidator: 1023,
    maxTicketsPerExtrinsic: 1023,
  } as IConfigService

  it('should encode and decode activity with empty sequences', () => {
    const activity: Activity = {
      validatorStatsAccumulator: [],
      validatorStatsPrevious: [],
      coreStats: [],
      serviceStats: new Map(),
    }

    const [encodeError, encoded] = encodeActivity(activity, configService)
    if (encodeError) {
      throw encodeError
    }

    const [decodeError, decoded] = decodeActivity(encoded, configService)
    if (decodeError) {
      throw decodeError
    }

    expect(decoded.value.validatorStatsAccumulator).toEqual([])
    expect(decoded.value.validatorStatsPrevious).toEqual([])
    expect(decoded.value.coreStats).toEqual([])
    expect(decoded.value.serviceStats.size).toBe(0)
  })

  it('should encode and decode activity with validator statistics', () => {
    const validatorStats: ValidatorStats = {
      blocks: 10,
      tickets: 5,
      preimageCount: 3,
      preimageSize: 1024,
      guarantees: 2,
      assurances: 1,
    }

    const activity: Activity = {
      validatorStatsAccumulator: [validatorStats],
      validatorStatsPrevious: [validatorStats],
      coreStats: [],
      serviceStats: new Map(),
    }

    const [encodeError, encoded] = encodeActivity(activity, configService)
    if (encodeError) {
      throw encodeError
    }

    const [decodeError, decoded] = decodeActivity(encoded, configService)
    if (decodeError) {
      throw decodeError
    }

    expect(decoded.value.validatorStatsAccumulator).toHaveLength(1)
    expect(decoded.value.validatorStatsAccumulator[0]).toEqual(validatorStats)
    expect(decoded.value.validatorStatsPrevious).toHaveLength(1)
    expect(decoded.value.validatorStatsPrevious[0]).toEqual(validatorStats)
  })

  it('should encode and decode activity with core statistics', () => {
    const coreStats: CoreStats = {
      daLoad: 100,
      popularity: 50,
      importCount: 25,
      extrinsicCount: 10,
      extrinsicSize: 1024,
      exportCount: 5,
      bundleLength: 512,
      gasUsed: 2000,
    }

    const activity: Activity = {
      validatorStatsAccumulator: [],
      validatorStatsPrevious: [],
      coreStats: [coreStats],
      serviceStats: new Map(),
    }

    const [encodeError, encoded] = encodeActivity(activity, configService)
    if (encodeError) {
      throw encodeError
    }

    const [decodeError, decoded] = decodeActivity(encoded, configService)
    if (decodeError) {
      throw decodeError
    }

    expect(decoded.value.coreStats).toHaveLength(1)
    expect(decoded.value.coreStats[0]).toEqual(coreStats)
  })

  it('should encode and decode activity with service statistics', () => {
    const serviceStats: ServiceStats = {
      provision: [100, 0],
      refinement: [50, 0],
      accumulation: [25, 0],
      importCount: 5,
      extrinsicCount: 3,
      extrinsicSize: 512,
      exportCount: 2,
    }

    const activity: Activity = {
      validatorStatsAccumulator: [],
      validatorStatsPrevious: [],
      coreStats: [],
      serviceStats: new Map([[1n, serviceStats]]),
    }

    const [encodeError, encoded] = encodeActivity(activity, configService)
    if (encodeError) {
      throw encodeError
    }

    const [decodeError, decoded] = decodeActivity(encoded, configService)
    if (decodeError) {
      throw decodeError
    }

    expect(decoded.value.serviceStats.size).toBe(1)
    expect(decoded.value.serviceStats.get(1n)).toEqual(serviceStats)
  })

  it('should encode and decode complete activity with all components', () => {
    const validatorStats: ValidatorStats = {
      blocks: 10,
      tickets: 5,
      preimageCount: 3,
      preimageSize: 1024,
      guarantees: 2,
      assurances: 1,
    }

    const coreStats: CoreStats = {
      daLoad: 100,
      popularity: 50,
      importCount: 25,
      extrinsicCount: 10,
      extrinsicSize: 1024,
      exportCount: 5,
      bundleLength: 512,
      gasUsed: 2000,
    }

    const serviceStats: ServiceStats = {
      provision: [100, 0],
      refinement: [50, 0],
      accumulation: [25, 0],
      importCount: 5,
      extrinsicCount: 3,
      extrinsicSize: 512,
      exportCount: 2,
    }

    const activity: Activity = {
      validatorStatsAccumulator: [validatorStats],
      validatorStatsPrevious: [validatorStats],
      coreStats: [coreStats],
      serviceStats: new Map([[1n, serviceStats], [2n, serviceStats]]),
    }

    const [encodeError, encoded] = encodeActivity(activity, configService)
    if (encodeError) {
      throw encodeError
    }

    const [decodeError, decoded] = decodeActivity(encoded, configService)
    if (decodeError) {
      throw decodeError
    }

    // Verify all components
    expect(decoded.value.validatorStatsAccumulator).toHaveLength(1)
    expect(decoded.value.validatorStatsPrevious).toHaveLength(1)
    expect(decoded.value.coreStats).toHaveLength(1)
    expect(decoded.value.serviceStats.size).toBe(2)

    // Verify data integrity
    expect(decoded.value.validatorStatsAccumulator[0]).toEqual(validatorStats)
    expect(decoded.value.validatorStatsPrevious[0]).toEqual(validatorStats)
    expect(decoded.value.coreStats[0]).toEqual(coreStats)
    expect(decoded.value.serviceStats.get(1n)).toEqual(serviceStats)
    expect(decoded.value.serviceStats.get(2n)).toEqual(serviceStats)
  })

  it('should handle round-trip encoding with multiple elements', () => {
    const validatorStats1: ValidatorStats = {
      blocks: 10,
      tickets: 5,
      preimageCount: 3,
      preimageSize: 1024,
      guarantees: 2,
      assurances: 1,
    }

    const validatorStats2: ValidatorStats = {
      blocks: 20,
      tickets: 10,
      preimageCount: 6,
      preimageSize: 2048,
      guarantees: 4,
      assurances: 2,
    }

    const coreStats1: CoreStats = {
      daLoad: 100,
      popularity: 50,
      importCount: 25,
      extrinsicCount: 10,
      extrinsicSize: 1024,
      exportCount: 5,
      bundleLength: 512,
      gasUsed: 2000,
    }

    const coreStats2: CoreStats = {
      daLoad: 200,
      popularity: 100,
      importCount: 50,
      extrinsicCount: 20,
      extrinsicSize: 2048,
      exportCount: 10,
      bundleLength: 1024,
      gasUsed: 4000,
    }

    const activity: Activity = {
      validatorStatsAccumulator: [validatorStats1, validatorStats2],
      validatorStatsPrevious: [validatorStats1],
      coreStats: [coreStats1, coreStats2],
      serviceStats: new Map([
        [1n, { provision: [100, 0], refinement: [50, 0], accumulation: [25, 0], importCount: 5, extrinsicCount: 3, extrinsicSize: 512, exportCount: 2 }],
        [2n, { provision: [200, 0], refinement: [100, 0], accumulation: [50, 0], importCount: 10, extrinsicCount: 6, extrinsicSize: 1024, exportCount: 4 }],
      ]),
    }

    const [encodeError, encoded] = encodeActivity(activity, configService)
    if (encodeError) {
      throw encodeError
    }

    const [decodeError, decoded] = decodeActivity(encoded, configService)
    if (decodeError) {
      throw decodeError
    }

    // Verify counts
    expect(decoded.value.validatorStatsAccumulator).toHaveLength(2)
    expect(decoded.value.validatorStatsPrevious).toHaveLength(1)
    expect(decoded.value.coreStats).toHaveLength(2)
    expect(decoded.value.serviceStats.size).toBe(2)

    // Verify first elements match
    expect(decoded.value.validatorStatsAccumulator[0]).toEqual(validatorStats1)
    expect(decoded.value.validatorStatsAccumulator[1]).toEqual(validatorStats2)
    expect(decoded.value.validatorStatsPrevious[0]).toEqual(validatorStats1)
    expect(decoded.value.coreStats[0]).toEqual(coreStats1)
    expect(decoded.value.coreStats[1]).toEqual(coreStats2)
  })
})
