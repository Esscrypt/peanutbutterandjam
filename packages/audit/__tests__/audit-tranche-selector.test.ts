// /**
//  * Audit Tranche Selector Tests
//  *
//  * Tests the audit tranche selection logic with Fisher-Yates shuffle
//  * Validates compliance with Gray Paper auditing.tex specification
//  */

// import { describe, expect, it, beforeAll } from 'vitest'
// import { 
//   AuditTrancheSelector, 
//   type CoreWorkReport,
//   type PreviousTrancheAnnouncement,
//   type NegativeJudgment
// } from '../src/audit/audit-tranche-selector'
// import { logger } from '@pbnj/core'

// beforeAll(() => {
//   logger.init()
// })

// describe('AuditTrancheSelector', () => {
//   let selector: AuditTrancheSelector
//   let mockCoreWorkReports: CoreWorkReport[]
//   let mockVrfOutput: string

//   const setupTest = () => {
//     selector = new AuditTrancheSelector()
    
//     // Create mock core work reports
//     mockCoreWorkReports = [
//       {
//         coreIndex: 0n,
//         workReports: [
//           { workReportHash: '0x1111111111111111111111111111111111111111111111111111111111111111' },
//           { workReportHash: '0x2222222222222222222222222222222222222222222222222222222222222222' },
//         ],
//       },
//       {
//         coreIndex: 1n,
//         workReports: [
//           { workReportHash: '0x3333333333333333333333333333333333333333333333333333333333333333' },
//         ],
//       },
//       {
//         coreIndex: 2n,
//         workReports: [], // Empty core
//       },
//       {
//         coreIndex: 3n,
//         workReports: [
//           { workReportHash: '0x4444444444444444444444444444444444444444444444444444444444444444' },
//           { workReportHash: '0x5555555555555555555555555555555555555555555555555555555555555555' },
//           { workReportHash: '0x6666666666666666666666666666666666666666666666666666666666666666' },
//         ],
//       },
//       {
//         coreIndex: 4n,
//         workReports: [
//           { workReportHash: '0x7777777777777777777777777777777777777777777777777777777777777777' },
//         ],
//       },
//     ]

//     mockVrfOutput = '0x123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0'
//   }

//   describe('selectAuditTranche0', () => {
//     it('should select first 10 non-empty cores using Fisher-Yates shuffle', () => {
//       setupTest()
//       const selection = selector.selectAuditTranche0(mockCoreWorkReports, mockVrfOutput)

//       expect(selection.tranche).toBe(0)
//       expect(selection.vrfOutput).toBe(mockVrfOutput)
//       expect(selection.selectedCores.length).toBeLessThanOrEqual(10)
//       expect(selection.shuffledSequence.length).toBe(mockCoreWorkReports.length)

//       // All selected cores should have work reports
//       for (const core of selection.selectedCores) {
//         expect(core.workReports.length).toBeGreaterThan(0)
//       }

//       // Verify no empty cores are selected
//       const emptyCores = selection.selectedCores.filter(core => core.workReports.length === 0)
//       expect(emptyCores.length).toBe(0)
//     })

//     it('should produce deterministic results with same VRF output', () => {
//       setupTest()
//       const selection1 = selector.selectAuditTranche0(mockCoreWorkReports, mockVrfOutput)
//       const selection2 = selector.selectAuditTranche0(mockCoreWorkReports, mockVrfOutput)

//       expect(selection1.selectedCores).toEqual(selection2.selectedCores)
//       expect(selection1.shuffledSequence).toEqual(selection2.shuffledSequence)
//     })

//     it('should produce different results with different VRF output', () => {
//       setupTest()
//       const differentVrfOutput = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
      
//       const selection1 = selector.selectAuditTranche0(mockCoreWorkReports, mockVrfOutput)
//       const selection2 = selector.selectAuditTranche0(mockCoreWorkReports, differentVrfOutput)

//       // Results should be different (unless extremely unlikely collision)
//       expect(selection1.selectedCores).not.toEqual(selection2.selectedCores)
//     })

//     it('should handle empty core work reports', () => {
//       setupTest()
//       const emptyCores: CoreWorkReport[] = [
//         { coreIndex: 0n, workReports: [] },
//         { coreIndex: 1n, workReports: [] },
//       ]

//       const selection = selector.selectAuditTranche0(emptyCores, mockVrfOutput)

//       expect(selection.selectedCores.length).toBe(0)
//       expect(selection.shuffledSequence.length).toBe(2)
//     })

//     it('should handle single core with work reports', () => {
//       setupTest()
//       const singleCore: CoreWorkReport[] = [
//         { coreIndex: 0n, workReports: [{ workReportHash: '0x1111111111111111111111111111111111111111111111111111111111111111' }] },
//       ]

