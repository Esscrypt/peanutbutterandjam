/**
 * Work Package Processor Tests
 */

import { beforeEach, describe, expect, it } from 'vitest'
import type { BlockAuthoringConfig, WorkItem, WorkPackage } from '../src/types'
import { WorkPackageProcessor } from '../src/work-package-processor'

describe('WorkPackageProcessor', () => {
  let processor: WorkPackageProcessor
  let config: BlockAuthoringConfig

  beforeEach(() => {
    processor = new WorkPackageProcessor()

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
  })

  describe('Work Package Validation', () => {
    it('should validate a valid work package', async () => {
      const workPackage: WorkPackage = {
        id: 'test-package-1',
        data: new Uint8Array([1, 2, 3, 4]),
        author: 'test-author',
        timestamp: Date.now(),
        authToken: new Uint8Array([1, 2, 3]),
        authCodeHost: 1,
        authCodeHash: '0x1234567890abcdef',
        authConfig: new Uint8Array([1, 2, 3, 4]),
        context: { test: 'context' },
        workItems: [
          {
            serviceIndex: 1,
            codeHash: '0xabcdef1234567890',
            payload: new Uint8Array([1, 2, 3]),
            refGasLimit: 1000,
            accGasLimit: 2000,
            exportCount: 2,
            importSegments: [['0x1234567890abcdef', 0]],
            extrinsics: [['0xabcdef1234567890', 100]],
          },
        ],
      }

      const reports = await processor.process([workPackage], config)

      expect(reports).toHaveLength(1)
      expect(reports[0].workPackageId).toBe(workPackage.id)
      expect(reports[0].digests).toHaveLength(1)
    })

    it('should reject work package with too many items', async () => {
      const workItems: WorkItem[] = []
      for (let i = 0; i < 150; i++) {
        workItems.push({
          serviceIndex: i,
          codeHash: `0x${i.toString(16).padStart(16, '0')}`,
          payload: new Uint8Array([1, 2, 3]),
          refGasLimit: 1000,
          accGasLimit: 2000,
          exportCount: 1,
          importSegments: [],
          extrinsics: [],
        })
      }

      const workPackage: WorkPackage = {
        id: 'test-package-2',
        data: new Uint8Array([1, 2, 3, 4]),
        author: 'test-author',
        timestamp: Date.now(),
        authToken: new Uint8Array([1, 2, 3]),
        authCodeHost: 1,
        authCodeHash: '0x1234567890abcdef',
        authConfig: new Uint8Array([1, 2, 3, 4]),
        context: { test: 'context' },
        workItems,
      }

      const reports = await processor.process([workPackage], config)

      // Should be rejected due to too many work items
      expect(reports).toHaveLength(0)
    })

    it('should reject work package with too many exports', async () => {
      const workPackage: WorkPackage = {
        id: 'test-package-3',
        data: new Uint8Array([1, 2, 3, 4]),
        author: 'test-author',
        timestamp: Date.now(),
        authToken: new Uint8Array([1, 2, 3]),
        authCodeHost: 1,
        authCodeHash: '0x1234567890abcdef',
        authConfig: new Uint8Array([1, 2, 3, 4]),
        context: { test: 'context' },
        workItems: [
          {
            serviceIndex: 1,
            codeHash: '0xabcdef1234567890',
            payload: new Uint8Array([1, 2, 3]),
            refGasLimit: 1000,
            accGasLimit: 2000,
            exportCount: 4000, // Exceeds MAX_PACKAGE_EXPORTS (3072)
            importSegments: [],
            extrinsics: [],
          },
        ],
      }

      const reports = await processor.process([workPackage], config)

      // Should be rejected due to too many exports
      expect(reports).toHaveLength(0)
    })

    it('should reject work package with too many imports', async () => {
      const importSegments: [string, number][] = []
      for (let i = 0; i < 4000; i++) {
        importSegments.push([`0x${i.toString(16).padStart(16, '0')}`, i])
      }

      const workPackage: WorkPackage = {
        id: 'test-package-4',
        data: new Uint8Array([1, 2, 3, 4]),
        author: 'test-author',
        timestamp: Date.now(),
        authToken: new Uint8Array([1, 2, 3]),
        authCodeHost: 1,
        authCodeHash: '0x1234567890abcdef',
        authConfig: new Uint8Array([1, 2, 3, 4]),
        context: { test: 'context' },
        workItems: [
          {
            serviceIndex: 1,
            codeHash: '0xabcdef1234567890',
            payload: new Uint8Array([1, 2, 3]),
            refGasLimit: 1000,
            accGasLimit: 2000,
            exportCount: 1,
            importSegments, // Exceeds MAX_PACKAGE_IMPORTS (3072)
            extrinsics: [],
          },
        ],
      }

      const reports = await processor.process([workPackage], config)

      // Should be rejected due to too many imports
      expect(reports).toHaveLength(0)
    })

    it('should reject work package with too many extrinsics', async () => {
      const extrinsics: [string, number][] = []
      for (let i = 0; i < 200; i++) {
        extrinsics.push([`0x${i.toString(16).padStart(16, '0')}`, 100])
      }

      const workPackage: WorkPackage = {
        id: 'test-package-5',
        data: new Uint8Array([1, 2, 3, 4]),
        author: 'test-author',
        timestamp: Date.now(),
        authToken: new Uint8Array([1, 2, 3]),
        authCodeHost: 1,
        authCodeHash: '0x1234567890abcdef',
        authConfig: new Uint8Array([1, 2, 3, 4]),
        context: { test: 'context' },
        workItems: [
          {
            serviceIndex: 1,
            codeHash: '0xabcdef1234567890',
            payload: new Uint8Array([1, 2, 3]),
            refGasLimit: 1000,
            accGasLimit: 2000,
            exportCount: 1,
            importSegments: [],
            extrinsics, // Exceeds MAX_PACKAGE_EXTRINSICS (128)
          },
        ],
      }

      const reports = await processor.process([workPackage], config)

      // Should be rejected due to too many extrinsics
      expect(reports).toHaveLength(0)
    })
  })

  describe('Work Package Processing', () => {
    it('should process multiple work packages', async () => {
      const workPackages: WorkPackage[] = [
        {
          id: 'test-package-6',
          data: new Uint8Array([1, 2, 3, 4]),
          author: 'test-author-1',
          timestamp: Date.now(),
          authToken: new Uint8Array([1, 2, 3]),
          authCodeHost: 1,
          authCodeHash: '0x1234567890abcdef',
          authConfig: new Uint8Array([1, 2, 3, 4]),
          context: { test: 'context-1' },
          workItems: [
            {
              serviceIndex: 1,
              codeHash: '0xabcdef1234567890',
              payload: new Uint8Array([1, 2, 3]),
              refGasLimit: 1000,
              accGasLimit: 2000,
              exportCount: 2,
              importSegments: [['0x1234567890abcdef', 0]],
              extrinsics: [['0xabcdef1234567890', 100]],
            },
          ],
        },
        {
          id: 'test-package-7',
          data: new Uint8Array([5, 6, 7, 8]),
          author: 'test-author-2',
          timestamp: Date.now(),
          authToken: new Uint8Array([4, 5, 6]),
          authCodeHost: 2,
          authCodeHash: '0xfedcba0987654321',
          authConfig: new Uint8Array([5, 6, 7, 8]),
          context: { test: 'context-2' },
          workItems: [
            {
              serviceIndex: 2,
              codeHash: '0x0987654321fedcba',
              payload: new Uint8Array([4, 5, 6]),
              refGasLimit: 1500,
              accGasLimit: 2500,
              exportCount: 1,
              importSegments: [['0xfedcba0987654321', 1]],
              extrinsics: [['0x0987654321fedcba', 150]],
            },
          ],
        },
      ]

      const reports = await processor.process(workPackages, config)

      expect(reports).toHaveLength(2)
      expect(reports[0].workPackageId).toBe('test-package-6')
      expect(reports[1].workPackageId).toBe('test-package-7')
      expect(reports[0].digests).toHaveLength(1)
      expect(reports[1].digests).toHaveLength(1)
    })

    it('should handle work package with multiple work items', async () => {
      const workPackage: WorkPackage = {
        id: 'test-package-8',
        data: new Uint8Array([1, 2, 3, 4]),
        author: 'test-author',
        timestamp: Date.now(),
        authToken: new Uint8Array([1, 2, 3]),
        authCodeHost: 1,
        authCodeHash: '0x1234567890abcdef',
        authConfig: new Uint8Array([1, 2, 3, 4]),
        context: { test: 'context' },
        workItems: [
          {
            serviceIndex: 1,
            codeHash: '0xabcdef1234567890',
            payload: new Uint8Array([1, 2, 3]),
            refGasLimit: 1000,
            accGasLimit: 2000,
            exportCount: 1,
            importSegments: [['0x1234567890abcdef', 0]],
            extrinsics: [['0xabcdef1234567890', 100]],
          },
          {
            serviceIndex: 2,
            codeHash: '0x0987654321fedcba',
            payload: new Uint8Array([4, 5, 6]),
            refGasLimit: 1500,
            accGasLimit: 2500,
            exportCount: 2,
            importSegments: [['0xfedcba0987654321', 1]],
            extrinsics: [['0x0987654321fedcba', 150]],
          },
          {
            serviceIndex: 3,
            codeHash: '0x1122334455667788',
            payload: new Uint8Array([7, 8, 9]),
            refGasLimit: 2000,
            accGasLimit: 3000,
            exportCount: 0,
            importSegments: [],
            extrinsics: [],
          },
        ],
      }

      const reports = await processor.process([workPackage], config)

      expect(reports).toHaveLength(1)
      expect(reports[0].digests).toHaveLength(3)
      expect(reports[0].availabilitySpec.segmentCount).toBe(3) // 1 + 2 + 0 exports
    })

    it('should handle empty work packages array', async () => {
      const reports = await processor.process([], config)

      expect(reports).toHaveLength(0)
    })

    it('should handle work package with no work items', async () => {
      const workPackage: WorkPackage = {
        id: 'test-package-9',
        data: new Uint8Array([1, 2, 3, 4]),
        author: 'test-author',
        timestamp: Date.now(),
        authToken: new Uint8Array([1, 2, 3]),
        authCodeHost: 1,
        authCodeHash: '0x1234567890abcdef',
        authConfig: new Uint8Array([1, 2, 3, 4]),
        context: { test: 'context' },
        workItems: [],
      }

      const reports = await processor.process([workPackage], config)

      // Should be rejected due to no work items
      expect(reports).toHaveLength(0)
    })
  })

  describe('Work Report Structure', () => {
    it('should create work report with correct structure', async () => {
      const workPackage: WorkPackage = {
        id: 'test-package-10',
        data: new Uint8Array([1, 2, 3, 4]),
        author: 'test-author',
        timestamp: Date.now(),
        authToken: new Uint8Array([1, 2, 3]),
        authCodeHost: 1,
        authCodeHash: '0x1234567890abcdef',
        authConfig: new Uint8Array([1, 2, 3, 4]),
        context: { test: 'context' },
        workItems: [
          {
            serviceIndex: 1,
            codeHash: '0xabcdef1234567890',
            payload: new Uint8Array([1, 2, 3]),
            refGasLimit: 1000,
            accGasLimit: 2000,
            exportCount: 2,
            importSegments: [['0x1234567890abcdef', 0]],
            extrinsics: [['0xabcdef1234567890', 100]],
          },
        ],
      }

      const reports = await processor.process([workPackage], config)

      expect(reports).toHaveLength(1)
      const report = reports[0]

      // Check report structure
      expect(report.id).toMatch(/^report_test-package-10$/)
      expect(report.workPackageId).toBe(workPackage.id)
      expect(report.context).toEqual(workPackage.context)
      expect(report.coreIndex).toBe(0)
      expect(report.authorizer).toMatch(/^0x[0-9a-f]{64}$/)
      expect(report.authTrace).toBeInstanceOf(Uint8Array)
      expect(report.srLookup).toBeInstanceOf(Map)
      expect(report.digests).toHaveLength(1)
      expect(report.authGasUsed).toBe(0)
      expect(report.author).toBe(workPackage.author)
      expect(report.timestamp).toBeGreaterThan(0)

      // Check availability spec
      expect(report.availabilitySpec).toBeDefined()
      expect(report.availabilitySpec.packageHash).toMatch(/^0x[0-9a-f]{64}$/)
      expect(report.availabilitySpec.bundleLength).toBeGreaterThan(0)
      expect(report.availabilitySpec.erasureRoot).toMatch(/^0x[0-9a-f]{64}$/)
      expect(report.availabilitySpec.segmentRoot).toMatch(/^0x[0-9a-f]{64}$/)
      expect(report.availabilitySpec.segmentCount).toBe(2)

      // Check work digest
      const digest = report.digests[0]
      expect(digest.serviceIndex).toBe(1)
      expect(digest.codeHash).toBe('0xabcdef1234567890')
      expect(digest.payloadHash).toMatch(/^0x[0-9a-f]{64}$/)
      expect(digest.gasLimit).toBe(2000)
      expect(digest.result).toBeInstanceOf(Uint8Array)
      expect(digest.gasUsed).toBeGreaterThanOrEqual(0)
      expect(digest.importCount).toBe(1)
      expect(digest.exportCount).toBe(2)
      expect(digest.extrinsicCount).toBe(1)
      expect(digest.extrinsicSize).toBe(100)
    })
  })
})
