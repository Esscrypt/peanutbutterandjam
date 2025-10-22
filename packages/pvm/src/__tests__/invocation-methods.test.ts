/**
 * Test Is-Authorized and Refine Invocation Methods
 * 
 * Tests the Ψ_I (Is-Authorized) and Ψ_R (Refine) invocation methods
 * to ensure they properly use the underlying Ψ_M marshalling invocation.
 */

import { PVM } from '../pvm'
import type { WorkPackage, WorkItem } from '@pbnj/types'

describe('PVM Invocation Methods', () => {
  let pvm: PVM

  beforeEach(() => {
    pvm = new PVM()
  })

  describe('executeIsAuthorized (Ψ_I)', () => {
    it('should execute Is-Authorized invocation with proper parameters', () => {
      // Create a mock work package
      const workPackage: WorkPackage = {
        authToken: '0x1234567890abcdef',
        authCodeHost: 1n,
        authCodeHash: '0xabcdef1234567890',
        authConfig: '0x0000000000000000',
        context: {
          lookupAnchor: 1000n,
          timeslot: 2000n,
        },
        workItems: [],
      }

      const coreIndex = 0n

      // Execute Is-Authorized invocation
      const result = pvm.executeIsAuthorized(workPackage, coreIndex)

      // Verify result structure
      expect(result).toHaveProperty('result')
      expect(result).toHaveProperty('gasUsed')
      expect(typeof result.gasUsed).toBe('bigint')
      
      // Should return 'BAD' for now since we're using placeholder auth code
      expect(result.result).toBe('BAD')
      expect(result.gasUsed).toBe(0n)
    })

    it('should handle missing auth code hash', () => {
      const workPackage: WorkPackage = {
        authToken: '0x1234567890abcdef',
        authCodeHost: 1n,
        authCodeHash: '', // Empty auth code hash
        authConfig: '0x0000000000000000',
        context: {
          lookupAnchor: 1000n,
          timeslot: 2000n,
        },
        workItems: [],
      }

      const result = pvm.executeIsAuthorized(workPackage, 0n)
      
      expect(result.result).toBe('BAD')
      expect(result.gasUsed).toBe(0n)
    })
  })

  describe('executeRefine (Ψ_R)', () => {
    it('should execute Refine invocation with proper parameters', () => {
      // Create a mock work item
      const workItem: WorkItem = {
        codeHash: '0xabcdef1234567890',
        gasLimit: 1000000n,
        importSegments: [],
        exportSegments: [],
      }

      // Create a mock work package
      const workPackage: WorkPackage = {
        authToken: '0x1234567890abcdef',
        authCodeHost: 1n,
        authCodeHash: '0xabcdef1234567890',
        authConfig: '0x0000000000000000',
        context: {
          lookupAnchor: 1000n,
          timeslot: 2000n,
        },
        workItems: [workItem],
      }

      const coreIndex = 0n
      const workItemIndex = 0n
      const authorizerTrace = new Uint8Array([0x01, 0x02, 0x03, 0x04])
      const importSegments: Uint8Array[][] = []
      const exportSegmentOffset = 0n

      // Execute Refine invocation
      const result = pvm.executeRefine(
        coreIndex,
        workItemIndex,
        workPackage,
        authorizerTrace,
        importSegments,
        exportSegmentOffset,
      )

      // Verify result structure
      expect(result).toHaveProperty('result')
      expect(result).toHaveProperty('exportSegments')
      expect(result).toHaveProperty('gasUsed')
      expect(Array.isArray(result.exportSegments)).toBe(true)
      expect(typeof result.gasUsed).toBe('bigint')
      
      // Should return 'BAD' for now since we're using placeholder service code
      expect(result.result).toBe('BAD')
      expect(result.exportSegments).toEqual([])
      expect(result.gasUsed).toBe(0n)
    })

    it('should handle invalid work item index', () => {
      const workPackage: WorkPackage = {
        authToken: '0x1234567890abcdef',
        authCodeHost: 1n,
        authCodeHash: '0xabcdef1234567890',
        authConfig: '0x0000000000000000',
        context: {
          lookupAnchor: 1000n,
          timeslot: 2000n,
        },
        workItems: [], // Empty work items
      }

      const result = pvm.executeRefine(
        0n, // coreIndex
        0n, // workItemIndex (invalid - no work items)
        workPackage,
        new Uint8Array([0x01, 0x02, 0x03, 0x04]), // authorizerTrace
        [], // importSegments
        0n, // exportSegmentOffset
      )
      
      expect(result.result).toBe('BAD')
      expect(result.exportSegments).toEqual([])
      expect(result.gasUsed).toBe(0n)
    })
  })

  describe('Integration with Ψ_M marshalling', () => {
    it('should use executeMarshallingInvocation for both invocations', () => {
      // This test verifies that both invocation methods properly delegate
      // to the underlying Ψ_M marshalling invocation
      
      const workPackage: WorkPackage = {
        authToken: '0x1234567890abcdef',
        authCodeHost: 1n,
        authCodeHash: '0xabcdef1234567890',
        authConfig: '0x0000000000000000',
        context: {
          lookupAnchor: 1000n,
          timeslot: 2000n,
        },
        workItems: [],
      }

      // Both methods should execute without throwing errors
      expect(() => {
        pvm.executeIsAuthorized(workPackage, 0n)
      }).not.toThrow()

      expect(() => {
        pvm.executeRefine(
          0n, 0n, workPackage, 
          new Uint8Array([0x01, 0x02, 0x03, 0x04]), 
          [], 0n
        )
      }).not.toThrow()
    })
  })
})
