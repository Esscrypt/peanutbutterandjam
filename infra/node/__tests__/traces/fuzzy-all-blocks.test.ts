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
import { StateService } from '../../services/state-service'
import { ValidatorSetManager } from '../../services/validator-set'
import { EntropyService } from '../../services/entropy'
import { TicketService } from '../../services/ticket-service'
import { AuthQueueService } from '../../services/auth-queue-service'
import { AuthPoolService } from '../../services/auth-pool-service'
import { DisputesService } from '../../services/disputes-service'
import { ReadyService } from '../../services/ready-service'
import { AccumulationService } from '../../services/accumulation-service'
import { WorkReportService } from '../../services/work-report-service'
import { PrivilegesService } from '../../services/privileges-service'
import { ServiceAccountService } from '../../services/service-account-service'
import { RecentHistoryService } from '../../services/recent-history-service'
import {
  bytesToHex,
  EventBusService,
  Hex,
  hexToBytes,
} from '@pbnjam/core'
import { decodeRecent } from '@pbnjam/codec'
import { getTicketIdFromProof } from '@pbnjam/safrole'
import { SealKeyService } from '../../services/seal-key'
import { RingVRFProverWasm } from '@pbnjam/bandersnatch-vrf'
import { RingVRFVerifierWasm } from '@pbnjam/bandersnatch-vrf'
import {
  type Block,
  type BlockBody,
  type BlockHeader,
  type BlockTraceTestVector,
  type WorkReport,
} from '@pbnjam/types'
import { ClockService } from '../../services/clock-service'
import {
  AccumulateHostFunctionRegistry,
  HostFunctionRegistry,
} from '@pbnjam/pvm'
import { BlockImporterService } from '../../services/block-importer-service'
import { AssuranceService } from '../../services/assurance-service'
import { GuarantorService } from '../../services/guarantor-service'
import { StatisticsService } from '../../services/statistics-service'
import { AccumulatePVM } from '@pbnjam/pvm-invocations'

// Test vectors directory (relative to workspace root)
const WORKSPACE_ROOT = path.join(__dirname, '../../../../')

// Cache directory for storing unhashed state after each block
// This allows starting from any block without losing original storage keys
const STATE_CACHE_DIR = path.join(WORKSPACE_ROOT, '.state-cache/fuzzy')

// Ensure cache directory exists
function ensureCacheDir(): void {
  if (!existsSync(STATE_CACHE_DIR)) {
    mkdirSync(STATE_CACHE_DIR, { recursive: true })
  }
}

// Save full service account state after a block (with original storage keys)
function saveStateCache(
  blockNumber: number,
  serviceAccountsService: InstanceType<typeof import('../../services/service-account-service').ServiceAccountService>,
): void {
  ensureCacheDir()
  const cacheFile = path.join(STATE_CACHE_DIR, `block-${blockNumber.toString().padStart(8, '0')}.json`)
  
  // Get all service accounts with their full storage/preimages/requests
  const serviceAccounts = serviceAccountsService.getServiceAccounts()
  
  // Serialize to JSON with BigInt support
  const serializedAccounts: Record<string, any> = {}
  for (const [serviceId, account] of serviceAccounts.accounts.entries()) {
    const storageObj: Record<string, string> = {}
    for (const [key, value] of account.storage.entries()) {
      storageObj[key] = Buffer.from(value).toString('hex')
    }
    
    const preimagesObj: Record<string, string> = {}
    for (const [key, value] of account.preimages.entries()) {
      preimagesObj[key] = Buffer.from(value).toString('hex')
    }
    
    const requestsObj: Record<string, Record<string, string[]>> = {}
    for (const [hash, byLen] of account.requests.entries()) {
      requestsObj[hash] = {}
      for (const [len, status] of byLen.entries()) {
        // PreimageRequestStatus is bigint[] - serialize each timeslot
        requestsObj[hash][len.toString()] = status.map((t: bigint) => t.toString())
      }
    }
    
    serializedAccounts[serviceId.toString()] = {
      codehash: account.codehash,
      balance: account.balance.toString(),
      minaccgas: account.minaccgas.toString(),
      minmemogas: account.minmemogas.toString(),
      octets: account.octets.toString(),
      gratis: account.gratis.toString(),
      items: account.items.toString(),
      created: account.created.toString(),
      lastacc: account.lastacc.toString(),
      parent: account.parent.toString(),
      storage: storageObj,
      preimages: preimagesObj,
      requests: requestsObj,
    }
  }
  
  writeFileSync(cacheFile, JSON.stringify(serializedAccounts, null, 2))
  console.log(`💾 Saved state cache for block ${blockNumber} (${Object.keys(serializedAccounts).length} services)`)
}

