import { logger } from '@pbnj/core'
import type { GenKeysOptions } from '../parser'
import type { ICommand } from '../types'

export class GenKeysCommand implements ICommand<GenKeysOptions> {
  async execute(options: GenKeysOptions): Promise<void> {
    // Empty implementation
    logger.info('gen-keys command called with options:', options)
  }
}
