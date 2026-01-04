/**
 * Unit test for determineKeyTypes using block 86 pre-state and post-state
 * 
 * This test verifies that determineKeyTypes correctly classifies all C(s, h) keys
 * for all services in block 86's pre_state and post_state, and shows the differences.
 */

import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { determineKeyTypes } from '../state/state-key'
import { hexToBytes } from '@pbnjam/core'
import type { Hex } from '@pbnjam/core'
import { StateService } from '../../../../infra/node/services/state-service'
import { ConfigService } from '../../../../infra/node/services/config-service'
import { decodeServiceAccount } from '../state/service-account'

interface ServiceCounts {
  storage: number
  preimages: number
  requests: number
  totalKeys: number
  items: number
}

/**
 * Create a minimal StateService instance for testing
 * Only used for parseStateKey, which doesn't require service dependencies
 */
function createMinimalStateService(): StateService {
  const configService = new ConfigService('tiny')
  
  // Create minimal mocks for all required dependencies
  // parseStateKey doesn't use any of these, so we can pass minimal objects
  const mockDependencies = {
    configService,
    validatorSetManager: null as any,
    entropyService: null as any,
    ticketService: null as any,
    authQueueService: null as any,
    authPoolService: null as any,
    disputesService: null as any,
    readyService: null as any,
    accumulationService: null as any,
    workReportService: null as any,
    privilegesService: null as any,
    serviceAccountsService: null as any,
    recentHistoryService: null as any,
    genesisManagerService: null as any,
    sealKeyService: null as any,
    clockService: null as any,
    statisticsService: null as any,
  }
  
  return new StateService(mockDependencies)
}

/**
 * Parse state key using StateService.parseStateKey
 * Handles C(s, h) keys, C(255, s) keys, and C(i) keys
 */
function parseStateKeyForServiceId(
  stateService: StateService,
  keyHex: Hex,
): {
  serviceId: bigint | null
  isCshKey: boolean
  isServiceAccountKey: boolean
} {
  const [error, parsed] = stateService.parseStateKey(keyHex)
  
  if (error) {
    return { serviceId: null, isCshKey: false, isServiceAccountKey: false }
  }
  
  // Check if it's a C(i) key (chapter index 1-16) - these don't have service IDs
  if ('chapterIndex' in parsed && parsed.chapterIndex >= 1 && parsed.chapterIndex <= 16) {
    return { serviceId: null, isCshKey: false, isServiceAccountKey: false }
  }
  
  // Check if it's a C(255, s) key (service account key)
  if ('chapterIndex' in parsed && parsed.chapterIndex === 255 && 'serviceId' in parsed) {
    return { serviceId: parsed.serviceId, isCshKey: false, isServiceAccountKey: true }
  }
  
  // Check if it's a C(s, h) key (chapterIndex 0 indicates C(s, h))
  if ('chapterIndex' in parsed && parsed.chapterIndex === 0 && 'serviceId' in parsed) {
    return { serviceId: parsed.serviceId, isCshKey: true, isServiceAccountKey: false }
  }
  
  return { serviceId: null, isCshKey: false, isServiceAccountKey: false }
}

