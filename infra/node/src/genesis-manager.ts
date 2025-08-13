/**
 * Genesis Manager
 *
 * Handles loading, validation, and import of genesis.json files
 * Reference: JAM Protocol genesis specifications
 */

import { existsSync, readFileSync } from 'node:fs'
import {
  type GenesisJson,
  type Hex,
  logger,
  parseGenesisJson,
} from '@pbnj/core'
import type {
  Account,
  GenesisConfig,
  GenesisState,
  Validator,
} from '@pbnj/types'

/**
 * Genesis validation result
 */
export interface GenesisValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * Genesis Manager
 */
export class GenesisManager {
  private config: GenesisConfig

  constructor(config: GenesisConfig) {
    this.config = config
  }

  /**
   * Load genesis from file or data
   */
  async loadGenesis(): Promise<GenesisState> {
    try {
      if (!this.config.genesisPath) {
        throw new Error('Genesis path not configured')
      }
      const genesisData = await this.loadFromFile(this.config.genesisPath)

      // Validate genesis
      const validation = this.validateGenesis(genesisData)
      if (!validation.valid && this.config.validation.validateGenesis) {
        throw new Error(
          `Genesis validation failed: ${validation.errors.join(', ')}`,
        )
      }

      return genesisData
    } catch (error) {
      logger.error('Failed to load genesis', { error })
      throw error
    }
  }

  /**
   * Load genesis from JSON file
   */
  private async loadFromFile(filePath: string): Promise<GenesisState> {
    if (!existsSync(filePath)) {
      throw new Error(`Genesis file not found: ${filePath}`)
    }

    logger.debug('Loading genesis from file', { filePath })

    const fileContent = readFileSync(filePath, 'utf-8')

    // Parse and validate genesis JSON using the core package
    const parseResult = parseGenesisJson(fileContent)
    if (!parseResult.success) {
      throw new Error(`Genesis JSON validation failed: ${parseResult.error}`)
    }

    const genesisJson: GenesisJson = parseResult.data

    // Convert JSON to GenesisState
    return this.parseGenesisJson(genesisJson)
  }

  /**
   * Parse genesis JSON into GenesisState
   */
  private parseGenesisJson(genesisJson: GenesisJson): GenesisState {
    const genesisHeader = genesisJson.header

    // Create empty accounts and validators for now since they're not in the actual genesis.json
    const accounts = new Map<Hex, Account>()
    const validators: Validator[] = []

    // Parse safrole state from header
    const safrole = {
      epoch: 0, // TODO: Extract from header if available
      timeslot: genesisHeader.slot,
      entropy: genesisHeader.epoch_mark.entropy,
      tickets: [], // TODO: Extract from header if available
    }

    return {
      genesisBlock: {
        number: 0, // Genesis block is always 0
        hash: genesisHeader.parent_state_root, // Use state root as hash
        parentHash: genesisHeader.parent,
        timestamp: Date.now(), // TODO: Extract from header if available
      },
      state: {
        accounts,
        validators,
        safrole,
        authpool: [],
        recent: [],
        lastAccount: 0,
        stagingset: [],
        activeset: [],
        previousset: [],
        reports: [],
        thetime: Date.now(),
        authqueue: [],
        privileges: new Map(),
        disputes: [],
        activity: new Map(),
        ready: true,
        accumulated: [],
      },
      network: {
        chainId: 'jam-dev', // Default chain ID
        protocolVersion: '1.0.0', // Default version
        slotDuration: 6000, // Default 6 seconds
        epochLength: 600, // Default 600 slots
        maxValidators: 100, // Default max validators
        minStake: BigInt('1000000000000000000'), // Default 1 JAM
      },
      initialWorkPackages: [],
      initialExtrinsics: [],
    }
  }

  /**
   * Validate genesis state
   */
  private validateGenesis(genesis: GenesisState): GenesisValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    // Validate genesis block
    if (genesis.genesisBlock.number !== 0) {
      errors.push('Genesis block number must be 0')
    }

    if (
      genesis.genesisBlock.parentHash !==
      '0x0000000000000000000000000000000000000000000000000000000000000000'
    ) {
      errors.push('Genesis block parent hash must be zero')
    }

    // Validate accounts
    if (
      genesis.state.accounts.size === 0 &&
      this.config.validation.requireAccounts
    ) {
      errors.push('Genesis must contain at least one account')
    }

    // Validate validators
    if (
      genesis.state.validators.length === 0 &&
      this.config.validation.requireValidators
    ) {
      errors.push('Genesis must contain at least one validator')
    }

    // Validate validator stakes
    for (const validator of genesis.state.validators) {
      if (validator.stake && validator.stake < genesis.network.minStake) {
        errors.push(
          `Validator ${validator.address} stake below minimum: ${validator.stake} < ${genesis.network.minStake}`,
        )
      }
    }

    // Validate network configuration
    if (genesis.network.slotDuration <= 0) {
      errors.push('Slot duration must be positive')
    }

    if (genesis.network.epochLength <= 0) {
      errors.push('Epoch length must be positive')
    }

    if (genesis.network.maxValidators <= 0) {
      errors.push('Max validators must be positive')
    }

    // Check for warnings
    if (genesis.state.accounts.size === 0) {
      warnings.push('No accounts in genesis state')
    }

    if (genesis.state.validators.length === 0) {
      warnings.push('No validators in genesis state')
    }

    if ((genesis.initialWorkPackages?.length || 0) === 0) {
      warnings.push('No initial work packages in genesis state')
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    }
  }
}
