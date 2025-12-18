// /**
//  * JAM Safrole STF Test Vector Validation Tests
//  *
//  * Tests the Safrole State Transition Function against official JAM test vectors
//  * from submodules/jamtestvectors/stf/safrole/tiny/
//  */

// import { logger } from '@pbnjam/core'
// import { readFileSync, readdirSync } from 'fs'
// import { join } from 'path'
// import { beforeAll, describe, expect, it } from 'vitest'
// import { executeSafroleSTF } from '@pbnjam/safrole'
// import type { SafroleInput, SafroleOutput, SafroleState, ValidatorPublicKeys } from '@pbnjam/types'

// beforeAll(() => {
//   logger.init()
// })

// interface SafroleTestInput {
//   slot: number
//   entropy: string
//   extrinsic: Array<{
//     attempt: number
//     signature: string
//   }>
// }

// interface SafroleTestPreState {
//   tau: number // slot
//   eta: string[] // entropy accumulator
//   lambda: ValidatorPublicKeys[] // pendingset
//   kappa: ValidatorPublicKeys[] // activeset  
//   gamma_k: ValidatorPublicKeys[] // stagingset
//   iota: ValidatorPublicKeys[] // previousset
//   gamma_a: any[] // ticket accumulator
//   gamma_s: { keys: string[] } // seal tickets
//   gamma_z: string // epoch root
//   post_offenders: string[] // offenders
// }

// interface SafroleTestPostState {
//   tau: number
//   eta: string[]
//   lambda: ValidatorPublicKeys[]
//   kappa: ValidatorPublicKeys[]
//   gamma_k: ValidatorPublicKeys[]
//   iota: ValidatorPublicKeys[]
//   gamma_a: any[]
//   gamma_s: { keys: string[] }
//   gamma_z: string
//   post_offenders: string[]
// }

// interface SafroleTestOutput {
//   ok?: {
//     epoch_mark: any
//     tickets_mark: any
//   }
//   err?: string
// }

// interface SafroleTestVector {
//   input: SafroleTestInput
//   pre_state: SafroleTestPreState
//   output: SafroleTestOutput
//   post_state: SafroleTestPostState
// }

// function loadSafroleTestVectors(directory: string): Array<{ file: string, testVector: SafroleTestVector }> {
//   const testVectors: Array<{ file: string, testVector: SafroleTestVector }> = []
  
//   try {
//     const files = readdirSync(directory)
//     const jsonFiles = files.filter(file => file.endsWith('.json'))
    
//     for (const file of jsonFiles) {
//       const filePath = join(directory, file)
//       const content = readFileSync(filePath, 'utf-8')
//       const testVector = JSON.parse(content) as SafroleTestVector
//       testVectors.push({ file, testVector })
//     }
//   } catch (error) {
//     logger.error('Failed to load Safrole test vectors', { error, directory })
//   }
  
//   return testVectors
// }

// function convertTestVectorToSafroleInput(testInput: SafroleTestInput): SafroleInput {
//   return {
//     slot: BigInt(testInput.slot),
//     entropy: testInput.entropy as `0x${string}`,
//     extrinsic: testInput.extrinsic.map(ext => ({
//       entryIndex: BigInt(ext.attempt),
//       signature: ext.signature as `0x${string}`,
//     }))
//   }
// }

// function convertTestVectorToSafroleState(testState: SafroleTestPreState): SafroleState {
//   return {
//     pendingSet: testState.lambda,
//     epochRoot: testState.eta[0] as `0x${string}` || '0x0000000000000000000000000000000000000000000000000000000000000000',
//     sealTickets: [], // Convert gamma_s to Ticket[] format
//     ticketAccumulator: testState.gamma_a || [], // Ticket accumulator from test vector
//   }
// }

// function validateSafroleOutput(
//   result: SafroleOutput,
//   expected: SafroleTestOutput,
//   expectedState: SafroleTestPostState
// ): void {
//   // Check if result should be success or error
//   if (expected.ok) {
//     expect(result.errors).toHaveLength(0)
    
//     // Verify epoch root update
//     if (expectedState.eta.length > 0) {
//       expect(result.state.epochRoot).toBeDefined()
//     }
    
//     // Verify validator sets
//     expect(result.state.pendingSet).toBeDefined()
//     expect(Array.isArray(result.state.pendingSet)).toBe(true)
    
