/**
 * Test script to decode state keys from block 1 pre-state
 * 
 * This script:
 * 1. Loads block 1 pre-state from test vectors
 * 2. Parses each state key using parseStateKey
 * 3. For C(s, h) keys, determines the type (storage/preimage/request) using determineKeyType
 * 4. Prints detailed information about each key
 */

import * as path from 'node:path'
import { readFileSync } from 'node:fs'
import { StateService } from '../../services/state-service'
import { ConfigService } from '../../services/config-service'
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
import { EventBusService, hexToBytes, bytesToHex, blake2bHash, type Hex } from '@pbnj/core'
import { NodeGenesisManager } from '../../services/genesis-manager'
import { SealKeyService } from '../../services/seal-key'
import { ClockService } from '../../services/clock-service'
import { StatisticsService } from '../../services/statistics-service'
import type { BlockTraceTestVector } from '@pbnj/types'

const WORKSPACE_ROOT = path.join(__dirname, '../../../../')

async function main() {
  console.log('🔍 Decoding State Keys from Block 1 Pre-State\n')

  // Load block 1 trace
  const block1Path = path.join(
    WORKSPACE_ROOT,
    'submodules/jam-test-vectors/traces/storage_light/00000001.json',
  )
  const block1Json = JSON.parse(readFileSync(block1Path, 'utf-8')) as BlockTraceTestVector

  if (!block1Json.pre_state?.keyvals) {
    console.error('❌ Block 1 pre_state.keyvals not found')
    process.exit(1)
  }

  // Initialize minimal services needed for StateService
  const configService = new ConfigService('tiny')
  const eventBusService = new EventBusService()
  const clockService = new ClockService({
    configService,
    eventBusService,
  })
  const entropyService = new EntropyService(eventBusService)
  const ticketService = new TicketService({
    configService,
    eventBusService,
    keyPairService: null,
    entropyService,
    networkingService: null,
    ringProver: null,
    ringVerifier: null,
  })
  const genesisJsonPath = path.join(
    WORKSPACE_ROOT,
    'submodules/jam-test-vectors/traces/storage_light/genesis.json',
  )
  const genesisManager = new NodeGenesisManager(configService, {
    genesisJsonPath,
  })

  const sealKeyService = new SealKeyService({
    configService,
    eventBusService,
    entropyService,
    ticketService,
  })

  const validatorSetManager = new ValidatorSetManager({
    eventBusService,
    sealKeyService,
    ringProver: null,
    ticketService,
    keyPairService: null,
    configService,
    initialValidators: [],
  })

  const authQueueService = new AuthQueueService({
    configService,
  })

  const disputesService = new DisputesService({
    eventBusService,
    configService,
    validatorSetManagerService: validatorSetManager,
  })

  const readyService = new ReadyService({
    configService,
  })

  const workReportService = new WorkReportService({
    workStore: null,
    eventBus: eventBusService,
    networkingService: null,
    ce136WorkReportRequestProtocol: null,
    validatorSetManager: validatorSetManager,
    configService,
    entropyService,
    clockService,
  })

  const authPoolService = new AuthPoolService({
    configService,
    eventBusService,
    workReportService,
    authQueueService,
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

  const accumulationService = new AccumulationService({
    configService,
    clockService,
    serviceAccountsService,
    privilegesService,
    validatorSetManager,
    authQueueService,
    accumulatePVM: null as any,
    readyService,
  })

  const recentHistoryService = new RecentHistoryService({
    eventBusService,
    configService,
    accumulationService,
  })

  const statisticsService = new StatisticsService({
    eventBusService,
    configService,
    clockService,
  })

  const stateService = new StateService({
    validatorSetManager,
    entropyService,
    ticketService,
    authQueueService,
    authPoolService,
    disputesService,
    readyService,
    accumulationService,
    workReportService,
    privilegesService,
    serviceAccountsService,
    recentHistoryService,
    configService,
    genesisManagerService: genesisManager,
    sealKeyService,
    clockService,
    statisticsService,
  })

  const keyvals = block1Json.pre_state.keyvals
  console.log(`📊 Total keys in pre-state: ${keyvals.length}\n`)

  // Store parsed preimage information for request key verification
  // Map: serviceId -> Map: preimageHash -> blobLength
  const preimageInfo = new Map<bigint, Map<Hex, number>>()

  // Statistics
  let cIKeys = 0 // C(i) keys
  let c255Keys = 0 // C(255, s) keys
  let cshKeys = 0 // C(s, h) keys
  let parseErrors = 0
  let storageKeys = 0
  let storageHashMatches = 0
  let storageHashMismatches = 0
  let preimageKeys = 0
  let preimageHashMatches = 0
  let preimageHashMismatches = 0
  let requestKeys = 0
  let requestHashMatches = 0
  let requestHashMismatches = 0
  let unknownCshKeys = 0

  for (const keyval of keyvals) {
    const keyHex = keyval.key as Hex
    const valueHex = keyval.value as Hex

    console.log('─'.repeat(80))
    console.log(`🔑 Key: ${keyHex}`)
    console.log(`📦 Value length: ${hexToBytes(valueHex).length} bytes`)

    // Parse the key
    const [parseError, parsedKey] = stateService.parseStateKey(keyHex)

    if (parseError) {
      console.log(`❌ Parse Error: ${parseError.message}`)
      parseErrors++
      continue
    }

    // Handle different key types
    if ('chapterIndex' in parsedKey) {
      if (parsedKey.chapterIndex === 255 && 'serviceId' in parsedKey) {
        console.log(`📋 Type: C(255, s) - Service Account`)
        console.log(`   Service ID: ${parsedKey.serviceId}`)
        c255Keys++
      } else {
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
        }
        console.log(`📋 Type: C(${parsedKey.chapterIndex}) - ${chapterNames[parsedKey.chapterIndex] || 'unknown'}`)
        cIKeys++
      }
    } else if ('serviceId' in parsedKey && 'hash' in parsedKey) {
      console.log(`📋 Type: C(s, h) - Service Storage/Preimage/Request`)
      console.log(`   Service ID: ${parsedKey.serviceId}`)
      console.log(`   Blake Hash: ${parsedKey.hash}`)
      cshKeys++

      // Try to determine the key type
      const valueBytes = hexToBytes(valueHex)
      try {
        const keyTypeResult = stateService.determineKeyType(valueBytes, parsedKey.hash)
        
        switch (keyTypeResult.keyType) {
          case 'storage':
            console.log(`   ✅ Determined Type: STORAGE`)
            console.log(`   Storage Key Hash: ${keyTypeResult.key}`)
            console.log(`   Value Preview: ${bytesToHex(valueBytes.slice(0, 32))}...`)
            
            // Verify that blake(encode[4]{0xFFFFFFFF} ∥ blake(value)) matches the state key hash
            // The response.key should be blake(encode[4]{0xFFFFFFFF} ∥ blake(value)) (first 27 bytes)
            // This should match blakeHashFromKey from the state key
            const storageHashMatch = keyTypeResult.key.toLowerCase() === parsedKey.hash.toLowerCase()
            if (storageHashMatch) {
              console.log(`   ✅ Verification: Storage key hash matches state key hash`)
              storageHashMatches++
            } else {
              console.log(`   ❌ Verification FAILED: Storage key hash does NOT match state key hash`)
              console.log(`      Computed hash: ${keyTypeResult.key}`)
              console.log(`      Expected hash: ${parsedKey.hash}`)
              storageHashMismatches++
            }
            
            storageKeys++
            break
          case 'preimage':
            console.log(`   ✅ Determined Type: PREIMAGE`)
            console.log(`   Preimage Hash: ${keyTypeResult.preimageHash}`)
            console.log(`   Blob Length: ${keyTypeResult.blob.length} bytes`)
            console.log(`   Blob Preview: ${bytesToHex(keyTypeResult.blob.slice(0, 32))}...`)
            
            // Verify that the Blake hash of the blob matches the preimage hash
            const [hashError, computedHash] = blake2bHash(keyTypeResult.blob)
            if (hashError) {
              console.log(`   ⚠️  Failed to compute blob hash: ${hashError.message}`)
              preimageHashMismatches++
            } else if (computedHash) {
              const hashMatches = computedHash.toLowerCase() === keyTypeResult.preimageHash.toLowerCase()
              if (hashMatches) {
                console.log(`   ✅ Verification: Blob hash matches preimage hash`)
                preimageHashMatches++
                
                // Store preimage info for request key verification
                if (!preimageInfo.has(parsedKey.serviceId)) {
                  preimageInfo.set(parsedKey.serviceId, new Map())
                }
                const servicePreimages = preimageInfo.get(parsedKey.serviceId)!
                servicePreimages.set(keyTypeResult.preimageHash, keyTypeResult.blob.length)
              } else {
                console.log(`   ❌ Verification FAILED: Blob hash does NOT match preimage hash`)
                console.log(`      Computed hash: ${computedHash}`)
                console.log(`      Expected hash: ${keyTypeResult.preimageHash}`)
                preimageHashMismatches++
              }
            }
            
            preimageKeys++
            break
          case 'request':
            console.log(`   ✅ Determined Type: REQUEST`)
            console.log(`   Timeslots: [${keyTypeResult.timeslots.map(t => t.toString()).join(', ')}]`)
            
            // Gray Paper merklization.tex (lines 107-110):
            // ∀ ⟨s, sa⟩ ∈ accounts, ⟨⟨h, l⟩, t⟩ ∈ sa_requests:
            // C(s, encode[4]{l} ∥ h) ↦ encode{var{sequence{encode[4]{x} | x ∈ t}}}
            //
            // Where:
            // - h = preimage hash (hash of the requested preimage blob)
            // - l = blob length (length of the requested preimage blob)
            // - t = sequence of timeslots (the request status)
            //
            // Try to verify by matching against known preimages for this service
            const servicePreimages = preimageInfo.get(parsedKey.serviceId)
            let requestHashMatch = false
            
            if (servicePreimages && servicePreimages.size > 0) {
              // Try each known preimage for this service
              for (const [preimageHash, blobLength] of servicePreimages.entries()) {
                // Compute blake(encode[4]{l} ∥ h) where l=blobLength, h=preimageHash
                const lengthPrefix = new Uint8Array(4)
                const lengthView = new DataView(lengthPrefix.buffer)
                lengthView.setUint32(0, blobLength, true) // little-endian
                
                const preimageHashBytes = hexToBytes(preimageHash)
                const combinedRequestKey = new Uint8Array(
                  lengthPrefix.length + preimageHashBytes.length,
                )
                combinedRequestKey.set(lengthPrefix, 0)
                combinedRequestKey.set(preimageHashBytes, lengthPrefix.length)
                
                const [combinedRequestHashError, combinedRequestHash] = blake2bHash(combinedRequestKey)
                if (!combinedRequestHashError && combinedRequestHash) {
                  const combinedRequestHashBytes = hexToBytes(combinedRequestHash)
                  const combinedRequestHashHex = bytesToHex(combinedRequestHashBytes.slice(0, 27)) // First 27 bytes
                  
                  if (combinedRequestHashHex.toLowerCase() === parsedKey.hash.toLowerCase()) {
                    console.log(`   ✅ Verification: Request key hash matches preimage`)
                    console.log(`      Matched preimage hash: ${preimageHash}`)
                    console.log(`      Matched blob length: ${blobLength} bytes`)
                    console.log(`      Computed: blake(encode[4]{${blobLength}} ∥ ${preimageHash.slice(0, 16)}...)`)
                    requestHashMatches++
                    requestHashMatch = true
                    break
                  }
                }
              }
            }
            
            if (!requestHashMatch) {
              console.log(`   ⚠️  Verification: Could not match request key to any known preimage`)
              console.log(`      State key hash: ${parsedKey.hash}`)
              if (servicePreimages && servicePreimages.size > 0) {
                console.log(`      Checked ${servicePreimages.size} preimage(s) for service ${parsedKey.serviceId}`)
              } else {
                console.log(`      No preimages found for service ${parsedKey.serviceId} (may be requested but not yet provided)`)
              }
              requestHashMismatches++
            }
            
            requestKeys++
            break
        }
      } catch (error) {
        console.log(`   ❌ Could not determine type: ${error instanceof Error ? error.message : String(error)}`)
        console.log(`   Value Preview: ${bytesToHex(valueBytes.slice(0, 64))}...`)
        unknownCshKeys++
      }
    } else {
      console.log(`❓ Unknown parsed key structure:`, parsedKey)
    }

    console.log()
  }

  // Print summary
  console.log('═'.repeat(80))
  console.log('📊 SUMMARY')
  console.log('═'.repeat(80))
  console.log(`Total keys: ${keyvals.length}`)
  console.log(`  C(i) keys: ${cIKeys}`)
  console.log(`  C(255, s) keys: ${c255Keys}`)
  console.log(`  C(s, h) keys: ${cshKeys}`)
  console.log(`    └─ Storage: ${storageKeys}`)
  if (storageKeys > 0) {
    console.log(`      ├─ Hash matches: ${storageHashMatches}`)
    console.log(`      └─ Hash mismatches: ${storageHashMismatches}`)
  }
  console.log(`    └─ Preimage: ${preimageKeys}`)
  if (preimageKeys > 0) {
    console.log(`      ├─ Hash matches: ${preimageHashMatches}`)
    console.log(`      └─ Hash mismatches: ${preimageHashMismatches}`)
  }
  console.log(`    └─ Request: ${requestKeys}`)
  if (requestKeys > 0) {
    console.log(`      ├─ Hash matches: ${requestHashMatches}`)
    console.log(`      └─ Hash mismatches: ${requestHashMismatches}`)
  }
  console.log(`    └─ Unknown: ${unknownCshKeys}`)
  console.log(`Parse errors: ${parseErrors}`)
  console.log('═'.repeat(80))
}

main().catch((error) => {
  console.error('❌ Error:', error)
  process.exit(1)
})

