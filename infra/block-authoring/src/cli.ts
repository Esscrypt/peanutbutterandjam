#!/usr/bin/env node

/**
 * Block Authoring Service CLI
 *
 * Provides command-line interface for the block authoring service
 * Can load chain-spec, decode it, validate with Zod, and configure the service
 */

import { existsSync, readFileSync } from 'node:fs'
import { logger, z } from '@pbnj/core'
import { Command } from 'commander'
import { BlockAuthoringServiceImpl } from './block-authoring-service'
import type {
  BlockAuthoringConfig,
  BlockAuthoringContext,
  BlockAuthoringResult,
  GenesisConfig,
  GenesisState,
} from './types'
import { FinalizationStatus, PropagationStatus } from './types'

// Zod schema for chain-spec validation
const AccountSchema = z.object({
  balance: z.string().regex(/^\d+$/),
  nonce: z.number().int().min(0),
  isValidator: z.boolean().optional(),
  validatorKey: z
    .string()
    .regex(/^0x[a-fA-F0-9]{64}$/)
    .optional(),
  stake: z.string().regex(/^\d+$/).optional(),
})

const ValidatorSchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  publicKey: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  stake: z.string().regex(/^\d+$/),
  isActive: z.boolean(),
})

const SafroleSchema = z.object({
  epoch: z.number().int().min(0),
  timeslot: z.number().int().min(0),
  entropy: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  tickets: z.array(z.any()).optional(),
})

const GenesisStateSchema = z.object({
  accounts: z.record(z.string().regex(/^0x[a-fA-F0-9]{40}$/), AccountSchema),
  validators: z.array(ValidatorSchema),
  safrole: SafroleSchema,
})

const ChainSpecSchema = z.object({
  bootnodes: z.array(z.string()),
  id: z.string(),
  genesis_header: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  genesis_state: GenesisStateSchema,
})

// Zod schema for CLI configuration
const CliConfigSchema = z.object({
  chainSpecPath: z.string().min(1, 'Chain spec path is required'),
  validatorKey: z.string().optional(),
  networkId: z.string().default('dev'),
  slotDuration: z.number().default(6000), // 6 seconds in milliseconds
  epochLength: z.number().default(600),
  maxExtrinsicsPerBlock: z.number().default(1000),
  maxWorkPackagesPerBlock: z.number().default(100),
  enableStrictValidation: z.boolean().default(true),
  enableAuditMode: z.boolean().default(false),
  enableSafroleValidation: z.boolean().default(true),
  enableGrandpaFinalization: z.boolean().default(true),
  genesisPath: z.string().optional(),
  outputPath: z.string().optional(),
  verbose: z.boolean().default(false),
})

type CliConfig = z.infer<typeof CliConfigSchema>

/**
 * Load and validate chain-spec file
 */
async function loadChainSpec(
  filePath: string,
): Promise<z.infer<typeof ChainSpecSchema>> {
  try {
    if (!existsSync(filePath)) {
      throw new Error(`Chain spec file not found: ${filePath}`)
    }

    const content = readFileSync(filePath, 'utf-8')
    const chainSpec = JSON.parse(content)

    // Validate with Zod
    const validatedChainSpec = ChainSpecSchema.parse(chainSpec)

    logger.info('Chain spec loaded and validated successfully', {
      id: validatedChainSpec.id,
      bootnodesCount: validatedChainSpec.bootnodes.length,
      genesisStateKeys: Object.keys(validatedChainSpec.genesis_state).length,
    })

    return validatedChainSpec
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error('Chain spec validation failed:', {
        errors: error.errors.map((err) => ({
          path: err.path.join('.'),
          message: err.message,
        })),
      })
    } else {
      logger.error('Failed to load chain spec:', error)
    }
    throw error
  }
}

/**
 * Decode genesis state from chain-spec
 */