// Load cached state for a specific block
function loadStateCache(
  blockNumber: number,
  serviceAccountsService: InstanceType<typeof import('../../services/service-account-service').ServiceAccountService>,
): boolean {
  const cacheFile = path.join(STATE_CACHE_DIR, `block-${blockNumber.toString().padStart(8, '0')}.json`)
  
  if (!existsSync(cacheFile)) {
    console.log(`⚠️  No state cache found for block ${blockNumber}`)
    return false
  }
  
  try {
    const data = JSON.parse(readFileSync(cacheFile, 'utf-8'))
    
    for (const [serviceIdStr, account] of Object.entries(data) as [string, any][]) {
      const serviceId = BigInt(serviceIdStr)
      
      // Reconstruct storage map with original keys (cast to Hex)
      const storage = new Map<Hex, Uint8Array>()
      for (const [key, valueHex] of Object.entries(account.storage) as [string, string][]) {
        storage.set(key as Hex, Buffer.from(valueHex, 'hex'))
      }
      
      // Reconstruct preimages map (cast to Hex)
      const preimages = new Map<Hex, Uint8Array>()
      for (const [key, valueHex] of Object.entries(account.preimages) as [string, string][]) {
        preimages.set(key as Hex, Buffer.from(valueHex, 'hex'))
      }
      
      // Reconstruct requests map - PreimageRequestStatus is bigint[]
      const requests = new Map<Hex, Map<bigint, bigint[]>>()
      for (const [hash, byLen] of Object.entries(account.requests) as [string, any][]) {
        const byLenMap = new Map<bigint, bigint[]>()
        for (const [lenStr, statusArr] of Object.entries(byLen) as [string, string[]][]) {
          // statusArr is array of timeslot strings - convert to bigint[]
          byLenMap.set(BigInt(lenStr), statusArr.map((t: string) => BigInt(t)))
        }
        requests.set(hash as Hex, byLenMap)
      }
      
      // Set the full service account with original storage keys
      serviceAccountsService.setServiceAccount(serviceId, {
        codehash: account.codehash as Hex,
        balance: BigInt(account.balance),
        minaccgas: BigInt(account.minaccgas),
        minmemogas: BigInt(account.minmemogas),
        octets: BigInt(account.octets),
        gratis: BigInt(account.gratis),
        items: BigInt(account.items),
        created: BigInt(account.created),
        lastacc: BigInt(account.lastacc),
        parent: BigInt(account.parent),
        storage,
        preimages,
        requests,
      })
    }
    
    console.log(`📂 Loaded state cache for block ${blockNumber} (${Object.keys(data).length} services)`)
    return true
  } catch (error) {
    console.error(`❌ Failed to load state cache for block ${blockNumber}:`, error)
    return false
  }
}

// Helper function to parse CLI arguments or environment variable for starting block
// Usage: START_BLOCK=50 bun test ... OR bun test ... -- --start-block 50
function getStartBlock(): number {
  // Check environment variable first (most reliable with bun test)
  const envStartBlock = process.env.START_BLOCK
  if (envStartBlock) {
    const startBlock = Number.parseInt(envStartBlock, 10)
    if (!Number.isNaN(startBlock) && startBlock >= 1) {
      return startBlock
    }
  }
  
  // Fallback to CLI argument (requires -- separator with bun test)
  const args = process.argv.slice(2)
  const startBlockIndex = args.indexOf('--start-block')
  if (startBlockIndex !== -1 && startBlockIndex + 1 < args.length) {
    const startBlock = Number.parseInt(args[startBlockIndex + 1]!, 10)
    if (Number.isNaN(startBlock) || startBlock < 1) {
      throw new Error(`Invalid --start-block argument: ${args[startBlockIndex + 1]}. Must be a number >= 1`)
    }
    return startBlock
  }
  return 1 // Default to block 1 (genesis)
}

