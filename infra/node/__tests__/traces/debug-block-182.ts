/**
 * Debug script for block 182 mismatch
 * 
 * This script helps investigate why block 182 has a mismatch in recent history (Chapter 3)
 */

import { config } from 'dotenv'
config()

import * as path from 'node:path'
import { readFileSync } from 'node:fs'
import { hexToBytes } from '@pbnjam/core'
import { decodeRecent } from '@pbnjam/codec'

const WORKSPACE_ROOT = path.join(__dirname, '../../../../')
const BLOCK_182_PATH = path.join(WORKSPACE_ROOT, 'submodules/jam-test-vectors/traces/fuzzy/00000182.json')

const block182 = JSON.parse(readFileSync(BLOCK_182_PATH, 'utf-8'))

// Decode pre-state Chapter 3 (recent history)
const preStateBeta = block182.pre_state?.keyvals?.find(
  (kv: { key: string }) => kv.key === '0x03000000000000000000000000000000000000000000000000000000000000'
)

// Decode post-state Chapter 3 (recent history)
const postStateBeta = block182.post_state?.keyvals?.find(
  (kv: { key: string }) => kv.key === '0x03000000000000000000000000000000000000000000000000000000000000'
)

if (preStateBeta) {
  const [preError, preDecoded] = decodeRecent(hexToBytes(preStateBeta.value))
  if (!preError && preDecoded) {
    console.log('📋 Pre-state Recent History (Block 181):')
    console.log(`  History entries: ${preDecoded.value.history?.length ?? 0}`)
    console.log(`  Total count: ${preDecoded.value.accoutBelt?.totalCount?.toString() ?? '0'}`)
    console.log(`  MMR peaks: ${preDecoded.value.accoutBelt?.peaks?.filter((p: any) => p !== null).length ?? 0} non-null`)
    if (preDecoded.value.history && preDecoded.value.history.length > 0) {
      console.log(`  First entry headerHash: ${preDecoded.value.history[0]?.headerHash?.slice(0, 20)}...`)
      console.log(`  Last entry headerHash: ${preDecoded.value.history[preDecoded.value.history.length - 1]?.headerHash?.slice(0, 20)}...`)
    }
  }
}

if (postStateBeta) {
  const [postError, postDecoded] = decodeRecent(hexToBytes(postStateBeta.value))
  if (!postError && postDecoded) {
    console.log('\n📋 Post-state Recent History (Block 182 - Expected):')
    console.log(`  History entries: ${postDecoded.value.history?.length ?? 0}`)
    console.log(`  Total count: ${postDecoded.value.accoutBelt?.totalCount?.toString() ?? '0'}`)
    console.log(`  MMR peaks: ${postDecoded.value.accoutBelt?.peaks?.filter((p: any) => p !== null).length ?? 0} non-null`)
    if (postDecoded.value.history && postDecoded.value.history.length > 0) {
      console.log(`  First entry headerHash: ${postDecoded.value.history[0]?.headerHash?.slice(0, 20)}...`)
      console.log(`  Last entry headerHash: ${postDecoded.value.history[postDecoded.value.history.length - 1]?.headerHash?.slice(0, 20)}...`)
    }
    
    // Calculate expected currentBlockNumber after block 182
    const expectedTotalCount = postDecoded.value.accoutBelt?.totalCount ?? 0n
    const preTotalCount = preDecoded?.value.accoutBelt?.totalCount ?? 0n
    console.log(`\n🔍 Analysis:`)
    console.log(`  Pre-state totalCount: ${preTotalCount.toString()}`)
    console.log(`  Expected post-state totalCount: ${expectedTotalCount.toString()}`)
    console.log(`  Difference: ${Number(expectedTotalCount) - Number(preTotalCount)} (should be 1 for block 182)`)
    
    // Check if history has the expected number of entries (should be <= 8 for circular buffer)
    const expectedHistoryLength = postDecoded.value.history?.length ?? 0
    const preHistoryLength = preDecoded?.value.history?.length ?? 0
    console.log(`  Pre-state history length: ${preHistoryLength}`)
    console.log(`  Expected post-state history length: ${expectedHistoryLength}`)
    console.log(`  History difference: ${expectedHistoryLength - preHistoryLength} (should be 0 or 1)`)
  }
}

// Check block 182 header
console.log(`\n📦 Block 182 Header:`)
console.log(`  Slot: ${block182.block.header.slot}`)
console.log(`  Parent state root: ${block182.block.header.parent_state_root.slice(0, 20)}...`)

