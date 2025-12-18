// /**
//  * Safrole State Transition Tests
//  *
//  * Tests the Safrole STF implementation against Gray Paper specifications
//  * Reference: graypaper/text/safrole.tex
//  */

// import { logger } from '@pbnjam/core'
// import { beforeAll, describe, expect, it } from 'vitest'
// import { executeSafroleSTF } from '../state-transitions'
// import type { 
//   SafroleInput, 
//   SafroleState,
//   ValidatorPublicKeys
// } from '@pbnjam/types'
// import * as fs from 'node:fs'
// import * as path from 'node:path'

// // Initialize logger for tests
// beforeAll(() => {
//   logger.init()
// })

// // Test vector types
// interface SafroleTestVector {
//   input: {
//     slot: number
//     entropy: string
//     extrinsic: Array<{
//       attempt: number
//       signature: string
//     }>
//   }
//   pre_state: {
//     tau: number
//     eta: string[]
//     lambda: ValidatorPublicKeys[]
//     kappa: ValidatorPublicKeys[]
//     gamma_k: ValidatorPublicKeys[]
//     iota: ValidatorPublicKeys[]
//     gamma_a: ValidatorPublicKeys[]
//     gamma_s: {
//       keys: string[]
//     }
//     gamma_z: string
//     post_offenders: string[]
//   }
//   output: {
//     ok?: {
//       epoch_mark: any
//       tickets_mark: any
//     }
//     err?: string
//   }
//   post_state: {
//     tau: number
//     eta: string[]
//     lambda: ValidatorPublicKeys[]
//     kappa: ValidatorPublicKeys[]
//     gamma_k: ValidatorPublicKeys[]
//     iota: ValidatorPublicKeys[]
//     gamma_a: ValidatorPublicKeys[]
//     gamma_s: {
//       keys: string[]
//     }
//     gamma_z: string
//     post_offenders: string[]
//   }
// }

// // Load test vectors from jamtestvectors
// function loadTestVectors(): Array<{ file: string, testVector: SafroleTestVector }> {
//   const testVectors: Array<{ file: string, testVector: SafroleTestVector }> = []
  
//   // Load from tiny directory first (smaller test set)
//   const tinyDir = path.join(process.cwd(), 'submodules', 'jamtestvectors', 'stf', 'safrole', 'tiny')
//   const fullDir = path.join(process.cwd(), 'submodules', 'jamtestvectors', 'stf', 'safrole', 'full')
  
//   // Try tiny directory first, fallback to full
//   const testDir = fs.existsSync(tinyDir) ? tinyDir : fullDir
  
//   if (!fs.existsSync(testDir)) {
//     console.warn(`Test vectors directory not found: ${testDir}`)
//     return testVectors
//   }
  
//   const files = fs.readdirSync(testDir).filter(file => file.endsWith('.json'))
  
//   for (const file of files) {
//     try {
//       const filePath = path.join(testDir, file)
//       const content = fs.readFileSync(filePath, 'utf-8')
//       const testVector = JSON.parse(content) as SafroleTestVector
//       testVectors.push({ file, testVector })
//     } catch (error) {
//       console.warn(`Failed to load test vector ${file}:`, error)
//     }
//   }
  
//   return testVectors
// }

// // Convert test vector input to SafroleInput
// function convertTestVectorToSafroleInput(testInput: SafroleTestVector['input']): SafroleInput {
//   return {
//     slot: BigInt(testInput.slot),
//     entropy: testInput.entropy as `0x${string}`,
//     extrinsic: testInput.extrinsic.map(ext => ({
//       entryIndex: BigInt(ext.attempt),
//       signature: ext.signature as `0x${string}`,
//     }))
//   }
// }

// // Convert test vector pre_state to SafroleState
// function convertTestVectorToSafroleState(preState: SafroleTestVector['pre_state']): SafroleState {
//   return {
//     pendingSet: preState.lambda,
//     epochRoot: preState.eta[0] as `0x${string}`, // Use first eta as epoch root
//     sealTickets: [], // Will be generated during execution
//     ticketAccumulator: [], // Will be populated during execution
//   }
// }

// // Validate SafroleOutput against expected output
// function validateSafroleOutput(
//   result: { state: SafroleState; tickets: any[]; errors: string[] },
//   expected: SafroleTestVector['output'],
//   _postState: SafroleTestVector['post_state']
// ): void {
//   if (expected.ok) {
//     // Success case
//     expect(result.errors.length).toBe(0)
//     expect(result.state).toBeDefined()
//     expect(result.state.pendingSet).toBeDefined()
//     expect(result.state.epochRoot).toBeDefined()
//   } else if (expected.err) {
//     expect(result.errors.length).toBeGreaterThan(0)
//   }
// }

// describe('Safrole State Transitions', () => {
//   // Load test vectors
//   const testVectors = loadTestVectors()

//   describe('Test Vector Compliance', () => {
//     if (testVectors.length === 0) {
//       it.skip('No test vectors found - skipping test vector tests', () => {})
//       return
//     }

//     testVectors.forEach(({ file, testVector }) => {
//       it(`should process test vector: ${file}`, async () => {
//         // Convert test vector to our types
//         const input = convertTestVectorToSafroleInput(testVector.input)
//         const state = convertTestVectorToSafroleState(testVector.pre_state)
        
//         // Create mock validator sets (using lambda from pre_state)
//         const stagingSet = testVector.pre_state.lambda
//         const activeSet = testVector.pre_state.kappa || testVector.pre_state.lambda
        
//         // Execute Safrole STF
//         const result = await executeSafroleSTF(
//           state,
//           input,
//           testVector.pre_state.tau,
//           stagingSet,
//           activeSet
//         )

