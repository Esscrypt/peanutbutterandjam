// /**
//  * Unit Tests for State Service
//  * 
//  * Tests the convertToMapping method using real genesis.json data
//  */

// import { describe, expect, test, beforeEach } from 'vitest'
// import { readFileSync } from 'fs'
// import { join } from 'path'
// import type { GenesisJson } from '@pbnj/core'
// import { EventBusService, parseGenesisJson } from '@pbnj/core'
// import { StateService } from '../services/state-service'
// import { ConfigService } from '../services/config-service'
// import { TicketService } from '../services/ticket-service'
// import { NodeGenesisManager } from '../services/genesis-manager'
// import { EntropyService } from '../services/entropy'
// import { ValidatorSetManager } from '../services/validator-set'


// describe('StateService - convertToMapping', () => {
//   let stateService: StateService
//   let genesisData: GenesisJson
//   let mockConfigService: ConfigService

//   beforeEach(() => {
//     // Load the real genesis.json file
//     const genesisPath = join(
//       __dirname,
//       '../../../../submodules/jam-test-vectors/traces/safrole/genesis.json'
//     )
//     const genesisJsonString = readFileSync(genesisPath, 'utf-8')
//     const [parseResultError, parseResult] = parseGenesisJson(genesisJsonString)
//     if (parseResultError) {
//       throw new Error(`Failed to parse genesis.json: ${parseResultError.message}`)
//     }
    
//     genesisData = parseResult

//     const configService = new ConfigService('tiny')
//     const eventBusService = new EventBusService()
//     const genesisManagerService = new NodeGenesisManager(configService, {
//       eventBusService: eventBusService,
//       genesisJsonPath: genesisPath,
//     })
//     const entropyService = new EntropyService(eventBusService)
//     const ticketHolderService = new TicketService({
//       configService: configService,
//       eventBusService: eventBusService,
//       keyPairService: null,
//       entropyService: entropyService,
//       prover: null,
//     })
//     const validatorSetManager = new ValidatorSetManager({
//       eventBusService: eventBusService,
//       sealKeyService: null,
//       keyPairService: null,
//       ringProver: null,
//       ticketService: ticketHolderService,
//       configService: configService,
//       initialValidators: null,
//     })
//     stateService = new StateService({
//       genesisManagerService: genesisManagerService,
//       entropyService: entropyService,
//       ticketHolderService: ticketHolderService,
//       configService: configService,
//       validatorSetManager: validatorSetManager,
//       authQueueService: null,
//       authPoolService: null,
//       activityService: null,
//       disputesService: null,
//       readyService: null,
//       accumulatedService: null,
//       lastAccoutService: null,
//       workReportService: null,
//     })
//   })

//   test('should parse genesis.json keyvals correctly', () => {
//     // Test that the service can be created with genesis data
//     expect(stateService).toBeDefined()
    
//     // Get the current state mapping
//     const stateMapping = stateService.getState()
//     expect(stateMapping).toBeDefined()
    
//     // Verify all 17 state components are present
//     const expectedComponents = [
//       'authpool',
//       'recent', 
//       'lastaccout',
//       'safrole',
//       'accounts',
//       'entropy',
//       'stagingset',
//       'activeset',
//       'previousset',
//       'reports',
//       'thetime',
//       'authqueue',
//       'privileges',
//       'disputes',
//       'activity',
//       'ready',
//       'accumulated'
//     ]
    
//     for (const component of expectedComponents) {
//       expect(stateMapping.has(component as any)).toBe(true)
//     }
//   })

