import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { logger } from '@pbnjam/core'
import { ConfigService } from '../../../../infra/node/services/config-service.js'
import { generateChainSpec } from '../utils/chain-spec.js'

export function createGenSpecCommand(args: string[]): void {
  const [inputFile, outputFile] = args

  if (!inputFile || !outputFile) {
    console.error('Error: Both input file and output file are required')
    console.log('Usage: pbnj gen-spec <input-file> <output-file>')
    process.exit(1)
  }

  try {
    if (!existsSync(inputFile)) {
      logger.error(`Input file not found: ${inputFile}`)
      process.exit(1)
    }
    // TODO: make this configurable
    const configService = new ConfigService('tiny')
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
