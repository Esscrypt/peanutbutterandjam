/**
 * Genesis Parse Test
 *
 * Tests parsing of genesis.json files from test vectors using NodeGenesisManager
 */

import { describe, it, expect } from 'bun:test'
import * as path from 'node:path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { NodeGenesisManager } from '../../services/genesis-manager'
import { ConfigService } from '../../services/config-service'
import {
  bytesToHex,
  Hex,
  hexToBytes,
} from '@pbnjam/core'
import {
  type BlockTraceTestVector,
} from '@pbnjam/types'
import {
  convertJsonBlockToBlock,
  convertJsonReportToWorkReport,
  getStartBlock,
  initializeServices,
} from '../test-utils'

// Test vectors directory (relative to workspace root)
const WORKSPACE_ROOT = path.join(__dirname, '../../../../')



describe('Genesis Parse Tests', () => {
  const configService = new ConfigService('tiny')

  describe('Safrole Genesis', () => {
    it('should parse genesis.json from traces/storage_light', async () => {
      const genesisJsonPath = path.join(
        WORKSPACE_ROOT,
        'submodules/jam-test-vectors/traces/storage_light/genesis.json',
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

      // Initialize services using shared utility (useWasm: true for WASM executor)
      const services = await initializeServices('tiny', 'storage_light', genesisManager, initialValidators, true)
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
          0: 'C(s, h) keyvals',
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

      // Helper function to truncate long hex strings for logging
      const truncateHex = (hex: string, maxLength: number = 100) => {
        if (hex.length <= maxLength) return hex
        return `${hex.slice(0, maxLength)}... (${hex.length} chars total)`
      }

      // Helper function to create a JSON stringify replacer that truncates long hex strings
      const createTruncatingReplacer = (maxHexLength: number = 200) => {
        return (key: string, value: any) => {
          if (typeof value === 'string' && value.startsWith('0x') && value.length > maxHexLength) {
            return truncateHex(value, maxHexLength)
          }
          if (typeof value === 'bigint') return value.toString()
          if (value === undefined) return null
          return value
        }
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
            if ('chapterIndex' in keyInfo && !keyInfo.error) {
              const chapterIndex = keyInfo.chapterIndex
              try {
                // Handle C(s, h) keys (chapterIndex: 0) - these are raw keyvals, not decoded
                if (chapterIndex === 0 && 'serviceId' in keyInfo) {
                  // For C(s, h) keys, get the keyvals object and look up the specific key
                  const keyvals = stateService.getStateComponent(
                    chapterIndex,
                    keyInfo.serviceId,
                  ) as Record<Hex, Hex>
                  decodedActual = {
                    keyvals: keyvals,
                    specificKey: keyval.key,
                    value: keyvals?.[keyval.key] || undefined,
                  }
                  decodedExpected = {
                    key: keyval.key,
                    value: keyval.value,
                  }
                } else {
                  // For regular chapter keys, decode the value
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
                  if (chapterIndex !== undefined) {
                    decodedActual = stateService.getStateComponent(
                      chapterIndex,
                      'serviceId' in keyInfo ? keyInfo.serviceId : undefined,
                    )
                  }
                }
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
            } else {
              console.error(`Key Info: ${JSON.stringify(keyInfo)}`)
            }
            console.error(`Expected Value (hex): ${truncateHex(keyval.value)}`)
            console.error(`Actual Value (hex): ${truncateHex(expectedValue || '')}`)
            if (decodedExpected) {
              // For chapter 0 (C(s, h) keys), don't show the entire keyvals object
              if ('chapterIndex' in keyInfo && keyInfo.chapterIndex !== undefined && keyInfo.chapterIndex === 0 && 'keyvals' in decodedExpected) {
                console.error(`\nDecoded Expected Value:`, {
                  key: decodedExpected.key || keyval.key,
                  value: decodedExpected.value || keyval.value,
                  keyvalsCount: Object.keys(decodedExpected.keyvals || {}).length,
                })
              } else {
                console.error(`\nDecoded Expected Value:`, JSON.stringify(decodedExpected, createTruncatingReplacer(), 2))
              }
            }
            if (decodedActual) {
              // For chapter 0 (C(s, h) keys), don't show the entire keyvals object
              if ('chapterIndex' in keyInfo && keyInfo.chapterIndex !== undefined && keyInfo.chapterIndex === 0 && 'keyvals' in decodedActual) {
                console.error(`\nDecoded Actual Value:`, {
                  specificKey: decodedActual.specificKey || keyval.key,
                  value: decodedActual.value || expectedValue,
                  keyvalsCount: Object.keys(decodedActual.keyvals || {}).length,
                  hasExpectedKey: decodedActual.keyvals ? keyval.key in decodedActual.keyvals : false,
                })
              } else {
                console.error(`\nDecoded Actual Value:`, JSON.stringify(decodedActual, createTruncatingReplacer(), 2))
              }
            }
            console.error('=====================================\n')
            
            // Dump expected and actual values to files for easier comparison
            const mismatchDir = path.join(WORKSPACE_ROOT, '.state-mismatches')
            if (!existsSync(mismatchDir)) {
              mkdirSync(mismatchDir, { recursive: true })
            }
            const keyShort = keyval.key.slice(0, 20)
            const chapterStr = 'chapterIndex' in keyInfo && !keyInfo.error ? `chapter${keyInfo.chapterIndex}` : 'unknown'
            const filePrefix = `block${blockNumber.toString().padStart(8, '0')}-${chapterStr}-${keyShort}`
            
            // Write hex values
            writeFileSync(path.join(mismatchDir, `${filePrefix}-expected.hex`), keyval.value)
            writeFileSync(path.join(mismatchDir, `${filePrefix}-actual.hex`), expectedValue || '')
            
            // Write binary values
            writeFileSync(path.join(mismatchDir, `${filePrefix}-expected.bin`), hexToBytes(keyval.value as Hex))
            if (expectedValue) {
              writeFileSync(path.join(mismatchDir, `${filePrefix}-actual.bin`), hexToBytes(expectedValue as Hex))
            }
            
            // Write decoded JSON values
            if (decodedExpected) {
              writeFileSync(
                path.join(mismatchDir, `${filePrefix}-expected.json`),
                JSON.stringify(decodedExpected, (_, v) =>
                  typeof v === 'bigint' ? v.toString() : v === undefined ? null : v,
                  2)
              )
            }
            if (decodedActual) {
              writeFileSync(
                path.join(mismatchDir, `${filePrefix}-actual.json`),
                JSON.stringify(decodedActual, (_, v) =>
                  typeof v === 'bigint' ? v.toString() : v === undefined ? null : v,
                  2)
              )
            }
            console.log(`📁 Mismatch files dumped to: ${mismatchDir}/${filePrefix}-*`)
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
          `submodules/jam-test-vectors/traces/storage_light/${blockFileName}`,
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
    }, {timeout: 1000_000})
  })
})

