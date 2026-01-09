/**
 * Genesis Parse Test
 *
 * Tests parsing of genesis.json files from test vectors using NodeGenesisManager
 */

import { describe, it, expect } from 'bun:test'
import * as path from 'node:path'
import { readFileSync } from 'node:fs'
import { NodeGenesisManager } from '../../services/genesis-manager'
import { ConfigService } from '../../services/config-service'
import {
  bytesToHex,
  Hex,
  hexToBytes,
} from '@pbnjam/core'
import type { SafroleState } from '@pbnjam/types'
import {
  type BlockTraceTestVector,
} from '@pbnjam/types'
import {
  convertJsonBlockToBlock,
  getStartBlock,
  initializeServices,
} from '../test-utils'

// Test vectors directory (relative to workspace root)
const WORKSPACE_ROOT = path.join(__dirname, '../../../../')


describe('Genesis Parse Tests', () => {
  const configService = new ConfigService('tiny')

  describe('Fallback Genesis', () => {
    it('should parse genesis.json from traces/fallback', async () => {
      const genesisJsonPath = path.join(
        WORKSPACE_ROOT,
        'submodules/jam-test-vectors/traces/fallback/genesis.json',
      )

      const genesisManager = new NodeGenesisManager(configService, {
        genesisJsonPath,
      })

      // Verify genesis JSON was loaded
      const [error, genesisJson] = genesisManager.getGenesisJson()
      expect(error).toBeUndefined()
      expect(genesisJson).toBeDefined()

      if (!genesisJson) {
        throw new Error('Genesis JSON not loaded')
      }

      // Extract validators from genesis.json header
      const initialValidators = (genesisJson.header?.epoch_mark?.validators || []).map((validator) => ({
        bandersnatch: validator.bandersnatch,
        ed25519: validator.ed25519,
        bls: bytesToHex(new Uint8Array(144)), // Gray Paper: BLS key must be 144 bytes
        metadata: bytesToHex(new Uint8Array(128)),
      }))

      // Initialize services using shared utility
      const services = await initializeServices('tiny', 'fallback', genesisManager, initialValidators)
      const { stateService, blockImporterService } = services

      // Helper function to parse state key using state service
      const parseStateKeyForDebug = (keyHex: Hex): { error?: string; type?: string; chapterIndex?: number; serviceId?: bigint } => {
        const [error, parsedKey] = stateService.parseStateKey(keyHex)
        if (error) {
          return { error: error.message }
        }
        if (!parsedKey) {
          return { error: 'Parsed key is null' }
        }
        // Add type information for better debugging
        if ('chapterIndex' in parsedKey) {
          if (parsedKey.chapterIndex === 255 && 'serviceId' in parsedKey) {
            return { ...parsedKey, type: 'C(255, s)' }
          }
          if (parsedKey.chapterIndex === 0 && 'serviceId' in parsedKey) {
            return { ...parsedKey, type: 'C(s, h)' }
          }
          return { ...parsedKey, type: 'C(i)' }
        }
        return parsedKey
      }

      // Helper function to get chapter name
      const getChapterName = (chapterIndex: number): string => {
        const chapterNames: Record<number, string> = {
          1: 'authpool (α)',
          2: 'authqueue (φ)',
          3: 'recent (β)',
          4: 'safrole (γ)',
          5: 'disputes (ψ)',
          6: 'entropy (ε)',
          7: 'stagingset (ι)',
          8: 'activeset (κ)',
          9: 'previousset (λ)',
          10: 'reports (ρ)',
          11: 'thetime (τ)',
          12: 'privileges',
          13: 'activity (π)',
          14: 'ready (ω)',
          15: 'accumulated (ξ)',
          16: 'lastaccout (θ)',
          255: 'service accounts',
        }
        return chapterNames[chapterIndex] || `unknown (${chapterIndex})`
      }

      // Helper function to verify post-state
      const verifyPostState = (blockNumber: number, blockJsonData: BlockTraceTestVector) => {
        const [stateTrieError, stateTrie] = stateService.generateStateTrie()
        expect(stateTrieError).toBeUndefined()
        expect(stateTrie).toBeDefined()

        // Extract and print safrole state (chapter 4) - pendingSet and epochRoot only
        const safroleChapterIndex = 4
        const actualSafrole = stateService.getStateComponent(safroleChapterIndex)
        let expectedSafrole: any = null
        
        // Find safrole key in post_state
        for (const keyval of blockJsonData.post_state.keyvals) {
          const keyInfo = parseStateKeyForDebug(keyval.key as Hex)
          if ('chapterIndex' in keyInfo && keyInfo.chapterIndex === safroleChapterIndex) {
            const decoder = (stateService as any).stateTypeRegistry?.get(safroleChapterIndex)
            if (decoder) {
              const expectedBytes = hexToBytes(keyval.value as Hex)
              const [decodeError, decoded] = decoder(expectedBytes)
              if (!decodeError && decoded) {
                expectedSafrole = decoded.value
              }
            }
            break
          }
        }
        
        // Print full safrole state comparison
        console.log(`\n=== [Block ${blockNumber}] Safrole State (Full Comparison) ===`)
        if (expectedSafrole) {
          console.log('Expected pendingSet:', JSON.stringify(
            (expectedSafrole as any).pendingSet?.map((v: any) => ({
              bandersnatch: v.bandersnatch,
              ed25519: v.ed25519,
            })),
            null,
            2
          ))
          console.log('Expected epochRoot:', (expectedSafrole as SafroleState).epochRoot)
          console.log('Expected discriminator:', (expectedSafrole as any).discriminator ?? 'N/A')
          console.log('Expected sealTickets length:', (expectedSafrole as SafroleState).sealTickets?.length ?? 0)
          console.log('Expected ticketAccumulator length:', (expectedSafrole as SafroleState).ticketAccumulator?.length ?? 0)
        } else {
          console.log('Expected safrole: Not found in post_state')
        }
        
        if (actualSafrole && typeof actualSafrole === 'object' && !('error' in actualSafrole)) {
          console.log('Actual pendingSet:', JSON.stringify(
            (actualSafrole as SafroleState).pendingSet?.map((v: any) => ({
              bandersnatch: v.bandersnatch,
              ed25519: v.ed25519,
            })),
            null,
            2
          ))
          console.log('Actual epochRoot:', (actualSafrole as SafroleState).epochRoot)
          // Compute discriminator from sealTickets
          const hasTickets = (actualSafrole as SafroleState).sealTickets?.every((ticket) => 
            typeof ticket === 'object' && 'id' in ticket
          ) ?? false
          console.log('Actual discriminator:', hasTickets ? 0 : 1)
          console.log('Actual sealTickets length:', (actualSafrole as SafroleState).sealTickets?.length ?? 0)
          console.log('Actual ticketAccumulator length:', (actualSafrole as SafroleState).ticketAccumulator?.length ?? 0)
          
          // Compare sealTickets if lengths match
          if (expectedSafrole && 
              (expectedSafrole as SafroleState).sealTickets?.length === (actualSafrole as SafroleState).sealTickets?.length) {
            const expectedSealTickets = (expectedSafrole as SafroleState).sealTickets
            const actualSealTickets = (actualSafrole as SafroleState).sealTickets
            let sealTicketsMatch = true
            for (let i = 0; i < (expectedSealTickets?.length ?? 0); i++) {
              const expected = expectedSealTickets![i]
              const actual = actualSealTickets![i]
              if (typeof expected === 'object' && 'id' in expected && typeof actual === 'object' && 'id' in actual) {
                if (expected.id !== actual.id || expected.entryIndex !== actual.entryIndex) {
                  sealTicketsMatch = false
                  console.log(`  sealTickets[${i}] mismatch: expected id=${expected.id}, entryIndex=${expected.entryIndex}, actual id=${actual.id}, entryIndex=${actual.entryIndex}`)
                }
              } else if (expected instanceof Uint8Array && actual instanceof Uint8Array) {
                const expectedHex = bytesToHex(expected)
                const actualHex = bytesToHex(actual)
                if (expectedHex !== actualHex) {
                  sealTicketsMatch = false
                  console.log(`  sealTickets[${i}] mismatch: expected=${expectedHex}, actual=${actualHex}`)
                }
              } else {
                sealTicketsMatch = false
                console.log(`  sealTickets[${i}] type mismatch: expected type=${typeof expected}, actual type=${typeof actual}`)
              }
            }
            if (sealTicketsMatch) {
              console.log('  sealTickets: MATCH')
            }
          }
          
          // Compare ticketAccumulator
          if (expectedSafrole && 
              (expectedSafrole as SafroleState).ticketAccumulator?.length === (actualSafrole as SafroleState).ticketAccumulator?.length) {
            const expectedAccum = (expectedSafrole as SafroleState).ticketAccumulator
            const actualAccum = (actualSafrole as SafroleState).ticketAccumulator
            let accumMatch = true
            for (let i = 0; i < (expectedAccum?.length ?? 0); i++) {
              const expected = expectedAccum![i]
              const actual = actualAccum![i]
              if (expected.id !== actual.id || expected.entryIndex !== actual.entryIndex) {
                accumMatch = false
                console.log(`  ticketAccumulator[${i}] mismatch: expected id=${expected.id}, entryIndex=${expected.entryIndex}, actual id=${actual.id}, entryIndex=${actual.entryIndex}`)
              }
            }
            if (accumMatch) {
              console.log('  ticketAccumulator: MATCH')
            }
          }
        } else {
          console.log('Actual safrole:', actualSafrole)
        }
        console.log('==========================================\n')

        // Track which keys are checked vs missing
        let checkedKeys = 0
        let missingKeys = 0

        for (const keyval of blockJsonData.post_state.keyvals) {
          const expectedValue = stateTrie?.[keyval.key]
          
          // Check if key exists in generated state trie
          if (expectedValue === undefined) {
            // Key is missing from generated state trie - this is a failure
            missingKeys++
            const keyInfo = parseStateKeyForDebug(keyval.key as Hex)
            
            console.error(`\n❌ [Block ${blockNumber}] Missing State Key Detected:`)
            console.error('=====================================')
            console.error(`State Key: ${keyval.key}`)
            if ('chapterIndex' in keyInfo && !keyInfo.error && keyInfo.chapterIndex !== undefined) {
              console.error(`Chapter: ${keyInfo.chapterIndex} - ${getChapterName(keyInfo.chapterIndex)}`)
              console.error(`Key Type: ${keyInfo.type}`)
              if ('serviceId' in keyInfo) {
                console.error(`Service ID: ${keyInfo.serviceId}`)
              }
            } else if ('serviceId' in keyInfo && !keyInfo.error) {
              console.error(`Service ID: ${keyInfo.serviceId}`)
              console.error(`Key Type: ${keyInfo.type}`)
              if ('hash' in keyInfo && typeof keyInfo.hash === 'string') {
                console.error(`Hash: ${keyInfo.hash}`)
              }
            } else {
              console.error(`Key Info: ${JSON.stringify(keyInfo)}`)
            }
            console.error(`Expected Value: ${keyval.value}`)
            console.error(`Actual Value: undefined (key not found in state trie)`)
            console.error('=====================================\n')
            
            // Fail the test - key should exist
            expect(expectedValue).toBeDefined()
            continue
          }

          // Key exists - check if value matches
          checkedKeys++
          if (keyval.value !== expectedValue) {
            // Parse the state key to get chapter information
            const keyInfo = parseStateKeyForDebug(keyval.key as Hex)
            let decodedExpected: any = null
            let decodedActual: any = null

            // Try to decode both expected and actual values if it's a chapter key
            if ('chapterIndex' in keyInfo && !keyInfo.error && keyInfo.chapterIndex !== undefined) {
              const chapterIndex = keyInfo.chapterIndex
              try {
                // Decode expected value from test vector using the same decoder as StateService
                const expectedBytes = hexToBytes(keyval.value as Hex)
                // Access private stateTypeRegistry to get the decoder
                const decoder = (stateService as any).stateTypeRegistry?.get(chapterIndex)
                if (decoder) {
                  const [decodeError, decoded] = decoder(expectedBytes)
                  if (!decodeError && decoded) {
                    decodedExpected = decoded.value
                  } else {
                    decodedExpected = { 
                      error: decodeError?.message || 'Decode failed',
                      decodeError: decodeError ? String(decodeError) : undefined
                    }
                  }
                } else {
                  decodedExpected = { error: `No decoder found for chapter ${chapterIndex}` }
                }

                // Get decoded actual state component
                decodedActual = stateService.getStateComponent(
                  chapterIndex,
                  'serviceId' in keyInfo ? keyInfo.serviceId : undefined,
                )
              } catch (error) {
                decodedExpected = decodedExpected || { 
                  error: error instanceof Error ? error.message : String(error),
                  stack: error instanceof Error ? error.stack : undefined
                }
                decodedActual = decodedActual || { 
                  error: error instanceof Error ? error.message : String(error),
                  stack: error instanceof Error ? error.stack : undefined
                }
              }
            }

            // Log detailed mismatch information
            console.error(`\n❌ [Block ${blockNumber}] State Value Mismatch Detected:`)
            console.error('=====================================')
            console.error(`State Key: ${keyval.key}`)
            if ('chapterIndex' in keyInfo && !keyInfo.error && keyInfo.chapterIndex !== undefined) {
              console.error(`Chapter: ${keyInfo.chapterIndex} - ${getChapterName(keyInfo.chapterIndex)}`)
              console.error(`Key Type: ${keyInfo.type}`)
              if ('serviceId' in keyInfo) {
                console.error(`Service ID: ${keyInfo.serviceId}`)
              }
            } else if ('serviceId' in keyInfo && !keyInfo.error) {
              console.error(`Service ID: ${keyInfo.serviceId}`)
              console.error(`Key Type: ${keyInfo.type}`)
              if ('hash' in keyInfo && typeof keyInfo.hash === 'string') {
                console.error(`Hash: ${keyInfo.hash}`)
              }
            } else {
              console.error(`Key Info: ${JSON.stringify(keyInfo)}`)
            }
            console.error(`Expected Value (hex): ${keyval.value}`)
            console.error(`Actual Value (hex): ${expectedValue}`)
            if (decodedExpected) {
              console.error(`\nDecoded Expected Value:`, JSON.stringify(decodedExpected, (_, v) =>
                typeof v === 'bigint' ? v.toString() : v === undefined ? null : v,
                2))
            }
            if (decodedActual) {
              console.error(`\nDecoded Actual Value:`, JSON.stringify(decodedActual, (_, v) =>
                typeof v === 'bigint' ? v.toString() : v === undefined ? null : v,
                2))
            }
            console.error('=====================================\n')
          }
          expect(keyval.value).toBe(expectedValue)
        }

        // Log summary
        console.log(`\n✅ [Block ${blockNumber}] State Key Verification Summary:`)
        console.log(`  Total keys in post_state: ${blockJsonData.post_state.keyvals.length}`)
        console.log(`  Keys checked (found in state trie): ${checkedKeys}`)
        console.log(`  Keys missing (not in state trie): ${missingKeys}`)
        if (missingKeys > 0) {
          console.error(`  ⚠️  ${missingKeys} key(s) are missing from the generated state trie`)
        }

        // Compare state root with expected post_state
        const [stateRootError, computedStateRoot] = stateService.getStateRoot()
        expect(stateRootError).toBeUndefined()
        expect(computedStateRoot).toBeDefined()
        const expectedStateRoot = blockJsonData.post_state.state_root
        expect(computedStateRoot).toBe(expectedStateRoot)
      }

      // Process blocks sequentially
      // Support --start-block CLI argument to start from a specific block
      const startBlock = getStartBlock()
      if (startBlock > 1) {
        console.log(`\n🚀 Starting from block ${startBlock} (--start-block ${startBlock})`)
      }

      let blockNumber = startBlock
      let hasMoreBlocks = true

      while (hasMoreBlocks) {
        const blockFileName = blockNumber.toString().padStart(8, '0') + '.json'
        const blockJsonPath = path.join(
          WORKSPACE_ROOT,
          `submodules/jam-test-vectors/traces/fallback/${blockFileName}`,
        )

        // Check if block file exists
        try {
          const blockJsonData: BlockTraceTestVector = JSON.parse(
            readFileSync(blockJsonPath, 'utf-8'),
          )

          console.log(`\n📦 Processing Block ${blockNumber}...`)

          // Only set pre-state for the starting block
          if (blockNumber === startBlock) {
            // Set pre_state from test vector BEFORE validating the block
            // This ensures entropy3 and other state components match what was used to create the seal signature
            if (blockJsonData.pre_state?.keyvals) {
              const [setStateError] = stateService.setState(blockJsonData.pre_state.keyvals)
              if (setStateError) {
                throw new Error(`Failed to set pre-state: ${setStateError.message}`)
              }
            } else {
              // Fallback to genesis state if pre_state is not available
              const [setStateError] = stateService.setState(genesisJson?.state?.keyvals ?? [])
              if (setStateError) {
                throw new Error(`Failed to set genesis state: ${setStateError.message}`)
              }
            }

            // Verify pre-state root matches block header's priorStateRoot
            const [preStateRootError, preStateRoot] = stateService.getStateRoot()
            expect(preStateRootError).toBeUndefined()
            expect(preStateRoot).toBeDefined()

            if (preStateRoot !== blockJsonData.block.header.parent_state_root) {
              console.warn(
                `⚠️  [Block ${blockNumber}] Pre-state root doesn't match block header: computed ${preStateRoot}, expected ${blockJsonData.block.header.parent_state_root}`,
              )
            }
          } else {
            // For subsequent blocks, verify that the current state root matches the block's parent_state_root
            const [currentStateRootError, currentStateRoot] = stateService.getStateRoot()
            expect(currentStateRootError).toBeUndefined()
            expect(currentStateRoot).toBeDefined()

            if (currentStateRoot !== blockJsonData.block.header.parent_state_root) {
              console.warn(
                `⚠️  [Block ${blockNumber}] Current state root doesn't match block header's parent_state_root: computed ${currentStateRoot}, expected ${blockJsonData.block.header.parent_state_root}`,
              )
            }
          }

          // Convert JSON block to Block type
          const block = convertJsonBlockToBlock(blockJsonData.block)

          // Import the block
          const [importError] = await blockImporterService.importBlock(block)
          if (importError) {
            throw new Error(`Failed to import block ${blockNumber}: ${importError.message}`)
          }
          expect(importError).toBeUndefined()

          // Verify post-state matches expected post_state from test vector
          verifyPostState(blockNumber, blockJsonData)

          console.log(`✅ Block ${blockNumber} imported and verified successfully`)

          blockNumber++
        } catch (error: any) {
          // If file doesn't exist, stop processing
          if (error.code === 'ENOENT') {
            hasMoreBlocks = false
            console.log(`\n📋 Processed ${blockNumber - 1} blocks total`)
          } else {
            // Re-throw other errors
            throw error
          }
        }
      }
    })
  })
})