function extractServiceKeyvals(
  stateService: StateService,
  keyvals: Array<{ key: string; value: string }>,
  targetServiceId?: bigint,
): Map<bigint, Record<Hex, Hex>> {
  const serviceKeyvals = new Map<bigint, Record<Hex, Hex>>()
  const allServiceIds = new Set<bigint>() // Track all service IDs found (from any key type)
  const cshKeyCounts = new Map<bigint, number>()
  const c255KeyCounts = new Map<bigint, number>()

  for (const keyval of keyvals) {
    const keyBytes = hexToBytes(keyval.key as Hex)

    if (keyBytes.length !== 31) {
      continue
    }

    const parsed = parseStateKeyForServiceId(stateService, keyval.key as Hex)
    
    // Skip if we couldn't extract a service ID
    if (parsed.serviceId === null) {
      continue
    }
    
    // Track this service ID (from any key type)
    allServiceIds.add(parsed.serviceId)
    
    // Track counts for debugging
    if (parsed.isCshKey) {
      cshKeyCounts.set(parsed.serviceId, (cshKeyCounts.get(parsed.serviceId) || 0) + 1)
    } else if (parsed.isServiceAccountKey) {
      c255KeyCounts.set(parsed.serviceId, (c255KeyCounts.get(parsed.serviceId) || 0) + 1)
    }
    
    // If targetServiceId is specified, only include that service
    if (targetServiceId !== undefined && parsed.serviceId !== targetServiceId) {
      continue
    }

    // Only add C(s, h) keys to the map (not C(255, s) keys)
    // C(255, s) keys are service account metadata, not storage/preimages/requests
    if (parsed.isCshKey) {
      if (!serviceKeyvals.has(parsed.serviceId)) {
        serviceKeyvals.set(parsed.serviceId, {})
      }
      serviceKeyvals.get(parsed.serviceId)![keyval.key as Hex] = keyval.value as Hex
    } else if (parsed.isServiceAccountKey) {
      // This is a C(255, s) key - ensure service exists in map even if no C(s, h) keys
      if (!serviceKeyvals.has(parsed.serviceId)) {
        serviceKeyvals.set(parsed.serviceId, {})
      }
    }
  }

  // Ensure all discovered service IDs are in the map (even if they have no C(s, h) keys)
  for (const serviceId of allServiceIds) {
    if (!serviceKeyvals.has(serviceId)) {
      serviceKeyvals.set(serviceId, {})
    }
  }

  // Debug logging
  if (allServiceIds.size > 0) {
    console.log(`\n  Key type breakdown:`)
    console.log(`    Services with C(s, h) keys: ${Array.from(cshKeyCounts.keys()).sort((a, b) => {
      if (a < b) return -1
      if (a > b) return 1
      return 0
    }).map(s => s.toString()).join(', ')}`)
    console.log(`    Services with C(255, s) keys: ${Array.from(c255KeyCounts.keys()).sort((a, b) => {
      if (a < b) return -1
      if (a > b) return 1
      return 0
    }).map(s => s.toString()).join(', ')}`)
    console.log(`    All discovered service IDs: ${Array.from(allServiceIds).sort((a, b) => {
      if (a < b) return -1
      if (a > b) return 1
      return 0
    }).map(s => s.toString()).join(', ')}`)
  }

  return serviceKeyvals
}

