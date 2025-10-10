/**
 * Recent History Service Tests
 * 
 * Tests the Gray Paper-compliant recent history management implementation
 */

import { describe, it, expect, beforeEach, vi } from 'bun:test'
import { 
  RecentHistoryService, 
  createRecentHistoryService,
  createStrictRecentHistoryService,
  createMinimalRecentHistoryService,
  type RecentHistoryConfig
} from '../services/recent-history-service'
import { EventBusService } from '@pbnj/core'
import type { BlockHeader, BlockBody } from '@pbnj/types'

describe('RecentHistoryService', () => {
  let recentHistoryService: RecentHistoryService
  let eventBusService: EventBusService
  let emittedEvents: any[] = []

  beforeEach(() => {
    eventBusService = new EventBusService()
    emittedEvents = []

    // Mock event emission to capture events
    vi.spyOn(eventBusService, 'emitBlockProcessed').mockImplementation(async (event) => {
      emittedEvents.push(event)
    })

    recentHistoryService = createRecentHistoryService(eventBusService)
    recentHistoryService.start()
  })

  describe('Initialization', () => {
    it('should create service with correct initial state', () => {
      const stats = recentHistoryService.getStats()
      
      expect(stats.historyLength).toBe(0)
      expect(stats.maxHistoryLength).toBe(8) // Crecenthistorylen = 8
      expect(stats.currentBlockNumber).toBe('0')
      expect(stats.persistenceEnabled).toBe(true)
    })

    it('should have correct default configuration', () => {
      const stats = recentHistoryService.getStats()
      
      expect(stats.maxHistoryLength).toBe(8)
      expect(stats.persistenceEnabled).toBe(true)
    })
  })

  describe('Block Processing', () => {
    it('should add block to recent history', async () => {
      const mockEvent = {
        timestamp: Date.now(),
        slot: 1000n,
        epoch: 1n,
        authorIndex: 1,
        header: createMockHeader(1000n, 1),
        body: createMockBody(),
      }

      await eventBusService.emitBlockProcessed(mockEvent)
      
      const history = recentHistoryService.getRecentHistory()
      expect(history).toHaveLength(1)
      
      const entry = history[0]
      expect(entry.headerHash).toBeDefined()
      expect(entry.stateRoot).toBeDefined()
      expect(entry.accoutLogSuperPeak).toBeDefined()
      expect(entry.reportedPackageHashes).toBeInstanceOf(Map)
    })

    it('should maintain circular buffer size', async () => {
      // Add 10 blocks (more than maxHistoryLength of 8)
      for (let i = 0; i < 10; i++) {
        const mockEvent = {
          timestamp: Date.now(),
          slot: BigInt(1000 + i),
          epoch: 1n,
          authorIndex: i % 6, // Cycle through validators
          header: createMockHeader(BigInt(1000 + i), i % 6),
          body: createMockBody(),
        }
        await eventBusService.emitBlockProcessed(mockEvent)
      }

      const history = recentHistoryService.getRecentHistory()
      expect(history).toHaveLength(8) // Should maintain maxHistoryLength
      
      // Should contain the most recent 8 blocks (blocks 2-9)
      expect(history[0].headerHash).toContain('1002') // Block 2
      expect(history[7].headerHash).toContain('1009') // Block 9
    })

    it('should increment block counter', async () => {
      const mockEvent = {
        timestamp: Date.now(),
        slot: 1000n,
        epoch: 1n,
        authorIndex: 1,
        header: createMockHeader(1000n, 1),
        body: createMockBody(),
      }

      await eventBusService.emitBlockProcessed(mockEvent)
      
      const stats = recentHistoryService.getStats()
      expect(stats.currentBlockNumber).toBe('1')
    })
  })

  describe('Anchor Validation', () => {
    beforeEach(async () => {
      // Add some blocks to history
      for (let i = 0; i < 3; i++) {
        const mockEvent = {
          timestamp: Date.now(),
          slot: BigInt(1000 + i),
          epoch: 1n,
          authorIndex: i,
          header: createMockHeader(BigInt(1000 + i), i),
          body: createMockBody(),
        }
        await eventBusService.emitBlockProcessed(mockEvent)
      }
    })

    it('should validate existing anchor blocks', () => {
      const history = recentHistoryService.getRecentHistory()
      const firstBlockHash = history[0].headerHash
      
      expect(recentHistoryService.isValidAnchor(firstBlockHash)).toBe(true)
    })

    it('should reject non-existent anchor blocks', () => {
      const invalidHash = '0x9999999999999999999999999999999999999999999999999999999999999999'
      
      expect(recentHistoryService.isValidAnchor(invalidHash)).toBe(false)
    })

    it('should reject empty anchor hash', () => {
      expect(recentHistoryService.isValidAnchor('0x')).toBe(false)
    })
  })

  describe('Recent Interface', () => {
    it('should return empty recent when no history', () => {
      const recent = recentHistoryService.getRecent()
      
      expect(recent.history.headerHash).toBe('0x0000000000000000000000000000000000000000000000000000000000000000')
      expect(recent.history.stateRoot).toBe('0x0000000000000000000000000000000000000000000000000000000000000000')
      expect(recent.history.accoutLogSuperPeak).toBe('0x0000000000000000000000000000000000000000000000000000000000000000')
      expect(recent.history.reportedPackageHashes).toEqual([])
      expect(recent.accoutBelt.peaks).toEqual([])
    })

    it('should return latest entry when history exists', async () => {
      const mockEvent = {
        timestamp: Date.now(),
        slot: 1000n,
        epoch: 1n,
        authorIndex: 1,
        header: createMockHeader(1000n, 1),
        body: createMockBody(),
      }

      await eventBusService.emitBlockProcessed(mockEvent)
      
      const recent = recentHistoryService.getRecent()
      
      expect(recent.history.headerHash).toBeDefined()
      expect(recent.history.stateRoot).toBeDefined()
      expect(recent.history.accoutLogSuperPeak).toBeDefined()
      expect(recent.history.reportedPackageHashes).toBeInstanceOf(Array)
      expect(recent.accoutBelt.peaks).toBeInstanceOf(Array)
    })
  })

  describe('Configuration', () => {
    it('should update configuration', () => {
      recentHistoryService.updateConfig({
        maxHistoryLength: 5,
        enablePersistence: false,
      })

      const stats = recentHistoryService.getStats()
      expect(stats.maxHistoryLength).toBe(5)
      expect(stats.persistenceEnabled).toBe(false)
    })

    it('should work with strict configuration', () => {
      const strictService = createStrictRecentHistoryService(eventBusService)
      const stats = strictService.getStats()
      
      expect(stats.maxHistoryLength).toBe(8)
      expect(stats.persistenceEnabled).toBe(true)
    })

    it('should work with minimal configuration', () => {
      const minimalService = createMinimalRecentHistoryService(eventBusService)
      const stats = minimalService.getStats()
      
      expect(stats.maxHistoryLength).toBe(8)
      expect(stats.persistenceEnabled).toBe(false)
    })
  })

  describe('History Management', () => {
    beforeEach(async () => {
      // Add some blocks to history
      for (let i = 0; i < 3; i++) {
        const mockEvent = {
          timestamp: Date.now(),
          slot: BigInt(1000 + i),
          epoch: 1n,
          authorIndex: i,
          header: createMockHeader(BigInt(1000 + i), i),
          body: createMockBody(),
        }
        await eventBusService.emitBlockProcessed(mockEvent)
      }
    })

    it('should get recent history for specific block', () => {
      const history = recentHistoryService.getRecentHistory()
      const firstBlockHash = history[0].headerHash
      
      const entry = recentHistoryService.getRecentHistoryForBlock(firstBlockHash)
      expect(entry).not.toBeNull()
      expect(entry!.headerHash).toBe(firstBlockHash)
    })

    it('should return null for non-existent block', () => {
      const invalidHash = '0x9999999999999999999999999999999999999999999999999999999999999999'
      
      const entry = recentHistoryService.getRecentHistoryForBlock(invalidHash)
      expect(entry).toBeNull()
    })

    it('should clear history', () => {
      recentHistoryService.clearHistory()
      
      const stats = recentHistoryService.getStats()
      expect(stats.historyLength).toBe(0)
      expect(stats.currentBlockNumber).toBe('0')
    })

    it('should return copy of history to prevent mutation', () => {
      const history1 = recentHistoryService.getRecentHistory()
      const history2 = recentHistoryService.getRecentHistory()
      
      expect(history1).not.toBe(history2) // Different objects
      expect(history1).toEqual(history2) // Same content
    })
  })

  describe('Statistics', () => {
    it('should track correct statistics', async () => {
      // Add some blocks
      for (let i = 0; i < 3; i++) {
        const mockEvent = {
          timestamp: Date.now(),
          slot: BigInt(1000 + i),
          epoch: 1n,
          authorIndex: i,
          header: createMockHeader(BigInt(1000 + i), i),
          body: createMockBody(),
        }
        await eventBusService.emitBlockProcessed(mockEvent)
      }

      const stats = recentHistoryService.getStats()
      
      expect(stats.historyLength).toBe(3)
      expect(stats.maxHistoryLength).toBe(8)
      expect(stats.currentBlockNumber).toBe('3')
      expect(stats.persistenceEnabled).toBe(true)
    })
  })

  describe('Error Handling', () => {
    it('should handle empty block body gracefully', async () => {
      const mockEvent = {
        timestamp: Date.now(),
        slot: 1000n,
        epoch: 1n,
        authorIndex: 1,
        header: createMockHeader(1000n, 1),
        body: {}, // Empty body
      }

      // Should not throw
      await expect(eventBusService.emitBlockProcessed(mockEvent)).resolves.not.toThrow()
      
      const history = recentHistoryService.getRecentHistory()
      expect(history).toHaveLength(1)
    })

    it('should handle invalid header data gracefully', async () => {
      const mockEvent = {
        timestamp: Date.now(),
        slot: 1000n,
        epoch: 1n,
        authorIndex: 1,
        header: {
          parent: 'invalid',
          priorStateRoot: 'invalid',
          extrinsicHash: 'invalid',
          timeslot: 1000n,
          epochMark: null,
          winnersMark: null,
          authorIndex: 1,
          entropySource: 'invalid',
          offendersMark: [],
          sealSig: 'invalid'
        },
        body: createMockBody(),
      }

      // Should not throw
      await expect(eventBusService.emitBlockProcessed(mockEvent)).resolves.not.toThrow()
      
      const history = recentHistoryService.getRecentHistory()
      expect(history).toHaveLength(1)
    })
  })

  describe('Factory Functions', () => {
    it('should create service with default config', () => {
      const service = createRecentHistoryService(eventBusService)
      expect(service).toBeInstanceOf(RecentHistoryService)
    })

    it('should create strict service', () => {
      const service = createStrictRecentHistoryService(eventBusService)
      expect(service).toBeInstanceOf(RecentHistoryService)
    })

    it('should create minimal service', () => {
      const service = createMinimalRecentHistoryService(eventBusService)
      expect(service).toBeInstanceOf(RecentHistoryService)
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
