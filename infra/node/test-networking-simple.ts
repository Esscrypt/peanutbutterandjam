#!/usr/bin/env bun

/**
 * Simple test to demonstrate networking integration
 */

import { logger } from '@pbnj/core'
import { NetworkingService } from './src/networking-service'
import { NodeType } from '@pbnj/types'

async function testNetworking() {
  logger.info('Starting networking integration test')

  try {
    // Create networking service configuration
    const config = {
      validatorIndex: 0,
      nodeType: NodeType.VALIDATOR,
      listenAddress: '127.0.0.1',
      listenPort: 30333,
      chainHash: 'dev',
      isBuilder: false,
      blockAuthoringService: null as any // Placeholder for test
    }

    logger.info('Creating networking service with config:', config)

    // Create networking service
    const networkingService = new NetworkingService(config)

    logger.info('Initializing networking service...')
    await networkingService.initialize()

    logger.info('Starting networking service...')
    await networkingService.start()

    // Get status
    const status = networkingService.getStatus()
    logger.info('Networking service status:', status)

    // Test block announcement (would be called by block authoring service)
    logger.info('Testing block announcement...')
    const mockBlockHeader = {
      timeslot: 12345,
      parentHash: new Uint8Array(32).fill(1),
      stateRoot: new Uint8Array(32).fill(2),
      extrinsicsRoot: new Uint8Array(32).fill(3),
      number: 100,
      digest: new Uint8Array(32).fill(4)
    }

    await networkingService.announceBlock(mockBlockHeader)

    // Test work package submission
    logger.info('Testing work package submission...')
    const mockWorkPackage = {
      authCodeHost: new Uint8Array(32).fill(5),
      workPackage: new Uint8Array(64).fill(6),
      extrinsic: new Uint8Array(128).fill(7)
    }

    await networkingService.submitWorkPackage(mockWorkPackage)

    logger.info('Networking integration test completed successfully!')
    logger.info('The networking service is working and ready for integration with the block authoring service.')

    // Stop the service
    await networkingService.stop()
    logger.info('Networking service stopped')

  } catch (error) {
    logger.error('Networking integration test failed:', error)
    process.exit(1)
  }
}

// Run the test
testNetworking().catch((error) => {
  logger.error('Test failed:', error)
  process.exit(1)
}) 