//   test('should parse state keys according to Gray Paper specifications', () => {
//     // Test parsing of different state key types
//     const testKeys = [
//       {
//         key: '0x01000000000000000000000000000000000000000000000000000000000000',
//         expectedChapterIndex: 1,
//         description: 'Chapter 1 - Recent'
//       },
//       {
//         key: '0x02000000000000000000000000000000000000000000000000000000000000',
//         expectedChapterIndex: 2,
//         description: 'Chapter 2 - LastAccout'
//       },
//       {
//         key: '0x03000000000000000000000000000000000000000000000000000000000000',
//         expectedChapterIndex: 3,
//         description: 'Chapter 3 - Safrole'
//       },
//       {
//         key: '0x04000000000000000000000000000000000000000000000000000000000000',
//         expectedChapterIndex: 4,
//         description: 'Chapter 4 - Accounts'
//       },
//       {
//         key: '0x05000000000000000000000000000000000000000000000000000000000000',
//         expectedChapterIndex: 5,
//         description: 'Chapter 5 - Entropy'
//       },
//       {
//         key: '0x06000000000000000000000000000000000000000000000000000000000000',
//         expectedChapterIndex: 6,
//         description: 'Chapter 6 - StagingSet'
//       },
//       {
//         key: '0x07000000000000000000000000000000000000000000000000000000000000',
//         expectedChapterIndex: 7,
//         description: 'Chapter 7 - ActiveSet'
//       },
//       {
//         key: '0x08000000000000000000000000000000000000000000000000000000000000',
//         expectedChapterIndex: 8,
//         description: 'Chapter 8 - PreviousSet'
//       },
//       {
//         key: '0x09000000000000000000000000000000000000000000000000000000000000',
//         expectedChapterIndex: 9,
//         description: 'Chapter 9 - Reports'
//       },
//       {
//         key: '0x0a000000000000000000000000000000000000000000000000000000000000',
//         expectedChapterIndex: 10,
//         description: 'Chapter 10 - TheTime'
//       },
//       {
//         key: '0x0b000000000000000000000000000000000000000000000000000000000000',
//         expectedChapterIndex: 11,
//         description: 'Chapter 11 - AuthQueue'
//       },
//       {
//         key: '0x0c000000000000000000000000000000000000000000000000000000000000',
//         expectedChapterIndex: 12,
//         description: 'Chapter 12 - Privileges'
//       },
//       {
//         key: '0x0d000000000000000000000000000000000000000000000000000000000000',
//         expectedChapterIndex: 13,
//         description: 'Chapter 13 - Disputes'
//       },
//       {
//         key: '0x0e000000000000000000000000000000000000000000000000000000000000',
//         expectedChapterIndex: 14,
//         description: 'Chapter 14 - Activity'
//       },
//       {
//         key: '0x0f000000000000000000000000000000000000000000000000000000000000',
//         expectedChapterIndex: 15,
//         description: 'Chapter 15 - Ready'
//       },
//       {
//         key: '0x10000000000000000000000000000000000000000000000000000000000000',
//         expectedChapterIndex: 16,
//         description: 'Chapter 16 - Accumulated'
//       }
//     ]

//     for (const testCase of testKeys) {
//       // Use reflection to access the private parseStateKey method
//       const parseStateKey = (stateService as any).parseStateKey.bind(stateService)
//       const [error, result] = parseStateKey(testCase.key)
      
//       expect(error).toBeUndefined()
//       expect(result).toBeDefined()
//       expect(result?.chapterIndex).toBe(testCase.expectedChapterIndex)
//     }
//   })

//   test('should handle service account keys (Chapter 255)', () => {
//     // Test service account key parsing
//     const serviceAccountKey = '0xff010000000000000000000000000000000000000000000000000000000000'
    
//     // Use reflection to access the private parseStateKey method
//     const parseStateKey = (stateService as any).parseStateKey.bind(stateService)
//     const [error, result] = parseStateKey(serviceAccountKey)
    
//     expect(error).toBeUndefined()
//     expect(result).toBeDefined()
//     expect(result?.chapterIndex).toBe(255)
//     expect(result?.metadata?.serviceId).toBeDefined()
//   })

//   test('should handle invalid state keys gracefully', () => {
//     const invalidKeys = [
//       '0x1234', // Too short
//       '0x' + '1'.repeat(100), // Too long
//       'invalid_hex', // Not hex
//       '0xgggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggg' // Invalid hex chars
//     ]

//     for (const invalidKey of invalidKeys) {
//       // Use reflection to access the private parseStateKey method
//       const parseStateKey = (stateService as any).parseStateKey.bind(stateService)
//       const [error, result] = parseStateKey(invalidKey)
      
//       expect(error).toBeDefined()
//       expect(result).toBeUndefined()
//     }
//   })