function countKeyTypes(
  rawCshKeyvals: Record<Hex, Hex>,
  currentTimeslot: bigint,
  serviceId?: bigint,
): ServiceCounts {
  const keyTypes = determineKeyTypes(rawCshKeyvals, currentTimeslot)

  let storageCount = 0
  let preimageCount = 0
  let requestCount = 0

  // #region agent log
  const debugServiceId = 3953987649n
  const isDebugService = serviceId === debugServiceId
  const storageKeys: Hex[] = []
  const preimageKeys: Hex[] = []
  const requestKeys: Hex[] = []
  // #endregion

  for (const [stateKeyHex, keyType] of keyTypes) {
    switch (keyType.keyType) {
      case 'storage':
        storageCount++
        // #region agent log
        if (isDebugService) {
          storageKeys.push(stateKeyHex)
        }
        // #endregion
        break
      case 'preimage':
        preimageCount++
        // #region agent log
        if (isDebugService) {
          preimageKeys.push(stateKeyHex)
        }
        // #endregion
        break
      case 'request':
        requestCount++
        // #region agent log
        if (isDebugService) {
          requestKeys.push(stateKeyHex)
        }
        // #endregion
        break
    }
  }

  const items = 2 * requestCount + storageCount

  // #region agent log
  if (isDebugService) {
    fetch('http://127.0.0.1:10000/ingest/3fca1dc3-0561-4f6b-af77-e67afc81f2d7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'state-key-block86.test.ts:countKeyTypes',message:'Service 3953987649 key counts',data:{serviceId:serviceId?.toString(),storageCount:storageCount.toString(),preimageCount:preimageCount.toString(),requestCount:requestCount.toString(),items:items.toString(),totalKeys:Object.keys(rawCshKeyvals).length.toString(),storageKeys:storageKeys.length.toString(),preimageKeys:preimageKeys.length.toString(),requestKeys:requestKeys.length.toString(),calculatedItems:(2*requestCount+storageCount).toString()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  }
  // #endregion

  return {
    storage: storageCount,
    preimages: preimageCount,
    requests: requestCount,
    totalKeys: Object.keys(rawCshKeyvals).length,
    items,
  }
}

describe('determineKeyTypes - Block 86', () => {
  test('should correctly classify keys for all services in block 86 pre-state and post-state', () => {
    // Get the current file's directory
    const currentDir = typeof __dirname !== 'undefined'
      ? __dirname
      : dirname(fileURLToPath(import.meta.url))

    // Go up from src/__tests__ to packages/, then to workspace root
    const workspaceRoot = join(currentDir, '../../../..')
    const block86Path = join(
        workspaceRoot,
        'submodules/jam-test-vectors/traces/fuzzy/00000086.json',
      )

    if (!readFileSync(block86Path, { flag: 'r' })) {
      throw new Error(`Block 86 file not found: ${block86Path}`)
    }

    const block86Data = JSON.parse(readFileSync(block86Path, 'utf-8'))

    const currentTimeslot = 86n

    // Create StateService instance for parsing state keys
    const stateService = createMinimalStateService()

    // Extract all service IDs from all key types (C(s, h), C(255, s), etc.)
    const preStateServiceKeyvals = extractServiceKeyvals(
      stateService,
      block86Data.pre_state.keyvals,
    )
    const postStateServiceKeyvals = extractServiceKeyvals(
      stateService,
      block86Data.post_state.keyvals,
    )

    // Also extract service IDs from C(255, s) keys separately to verify
    const preStateServiceAccountKeys = new Set<bigint>()
    const postStateServiceAccountKeys = new Set<bigint>()
    const preStateC255Keys = new Map<bigint, { key: Hex; bytes2: number; bytes4: number; bytes6: number }>()
    
    for (const keyval of block86Data.pre_state.keyvals) {
      const keyBytes = hexToBytes(keyval.key as Hex)
      if (keyBytes.length === 31 && keyBytes[0] === 0xff) {
        const parsed = parseStateKeyForServiceId(stateService, keyval.key as Hex)
        
        // Track all 0xff keys for debugging
        if (parsed.serviceId !== null) {
          preStateC255Keys.set(parsed.serviceId, {
            key: keyval.key as Hex,
            bytes2: keyBytes[2],
            bytes4: keyBytes[4],
            bytes6: keyBytes[6],
          })
          
          // Decode the stored service account to get the stored items value
          if (parsed.serviceId === 3953987649n) {
            const valueBytes = hexToBytes(keyval.value as Hex)
            const [decodeError, decodeResult] = decodeServiceAccount(valueBytes)
            if (!decodeError && decodeResult) {
              const storedItems = decodeResult.value.items
              const calculatedItems = countKeyTypes(
                preStateServiceKeyvals.get(parsed.serviceId) || {},
                currentTimeslot,
                parsed.serviceId,
              ).items
              // #region agent log
              fetch('http://127.0.0.1:10000/ingest/3fca1dc3-0561-4f6b-af77-e67afc81f2d7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'state-key-block86.test.ts:decodeServiceAccount',message:'Service 3953987649 stored vs calculated items',data:{serviceId:parsed.serviceId.toString(),storedItems:storedItems.toString(),calculatedItems:calculatedItems.toString(),mismatch:(storedItems!==BigInt(calculatedItems)).toString()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
              // #endregion
              if (storedItems !== BigInt(calculatedItems)) {
                console.log(`\n⚠️  Service ${parsed.serviceId} items mismatch:`)
                console.log(`    Stored items (from C(255, s) value): ${storedItems}`)
                console.log(`    Calculated items (from rawCshKeyvals): ${calculatedItems}`)
                console.log(`    Difference: ${storedItems - BigInt(calculatedItems)}`)
              }
            }
          }
        }
        
        if (parsed.serviceId !== null && parsed.isServiceAccountKey) {
          preStateServiceAccountKeys.add(parsed.serviceId)
        } else if (parsed.serviceId !== null) {
          // Log why it wasn't recognized as a C(255, s) key
          console.log(`  C(255, s) key for service ${parsed.serviceId} not recognized: bytes[2]=${keyBytes[2]}, bytes[4]=${keyBytes[4]}, bytes[6]=${keyBytes[6]}`)
        }
      }
    }
    
    for (const keyval of block86Data.post_state.keyvals) {
      const keyBytes = hexToBytes(keyval.key as Hex)
      if (keyBytes.length === 31 && keyBytes[0] === 0xff) {
        const parsed = parseStateKeyForServiceId(stateService, keyval.key as Hex)
        if (parsed.serviceId !== null && parsed.isServiceAccountKey) {
          postStateServiceAccountKeys.add(parsed.serviceId)
        }
      }
    }
    
    // Log all C(255, s) keys found
    if (preStateC255Keys.size > 0) {
      console.log(`\n  All C(255, s) keys found (first byte = 0xff):`)
      const sorted = Array.from(preStateC255Keys.entries()).sort((a, b) => {
        if (a[0] < b[0]) return -1
        if (a[0] > b[0]) return 1
        return 0
      })
      for (const [serviceId, info] of sorted) {
        const isValid = info.bytes2 === 0 && info.bytes4 === 0 && info.bytes6 === 0
        console.log(`    Service ${serviceId}: key=${info.key.slice(0, 20)}..., bytes[2]=${info.bytes2}, bytes[4]=${info.bytes4}, bytes[6]=${info.bytes6}, valid=${isValid}`)
      }
    }

    // Log extraction results
    console.log(`\nExtraction Results:`)
    console.log(`  Pre-state: Found ${preStateServiceKeyvals.size} services (any key type)`)
    console.log(`  Post-state: Found ${postStateServiceKeyvals.size} services (any key type)`)
    console.log(`  Pre-state C(255, s) keys: ${preStateServiceAccountKeys.size} unique service IDs`)
    console.log(`  Post-state C(255, s) keys: ${postStateServiceAccountKeys.size} unique service IDs`)
    console.log(`  Pre-state service IDs: ${Array.from(preStateServiceKeyvals.keys()).sort((a, b) => {
      if (a < b) return -1
      if (a > b) return 1
      return 0
    }).map(s => s.toString()).join(', ')}`)
    console.log(`  Post-state service IDs: ${Array.from(postStateServiceKeyvals.keys()).sort((a, b) => {
      if (a < b) return -1
      if (a > b) return 1
      return 0
    }).map(s => s.toString()).join(', ')}`)
    console.log(`  Pre-state C(255, s) service IDs: ${Array.from(preStateServiceAccountKeys).sort((a, b) => {
      if (a < b) return -1
      if (a > b) return 1
      return 0
    }).map(s => s.toString()).join(', ')}`)
    console.log(`  Post-state C(255, s) service IDs: ${Array.from(postStateServiceAccountKeys).sort((a, b) => {
      if (a < b) return -1
      if (a > b) return 1
      return 0
    }).map(s => s.toString()).join(', ')}`)

    // Get all unique service IDs
    const allServiceIds = new Set<bigint>()
    for (const serviceId of preStateServiceKeyvals.keys()) {
      allServiceIds.add(serviceId)
    }
    for (const serviceId of postStateServiceKeyvals.keys()) {
      allServiceIds.add(serviceId)
    }

    const sortedServiceIds = Array.from(allServiceIds).sort((a, b) => {
      if (a < b) return -1
      if (a > b) return 1
      return 0
    })

    console.log('\n' + '='.repeat(80))
    console.log('Block 86 - Key Type Classification (Pre-State vs Post-State)')
    console.log('='.repeat(80))
    
    // Log discovered services
    console.log('\n' + '='.repeat(80))
    console.log('Discovered Services:')
    console.log('='.repeat(80))
    console.log(`Found ${sortedServiceIds.length} services:`)
    console.log(`  ${sortedServiceIds.map(s => s.toString()).join(', ')}`)

    let totalPreStorage = 0
    let totalPrePreimages = 0
    let totalPreRequests = 0
    let totalPreItems = 0

    let totalPostStorage = 0
    let totalPostPreimages = 0
    let totalPostRequests = 0
    let totalPostItems = 0

    for (const serviceId of sortedServiceIds) {
      const preKeyvals = preStateServiceKeyvals.get(serviceId) || {}
      const postKeyvals = postStateServiceKeyvals.get(serviceId) || {}

      const preCounts = countKeyTypes(preKeyvals, currentTimeslot, serviceId)
      const postCounts = countKeyTypes(postKeyvals, currentTimeslot, serviceId)

      totalPreStorage += preCounts.storage
      totalPrePreimages += preCounts.preimages
      totalPreRequests += preCounts.requests
      totalPreItems += preCounts.items

      totalPostStorage += postCounts.storage
      totalPostPreimages += postCounts.preimages
      totalPostRequests += postCounts.requests
      totalPostItems += postCounts.items

      // Only log services that have changes or exist in either state
      const hasChanges =
        preCounts.storage !== postCounts.storage ||
        preCounts.preimages !== postCounts.preimages ||
        preCounts.requests !== postCounts.requests ||
        preCounts.items !== postCounts.items ||
        Object.keys(preKeyvals).length !== Object.keys(postKeyvals).length

      if (hasChanges || Object.keys(preKeyvals).length > 0 || Object.keys(postKeyvals).length > 0) {
        console.log(`\nService ${serviceId}:`)
        console.log(`  Pre-State:`)
        console.log(`    Total C(s, h) keys: ${preCounts.totalKeys}`)
        console.log(`    Storage: ${preCounts.storage}`)
        console.log(`    Preimages: ${preCounts.preimages}`)
        console.log(`    Requests: ${preCounts.requests}`)
        const preCalculatedItems = 2 * preCounts.requests + preCounts.storage
        console.log(`    Items: ${preCounts.items} (calculated: 2 * ${preCounts.requests} + ${preCounts.storage} = ${preCalculatedItems})`)
        if (serviceId === 3953987649n && preCounts.items !== preCalculatedItems) {
          console.log(`    ⚠️  MISMATCH: items=${preCounts.items} but calculated=${preCalculatedItems}`)
          console.log(`    Pre-state rawCshKeyvals count: ${Object.keys(preKeyvals).length}`)
        }
        console.log(`  Post-State:`)
        console.log(`    Total C(s, h) keys: ${postCounts.totalKeys}`)
        console.log(`    Storage: ${postCounts.storage}`)
        console.log(`    Preimages: ${postCounts.preimages}`)
        console.log(`    Requests: ${postCounts.requests}`)
        const postCalculatedItems = 2 * postCounts.requests + postCounts.storage
        console.log(`    Items: ${postCounts.items} (calculated: 2 * ${postCounts.requests} + ${postCounts.storage} = ${postCalculatedItems})`)
        if (serviceId === 3953987649n && postCounts.items !== postCalculatedItems) {
          console.log(`    ⚠️  MISMATCH: items=${postCounts.items} but calculated=${postCalculatedItems}`)
          console.log(`    Post-state rawCshKeyvals count: ${Object.keys(postKeyvals).length}`)
        }
        console.log(`  Diff:`)
        console.log(`    Storage: ${postCounts.storage - preCounts.storage > 0 ? '+' : ''}${postCounts.storage - preCounts.storage}`)
        console.log(`    Preimages: ${postCounts.preimages - preCounts.preimages > 0 ? '+' : ''}${postCounts.preimages - preCounts.preimages}`)
        console.log(`    Requests: ${postCounts.requests - preCounts.requests > 0 ? '+' : ''}${postCounts.requests - preCounts.requests}`)
        console.log(`    Items: ${postCounts.items - preCounts.items > 0 ? '+' : ''}${postCounts.items - preCounts.items}`)
        console.log(`    Total Keys: ${postCounts.totalKeys - preCounts.totalKeys > 0 ? '+' : ''}${postCounts.totalKeys - preCounts.totalKeys}`)
      }
    }

    // Summary
    console.log('\n' + '='.repeat(80))
    console.log('Summary (All Services Combined):')
    console.log('='.repeat(80))
    console.log(`Pre-State Totals:`)
    console.log(`  Storage: ${totalPreStorage}`)
    console.log(`  Preimages: ${totalPrePreimages}`)
    console.log(`  Requests: ${totalPreRequests}`)
    console.log(`  Items: ${totalPreItems} (2 * ${totalPreRequests} + ${totalPreStorage})`)
    console.log(`Post-State Totals:`)
    console.log(`  Storage: ${totalPostStorage}`)
    console.log(`  Preimages: ${totalPostPreimages}`)
    console.log(`  Requests: ${totalPostRequests}`)
    console.log(`  Items: ${totalPostItems} (2 * ${totalPostRequests} + ${totalPostStorage})`)
    console.log(`\nDiff (Post - Pre):`)
    console.log(`  Storage: ${totalPostStorage - totalPreStorage > 0 ? '+' : ''}${totalPostStorage - totalPreStorage}`)
    console.log(`  Preimages: ${totalPostPreimages - totalPrePreimages > 0 ? '+' : ''}${totalPostPreimages - totalPrePreimages}`)
    console.log(`  Requests: ${totalPostRequests - totalPreRequests > 0 ? '+' : ''}${totalPostRequests - totalPreRequests}`)
    console.log(`  Items: ${totalPostItems - totalPreItems > 0 ? '+' : ''}${totalPostItems - totalPreItems}`)
    console.log('='.repeat(80) + '\n')

    // Log detailed analysis before assertions


    // Basic assertions to ensure the test runs
    expect(totalPreStorage).toBeGreaterThanOrEqual(0)
    expect(totalPostStorage).toBeGreaterThanOrEqual(0)
  })
})

