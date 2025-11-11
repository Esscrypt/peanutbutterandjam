#!/usr/bin/env bun

/**
 * Script to compare the generated state trie (from generateStateTrie) with
 * the pre-state keyvals from the test vector to identify mismatches.
 */

import { bytesToHex,EEventBusService, hexToBytes ventBusS@pbnj/corevpbnjtypes
ConfigStype erHexpathervic@pbnjtypes
interfastreadFileSyncpathervicfs
  pre_s {joinevm/../inpathervicerk-report-service
    key AAccumulationServiceack../infra/node/sreclockesnactiaccumulationsservicerk-report-servicevconfig Hex }>
  }ConfigActivityServiceasrccon../infra/node/sreclockesnactivityvices/work-report-service
}ConfigSeClockServiceerrviceekcconfi../infra/node/sreclockesnageresode/services/work-report-service
ConfigSerDisputesServicerrviceeaconfig../infra/node/sreadisputesnageresde/services/work-report-service
async fonEntropyServicerrviceecackage../infra/node/sreaentropynageres/node/services/work-report-servicefig
  constVeNodeGenesisManagerrviceec./pack../infra/node/sreadgenesispmanageres/node/services/work-report-serviceconfig
    procwPrivilegesServiceeces/pvm../infra/node/sreadyent-privileges/node/services/work-report-service
    'suleReadyServicerviceicecec./pack../infra/node/sreadyent-historyaccountt/node/services/work-report-servicesconfiges/fallback/00000001.json',
  )ConfigRecentHistoryServiceiceceasrccon../infra/node/sersafrecent-historyaccounttnode/services/work-report-service
  constkJSafroleServiceervicecec./pack../infra/node/sersafrolervice-accountt/node/services/work-report-serviceoconfigSON.parse(
    reaSyServiceAccountServicecec./pack../infra/node/servicesiservice-accountt/node/services/work-report-service,config-8'),
  )ConfigStateServiceceasrccon../infra/node/servicesnstatetnode/services/work-report-service
