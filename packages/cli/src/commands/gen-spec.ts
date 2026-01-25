import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { logger } from '@pbnjam/core'
import { ConfigService } from '@pbnjam/node'
import { generateChainSpec } from '../utils/chain-spec.js'

type ConfigMode =
  | 'tiny'
  | 'small'
  | 'medium'
  | 'large'
  | 'xlarge'
  | '2xlarge'
  | '3xlarge'
  | 'full'

const VALID_MODES: ConfigMode[] = [
  'tiny',
  'small',
  'medium',
  'large',
  'xlarge',
  '2xlarge',
  '3xlarge',
  'full',
]

export function createGenSpecCommand(args: string[]): void {
  let inputFile: string | undefined
  let outputFile: string | undefined
  let configMode: ConfigMode = 'tiny' // Default to tiny

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--mode' || arg === '--config') {
      const mode = args[i + 1]
      if (!mode) {
        console.error('Error: --mode requires a value')
        console.log(
          'Valid modes: tiny, small, medium, large, xlarge, 2xlarge, 3xlarge, full',
        )
        process.exit(1)
      }
      if (!VALID_MODES.includes(mode as ConfigMode)) {
        console.error(`Error: Invalid mode "${mode}"`)
        console.log(
          'Valid modes: tiny, small, medium, large, xlarge, 2xlarge, 3xlarge, full',
        )
        process.exit(1)
      }
      configMode = mode as ConfigMode
      i++ // Skip the next argument as it's the mode value
    } else if (!inputFile) {
      inputFile = arg
    } else if (!outputFile) {
      outputFile = arg
    }
  }

  if (!inputFile || !outputFile) {
    console.error('Error: Both input file and output file are required')
    console.log(
      'Usage: pbnj gen-spec <input-file> <output-file> [--mode <mode>]',
    )
    console.log(
      'Valid modes: tiny, small, medium, large, xlarge, 2xlarge, 3xlarge, full (default: tiny)',
    )
    process.exit(1)
  }

  try {
    if (!existsSync(inputFile)) {
      logger.error(`Input file not found: ${inputFile}`)
      process.exit(1)
    }

    const configService = new ConfigService(configMode)
    logger.info(`Using config mode: ${configMode}`)
    const inputConfig = JSON.parse(readFileSync(inputFile, 'utf-8'))
    const chainSpec = generateChainSpec(inputConfig, configService)

    writeFileSync(outputFile, JSON.stringify(chainSpec, null, 2))
    logger.info(`Chain spec generated successfully: ${outputFile}`)
  } catch (error) {
    logger.error(
      'Failed to generate chain spec:',
      error instanceof Error ? error.message : String(error),
    )
    process.exit(1)
  }
}

// Execute if this file is run directly
if (require.main === module) {
  console.log('Running gen-spec command directly')
  createGenSpecCommand(process.argv.slice(2))
}
