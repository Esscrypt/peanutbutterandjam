import { logger } from '@pbnj/core'
import type { ListKeysOptions } from '../parser'
import type { ICommand } from '../types'

export class ListKeysCommand implements ICommand<ListKeysOptions> {
  async execute(options: ListKeysOptions): Promise<void> {
    // Empty implementation
    logger.info('list-keys command called with options:', options)
  }
}
