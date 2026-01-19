/**
 * Node Genesis Manager - Gray Paper Compliant
 *
 * Node-specific wrapper around the core genesis manager.
 * Provides node-specific validation and caching.
 */

import { existsSync } from 'node:fs'
import { calculateBlockHashFromHeader, decodeHeader } from '@pbnjam/codec'
import type {
  ChainSpecJson,
  GenesisHeaderState,
  GenesisJson,
  Hex,
} from '@pbnjam/core'
import { bytesToHex, hexToBytes, merklizeState } from '@pbnjam/core'
import {
  computeGenesisHeaderHash,
  convertGenesisToBlockHeader,
  loadChainSpec,
  loadGenesisHeaderAndComputeHash,
  loadGenesisJson,
  parseBootnode,
} from '@pbnjam/genesis'
import type {
  BlockHeader,
  IConfigService,
  ParsedBootnode,
  StateTrie,
  ValidatorKeyPair,
} from '@pbnjam/types'
import { BaseService, type Safe, safeError, safeResult } from '@pbnjam/types'
/**
 * Node Genesis Manager Service
 *
 * Gray Paper compliant genesis manager for the JAM node.
 * Loads chain-spec.json and produces proper GlobalState for genesis.
 * Also supports loading genesis.json and genesis-header.json files.
 * Implements BaseService for integration with the main service.
 */
export class NodeGenesisManager extends BaseService {
  private readonly config: IConfigService
  private genesisBlockHeader: BlockHeader | null = null
  private parsedBootnodes: ParsedBootnode[] = []

  private chainSpecJson: ChainSpecJson | null = null
  private genesisJson: GenesisJson | null = null
  private genesisBlockHeaderHash: Hex | null = null
  constructor(
    config: IConfigService,
    options?: {
      chainSpecPath?: string
      genesisJsonPath?: string
      genesisHeaderPath?: string
    },
  ) {
    super('genesis-manager')
    this.config = config
    this.genesisBlockHeader = null
    this.chainSpecJson = null
    this.genesisJson = null
    this.parsedBootnodes = []
    this.genesisBlockHeaderHash = null

    // Load chain spec (required)
    if (options?.chainSpecPath) {
      if (!existsSync(options.chainSpecPath)) {
        throw new Error(`Chain spec file not found: ${options.chainSpecPath}`)
      }

      const [chainSpecError, chainSpecResult] = loadChainSpec(
        options?.chainSpecPath,
      )
      if (chainSpecError) {
        throw new Error('Failed to load chain spec')
      }
      this.chainSpecJson = chainSpecResult
    }
    if (options?.genesisJsonPath) {
      if (!existsSync(options.genesisJsonPath)) {
        throw new Error(
          `Genesis json file not found: ${options.genesisJsonPath}`,
        )
      }
      const [genesisJsonError, genesisJsonResult] = loadGenesisJson(
        options.genesisJsonPath,
      )
      if (genesisJsonError) {
        throw new Error('Failed to load genesis json')
      }
      this.genesisJson = genesisJsonResult
    }
    if (options?.genesisHeaderPath) {
      if (!existsSync(options.genesisHeaderPath)) {
        throw new Error(
          `Genesis header file not found: ${options.genesisHeaderPath}`,
        )
      }

      const [headerError, headerResult] = loadGenesisHeaderAndComputeHash(
        options.genesisHeaderPath,
        this.config,
      )
      if (headerError) {
        throw new Error('Failed to load genesis header')
      }
      this.genesisBlockHeader = headerResult.genesisHeader
      this.genesisBlockHeaderHash = headerResult.genesisHash
    }

    // Extract bootnodes from chain spec
    if (this.chainSpecJson) {
      // Parse bootnodes into structured format
      this.parsedBootnodes =
        this.chainSpecJson.bootnodes?.map((bootnode) =>
          parseBootnode(bootnode),
        ) || []
      console.log(`📡 Parsed bootnodes: ${this.parsedBootnodes.length}`)
    }
  }

