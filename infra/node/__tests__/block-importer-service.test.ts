/**
 * Block Importer Service Tests
 * 
 * Tests the block validation and BlockProcessedEvent emission functionality
 */

import { describe, it, expect, beforeEach, vi } from 'bun:test'
import { 
  BlockImporterService, 
  createBlockImporterService,
  createStrictBlockImporterService,
  createLenientBlockImporterService,
  type BlockImporterConfig
} from '../services/block-importer-service'
import { EventBusService } from '@pbnj/core'
import type { Block, BlockHeader, BlockBody, IClockService } from '@pbnj/types'

describe('BlockImporterService', () => {
  let blockImporter: BlockImporterService
  let eventBusService: EventBusService
  let mockClockService: IClockService
  let emittedEvents: any[] = []

  beforeEach(() => {
    eventBusService = new EventBusService()
    emittedEvents = []

    // Mock clock service
    mockClockService = {
      name: 'mock-clock-service',
      initialized: true,
      running: true,
      init: vi.fn().mockResolvedValue([null, true]),
      start: vi.fn().mockResolvedValue([null, true]),
      stop: vi.fn().mockResolvedValue([null, true]),
      getCurrentSlot: vi.fn().mockReturnValue(1000n),
      getCurrentEpoch: vi.fn().mockReturnValue(10n),
      getCurrentPhase: vi.fn().mockReturnValue(0n),
    }

    // Mock event emission to capture events
    vi.spyOn(eventBusService, 'emitBlockProcessed').mockImplementation(async (event) => {
      emittedEvents.push(event)
    })

    blockImporter = createBlockImporterService(eventBusService, mockClockService)
    blockImporter.start()
  })

  describe('Block Import Validation', () => {
    it('should accept blocks with current slot', async () => {
      const block = createMockBlock(1000n, 1)
      
      const result = await blockImporter.importBlock(block)
      
      expect(result.success).toBe(true)
      expect(result.timeslotValid).toBe(true)
      expect(result.currentSlot).toBe(1000n)
      expect(result.blockSlot).toBe(1000n)
      expect(emittedEvents).toHaveLength(1)
      expect(emittedEvents[0].slot).toBe(1000n)
      expect(emittedEvents[0].authorIndex).toBe(1)
    })

    it('should accept blocks with slot difference within limit', async () => {
      const block = createMockBlock(1001n, 2) // 1 slot ahead
      
      const result = await blockImporter.importBlock(block)
      
      expect(result.success).toBe(true)
      expect(result.timeslotValid).toBe(true)
    })

    it('should reject blocks with slot difference exceeding limit', async () => {
      const block = createMockBlock(1005n, 3) // 5 slots ahead, exceeds default limit of 1
      
      const result = await blockImporter.importBlock(block)
      
      expect(result.success).toBe(false)
      expect(result.timeslotValid).toBe(false)
      expect(result.error).toContain('Slot difference too large')
      expect(emittedEvents).toHaveLength(0)
    })

    it('should reject future slots when not allowed', async () => {
      const block = createMockBlock(1001n, 4) // 1 slot ahead
      
      const result = await blockImporter.importBlock(block)
      
      expect(result.success).toBe(false)
      expect(result.timeslotValid).toBe(false)
      expect(result.error).toContain('Future slots not allowed')
    })

    it('should accept past slots when allowed', async () => {
      const block = createMockBlock(999n, 5) // 1 slot behind
      
      const result = await blockImporter.importBlock(block)
      
      expect(result.success).toBe(true)
      expect(result.timeslotValid).toBe(true)
    })
  })

  describe('Configuration', () => {
    it('should work with strict configuration', async () => {
      const strictImporter = createStrictBlockImporterService(eventBusService, mockClockService)
      
      // Should reject future slots
      const futureBlock = createMockBlock(1001n, 1)
      const futureResult = await strictImporter.importBlock(futureBlock)
      expect(futureResult.success).toBe(false)
      
      // Should accept current slot
      const currentBlock = createMockBlock(1000n, 2)
      const currentResult = await strictImporter.importBlock(currentBlock)
      expect(currentResult.success).toBe(true)
    })

    it('should work with lenient configuration', async () => {
      const lenientImporter = createLenientBlockImporterService(eventBusService, mockClockService)
      
      // Should accept future slots
      const futureBlock = createMockBlock(1003n, 1) // 3 slots ahead
      const futureResult = await lenientImporter.importBlock(futureBlock)
      expect(futureResult.success).toBe(true)
      
      // Should accept larger slot differences
      const farFutureBlock = createMockBlock(1005n, 2) // 5 slots ahead
      const farFutureResult = await lenientImporter.importBlock(farFutureBlock)
      expect(farFutureResult.success).toBe(true)
    })

    it('should allow configuration updates', async () => {
      // Start with strict config
      blockImporter.updateConfig({
        maxSlotDifference: 1n,
        allowFutureSlots: false,
      })

      // Should reject future slot
      const futureBlock = createMockBlock(1001n, 1)
      const result1 = await blockImporter.importBlock(futureBlock)
      expect(result1.success).toBe(false)

      // Update to allow future slots
      blockImporter.updateConfig({
        allowFutureSlots: true,
      })

      // Should now accept future slot
      const result2 = await blockImporter.importBlock(futureBlock)
      expect(result2.success).toBe(true)
    })
  })

  describe('Event Emission', () => {
    it('should emit BlockProcessedEvent with correct data', async () => {
      const block = createMockBlock(1000n, 3)
      
      await blockImporter.importBlock(block)
      
      expect(emittedEvents).toHaveLength(1)
      const event = emittedEvents[0]
      
      expect(event.slot).toBe(1000n)
      expect(event.epoch).toBe(10n)
      expect(event.authorIndex).toBe(3)
      expect(event.header).toBe(block.header)
      expect(event.body).toBe(block.body)
      expect(typeof event.timestamp).toBe('number')
    })

    it('should not emit events for rejected blocks', async () => {
      const invalidBlock = createMockBlock(1005n, 1) // Invalid slot
      
      await blockImporter.importBlock(invalidBlock)
      
      expect(emittedEvents).toHaveLength(0)
    })
  })

  describe('Statistics', () => {
    it('should track import statistics correctly', async () => {
      // Import valid block
      const validBlock = createMockBlock(1000n, 1)
      await blockImporter.importBlock(validBlock)
      
      // Import invalid block
      const invalidBlock = createMockBlock(1005n, 2)
      await blockImporter.importBlock(invalidBlock)
      
      const stats = blockImporter.getImportStats()
      
      expect(stats.importedBlocks).toBe(1)
      expect(stats.rejectedBlocks).toBe(1)
      expect(stats.totalBlocks).toBe(2)
      expect(stats.successRate).toBe(50)
    })

    it('should reset statistics', async () => {
      // Import some blocks
      await blockImporter.importBlock(createMockBlock(1000n, 1))
      await blockImporter.importBlock(createMockBlock(1005n, 2))
      
      // Reset stats
      blockImporter.resetStats()
      
      const stats = blockImporter.getImportStats()
      expect(stats.importedBlocks).toBe(0)
      expect(stats.rejectedBlocks).toBe(0)
      expect(stats.totalBlocks).toBe(0)
      expect(stats.successRate).toBe(0)
    })
  })

  describe('Error Handling', () => {
    it('should handle clock service errors gracefully', async () => {
      // Mock clock service to throw error
      mockClockService.getCurrentSlot = vi.fn().mockImplementation(() => {
        throw new Error('Clock service error')
      })

      const block = createMockBlock(1000n, 1)
      
      // Should not throw, but handle error gracefully
      await expect(blockImporter.importBlock(block)).rejects.toThrow('Clock service error')
    })

    it('should handle event emission errors gracefully', async () => {
      // Mock event emission to throw error
      vi.spyOn(eventBusService, 'emitBlockProcessed').mockRejectedValue(new Error('Event emission error'))

      const block = createMockBlock(1000n, 1)
      
      // Should still return success even if event emission fails
      const result = await blockImporter.importBlock(block)
      expect(result.success).toBe(true)
    })
  })

  describe('Factory Functions', () => {
    it('should create service with default config', () => {
      const service = createBlockImporterService(eventBusService, mockClockService)
      expect(service).toBeInstanceOf(BlockImporterService)
    })

    it('should create strict service', () => {
      const service = createStrictBlockImporterService(eventBusService, mockClockService)
      expect(service).toBeInstanceOf(BlockImporterService)
    })

    it('should create lenient service', () => {
      const service = createLenientBlockImporterService(eventBusService, mockClockService)
      expect(service).toBeInstanceOf(BlockImporterService)
    })
  })
})

// ============================================================================
// Test Helpers
// ============================================================================

function createMockBlock(timeSlot: bigint, authorIndex: number): Block {
  const header: BlockHeader = {
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

  const body: BlockBody = {
    extrinsics: []
  }

  return {
    header,
    body
  }
}
