/**
 * Debug Genesis Hash Calculator
 *
 * Loads genesis.json from test vectors and calculates the genesis hash
 * to verify it matches the expected parent hash from the first block
 */

import { readFileSync } from 'node:fs'
import * as path from 'node:path'
import type tyGenesisJsoncore
import { convertGenesisToBlockHeaderggggggggggggggggenesis
import { calculateBlockHashFromHeaderkHashFrom@pbnjaserialization
import fiConfigService../../../../infra/node/services/config-service/services/config-service/services/config-service/services/config-service/services/config-service/services/config-service/services/config-service/services/config-service/services/config-service/services/config-service/services/config-service/services/config-service/services/config-service/services/config-service/services/config-service/services/config-service/services/config-service/services/config-service/services/config-service'

const WORKSPACE_ROOT = path.join(__dirname, '../')
const GENESIS_JSON_PATH = path.join(
  WORKSPACE_ROOT,
  'submodules/jam-test-vectors/traces/fallback/genesis.json',
)
const BLOCK_JSON_PATH = path.join(
  WORKSPACE_ROOT,
  'submodules/jam-test-vectors/traces/fallback/00000001.json',
)

// Expected parent hash from the first block
const EXPECTED_PARENT_HASH =
  '0x2bf11dc5e1c7b9bbaafc2c8533017abc12daeb0baf22c92509ad50f7875e5716'

function main() {
  try {
    console.log('🔍 Debug Genesis Hash Calculator')
    console.log('=====================================\n')

    // Load genesis.json
    console.log(`📁 Loading genesis.json from: ${GENESIS_JSON_PATH}`)
    const genesisJsonContent = readFileSync(GENESIS_JSON_PATH, 'utf-8')
    const genesisJson: GenesisJson = JSON.parse(genesisJsonContent)
    console.log('✅ Genesis JSON loaded successfully\n')

    // Load block JSON to get expected parent hash
    console.log(`📁 Loading block JSON from: ${BLOCK_JSON_PATH}`)
    const blockJsonContent = readFileSync(BLOCK_JSON_PATH, 'utf-8')
    const blockJson = JSON.parse(blockJsonContent)
    const expectedParentHash = blockJson.block.header.parent
    console.log(`✅ Expected parent hash: ${expectedParentHash}\n`)

    // Convert genesis JSON to BlockHeader - test current mapping
    console.log('🔄 Converting genesis JSON to BlockHeader format (current mapping)...')
    const genesisBlockHeader = convertGenesisToBlockHeader(genesisJson)
    console.log('✅ Conversion completed')
    console.log('   Genesis header:', {
      parent: genesisBlockHeader.parent,
      priorStateRoot: genesisBlockHeader.priorStateRoot,
      timeslot: genesisBlockHeader.timeslot.toString(),
      authorIndex: genesisBlockHeader.authorIndex.toString(),
      hasEpochMark: !!genesisBlockHeader.epochMark,
      hasWinnersMark: !!genesisBlockHeader.winnersMark,
      hasOffendersMark: !!genesisBlockHeader.offendersMark,
      vrfSigLength: genesisBlockHeader.vrfSig.length,
      sealSigLength: genesisBlockHeader.sealSig.length,
    })
    if (genesisBlockHeader.epochMark) {
      console.log('   Epoch mark mapping (current):')
      console.log(`     entropy1: ${genesisBlockHeader.epochMark.entropy1}`)
      console.log(`     entropyAccumulator: ${genesisBlockHeader.epochMark.entropyAccumulator}`)
      console.log(`     From JSON: entropy=${genesisJson.header.epoch_mark.entropy}`)
      console.log(`     From JSON: tickets_entropy=${genesisJson.header.epoch_mark.tickets_entropy}`)
    }
    console.log()

    // Test swapped mapping
    console.log('🔄 Testing swapped mapping...')
    const swappedBlockHeader: typeof genesisBlockHeader = {
      ...genesisBlockHeader,
      epochMark: genesisBlockHeader.epochMark
        ? {
            entropyAccumulator: genesisJson.header.epoch_mark.entropy,
            entropy1: genesisJson.header.epoch_mark.tickets_entropy,
            validators: genesisBlockHeader.epochMark.validators,
          }
        : null,
    }
    console.log('   Epoch mark mapping (swapped):')
    if (swappedBlockHeader.epochMark) {
      console.log(`     entropy1: ${swappedBlockHeader.epochMark.entropy1}`)
      console.log(`     entropyAccumulator: ${swappedBlockHeader.epochMark.entropyAccumulator}`)
    }
    console.log()

    // Calculate genesis hash with current mapping
    console.log('🔧 Calculating genesis hash (current mapping)...')
    const configService = new ConfigService('tiny')
    const [hashError, calculatedHash] = calculateBlockHashFromHeader(
      genesisBlockHeader,
      configService,
    )

    if (hashError) {
      throw new Error(`Failed to calculate genesis hash: ${hashError.message}`)
    }

    if (!calculatedHash) {
      throw new Error('Calculated hash is null or undefined')
    }

    console.log(`✅ Genesis hash (current): ${calculatedHash}\n`)

    // Calculate genesis hash with swapped mapping
    console.log('🔧 Calculating genesis hash (swapped mapping)...')
    const [swappedHashError, swappedHash] = calculateBlockHashFromHeader(
      swappedBlockHeader,
      configService,
    )

    if (swappedHashError) {
      console.log(`⚠️  Failed to calculate swapped hash: ${swappedHashError.message}\n`)
    } else if (swappedHash) {
      console.log(`✅ Genesis hash (swapped): ${swappedHash}\n`)
    }

    // Compare with expected parent hash
    console.log('📊 Comparison Results:')
    console.log('=====================================')
    console.log(`Expected Parent Hash: ${expectedParentHash}`)
    console.log(`Calculated Genesis Hash (current): ${calculatedHash}`)
    if (swappedHash) {
      console.log(`Calculated Genesis Hash (swapped): ${swappedHash}`)
    }
    console.log()

    const currentMatch = calculatedHash === expectedParentHash
    const swappedMatch = swappedHash === expectedParentHash

    if (currentMatch) {
      console.log('✅ SUCCESS! Current mapping matches expected parent hash\n')
    } else if (swappedMatch) {
      console.log('✅ SUCCESS! Swapped mapping matches expected parent hash')
      console.log('⚠️  The mapping in convertGenesisToBlockHeader needs to be fixed!\n')
    } else {
      console.log('❌ MISMATCH DETECTED!')
      console.log(`   Current mapping match: ${currentMatch ? '✅ YES' : '❌ NO'}`)
      console.log(`   Swapped mapping match: ${swappedMatch ? '✅ YES' : '❌ NO'}\n`)
      console.log('Possible reasons:')
      console.log('1. Genesis header encoding might be different')
      console.log('2. Block header might reference a different genesis')
      console.log('3. Test vector might use a different genesis configuration')
      console.log('4. Hash calculation might be incorrect\n')

      // Show byte-by-byte comparison
      console.log('Byte-by-byte comparison (current):')
      const expectedBytes = expectedParentHash.slice(2)
      const calculatedBytes = calculatedHash.slice(2)
      const minLength = Math.min(expectedBytes.length, calculatedBytes.length)
      let firstDiff = -1
      for (let i = 0; i < minLength; i += 2) {
        const expectedByte = expectedBytes.slice(i, i + 2)
        const calculatedByte = calculatedBytes.slice(i, i + 2)
        if (expectedByte !== calculatedByte && firstDiff === -1) {
          firstDiff = i / 2
          console.log(
            `   First difference at byte ${i / 2}: expected ${expectedByte}, got ${calculatedByte}`,
          )
          break
        }
      }
      console.log()
    }
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : String(error))
    if (error instanceof Error && error.stack) {
      console.error('Stack:', error.stack)
    }
    process.exit(1)
  }
}

main()

