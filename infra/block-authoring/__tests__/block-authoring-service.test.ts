/**
 * Block Authoring Service Tests
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { BlockAuthoringServiceImpl } from '../src/block-authoring-service'
import type { BlockAuthoringConfig, BlockAuthoringContext } from '../src/types'

describe('BlockAuthoringService', () => {
  let service: BlockAuthoringServiceImpl
  let config: BlockAuthoringConfig

  beforeEach(() => {
    service = new BlockAuthoringServiceImpl()

    config = {
      networkId: 'test-network',
      validatorKey: 'test-validator-key',
      slotDuration: 6,
      epochLength: 600,
      maxExtrinsicsPerBlock: 100,
      maxWorkPackagesPerBlock: 10,
      enableStrictValidation: true,
      enableAuditMode: false,
      enableSafroleValidation: true,
      enableGrandpaFinalization: true,
    }

    service.configure(config)
  })

  describe('Configuration', () => {
    it('should configure the service correctly', () => {
      expect(service).toBeDefined()
      // Configuration is tested by the fact that no errors are thrown
    })
  })

  describe('Block Creation', () => {
    it('should create a block with valid context', async () => {
      const context: BlockAuthoringContext = {
        parentHeader: {
          number: 1,
          parentHash:
            '0x0000000000000000000000000000000000000000000000000000000000000000',
          stateRoot:
            '0x0000000000000000000000000000000000000000000000000000000000000000',
          extrinsicsRoot:
            '0x0000000000000000000000000000000000000000000000000000000000000000',
          timestamp: Date.now(),
          author: 'test-author',
          signature: 'test-signature',
        },
        parentState: {
          blockNumber: 1,
          stateRoot:
            '0x0000000000000000000000000000000000000000000000000000000000000000',
          timestamp: Date.now(),
          validators: [],
        },
        currentTimeslot: 1,
        validatorSet: {
          validators: [],
          totalStake: 0n,
          epoch: 1,
        },
        authorIndex: 0,
        extrinsics: [],
        workPackages: [],
        networkState: {
          connectedPeers: 0,
          averageLatency: 0,
          propagationStatus: 'pending' as any,
          finalizationStatus: 'unfinalized' as any,
        },
      }

      const result = await service.createBlock(context)

      expect(result.success).toBe(true)
      expect(result.block).toBeDefined()
      expect(result.block?.header.number).toBe(2)
      expect(result.metrics).toBeDefined()
    })

    it('should handle empty extrinsics and work packages', async () => {
      const context: BlockAuthoringContext = {
        parentHeader: {
          number: 1,
          parentHash:
            '0x0000000000000000000000000000000000000000000000000000000000000000',
          stateRoot:
            '0x0000000000000000000000000000000000000000000000000000000000000000',
          extrinsicsRoot:
            '0x0000000000000000000000000000000000000000000000000000000000000000',
          timestamp: Date.now(),
          author: 'test-author',
          signature: 'test-signature',
        },
        parentState: {
          blockNumber: 1,
          stateRoot:
            '0x0000000000000000000000000000000000000000000000000000000000000000',
          timestamp: Date.now(),
          validators: [],
        },
        currentTimeslot: 1,
        validatorSet: {
          validators: [],
          totalStake: 0n,
          epoch: 1,
        },
        authorIndex: 0,
        extrinsics: [],
        workPackages: [],
        networkState: {
          connectedPeers: 0,
          averageLatency: 0,
          propagationStatus: 'pending' as any,
          finalizationStatus: 'unfinalized' as any,
        },
      }

      const result = await service.createBlock(context)

      expect(result.success).toBe(true)
      expect(result.block?.body).toHaveLength(0)
    })
  })

  describe('Metrics', () => {
    it('should provide metrics', () => {
      const metrics = service.getMetrics()

      expect(metrics).toBeDefined()
      expect(typeof metrics.creationTime).toBe('number')
      expect(typeof metrics.validationTime).toBe('number')
      expect(typeof metrics.submissionTime).toBe('number')
      expect(typeof metrics.memoryUsage).toBe('number')
      expect(typeof metrics.cpuUsage).toBe('number')
      expect(typeof metrics.extrinsicCount).toBe('number')
      expect(typeof metrics.workPackageCount).toBe('number')
      expect(typeof metrics.blockSize).toBe('number')
    })

    it('should reset metrics', () => {
      service.resetMetrics()
      const metrics = service.getMetrics()

      expect(metrics.creationTime).toBe(0)
      expect(metrics.validationTime).toBe(0)
      expect(metrics.submissionTime).toBe(0)
    })
  })
})
