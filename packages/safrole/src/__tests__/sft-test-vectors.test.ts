// /**
//  * SFT (State Transition Function) Test Vector Validation Tests
//  *
//  * Tests the Safrole State Transition Function against official JAM test vectors
//  * from submodules/jamtestvectors/stf/safrole/tiny/
//  * 
//  * This test suite validates that validateInput returns the correct SafeError
//  * with the proper error string as specified in the Gray Paper.
//  */

// import { logger } from '@pbnjam/core'
// import { readFileSync, readdirSync } from 'fs'
// import { join } from 'path'
// import { beforeAll, describe, expect, it } from 'vitest'
// import { executeSafroleSTF } from '../state-transitions'
// import type { SafroleInput, SafroleState, ValidatorPublicKeys } from '@pbnjam/types'

// beforeAll(() => {
//   logger.init()
// })

// interface SFTTestInput {
//   slot: number
//   entropy: string
//   extrinsic: Array<{
//     attempt: number
//     signature: string
//   }>
// }

// interface SFTTestPreState {
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

// interface SFTTestPostState {
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

// interface SFTTestOutput {
//   ok?: {
//     epoch_mark: any
//     tickets_mark: any
//   }
//   err?: string
// }

// interface SFTTestVector {
//   input: SFTTestInput
//   pre_state: SFTTestPreState
//   output: SFTTestOutput
//   post_state: SFTTestPostState
// }

// function loadSFTTestVectors(directory: string): Array<{ file: string, testVector: SFTTestVector }> {
//   const testVectors: Array<{ file: string, testVector: SFTTestVector }> = []
  
//   try {
//     const files = readdirSync(directory)
//     const jsonFiles = files.filter(file => file.endsWith('.json'))
    
//     for (const file of jsonFiles) {
//       const filePath = join(directory, file)
//       const content = readFileSync(filePath, 'utf-8')
//       const testVector = JSON.parse(content) as SFTTestVector
//       testVectors.push({ file, testVector })
//     }
//   } catch (error) {
//     logger.error('Failed to load SFT test vectors', { error, directory })
//   }
  
//   return testVectors
// }

// function convertSFTTestVectorToSafroleInput(testInput: SFTTestInput): SafroleInput {
//   return {
//     slot: BigInt(testInput.slot),
//     entropy: testInput.entropy as `0x${string}`,
//     extrinsic: testInput.extrinsic.map(ext => ({
//       entryIndex: BigInt(ext.attempt),
//       signature: ext.signature as `0x${string}`,
//     }))
//   }
// }

// function convertSFTTestVectorToSafroleState(testState: SFTTestPreState): SafroleState {
//   return {
//     pendingSet: testState.lambda,
//     epochRoot: testState.eta[0] as `0x${string}` || '0x0000000000000000000000000000000000000000000000000000000000000000',
//     sealTickets: [], // Convert gamma_s to Ticket[] format
//     ticketAccumulator: testState.gamma_a || [], // Ticket accumulator from test vector
//   }
// }

// describe('SFT Test Vectors - Error Cases', () => {
//   let testVectors: Array<{ file: string, testVector: SFTTestVector }> = []

//   beforeAll(() => {
//     const testVectorPath = join(process.cwd(), '../../submodules/jamtestvectors/stf/safrole/tiny')
//     testVectors = loadSFTTestVectors(testVectorPath)
//     logger.info(`Loaded ${testVectors.length} SFT test vectors`)
//   })

//   it('should load test vectors successfully', () => {
//     expect(testVectors).toBeDefined()
//     expect(testVectors.length).toBeGreaterThan(0)
//   })

//   describe('bad_slot error cases', () => {
//     let badSlotTests: Array<{ file: string, testVector: SFTTestVector }> = []
    
//     beforeAll(() => {
//       badSlotTests = testVectors.filter(({ testVector }) => 
//         testVector.output.err === 'bad_slot'
//       )
//     })

//     it('should handle bad_slot error cases', async () => {
//       expect(badSlotTests.length).toBeGreaterThan(0)
      
//       for (const { file, testVector } of badSlotTests) {
//         const input = convertSFTTestVectorToSafroleInput(testVector.input)
//         const preState = convertSFTTestVectorToSafroleState(testVector.pre_state)
        
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
        
//         // Should return SafeError with bad_slot
//         expect(result[0]).toBeDefined()
//         expect(result[0]?.message).toBe('bad_slot')
        
//         logger.info(`✅ ${file}: bad_slot error correctly returned`)
//       }
//     })
//   })

//   describe('bad_ticket_attempt error cases', () => {
//     let badTicketAttemptTests: Array<{ file: string, testVector: SFTTestVector }> = []
    
//     beforeAll(() => {
//       badTicketAttemptTests = testVectors.filter(({ testVector }) => 
//         testVector.output.err === 'bad_ticket_attempt'
//       )
//     })