//   test('should parse state values correctly', () => {
//     const testValues = [
//       {
//         chapterIndex: 5, // entropy
//         value: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
//         expectedType: 'string'
//       },
//       {
//         chapterIndex: 2, // lastaccout
//         value: '0x0000000000000000000000000000000000000000000000000000000000000001',
//         expectedType: 'bigint'
//       }
//     ]

//     for (const testCase of testValues) {
//       // Use reflection to access the private parseStateValue method
//       const parseStateValue = (stateService as any).parseStateValue.bind(stateService)
//       const result = parseStateValue(testCase.chapterIndex, testCase.value)
      
//       expect(result).toBeDefined()
//       expect(typeof result).toBe(testCase.expectedType)
//     }
//   })

//   test('should handle genesis.json with real keyvals data', () => {
//     // Test with actual genesis.json data
//     expect(genesisData.state.keyvals.length).toBeGreaterThan(0)
    
//     // Verify that the state service can process all keyvals
//     const stateMapping = stateService.getState()
    
//     // Check that we have all 17 state components (even if parsing fails, defaults should be present)
//     expect(stateMapping.size).toBe(17) // All 17 state components
    
//     // Verify specific components exist (they may have default values if parsing failed)
//     expect(stateMapping.has('entropy')).toBe(true)
//     expect(stateMapping.has('accounts')).toBe(true)
//     expect(stateMapping.has('stagingset')).toBe(true)
//   })

//   test('should maintain state consistency after parsing', () => {
//     const stateMapping = stateService.getState()
    
//     // Verify that all state components have valid default values
//     for (const [component, value] of stateMapping) {
//       expect(value).toBeDefined()
      
//       // Check specific types
//       switch (component) {
//         case 'lastaccout':
//           expect(typeof value).toBe('bigint')
//           break
//         case 'entropy':
//           expect(typeof value).toBe('string')
//           expect((value as string).startsWith('0x')).toBe(true)
//           break
//         case 'accounts':
//         case 'privileges':
//           expect(value).toBeInstanceOf(Map)
//           break
//         case 'stagingset':
//         case 'activeset':
//         case 'previousset':
//         case 'reports':
//         case 'authqueue':
//         case 'disputes':
//         case 'ready':
//           expect(Array.isArray(value)).toBe(true)
//           break
//         case 'authpool':
//         case 'recent':
//         case 'safrole':
//         case 'thetime':
//         case 'activity':
//         case 'accumulated':
//           expect(typeof value).toBe('object')
//           expect(value).not.toBeNull()
//           break
//       }
//     }
//   })

//   test('should handle empty keyvals gracefully', () => {
//     // Create a state service with empty keyvals
//     const emptyState = {
//       state_root: '0x0000000000000000000000000000000000000000000000000000000000000000',
//       keyvals: []
//     }
    
//     const emptyStateService = new StateService(emptyState, mockConfigService)
//     const stateMapping = emptyStateService.getState()
    
//     // Should still have all 17 components with default values
//     expect(stateMapping.size).toBe(17)
    
//     // All values should be default/empty
//     for (const [component, value] of stateMapping) {
//       expect(value).toBeDefined()
      
//       // Check that we get appropriate default values
//       if (component === 'lastaccout') {
//         expect(value).toBe(0n)
//       } else if (component === 'entropy') {
//         expect(value).toBe('0x0000000000000000000000000000000000000000000000000000000000000000')
//       }
//     }
//   })

//   test('should validate Gray Paper compliance', () => {
//     // Test that our implementation follows Gray Paper state key specifications
//     const stateMapping = stateService.getState()
    
//     // Verify we have exactly 17 state components as per Gray Paper equation (34)
//     expect(stateMapping.size).toBe(17)
    
//     // Verify component names match Gray Paper specification
//     const grayPaperComponents = [
//       'authpool', 'recent', 'lastaccout', 'safrole', 'accounts', 'entropy',
//       'stagingset', 'activeset', 'previousset', 'reports', 'thetime',
//       'authqueue', 'privileges', 'disputes', 'activity', 'ready', 'accumulated'
//     ]
    
//     for (const component of grayPaperComponents) {
//       expect(stateMapping.has(component as any)).toBe(true)
//     }
//   })
// })
