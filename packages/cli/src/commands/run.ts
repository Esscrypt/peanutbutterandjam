import { logger } from '@pbnj/core'
import { MainServiceImpl } from '@pbnj/node'
import { Command } from 'commander'
import {
  isValidHex,
  isValidPath,
  isValidTimestamp,
} from '../utils/validation.js'

export function createRunCommand(): Command {
  const command = new Command('run')
    .description('Run a JAM node')
    .option('--bootnode <address>', 'Bootnode address for network connection')
    .option('--chain <file>', 'Chain specification file', 'chainspec.json')
    .option('--data-path <path>', 'Path to store node data')
    .option('--bandersnatch <key>', 'Bandersnatch key for consensus')
    .option('--bls <key>', 'BLS key for consensus')
    .option('--ed25519 <key>', 'Ed25519 key for networking')
    .option('--genesis <file>', 'Genesis block file')
    .option('--metadata <file>', 'Chain metadata file')
    .option('--ts <timestamp>', 'Block timestamp')
    .action(async (options) => {
      await executeRunCommand(options)
    })

  return command
}

async function executeRunCommand(options: any): Promise<void> {
  // options parameter already contains the parsed command line options from Commander.js

  try {
    // Validate hex arguments
    if (options.bandersnatch && !isValidHex(options.bandersnatch)) {
      throw new Error('Invalid bandersnatch seed: must be a valid hex string')
    }

    if (options.bls && !isValidHex(options.bls)) {
      throw new Error('Invalid BLS seed: must be a valid hex string')
    }

    if (options.ed25519 && !isValidHex(options.ed25519)) {
      throw new Error('Invalid Ed25519 seed: must be a valid hex string')
    }

    // Validate path arguments
    if (options.genesis && !isValidPath(options.genesis)) {
      throw new Error('Invalid genesis file path')
    }

    // Validate timestamp
    if (options.ts !== undefined && !isValidTimestamp(options.ts)) {
      throw new Error('Invalid timestamp: must be a valid Unix timestamp')
    }

    // Initialize the actual block authoring service
    logger.info('Initializing PeanutButterAndJam node...')

    // Create configuration for the block authoring service
    const config = {
      networkId: 'dev',
      validatorKey: options.bandersnatch || '',
      slotDuration: 6000,
      epochLength: 600,
      maxExtrinsicsPerBlock: 1000,
      maxWorkPackagesPerBlock: 100,
      enableStrictValidation: true,
      enableAuditMode: false,
      enableSafroleValidation: true,
      enableGrandpaFinalization: true,
    }

    // Log configuration
    logger.info('Configuration:')
    logger.info(`  Chain: ${options.chain || 'chainspec.json'}`)
    logger.info(`  Data directory: ${options.dataPath || '~/.jamduna'}`)
    logger.info(`  Node metadata: ${options.metadata || 'Alice'}`)

    if (options.validatorIndex !== undefined) {
      logger.info(`  Validator index: ${options.validatorIndex}`)
    }

    if (options.genesis) {
      logger.info(`  Genesis file: ${options.genesis}`)
    }

    if (options.ts !== undefined) {
      logger.info(`  Epoch0 timestamp: ${options.ts}`)
    }

    if (options.bandersnatch) {
      logger.info(`  Bandersnatch seed: ${options.bandersnatch}`)
    }

    if (options.bls) {
      logger.info(`  BLS seed: ${options.bls}`)
    }

    if (options.ed25519) {
      logger.info(`  Ed25519 seed: ${options.ed25519}`)
    }

    // Initialize and start the block authoring service
    const mainService = new MainServiceImpl({
      blockAuthoring: config,
      genesis: {
        genesisPath: options.genesis,
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
          backupExistingState: false,
        },
      },
      networking: {
        validatorIndex: options.validatorIndex || 0,
        nodeType: 'validator',
        listenAddress: '0.0.0.0',
        listenPort: 30333,
        chainHash: options.chain || 'dev',
        isBuilder: false,
      },
      nodeId: 'jam-node-cli',
    })

    logger.info('Starting block authoring service...')
    const started = await mainService.start()
    if (!started) {
      throw new Error('Failed to start block authoring service')
    }

    logger.info('PeanutButterAndJam node is running')
    logger.info('Press Ctrl+C to stop the node')

    // Keep the service running
    const keepAlive = setInterval(() => {
      // Keep the process alive
    }, 1000)

    // Handle shutdown
    process.on('SIGINT', async () => {
      logger.info('Shutting down PeanutButterAndJam node...')
      clearInterval(keepAlive)
      await mainService.stop()
      logger.info('Node stopped successfully')
      process.exit(0)
    })

    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM, shutting down...')
      clearInterval(keepAlive)
      await mainService.stop()
      process.exit(0)
    })
  } catch (error) {
    logger.error(
      'Failed to start node:',
      error instanceof Error ? error.message : String(error),
    )
    if (error instanceof Error && error.stack) {
      logger.error('Stack trace:', error.stack)
    }
    process.exit(1)
  }
}
