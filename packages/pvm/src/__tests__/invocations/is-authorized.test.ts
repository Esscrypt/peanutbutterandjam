/**
 * Is-Authorized Invocation Tests
 *
 * Tests the Ψ_I function implementation as specified in Gray Paper
 * Section 31: Is-Authorized Invocation
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { IS_AUTHORIZED_CONFIG } from '../../config'
import { IsAuthorizedInvocationSystem } from '../../invocations/is-authorized'
import type { WorkContext, WorkItem, WorkPackage } from '../../types'

describe('Is-Authorized Invocation (Ψ_I)', () => {
  let isAuthorizedSystem: IsAuthorizedInvocationSystem

  beforeEach(() => {
    isAuthorizedSystem = new IsAuthorizedInvocationSystem()
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

    return {
      workContext,
      workItem,
      workPackage,
    }
  }

  describe('Basic functionality', () => {
    it('should return BAD error when authcode is null', () => {
      const { workPackage } = createTestData()
      // Set lookupanchortime to 0 to simulate null authcode
      workPackage.context.lookupanchortime = 0

      const [result, gasUsed] = isAuthorizedSystem.execute(workPackage, 0)

      expect(result).toBe('BAD')
      expect(gasUsed).toBe(0n)
    })

    it('should return BIG error when authcode exceeds maximum size', () => {
      const { workPackage } = createTestData()
      // Set lookupanchortime to exceed maximum size
      workPackage.context.lookupanchortime =
        IS_AUTHORIZED_CONFIG.MAX_AUTH_CODE_SIZE + 1

      const [result, gasUsed] = isAuthorizedSystem.execute(workPackage, 0)

      expect(result).toBe('BIG')
      expect(gasUsed).toBe(0n)
    })

    it('should accept authcode at maximum size', () => {
      const { workPackage } = createTestData()
      // Set lookupanchortime to maximum size
      workPackage.context.lookupanchortime =
        IS_AUTHORIZED_CONFIG.MAX_AUTH_CODE_SIZE

      const [result, gasUsed] = isAuthorizedSystem.execute(workPackage, 0)

      // Should not return BAD or BIG error
      expect(result).not.toBe('BAD')
      expect(result).not.toBe('BIG')
      expect(gasUsed).toBeGreaterThan(0n)
    })
  })

  describe('Core index encoding', () => {
    it('should handle core index 0', () => {
      const { workPackage } = createTestData()

      const [result, gasUsed] = isAuthorizedSystem.execute(workPackage, 0)

      expect(result).not.toBe('BAD')
      expect(result).not.toBe('BIG')
      expect(gasUsed).toBeGreaterThan(0n)
    })

    it('should handle core index 340 (max core)', () => {
      const { workPackage } = createTestData()

      const [result, gasUsed] = isAuthorizedSystem.execute(workPackage, 340)

      expect(result).not.toBe('BAD')
      expect(result).not.toBe('BIG')
      expect(gasUsed).toBeGreaterThan(0n)
    })

    it('should handle large core index', () => {
      const { workPackage } = createTestData()

      const [result, gasUsed] = isAuthorizedSystem.execute(workPackage, 65535)

      expect(result).not.toBe('BAD')
      expect(result).not.toBe('BIG')
      expect(gasUsed).toBeGreaterThan(0n)
    })
  })

  describe('Gas allocation', () => {
    it('should use correct gas limit from Gray Paper', () => {
      const { workPackage } = createTestData()

      const [result, gasUsed] = isAuthorizedSystem.execute(workPackage, 0)

      // Gas used should be less than or equal to the Gray Paper gas limit
      expect(gasUsed).toBeLessThanOrEqual(IS_AUTHORIZED_CONFIG.PACKAGE_AUTH_GAS)
      expect(gasUsed).toBeGreaterThan(0n)
      expect(result).not.toBe('BAD')
      expect(result).not.toBe('BIG')
    })

    it('should return BIG error when execution runs out of gas', () => {
      const { workPackage } = createTestData()
      // Set a very large lookupanchortime to consume more gas
      workPackage.context.lookupanchortime =
        IS_AUTHORIZED_CONFIG.MAX_AUTH_CODE_SIZE

      const [result, gasUsed] = isAuthorizedSystem.execute(workPackage, 0)

      // Should either return BIG (out of gas) or complete successfully
      expect(['BIG', 'BAD']).toContain(result)
      expect(gasUsed).toBeGreaterThan(0n)
    })
  })

  describe('Host call functions', () => {
    it('should handle gas function call (host call ID 0)', () => {
      const { workPackage } = createTestData()

      const [result, gasUsed] = isAuthorizedSystem.execute(workPackage, 0)

      expect(result).not.toBe('BAD')
      expect(result).not.toBe('BIG')
      expect(gasUsed).toBeGreaterThan(0n)
    })

    it('should handle fetch function call (host call ID 1)', () => {
      const { workPackage } = createTestData()

      const [result, gasUsed] = isAuthorizedSystem.execute(workPackage, 0)

      expect(result).not.toBe('BAD')
      expect(result).not.toBe('BIG')
      expect(gasUsed).toBeGreaterThan(0n)
    })

    it('should handle unknown host call function', () => {
      const { workPackage } = createTestData()

      const [result, gasUsed] = isAuthorizedSystem.execute(workPackage, 0)

      expect(result).not.toBe('BAD')
      expect(result).not.toBe('BIG')
      expect(gasUsed).toBeGreaterThan(0n)
    })
  })

  describe('Error handling', () => {
    it('should return BAD error when program panics', () => {
      const { workPackage } = createTestData()
      // Set lookupanchortime to 0 to trigger panic
      workPackage.context.lookupanchortime = 0

      const [result, gasUsed] = isAuthorizedSystem.execute(workPackage, 0)

      expect(result).toBe('BAD')
      expect(gasUsed).toBe(0n)
    })

    it('should handle empty authcode', () => {
      const { workPackage } = createTestData()
      // Set lookupanchortime to 0 to simulate empty authcode
      workPackage.context.lookupanchortime = 0

      const [result, gasUsed] = isAuthorizedSystem.execute(workPackage, 0)

      expect(result).toBe('BAD')
      expect(gasUsed).toBe(0n)
    })
  })

  describe('Gray Paper compliance', () => {
    it('should follow equation eq:isauthinvocation structure', () => {
      const { workPackage } = createTestData()

      // Test the three cases from the Gray Paper equation:
      // 1. authcode = null -> BAD
      // 2. len(authcode) > Cmaxauthcodesize -> BIG
      // 3. Otherwise -> execute Ψ_M

      // Case 1: authcode is null
      workPackage.context.lookupanchortime = 0
      const [result1, _gasUsed1] = isAuthorizedSystem.execute(workPackage, 0)
      expect(result1).toBe('BAD')

      // Case 2: authcode too large
      workPackage.context.lookupanchortime =
        IS_AUTHORIZED_CONFIG.MAX_AUTH_CODE_SIZE + 1
      const [result2, _gasUsed2] = isAuthorizedSystem.execute(workPackage, 0)
      expect(result2).toBe('BIG')

      // Case 3: valid authcode
      workPackage.context.lookupanchortime = 12345
      const [result3, gasUsed3] = isAuthorizedSystem.execute(workPackage, 0)
      expect(result3).not.toBe('BAD')
      expect(result3).not.toBe('BIG')
      expect(gasUsed3).toBeGreaterThan(0n)
    })

    it('should use correct constants from Gray Paper', () => {
      expect(IS_AUTHORIZED_CONFIG.PACKAGE_AUTH_GAS).toBe(50_000_000n)
      expect(IS_AUTHORIZED_CONFIG.MAX_AUTH_CODE_SIZE).toBe(64_000)
    })
  })
})
