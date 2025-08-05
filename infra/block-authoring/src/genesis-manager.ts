/**
 * Genesis Manager
 *
 * Handles loading, validation, and import of genesis.json files
 * Reference: JAM Protocol genesis specifications
 */

import { existsSync, readFileSync } from 'node:fs'
import { logger } from '@pbnj/core'
import { z } from 'zod'
import type { Account, GenesisConfig, GenesisState, Validator } from './types'

// Zod schemas for validation
const HeaderSchema = z.object({
  parent: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  parent_state_root: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  extrinsic_hash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  slot: z.number().int().min(0),
  epoch_mark: z.object({
    entropy: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
    tickets_entropy: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
    validators: z.array(
      z.object({
        bandersnatch: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
        ed25519: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
      }),
    ),
  }),
  tickets_mark: z.any().nullable(),
  offenders_mark: z.array(z.any()),
  author_index: z.number().int(),
  entropy_source: z.string(),
  seal: z.string(),
})

const KeyValueSchema = z.object({
  key: z.string().regex(/^0x[a-fA-F0-9]*$/),
  value: z.string().regex(/^0x[a-fA-F0-9]*$/),
})

const StateSchema = z.object({
  state_root: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  keyvals: z.array(KeyValueSchema),
})

const GenesisJsonSchema = z.object({
  header: HeaderSchema,
  state: StateSchema,
})

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
      let genesisData: GenesisState

      if (this.config.genesisPath) {
        // Load from file
        genesisData = await this.loadFromFile(this.config.genesisPath)
      } else if (this.config.genesisData) {
        // Use provided data
        genesisData = this.config.genesisData
      } else {
        // Create default genesis
        genesisData = this.createDefaultGenesis()
      }

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
    const genesisJson = JSON.parse(fileContent)

    // Convert JSON to GenesisState
    return this.parseGenesisJson(genesisJson)
  }

  /**
   * Parse genesis JSON into GenesisState
   */
  private parseGenesisJson(genesisJson: unknown): GenesisState {
    // Validate JSON with Zod
    const validationResult = GenesisJsonSchema.safeParse(genesisJson)
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(
        (err) => `${err.path.join('.')}: ${err.message}`,
      )
      throw new Error(`Genesis JSON validation failed:\n${errors.join('\n')}`)
    }

    const validatedJson = validationResult.data

    // Create empty accounts and validators for now since they're not in the actual genesis.json
    const accounts = new Map<string, Account>()
    const validators: Validator[] = []

    // Parse safrole state from header
    const safrole = {
      epoch: 0, // TODO: Extract from header if available
      timeslot: validatedJson.header.slot,
      entropy: validatedJson.header.epoch_mark.entropy,
      tickets: [], // TODO: Extract from header if available
    }

    return {
      genesisBlock: {
        number: 0, // Genesis block is always 0
        hash: validatedJson.header.parent_state_root, // Use state root as hash
        parentHash: validatedJson.header.parent,
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
   * Create default genesis state
   */
  private createDefaultGenesis(): GenesisState {
    logger.info('Creating default genesis state')

    const defaultValidator: Account = {
      address: '0x0000000000000000000000000000000000000001',
      balance: BigInt('1000000000000000000000'), // 1000 JAM
      nonce: 0,
      isValidator: true,
      validatorKey:
        '0x0000000000000000000000000000000000000000000000000000000000000001',
      stake: BigInt('1000000000000000000000'), // 1000 JAM
    }

    const accounts = new Map<string, Account>()
    accounts.set(defaultValidator.address, defaultValidator)

    const validators: Validator[] = [
      {
        bandersnatch:
          '0x0000000000000000000000000000000000000000000000000000000000000000',
        ed25519:
          '0x0000000000000000000000000000000000000000000000000000000000000000',
      },
    ]

    return {
      genesisBlock: {
        number: 0,
        hash: '0x0000000000000000000000000000000000000000000000000000000000000000',
        parentHash:
          '0x0000000000000000000000000000000000000000000000000000000000000000',
        timestamp: Date.now(),
      },
      state: {
        accounts,
        validators,
        safrole: {
          epoch: 0,
          timeslot: 0,
          entropy:
            '0x0000000000000000000000000000000000000000000000000000000000000000',
          tickets: [],
        },
        authpool: [],
        recent: [],
        lastAccount: 1,
        stagingset: [],
        activeset: [defaultValidator.address],
        previousset: [],
        reports: [],
        thetime: Date.now(),
        authqueue: [],
        privileges: new Map([[defaultValidator.address, 1]]),
        disputes: [],
        activity: new Map([[defaultValidator.address, 1]]),
        ready: true,
        accumulated: [],
      },
      network: {
        chainId: 'jam-dev',
        protocolVersion: '1.0.0',
        slotDuration: 6000, // 6 seconds
        epochLength: 600, // 600 slots
        maxValidators: 100,
        minStake: BigInt('1000000000000000000'), // 1 JAM
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
