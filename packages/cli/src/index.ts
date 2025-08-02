#!/usr/bin/env node

import { Command } from 'commander'
import { version } from '../package.json'
import { CommandHandler } from './command-handler'
import { parseArguments } from './parser'

const program = new Command()

program.name('pbnj').description('PeanutButterAndJam CLI').version(version)

// Global flags
program
  .option('-c, --config <path>', 'Path to the config file')
  .option(
    '-l, --log-level <level>',
    'Log level (trace, debug, info, warn, error)',
    'debug',
  )
  .option(
    '-t, --temp',
    'Use a temporary data directory, removed on exit. Conflicts with data-path',
  )
  .option('-v, --verbose', 'Enable verbose logging')

// Commands
program
  .command('gen-keys')
  .description(
    'Generate keys for validators, pls generate keys for all validators before running the node',
  )
  .action(async (options) => {
    const args = parseArguments(options)
    const handler = new CommandHandler()
    await handler.execute('gen-keys', args)
  })

program
  .command('gen-spec')
  .description('Generate new chain spec from the spec config')
  .action(async (options) => {
    const args = parseArguments(options)
    const handler = new CommandHandler()
    await handler.execute('gen-spec', args)
  })

program
  .command('list-keys')
  .description('List keys for validators')
  .action(async (options) => {
    const args = parseArguments(options)
    const handler = new CommandHandler()
    await handler.execute('list-keys', args)
  })

program
  .command('print-spec')
  .description('Generate new chain spec from the spec config')
  .action(async (options) => {
    const args = parseArguments(options)
    const handler = new CommandHandler()
    await handler.execute('print-spec', args)
  })

program
  .command('run')
  .description('Run the PeanutButterAndJam node')
  .action(async (options) => {
    const args = parseArguments(options)
    const handler = new CommandHandler()
    await handler.execute('run', args)
  })

program
  .command('test-stf')
  .description('Run the STF Validation')
  .action(async (options) => {
    const args = parseArguments(options)
    const handler = new CommandHandler()
    await handler.execute('test-stf', args)
  })

program
  .command('test-safrole')
  .description('Test Safrole consensus protocol against JAM test vectors')
  .option('--vectors <type>', 'Test vector type: tiny or full', 'tiny')
  .option('--vector <name>', 'Test specific vector by name')
  .action(async (options) => {
    const args = parseArguments(options)
    const handler = new CommandHandler()
    await handler.execute('test-safrole', args)
  })

program
  .command('test-all')
  .description('Test all JAM protocol components against test vectors')
  .option('--vectors <type>', 'Test vector type: tiny or full', 'tiny')
  .action(async (options) => {
    const args = parseArguments(options)
    const handler = new CommandHandler()
    await handler.execute('test-all', args)
  })

// Parse command line arguments
program.parse()
