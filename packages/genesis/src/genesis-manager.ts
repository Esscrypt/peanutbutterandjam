/**
 * Genesis Manager Implementation
 *
 * Handles loading chain-spec.json files and building Gray Paper compliant
 * GenesisState. Provides complete chain spec to genesis state conversion.
 */

import { readFileSync } from 'node:fs'
import { encodeHeader } from '@pbnjam/codec'
import type {
  ChainSpecJson,
  GenesisHeader,
  GenesisJson,
  Hex,
} from '@pbnjam/core'
import {
  blake2bHash,
  parseChainSpec,
  parseGenesisHeader,
  parseGenesisJson,
  zeroHash,
} from '@pbnjam/core'
import type {
  BlockHeader,
  GenesisState,
  IConfigService,
  ParsedBootnode,
  Safe,
  ValidatorKeyTuple,
} from '@pbnjam/types'
import { safeError, safeResult } from '@pbnjam/types'

// Helper methods merged into main class

/**
 * Load and parse chain-spec.json file (returns Zod-validated input)
 */
export function loadChainSpec(filePath: string): Safe<ChainSpecJson> {
  const content = readFileSync(filePath, 'utf8')
  return parseChainSpec(content)
}

/**
 * Load and parse genesis.json file
 */
export function loadGenesisJson(filePath: string): Safe<GenesisJson> {
  const content = readFileSync(filePath, 'utf8')
  return parseGenesisJson(content)
}

/**
 * Load and parse genesis-header.json file
 */
export function loadGenesisHeader(filePath: string): Safe<GenesisHeader> {
  const content = readFileSync(filePath, 'utf8')
  return parseGenesisHeader(content)
}

/**
 * Convert genesis-header.json to BlockHeader format
 */
export function convertGenesisHeaderToBlockHeader(
  genesisHeader: GenesisHeader,
): BlockHeader {
  return {
    parent: genesisHeader.parent,
    priorStateRoot: genesisHeader.parent_state_root,
    extrinsicHash: genesisHeader.extrinsic_hash,
    timeslot: BigInt(genesisHeader.slot),
    epochMark: {
      entropyAccumulator: genesisHeader.epoch_mark.tickets_entropy,
      entropy1: genesisHeader.epoch_mark.entropy,
      validators: genesisHeader.epoch_mark.validators.map((validator) => ({
        bandersnatch: validator.bandersnatch,
        ed25519: validator.ed25519,
      })),
    },
    winnersMark: genesisHeader.tickets_mark ? [] : null,
    offendersMark: genesisHeader.offenders_mark,
    authorIndex: BigInt(genesisHeader.author_index),
    vrfSig: genesisHeader.entropy_source,
    sealSig: genesisHeader.seal,
  }
}

/**
 * Load and compute hash from genesis-header.json
 */
export function loadGenesisHeaderAndComputeHash(
  filePath: string,
  config: IConfigService,
): Safe<{ genesisHeader: BlockHeader; genesisHash: Hex }> {
  const [error, genesisHeaderJson] = loadGenesisHeader(filePath)
  if (error) {
    return safeError(error)
  }
  if (!genesisHeaderJson) {
    return safeError(new Error('Genesis header not found'))
  }
  const genesisHeader = convertGenesisHeaderToBlockHeader(genesisHeaderJson)
  const genesisHash = computeGenesisHeaderHash(genesisHeader, config)

  return safeResult({
    genesisHeader,
    genesisHash,
  })
}

/**
 * Create genesis header
 */
export function createGenesisHeader(genesisState: GenesisState): BlockHeader {
  return {
    parent: zeroHash,
    priorStateRoot: zeroHash,
    extrinsicHash: zeroHash,
    timeslot: 0n,
    epochMark: {
      entropyAccumulator: zeroHash,
      entropy1: zeroHash,
      validators: genesisState.activeset.map(
        (validator: ValidatorKeyTuple) => ({
          bandersnatch: validator.bandersnatch,
          ed25519: validator.ed25519,
        }),
      ),
    },
    winnersMark: null,
    offendersMark: [],
    authorIndex: 0n,
    vrfSig: zeroHash,
    sealSig: zeroHash,
  }
}

/**
 * Parse bootnode string into structured format
 * Format: "peerId@host:port"
 */
export function parseBootnode(bootnodeString: string): ParsedBootnode {
  const parts = bootnodeString.split('@')
  if (parts.length !== 2) {
    throw new Error(`Invalid bootnode format: ${bootnodeString}`)
  }

  const peerId = parts[0]
  const addressParts = parts[1].split(':')
  if (addressParts.length !== 2) {
    throw new Error(`Invalid bootnode address format: ${parts[1]}`)
  }

  const host = addressParts[0]
  const port = Number.parseInt(addressParts[1], 10)
  if (Number.isNaN(port)) {
    throw new Error(`Invalid bootnode port: ${addressParts[1]}`)
  }

  // Generate altname from peerId (first 8 characters)
  const altname = peerId.substring(0, 8)

  return {
    altname,
    host,
    port,
    peerId,
  }
}

/**
 * Compute genesis header hash
 */
export function computeGenesisHeaderHash(
  genesisHeader: BlockHeader,
  config: IConfigService,
): Hex {
  const [error, encodedHeader] = encodeHeader(genesisHeader, config)
  if (error) {
    throw new Error(`Failed to encode genesis header: ${error}`)
  }
  const [error2, hashResult] = blake2bHash(encodedHeader)
  if (error2) {
    throw new Error(`Failed to compute genesis header hash: ${hashResult}`)
  }
  return hashResult
}

/**
 * Convert genesis header to BlockHeader format
 */
export function convertGenesisToBlockHeader(genesis: GenesisJson): BlockHeader {
  if (!genesis.header) {
    throw new Error('Genesis header not found')
  }

  const header = genesis.header

  return {
    parent: header.parent,
    priorStateRoot: header.parent_state_root,
    extrinsicHash: header.extrinsic_hash,
    timeslot: BigInt(header.slot),
    epochMark: {
      entropyAccumulator: header.epoch_mark.entropy,
      entropy1: header.epoch_mark.tickets_entropy,
      validators: header.epoch_mark.validators,
    },
    winnersMark: null,
    offendersMark: header.offenders_mark,
    authorIndex: BigInt(header.author_index),
    vrfSig: header.entropy_source,
    sealSig: header.seal,
  }
}