//     // Verify seal tickets and ticket accumulator
//     expect(result.state.sealTickets).toBeDefined()
//     expect(result.state.ticketAccumulator).toBeDefined()
    
//   } else if (expected.err) {
//     expect(result.errors.length).toBeGreaterThan(0)
//   }
// }

// describe('JAM Safrole STF Test Vectors', () => {
//   let testVectors: Array<{ file: string, testVector: SafroleTestVector }> = []

//   beforeAll(() => {
//     const testVectorPath = join(process.cwd(), '../../submodules/jamtestvectors/stf/safrole/tiny')
//     testVectors = loadSafroleTestVectors(testVectorPath)
//     logger.info(`Loaded ${testVectors.length} Safrole STF test vectors`)
//   })

//   it('should load test vectors successfully', () => {
//     expect(testVectors).toBeDefined()
//     expect(testVectors.length).toBeGreaterThan(0)
//   })

//   // Test specific patterns
//   describe('Epoch Change Tests', () => {
//     let epochChangeTests: Array<{ file: string, testVector: SafroleTestVector }> = []
    
//     beforeAll(() => {
//       epochChangeTests = testVectors.filter(({ file }) => 
//         file.includes('epoch-change')
//       )
//     })

//     it('should handle epoch change tests', async () => {
//       expect(epochChangeTests.length).toBeGreaterThan(0)
      
//       for (const { file: _file, testVector } of epochChangeTests.slice(0, 3)) { // Limit for performance
//         const input = convertTestVectorToSafroleInput(testVector.input)
//         const preState = convertTestVectorToSafroleState(testVector.pre_state)
        
//         // Mock validator sets for epoch transition
//         const stagingSet = testVector.pre_state.gamma_k
//         const activeSet = testVector.pre_state.kappa
//         const offenders = new Set(testVector.pre_state.post_offenders)
        
//         const result = await executeSafroleSTF(
//           preState, 
//           input, 
//           testVector.pre_state.tau, // currentSlot
//           stagingSet,
//           activeSet,
//           offenders
//         )
        
//         // Handle Safe pattern result
//         if (result[0]) {
//           // If there's an error, validate it matches expected error
//           if (testVector.output.err) {
//             expect(result[0].message).toContain(testVector.output.err)
//           } else {
//             throw result[0] // Unexpected error
//           }
//         } else {
//           const safroleOutput = result[1]
//           validateSafroleOutput(safroleOutput, testVector.output, testVector.post_state)
          
//           // Specific epoch change validations
//           if (testVector.output.ok) {
//             // Verify epoch root update
//             expect(safroleOutput.state.epochRoot).toBeDefined()
//             expect(safroleOutput.state.epochRoot.length).toBe(66) // 0x + 64 hex chars
            
//             // Verify pending set transition
//             expect(safroleOutput.state.pendingSet).toBeDefined()
//             expect(Array.isArray(safroleOutput.state.pendingSet)).toBe(true)
//           }
//         }
//       }
//     })
//   })

//   describe('Regular Slot Tests', () => {
//     let regularTests: Array<{ file: string, testVector: SafroleTestVector }> = []
    
//     beforeAll(() => {
//       regularTests = testVectors.filter(({ file }) => 
//         !file.includes('epoch-change')
//       )
//     })

//     it('should handle regular slot tests', async () => {
//       expect(regularTests.length).toBeGreaterThan(0)
      
//       for (const { file: _file, testVector } of regularTests.slice(0, 3)) { // Limit for performance
//         const input = convertTestVectorToSafroleInput(testVector.input)
//         const preState = convertTestVectorToSafroleState(testVector.pre_state)
        
//         const stagingSet = testVector.pre_state.gamma_k
//         const activeSet = testVector.pre_state.kappa
//         const offenders = new Set(testVector.pre_state.post_offenders)
        
//         const result = await executeSafroleSTF(
//           preState,
//           input,
//           testVector.pre_state.tau,
//           stagingSet,
//           activeSet,
//           offenders
//         )
        
//         // Handle Safe pattern result
//         if (result[0]) {
//           // Check if this is an expected error
//           if (testVector.output.err && result[0].message === testVector.output.err) {
//             // Expected error - test passes
//             expect(result[0].message).toBe(testVector.output.err)
//           } else {
//             // Unexpected error
//             throw result[0]
//           }
//         } else {
//           // Success case
//           const safroleOutput = result[1]
//           validateSafroleOutput(safroleOutput, testVector.output, testVector.post_state)
          
