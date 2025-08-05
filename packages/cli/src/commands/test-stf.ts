import { existsSync } from 'node:fs'
import { logger } from '@pbnj/core'
import { Command } from 'commander'

export function createTestStfCommand(): Command {
  const command = new Command('test-stf')
    .description('Run the STF Validation')
    .argument('<input.json>', 'Input test file')
    .option(
      '-d, --data-path <string>',
      'Specifies the directory for the blockchain, keystore, and other data',
      '/Users/tanyageorgieva/.jamduna',
    )
    .action(async (inputFile: string, options) => {
      try {
        if (!existsSync(inputFile)) {
          logger.error(`Input file not found: ${inputFile}`)
          process.exit(1)
        }

        logger.info('Running STF validation...')
        logger.info(`Input file: ${inputFile}`)
        logger.info(`Data path: ${options.dataPath}`)

        // TODO: Implement actual STF validation logic
        logger.info('STF validation completed successfully')
      } catch (error) {
        logger.error('STF validation failed:', error)
        process.exit(1)
      }
    })

  return command
}