//         // Validate result
//         if (result[0]) {
//           // Error case
//           console.log(`Test vector ${file} resulted in error:`, result[0].message)
//           expect(result[0]).toBeDefined()
//         } else {
//           // Success case
//           const safroleOutput = result[1]!
//           validateSafroleOutput(safroleOutput, testVector.output, testVector.post_state)
//         }
//       })
//     })
//   })

//   // Keep some basic unit tests for edge cases
//   describe('Unit Tests', () => {
//     const mockValidatorKey: ValidatorPublicKeys = {
//       bandersnatch:
//         '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
//       ed25519:
//         '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
//       bls: `0x${'0'.repeat(288)}`,
//       metadata: `0x${'0'.repeat(256)}`,
//     }

//     const mockState: SafroleState = {
//       pendingSet: [mockValidatorKey],
//       epochRoot:
//         '0x4444444444444444444444444444444444444444444444444444444444444444',
//       sealTickets: [],
//       ticketAccumulator: [],
//     }

//     it('should handle regular slot progression', async () => {
//       const input: SafroleInput = {
//         slot: 1n,
//         entropy: '0x5555555555555555555555555555555555555555555555555555555555555555',
//         extrinsic: [],
//       }

//       // Mock additional parameters required by the function
//       const stagingSet: ValidatorPublicKeys[] = [mockValidatorKey]
//       const activeSet: ValidatorPublicKeys[] = [mockValidatorKey]
//       const offenders = new Set<string>()

//       const result = await executeSafroleSTF(mockState, input, 0, stagingSet, activeSet, offenders)

//       // Handle Safe pattern result
//       if (result[0]) {
//         throw result[0] // Re-throw error if present
//       }
//       const safroleOutput = result[1]

//       expect(safroleOutput.state.pendingSet).toEqual([mockValidatorKey])
//       expect(safroleOutput.tickets).toHaveLength(0)
//       expect(safroleOutput.errors).toHaveLength(0)
//     })

//     it('should validate slot progression', async () => {
//       const input: SafroleInput = {
//         slot: 0n, // Same slot as current state
//         entropy: '0x7777777777777777777777777777777777777777777777777777777777777777',
//         extrinsic: [],
//       }

//       // Mock additional parameters required by the function
//       const stagingSet: ValidatorPublicKeys[] = [mockValidatorKey]
//       const activeSet: ValidatorPublicKeys[] = [mockValidatorKey]
//       const offenders = new Set<string>()

//       const result = await executeSafroleSTF(mockState, input, 1, stagingSet, activeSet, offenders) // Use slot 1 to trigger validation
      
//       // Should return an error for invalid slot
//       expect(result[0]).toBeDefined()
//       expect(result[0]?.message).toContain('Invalid slot: 0 < 1')
//     })

//     it('should validate extrinsic limits', async () => {
//       const input: SafroleInput = {
//         slot: 1n,
//         entropy: '0x8888888888888888888888888888888888888888888888888888888888888888',
//         extrinsic: Array(11).fill({
//           entryIndex: 0n,
//           signature: `0x${'0'.repeat(128)}`,
//         }),
//       }

//       // Mock additional parameters required by the function
//       const stagingSet: ValidatorPublicKeys[] = [mockValidatorKey]
//       const activeSet: ValidatorPublicKeys[] = [mockValidatorKey]
//       const offenders = new Set<string>()

//       const result = await executeSafroleSTF(mockState, input, 0, stagingSet, activeSet, offenders)
      
//       // Should return an error for too many extrinsics
//       expect(result[0]).toBeDefined()
//       expect(result[0]?.message).toContain('Too many extrinsics: 11 > 10')
//     })

//     it('should process ticket submissions', async () => {
//       const input: SafroleInput = {
//         slot: 1n,
//         entropy: '0x9999999999999999999999999999999999999999999999999999999999999999',
//         extrinsic: [
//           {
//             entryIndex: 0n,
//             signature: `0x${'a'.repeat(128)}`,
//           },
//           {
//             entryIndex: 1n,
//             signature: `0x${'b'.repeat(128)}`,
//           },
//         ],
//       }

//       // Mock additional parameters required by the function
//       const stagingSet: ValidatorPublicKeys[] = [mockValidatorKey]
//       const activeSet: ValidatorPublicKeys[] = [mockValidatorKey]
//       const offenders = new Set<string>()

//       const result = await executeSafroleSTF(mockState, input, 0, stagingSet, activeSet, offenders)

//       // Handle Safe pattern result
//       if (result[0]) {
//         throw result[0] // Re-throw error if present
//       }
//       const safroleOutput = result[1]

//       expect(safroleOutput.state.pendingSet).toEqual([mockValidatorKey])
//       expect(safroleOutput.tickets).toHaveLength(2)
//       expect(safroleOutput.errors).toHaveLength(0)
//     })

//     it('should validate ticket entry indices', async () => {
//       const input: SafroleInput = {
//         slot: 1n,
//         entropy: '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
//         extrinsic: [
//           { entryIndex: 1001n, signature: `0x${'0'.repeat(128)}` }, // Exceeds MAX_TICKET_ENTRIES
//         ],
//       }

//       // Mock additional parameters required by the function
//       const stagingSet: ValidatorPublicKeys[] = [mockValidatorKey]
//       const activeSet: ValidatorPublicKeys[] = [mockValidatorKey]
//       const offenders = new Set<string>()

//       const result = await executeSafroleSTF(mockState, input, 0, stagingSet, activeSet, offenders)
      
//       // Should return an error for invalid entry index
//       expect(result[0]).toBeDefined()
//       expect(result[0]?.message).toContain('Invalid entry index')
//     })
//   })
// })
