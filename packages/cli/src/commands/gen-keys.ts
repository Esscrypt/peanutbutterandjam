import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { logger } from '@pbnj/core'
import { generateValidatorKeys } from '../utils/key-generation'

export function createGenKeysCommand(_args: string[]): void {
  const keysDir = join(process.env['HOME'] || '', '.pbnj', 'keys')
  mkdirSync(keysDir, { recursive: true })

  // Generate 6 validator keys (0-5)
  for (let i = 0; i < 6; i++) {
    const [error, keys] = generateValidatorKeys(i)
    if (error) {
      logger.error('Failed to generate keys:', error)
      process.exit(1)
    }

    const seedFile = join(keysDir, `seed_${i}`)

    // Write seed file
    writeFileSync(seedFile, keys.seed)
    logger.info(`Seed file ${seedFile} created`)
  }

  logger.info('Successfully generated keys for all validators')
}
