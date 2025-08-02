import { logger } from '@pbnj/core'
import type { GenSpecOptions } from '../parser'
import type { ICommand } from '../types'

export class GenSpecCommand implements ICommand<GenSpecOptions> {
  async execute(options: GenSpecOptions): Promise<void> {
    // Empty implementation
    logger.info('gen-spec command called with options:', options)
  }
}
