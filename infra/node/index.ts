/**
 * JAM Node - Main Entry Point
 *
 * Starts the JAM node with all services managed through the service registry
 * Reference: Gray Paper specifications
 */

import { logger } from '@pbnjam/core'
import type { NodeType } from '@pbnjam/types'
import type { MainServiceConfig } from './services/main-service'
import { MainService } from './services/main-service'

/**
 * Default configuration for the JAM node
 */
const defaultConfig: MainServiceConfig = {
  genesis: {
    chainSpecPath: process.env['CHAIN_SPEC_PATH'] || './chain-spec.json',
  },
  networking: {
    nodeType: (process.env['NODE_TYPE'] as NodeType) || 'validator',
    isBuilder: process.env['IS_BUILDER'] === 'true',
  },
  nodeId: process.env['NODE_ID'] || 'jam-node-1',
  telemetry: {
    enabled: true,
  },
}

/**
 * Main function to start the JAM node
 */
async function main(): Promise<void> {
  try {
    logger.info('Starting JAM node...', {
      nodeId: defaultConfig.nodeId,
      nodeType: defaultConfig.networking.nodeType,
    })

    // Create and run the main service
    const mainService = new MainService(defaultConfig)
    await mainService.start()
  } catch (error) {
    logger.error('Failed to start JAM node', { error })
    process.exit(1)
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error })
  process.exit(1)
})

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled promise rejection', { reason, promise })
  process.exit(1)
})

// Start the node if this file is run directly
if (require.main === module) {
  main().catch((error) => {
    logger.error('Fatal error in main function', { error })
    process.exit(1)
  })
}

// Export for programmatic use
export { MainService }
export type { MainServiceConfig }

// Re-export all services (includes service factory)
export * from './services'