  getState(): Safe<GenesisHeaderState> {
    // Try genesis.json first (highest priority)
    if (this.genesisJson) {
      return safeResult(this.genesisJson.state)
    }

    // Try chain spec in JIP-4 format (state trie)
    // Check for genesis_header presence as indicator for JIP-4 format
    // (schema transformation adds 0x prefix to keys, making isJIP4Format unreliable)
    if (
      this.chainSpecJson?.genesis_header &&
      this.chainSpecJson.genesis_state
    ) {
      const stateTrie = this.chainSpecJson.genesis_state as StateTrie
      if (!stateTrie || typeof stateTrie !== 'object') {
        return safeError(new Error('JIP-4 genesis_state not found or invalid'))
      }

      // Convert state trie to keyvals format (keys are already normalized to Hex with 0x prefix by schema)
      const keyvals = Object.entries(stateTrie).map(([key, value]) => ({
        key: key as Hex,
        value: value as Hex,
      }))

      // Calculate state root from state trie (merklizeState expects Record<string, string>)
      const [trieError, stateRoot] = merklizeState(stateTrie)

      if (trieError || !stateRoot) {
        return safeError(
          new Error(
            `Failed to compute state root from state trie: ${trieError?.message || 'Unknown error'}`,
          ),
        )
      }

      return safeResult({
        state_root: bytesToHex(stateRoot) as Hex,
        keyvals,
      })
    }

    return safeError(
      new Error('Genesis state not found - JIP-4 chainspec required'),
    )
  }

  /**
   * Get full genesis JSON (header + state)
   */
  getGenesisJson(): Safe<GenesisJson> {
    if (!this.genesisJson) {
      return safeError(new Error('Genesis JSON not found'))
    }
    return safeResult(this.genesisJson)
  }

  /**
   * Get genesis header hash
   * Calculates from genesis header if available, otherwise from genesis JSON or JIP-4 chain spec
   * Priority: 1. Loaded genesis header, 2. JIP-4 chain spec genesis_header, 3. Genesis JSON
   */
  getGenesisHeaderHash(): Safe<Hex> {
    // If already computed, return it
    if (this.genesisBlockHeaderHash) {
      return safeResult(this.genesisBlockHeaderHash)
    }

    // Priority 1: Try to compute from loaded genesis header if available
    if (this.genesisBlockHeader) {
      try {
        const hash = computeGenesisHeaderHash(
          this.genesisBlockHeader,
          this.config,
        )
        this.genesisBlockHeaderHash = hash
        return safeResult(hash)
      } catch (error) {
        return safeError(
          new Error(
            `Failed to compute genesis hash from header: ${error instanceof Error ? error.message : String(error)}`,
          ),
        )
      }
    }

    // Priority 2: Try to compute from JIP-4 chain spec (genesis_header is JAM-serialized)
    // JIP-4 format: chainspec has genesis_header as a hex string containing JAM-serialized header
    // Note: We check for genesis_header directly since schema transformation may modify genesis_state keys
    if (this.chainSpecJson?.genesis_header) {
      try {
        // Ensure genesis_header has 0x prefix for hexToBytes
        const genesisHeaderHex: Hex =
          this.chainSpecJson.genesis_header.startsWith('0x')
            ? (this.chainSpecJson.genesis_header as Hex)
            : (`0x${this.chainSpecJson.genesis_header}` as Hex)

        // Convert hex string to bytes
        const serializedHeader = hexToBytes(genesisHeaderHex)

        // Decode the JAM-serialized header
        const [decodeError, decodeResult] = decodeHeader(
          serializedHeader,
          this.config,
        )
        if (decodeError || !decodeResult) {
          return safeError(
            new Error(
              `Failed to decode JIP-4 genesis header: ${decodeError?.message || 'Unknown error'}`,
            ),
          )
        }

        const genesisHeader = decodeResult.value

        // Calculate hash from decoded header
        const [hashError, hash] = calculateBlockHashFromHeader(
          genesisHeader,
          this.config,
        )
        if (hashError || !hash) {
          return safeError(
            new Error(
              `Failed to calculate genesis hash from JIP-4 header: ${hashError?.message || 'Unknown error'}`,
            ),
          )
        }

        // Cache the results
        this.genesisBlockHeaderHash = hash
        this.genesisBlockHeader = genesisHeader
        return safeResult(hash)
      } catch (error) {
        return safeError(
          new Error(
            `Failed to compute genesis hash from JIP-4 chain spec: ${error instanceof Error ? error.message : String(error)}`,
          ),
        )
      }
    }

    // Priority 3: Try to compute from genesis JSON if available
    if (this.genesisJson) {
      try {
        const genesisHeader = convertGenesisToBlockHeader(this.genesisJson)
        const [hashError, hash] = calculateBlockHashFromHeader(
          genesisHeader,
          this.config,
        )
        if (hashError || !hash) {
          return safeError(
            new Error(
              `Failed to calculate genesis hash from JSON: ${hashError?.message || 'Unknown error'}`,
            ),
          )
        }
        this.genesisBlockHeaderHash = hash
        return safeResult(hash)
      } catch (error) {
        return safeError(
          new Error(
            `Failed to compute genesis hash from JSON: ${error instanceof Error ? error.message : String(error)}`,
          ),
        )
      }
    }

    return safeError(
      new Error(
        'Genesis header hash not found and cannot be computed. Ensure chainspec has genesis_header (JIP-4 format) or provide genesis.json',
      ),
    )
  }