//     it('should handle bad_ticket_attempt error cases', async () => {
//       expect(badTicketAttemptTests.length).toBeGreaterThan(0)
      
//       for (const { file, testVector } of badTicketAttemptTests) {
//         const input = convertSFTTestVectorToSafroleInput(testVector.input)
//         const preState = convertSFTTestVectorToSafroleState(testVector.pre_state)
        
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
        
//         // Should return SafeError with bad_ticket_attempt
//         expect(result[0]).toBeDefined()
//         expect(result[0]?.message).toBe('bad_ticket_attempt')
        
//         logger.info(`✅ ${file}: bad_ticket_attempt error correctly returned`)
//       }
//     })
//   })

//   describe('duplicate_ticket error cases', () => {
//     let duplicateTicketTests: Array<{ file: string, testVector: SFTTestVector }> = []
    
//     beforeAll(() => {
//       duplicateTicketTests = testVectors.filter(({ testVector }) => 
//         testVector.output.err === 'duplicate_ticket'
//       )
//     })

//     it('should handle duplicate_ticket error cases', async () => {
//       expect(duplicateTicketTests.length).toBeGreaterThan(0)
      
//       for (const { file, testVector } of duplicateTicketTests) {
//         const input = convertSFTTestVectorToSafroleInput(testVector.input)
//         const preState = convertSFTTestVectorToSafroleState(testVector.pre_state)
        
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
        
//         // Should return SafeError with duplicate_ticket
//         expect(result[0]).toBeDefined()
//         expect(result[0]?.message).toBe('duplicate_ticket')
        
//         logger.info(`✅ ${file}: duplicate_ticket error correctly returned`)
//       }
//     })
//   })

//   describe('bad_ticket_order error cases', () => {
//     let badTicketOrderTests: Array<{ file: string, testVector: SFTTestVector }> = []
    
//     beforeAll(() => {
//       badTicketOrderTests = testVectors.filter(({ testVector }) => 
//         testVector.output.err === 'bad_ticket_order'
//       )
//     })

//     it('should handle bad_ticket_order error cases', async () => {
//       expect(badTicketOrderTests.length).toBeGreaterThan(0)
      
//       for (const { file, testVector } of badTicketOrderTests) {
//         const input = convertSFTTestVectorToSafroleInput(testVector.input)
//         const preState = convertSFTTestVectorToSafroleState(testVector.pre_state)
        
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
        
//         // Should return SafeError with bad_ticket_order
//         expect(result[0]).toBeDefined()
//         expect(result[0]?.message).toBe('bad_ticket_order')
        
//         logger.info(`✅ ${file}: bad_ticket_order error correctly returned`)
//       }
//     })
//   })

//   describe('bad_ticket_proof error cases', () => {
//     let badTicketProofTests: Array<{ file: string, testVector: SFTTestVector }> = []
    
//     beforeAll(() => {
//       badTicketProofTests = testVectors.filter(({ testVector }) => 
//         testVector.output.err === 'bad_ticket_proof'
//       )
//     })

//     it('should handle bad_ticket_proof error cases', async () => {
//       expect(badTicketProofTests.length).toBeGreaterThan(0)
      
//       for (const { file, testVector } of badTicketProofTests) {
//         const input = convertSFTTestVectorToSafroleInput(testVector.input)
//         const preState = convertSFTTestVectorToSafroleState(testVector.pre_state)
        
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
        
//         // Should return SafeError with bad_ticket_proof
//         expect(result[0]).toBeDefined()
//         expect(result[0]?.message).toBe('bad_ticket_proof')
        
//         logger.info(`✅ ${file}: bad_ticket_proof error correctly returned`)
//       }
//     })
//   })

//   describe('unexpected_ticket error cases', () => {
//     let unexpectedTicketTests: Array<{ file: string, testVector: SFTTestVector }> = []
    
//     beforeAll(() => {
//       unexpectedTicketTests = testVectors.filter(({ testVector }) => 
//         testVector.output.err === 'unexpected_ticket'
//       )
//     })

//     it('should handle unexpected_ticket error cases', async () => {
//       expect(unexpectedTicketTests.length).toBeGreaterThan(0)
      
//       for (const { file, testVector } of unexpectedTicketTests) {
//         const input = convertSFTTestVectorToSafroleInput(testVector.input)
//         const preState = convertSFTTestVectorToSafroleState(testVector.pre_state)
        
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
        
//         // Should return SafeError with unexpected_ticket
//         expect(result[0]).toBeDefined()
//         expect(result[0]?.message).toBe('unexpected_ticket')
        
//         logger.info(`✅ ${file}: unexpected_ticket error correctly returned`)
//       }
//     })
//   })
// })

// describe('SFT Test Vectors - Success Cases', () => {
//   let testVectors: Array<{ file: string, testVector: SFTTestVector }> = []

