import { logger } from '@pbnj/core'
import type { RunOptions } from '../parser'
import type { ICommand } from '../types'

export class RunCommand implements ICommand<RunOptions> {
  async execute(options: RunOptions): Promise<void> {
    // Empty implementation
    logger.info('run command called with options:', options)
  }
}
