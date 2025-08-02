import { logger } from '@pbnj/core'
import type { TestAllOptions } from '../parser'
import { TestVectorProcessor } from '../test-vectors'
import type { ICommand } from '../types'
import { TestSafroleCommand } from './test-safrole'

export class TestAllCommand implements ICommand<TestAllOptions> {
  async execute(options: TestAllOptions): Promise<void> {
    logger.info('Testing all JAM protocol components...')

    const processor = new TestVectorProcessor()

    try {
      // Validate test vectors first
      await processor.validateTestVectors()

      // const vectorType = options.vectors || 'tiny' // TODO: Use for other component tests

      // Test Safrole first (most critical)
      logger.info('Testing Safrole consensus protocol...')
      const safroleCommand = new TestSafroleCommand()
      await safroleCommand.execute({ ...options, vector: undefined })

      // TODO: Add other component tests
      logger.info('Other component tests not yet implemented')
    } catch (error) {
      logger.error('Test failed:', error)
      throw error
    }
  }
}