// Helper function to parse CLI arguments or environment variable for stopping block
// Usage: STOP_BLOCK=50 bun test ... to stop after processing block 50
function getStopBlock(): number | undefined {
  // Check environment variable
  const envStopBlock = process.env.STOP_BLOCK
  if (envStopBlock) {
    const stopBlock = Number.parseInt(envStopBlock, 10)
    if (!Number.isNaN(stopBlock) && stopBlock >= 1) {
      return stopBlock
    }
  }
  return undefined // No stop block by default
}

describe('Genesis Parse Tests', () => {
  const configService = new ConfigService('tiny')

  describe('Safrole Genesis', () => {
    it('should parse genesis.json from traces/fuzzy', async () => {
      const genesisJsonPath = path.join(
        WORKSPACE_ROOT,
        'submodules/jam-test-vectors/traces/fuzzy/genesis.json',
      )

      const genesisManager = new NodeGenesisManager(configService, {
        genesisJsonPath,
      })

      const srsFilePath = path.join(
        WORKSPACE_ROOT,
        'packages/bandersnatch-vrf/test-data/srs/zcash-srs-2-11-uncompressed.bin',
      )
      const ringProver = new RingVRFProverWasm(srsFilePath)
      const ringVerifier = new RingVRFVerifierWasm(srsFilePath)

      await ringProver.init()
      await ringVerifier.init()

      // Verify genesis JSON was loaded
      const [error, genesisJson] = genesisManager.getGenesisJson()
      expect(error).toBeUndefined()
      expect(genesisJson).toBeDefined()

      if (!genesisJson) {
        throw new Error('Genesis JSON not loaded')
      }

      const eventBusService = new EventBusService()
      const clockService = new ClockService({
        configService: configService,
        eventBusService: eventBusService,
      })
      const entropyService = new EntropyService(eventBusService)
      const ticketService = new TicketService({
        configService: configService,
        eventBusService: eventBusService,
        keyPairService: null,
        entropyService: entropyService,
        networkingService: null,
        ce131TicketDistributionProtocol: null,
        ce132TicketDistributionProtocol: null,
        clockService: clockService,
        prover: ringProver,
        ringVerifier: ringVerifier,
        validatorSetManager: null,
      })
      const sealKeyService = new SealKeyService({
        configService,
        eventBusService,
        entropyService,
        ticketService,
      })

      // Extract validators from genesis.json header
      const initialValidators = genesisJson.header?.epoch_mark?.validators || []

    const validatorSetManager = new ValidatorSetManager({
        eventBusService,
        sealKeyService,
        ringProver,
        ticketService,
        configService,
        initialValidators: initialValidators.map((validator) => ({
          bandersnatch: validator.bandersnatch,
          ed25519: validator.ed25519,
          bls: bytesToHex(new Uint8Array(144)), // Gray Paper: BLS key must be 144 bytes
          metadata: bytesToHex(new Uint8Array(128)),
        })),
      })
      
      ticketService.setValidatorSetManager(validatorSetManager)

      const authQueueService = new AuthQueueService({
        configService,
      })

      const disputesService = new DisputesService({
        eventBusService: eventBusService,
        configService: configService,
        validatorSetManagerService: validatorSetManager,
      })
      const readyService = new ReadyService({
        configService: configService,
      })

      const workReportService = new WorkReportService({
        eventBus: eventBusService,
        networkingService: null,
        ce136WorkReportRequestProtocol: null,
        validatorSetManager: validatorSetManager,
        configService: configService,
        entropyService: entropyService,
        clockService: clockService,
      })

      const authPoolService = new AuthPoolService({
        configService,
        eventBusService: eventBusService,
        workReportService: workReportService,
        authQueueService: authQueueService,
      })

      const privilegesService = new PrivilegesService({
        configService,
      })


      const serviceAccountsService = new ServiceAccountService({
        configService,
        eventBusService,
        clockService,
        networkingService: null,
        preimageRequestProtocol: null,
      })

      const hostFunctionRegistry = new HostFunctionRegistry(serviceAccountsService, configService)
      const accumulateHostFunctionRegistry = new AccumulateHostFunctionRegistry(configService)
      // Only dump traces if DUMP_TRACES=true is set
      const shouldDumpTraces = process.env.DUMP_TRACES === 'true'
      const accumulatePVM = new AccumulatePVM({
        hostFunctionRegistry,
        accumulateHostFunctionRegistry,
        configService: configService,
        entropyService: entropyService,
        pvmOptions: { gasCounter: BigInt(configService.maxBlockGas) },
        useWasm: false,
        traceSubfolder: shouldDumpTraces ? 'fuzzy' : undefined,
      })

      const statisticsService = new StatisticsService({
        eventBusService: eventBusService,
        configService: configService,
        clockService: clockService,
      })

      const accumulatedService = new AccumulationService({
        configService: configService,
        clockService: clockService,
        serviceAccountsService: serviceAccountsService,
        privilegesService: privilegesService,
        validatorSetManager: validatorSetManager,
        authQueueService: authQueueService,
        accumulatePVM: accumulatePVM,
        readyService: readyService,
        statisticsService: statisticsService,
      })
            
      const recentHistoryService = new RecentHistoryService({
        eventBusService: eventBusService,
        configService: configService,
        accumulationService: accumulatedService,
      })
      recentHistoryService.start()

      const stateService = new StateService({
        configService,
        genesisManagerService: genesisManager,
        validatorSetManager: validatorSetManager,
        entropyService: entropyService,
        ticketService: ticketService,
        authQueueService: authQueueService,
        authPoolService: authPoolService,
        statisticsService: statisticsService,
        disputesService: disputesService,
        readyService: readyService,
        accumulationService: accumulatedService,
        workReportService: workReportService,
        privilegesService: privilegesService,
        serviceAccountsService: serviceAccountsService,
        recentHistoryService: recentHistoryService,
        sealKeyService: sealKeyService,
        clockService: clockService,
      })

      const assuranceService = new AssuranceService({
        configService: configService,
        workReportService: workReportService,
        validatorSetManager: validatorSetManager,
        eventBusService: eventBusService,
        sealKeyService: sealKeyService,
        recentHistoryService: recentHistoryService,
      })

      const guarantorService = new GuarantorService({
        configService: configService,
        clockService: clockService,
        entropyService: entropyService,
        authPoolService: authPoolService,
        networkService: null,
        ce134WorkPackageSharingProtocol: null,
        keyPairService: null,
        workReportService: workReportService,
        eventBusService: eventBusService,
        validatorSetManager: validatorSetManager,
        recentHistoryService: recentHistoryService,
        serviceAccountService: serviceAccountsService,
        statisticsService: statisticsService,
        stateService: stateService,
        accumulationService: accumulatedService,
      })

      const blockImporterService = new BlockImporterService({
        configService: configService,
        eventBusService: eventBusService,
        clockService: clockService,
        recentHistoryService: recentHistoryService,
        stateService: stateService,
        serviceAccountService: serviceAccountsService,
        disputesService: disputesService,
        validatorSetManagerService: validatorSetManager,
        entropyService: entropyService,
        sealKeyService: sealKeyService,
        assuranceService: assuranceService,
        guarantorService: guarantorService,
        ticketService: ticketService,
        statisticsService: statisticsService,
        authPoolService: authPoolService,
        accumulationService: accumulatedService,
      })

      // Set validatorSetManager on sealKeyService (needed for fallback key generation)
      sealKeyService.setValidatorSetManager(validatorSetManager)
      // Register SealKeyService epoch transition callback AFTER ValidatorSetManager
      // This ensures ValidatorSetManager.handleEpochTransition runs first, updating activeSet'
      // before SealKeyService calculates the new seal key sequence
      sealKeyService.registerEpochTransitionCallback()

      // Start all services
      // Note: EntropyService and ValidatorSetManager register their callbacks in constructors,
      // so they work without explicit start(), but we start them for consistency
      const [entropyStartError] = await entropyService.start()
      expect(entropyStartError).toBeUndefined()
      
      const [validatorSetStartError] = await validatorSetManager.start()
      expect(validatorSetStartError).toBeUndefined()
      
      const [startError] = await blockImporterService.start()
      expect(startError).toBeUndefined()

      // Helper function to convert JSON work report to WorkReport type
      const convertJsonReportToWorkReport = (jsonReport: any): WorkReport => {
        return {
          ...jsonReport,
          core_index: BigInt(jsonReport.core_index || 0),
          auth_gas_used: BigInt(jsonReport.auth_gas_used || 0),
          context: {
            ...jsonReport.context,
            lookup_anchor_slot: BigInt(jsonReport.context.lookup_anchor_slot || 0),
          },
          results: jsonReport.results.map((r: any) => ({
            ...r,
            service_id: BigInt(r.service_id || 0),
            accumulate_gas: BigInt(r.accumulate_gas || 0),
            refine_load: {
              ...r.refine_load,
              gas_used: BigInt(r.refine_load.gas_used || 0),
              imports: BigInt(r.refine_load.imports || 0),
              extrinsic_count: BigInt(r.refine_load.extrinsic_count || 0),
              extrinsic_size: BigInt(r.refine_load.extrinsic_size || 0),
              exports: BigInt(r.refine_load.exports || 0),
            },
          })),
        }
      }

      // Helper function to convert JSON block to Block type
      const convertJsonBlockToBlock = (jsonBlock: any): Block => {
        const jsonHeader = jsonBlock.header
        const jsonExtrinsic = jsonBlock.extrinsic

        const blockHeader: BlockHeader = {
          parent: jsonHeader.parent,
          priorStateRoot: jsonHeader.parent_state_root,
          extrinsicHash: jsonHeader.extrinsic_hash,
          timeslot: BigInt(jsonHeader.slot),
          epochMark: jsonHeader.epoch_mark
            ? {
                entropyAccumulator: jsonHeader.epoch_mark.entropy,
                entropy1: jsonHeader.epoch_mark.tickets_entropy,
                validators: jsonHeader.epoch_mark.validators.map((validator: any) => ({
                  bandersnatch: validator.bandersnatch,
                  ed25519: validator.ed25519,
                })),
              }
            : null,
          winnersMark: jsonHeader.tickets_mark
            ? jsonHeader.tickets_mark.map((ticket: any) => ({
                id: ticket.id,
                entryIndex: BigInt(ticket.attempt)
              }))
            : null,
          offendersMark: jsonHeader.offenders_mark || [],
          authorIndex: BigInt(jsonHeader.author_index),
          vrfSig: jsonHeader.entropy_source,
          sealSig: jsonHeader.seal,
        }

        const blockBody: BlockBody = {
          tickets: jsonExtrinsic.tickets.map((ticket: any) => ({
            entryIndex: BigInt(ticket.attempt),
            proof: ticket.signature as Hex,
            id: getTicketIdFromProof(hexToBytes(ticket.signature as Hex)),
          })),
          preimages: (jsonExtrinsic.preimages || []).map((preimage: any) => ({
            requester: BigInt(preimage.requester),
            blob: preimage.blob,
          })),
          guarantees: (jsonExtrinsic.guarantees || []).map((guarantee: any) => ({
            report: convertJsonReportToWorkReport(guarantee.report),
            slot: BigInt(guarantee.slot),
            signatures: guarantee.signatures,
          })),
          assurances: jsonExtrinsic.assurances || [],
          disputes: jsonExtrinsic.disputes
            ? [
                {
                  verdicts: jsonExtrinsic.disputes.verdicts.map((verdict: any) => ({
                    target: verdict.target,
                    age: BigInt(verdict.age),
                    votes: verdict.votes.map((vote: any) => ({
                      vote: vote.vote,
                      index: BigInt(vote.index),
                      signature: vote.signature,
                    })),
                  })),
                  culprits: jsonExtrinsic.disputes.culprits,
                  faults: jsonExtrinsic.disputes.faults,
                },
              ]
            : [
                {
                  verdicts: [],
                  culprits: [],
                  faults: [],
                },
              ],
        }

        return {
          header: blockHeader,
          body: blockBody,
        }
      }

      // Helper function to parse state key using state service
      const parseStateKeyForDebug = (keyHex: Hex) => {
        const [error, parsedKey] = stateService.parseStateKey(keyHex)
        if (error) {
          return { error: error.message }
        }
        // Add type information for better debugging
        if ('chapterIndex' in parsedKey) {
          if (parsedKey.chapterIndex === 255 && 'serviceId' in parsedKey) {
            return { ...parsedKey, type: 'C(255, s)' }
          }
          return { ...parsedKey, type: 'C(i)' }
        } else if ('serviceId' in parsedKey && 'hash' in parsedKey) {
          return { ...parsedKey, type: 'C(s, h)' }
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
            if ('chapterIndex' in keyInfo && !keyInfo.error) {
              console.error(`Chapter: ${keyInfo.chapterIndex} - ${getChapterName(keyInfo.chapterIndex)}`)
              console.error(`Key Type: ${keyInfo.type}`)
              if ('serviceId' in keyInfo) {
                console.error(`Service ID: ${keyInfo.serviceId}`)
              }
            } else if ('serviceId' in keyInfo) {
              console.error(`Service ID: ${keyInfo.serviceId}`)
              console.error(`Key Type: ${keyInfo.type}`)
              if ('hash' in keyInfo) {
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
            if ('chapterIndex' in keyInfo && !keyInfo.error) {
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
            if ('chapterIndex' in keyInfo && !keyInfo.error) {
              console.error(`Chapter: ${keyInfo.chapterIndex} - ${getChapterName(keyInfo.chapterIndex)}`)
              console.error(`Key Type: ${keyInfo.type}`)
              if ('serviceId' in keyInfo) {
                console.error(`Service ID: ${keyInfo.serviceId}`)
              }
            } else if ('serviceId' in keyInfo) {
              console.error(`Service ID: ${keyInfo.serviceId}`)
              console.error(`Key Type: ${keyInfo.type}`)
              if ('hash' in keyInfo) {
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
            
            // Dump expected and actual values to files for easier comparison
            const mismatchDir = path.join(STATE_CACHE_DIR, 'mismatches')
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
          `submodules/jam-test-vectors/traces/fuzzy/${blockFileName}`,
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
            // Use raw keyvals mode (3rd param = true) to bypass decode/encode roundtrip issues
            // for the initial state root verification
            if (blockJsonData.pre_state?.keyvals) {
              const [setStateError] = stateService.setState(
                blockJsonData.pre_state.keyvals,
                undefined, // jamVersion
                true, // useRawKeyvals - store raw keyvals for pre-state root calculation
              )
              if (setStateError) {
                throw new Error(`Failed to set pre-state: ${setStateError.message}`)
              }
            } else {
              // Fallback to genesis state if pre_state is not available
              const [setStateError] = stateService.setState(
                genesisJson?.state?.keyvals ?? [],
                undefined,
                true, // useRawKeyvals
              )
              if (setStateError) {
                throw new Error(`Failed to set genesis state: ${setStateError.message}`)
              }
            }
            
            // For non-genesis starts, load from state cache AFTER setState
            // This overwrites the service accounts with versions that have original (unhashed) storage keys
            // The C(s, h) keys from test vectors only contain blake hashes, not original keys
            if (startBlock > 1) {
              const previousBlock = startBlock - 1
              const cacheLoaded = loadStateCache(previousBlock, serviceAccountsService)
              if (!cacheLoaded) {
                console.warn(`⚠️  No state cache for block ${previousBlock}. Run from block 1 first to build cache.`)
                console.warn(`   Storage keys will use blake hashes instead of original keys.`)
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
            // Just log what was loaded for debugging:
            const entropyState = entropyService.getEntropy()
            console.log(`📂 Entropy after setState:`, {
              accumulator: entropyState.accumulator?.slice(0, 20) + '...',
              entropy1: entropyState.entropy1?.slice(0, 20) + '...',
              entropy2: entropyState.entropy2?.slice(0, 20) + '...',
              entropy3: entropyState.entropy3?.slice(0, 20) + '...',
            })
            console.log(`📂 Seal keys after setState: ${sealKeyService.getSealKeys().length} keys`)

            // Verify pre-state root matches block header's priorStateRoot
            const [preStateRootError, preStateRoot] = stateService.getStateRoot()
            expect(preStateRootError).toBeUndefined()
            expect(preStateRoot).toBeDefined()

            if (preStateRoot !== blockJsonData.block.header.parent_state_root) {
              console.warn(
                `⚠️  [Block ${blockNumber}] Pre-state root doesn't match block header: computed ${preStateRoot}, expected ${blockJsonData.block.header.parent_state_root}`,
              )
            }
            // Note: Don't clear raw keyvals here - the block importer also needs them for prior state root validation
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
            throw new Error(`Failed to import block ${blockNumber}: ${importError.message}, stack: ${importError.stack}`)
          }
          expect(importError).toBeUndefined()

          // Clear raw keyvals mode after block import
          // This switches back to normal state trie generation for post-state verification
          // The post-state should be verified against what our services actually produce,
          // not the raw keyvals from pre_state
          stateService.clearRawKeyvals()

          // Verify post-state matches expected post_state from test vector
          verifyPostState(blockNumber, blockJsonData)

          // Save state cache after successful block processing
          // This preserves original storage keys for future --start-block runs
          saveStateCache(blockNumber, serviceAccountsService)

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
    })
  })
})

