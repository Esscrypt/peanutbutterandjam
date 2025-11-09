/**
 * Compare state trie generated after setState with expected keyvals from JSON
 */

import { readFileSynca}eSynca}node:fsde:fsde:fsde:fsde:fsde:fsde:fsde:fsde:fsde:fsde:fsde:fsde:fsde:fsde:fsde:fsde:fsde:fsde:fs'
import * asppathnode:panode:path
import { RingVRFProverpbnj@pbnj@pbnjabandersnatchvrf
import {
  bytesToHex,
  EventBusService,
  type type type type type type type type type type type type type type type type type typetypeHex,
  hexToBytes,
  logger,
@pbnjcore
  bytesT
  AccumulateHostFunctionRegistry,
  AccumulatePVM,
  HostFunctionRegistry,
@pbnjpvm
  Eventtype BuBlockTraceTestVector@pbnjtypes
  type tyAccumulationServiceype type type type type type typaccumulation-servicetype type type type type typetypeHex,
  hexToByActivityServiceactivity
  logger,AuthPoolServicepool
@pbnjcoreAuthQueueServicequeue
  bytesTClockServiceclock
  AccumulConfigServiceRegistry,config
  AccumulDisputesServicedisputes
  HostFunEntropyServiceentropy
@pbnjpvmNodeGenesisManagergenesismanager
  Eventtype BuBlockTraceTestVector@pbnjtypes
  type tyReadyServicee type type type type type typacreadyicetype type type type type typetypeHex,
  hexToByActivityServiceactivity
  loggermSealKeyService@pbnjpvm../infra/nodeeservices/seal-keysManagergenesismanager
  EventtyServiceAccountServiceeTestVector@pbnjtypesservice-accountservice
  type tyStateService type typ../infra/node/servicesestateyservicereadyicetype type type type type typetypeHex,
  hexToivTicketService../infra/nodeservices/ticket-service
  loggermValidatorSetManagerce@pbnjpvm../infra/nodeeservicesvalidator-setagergenesismanager
  Eventt WorkReportService   Eventt../infra/node/servicesRwork-report-servicertService   Eventt../infra/node/servicesRwork-report-servicertService   Eventt../infra/node/servicesRwork-report-servicertService   Eventt../infra/node/servicesRwork-report-servicertService   Eventt../infra/node/servicesRwork-report-servicertService   Eventt../infra/node/servicesRwork-report-servicertService   Eventt../infra/node/servicesRwork-report-servicertService   Eventt../infra/node/servicesRwork-report-servicertService   Eventt../infra/node/servicesRwork-report-servicertService   Eventt../infra/node/servicesRwork-report-servicertService   Eventt../infra/node/servicesRwork-report-servicertService   Eventt../infra/node/servicesRwork-report-servicertService   Eventt../infra/node/servicesRwork-report-servicertService   Eventt../infra/node/servicesRwork-report-servicertService import t../infra/node/servicesRwork-report-servicertService import {../infra/node/servicesRwork-report-servicertService import {../infra/node/servicesRwork-report-servicertService import {../infra/node/servicesRwork-report-servicertService } from '../infra/node/services/work-report-service'

const WORKSPACE_ROOT = path.join(__dirname, '../')

async function main() {
  const configService = new ConfigService('tiny')

  // Load test vector
  const genesisJsonPath = path.join(
    WORKSPACE_ROOT,
    'submodules/jam-test-vectors/traces/fallback/genesis.json',
  )
  const blockJsonPath = path.join(
    WORKSPACE_ROOT,
    'submodules/jam-test-vectors/traces/fallback/00000001.json',
  )

  const genesisManager = new NodeGenesisManager(configService, {
    genesisJsonPath,
  })

  const [genesisError, genesisJson] = genesisManager.getGenesisJson()
  if (genesisError || !genesisJson) {
    console.error('Failed to load genesis:', genesisError)
    process.exit(1)
  }

  const blockJsonData: BlockTraceTestVector = JSON.parse(
    readFileSync(blockJsonPath, 'utf-8'),
  )

  const eventBusService = new EventBusService()
  const clockService = new ClockService({
    configService: configService,
    eventBusService: eventBusService,
  })
  const entropyService = new EntropyService(eventBusService)
  const ringProver = new RingVRFProver()

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
      bls: bytesToHex(new Uint8Array(144)),
      metadata: bytesToHex(new Uint8Array(128)),
    })),
  })

  ticketService.setValidatorSetManager(validatorSetManager)
  sealKeyService.setValidatorSetManager(validatorSetManager)

  const authQueueService = new AuthQueueService({
    configService,
  })

  const activityService = new ActivityService({
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

  const hostFunctionRegistry = new HostFunctionRegistry(
    serviceAccountsService,
    configService,
  )
  const accumulateHostFunctionRegistry = new AccumulateHostFunctionRegistry(
    configService,
  )
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

  // Set pre_state from test vector
  console.log('Setting pre_state from test vector...')
  if (blockJsonData.pre_state?.keyvals) {
    const [setStateError] = stateService.setState(
      blockJsonData.pre_state.keyvals,
    )
    if (setStateError) {
      console.error('Failed to set pre-state:', setStateError.message)
      process.exit(1)
    }
  }

  // Generate state trie
  console.log('Generating state trie...')
  const [trieError, stateTrie] = stateService.generateStateTrie()
  if (trieError) {
    console.error('Failed to generate state trie:', trieError.message)
    process.exit(1)
  }

  // Compare with expected pre_state keyvals
  console.log('\n=== Comparison: Generated State Trie vs Expected Pre-State ===\n')

  const expectedKeyvals = blockJsonData.pre_state?.keyvals || []
  const generatedKeys = new Set(Object.keys(stateTrie || {}))

  let matchedKeys = 0
  let missingKeys = 0
  let extraKeys = 0
  let valueMismatches = 0

  const missingKeyDetails: Array<{
    key: string
    expectedValue: string
    keyType?: string
    serviceId?: bigint
  }> = []

  const extraKeyDetails: Array<{
    key: string
    value: string
    keyType?: string
    serviceId?: bigint
  }> = []

  const mismatchDetails: Array<{
    key: string
    expectedValue: string
    actualValue: string
    keyType?: string
    serviceId?: bigint
  }> = []

  // Check expected keys
  for (const keyval of expectedKeyvals) {
    const key = keyval.key
    const expectedValue = keyval.value
    const actualValue = stateTrie?.[key]

    if (actualValue === undefined) {
      missingKeys++
      const [parseError, parsedKey] = stateService.parseStateKey(key as Hex)
      let keyType = 'unknown'
      let serviceId: bigint | undefined

      if (!parseError && parsedKey) {
        if ('chapterIndex' in parsedKey) {
          keyType = parsedKey.chapterIndex === 255 ? 'C(255, s)' : 'C(i)'
          if ('serviceId' in parsedKey) {
            serviceId = parsedKey.serviceId
          }
        } else if ('serviceId' in parsedKey) {
          keyType = 'C(s, h)'
          serviceId = parsedKey.serviceId
        }
      }

      missingKeyDetails.push({
        key,
        expectedValue,
        keyType,
        serviceId,
      })
    } else if (actualValue !== expectedValue) {
      valueMismatches++
      const [parseError, parsedKey] = stateService.parseStateKey(key as Hex)
      let keyType = 'unknown'
      let serviceId: bigint | undefined

      if (!parseError && parsedKey) {
        if ('chapterIndex' in parsedKey) {
          keyType = parsedKey.chapterIndex === 255 ? 'C(255, s)' : 'C(i)'
          if ('serviceId' in parsedKey) {
            serviceId = parsedKey.serviceId
          }
        } else if ('serviceId' in parsedKey) {
          keyType = 'C(s, h)'
          serviceId = parsedKey.serviceId
        }
      }

      mismatchDetails.push({
        key,
        expectedValue,
        actualValue,
        keyType,
        serviceId,
      })
    } else {
      matchedKeys++
    }
  }

  // Check for extra keys in generated trie
  for (const key of Object.keys(stateTrie || {})) {
    if (!expectedKeyvals.find((kv) => kv.key === key)) {
      extraKeys++
      const [parseError, parsedKey] = stateService.parseStateKey(key as Hex)
      let keyType = 'unknown'
      let serviceId: bigint | undefined

      if (!parseError && parsedKey) {
        if ('chapterIndex' in parsedKey) {
          keyType = parsedKey.chapterIndex === 255 ? 'C(255, s)' : 'C(i)'
          if ('serviceId' in parsedKey) {
            serviceId = parsedKey.serviceId
          }
        } else if ('serviceId' in parsedKey) {
          keyType = 'C(s, h)'
          serviceId = parsedKey.serviceId
        }
      }

      extraKeyDetails.push({
        key,
        value: stateTrie?.[key] || '',
        keyType,
        serviceId,
      })
    }
  }

  // Print summary
  console.log('Summary:')
  console.log(`  Total expected keys: ${expectedKeyvals.length}`)
  console.log(`  Total generated keys: ${Object.keys(stateTrie || {}).length}`)
  console.log(`  ✅ Matched keys: ${matchedKeys}`)
  console.log(`  ❌ Missing keys: ${missingKeys}`)
  console.log(`  ⚠️  Value mismatches: ${valueMismatches}`)
  console.log(`  ➕ Extra keys: ${extraKeys}`)

  // Print missing keys
  if (missingKeys > 0) {
    console.log('\n❌ Missing Keys:')
    for (const detail of missingKeyDetails.slice(0, 10)) {
      console.log(`  Key: ${detail.key}`)
      console.log(`    Type: ${detail.keyType}`)
      if (detail.serviceId !== undefined) {
        console.log(`    Service ID: ${detail.serviceId}`)
      }
      console.log(`    Expected Value: ${detail.expectedValue.substring(0, 100)}...`)
    }
    if (missingKeys > 10) {
      console.log(`  ... and ${missingKeys - 10} more missing keys`)
    }
  }

  // Print value mismatches
  if (valueMismatches > 0) {
    console.log('\n⚠️  Value Mismatches:')
    for (const detail of mismatchDetails.slice(0, 10)) {
      console.log(`  Key: ${detail.key}`)
      console.log(`    Type: ${detail.keyType}`)
      if (detail.serviceId !== undefined) {
        console.log(`    Service ID: ${detail.serviceId}`)
      }
      console.log(`    Expected: ${detail.expectedValue.substring(0, 100)}...`)
      console.log(`    Actual:   ${detail.actualValue.substring(0, 100)}...`)
    }
    if (valueMismatches > 10) {
      console.log(`  ... and ${valueMismatches - 10} more mismatches`)
    }
  }

  // Print extra keys
  if (extraKeys > 0) {
    console.log('\n➕ Extra Keys (in generated trie but not in expected):')
    for (const detail of extraKeyDetails.slice(0, 10)) {
      console.log(`  Key: ${detail.key}`)
      console.log(`    Type: ${detail.keyType}`)
      if (detail.serviceId !== undefined) {
        console.log(`    Service ID: ${detail.serviceId}`)
      }
      console.log(`    Value: ${detail.value.substring(0, 100)}...`)
    }
    if (extraKeys > 10) {
      console.log(`  ... and ${extraKeys - 10} more extra keys`)
    }
  }

  // Group by key type
  console.log('\n📊 Breakdown by Key Type:')
  const byType: Record<string, { expected: number; generated: number }> = {}
  for (const keyval of expectedKeyvals) {
    const [parseError, parsedKey] = stateService.parseStateKey(keyval.key as Hex)
    let keyType = 'unknown'
    if (!parseError && parsedKey) {
      if ('chapterIndex' in parsedKey) {
        keyType = parsedKey.chapterIndex === 255 ? 'C(255, s)' : `C(${parsedKey.chapterIndex})`
      } else if ('serviceId' in parsedKey) {
        keyType = 'C(s, h)'
      }
    }
    if (!byType[keyType]) {
      byType[keyType] = { expected: 0, generated: 0 }
    }
    byType[keyType].expected++
  }
  for (const key of Object.keys(stateTrie || {})) {
    const [parseError, parsedKey] = stateService.parseStateKey(key as Hex)
    let keyType = 'unknown'
    if (!parseError && parsedKey) {
      if ('chapterIndex' in parsedKey) {
        keyType = parsedKey.chapterIndex === 255 ? 'C(255, s)' : `C(${parsedKey.chapterIndex})`
      } else if ('serviceId' in parsedKey) {
        keyType = 'C(s, h)'
      }
    }
    if (!byType[keyType]) {
      byType[keyType] = { expected: 0, generated: 0 }
    }
    byType[keyType].generated++
  }
  for (const [keyType, counts] of Object.entries(byType)) {
    const match = counts.expected === counts.generated ? '✅' : '❌'
    console.log(`  ${match} ${keyType}: expected=${counts.expected}, generated=${counts.generated}`)
  }
}

main().catch((error) => {
  console.error('Error:', error)
  process.exit(1)
})

