#!/usr/bin/env tsx

/**
 * Test script to demonstrate networking integration
 */

import { logger } from '@pbnj/core'
import { NetworkingService } from './src/networking-service'
import { BlockAuthoringServiceImpl } from './src/block-authoring-service'
import { NodeType } from '@pbnj/types'

// Initialize logger
logger.init()

async function testNetworking() {
  console.log('🚀 Testing JAMNP-S Networking Integration')
  console.log('==========================================')

  try {
    // Create a mock block authoring service
    const mockBlockAuthoringService = {
      // Mock methods that would be called by networking service
      handleBlockAnnouncement: (blockHeader: any) => {
        console.log('📢 Block announcement received:', {
          timeslot: blockHeader.timeslot,
          parentHash: blockHeader.parentHash
        })
      },
      getBlock: (blockNumber: number) => {
        console.log('📦 Block request received for block:', blockNumber)
        return null // Mock - would return actual block
      },
      getState: (startKey: string, endKey: string) => {
        console.log('🗄️ State request received:', { startKey, endKey })
        return null // Mock - would return actual state
      },
      processWorkPackages: (workPackages: any[]) => {
        console.log('📋 Work packages received:', workPackages.length)
        return [] // Mock - would return work reports
      }
    } as any

    // Create networking service configuration
    const networkingConfig = {
      validatorIndex: 0,
      nodeType: NodeType.VALIDATOR,
      listenAddress: '127.0.0.1',
      listenPort: 30333,
      chainHash: 'dev',
      isBuilder: false,
      blockAuthoringService: mockBlockAuthoringService
    }

    console.log('⚙️ Creating networking service with config:', {
      validatorIndex: networkingConfig.validatorIndex,
      nodeType: networkingConfig.nodeType,
      listenAddress: networkingConfig.listenAddress,
      listenPort: networkingConfig.listenPort,
      chainHash: networkingConfig.chainHash
    })

    // Create networking service
    const networkingService = new NetworkingService(networkingConfig)

    console.log('🔧 Initializing networking service...')
    await networkingService.initialize()

    console.log('🚀 Starting networking service...')
    await networkingService.start()

    // Get service status
    const status = networkingService.getStatus()
    console.log('📊 Networking service status:', status)

    // Simulate some network activity
    console.log('\n📡 Simulating network activity...')

    // Simulate block announcement
    const mockBlockHeader = {
      parentHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      priorStateRoot: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      extrinsicHash: '0x9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba',
      timeslot: 12345n,
      authorIndex: 0n,
      vrfSignature: '0x1111111111111111111111111111111111111111111111111111111111111111',
      offendersMark: new Uint8Array(0),
      sealSignature: '0x2222222222222222222222222222222222222222222222222222222222222222'
    }

    console.log('📢 Announcing block to network...')
    await networkingService.announceBlock(mockBlockHeader)

    // Simulate work package submission
    const mockWorkPackage = {
      authCodeHost: 1n,
      authCodeHash: '0x3333333333333333333333333333333333333333333333333333333333333333',
      context: {
        anchorHash: '0x4444444444444444444444444444444444444444444444444444444444444444',
        anchorPostState: '0x5555555555555555555555555555555555555555555555555555555555555555',
        anchorAccountLog: new Uint8Array(0),
        lookupAnchorHash: '0x6666666666666666666666666666666666666666666666666666666666666666',
        lookupAnchorTime: 1234567890n,
        prerequisites: new Uint8Array(0)
      },
      authToken: new Uint8Array(32),
      authConfig: new Uint8Array(64),
      workItems: []
    }

    console.log('📋 Submitting work package to guarantors...')
    await networkingService.submitWorkPackage(mockWorkPackage)

    // Keep the service running for a bit to show it's working
    console.log('\n⏳ Keeping networking service running for 5 seconds...')
    await new Promise(resolve => setTimeout(resolve, 5000))

    console.log('🛑 Stopping networking service...')
    await networkingService.stop()

    console.log('✅ Networking integration test completed successfully!')
    console.log('\n🎉 The networking package is now integrated with the node!')
    console.log('\nKey features demonstrated:')
    console.log('• Network server creation and initialization')
    console.log('• Block announcement using Gray Paper serialization')
    console.log('• Work package submission using Gray Paper serialization')
    console.log('• Service lifecycle management (start/stop)')
    console.log('• Integration with block authoring service')

  } catch (error) {
    console.error('❌ Networking integration test failed:', error)
    process.exit(1)
  }
}

// Run the test
testNetworking().catch(console.error) 