function decodeGenesisState(
  chainSpec: z.infer<typeof ChainSpecSchema>,
): GenesisState {
  try {
    // Decode genesis header (assuming it's hex-encoded)
    const genesisHeader = chainSpec.genesis_header

    // Parse genesis state
    const genesisState = chainSpec.genesis_state

    // Create genesis state structure
    const decodedGenesisState: GenesisState = {
      genesisBlock: {
        number: 0,
        hash: genesisHeader,
        parentHash:
          '0x0000000000000000000000000000000000000000000000000000000000000000',
        timestamp: Date.now(),
      },
      state: {
        accounts: new Map(),
        validators: [],
        safrole: {
          epoch: 0,
          timeslot: 0,
          entropy:
            '0x0000000000000000000000000000000000000000000000000000000000000000',
          tickets: [],
        },
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
        chainId: chainSpec.id,
        protocolVersion: '1.0.0',
        slotDuration: 6000, // 6 seconds
        epochLength: 600,
        maxValidators: 100,
        minStake: BigInt(1000000),
      },
    }

    // Parse accounts from genesis state
    for (const [address, accountData] of Object.entries(
      genesisState.accounts,
    )) {
      decodedGenesisState.state.accounts.set(address, {
        address,
        balance: BigInt(accountData.balance),
        nonce: accountData.nonce,
        code: undefined, // Not in chain spec schema
        storage: undefined, // Not in chain spec schema
        isValidator: accountData.isValidator || false,
        validatorKey: accountData.validatorKey,
        stake: accountData.stake ? BigInt(accountData.stake) : undefined,
      })
    }

    // Parse validators from genesis state
    for (const validatorData of genesisState.validators) {
      decodedGenesisState.state.validators.push({
        bandersnatch: validatorData.publicKey, // Use publicKey as bandersnatch
        ed25519: validatorData.publicKey, // Use publicKey as ed25519
        address: validatorData.address,
        publicKey: validatorData.publicKey,
        stake: BigInt(validatorData.stake),
        isActive: validatorData.isActive,
      })
    }

    // Parse safrole from genesis state
    decodedGenesisState.state.safrole = {
      epoch: genesisState.safrole.epoch,
      timeslot: genesisState.safrole.timeslot,
      entropy: genesisState.safrole.entropy,
      tickets: genesisState.safrole.tickets || [],
    }

    logger.info('Genesis state decoded successfully', {
      accountsCount: decodedGenesisState.state.accounts.size,
      validatorsCount: decodedGenesisState.state.validators.length,
      chainId: decodedGenesisState.network.chainId,
    })

    // Add missing properties
    decodedGenesisState.initialWorkPackages = []
    decodedGenesisState.initialExtrinsics = []

    return decodedGenesisState
  } catch (error) {
    logger.error('Failed to decode genesis state:', error)
    throw error
  }
}

/**
 * Create block authoring configuration from CLI config and chain-spec
 */
function createBlockAuthoringConfig(
  cliConfig: CliConfig,
  _chainSpec: z.infer<typeof ChainSpecSchema>,
): BlockAuthoringConfig {
  return {
    networkId: cliConfig.networkId,
    validatorKey:
      cliConfig.validatorKey ||
      '0x0000000000000000000000000000000000000000000000000000000000000000',
    slotDuration: cliConfig.slotDuration,
    epochLength: cliConfig.epochLength,
    maxExtrinsicsPerBlock: cliConfig.maxExtrinsicsPerBlock,
    maxWorkPackagesPerBlock: cliConfig.maxWorkPackagesPerBlock,
    enableStrictValidation: cliConfig.enableStrictValidation,
    enableAuditMode: cliConfig.enableAuditMode,
    enableSafroleValidation: cliConfig.enableSafroleValidation,
    enableGrandpaFinalization: cliConfig.enableGrandpaFinalization,
  }
}

/**
 * Create genesis configuration
 */
function createGenesisConfig(
  cliConfig: CliConfig,
  genesisState: GenesisState,
): GenesisConfig {
  return {
    genesisPath: cliConfig.genesisPath,
    genesisData: genesisState,
    validation: {
      validateGenesis: true,
      allowEmptyGenesis: false,
      requireValidators: true,
      requireAccounts: true,
    },
    import: {
      createMissingAccounts: true,
      initializeValidators: true,
      resetExistingState: false,
      backupExistingState: true,
    },
  }
}