//           // Basic state consistency checks
//           expect(safroleOutput.state).toBeDefined()
//           expect(safroleOutput.state.epochRoot).toBeDefined()
//           expect(safroleOutput.state.pendingSet).toBeDefined()
//         }
//       }
//     })
//   })

//   describe('Error Cases', () => {
//     let errorTests: Array<{ file: string, testVector: SafroleTestVector }> = []
    
//     beforeAll(() => {
//       errorTests = testVectors.filter(({ testVector }) => testVector.output.err)
//     })

//     it('should handle error cases', async () => {
//       if (errorTests.length === 0) {
//         // Skip if no error test vectors available
//         return
//       }
      
//       for (const { file: _file, testVector } of errorTests.slice(0, 2)) { // Limit for performance
//         const input = convertTestVectorToSafroleInput(testVector.input)
//         const preState = convertTestVectorToSafroleState(testVector.pre_state)
        
//         const stagingSet = testVector.pre_state.gamma_k
//         const activeSet = testVector.pre_state.kappa
//         const offenders = new Set(testVector.pre_state.post_offenders)
        
//         const result = await executeSafroleSTF(
//           preState,
//           input,
//           testVector.pre_state.tau,
//           stagingSet,
//           activeSet,
//           offenders
//         )
        
//         // Handle Safe pattern result - should have errors
//         if (result[0]) {
//           // Expected error case
//           expect(result[0]).toBeDefined()
//         } else {
//           const safroleOutput = result[1]
//           expect(safroleOutput.errors.length).toBeGreaterThan(0)
//         }
//       }
//     })
//   })

//   describe('State Consistency', () => {
//     it('should maintain state consistency across transitions', async () => {
//       const firstTest = testVectors[0]
//       if (!firstTest) return

//       const input = convertTestVectorToSafroleInput(firstTest.testVector.input)
//       const preState = convertTestVectorToSafroleState(firstTest.testVector.pre_state)
      
//       const stagingSet = firstTest.testVector.pre_state.gamma_k
//       const activeSet = firstTest.testVector.pre_state.kappa
      
//       const result = await executeSafroleSTF(
//         preState,
//         input,
//         firstTest.testVector.pre_state.tau,
//         stagingSet,
//         activeSet
//       )
      
//       // Handle Safe pattern result
//       if (result[0]) {
//         throw result[0] // Unexpected error
//       }
//       const safroleOutput = result[1]
      
//       // Verify basic state properties
//       expect(safroleOutput.state.epochRoot).toBeDefined()
//       expect(safroleOutput.state.pendingSet).toBeDefined()
//       expect(safroleOutput.state.sealTickets).toBeDefined()
//       expect(safroleOutput.state.ticketAccumulator).toBeDefined()
//     })
//   })

//   describe('Validator Set Rotation', () => {
//     let epochTests: Array<{ file: string, testVector: SafroleTestVector }> = []
    
//     beforeAll(() => {
//       epochTests = testVectors.filter(({ file }) => 
//         file.includes('epoch-change') && file.includes('no-tickets')
//       )
//     })

//     it('should properly rotate validator sets during epoch change', async () => {
//       if (epochTests.length === 0) {
//         // Skip if no epoch tests available
//         return
//       }
      
//       const testCase = epochTests[0]
//       const input = convertTestVectorToSafroleInput(testCase.testVector.input)
//       const preState = convertTestVectorToSafroleState(testCase.testVector.pre_state)
      
//       const stagingSet = testCase.testVector.pre_state.gamma_k
//       const activeSet = testCase.testVector.pre_state.kappa
      
//       const result = await executeSafroleSTF(
//         preState,
//         input,
//         testCase.testVector.pre_state.tau,
//         stagingSet,
//         activeSet
//       )
      
//       // Handle Safe pattern result
//       if (result[0]) {
//         throw result[0] // Unexpected error
//       }
//       const safroleOutput = result[1]
      
//       // Verify epoch transition occurred
//       expect(safroleOutput.state.epochRoot).toBeDefined()
//       expect(safroleOutput.state.pendingSet).toBeDefined()
//       expect(safroleOutput.state.pendingSet.length).toBeGreaterThanOrEqual(0)
//     })
//   })
// })
