/**
 * Node Genesis Manager - Gray Paper Compliant
 *
 * Node-specific wrapper around the core genesis manager.
 * Provides node-specific validation and caching.
 */

import { existsSync } from 'node:fs'
import { logger, type SafePromise, safeError, safeResult } from '@pbnj/core'
import { createGenesisManager, type GenesisManagerImpl } from '@pbnj/genesis'
import type {
  ChainSpecParserOptions,
  GenesisBuilderOptions,
  GenesisError,
  GenesisResult,
  GenesisState,
} from '@pbnj/types'
import { BaseService } from '../interfaces/service'

/**
 * Genesis validation result for node service
 */
export interface NodeGenesisValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  genesisResult?: GenesisResult
}

/**
 * Node Genesis Configuration
 * Configuration specific to the node service
 */
export interface NodeGenesisConfig {
  /** Path to chain-spec.json file */
  chainSpecPath: string

  /** Parser options */
  parser: ChainSpecParserOptions

  /** Builder options */
  builder: GenesisBuilderOptions

  /** Node-specific validation options */
  nodeValidation: {
    /** Validate genesis before using */
    validateGenesis: boolean
    /** Allow genesis with no validators */
    allowEmptyValidators: boolean
    /** Allow genesis with no service accounts */
    allowEmptyAccounts: boolean
    /** Require minimum validators */
    minValidators: number
    /** Strict Gray Paper compliance */
    strictCompliance: boolean
  }

  /** Node import options */
  import: {
    /** Initialize empty state components if missing */
    initializeEmpty: boolean
    /** Reset existing state on import */
    resetExistingState: boolean
    /** Create backup before import */
    backupExistingState: boolean
  }
}

/**
 * Default node genesis configuration
 */
const DEFAULT_NODE_GENESIS_CONFIG: Partial<NodeGenesisConfig> = {
  parser: {
    validateValidatorKeys: true,
    validateAddresses: true,
    minValidators: 1,
    allowEmptyAccounts: false,
  },
  builder: {
    initializeEmpty: true,
    validateConsistency: true,
    strictCompliance: true,
  },
  nodeValidation: {
    validateGenesis: true,
    allowEmptyValidators: false,
    allowEmptyAccounts: false,
    minValidators: 1,
    strictCompliance: true,
  },
  import: {
    initializeEmpty: true,
    resetExistingState: false,
    backupExistingState: true,
  },
}

/**
 * Node Genesis Manager Service
 *
 * Gray Paper compliant genesis manager for the JAM node.
 * Loads chain-spec.json and produces proper GlobalState for genesis.
 * Implements BaseService for integration with the main service.
 */
export class NodeGenesisManager extends BaseService {
  private config: NodeGenesisConfig
  private genesisManager: GenesisManagerImpl
  // private cachedGenesis?: GenesisResult

  constructor(config: Partial<NodeGenesisConfig>) {
    super('genesis-manager')
    this.config = {
      ...DEFAULT_NODE_GENESIS_CONFIG,
      ...config,
    } as NodeGenesisConfig
    this.genesisManager = createGenesisManager(
      this.config.parser,
      this.config.builder,
    )
  }

  /**
   * Initialize the genesis manager service
   */
  async init(): SafePromise<boolean> {
    super.init()
    // Validate that chain spec file exists
    if (!existsSync(this.config.chainSpecPath)) {
      return safeError(
        new Error(`Chain spec file not found: ${this.config.chainSpecPath}`),
      )
    }

    return safeResult(true)
  }

  /**
   * Start the genesis manager service and load genesis state
   */
  async start(): SafePromise<boolean> {
    super.start()
    // Load genesis on startup
    await this.loadGenesisResult()

    return safeResult(true)
  }

  /**
   * Stop the genesis manager service
   */
  async stop(): SafePromise<boolean> {
    super.stop()

    return safeResult(true)
  }

  /**
   * Load Gray Paper compliant genesis state from chain-spec.json
   */
  async loadGenesis(): Promise<GenesisState> {
    const genesisResult = await this.loadGenesisResult()
    return genesisResult.genesisState
  }