/**
 * Initialize block authoring service
 */
async function initializeBlockAuthoringService(
  cliConfig: CliConfig,
): Promise<{ service: BlockAuthoringServiceImpl; genesisState: GenesisState }> {
  try {
    // Load and validate chain-spec
    const chainSpec = await loadChainSpec(cliConfig.chainSpecPath)

    // Decode genesis state
    const genesisState = decodeGenesisState(chainSpec)

    // Create block authoring service
    const service = new BlockAuthoringServiceImpl()

    // Create configurations
    const blockAuthoringConfig = createBlockAuthoringConfig(
      cliConfig,
      chainSpec,
    )
    const genesisConfig = createGenesisConfig(cliConfig, genesisState)

    // Configure service
    service.configure(blockAuthoringConfig)

    // Initialize genesis
    const genesisInitialized = await service.initializeGenesis(genesisConfig)
    if (!genesisInitialized) {
      throw new Error('Failed to initialize genesis state')
    }

    logger.info('Block authoring service initialized successfully', {
      networkId: blockAuthoringConfig.networkId,
      chainId: genesisState.network.chainId,
      accountsCount: genesisState.state.accounts.size,
      validatorsCount: genesisState.state.validators.length,
    })

    return { service, genesisState }
  } catch (error) {
    logger.error('Failed to initialize block authoring service:', error)
    throw error
  }
}

/**
 * Create CLI program
 */
