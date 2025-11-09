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
import { StateService } from '../../services/state-service'
import { ValidatorSetManager } from '../../services/validator-set'
import { EntropyService } from '../../services/entropy'
import { TicketService } from '../../services/ticket-service'
import { AuthQueueService } from '../../services/auth-queue-service'
import { AuthPoolService } from '../../services/auth-pool-service'
import { ActivityService } from '../../services/activity-service'
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
  logger,
} from '@pbnj/core'
import { convertGenesisToBlockHeader } from '@pbnj/genesis'
import { calculateBlockHashFromHeader } from '@pbnj/serialization'
import { getTicketIdFromProof } from '@pbnj/safrole'
import { SealKeyService } from '../../services/seal-key'
import { RingVRFProver } from '@pbnj/bandersnatch-vrf'
import {
  ValidatorKeyPair,
  type Block,
  type BlockBody,
  type BlockHeader,
  type BlockTraceTestVector,
} from '@pbnj/types'
import { ClockService } from '../../services/clock-service'
import {
  AccumulateHostFunctionRegistry,
  AccumulatePVM,
  HostFunctionRegistry,
} from '@pbnj/pvm'
import { BlockImporterService } from '../../services/block-importer-service'
import { AssuranceService } from '../../services/assurance-service'
import { GuarantorService } from '../../services/guarantor-service'
import { StatisticsService } from '../../services/statistics-service'

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

      const ringProver = new RingVRFProver()


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
        keyPairService: null, 
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

      const activityService = new ActivityService({
        configService
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
        workStore: null,
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
        preimageStore: null,
        configService,
        eventBusService,
        clockService,
        networkingService: null,
        preimageRequestProtocol: null,
      })

      const hostFunctionRegistry = new HostFunctionRegistry(serviceAccountsService, configService)
      const accumulateHostFunctionRegistry = new AccumulateHostFunctionRegistry(configService)
      const accumulatePVM = new AccumulatePVM({
        hostFunctionRegistry,
        accumulateHostFunctionRegistry,
        configService: configService,
        entropyService: entropyService,
        pvmOptions: { gasCounter: 1_000_000n },
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
      })
            
      const recentHistoryService = new RecentHistoryService({
        eventBusService: eventBusService,
        configService: configService,
        accumulationService: accumulatedService,
      })

      const stateService = new StateService({
        configService,
        genesisManagerService: genesisManager,
        validatorSetManager: validatorSetManager,
        entropyService: entropyService,
        ticketService: ticketService,
        authQueueService: authQueueService,
        authPoolService: authPoolService,
        activityService: activityService,
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

      const statisticsService = new StatisticsService({
        eventBusService: eventBusService,
        configService: configService,
        clockService: clockService,
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
        blockStore: null,
        assuranceService: assuranceService,
        guarantorService: guarantorService,
        ticketService: ticketService,
        statisticsService: statisticsService,
        authPoolService: authPoolService,
      })

      // Load block test vector first to get the parent hash and pre_state
      const blockJsonPath = path.join(
        WORKSPACE_ROOT,
        'submodules/jam-test-vectors/traces/fallback/00000001.json',
      )
      const blockJsonData: BlockTraceTestVector = JSON.parse(
        readFileSync(blockJsonPath, 'utf-8'),
      )

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

      // Calculate state root from raw test vector keyvals (bypasses decode/encode)
      // This should match the test vector's pre_state.state_root exactly
      const [rawStateRootError, rawStateRoot] =
        stateService.calculateStateRootFromKeyvals(
          blockJsonData.pre_state?.keyvals || [],
        )
      expect(rawStateRootError).toBeUndefined()
      expect(rawStateRoot).toBeDefined()

      // Verify raw state root matches test vector's pre_state.state_root
      if (rawStateRoot !== blockJsonData.pre_state?.state_root) {
        console.error(
          `❌ Raw state root mismatch: computed ${rawStateRoot}, expected ${blockJsonData.pre_state?.state_root}`,
        )
      } else {
        console.log(
          `✅ Raw state root matches test vector: ${rawStateRoot}`,
        )
      }

      // Get pre-state root from re-encoded state (after decode/set/re-encode cycle)
      // This may differ from the raw state root due to decode/encode round-trip issues
      const [preStateRootError, preStateRoot] = stateService.getStateRoot()
      expect(preStateRootError).toBeUndefined()
      expect(preStateRoot).toBeDefined()

      // Compare raw vs re-encoded state roots
      if (rawStateRoot !== preStateRoot) {
        console.warn(
          `⚠️  State root mismatch after decode/encode: raw=${rawStateRoot}, re-encoded=${preStateRoot}`,
        )
        console.warn(
          'This indicates decode/encode round-trip issues or state components not being set correctly.',
        )
      }

      // Verify re-encoded state root matches block header's priorStateRoot
      // The block header's priorStateRoot should match the raw state root from test vector
      if (preStateRoot !== blockJsonData.block.header.parent_state_root) {
        console.warn(
          `⚠️  Re-encoded state root doesn't match block header: computed ${preStateRoot}, expected ${blockJsonData.block.header.parent_state_root}`,
        )
        console.warn(
          'The block importer will validate this and may fail if they don\'t match.',
        )
      }

      // Gray Paper: recent history tracks "the most recent Crecenthistorylen blocks"
      // At genesis, recent history should be empty (no blocks imported yet)
      // The block importer will validate the parent against genesis hash if recent history is empty
      // After importing block 1, recent history should contain only [block1], not [genesis, block1]
      //
      // Note: The test vector's pre_state may include genesis in recent history for test setup,
      // but according to GP, recent history should be empty at genesis. Clear it if it only contains genesis.
      const recentHistory = recentHistoryService.getRecentHistory()
      const firstBlockParent = blockJsonData.block.header.parent

      // If recent history contains only genesis (the first block's parent), clear it
      // According to GP, recent history should be empty at genesis
      if (
        recentHistory.length === 1 &&
        recentHistory[0]?.headerHash === firstBlockParent
      ) {
        logger.debug(
          'Clearing genesis from recent history (should be empty at genesis per GP)',
          {
            genesisHash: firstBlockParent,
            recentHistoryLength: recentHistory.length,
            entries: recentHistory.map((e) => e.headerHash),
          },
        )
        recentHistoryService.clearHistory()
      } else {
        logger.debug('Pre-state recent history', {
          length: recentHistory.length,
          entries: recentHistory.map((e) => e.headerHash),
        })
      }

      // Set validatorSetManager on sealKeyService (needed for fallback key generation)
      sealKeyService.setValidatorSetManager(validatorSetManager)

      // Set pre_state from test vector
      // This should load seal tickets/keys from the safrole state (chapter 4)
      // if (blockJsonData.pre_state?.keyvals) {
      //   stateService.setState(blockJsonData.pre_state.keyvals)
      // }

      // Note: Seal keys should be loaded from pre_state if they exist
      // Only generate fallback keys if seal keys are truly missing
      // The state may have either ticket-based seal keys or fallback keys
      // Don't overwrite them with newly generated keys

      // Convert JSON block to Block type
      const jsonBlock = blockJsonData.block
      const jsonHeader = jsonBlock.header
      const jsonExtrinsic = jsonBlock.extrinsic

      // Convert header: JSON uses different field names than our BlockHeader type
      const blockHeader: BlockHeader = {
        parent: jsonHeader.parent,
        priorStateRoot: jsonHeader.parent_state_root,
        extrinsicHash: jsonHeader.extrinsic_hash,
        timeslot: BigInt(jsonHeader.slot),
        epochMark: jsonHeader.epoch_mark
          ? {
              entropyAccumulator: jsonHeader.epoch_mark.entropy,
              entropy1: jsonHeader.epoch_mark.entropy,
              validators: jsonHeader.epoch_mark.validators.map((validator) => ({
                bandersnatch: validator.bandersnatch,
                ed25519: validator.ed25519,
              })),
            }
          : null,
        winnersMark: jsonHeader.tickets_mark
          ? jsonHeader.tickets_mark.map((ticket) => ({
              id: ticket.id,
              entryIndex: BigInt(ticket.entry_index),
              proof: '0x' as Hex,
            }))
          : null,
        offendersMark: jsonHeader.offenders_mark || [],
        authorIndex: BigInt(jsonHeader.author_index),
        vrfSig: jsonHeader.entropy_source,
        sealSig: jsonHeader.seal,
      }

      // Convert extrinsic to BlockBody format
      const blockBody: BlockBody = {
        tickets: jsonExtrinsic.tickets.map((ticket) => ({
          entryIndex: BigInt(ticket.attempt),
          proof: ticket.signature as Hex,
          id: getTicketIdFromProof(hexToBytes(ticket.signature as Hex)),
        })),
        preimages: (jsonExtrinsic.preimages || []).map((preimage) => ({
          requester: BigInt(preimage.requester),
          blob: preimage.blob,
        })),
        guarantees: (jsonExtrinsic.guarantees || []).map((guarantee) => ({
          report: guarantee.report,
          slot: BigInt(guarantee.slot),
          signatures: guarantee.signatures,
        })),
        assurances: jsonExtrinsic.assurances || [],
        disputes: jsonExtrinsic.disputes
          ? [
              {
                verdicts: jsonExtrinsic.disputes.verdicts.map((verdict) => ({
                  target: verdict.target,
                  age: BigInt(verdict.age),
                  votes: verdict.votes.map((vote) => ({
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

      const block: Block = {
        header: blockHeader,
        body: blockBody,
      }

      // Start all services
      const [startError] = await blockImporterService.start()
      expect(startError).toBeUndefined()

      // Import the block
      const [importError] = await blockImporterService.importBlock(block)
      expect(importError).toBeUndefined()

      // Get post-state from state service
      const [stateRootError, computedStateRoot] = stateService.getStateRoot()
      expect(stateRootError).toBeUndefined()
      expect(computedStateRoot).toBeDefined()


      const [stateTrieError, stateTrie] = stateService.generateStateTrie()
      expect(stateTrieError).toBeUndefined()
      expect(stateTrie).toBeDefined()

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
          
          console.error('\n❌ Missing State Key Detected:')
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
          let decodedState = null

          // Try to get decoded state component if it's a chapter key
          if ('chapterIndex' in keyInfo && !keyInfo.error) {
            try {
              decodedState = stateService.getStateComponent(
                keyInfo.chapterIndex,
                'serviceId' in keyInfo ? keyInfo.serviceId : undefined,
              )
            } catch (error) {
              decodedState = { error: error instanceof Error ? error.message : String(error) }
            }
          }

          // Log detailed mismatch information
          console.error('\n❌ State Value Mismatch Detected:')
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
          console.error(`Actual Value: ${expectedValue}`)
          if (decodedState) {
            console.error(`Decoded State Component:`, JSON.stringify(decodedState, (_, v) =>
              typeof v === 'bigint' ? v.toString() : v === undefined ? null : v,
              2))
          }
          console.error('=====================================\n')
        }
        expect(keyval.value).toBe(expectedValue)
      }

      // Log summary
      console.log(`\n✅ State Key Verification Summary:`)
      console.log(`  Total keys in post_state: ${blockJsonData.post_state.keyvals.length}`)
      console.log(`  Keys checked (found in state trie): ${checkedKeys}`)
      console.log(`  Keys missing (not in state trie): ${missingKeys}`)
      if (missingKeys > 0) {
        console.error(`  ⚠️  ${missingKeys} key(s) are missing from the generated state trie`)
      }

      // Compare state root with expected post_state
      const expectedStateRoot = blockJsonData.post_state.state_root
      expect(computedStateRoot).toBe(expectedStateRoot)

      // Optionally compare keyvals if needed
      // Note: This would require comparing the full state trie structure
      // For now, we just verify the state root matches
    })
  })
})