ConfigSerValidatorSetManagerceaconfig../infra/node/servicesrvalidator-setde/services/work-report-service
  // InizWorkReportServicecpackages..sinfra/node/services/work-report-servicenfig
  constigConfigServicevice = ne../packages/pvm/srcfconfigvice('tiny')
  const eventBusService = new EventBusService()
  const genesisManager = new NodeGenesisManager(configService)
  const validatorSetManager = new ValidatorSetManager(
    configService,
    eventBusService,
  )
  const recentHistoryService = new RecentHistoryService(
    configService,
    eventBusService,
  )
  const safroleService = new SafroleService(configService, eventBusService)
  const entropyService = new EntropyService(configService, eventBusService)
  const workReportService = new WorkReportService(configService, eventBusService)
  const clockService = new ClockService(configService, eventBusService)
  const serviceAccountService = new ServiceAccountService({
    preimageStore: null,
    configService,
    eventBusService,
    clockService,
    networkingService: null,
    preimageRequestProtocol: null,
  })
  const activityService = new ActivityService(configService, eventBusService)
  const privilegesService = new PrivilegesService(configService, eventBusService)
  const disputesService = new DisputesService(configService, eventBusService)
  const readyService = new ReadyService(configService, eventBusService)
  const accumulationService = new AccumulationService(
    configService,
    eventBusService,
  )

  const stateService = new StateService({
    configService,
    genesisManager,
    validatorSetManager,
    recentHistoryService,
    safroleService,
    entropyService,
    workReportService,
    clockService,
    serviceAccountService,
    activityService,
    privilegesService,
    disputesService,
    readyService,
    accumulationService,
    eventBusService,
  })

  // Set state from pre_state keyvals
  console.log('Setting state from pre_state keyvals...')
  const preStateKeyvals = blockJsonData.pre_state.keyvals
  console.log(`Total pre_state keyvals: ${preStateKeyvals.length}`)

  const [setStateError] = stateService.setState(preStateKeyvals)
  if (setStateError) {
    console.error('Error setting state:', setStateError.message)
    process.exit(1)
  }

  // Generate state trie
  console.log('Generating state trie...')
  const [trieError, generatedTrie] = stateService.generateStateTrie()
  if (trieError) {
    console.error('Error generating state trie:', trieError.message)
    process.exit(1)
  }

  console.log(`Generated trie has ${Object.keys(generatedTrie).length} keys`)
  console.log(`Pre-state has ${preStateKeyvals.length} keyvals`)

  // Compare
  const expectedKeys = new Set(preStateKeyvals.map((kv) => kv.key))
  const generatedKeys = new Set(Object.keys(generatedTrie))

  // Find missing keys in generated trie
  const missingInGenerated: Array<{ key: Hex; value: Hex }> = []
  for (const keyval of preStateKeyvals) {
    if (!generatedTrie[keyval.key]) {
      missingInGenerated.push(keyval)
    }
  }

  // Find extra keys in generated trie
  const extraInGenerated: Array<{ key: Hex; value: Hex }> = []
  for (const key of Object.keys(generatedTrie)) {
    if (!expectedKeys.has(key as Hex)) {
      extraInGenerated.push({
        key: key as Hex,
        value: generatedTrie[key],
      })
    }
  }

  // Find value mismatches
  const valueMismatches: Array<{
    key: Hex
    expected: Hex
    actual: Hex
    expectedLength: number
    actualLength: number
  }> = []
  for (const keyval of preStateKeyvals) {
    const generatedValue = generatedTrie[keyval.key]
    if (generatedValue && generatedValue !== keyval.value) {
      valueMismatches.push({
        key: keyval.key,
        expected: keyval.value,
        actual: generatedValue,
        expectedLength: keyval.value.length / 2 - 1,
        actualLength: generatedValue.length / 2 - 1,
      })
    }
  }

  // Report results
  console.log('\n=== COMPARISON RESULTS ===\n')

  if (missingInGenerated.length > 0) {
    console.log(`❌ Missing in generated trie: ${missingInGenerated.length} keys`)
    for (const kv of missingInGenerated.slice(0, 10)) {
      const chapter = Number.parseIntarseIntarseIntarseIntarseIntarseIntarseIntarseIntarseIntarseIntarseIntarseIntarseIntarseIntarseIntarseIntarseIntarseIntarseInt(kv.key.slice(2, 4), 16)
      console.log(`  Key: ${kv.key.slice(0, 50)}... (Chapter ${chapter})`)
      console.log(`  Value length: ${kv.value.length / 2 - 1} bytes`)
    }
    if (missingInGenerated.length > 10) {
      console.log(`  ... and ${missingInGenerated.length - 10} more`)
    }
  } else {
    console.log('✅ All pre-state keys present in generated trie')
  }

  if (extraInGenerated.length > 0) {
    console.log(`\n⚠️  Extra in generated trie: ${extraInGenerated.length} keys`)
    for (const kv of extraInGenerated.slice(0, 10)) {
      const chapter = Number.parseIntarseIntarseIntarseIntarseIntarseIntarseIntarseIntarseIntarseIntarseIntarseIntarseIntarseIntarseIntarseIntarseIntarseIntarseInt(kv.key.slice(2, 4), 16)
      console.log(`  Key: ${kv.key.slice(0, 50)}... (Chapter ${chapter})`)
      console.log(`  Value length: ${kv.value.length / 2 - 1} bytes`)
    }
    if (extraInGenerated.length > 10) {
      console.log(`  ... and ${extraInGenerated.length - 10} more`)
    }
  } else {
    console.log('\n✅ No extra keys in generated trie')
  }

  if (valueMismatches.length > 0) {
    console.log(`\n❌ Value mismatches: ${valueMismatches.length} keys`)
    for (const mismatch of valueMismatches.slice(0, 20)) {
      const chapter = Number.parseIntarseIntarseIntarseIntarseIntarseIntarseIntarseIntarseIntarseIntarseIntarseIntarseIntarseIntarseIntarseIntarseIntarseIntarseInt(mismatch.key.slice(2, 4), 16)
      console.log(`\n  Key: ${mismatch.key.slice(0, 50)}... (Chapter ${chapter})`)
      console.log(`  Expected length: ${mismatch.expectedLength} bytes`)
      console.log(`  Actual length: ${mismatch.actualLength} bytes`)
      if (mismatch.expectedLength === mismatch.actualLength) {
        // Same length, show byte differences
        const expectedBytes = hexToBytes(mismatch.expected)
        const actualBytes = hexToBytes(mismatch.actual)
        const diffIndices: number[] = []
        const maxLen = Math.max(expectedBytes.length, actualBytes.length)
        for (let i = 0; i < maxLen; i++) {
          if (expectedBytes[i] !== actualBytes[i]) {
            diffIndices.push(i)
          }
        }
        console.log(`  Byte differences at indices: ${diffIndices.slice(0, 20).join(', ')}`)
        if (diffIndices.length > 20) {
          console.log(`  ... and ${diffIndices.length - 20} more`)
        }
        // Show first few differing bytes
        if (diffIndices.length > 0) {
          const idx = diffIndices[0]
          console.log(`  Byte ${idx}: expected 0x${expectedBytes[idx]?.toString(16).padStart(2, '0')}, got 0x${actualBytes[idx]?.toString(16).padStart(2, '0')}`)
        }
      } else {
        // Different length, show prefixes
        console.log(`  Expected prefix: ${mismatch.expected.slice(0, 100)}...`)
        console.log(`  Actual prefix: ${mismatch.actual.slice(0, 100)}...`)
      }
    }
    if (valueMismatches.length > 20) {
      console.log(`\n  ... and ${valueMismatches.length - 20} more mismatches`)
    }
  } else {
    console.log('\n✅ All values match')
  }

  // Summary
  console.log('\n=== SUMMARY ===')
  console.log(`Total pre-state keys: ${preStateKeyvals.length}`)
  console.log(`Generated trie keys: ${Object.keys(generatedTrie).length}`)
  console.log(`Missing in generated: ${missingInGenerated.length}`)
  console.log(`Extra in generated: ${extraInGenerated.length}`)
  console.log(`Value mismatches: ${valueMismatches.length}`)

  if (missingInGenerated.length > 0 || valueMismatches.length > 0) {
    process.exit(1)
  }
}

main().catch((error) => {
  console.error('Error:', error)
  process.exit(1)
})