  /**
   * Get complete genesis result (state + metadata)
   */
  async loadGenesisResult(): Promise<GenesisResult> {
    if (!existsSync(this.config.chainSpecPath)) {
      throw new Error(`Chain spec file not found: ${this.config.chainSpecPath}`)
    }

    logger.info('Loading genesis from chain spec', {
      path: this.config.chainSpecPath,
    })

    try {
      // Use the consolidated genesis manager from the package
      const result = await this.genesisManager.constructGenesis(
        this.config.chainSpecPath,
      )

      // Node-specific validation
      const validation = this.validateForNode(result)
      if (!validation.valid && this.config.nodeValidation.validateGenesis) {
        throw new Error(
          `Genesis validation failed for node: ${validation.errors.join(', ')}`,
        )
      }

      // Log warnings
      if (validation.warnings.length > 0) {
        logger.warn('Genesis validation warnings', {
          warnings: validation.warnings,
        })
      }

      logger.info('Genesis loaded successfully', {
        chainId: result.chainSpec.id,
        validatorCount: result.genesisState.activeset.length,
        serviceCount: result.genesisState.accounts.serviceCount,
        genesisTime: result.genesisState.thetime,
      })

      return result
    } catch (error) {
      logger.error('Failed to load genesis', { error })
      throw error
    }
  }

  /**
   * Validate genesis for node usage
   */
  validateForNode(genesisResult: GenesisResult): NodeGenesisValidationResult {
    const errors: string[] = []
    const warnings: string[] = []
    const { genesisState } = genesisResult

    // Node-specific validations beyond Gray Paper compliance

    // Validate active validator set
    if (genesisState.activeset.length === 0) {
      if (this.config.nodeValidation.allowEmptyValidators) {
        warnings.push('No validators in genesis state')
      } else {
        errors.push('Genesis must contain at least one validator')
      }
    }

    if (
      genesisState.activeset.length < this.config.nodeValidation.minValidators
    ) {
      errors.push(
        `Genesis must contain at least ${this.config.nodeValidation.minValidators} validators, found ${genesisState.activeset.length}`,
      )
    }

    // Validate service accounts
    if (genesisState.accounts.serviceCount === 0n) {
      if (this.config.nodeValidation.allowEmptyAccounts) {
        warnings.push('No service accounts in genesis state')
      } else {
        errors.push('Genesis must contain at least one service account')
      }
    }

    // Validate state consistency
    if (genesisState.activeset.length !== genesisState.stagingset.length) {
      errors.push(
        'Active and staging validator sets must have same size at genesis',
      )
    }

    if (genesisState.previousset.length !== 0) {
      warnings.push('Previous validator set should be empty at genesis')
    }

    // Validate time
    if (genesisState.thetime < 0n) {
      errors.push('Genesis time cannot be negative')
    }

    // Validate Safrole state
    if (!genesisState.safrole) {
      errors.push('Safrole state is required')
    } else {
      if (
        genesisState.safrole.pendingSet.length !== genesisState.activeset.length
      ) {
        errors.push(
          'Safrole pending set must match active validator set at genesis',
        )
      }
    }

    // Validate entropy
    if (!genesisState.entropy || !genesisState.entropy.current) {
      errors.push('Genesis entropy is required')
    }

    // Additional node-specific validations can be added here as needed

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      genesisResult,
    }
  }

  /**
   * Get genesis header hash
   */
  async getGenesisHeaderHash(): Promise<string> {
    const result = await this.loadGenesisResult()
    return result.genesisHash
  }

  /**
   * Export current configuration
   */
  getConfig(): NodeGenesisConfig {
    return { ...this.config }
  }

  /**
   * Delegate methods to access core genesis manager functionality
   */

  /**
   * Get chain specification (delegates to core genesis manager)
   */
  async getChainSpec() {
    const result = await this.loadGenesisResult()
    return result.chainSpec
  }

  /**
   * Validate genesis state using core genesis manager
   */
  async validateGenesisState(): Promise<readonly GenesisError[]> {
    const result = await this.loadGenesisResult()
    return this.genesisManager.validateGenesis(result.genesisState)
  }

  /**
   * Access the underlying genesis manager (for advanced usage)
   */
  getGenesisManager(): GenesisManagerImpl {
    return this.genesisManager
  }
}

/**
 * Create a node genesis manager with default configuration
//  */
// export function createNodeGenesisManager(
//   chainSpecPath: string,
//   options?: Partial<NodeGenesisConfig>,
// ): NodeGenesisManager {
//   return new NodeGenesisManager({
//     chainSpecPath,
//     ...options,
//   })
// }

// /**
//  * Convenience function to load genesis state for node
//  */
// export async function loadNodeGenesis(
//   chainSpecPath: string,
//   options?: Partial<NodeGenesisConfig>,
// ): Promise<GenesisState> {
//   const manager = createNodeGenesisManager(chainSpecPath, options)
//   return manager.loadGenesis()
// }
