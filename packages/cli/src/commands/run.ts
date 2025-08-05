import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { logger } from '@pbnj/core'
import { Command } from 'commander'

// Helper function to find the PeanutButterAndJam binary
function findPeanutButterAndJamBinary(): string | null {
  // Common paths where PeanutButterAndJam might be installed
  const possiblePaths = [
    // TypeScript source (preferred)
    './src/index.ts',
    // Current directory
    './pbnj',
    // Build directory
    './dist/index.js',
    // System PATH
    'pbnj',
  ]
  for (const path of possiblePaths) {
    try {
      if (existsSync(path)) {
        return path
      }
    } catch (_error) {}
  }
  return null
}

// Helper function to build PeanutButterAndJam command arguments
function buildPeanutButterAndJamArgs(options: {
  chain: string
  dataPath: string
  debug: string
  devValidator: number
  externalIp: string
  listenIp: string
  peerId: number
  port: number
  pvmBackend: string
  rpcListenIp: string
  rpcPort: number
  startTime: string
  telemetry: string
  bootnode: string
}): string[] {
  const args = ['run']

  // Add chain spec
  if (options.chain) {
    args.push('--chain', options.chain)
  }

  // Add data path
  if (options.dataPath) {
    args.push('--data-path', options.dataPath)
  }

  // Add debug flags
  if (options.debug) {
    args.push('--debug', options.debug)
  }

  // Add dev validator
  if (options.devValidator !== undefined) {
    args.push('--dev-validator', options.devValidator.toString())
  }

  // Add external IP
  if (options.externalIp) {
    args.push('--external-ip', options.externalIp)
  }

  // Add listen IP
  if (options.listenIp) {
    args.push('--listen-ip', options.listenIp)
  }

  // Add peer ID
  if (options.peerId !== undefined) {
    args.push('--peer-id', options.peerId.toString())
  }

  // Add port
  if (options.port) {
    args.push('--port', options.port.toString())
  }

  // Add PVM backend
  if (options.pvmBackend) {
    args.push('--pvm-backend', options.pvmBackend)
  }

  // Add RPC listen IP
  if (options.rpcListenIp) {
    args.push('--rpc-listen-ip', options.rpcListenIp)
  }

  // Add RPC port
  if (options.rpcPort) {
    args.push('--rpc-port', options.rpcPort.toString())
  }

  // Add start time
  if (options.startTime) {
    args.push('--start-time', options.startTime)
  }

  // Add telemetry
  if (options.telemetry) {
    args.push('--telemetry', options.telemetry)
  }

  // Add bootnode
  if (options.bootnode) {
    args.push('--bootnode', options.bootnode)
  }

  return args
}

export function createRunCommand(): Command {
  const command = new Command('run')
    .description('Run the PeanutButterAndJam node')
    .argument('[start]', 'Start the node (use "start" to begin)', 'start')
    .option('--bootnode <string>', 'Specify a bootnode')
    .option(
      '--chain <string>',
      'Chain to run. "polkadot", "dev", or the path of a chain spec file',
      'chainspec.json',
    )
    .option(
      '-d, --data-path <string>',
      'Specifies the directory for the blockchain, keystore, and other data',
      '/Users/tanyageorgieva/.jamduna',
    )
    .option(
      '--debug <string>',
      'Specifies debug flags for enhanced logging (block,guarantees,rotation,assurances,audit,da,node,quic,beefy,audit,grandpa,web,state)',
      'r,g',
    )
    .option('--dev-validator <int>', 'Validator Index (only for development)')
    .option(
      '--external-ip <string>',
      'External IP of this node, as used by other nodes to connect. If not specified, this will be guessed.',
    )
    .option(
      '--listen-ip <string>',
      'IP address to listen on. :: (the default) means all addresses.',
      '::',
    )
    .option(
      '--peer-id <int>',
      'Peer ID of this node. If not specified, a new peer ID will be generated. The corresponding secret key will not be persisted.',
    )
    .option('--port <int>', 'Specifies the network listening port.', '40000')
    .option(
      '--pvm-backend <string>',
      'The PVM backend to use. Possible values: interpreter, compiler',
      'interpreter',
    )
    .option(
      '--rpc-listen-ip <string>',
      'IP address for RPC server to listen on. :: (the default) means all addresses.',
      '::',
    )
    .option('--rpc-port <int>', 'Specifies the RPC listening port.', '19800')
    .option(
      '--start-time <string>',
      'Start time in format: YYYY-MM-DD HH:MM:SS',
    )
    .option('--telemetry <string>', 'Send data to TART server (JIP-3)')
    .action(async (_start, options) => {
      try {
        // Find the PeanutButterAndJam binary first
        const pbnjPath = findPeanutButterAndJamBinary()
        logger.info(`Looking for PeanutButterAndJam binary...`)
        if (!pbnjPath) {
          logger.error('PeanutButterAndJam binary not found. Searched paths:')
          const possiblePaths = [
            './pbnj',
            './dist/index.js',
            join(__dirname, '../../dist/index.js'),
            'pbnj',
            join(process.env['HOME'] || '', '.local/bin/pbnj'),
            join(process.env['HOME'] || '', 'bin/pbnj'),
          ]
          possiblePaths.forEach((path) => {
            logger.error(
              `  ${path}: ${existsSync(path) ? 'EXISTS' : 'NOT FOUND'}`,
            )
          })
          throw new Error(
            'PeanutButterAndJam binary not found. Please ensure it is built and accessible.',
          )
        }

        logger.info('Starting PeanutButterAndJam node...')
        logger.info(`Chain: ${options.chain}`)
        logger.info(`Data path: ${options.dataPath}`)
        logger.info(`Network port: ${options.port}`)
        logger.info(`RPC port: ${options.rpcPort}`)
        logger.info(`PVM backend: ${options.pvmBackend}`)

        if (options.devValidator !== undefined) {
          logger.info(`Development validator index: ${options.devValidator}`)
        }

        if (options.bootnode) {
          logger.info(`Bootnode: ${options.bootnode}`)
        }

        logger.info(`Using PeanutButterAndJam binary: ${pbnjPath}`)

        // Build command arguments
        const args = buildPeanutButterAndJamArgs(options)

        // Spawn the PeanutButterAndJam process
        const isTypeScript = pbnjPath.endsWith('.ts')
        const spawnArgs = isTypeScript
          ? ['tsx', pbnjPath, ...args]
          : [pbnjPath, ...args]
        const spawnCommand = isTypeScript ? 'bun' : pbnjPath

        const pbnjProcess = spawn(spawnCommand, spawnArgs, {
          stdio: 'inherit',
          cwd: process.cwd(),
        })

        logger.info('Node started successfully')
        logger.info('Press Ctrl+C to stop the node')

        // Handle process events
        pbnjProcess.on('error', (error: Error) => {
          logger.error('Failed to start PeanutButterAndJam process:', error)
          process.exit(1)
        })

        pbnjProcess.on(
          'exit',
          (code: number | null, signal: NodeJS.Signals | null) => {
            if (code !== null) {
              logger.info(`PeanutButterAndJam process exited with code ${code}`)
            } else if (signal !== null) {
              logger.info(
                `PeanutButterAndJam process was killed with signal ${signal}`,
              )
            }
            process.exit(code || 0)
          },
        )

        // Handle graceful shutdown
        process.on('SIGINT', () => {
          logger.info('Shutting down node...')
          pbnjProcess.kill('SIGINT')
        })

        process.on('SIGTERM', () => {
          logger.info('Terminating node...')
          pbnjProcess.kill('SIGTERM')
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
    })

  return command
}
