/**
 * Genesis Header Hash Calculator
 *
 * Calculates the genesis block header hash according to JAM Protocol specifications
 * Reference: https://docs.jamcha.in/basics/genesis-config
 */

import { readFileSync } from 'node:fs'
import { encodeHeader } from '@pbnjam/codec'
import {
  blake2bHash,
  type GenesisHeader,
  parseGenesisHeader,
} from '@pbnjam/core'
import type { BlockHeader, EpochMark, ValidatorKeyTuple } from '@pbnjam/types'
import { ConfigService } from '../infra/node/services/config-service'

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
    entropyAccumulator: genesisHeader.epoch_mark.entropy,
    entropy1: genesisHeader.epoch_mark.tickets_entropy,
    validators: genesisHeader.epoch_mark.validators.map(
      (validator): ValidatorKeyTuple => ({
        bandersnatch: validator.bandersnatch,
        ed25519: validator.ed25519,
      }),
    ),
  }

  return {
    parent: genesisHeader.parent,
    priorStateRoot: genesisHeader.parent_state_root,
    extrinsicHash: genesisHeader.extrinsic_hash,
    timeslot: BigInt(genesisHeader.slot),
    epochMark,
    winnersMark: genesisHeader.tickets_mark ? [] : null, // TODO: Convert tickets_mark to SafroleTicket[]
    authorIndex: BigInt(genesisHeader.author_index),
    vrfSig: genesisHeader.entropy_source,
    offendersMark: genesisHeader.offenders_mark,
    sealSig: genesisHeader.seal,
  }
}

function main() {
  try {
    console.log('🔍 Genesis Header Hash Calculator')
    console.log('=====================================\n')

    // Load and validate genesis header from JSON file
    console.log('📁 Loading genesis header from config/genesis-header.json...')
    const genesisHeaderJson = readFileSync(
      '../config/genesis-header.json',
      'utf8',
    )
    const [parseResultError, parseResult] =
      parseGenesisHeader(genesisHeaderJson)
    if (parseResultError) {
      throw new Error(`Failed to parse genesis header: ${parseResultError}`)
    }

    if (!parseResult) {
      throw new Error(`Failed to parse genesis header`)
    }

    const genesisHeader = parseResult
    console.log('✅ Genesis header loaded and validated successfully\n')

    // Convert to serialization format
    console.log('🔄 Converting to serialization format...')
    const blockHeader = convertGenesisHeaderToSerializationFormat(genesisHeader)
    console.log('✅ Conversion completed\n')

    // Encode the genesis header
    const configService = new ConfigService('tiny')
    console.log('🔧 Encoding genesis header...')
    const [encodedHeaderError, encodedHeader] = encodeHeader(
      blockHeader,
      configService,
    )
    if (encodedHeaderError) {
      throw new Error(`Failed to encode genesis header: ${encodedHeaderError}`)
    }
    console.log(`✅ Header encoded (${encodedHeader.length} bytes)\n`)

    // Hash the encoded header
    console.log('🔐 Calculating header hash...')
    const [headerHashError, headerHash] = blake2bHash(encodedHeader)
    if (headerHashError) {
      throw new Error(`Failed to calculate header hash: ${headerHashError}`)
    }
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
        'The encodeHeader function is correctly implementing the Gray Paper specification.',
      )
    } else {
      console.log(
        '❌ FAILURE: Genesis header hash does not match expected value.',
      )
      console.log(
        'The encodeHeader function may not be correctly implementing the Gray Paper specification.',
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
