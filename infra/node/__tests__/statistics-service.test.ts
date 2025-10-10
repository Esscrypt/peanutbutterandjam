/**
 * Statistics Service Tests
 * 
 * Tests the Gray Paper-compliant statistics tracking implementation
 */

import { describe, it, expect, beforeEach } from 'bun:test'
import { 
  StatisticsService, 
  createStatisticsService, 
  createInitialActivity
} from '../services/statistics-service'
import { EventBusService } from '@pbnj/core'
import type { BlockHeader, BlockBody } from '@pbnj/types'

describe('StatisticsService', () => {
  let statisticsService: StatisticsService
  let eventBusService: EventBusService
  const validatorCount = 6
  const coreCount = 4
  const epochLength = 1000n

  beforeEach(() => {
    eventBusService = new EventBusService()
    statisticsService = createStatisticsService(validatorCount, coreCount, eventBusService, epochLength)
    statisticsService.start()
  })

  describe('Initialization', () => {
    it('should create service with correct initial state', () => {
      const activity = statisticsService.getActivity()
      
      expect(activity.validatorStatsAccumulator).toHaveLength(validatorCount)
      expect(activity.validatorStatsPrevious).toHaveLength(validatorCount)
      expect(activity.coreStats).toHaveLength(coreCount)
      expect(activity.serviceStats.size).toBe(0)
      
      // Check all validator stats are initialized to zero
      activity.validatorStatsAccumulator.forEach(stats => {
        expect(stats.blocks).toBe(0n)
        expect(stats.tickets).toBe(0n)
        expect(stats.preimageCount).toBe(0n)
        expect(stats.preimageSize).toBe(0n)
        expect(stats.guarantees).toBe(0n)
        expect(stats.assurances).toBe(0n)
      })
    })

    it('should have correct epoch configuration', () => {
      expect(statisticsService.getCurrentEpoch()).toBe(0n)
      expect(statisticsService.getEpochLength()).toBe(epochLength)
    })
  })

  describe('Block Processing', () => {
    it('should update validator statistics for block author', async () => {
      const mockEvent = {
        timestamp: Date.now(),
        slot: 500n,
        epoch: 0n,
        authorIndex: 1,
        header: createMockHeader(500n, 1),
        body: createMockBody(),
      }

      await eventBusService.emitBlockProcessed(mockEvent)
      
      const authorStats = statisticsService.getValidatorStats(1)
      expect(authorStats).not.toBeNull()
      expect(authorStats!.blocks).toBe(1n) // Should increment block count
    })

    it('should handle epoch transition correctly', async () => {
      // Process block in epoch 0
      const event1 = {
        timestamp: Date.now(),
        slot: 500n,
        epoch: 0n,
        authorIndex: 0,
        header: createMockHeader(500n, 0),
        body: createMockBody(),
      }
      await eventBusService.emitBlockProcessed(event1)

      // Process block in epoch 1 (should trigger transition)
      const event2 = {
        timestamp: Date.now(),
        slot: 1500n,
        epoch: 1n,
        authorIndex: 1,
        header: createMockHeader(1500n, 1),
        body: createMockBody(),
      }

      await eventBusService.emitBlockProcessed(event2)
      
      expect(statisticsService.getCurrentEpoch()).toBe(1n)
      
      // Previous epoch stats should have the block from epoch 0
      const previousStats = statisticsService.getValidatorStats(0, true)
      expect(previousStats!.blocks).toBe(1n)
      
      // Current accumulator should be reset
      const currentStats = statisticsService.getValidatorStats(1)
      expect(currentStats!.blocks).toBe(1n) // New block in new epoch
    })
  })

  describe('Epoch Transition', () => {
    it('should rollover accumulator to previous on epoch transition', async () => {
      // Add some statistics
      const event = {
        timestamp: Date.now(),
        slot: 500n,
        epoch: 0n,
        authorIndex: 0,
        header: createMockHeader(500n, 0),
        body: createMockBody(),
      }
      await eventBusService.emitBlockProcessed(event)

      // Trigger epoch transition
      const epochEvent = {
        timestamp: Date.now(),
        slot: 1000n,
        epoch: 1n,
        phase: 0n,
        previousEpoch: 0n,
        newEpoch: 1n,
        previousSlotPhase: 0n,
        validatorSetChanged: false,
      }
      await eventBusService.emitEpochTransition(epochEvent)

      // Check rollover
      const previousStats = statisticsService.getValidatorStats(0, true)
      const currentStats = statisticsService.getValidatorStats(0, false)
      
      expect(previousStats!.blocks).toBe(1n) // Previous epoch had 1 block
      expect(currentStats!.blocks).toBe(0n) // New epoch accumulator reset
    })
  })

  describe('Getters', () => {
    beforeEach(async () => {
      // Add some test data
      const event = {
        timestamp: Date.now(),
        slot: 500n,
        epoch: 0n,
        authorIndex: 1,
        header: createMockHeader(500n, 1),
        body: createMockBody(),
      }
      await eventBusService.emitBlockProcessed(event)
    })

    it('should return activity state', () => {
      const activity = statisticsService.getActivity()
      expect(activity).toBeDefined()
      expect(activity.validatorStatsAccumulator).toHaveLength(validatorCount)
    })

    it('should return validator statistics', () => {
      const accumulator = statisticsService.getValidatorStatsAccumulator()
      const previous = statisticsService.getValidatorStatsPrevious()
      
      expect(accumulator).toHaveLength(validatorCount)
      expect(previous).toHaveLength(validatorCount)
    })

    it('should return specific validator stats', () => {
      const stats = statisticsService.getValidatorStats(1)
      expect(stats).not.toBeNull()
      expect(stats!.blocks).toBe(1n)
    })

    it('should return null for invalid validator index', () => {
      const stats = statisticsService.getValidatorStats(999)
      expect(stats).toBeNull()
    })

    it('should return core statistics', () => {
      const coreStats = statisticsService.getCoreStats()
      expect(coreStats).toHaveLength(coreCount)
    })

    it('should return service statistics', () => {
      const serviceStats = statisticsService.getServiceStats()
      expect(serviceStats).toBeInstanceOf(Map)
    })
  })

  describe('Work Report Processing', () => {
    it('should handle work report processing events', async () => {
      const event = {
        timestamp: Date.now(),
        slot: 500n,
        epoch: 0n,
        availableReports: [],
        incomingReports: [],
      }

      // Should not throw
      await expect(eventBusService.emitWorkReportProcessed(event)).resolves.not.toThrow()
    })
  })

  describe('Factory Functions', () => {
    it('should create initial activity correctly', () => {
      const activity = createInitialActivity(3, 2)
      
      expect(activity.validatorStatsAccumulator).toHaveLength(3)
      expect(activity.validatorStatsPrevious).toHaveLength(3)
      expect(activity.coreStats).toHaveLength(2)
      expect(activity.serviceStats.size).toBe(0)
    })

    it('should create statistics service correctly', () => {
      const service = createStatisticsService(5, 3, eventBusService, 2000n)
      
      expect(service.getCurrentEpoch()).toBe(0n)
      expect(service.getEpochLength()).toBe(2000n)
      expect(service.getActivity().validatorStatsAccumulator).toHaveLength(5)
      expect(service.getActivity().coreStats).toHaveLength(3)
    })
  })
})

// ============================================================================
// Test Helpers
// ============================================================================

function createMockHeader(timeSlot: bigint, authorIndex: number): BlockHeader {
  return {
    parent: '0x0000000000000000000000000000000000000000000000000000000000000000',
    priorStateRoot: '0x0000000000000000000000000000000000000000000000000000000000000000',
    extrinsicHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
    timeslot: timeSlot,
    epochMark: null,
    winnersMark: null,
    authorIndex,
    entropySource: '0x0000000000000000000000000000000000000000000000000000000000000000',
    offendersMark: [],
    sealSig: '0x0000000000000000000000000000000000000000000000000000000000000000'
  }
}

function createMockBody(): BlockBody {
  return {
    extrinsics: []
  }
}
