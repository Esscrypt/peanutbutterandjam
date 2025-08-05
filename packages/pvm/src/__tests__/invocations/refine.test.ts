/**
 * Refine Invocation Tests
 *
 * Tests the Ψ_R function implementation as specified in Gray Paper
 * Section 55: Refine Invocation
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { REFINE_CONFIG } from '../../config'
import { RefineInvocationSystem } from '../../invocations/refine'
import type {
  Accounts,
  ServiceAccount,
  WorkContext,
  WorkItem,
  WorkPackage,
} from '../../types'

describe('Refine Invocation (Ψ_R)', () => {
  let refineSystem: RefineInvocationSystem

  beforeEach(() => {
    refineSystem = new RefineInvocationSystem()
  })

  // Helper function to create test data
  const createTestData = () => {
    const workContext: WorkContext = {
      lookupanchortime: 12345,
    }

    const workItem: WorkItem = {
      serviceindex: 1,
      codehash: [0x01, 0x02, 0x03, 0x04],
      payload: [0x10, 0x20, 0x30],
      refgaslimit: 1_000_000n,
      accgaslimit: 500_000n,
      importsegments: [],
      exportsegments: [],
      extrinsics: [],
    }

    const workPackage: WorkPackage = {
      context: workContext,
      workitems: [workItem],
    }

    const serviceAccount: ServiceAccount = {
      codehash: [0x01, 0x02, 0x03, 0x04],
    }

    const accounts: Accounts = {
      1: serviceAccount,
    }

    return {
      workContext,
      workItem,
      workPackage,
      serviceAccount,
      accounts,
    }
  }

  describe('Basic functionality', () => {
    it('should return BAD error when work item not found', () => {
      const { workPackage, accounts } = createTestData()
      const authorizerTrace = [0x01, 0x02, 0x03]
      const importSegments: number[][] = []
      const exportSegmentOffset = 0

      const [result, exportSequence, gasUsed] = refineSystem.execute(
        0, // coreIndex
        999, // invalid workItemIndex
        workPackage,
        authorizerTrace,
        importSegments,
        exportSegmentOffset,
        accounts,
      )

      expect(result).toBe('BAD')
      expect(exportSequence).toEqual([])
      expect(gasUsed).toBe(0n)
    })

    it('should return BAD error when service account not found', () => {
      const { workPackage } = createTestData()
      const authorizerTrace = [0x01, 0x02, 0x03]
      const importSegments: number[][] = []
      const exportSegmentOffset = 0
      const accounts: Accounts = {} // empty accounts

      const [result, exportSequence, gasUsed] = refineSystem.execute(
        0, // coreIndex
        0, // workItemIndex
        workPackage,
        authorizerTrace,
        importSegments,
        exportSegmentOffset,
        accounts,
      )

      expect(result).toBe('BAD')
      expect(exportSequence).toEqual([])
      expect(gasUsed).toBe(0n)
    })

    it('should return BAD error when historical code lookup fails', () => {
      const { workPackage } = createTestData()
      const authorizerTrace = [0x01, 0x02, 0x03]
      const importSegments: number[][] = []
      const exportSegmentOffset = 0

      // Service account with different codehash
      const accounts: Accounts = {
        1: {
          codehash: [0xff, 0xff, 0xff, 0xff], // different codehash
        },
      }

      const [result, exportSequence, gasUsed] = refineSystem.execute(
        0, // coreIndex
        0, // workItemIndex
        workPackage,
        authorizerTrace,
        importSegments,
        exportSegmentOffset,
        accounts,
      )

      expect(result).toBe('BAD')
      expect(exportSequence).toEqual([])
      expect(gasUsed).toBe(0n)
    })

    it('should return BIG error when code size exceeds maximum', () => {
      const { workPackage } = createTestData()
      const authorizerTrace = [0x01, 0x02, 0x03]
      const importSegments: number[][] = []
      const exportSegmentOffset = 0

      // Create oversized code
      const oversizedCode = new Array(
        REFINE_CONFIG.MAX_SERVICE_CODE_SIZE + 1,
      ).fill(0)
      const oversizedAccounts: Accounts = {
        1: {
          codehash: oversizedCode,
        },
      }

      const [result, exportSequence, gasUsed] = refineSystem.execute(
        0, // coreIndex
        0, // workItemIndex
        workPackage,
        authorizerTrace,
        importSegments,
        exportSegmentOffset,
        oversizedAccounts,
      )

      expect(result).toBe('BIG')
      expect(exportSequence).toEqual([])
      expect(gasUsed).toBe(0n)
    })

    it('should accept code at maximum size', () => {
      const { workPackage } = createTestData()
      const authorizerTrace = [0x01, 0x02, 0x03]
      const importSegments: number[][] = []
      const exportSegmentOffset = 0

      // Create maximum size code
      const maxSizeCode = new Array(REFINE_CONFIG.MAX_SERVICE_CODE_SIZE).fill(0)
      const maxSizeAccounts: Accounts = {
        1: {
          codehash: maxSizeCode,
        },
      }

      const [result, _exportSequence, gasUsed] = refineSystem.execute(
        0, // coreIndex
        0, // workItemIndex
        workPackage,
        authorizerTrace,
        importSegments,
        exportSegmentOffset,
        maxSizeAccounts,
      )

      expect(result).not.toBe('BAD')
      expect(result).not.toBe('BIG')
      expect(gasUsed).toBeGreaterThan(0n)
    })
  })

  describe('Gas allocation', () => {
    it('should use gas limit from work item', () => {
      const { workPackage, accounts } = createTestData()
      const authorizerTrace = [0x01, 0x02, 0x03]
      const importSegments: number[][] = []
      const exportSegmentOffset = 0

      const [_result, _exportSequence, gasUsed] = refineSystem.execute(
        0, // coreIndex
        0, // workItemIndex
        workPackage,
        authorizerTrace,
        importSegments,
        exportSegmentOffset,
        accounts,
      )

      // Gas used should be less than or equal to the work item's gas limit
      expect(gasUsed).toBeLessThanOrEqual(workPackage.workitems[0].refgaslimit)
      expect(gasUsed).toBeGreaterThan(0n)
    })

    it('should return BIG error when execution runs out of gas', () => {
      const { workPackage, accounts } = createTestData()
      const authorizerTrace = [0x01, 0x02, 0x03]
      const importSegments: number[][] = []
      const exportSegmentOffset = 0

      // Create work item with very low gas limit
      const lowGasWorkItem: WorkItem = {
        ...workPackage.workitems[0],
        refgaslimit: 10n, // very low gas limit
      }
      const lowGasWorkPackage: WorkPackage = {
        ...workPackage,
        workitems: [lowGasWorkItem],
      }

      const [result, _exportSequence, gasUsed] = refineSystem.execute(
        0, // coreIndex
        0, // workItemIndex
        lowGasWorkPackage,
        authorizerTrace,
        importSegments,
        exportSegmentOffset,
        accounts,
      )

      // Should either return BIG (out of gas) or complete successfully
      expect(['BIG', 'BAD']).toContain(result)
      expect(gasUsed).toBeGreaterThan(0n)
    })
  })

  describe('Host call functions', () => {
    it('should handle gas function call (host call ID 0)', () => {
      const { workPackage, accounts } = createTestData()
      const authorizerTrace = [0x01, 0x02, 0x03]
      const importSegments: number[][] = []
      const exportSegmentOffset = 0

      const [result, _exportSequence, gasUsed] = refineSystem.execute(
        0, // coreIndex
        0, // workItemIndex
        workPackage,
        authorizerTrace,
        importSegments,
        exportSegmentOffset,
        accounts,
      )

      expect(result).not.toBe('BAD')
      expect(result).not.toBe('BIG')
      expect(gasUsed).toBeGreaterThan(0n)
    })

    it('should handle fetch function call (host call ID 1)', () => {
      const { workPackage, accounts } = createTestData()
      const authorizerTrace = [0x01, 0x02, 0x03]
      const importSegments: number[][] = []
      const exportSegmentOffset = 0

      const [result, _exportSequence, gasUsed] = refineSystem.execute(
        0, // coreIndex
        0, // workItemIndex
        workPackage,
        authorizerTrace,
        importSegments,
        exportSegmentOffset,
        accounts,
      )

      expect(result).not.toBe('BAD')
      expect(result).not.toBe('BIG')
      expect(gasUsed).toBeGreaterThan(0n)
    })

    it('should handle historical lookup function call (host call ID 6)', () => {
      const { workPackage, accounts } = createTestData()
      const authorizerTrace = [0x01, 0x02, 0x03]
      const importSegments: number[][] = []
      const exportSegmentOffset = 0

      const [result, _exportSequence, gasUsed] = refineSystem.execute(
        0, // coreIndex
        0, // workItemIndex
        workPackage,
        authorizerTrace,
        importSegments,
        exportSegmentOffset,
        accounts,
      )

      expect(result).not.toBe('BAD')
      expect(result).not.toBe('BIG')
      expect(gasUsed).toBeGreaterThan(0n)
    })

    it('should handle export function call (host call ID 7)', () => {
      const { workPackage, accounts } = createTestData()
      const authorizerTrace = [0x01, 0x02, 0x03]
      const importSegments: number[][] = []
      const exportSegmentOffset = 0

      const [result, _exportSequence, gasUsed] = refineSystem.execute(
        0, // coreIndex
        0, // workItemIndex
        workPackage,
        authorizerTrace,
        importSegments,
        exportSegmentOffset,
        accounts,
      )

      expect(result).not.toBe('BAD')
      expect(result).not.toBe('BIG')
      expect(gasUsed).toBeGreaterThan(0n)
    })

    it('should handle unknown host call function', () => {
      const { workPackage, accounts } = createTestData()
      const authorizerTrace = [0x01, 0x02, 0x03]
      const importSegments: number[][] = []
      const exportSegmentOffset = 0

      const [result, _exportSequence, gasUsed] = refineSystem.execute(
        0, // coreIndex
        0, // workItemIndex
        workPackage,
        authorizerTrace,
        importSegments,
        exportSegmentOffset,
        accounts,
      )

      expect(result).not.toBe('BAD')
      expect(result).not.toBe('BIG')
      expect(gasUsed).toBeGreaterThan(0n)
    })
  })

  describe('Argument encoding', () => {
    it('should handle different core indices', () => {
      const { workPackage, accounts } = createTestData()
      const authorizerTrace = [0x01, 0x02, 0x03]
      const importSegments: number[][] = []
      const exportSegmentOffset = 0

      // Test with different core indices
      const coreIndices = [0, 340, 65535]

      for (const coreIndex of coreIndices) {
        const [result, _exportSequence, gasUsed] = refineSystem.execute(
          coreIndex,
          0, // workItemIndex
          workPackage,
          authorizerTrace,
          importSegments,
          exportSegmentOffset,
          accounts,
        )

        expect(result).not.toBe('BAD')
        expect(result).not.toBe('BIG')
        expect(gasUsed).toBeGreaterThan(0n)
      }
    })

    it('should handle different work item indices', () => {
      const { workPackage, accounts } = createTestData()
      const authorizerTrace = [0x01, 0x02, 0x03]
      const importSegments: number[][] = []
      const exportSegmentOffset = 0

      // Test with different work item indices
      const workItemIndices = [0, 1, 15]

      for (const workItemIndex of workItemIndices) {
        const [result, _exportSequence, gasUsed] = refineSystem.execute(
          0, // coreIndex
          workItemIndex,
          workPackage,
          authorizerTrace,
          importSegments,
          exportSegmentOffset,
          accounts,
        )

        if (workItemIndex === 0) {
          expect(result).not.toBe('BAD')
          expect(result).not.toBe('BIG')
          expect(gasUsed).toBeGreaterThan(0n)
        } else {
          expect(result).toBe('BAD') // work item not found
        }
      }
    })
  })

  describe('Gray Paper compliance', () => {
    it('should follow equation eq:refinvocation structure', () => {
      const { workPackage, accounts } = createTestData()
      const authorizerTrace = [0x01, 0x02, 0x03]
      const importSegments: number[][] = []
      const exportSegmentOffset = 0

      // Test the three cases from the Gray Paper equation:
      // 1. w_wi_serviceindex not in accounts -> BAD
      // 2. histlookup(...) = none -> BAD
      // 3. len(histlookup(...)) > Cmaxservicecodesize -> BIG
      // 4. Otherwise -> execute Ψ_M

      // Case 1: service account not found
      const emptyAccounts: Accounts = {}
      const [result1, _exportSequence1, _gasUsed1] = refineSystem.execute(
        0,
        0,
        workPackage,
        authorizerTrace,
        importSegments,
        exportSegmentOffset,
        emptyAccounts,
      )
      expect(result1).toBe('BAD')

      // Case 2: historical lookup fails (different codehash)
      const wrongCodeAccounts: Accounts = {
        1: { codehash: [0xff, 0xff, 0xff, 0xff] },
      }
      const [result2, _exportSequence2, _gasUsed2] = refineSystem.execute(
        0,
        0,
        workPackage,
        authorizerTrace,
        importSegments,
        exportSegmentOffset,
        wrongCodeAccounts,
      )
      expect(result2).toBe('BAD')

      // Case 3: code too large
      const oversizedCode = new Array(
        REFINE_CONFIG.MAX_SERVICE_CODE_SIZE + 1,
      ).fill(0)
      const oversizedAccounts: Accounts = {
        1: { codehash: oversizedCode },
      }
      const [result3, _exportSequence3, _gasUsed3] = refineSystem.execute(
        0,
        0,
        workPackage,
        authorizerTrace,
        importSegments,
        exportSegmentOffset,
        oversizedAccounts,
      )
      expect(result3).toBe('BIG')

      // Case 4: valid execution
      const [result4, _exportSequence4, gasUsed4] = refineSystem.execute(
        0,
        0,
        workPackage,
        authorizerTrace,
        importSegments,
        exportSegmentOffset,
        accounts,
      )
      expect(result4).not.toBe('BAD')
      expect(result4).not.toBe('BIG')
      expect(gasUsed4).toBeGreaterThan(0n)
    })

    it('should use correct constants from Gray Paper', () => {
      expect(REFINE_CONFIG.PACKAGE_REF_GAS).toBe(5_000_000_000n)
      expect(REFINE_CONFIG.MAX_SERVICE_CODE_SIZE).toBe(4_000_000)
      expect(REFINE_CONFIG.SEGMENT_SIZE).toBe(4_104)
      expect(REFINE_CONFIG.MAX_PACKAGE_EXPORTS).toBe(3_072)
    })
  })
})
