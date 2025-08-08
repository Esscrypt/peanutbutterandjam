#!/usr/bin/env bun

import { config } from 'dotenv'
import { logger } from '@pbnj/core'
import { createRunCommand } from './commands/run'
import { createGenSpecCommand } from './commands/gen-spec'
import { createGenKeysCommand } from './commands/gen-keys'
import { createListKeysCommand } from './commands/list-keys'

// Load environment variables
config()

// Initialize logger
logger.init()

// Parse command and arguments manually
const args = process.argv.slice(2)
const command = args[0]

// Check for global help/version flags only if no subcommand or if it's a global flag
if (!command || command === '--help' || command === '-h' || command === '--version' || command === '-v') {
  // Show help if requested
  if (command === '--help' || command === '-h') {
    console.log(`
PeanutButterAndJam CLI

Usage:
  pbnj <command> [options]

Available Commands:
  run         Run the PeanutButterAndJam node
  gen-spec    Generate chain specification
  gen-keys    Generate validator keys
  list-keys   List generated keys

Use "pbnj <command> --help" for more information about a command.
`)
    process.exit(0)
  }

  // Show version if requested
  if (command === '--version' || command === '-v') {
    console.log('PeanutButterAndJam CLI v0.1.0')
    process.exit(0)
  }
}

const isSubcommandHelp = args.length > 1 && (args[1] === '--help' || args[1] === '-h')

// Main execution
;(async () => {
  switch (command) {
    case 'run':
      if (isSubcommandHelp) {
        console.log(`
Run the PeanutButterAndJam node

Usage:
  pbnj run [options]

Options:
  -b, --bootnode <string>        Specify a bootnode
  -c, --chain <string>           Chain to run. "polkadot", "dev", or the path of a chain spec file (default: "chainspec.json")
  -d, --data-path <string>       Specifies the directory for the blockchain, keystore, and other data (default: "/Users/tanyageorgieva/.jamduna")
      --datadir <string>         Alias for --data-path (JAM standard)
      --debug <string>           Specifies debug flags for enhanced logging (default: "r,g")
      --dev-validator <int>      Validator Index (only for development)
      --validatorindex <int>     Alias for --dev-validator (JAM standard)
      --external-ip <string>     External IP of this node
      --listen-ip <string>       IP address to listen on (default: "::")
      --peer-id <int>            Peer ID of this node
  -p, --port <int>               Specifies the network listening port (default: 40000)
      --pvm-backend <string>     The PVM backend to use (default: "interpreter")
      --rpc-listen-ip <string>   IP address for RPC server to listen on (default: "::")
  -r, --rpc-port <int>           Specifies the RPC listening port (default: 19800)
      --start-time <string>      Start time in format: YYYY-MM-DD HH:MM:SS
      --telemetry <string>       Send data to TART server (JIP-3)
      --bandersnatch <hex>       Bandersnatch Seed (only for development)
      --bls <hex>                BLS Seed (only for development)
      --ed25519 <hex>            Ed25519 Seed (only for development)
      --genesis <path>           Specifies the genesis state json file
      --metadata <string>        Node metadata (default: "Alice")
      --ts <int>                 Epoch0 Unix timestamp (will override genesis config)
  -h, --help                     Show this help message
`)
        return
      }
      await createRunCommand(args.slice(1))
      break
    case 'gen-spec':
      if (isSubcommandHelp) {
        console.log(`
Generate chain specification

Usage:
  pbnj gen-spec <input-file> <output-file>

Arguments:
  input-file    Path to the chain spec configuration file
  output-file   Path where the generated chain spec will be saved

Example:
  pbnj gen-spec config/chain-spec-config.json chainspec.json
`)
        return
      }
      createGenSpecCommand(args.slice(1))
      break
    case 'gen-keys':
      if (isSubcommandHelp) {
        console.log(`
Generate validator keys

Usage:
  pbnj gen-keys [options]

Options:
  -h, --help    Show this help message

This command generates keys for validators.
`)
        return
      }
      createGenKeysCommand(args.slice(1))
      break
    case 'list-keys':
      if (isSubcommandHelp) {
        console.log(`
List validator keys

Usage:
  pbnj list-keys [options]

Options:
  -h, --help    Show this help message

This command lists generated validator keys.
`)
        return
      }
      createListKeysCommand(args.slice(1))
      break
    default:
      console.error(`Unknown command: ${command}`)
      console.log('Available commands: run, gen-spec, gen-keys, list-keys')
      console.log('Use "pbnj --help" for more information')
      process.exit(1)
  }
})().catch((error) => {
  console.error('Unhandled error:', error)
  process.exit(1)
})
