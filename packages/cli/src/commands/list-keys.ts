import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { logger } from '@pbnj/core'

import { generateValidatorKeys } from '../utils/key-generation'

export function createListKeysCommand(_args: string[]): void {
  try {
    const keysDir = join(process.env['HOME'] || '', '.pbnj', 'keys')

    if (!existsSync(keysDir)) {
      logger.error('Keys directory does not exist. Run gen-keys first.')
      process.exit(1)
    }

    // List keys for all 6 validators (0-5)
    for (let i = 0; i < 6; i++) {
      const [error, keys] = generateValidatorKeys(i)
      if (error) {
        logger.error('Failed to generate keys:', error)
        process.exit(1)
      }
      logger.info(`Validator ${i}: ${keys.bandersnatch_public}`)
    }

    logger.info('Successfully listed all validator keys')
  } catch (error) {
    logger.error('Failed to list keys:', error)
    process.exit(1)
  }
}
