import { logger } from '@pbnj/core'
import type { PrintSpecOptions } from '../parser'
import type { ICommand } from '../types'

export class PrintSpecCommand implements ICommand<PrintSpecOptions> {
  async execute(options: PrintSpecOptions): Promise<void> {
    // Empty implementation
    logger.info('print-spec command called with options:', options)
  }
}
