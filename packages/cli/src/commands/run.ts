import { logger } from '@pbnjam/core'
import { MainService } from '@pbnjam/node'
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
    .option('--networking-only', 'Run only the networking service for testing')
    .option('--validator-index <number>', 'Validator index for networking', '0')
    .option('--listen-port <number>', 'Network listening port', '30333')
    .option(
      '--listen-address <address>',
      'Network listening address',
      '0.0.0.0',
    )
    .option('--test-messages', 'Enable test message sending for networking')
    .option(
      '--test-interval <ms>',
      'Test message interval in milliseconds',
      '6000',
    )
    .option(
      '--max-test-messages <number>',
      'Maximum test messages to send',
      '100',
    )
    .option(
      '--keepalive-interval <ms>',
      'QUIC keepalive interval in milliseconds',
      '30000',
    )
    .option('--disable-keepalive', 'Disable QUIC keepalive mechanism')
    .option(
      '--telemetry <endpoint>',
      'Send telemetry data to JAM Tart server (JIP-3) in HOST:PORT format',
    )
    .action(async (options) => {
      await executeRunCommand(options)
    })

  return command
}

async function executeRunCommand(
  options: Record<string, string>,
): Promise<void> {
  // options parameter already contains the parsed command line options from Commander.js

  try {
    // Validate hex arguments
    if (options['bandersnatch'] && !isValidHex(options['bandersnatch'])) {
      throw new Error('Invalid bandersnatch seed: must be a valid hex string')
    }

    if (options['bls'] && !isValidHex(options['bls'])) {
      throw new Error('Invalid BLS seed: must be a valid hex string')
    }

    if (options['ed25519'] && !isValidHex(options['ed25519'])) {
      throw new Error('Invalid Ed25519 seed: must be a valid hex string')
    }

    // Validate path arguments
    if (options['genesis'] && !isValidPath(options['genesis'])) {
      throw new Error('Invalid genesis file path')
    }

    // Validate timestamp
    if (
      options['ts'] !== undefined &&
      !isValidTimestamp(Number(options['ts']))
    ) {
      throw new Error('Invalid timestamp: must be a valid Unix timestamp')
    }

    // Validate telemetry endpoint
    if (options['telemetry']) {
      const telemetryRegex = /^[^:]+:\d+$/
      if (!telemetryRegex.test(options['telemetry'])) {
        throw new Error(
          'Invalid telemetry endpoint: must be in HOST:PORT format',
        )
      }
    }

    // Initialize the actual block authoring service
    logger.info('Initializing PeanutButterAndJam node...')

    // Log configuration
    logger.info('Configuration:')
    logger.info(`  Chain: ${options['chain'] || 'chainspec.json'}`)
    logger.info(`  Data directory: ${options['dataPath'] || '~/.jamduna'}`)
    logger.info(`  Node metadata: ${options['metadata'] || 'Alice'}`)

    if (options['validatorIndex'] !== undefined) {
      logger.info(`  Validator index: ${options['validatorIndex']}`)
    }

    if (options['genesis']) {
      logger.info(`  Genesis file: ${options['genesis']}`)
    }

    if (options['ts'] !== undefined) {
      logger.info(`  Epoch0 timestamp: ${options['ts']}`)
    }

    if (options['bandersnatch']) {
      logger.info(`  Bandersnatch seed: ${options['bandersnatch']}`)
    }

    if (options['bls']) {
      logger.info(`  BLS seed: ${options['bls']}`)
    }

    if (options['ed25519']) {
      logger.info(`  Ed25519 seed: ${options['ed25519']}`)
    }

    if (options['telemetry']) {
      logger.info(`  Telemetry endpoint: ${options['telemetry']}`)
    }

    // Configure test mode
    const testMode = {
      enableTestMessages: options['testMessages'] || false,
      testMessageInterval: Number.parseInt(options['testInterval'] || '6000'),
      maxTestMessages: Number.parseInt(options['maxTestMessages'] || '100'),
    }

    // Configure keepalive
    const keepaliveConfig = {
      enabled: !options['disableKeepalive'],
      interval: Number.parseInt(options['keepaliveInterval'] || '30000'),
    }

    logger.info('Configuration', {
      testMode,
      keepalive: keepaliveConfig,
    })

    // Configure telemetry if provided
    let telemetryConfig
    if (options['telemetry']) {
      telemetryConfig = {
        enabled: true,
        endpoint: options['telemetry'],
        maxBufferSize: 1000n,
        retrySettings: {
          maxRetries: 10n,
          retryDelayMs: 5000n,
          backoffMultiplier: 2n,
        },
      }
    }

    // Parse validator index if provided
    const validatorIndex =
      options['validatorIndex'] !== undefined
        ? Number.parseInt(options['validatorIndex'], 10)
        : undefined

    // Initialize and start the main service
    const mainService = new MainService({
      genesis: {
        chainSpecPath: options['chain'] || 'chainspec.json',
        genesisJsonPath: options['genesis'],
      },
      networking: {
        nodeType: 'validator',
        isBuilder: false,
      },
      nodeId: 'jam-node-cli',
      ...(telemetryConfig && { telemetry: telemetryConfig }),
      ...(validatorIndex !== undefined && { validatorIndex }),
    })

    logger.info('Starting JAM node...')
    await mainService.start()
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