  /**
   * Delegate methods to access core genesis manager functionality
   */

  /**
   * Get chain specification (delegates to core genesis manager)
   */
  getChainSpec(): Safe<ChainSpecJson> {
    if (!this.chainSpecJson) {
      return safeError(new Error('Genesis result not found'))
    }
    const result = this.chainSpecJson
    return safeResult(result)
  }

  // ============================================================================
  // Getters for Initial Validators and Genesis Data
  // ============================================================================

  /**
   * Get initial validators from the loaded genesis data
   * Note: JIP-4 format doesn't have structured validators in genesis_state
   * Validators must be extracted from the decoded genesis header
   */
  getInitialValidatorsFromChainSpec(): Safe<ValidatorKeyPair[]> {
    // For JIP-4 format, validators are in the decoded genesis header
    if (this.genesisBlockHeader) {
      const validators = this.genesisBlockHeader.epochMark?.validators || []
      return safeResult(validators)
    }
    return safeError(
      new Error(
        'Genesis block header not found - cannot extract validators from JIP-4 format',
      ),
    )
  }

  getInitialValidatorsFromBlockHeader(): Safe<ValidatorKeyPair[]> {
    if (!this.genesisBlockHeader) {
      return safeError(new Error('Genesis result not found'))
    }
    const validators = this.genesisBlockHeader.epochMark?.validators || []
    return safeResult(validators)
  }

  /**
   * Get genesis entropy
   * Note: JIP-4 format doesn't have structured entropy in genesis_state
   * Entropy must be extracted from the decoded genesis header or state trie
   */
  getGenesisEntropy(): Safe<Hex> {
    // Try to get entropy from genesis block header
    if (this.genesisBlockHeader?.epochMark?.entropy1) {
      return safeResult(this.genesisBlockHeader.epochMark.entropy1)
    }
    // Try to get entropy from genesis JSON
    if (this.genesisJson?.header?.epoch_mark?.entropy) {
      return safeResult(this.genesisJson.header.epoch_mark.entropy)
    }
    return safeError(
      new Error(
        'Genesis entropy not found - JIP-4 format requires decoded header',
      ),
    )
  }

  getGenesisHeader(): Safe<BlockHeader> {
    if (!this.genesisBlockHeader) {
      return safeError(new Error('Genesis block header not found'))
    }
    return safeResult(this.genesisBlockHeader)
  }

  /**
   * Get genesis time
   * Note: JIP-4 format doesn't have structured genesis_time in genesis_state
   * Genesis time must be extracted from the decoded genesis header
   */
  getGenesisTime(): Safe<bigint> {
    // Try to get genesis time from genesis block header
    if (this.genesisBlockHeader) {
      return safeResult(this.genesisBlockHeader.timeslot)
    }
    // Try to get genesis time from genesis JSON
    if (this.genesisJson?.header?.slot) {
      return safeResult(BigInt(this.genesisJson.header.slot))
    }
    return safeError(
      new Error(
        'Genesis time not found - JIP-4 format requires decoded header',
      ),
    )
  }

  /**
   * Get genesis block header from genesis-header.json (if loaded)
   */
  getGenesisBlockHeader(): Safe<BlockHeader> {
    if (!this.genesisBlockHeader) {
      return safeError(new Error('Genesis block header not found'))
    }
    return safeResult(this.genesisBlockHeader)
  }

  /**
   * Get parsed bootnodes with structured information
   */
  getParsedBootnodes(): Safe<ParsedBootnode[]> {
    return safeResult(this.parsedBootnodes)
  }
}
