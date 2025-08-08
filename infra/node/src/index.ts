/**
 * JAM Node - Main Entry Point
 *
 * Starts the JAM node with all services managed through the service registry
 * Reference: Gray Paper specifications
 */

import { logger } from '@pbnj/core'
import { MainServiceImpl } from './main-service'
import type { MainServiceConfig } from './main-service'

/**
 * Default configuration for the JAM node
 */
const defaultConfig: MainServiceConfig = {
  blockAuthoring: {
    networkId: 'jam-network',
    validatorKey: process.env['VALIDATOR_KEY'] || '0x0000000000000000000000000000000000000000000000000000000000000000',
    slotDuration: 6000, // 6 seconds
    epochLength: 600, // 600 slots
    maxExtrinsicsPerBlock: 1000,
    maxWorkPackagesPerBlock: 100,
    enableStrictValidation: true,
    enableAuditMode: false,
    enableSafroleValidation: true,
    enableGrandpaFinalization: true,
  },
  genesis: {
    genesisPath: process.env['GENESIS_PATH'] || './genesis.json',
    validation: {
      validateGenesis: true,
      allowEmptyGenesis: false,
      requireValidators: true,
      requireAccounts: true,
    },
    import: {
      createMissingAccounts: true,
      initializeValidators: true,
      resetExistingState: false,
      backupExistingState: false,
    },
  },
  networking: {
    validatorIndex: parseInt(process.env['VALIDATOR_INDEX'] || '0'),
    nodeType: process.env['NODE_TYPE'] || 'validator',
    listenAddress: process.env['LISTEN_ADDRESS'] || '0.0.0.0',
    listenPort: parseInt(process.env['LISTEN_PORT'] || '30333'),
    chainHash: process.env['CHAIN_HASH'] || '0x0000000000000000000000000000000000000000000000000000000000000000',
    isBuilder: process.env['IS_BUILDER'] === 'true',
  },
  nodeId: process.env['NODE_ID'] || 'jam-node-1',
}

/**
 * Main function to start the JAM node
 */
async function main(): Promise<void> {
  try {
    logger.info('Starting JAM node...', {
      nodeId: defaultConfig.nodeId,
      validatorIndex: defaultConfig.networking.validatorIndex,
      nodeType: defaultConfig.networking.nodeType,
      listenAddress: defaultConfig.networking.listenAddress,
      listenPort: defaultConfig.networking.listenPort,
    })

    // Create and run the main service
    const mainService = new MainServiceImpl(defaultConfig)
    await mainService.run()

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
export { MainServiceImpl as default }
export type { MainServiceConfig }
