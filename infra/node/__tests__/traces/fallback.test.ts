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
import { LastAccoutService } from '../../services/lastaccout-service'
import { WorkReportService } from '../../services/work-report-service'
import { PrivilegesService } from '../../services/privileges-service'
import { ServiceAccountService } from '../../services/service-account-service'
import { RecentHistoryService } from '../../services/recent-history-service'
import { bytesToHex, EventBusService, Hex, hexToBytes } from '@pbnj/core'
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
          bls: bytesToHex(new Uint8Array(32)),
          metadata: bytesToHex(new Uint8Array(128)),
        })),
      })

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

      const lastAccoutService = new LastAccoutService()
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

      const recentHistoryService = new RecentHistoryService({
        eventBusService: eventBusService,
        configService: configService,
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
        accumulatedService: accumulatedService,
        lastAccoutService: lastAccoutService,
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
        statisticsService: null,
        accumulationService: accumulatedService,
      })

      const blockImporterService = new BlockImporterService({
        configService: configService,
        eventBusService: eventBusService,
        clockService: clockService,
        recentHistoryService: recentHistoryService,
        serviceAccountService: serviceAccountsService,
        disputesService: disputesService,
        validatorSetManagerService: validatorSetManager,
        entropyService: entropyService,
        sealKeyService: sealKeyService,
        blockStore: null,
        assuranceService: assuranceService,
        guarantorService: guarantorService,
      })

      // Set initial state from genesis
      stateService.setState(genesisJson?.state?.keyvals ?? [])

      // Load block test vector
      const blockJsonPath = path.join(
        WORKSPACE_ROOT,
        'submodules/jam-test-vectors/traces/fallback/00000001.json',
      )
      const blockJsonData: BlockTraceTestVector = JSON.parse(
        readFileSync(blockJsonPath, 'utf-8'),
      )

      // Set pre_state from test vector
      if (blockJsonData.pre_state?.keyvals) {
        stateService.setState(blockJsonData.pre_state.keyvals)
      }

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

      // Compare state root with expected post_state
      const expectedStateRoot = blockJsonData.post_state.state_root
      expect(computedStateRoot).toBe(expectedStateRoot)

      const [stateTrieError, stateTrie] = stateService.generateStateTrie()
      expect(stateTrieError).toBeUndefined()
      expect(stateTrie).toBeDefined()

      for (const keyval of blockJsonData.post_state.keyvals) {
        const expectedValue = stateTrie?.[keyval.key]
        if (expectedValue !== undefined) {
          expect(keyval.value).toBe(expectedValue)
        }
      }

      // Optionally compare keyvals if needed
      // Note: This would require comparing the full state trie structure
      // For now, we just verify the state root matches
    })
  })
})

