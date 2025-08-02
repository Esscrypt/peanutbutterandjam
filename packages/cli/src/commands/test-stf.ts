import { logger } from '@pbnj/core'
import type { TestStfOptions } from '../parser'
import type { ICommand } from '../types'

export class TestStfCommand implements ICommand<TestStfOptions> {
  async execute(options: TestStfOptions): Promise<void> {
    // Empty implementation
    logger.info('test-stf command called with options:', options)
  }
}
