/**
 * Genesis Parse Test
 *
 * Tests parsing of genesis.json files from test vectors using NodeGenesisManager
 */

import { config } from 'dotenv'
config() // Load environment variables from .env file

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
  decodeRecent,
  setServiceStorageValue,
  setServicePreimageValue,
  setServiceRequestValue,
} from '@pbnjam/codec'
import {
  type BlockTraceTestVector,
} from '@pbnjam/types'
import {
  convertJsonBlockToBlock,
  getStartBlock,
  getStopBlock,
  initializeServices,
  setupJamVersionAndTraceSubfolder,
} from '../test-utils'

// Test vectors directory (relative to workspace root)
const WORKSPACE_ROOT = path.join(__dirname, '../../../../')


describe('Genesis Parse Tests', () => {
  const configService = new ConfigService('tiny')

  // Trace dumping is gated on DUMP_TRACES=true (see test-utils setupJamVersionAndTraceSubfolder).
  // To dump PVM traces when running this test: DUMP_TRACES=true bun test fuzzy-light-all-blocks-rust.test.ts
  const { traceSubfolder } = setupJamVersionAndTraceSubfolder(configService, 'fuzzy_light')

  describe('Safrole Genesis', () => {
    it('should parse genesis.json from traces/fuzzy_light', async () => {
      const genesisJsonPath = path.join(
        WORKSPACE_ROOT,
        'submodules/jam-test-vectors/traces/fuzzy_light/genesis.json',
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
      const services = await initializeServices({ spec: 'tiny', traceSubfolder, genesisManager, initialValidators, useRust: true })
      const { stateService, blockImporterService, recentHistoryService } = services

      // Helper function to parse state key using state service
      const parseStateKeyForDebug = (keyHex: Hex) => {
        const [error, parsedKey] = stateService.parseStateKey(keyHex)
        if (error) {
          return { error: error.message }
        }
        // Add type information for better debugging
        if ('chapterIndex' in parsedKey) {
          if (parsedKey.chapterIndex === 0 && 'serviceId' in parsedKey) {
            return { ...parsedKey, type: 'C(s, h)' }
          }
          if (parsedKey.chapterIndex === 255 && 'serviceId' in parsedKey) {
            return { ...parsedKey, type: 'C(255, s)' }
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

      // Helper function to verify post-state
      const verifyPostState = (blockNumber: number, blockJsonData: BlockTraceTestVector) => {
        // #region agent log
        fetch('http://127.0.0.1:10000/ingest/3fca1dc3-0561-4f6b-af77-e67afc81f2d7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'fuzzy-light-all-blocks.test.ts:136',message:'verifyPostState start',data:{blockNumber,postStateKeyvalsCount:blockJsonData.post_state?.keyvals?.length||0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
        const [stateTrieError, stateTrie] = stateService.generateStateTrie()
        // #region agent log
        fetch('http://127.0.0.1:10000/ingest/3fca1dc3-0561-4f6b-af77-e67afc81f2d7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'fuzzy-light-all-blocks.test.ts:138',message:'After generateStateTrie',data:{blockNumber,stateTrieError:stateTrieError?.message||'none',stateTrieKeysCount:stateTrie?Object.keys(stateTrie).length:0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
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
            
            // #region agent log
            fetch('http://127.0.0.1:10000/ingest/3fca1dc3-0561-4f6b-af77-e67afc81f2d7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'fuzzy-light-all-blocks.test.ts:170',message:'Missing state key in post-state verification',data:{blockNumber,missingKey:keyval.key.slice(0,40),chapterIndex:'chapterIndex' in keyInfo?keyInfo.chapterIndex:'unknown',missingKeysCount:missingKeys},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
            // #endregion
            
            console.error(`\n❌ [Block ${blockNumber}] Missing State Key Detected:`)
            console.error('=====================================')
            console.error(`State Key: ${keyval.key}`)
            if ('error' in keyInfo) {
              console.error(`Key Info Error: ${keyInfo.error}`)
            } else if ('chapterIndex' in keyInfo) {
              console.error(`Chapter: ${keyInfo.chapterIndex} - ${getChapterName(keyInfo.chapterIndex)}`)
              if ('type' in keyInfo) {
              console.error(`Key Type: ${keyInfo.type}`)
              }
              if ('serviceId' in keyInfo) {
                console.error(`Service ID: ${keyInfo.serviceId}`)
              }
            } else if ('serviceId' in keyInfo && !('error' in keyInfo) && !('chapterIndex' in keyInfo)) {
              const serviceKeyInfo = keyInfo as { serviceId: bigint; type?: string; hash?: Hex }
              console.error(`Service ID: ${serviceKeyInfo.serviceId}`)
              if (serviceKeyInfo.type) {
                console.error(`Key Type: ${serviceKeyInfo.type}`)
              }
              if (serviceKeyInfo.hash) {
                console.error(`Hash: ${serviceKeyInfo.hash}`)
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
            
            // #region agent log
            fetch('http://127.0.0.1:10000/ingest/3fca1dc3-0561-4f6b-af77-e67afc81f2d7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'fuzzy-light-all-blocks.test.ts:211',message:'State value mismatch in post-state verification',data:{blockNumber,mismatchKey:keyval.key.slice(0,40),expectedValue:keyval.value.slice(0,40),actualValue:expectedValue.slice(0,40),chapterIndex:'chapterIndex' in keyInfo?keyInfo.chapterIndex:'unknown'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
            // #endregion
            let decodedExpected: any = null
            let decodedActual: any = null
            
            // Special handling for Chapter 4 (safrole) - decode and compare each component
            if ('chapterIndex' in keyInfo && keyInfo.chapterIndex === 4) {
              try {
                const expectedBytes = hexToBytes(keyval.value as Hex)
                const actualBytes = hexToBytes(expectedValue as Hex)
                const decoder = (stateService as any).stateTypeRegistry?.get(4)
                if (decoder) {
                  const [decodeExpectedError, decodedExpectedResult] = decoder(expectedBytes)
                  const [decodeActualError, decodedActualResult] = decoder(actualBytes)
                  if (!decodeExpectedError && decodedExpectedResult && !decodeActualError && decodedActualResult) {
                    const expectedSafrole = decodedExpectedResult.value as any
                    const actualSafrole = decodedActualResult.value as any
                    
                    // Compare each component
                    const pendingsetMatch = JSON.stringify(expectedSafrole.pendingSet) === JSON.stringify(actualSafrole.pendingSet)
                    const epochRootMatch = expectedSafrole.epochRoot === actualSafrole.epochRoot
                    const discriminatorMatch = expectedSafrole.discriminator === actualSafrole.discriminator
                    const sealticketsMatch = JSON.stringify(expectedSafrole.sealTickets) === JSON.stringify(actualSafrole.sealTickets)
                    const ticketAccumulatorMatch = JSON.stringify(expectedSafrole.ticketAccumulator) === JSON.stringify(actualSafrole.ticketAccumulator)
                    
                    // #region agent log
                    fetch('http://127.0.0.1:10000/ingest/3fca1dc3-0561-4f6b-af77-e67afc81f2d7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'fuzzy-light-all-blocks.test.ts:220',message:'Chapter 4 component comparison',data:{blockNumber,pendingsetMatch,epochRootMatch,discriminatorMatch,sealticketsMatch,ticketAccumulatorMatch,expectedPendingsetCount:expectedSafrole.pendingSet?.length||0,actualPendingsetCount:actualSafrole.pendingSet?.length||0,expectedEpochRoot:expectedSafrole.epochRoot?.slice(0,40),actualEpochRoot:actualSafrole.epochRoot?.slice(0,40),expectedDiscriminator:expectedSafrole.discriminator,actualDiscriminator:actualSafrole.discriminator,expectedSealticketsCount:expectedSafrole.sealTickets?.length||0,actualSealticketsCount:actualSafrole.sealTickets?.length||0,expectedTicketAccumulatorCount:expectedSafrole.ticketAccumulator?.length||0,actualTicketAccumulatorCount:actualSafrole.ticketAccumulator?.length||0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
                    // #endregion
                  }
                }
              } catch (error) {
                // Ignore decode errors for now
              }
            }

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
                decodedActual = stateService.getStateComponent(
                  chapterIndex,
                  'serviceId' in keyInfo ? keyInfo.serviceId : undefined,
                )
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
            if ('error' in keyInfo) {
              console.error(`Key Info Error: ${keyInfo.error}`)
            } else if ('chapterIndex' in keyInfo) {
              console.error(`Chapter: ${keyInfo.chapterIndex} - ${getChapterName(keyInfo.chapterIndex)}`)
              if ('type' in keyInfo) {
              console.error(`Key Type: ${keyInfo.type}`)
              }
              if ('serviceId' in keyInfo) {
                console.error(`Service ID: ${keyInfo.serviceId}`)
              }
            } else if ('serviceId' in keyInfo && !('error' in keyInfo) && !('chapterIndex' in keyInfo)) {
              const serviceKeyInfo = keyInfo as { serviceId: bigint; type?: string; hash?: Hex }
              console.error(`Service ID: ${serviceKeyInfo.serviceId}`)
              if (serviceKeyInfo.type) {
                console.error(`Key Type: ${serviceKeyInfo.type}`)
              }
              if (serviceKeyInfo.hash) {
                console.error(`Hash: ${serviceKeyInfo.hash}`)
              }
            } else {
              console.error(`Key Info: ${JSON.stringify(keyInfo)}`)
            }
            console.error(`Expected Value (hex): ${keyval.value}`)
            console.error(`Actual Value (hex): ${expectedValue}`)
            if (decodedExpected) {
              // For chapter 0 (C(s, h) keys), don't show the entire keyvals object
              if ('chapterIndex' in keyInfo && keyInfo.chapterIndex === 0 && 'keyvals' in decodedExpected) {
                console.error(`\nDecoded Expected Value:`, {
                  key: decodedExpected.key || keyval.key,
                  value: decodedExpected.value || keyval.value,
                  keyvalsCount: Object.keys(decodedExpected.keyvals || {}).length,
                })
              } else {
                console.error(`\nDecoded Expected Value:`, JSON.stringify(decodedExpected, (_, v) =>
                  typeof v === 'bigint' ? v.toString() : v === undefined ? null : v,
                  2))
              }
            }
            if (decodedActual) {
              // For chapter 0 (C(s, h) keys), don't show the entire keyvals object
              if ('chapterIndex' in keyInfo && keyInfo.chapterIndex === 0 && 'keyvals' in decodedActual) {
                console.error(`\nDecoded Actual Value:`, {
                  specificKey: decodedActual.specificKey || keyval.key,
                  value: decodedActual.value || expectedValue,
                  keyvalsCount: Object.keys(decodedActual.keyvals || {}).length,
                  hasExpectedKey: decodedActual.keyvals ? keyval.key in decodedActual.keyvals : false,
                })
              } else {
                console.error(`\nDecoded Actual Value:`, JSON.stringify(decodedActual, (_, v) =>
                  typeof v === 'bigint' ? v.toString() : v === undefined ? null : v,
                  2))
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
      const stopBlock = getStopBlock()
      if (startBlock > 1) {
        console.log(`\n🚀 Starting from block ${startBlock} (START_BLOCK=${startBlock})`)
      }
      if (stopBlock !== undefined) {
        console.log(`🛑 Will stop after block ${stopBlock} (STOP_BLOCK=${stopBlock})`)
      }

      let blockNumber = startBlock
      let hasMoreBlocks = true

      while (hasMoreBlocks) {
        const blockFileName = blockNumber.toString().padStart(8, '0') + '.json'
        const blockJsonPath = path.join(
          WORKSPACE_ROOT,
          `submodules/jam-test-vectors/traces/fuzzy_light/${blockFileName}`,
        )

        // Check if block file exists
        try {
          const blockJsonData: BlockTraceTestVector = JSON.parse(
            readFileSync(blockJsonPath, 'utf-8'),
          )

          console.log(`\n📦 Processing Block ${blockNumber}...`)

          // Only set pre-state for the starting block
          if (blockNumber === startBlock) {
            // Set pre_state from test vector FIRST
            // This ensures entropy3 and other state components match what was used to create the seal signature
            // Set pre-state from test vector

            // #region agent log
            fetch('http://127.0.0.1:10000/ingest/3fca1dc3-0561-4f6b-af77-e67afc81f2d7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'fuzzy-light-all-blocks.test.ts:421',message:'Setting pre-state for starting block',data:{blockNumber,startBlock,hasPreState:!!blockJsonData.pre_state?.keyvals,preStateKeyvalsCount:blockJsonData.pre_state?.keyvals?.length||0,hasGenesisJson:!!genesisJson,genesisKeyvalsCount:genesisJson?.state?.keyvals?.length||0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
            // #endregion

            if (blockJsonData.pre_state?.keyvals) {
              const [setStateError] = stateService.setState(
                blockJsonData.pre_state.keyvals,
              )
              
              // #region agent log
              fetch('http://127.0.0.1:10000/ingest/3fca1dc3-0561-4f6b-af77-e67afc81f2d7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'fuzzy-light-all-blocks.test.ts:427',message:'After setState from pre_state',data:{blockNumber,setStateError:setStateError?.message||'none',keyvalsCount:blockJsonData.pre_state.keyvals.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
              // #endregion
              
              if (setStateError) {
                throw new Error(`Failed to set pre-state: ${setStateError.message}`)
              }
            } else {
              // Fallback to genesis state if pre_state is not available
              const [setStateError] = stateService.setState(
                genesisJson?.state?.keyvals ?? [],
              )
              // #region agent log
              fetch('http://127.0.0.1:10000/ingest/3fca1dc3-0561-4f6b-af77-e67afc81f2d7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'fuzzy-light-all-blocks.test.ts:436',message:'After setState from genesis',data:{blockNumber,setStateError:setStateError?.message||'none',genesisKeyvalsCount:genesisJson?.state?.keyvals?.length||0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
              // #endregion
              if (setStateError) {
                throw new Error(`Failed to set genesis state: ${setStateError.message}`)
              }
            }
            
            // Initialize recent history service from pre-state beta chapter (key 0x03)
            // This ensures the MMR state (accoutBelt) is properly initialized from the pre-state
            const betaKeyval = blockJsonData.pre_state?.keyvals?.find(
              (kv: { key: string }) => kv.key === '0x03000000000000000000000000000000000000000000000000000000000000'
            )
            if (betaKeyval) {
              const betaData = hexToBytes(betaKeyval.value as Hex)
              const [decodeError, decodeResult] = decodeRecent(betaData)
              if (!decodeError && decodeResult) {
                console.log(`📂 Decoded recent history:`, {
                  historyLength: decodeResult.value.history?.length ?? 0,
                  peaks: decodeResult.value.accoutBelt?.peaks ?? [],
                  totalCount: decodeResult.value.accoutBelt?.totalCount?.toString() ?? '0',
                })
                recentHistoryService.setRecent(decodeResult.value)
                console.log(`📂 Loaded recent history from pre-state (totalCount: ${decodeResult.value.accoutBelt?.totalCount ?? 0})`)
              } else {
                console.warn(`⚠️  Failed to decode beta from pre-state:`, decodeError)
              }
            }
            
            // Note: stateService.setState already processes all chapters including:
            // - Chapter 4 (safrole): sets seal keys via sealKeyService.setSealKeys()
            // - Chapter 6 (entropy): sets entropy via entropyService.setEntropy()
            // So we don't need to manually load these here.

            // Deep compare generated state trie with pre-state keyvals

            
            const preStateKeyvals = blockJsonData.pre_state?.keyvals || []
            const [trieError, stateTrie] = stateService.generateStateTrie()
            
            expect(trieError).toBeUndefined()
            expect(stateTrie).toBeDefined()
            
            if (!stateTrie) {
              throw new Error('Failed to generate state trie')
            }

            // Build maps for comparison
            const preStateKeyvalsMap = new Map<string, string>()
            for (const kv of preStateKeyvals) {
              preStateKeyvalsMap.set(kv.key, kv.value)
            }
            const stateTrieMap = new Map<string, string>()
            for (const [key, value] of Object.entries(stateTrie)) {
              stateTrieMap.set(key, value)
            }

            // Find keys in pre-state but not in state trie
            const missingInTrie: string[] = []
            const differentValues: Array<{key: string, expected: string, actual: string, chapterIndex?: number}> = []
            
            for (const [key, expectedValue] of preStateKeyvalsMap.entries()) {
              const actualValue = stateTrieMap.get(key)
              if (actualValue === undefined) {
                missingInTrie.push(key)
                const keyBytes = hexToBytes(key as Hex)
                const firstByte = keyBytes[0]
                const isChapterKey = firstByte >= 1 && firstByte <= 16 && keyBytes.slice(1).every(b => b === 0)
                const chapterIndex = isChapterKey ? firstByte : (firstByte === 0xff ? 255 : 0)
              } else if (actualValue !== expectedValue) {
                const keyBytes = hexToBytes(key as Hex)
                const firstByte = keyBytes[0]
                const isChapterKey = firstByte >= 1 && firstByte <= 16 && keyBytes.slice(1).every(b => b === 0)
                const chapterIndex = isChapterKey ? firstByte : (firstByte === 0xff ? 255 : 0)
                differentValues.push({key, expected: expectedValue, actual: actualValue, chapterIndex})
                
                // #region agent log
                const keyInfo = parseStateKeyForDebug(key as Hex)
                fetch('http://127.0.0.1:10000/ingest/3fca1dc3-0561-4f6b-af77-e67afc81f2d7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'fuzzy-light-all-blocks.test.ts:505',message:'State value difference detected',data:{blockNumber,key:key.slice(0,40),chapterIndex,expectedValue:expectedValue.slice(0,40),actualValue:actualValue.slice(0,40),expectedLength:expectedValue.length,actualLength:actualValue.length,keyInfo:'chapterIndex' in keyInfo?{chapterIndex:keyInfo.chapterIndex}:keyInfo},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
                // #endregion
              }
            }

            // Find keys in state trie but not in pre-state
            const extraInTrie: string[] = []
            for (const key of stateTrieMap.keys()) {
              if (!preStateKeyvalsMap.has(key)) {
                extraInTrie.push(key)
                const keyBytes = hexToBytes(key as Hex)
                const firstByte = keyBytes[0]
                const isChapterKey = firstByte >= 1 && firstByte <= 16 && keyBytes.slice(1).every(b => b === 0)
                const chapterIndex = isChapterKey ? firstByte : (firstByte === 0xff ? 255 : 0)
              }
            }

            // Calculate state root for comparison
            const [preStateRootError, preStateRoot] = stateService.getStateRoot()
            expect(preStateRootError).toBeUndefined()
            expect(preStateRoot).toBeDefined()

            // Log detailed summary
            if (missingInTrie.length > 0 || differentValues.length > 0 || extraInTrie.length > 0 || preStateRoot !== blockJsonData.block.header.parent_state_root) {
              console.error(`\n❌ [Block ${blockNumber}] State trie mismatch detected:`)
              console.error(`  Pre-state keyvals: ${preStateKeyvals.length}`)
              console.error(`  Generated trie keys: ${stateTrieMap.size}`)
              console.error(`  Missing keys: ${missingInTrie.length}`)
              console.error(`  Different values: ${differentValues.length}`)
              console.error(`  Extra keys: ${extraInTrie.length}`)
              console.error(`  State root: computed ${preStateRoot}, expected ${blockJsonData.block.header.parent_state_root}`)
              
              if (missingInTrie.length > 0) {
                console.error(`\n  Missing keys (first 10):`)
                for (const key of missingInTrie.slice(0, 10)) {
                  const keyInfo = parseStateKeyForDebug(key as Hex)
                  console.error(`    ${key} - ${'chapterIndex' in keyInfo ? `Chapter ${keyInfo.chapterIndex}` : JSON.stringify(keyInfo)}`)
                }
              }
              
              if (differentValues.length > 0) {
                console.error(`\n  Different values (first 10):`)
                for (const diff of differentValues.slice(0, 10)) {
                  const keyInfo = parseStateKeyForDebug(diff.key as Hex)
                  const chapterIndex = 'chapterIndex' in keyInfo ? keyInfo.chapterIndex : 'unknown'
                  console.error(`    ${diff.key} - ${'chapterIndex' in keyInfo ? `Chapter ${keyInfo.chapterIndex}` : JSON.stringify(keyInfo)}`)
                  console.error(`      Expected: ${diff.expected.substring(0, 40)}... (${diff.expected.length} bytes)`)
                  console.error(`      Actual:   ${diff.actual.substring(0, 40)}... (${diff.actual.length} bytes)`)
                  
                  // #region agent log
                  fetch('http://127.0.0.1:10000/ingest/3fca1dc3-0561-4f6b-af77-e67afc81f2d7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'fuzzy-light-all-blocks.test.ts:550',message:'Different value details',data:{blockNumber,key:diff.key.slice(0,40),chapterIndex,expectedValue:diff.expected.slice(0,80),actualValue:diff.actual.slice(0,80),expectedLength:diff.expected.length,actualLength:diff.actual.length,keyInfo:'chapterIndex' in keyInfo?{chapterIndex:keyInfo.chapterIndex,type:keyInfo.type}:keyInfo},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
                  // #endregion
                }
              }
              
              if (extraInTrie.length > 0) {
                console.error(`\n  Extra keys (first 10):`)
                for (const key of extraInTrie.slice(0, 10)) {
                  const keyInfo = parseStateKeyForDebug(key as Hex)
                  console.error(`    ${key} - ${'chapterIndex' in keyInfo ? `Chapter ${keyInfo.chapterIndex}` : JSON.stringify(keyInfo)}`)
                }
              }
            }

            // Verify state root matches
            if (preStateRoot !== blockJsonData.block.header.parent_state_root) {
              console.warn(
                `⚠️  [Block ${blockNumber}] Pre-state root doesn't match block header: computed ${preStateRoot}, expected ${blockJsonData.block.header.parent_state_root}`,
              )
            }
            
            // #region agent log
            const differentValueDetails = differentValues.length > 0 ? differentValues[0] : null
            fetch('http://127.0.0.1:10000/ingest/3fca1dc3-0561-4f6b-af77-e67afc81f2d7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'fuzzy-light-all-blocks.test.ts:611',message:'Before state trie verification',data:{blockNumber,missingInTrieCount:missingInTrie.length,differentValuesCount:differentValues.length,extraInTrieCount:extraInTrie.length,computedStateRoot:preStateRoot,expectedStateRoot:blockJsonData.block.header.parent_state_root,stateRootMatches:preStateRoot===blockJsonData.block.header.parent_state_root,differentValueKey:differentValueDetails?.key?.slice(0,40),differentValueChapterIndex:differentValueDetails?.chapterIndex,differentValueExpected:differentValueDetails?.expected?.slice(0,40),differentValueActual:differentValueDetails?.actual?.slice(0,40)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
            // #endregion

            // Fail test if there are mismatches
            expect(missingInTrie.length).toBe(0)
            expect(differentValues.length).toBe(0)
            expect(preStateRoot).toBe(blockJsonData.block.header.parent_state_root)
            // Note: State trie generation uses the actual service state,
            // not raw keyvals from pre_state, so no clearing is needed
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

          // Note: State trie generation uses the actual service state,
          // not raw keyvals from pre_state, so no clearing is needed

          // Verify post-state matches expected post_state from test vector
          verifyPostState(blockNumber, blockJsonData)

          console.log(`✅ Block ${blockNumber} imported and verified successfully`)

          // Check if we should stop after this block
          if (stopBlock !== undefined && blockNumber >= stopBlock) {
            console.log(`\n🛑 Stopping after block ${blockNumber} (STOP_BLOCK=${stopBlock})`)
            hasMoreBlocks = false
          }

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

