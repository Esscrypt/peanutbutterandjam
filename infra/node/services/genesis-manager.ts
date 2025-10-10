/**
 * Node Genesis Manager - Gray Paper Compliant
 *
 * Node-specific wrapper around the core genesis manager.
 * Provides node-specific validation and caching.
 */

import { existsSync } from 'node:fs'
import type {
  ChainSpecJson,
  ChainSpecValidator,
  GenesisHeaderState,
  GenesisJson,
  Hex,
} from '@pbnj/core'
import { type Safe, type SafePromise, safeError, safeResult } from '@pbnj/core'
import {
  loadChainSpec,
  loadGenesisHeaderAndComputeHash,
  loadGenesisJson,
  parseBootnode,
} from '@pbnj/genesis'
import type {
  BlockHeader,
  IConfigService,
  ParsedBootnode,
  ValidatorKeyPair,
} from '@pbnj/types'
import { BaseService } from '@pbnj/types'

/**
 * Node Genesis Manager Service
 *
 * Gray Paper compliant genesis manager for the JAM node.
 * Loads chain-spec.json and produces proper GlobalState for genesis.
 * Also supports loading genesis.json and genesis-header.json files.
 * Implements BaseService for integration with the main service.
 */
export class NodeGenesisManager extends BaseService {
  private readonly chainSpecPath: string
  private readonly genesisJsonPath?: string
  private readonly genesisHeaderPath?: string
  private readonly config: IConfigService
  private genesisBlockHeader: BlockHeader | null = null
  private parsedBootnodes: ParsedBootnode[] = []

  private chainSpecJson: ChainSpecJson | null = null
  private genesisJson: GenesisJson | null = null
  private genesisBlockHeaderHash: Hex | null = null
  constructor(
    config: IConfigService,
    chainSpecPath: string,
    options?: {
      genesisJsonPath?: string
      genesisHeaderPath?: string
    },
  ) {
    super('genesis-manager')
    this.config = config
    this.chainSpecPath = chainSpecPath
    this.genesisJsonPath = options?.genesisJsonPath
    this.genesisHeaderPath = options?.genesisHeaderPath
    this.genesisBlockHeader = null
    this.chainSpecJson = null
    this.genesisJson = null
    this.parsedBootnodes = []
    this.genesisBlockHeaderHash = null
  }

  /**
   * Start the genesis manager service and load genesis state
   */
  async start(): SafePromise<boolean> {
    super.start()

    // Load chain spec (required)
    if (!existsSync(this.chainSpecPath)) {
      return safeError(
        new Error(`Chain spec file not found: ${this.chainSpecPath}`),
      )
    }

    const [chainSpecError, chainSpecResult] = await loadChainSpec(
      this.chainSpecPath,
    )
    if (chainSpecError) {
      return safeError(chainSpecError)
    }
    this.chainSpecJson = chainSpecResult

    // Optionally load genesis.json
    if (this.genesisJsonPath && existsSync(this.genesisJsonPath)) {
      const [genesisJsonError, genesisJsonResult] = await loadGenesisJson(
        this.genesisJsonPath,
      )
      if (genesisJsonError) {
        return safeError(genesisJsonError)
      }
      this.genesisJson = genesisJsonResult

      console.log(`📁 Loading genesis.json from ${this.genesisJsonPath}`)
      console.log('✅ Genesis JSON loaded successfully')
    }

    // Optionally load genesis-header.json
    if (this.genesisHeaderPath && existsSync(this.genesisHeaderPath)) {
      console.log(
        `📁 Loading genesis-header.json from ${this.genesisHeaderPath}`,
      )
      const [headerError, headerResult] = await loadGenesisHeaderAndComputeHash(
        this.genesisHeaderPath,
        this.config,
      )
      if (headerError) {
        return safeError(headerError)
      }
      this.genesisBlockHeader = headerResult.genesisHeader
      this.genesisBlockHeaderHash = headerResult.genesisHash
      console.log('✅ Genesis Header loaded successfully')
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

    return safeResult(true)
  }

  getState(): Safe<GenesisHeaderState> {
    if (!this.genesisJson) {
      return safeError(new Error('Genesis result not found'))
    }
    return safeResult(this.genesisJson.state)
  }

  /**
   * Get genesis header hash
   */
  getGenesisHeaderHash(): Safe<Hex> {
    if (!this.genesisBlockHeaderHash) {
      return safeError(new Error('Genesis header hash not found'))
    }
    return safeResult(this.genesisBlockHeaderHash)
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
   */
  getInitialValidatorsFromChainSpec(): Safe<ChainSpecValidator[]> {
    if (!this.genesisJson) {
      return safeError(new Error('Genesis result not found'))
    }
    const validators = this.chainSpecJson?.genesis_state?.validators || []
    return safeResult(validators)
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
   */
  getGenesisEntropy(): Safe<Hex> {
    if (!this.chainSpecJson) {
      return safeError(new Error('Chain spec not found'))
    }
    if (!this.chainSpecJson.genesis_state) {
      return safeError(new Error('Genesis state not found'))
    }
    if (!this.chainSpecJson.genesis_state.entropy) {
      return safeError(new Error('Entropy not found'))
    }
    return safeResult(this.chainSpecJson.genesis_state.entropy)
  }

  getGenesisHeader(): Safe<BlockHeader> {
    if (!this.genesisBlockHeader) {
      return safeError(new Error('Genesis block header not found'))
    }
    return safeResult(this.genesisBlockHeader)
  }

  /**
   * Get genesis time
   */
  getGenesisTime(): Safe<bigint> {
    if (!this.chainSpecJson) {
      return safeError(new Error('Chain spec not found'))
    }
    if (!this.chainSpecJson.genesis_state) {
      return safeError(new Error('Genesis state not found'))
    }
    if (!this.chainSpecJson.genesis_state.genesis_time) {
      return safeError(new Error('Genesis time not found'))
    }
    return safeResult(BigInt(this.chainSpecJson.genesis_state.genesis_time))
  }

  /**
   * Get slot duration
   */
  getSlotDuration(): Safe<bigint> {
    if (!this.chainSpecJson) {
      return safeError(new Error('Chain spec not found'))
    }
    if (!this.chainSpecJson.network) {
      return safeError(new Error('Network not found'))
    }
    if (!this.chainSpecJson.network.slot_duration) {
      return safeError(new Error('Slot duration not found'))
    }
    return safeResult(BigInt(this.chainSpecJson.network.slot_duration))
  }

  /**
   * Get epoch length
   */
  getEpochLength(): Safe<bigint> {
    if (!this.chainSpecJson) {
      return safeError(new Error('Chain spec not found'))
    }
    if (!this.chainSpecJson.network) {
      return safeError(new Error('Network not found'))
    }
    if (!this.chainSpecJson.network.epoch_length) {
      return safeError(new Error('Epoch length not found'))
    }
    return safeResult(BigInt(this.chainSpecJson.network.epoch_length))
  }

  /**
   * Get core count
   */
  getCoreCount(): Safe<bigint> {
    if (!this.chainSpecJson) {
      return safeError(new Error('Chain spec not found'))
    }
    if (!this.chainSpecJson.network) {
      return safeError(new Error('Network not found'))
    }
    if (!this.chainSpecJson.network.core_count) {
      return safeError(new Error('Core count not found'))
    }
    return safeResult(BigInt(this.chainSpecJson.network.core_count))
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