//   beforeAll(() => {
//     const testVectorPath = join(process.cwd(), '../../submodules/jamtestvectors/stf/safrole/tiny')
//     testVectors = loadSFTTestVectors(testVectorPath)
//   })

//   describe('successful epoch change cases', () => {
//     let epochChangeTests: Array<{ file: string, testVector: SFTTestVector }> = []
    
//     beforeAll(() => {
//       epochChangeTests = testVectors.filter(({ file, testVector }) => 
//         file.includes('epoch-change') && testVector.output.ok
//       )
//     })

//     it('should handle successful epoch change cases', async () => {
//       expect(epochChangeTests.length).toBeGreaterThan(0)
      
//       for (const { file, testVector } of epochChangeTests) {
//         const input = convertSFTTestVectorToSafroleInput(testVector.input)
//         const preState = convertSFTTestVectorToSafroleState(testVector.pre_state)
        
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
        
//         // Should succeed without errors
//         expect(result[0]).toBeUndefined()
//         expect(result[1]).toBeDefined()
        
//         const safroleOutput = result[1]
//         expect(safroleOutput?.errors).toHaveLength(0)
        
//         logger.info(`✅ ${file}: epoch change succeeded`)
//       }
//     })
//   })

//   describe('successful ticket publishing cases', () => {
//     let ticketPublishTests: Array<{ file: string, testVector: SFTTestVector }> = []
    
//     beforeAll(() => {
//       ticketPublishTests = testVectors.filter(({ file, testVector }) => 
//         file.includes('publish-tickets') && testVector.output.ok
//       )
//     })

//     it('should handle successful ticket publishing cases', async () => {
//       expect(ticketPublishTests.length).toBeGreaterThan(0)
      
//       for (const { file, testVector } of ticketPublishTests) {
//         const input = convertSFTTestVectorToSafroleInput(testVector.input)
//         const preState = convertSFTTestVectorToSafroleState(testVector.pre_state)
        
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
        
//         // Should succeed without errors
//         expect(result[0]).toBeUndefined()
//         expect(result[1]).toBeDefined()
        
//         const safroleOutput = result[1]!
//         expect(safroleOutput.errors).toHaveLength(0)
        
//         logger.info(`✅ ${file}: ticket publishing succeeded`)
//       }
//     })
//   })

//   describe('successful skip epoch cases', () => {
//     let skipEpochTests: Array<{ file: string, testVector: SFTTestVector }> = []
    
//     beforeAll(() => {
//       skipEpochTests = testVectors.filter(({ file, testVector }) => 
//         file.includes('skip-epoch') && testVector.output.ok
//       )
//     })

//     it('should handle successful skip epoch cases', async () => {
//       expect(skipEpochTests.length).toBeGreaterThan(0)
      
//       for (const { file, testVector } of skipEpochTests) {
//         const input = convertSFTTestVectorToSafroleInput(testVector.input)
//         const preState = convertSFTTestVectorToSafroleState(testVector.pre_state)
        
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
        
//         // Should succeed without errors
//         expect(result[0]).toBeUndefined()
//         expect(result[1]).toBeDefined()
        
//         const safroleOutput = result[1]!
//         expect(safroleOutput.errors).toHaveLength(0)
        
//         logger.info(`✅ ${file}: skip epoch succeeded`)
//       }
//     })
//   })
// })

// describe('SFT Test Vectors - Comprehensive Validation', () => {
//   let testVectors: Array<{ file: string, testVector: SFTTestVector }> = []

//   beforeAll(() => {
//     const testVectorPath = join(process.cwd(), '../../submodules/jamtestvectors/stf/safrole/tiny')
//     testVectors = loadSFTTestVectors(testVectorPath)
//   })

//   it('should validate all test vectors against expected outputs', async () => {
//     let successCount = 0
//     let errorCount = 0
    
//     for (const { file, testVector } of testVectors) {
//       try {
//         const input = convertSFTTestVectorToSafroleInput(testVector.input)
//         const preState = convertSFTTestVectorToSafroleState(testVector.pre_state)
        
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
        
//         if (testVector.output.err) {
//           // Expected error case
//           expect(result[0]).toBeDefined()
//           expect(result[0]?.message).toBe(testVector.output.err)
//           errorCount++
//           logger.info(`✅ ${file}: Expected error '${testVector.output.err}' correctly returned`)
//         } else {
//           // Expected success case
//           expect(result[0]).toBeUndefined()
//           expect(result[1]).toBeDefined()
//           const safroleOutput = result[1]!
//           expect(safroleOutput?.errors).toHaveLength(0)
//           successCount++
//           logger.info(`✅ ${file}: Success case correctly handled`)
//         }
//       } catch (error) {
//         logger.error(`❌ ${file}: Test failed with unexpected error`, { error })
//         throw error
//       }
//     }
    
//     logger.info(`SFT Test Vector Summary: ${successCount} success cases, ${errorCount} error cases`)
//     expect(successCount + errorCount).toBe(testVectors.length)
//   })
// })