function createCliProgram(): Command {
  const program = new Command()
    .name('block-authoring')
    .description('Block authoring service for JAM Protocol')
    .version('0.0.1')

  // Main command for running the block authoring service
  program
    .command('run')
    .description('Run the block authoring service')
    .requiredOption('--chain-spec <path>', 'Path to chain-spec file')
    .option('--validator-key <key>', 'Validator private key (hex)')
    .option('--network-id <id>', 'Network identifier', 'dev')
    .option('--slot-duration <ms>', 'Slot duration in milliseconds', '6000')
    .option('--epoch-length <slots>', 'Epoch length in slots', '600')
    .option('--max-extrinsics <count>', 'Maximum extrinsics per block', '1000')
    .option(
      '--max-work-packages <count>',
      'Maximum work packages per block',
      '100',
    )
    .option('--strict-validation', 'Enable strict validation', true)
    .option('--audit-mode', 'Enable audit mode', false)
    .option('--safrole-validation', 'Enable Safrole validation', true)
    .option('--grandpa-finalization', 'Enable Grandpa finalization', true)
    .option('--genesis-path <path>', 'Path to genesis file (optional)')
    .option('--output-path <path>', 'Path for output files')
    .option('--verbose', 'Enable verbose logging', false)
    .action(async (options) => {
      try {
        // Parse and validate CLI configuration
        const cliConfig: CliConfig = CliConfigSchema.parse({
          chainSpecPath: options.chainSpec,
          validatorKey: options.validatorKey,
          networkId: options.networkId,
          slotDuration: Number.parseInt(options.slotDuration),
          epochLength: Number.parseInt(options.epochLength),
          maxExtrinsicsPerBlock: Number.parseInt(options.maxExtrinsics),
          maxWorkPackagesPerBlock: Number.parseInt(options.maxWorkPackages),
          enableStrictValidation: options.strictValidation,
          enableAuditMode: options.auditMode,
          enableSafroleValidation: options.safroleValidation,
          enableGrandpaFinalization: options.grandpaFinalization,
          genesisPath: options.genesisPath,
          outputPath: options.outputPath,
          verbose: options.verbose,
        })

        logger.info(
          'Starting block authoring service with configuration:',
          cliConfig,
        )

        // Initialize service
        const { service, genesisState } =
          await initializeBlockAuthoringService(cliConfig)

        logger.info('Block authoring service is ready')
        logger.info('Press Ctrl+C to stop the service')

        // Keep the service running
        process.on('SIGINT', () => {
          logger.info('Shutting down block authoring service...')
          process.exit(0)
        })

        // Example: Create a test block (you can remove this in production)
        if (cliConfig.verbose) {
          logger.info('Creating test block...')

          // Create a minimal block authoring context
          const context: BlockAuthoringContext = {
            parentHeader: {
              number: 0,
              parentHash: genesisState.genesisBlock.parentHash as `0x${string}`,
              stateRoot:
                '0x0000000000000000000000000000000000000000000000000000000000000000',
              extrinsicsRoot:
                '0x0000000000000000000000000000000000000000000000000000000000000000',
              timestamp: Date.now(),
              author: '',
              signature: '',
            },
            parentState: {
              blockNumber: 0,
              stateRoot:
                '0x0000000000000000000000000000000000000000000000000000000000000000',
              timestamp: Date.now(),
              validators: [],
            },
            currentTimeslot: 0,
            validatorSet: {
              validators: [],
              totalStake: BigInt(0),
              minStake: BigInt(0),
              epoch: 0,
            },
            authorIndex: 0,
            extrinsics: [],
            workPackages: [],
            networkState: {
              connectedPeers: 0,
              averageLatency: 0,
              propagationStatus: PropagationStatus.PENDING,
              finalizationStatus: FinalizationStatus.UNFINALIZED,
            },
          }

          const result: BlockAuthoringResult =
            await service.createBlock(context)

          if (result.success) {
            logger.info('Test block created successfully', {
              blockNumber: result.block?.header.number,
              parentHash: result.block?.header.parentHash,
              metrics: result.metrics,
            })
          } else {
            logger.error('Failed to create test block:', result.error)
          }
        }
      } catch (error) {
        if (error instanceof z.ZodError) {
          logger.error('Configuration validation failed:', {
            errors: error.errors.map((err) => ({
              path: err.path.join('.'),
              message: err.message,
            })),
          })
        } else {
          logger.error('Block authoring service failed:', error)
        }
        process.exit(1)
      }
    })

  // Command to validate chain-spec
  program
    .command('validate')
    .description('Validate chain-spec file')
    .requiredOption('--chain-spec <path>', 'Path to chain-spec file')
    .action(async (options) => {
      try {
        const chainSpec = await loadChainSpec(options.chainSpec)
        logger.info('Chain-spec validation successful', {
          id: chainSpec.id,
          bootnodesCount: chainSpec.bootnodes.length,
          genesisStateKeys: Object.keys(chainSpec.genesis_state).length,
        })
      } catch (error) {
        logger.error('Chain-spec validation failed:', error)
        process.exit(1)
      }
    })

  // Command to decode and display genesis state
  program
    .command('decode')
    .description('Decode and display genesis state from chain-spec')
    .requiredOption('--chain-spec <path>', 'Path to chain-spec file')
    .option('--output <path>', 'Output file path (optional)')
    .action(async (options) => {
      try {
        const chainSpec = await loadChainSpec(options.chainSpec)
        const genesisState = decodeGenesisState(chainSpec)

        const output = {
          chainSpec,
          genesisState: {
            ...genesisState,
            state: {
              ...genesisState.state,
              accounts: Array.from(genesisState.state.accounts.entries()),
              privileges: Array.from(genesisState.state.privileges.entries()),
              activity: Array.from(genesisState.state.activity.entries()),
            },
          },
        }

        if (options.output) {
          const fs = await import('node:fs')
          fs.writeFileSync(options.output, JSON.stringify(output, null, 2))
          logger.info(`Decoded genesis state written to: ${options.output}`)
        } else {
        }
      } catch (error) {
        logger.error('Failed to decode genesis state:', error)
        process.exit(1)
      }
    })

  return program
}

/**
 * Main CLI entry point
 */
async function main() {
  try {
    const program = createCliProgram()
    await program.parseAsync()
  } catch (error) {
    logger.error('CLI execution failed:', error)
    process.exit(1)
  }
}

// Run CLI if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

export { createCliProgram, loadChainSpec, decodeGenesisState }
