import { logger } from '@pbnj/core'
import { MainServiceImpl } from '@pbnj/node'
import { getOption, parseArgs } from '../utils/arg-parser'
import {
  isValidHex,
  isValidPath,
  isValidTimestamp,
} from '../utils/validation.js'

export async function createRunCommand(args: string[]): Promise<void> {
  const parsedArgs = parseArgs(args)

  // Extract options with defaults
  const options = {
    bootnode: getOption(parsedArgs, 'bootnode', ''),
    chain: getOption(parsedArgs, 'chain', 'chainspec.json'),
    'data-path': getOption(
      parsedArgs,
      'data-path',
      '/Users/tanyageorgieva/.jamduna',
    ),
    datadir: getOption(parsedArgs, 'datadir', ''),
    debug: getOption(parsedArgs, 'debug', 'r,g'),
    'dev-validator': getOption(parsedArgs, 'dev-validator'),
    validatorindex: getOption(parsedArgs, 'validatorindex'),
    'external-ip': getOption(parsedArgs, 'external-ip', ''),
    'listen-ip': getOption(parsedArgs, 'listen-ip', '::'),
    'peer-id': getOption(parsedArgs, 'peer-id'),
    port: getOption(parsedArgs, 'port', 40000),
    'pvm-backend': getOption(parsedArgs, 'pvm-backend', 'interpreter'),
    'rpc-listen-ip': getOption(parsedArgs, 'rpc-listen-ip', '::'),
    'rpc-port': getOption(parsedArgs, 'rpc-port', 19800),
    'start-time': getOption(parsedArgs, 'start-time', ''),
    telemetry: getOption(parsedArgs, 'telemetry', ''),
    bandersnatch: getOption(parsedArgs, 'bandersnatch', ''),
    bls: getOption(parsedArgs, 'bls', ''),
    ed25519: getOption(parsedArgs, 'ed25519', ''),
    genesis: getOption(parsedArgs, 'genesis', ''),
    metadata: getOption(parsedArgs, 'metadata', 'Alice'),
    ts: getOption(parsedArgs, 'ts'),
  }

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
    logger.info(
      `  Data directory: ${options['data-path'] || options.datadir || '~/.jamduna'}`,
    )
    logger.info(`  Network port: ${options.port || 40000}`)
    logger.info(`  RPC port: ${options['rpc-port'] || 19800}`)
    logger.info(`  Node metadata: ${options.metadata || 'Alice'}`)

    if (options['validatorindex'] !== undefined) {
      logger.info(`  Validator index: ${options['validatorindex']}`)
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
    const blockAuthoringService = new MainServiceImpl({
      blockAuthoring: config,
      genesis: {
        genesisPath: options.genesis,
      },
      networking: {
        validatorIndex: options['validatorindex'],
        nodeType: 'validator',
        listenAddress: options['listen-ip'],
        listenPort: options.port,
        chainHash: options.chain,
        isBuilder: false,
      },
      nodeId: options['peer-id'],
    })

    logger.info('Starting block authoring service...')
    const started = await blockAuthoringService.start()
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
      await blockAuthoringService.stop()
      logger.info('Node stopped successfully')
      process.exit(0)
    })

    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM, shutting down...')
      clearInterval(keepAlive)
      await blockAuthoringService.stop()
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
