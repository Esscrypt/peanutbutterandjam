/**
 * Genesis Header Hash Calculator
 *
 * Calculates the genesis block header hash according to JAM Protocol specifications
 * Reference: https://docs.jamcha.in/basics/genesis-config
 */

import { readFileSync } from 'node:fs'
import { blake2bHash, type GenesisHeader, parseGenesisHeader } from '@pbnj/core'
import type {
  BlockHeader,
  EpochMark,
  ValidatorKeyTuple,
} from '@pbnj/serialization'
import { encodeBlockHeader } from '@pbnj/serialization'

// Expected hash from JAM documentation
const EXPECTED_HASH =
  '0xe864d485113737c28c2fef3b2aed39cb2f289a369b15c54e9c44720bcfdc0ca0'

/**
 * Convert genesis header JSON format to serialization format
 */
function convertGenesisHeaderToSerializationFormat(
  genesisHeader: GenesisHeader,
): BlockHeader {
  // Convert epoch mark structure
  const epochMark: EpochMark = {
    entropyAccumulator: genesisHeader.epoch_mark.entropy as `0x${string}`,
    entropy1: genesisHeader.epoch_mark.tickets_entropy as `0x${string}`,
    validators: genesisHeader.epoch_mark.validators.map(
      (validator): ValidatorKeyTuple => ({
        bandersnatchKey: validator.bandersnatch as `0x${string}`,
        ed25519Key: validator.ed25519 as `0x${string}`,
      }),
    ),
  }

  return {
    parentHash: genesisHeader.parent as `0x${string}`,
    priorStateRoot: genesisHeader.parent_state_root as `0x${string}`,
    extrinsicHash: genesisHeader.extrinsic_hash as `0x${string}`,
    timeslot: BigInt(genesisHeader.slot),
    epochMark,
    winnersMark: genesisHeader.tickets_mark ? [] : undefined, // TODO: Convert tickets_mark to SafroleTicket[]
    authorIndex: BigInt(genesisHeader.author_index),
    vrfSignature: genesisHeader.entropy_source as `0x${string}`,
    offendersMark: new Uint8Array(genesisHeader.offenders_mark),
    sealSignature: genesisHeader.seal as `0x${string}`,
  }
}

function main() {
  try {
    console.log('🔍 Genesis Header Hash Calculator')
    console.log('=====================================\n')

    // Load and validate genesis header from JSON file
    console.log('📁 Loading genesis header from config/genesis-header.json...')
    const genesisHeaderJson = readFileSync(
      './config/genesis-header.json',
      'utf8',
    )
    const parseResult = parseGenesisHeader(genesisHeaderJson)

    if (!parseResult.success) {
      throw new Error(`Failed to parse genesis header: ${parseResult.error}`)
    }

    const genesisHeader = parseResult.data
    console.log('✅ Genesis header loaded and validated successfully\n')

    // Convert to serialization format
    console.log('🔄 Converting to serialization format...')
    const blockHeader = convertGenesisHeaderToSerializationFormat(genesisHeader)
    console.log('✅ Conversion completed\n')

    // Encode the genesis header
    console.log('🔧 Encoding genesis header...')
    const encodedHeader = encodeBlockHeader(blockHeader)
    console.log(`✅ Header encoded (${encodedHeader.length} bytes)\n`)

    // Hash the encoded header
    console.log('🔐 Calculating header hash...')
    const headerHash = blake2bHash(encodedHeader)
    console.log(`✅ Header hash calculated: ${headerHash}\n`)

    // Compare with expected hash
    console.log('📊 Results:')
    console.log('=====================================')
    console.log(`Expected Hash: ${EXPECTED_HASH}`)
    console.log(`Calculated Hash: ${headerHash}`)
    console.log(`Match: ${headerHash === EXPECTED_HASH ? '✅ YES' : '❌ NO'}`)
    console.log('=====================================\n')

    if (headerHash === EXPECTED_HASH) {
      console.log('🎉 SUCCESS: Genesis header hash matches expected value!')
      console.log(
        'The encodeBlockHeader function is correctly implementing the Gray Paper specification.',
      )
    } else {
      console.log(
        '❌ FAILURE: Genesis header hash does not match expected value.',
      )
      console.log(
        'The encodeBlockHeader function may not be correctly implementing the Gray Paper specification.',
      )

      // Debug information
      console.log('\n🔍 Debug Information:')
      console.log(
        'Encoded header (first 100 bytes):',
        Array.from(encodedHeader.slice(0, 100))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join(''),
      )
      console.log('Encoded header length:', encodedHeader.length)
    }
  } catch (error) {
    console.error(
      '❌ Error:',
      error instanceof Error ? error.message : String(error),
    )
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}
