/**
 * JAM Node - Main Entry Point
 *
 * Starts the JAM node with all services managed through the service registry
 * Reference: Gray Paper specifications
 */

import { logger } from '@pbnj/core'
import type { NodeType } from '@pbnj/types'
import type { MainServiceConfig } from './main-service'
import { MainServiceImpl } from './main-service'

/**
 * Default configuration for the JAM node
 */
const defaultConfig: MainServiceConfig = {
  blockAuthoring: {
    networkId: 'jam-network',
    validatorKey:
      process.env['VALIDATOR_KEY'] ||
      '0x0000000000000000000000000000000000000000000000000000000000000000',
    slotDuration: 6000n, // 6 seconds
    epochLength: 600n, // 600 slots
    maxExtrinsicsPerBlock: 1000n,
    maxWorkPackagesPerBlock: 100n,
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
    validatorIndex: Number.parseInt(process.env['VALIDATOR_INDEX'] || '0'),
    nodeType: (process.env['NODE_TYPE'] as NodeType) || 'validator',
    listenAddress: process.env['LISTEN_ADDRESS'] || '0.0.0.0',
    listenPort: Number.parseInt(process.env['LISTEN_PORT'] || '30333'),
    chainHash:
      process.env['CHAIN_HASH'] ||
      '0x0000000000000000000000000000000000000000000000000000000000000000',
    isBuilder: process.env['IS_BUILDER'] === 'true',
  },
  nodeId: process.env['NODE_ID'] || 'jam-node-1',
  telemetry: {
    enabled: true,
    nodeInfo: {
      protocolVersion: 0n,
      peerId: new Uint8Array(32),
      peerAddress: { address: new Uint8Array(16), port: 30303n },
      nodeFlags: 1n,
      implementationName: 'PeanutButterAndJam',
      implementationVersion: '0.1.0',
      additionalInfo: 'JAM node CLI implementation',
    },
  },
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
export { MainServiceImpl as default, MainServiceImpl }
export type { MainServiceConfig }
