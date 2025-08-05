import { existsSync, readFileSync } from 'node:fs'
import { logger } from '@pbnj/core'
import { Command } from 'commander'
import { generateChainSpec } from '../utils/chain-spec'

export function createPrintSpecCommand(): Command {
  const command = new Command('print-spec')
    .description('Generate new chain spec from the spec config')
    .argument('<input.json>', 'Input chain spec file')
    .action(async (inputFile: string) => {
      try {
        if (!existsSync(inputFile)) {
          logger.error(`Input file not found: ${inputFile}`)
          process.exit(1)
        }

        const inputSpec = JSON.parse(readFileSync(inputFile, 'utf-8'))
        const chainSpec = generateChainSpec(inputSpec)

        logger.info('Successfully generated chain spec')
        logger.info(
          `Chain spec contains ${chainSpec.bootnodes.length} bootnodes`,
        )
        logger.info(`Chain ID: ${chainSpec.id}`)
      } catch (error) {
        logger.error('Failed to print spec:', error)
        process.exit(1)
      }
    })

  return command
}