//       const selection = selector.selectAuditTranche0(singleCore, mockVrfOutput)

//       expect(selection.selectedCores.length).toBe(1)
//       expect(selection.selectedCores[0].coreIndex).toBe(0n)
//     })
//   })

//   describe('selectAuditTrancheN', () => {
//     it('should select cores with negative judgments', () => {
//       setupTest()
//       const negativeJudgments: NegativeJudgment[] = [
//         { workReportHash: '0x1111111111111111111111111111111111111111111111111111111111111111', coreIndex: 0n },
//         { workReportHash: '0x3333333333333333333333333333333333333333333333333333333333333333', coreIndex: 1n },
//       ]

//       const selection = selector.selectAuditTrancheN(
//         mockCoreWorkReports,
//         mockVrfOutput,
//         1,
//         [],
//         negativeJudgments,
//       )

//       expect(selection.tranche).toBe(1)
//       expect(selection.selectedCores.length).toBeGreaterThan(0)

//       // Should include cores with negative judgments
//       const selectedCoreIndices = selection.selectedCores.map(core => core.coreIndex)
//       expect(selectedCoreIndices).toContain(0n)
//       expect(selectedCoreIndices).toContain(1n)
//     })

//     it('should select additional cores if needed', () => {
//       setupTest()
//       const selection = selector.selectAuditTrancheN(
//         mockCoreWorkReports,
//         mockVrfOutput,
//         1,
//         [],
//         [],
//       )

//       expect(selection.selectedCores.length).toBeLessThanOrEqual(10)
//       expect(selection.selectedCores.length).toBeGreaterThan(0)
//     })
//   })

//   describe('verifyAuditTrancheSelection', () => {
//     it('should verify correct selection', () => {
//       setupTest()
//       const selection = selector.selectAuditTranche0(mockCoreWorkReports, mockVrfOutput)
//       const isValid = selector.verifyAuditTrancheSelection(selection, mockCoreWorkReports)

//       expect(isValid).toBe(true)
//     })

//     it('should detect tampered selection', () => {
//       const selection = selector.selectAuditTranche0(mockCoreWorkReports, mockVrfOutput)
      
//       // Tamper with the selection
//       selection.selectedCores[0].coreIndex = 999n

//       const isValid = selector.verifyAuditTrancheSelection(selection, mockCoreWorkReports)
//       expect(isValid).toBe(false)
//     })

//     it('should detect tampered VRF output', () => {
//       const selection = selector.selectAuditTranche0(mockCoreWorkReports, mockVrfOutput)
      
//       // Tamper with the VRF output
//       selection.vrfOutput = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'

//       const isValid = selector.verifyAuditTrancheSelection(selection, mockCoreWorkReports)
//       expect(isValid).toBe(false)
//     })
//   })

//   describe('Gray Paper compliance', () => {
//     it('should implement the exact Gray Paper formula', () => {
//       // Test with known VRF output to verify deterministic behavior
//       const knownVrfOutput = '0x0000000000000000000000000000000000000000000000000000000000000000'
      
//       const selection = selector.selectAuditTranche0(mockCoreWorkReports, knownVrfOutput)

//       // Verify the selection follows Gray Paper specification:
//       // p = fyshuffle([(c, local_reports[c]) for c in coreindex], banderout{local_seed_0})
//       // local_tranche_0 = {wrc for wrc in p[0:10] if wr != None}
      
//       expect(selection.shuffledSequence.length).toBe(mockCoreWorkReports.length)
//       expect(selection.selectedCores.length).toBeLessThanOrEqual(10)
      
//       // All selected cores should be from the shuffled sequence
//       for (const selectedCore of selection.selectedCores) {
//         const foundInShuffled = selection.shuffledSequence.some(
//           core => core.coreIndex === selectedCore.coreIndex
//         )
//         expect(foundInShuffled).toBe(true)
//       }
//     })

//     it('should handle large number of cores efficiently', () => {
//       // Create 341 cores (typical JAM configuration)
//       const largeCoreWorkReports: CoreWorkReport[] = []
//       for (let i = 0; i < 341; i++) {
//         largeCoreWorkReports.push({
//           coreIndex: BigInt(i),
//           workReports: i % 3 === 0 ? [] : [ // Some cores have no work reports
//             { workReportHash: `0x${i.toString(16).padStart(64, '0')}` }
//           ],
//         })
//       }

//       const start = Date.now()
//       const selection = selector.selectAuditTranche0(largeCoreWorkReports, mockVrfOutput)
//       const duration = Date.now() - start

//       expect(selection.selectedCores.length).toBeLessThanOrEqual(10)
//       expect(duration).toBeLessThan(100) // Should complete within 100ms
//     })
//   })
// })
