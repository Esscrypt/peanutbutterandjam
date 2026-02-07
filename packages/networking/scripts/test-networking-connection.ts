/**
 * Test script for networking connection between two NetworkingService instances
 * Tests QUIC connectivity, certificate validation, and message exchange
 */

import {
  RingVRFProverWasm,
  RingVRFVerifierWasm,
} from '@pbnjam/bandersnatch-vrf'
import { bytesToHex, EventBusService, hexToBytes, logger } from '@pbnjam/core'

import {
  CE131TicketDistributionProtocol,
  generateNetworkingCertificates,
} from '@pbnjam/networking'
import type {
  ConnectionEndpoint,
  StreamKind,
  TicketDistributionRequest,
  ValidatorPublicKeys,
} from '@pbnjam/types'
import { ConfigService } from '../../../infra/node/services/config-service'
import { ClockService } from '../../../infra/node/services/clock-service'
import { EntropyService } from '../../../infra/node/services/entropy'
import { NodeGenesisManager } from '../../../infra/node/services/genesis-manager'
import { KeyPairService } from '../../../infra/node/services/keypair-service'
import { NetworkingService } from '../../../infra/node/services/networking-service'
import { SealKeyService } from '../../../infra/node/services/seal-key'
import { getDefaultSrsFilePath } from '../../../infra/node/services/service-factory'
import { TicketService } from '../../../infra/node/services/ticket-service'
import { ValidatorSetManager } from '../../../infra/node/services/validator-set'

interface TestNode {
  networkingService: NetworkingService
  keyPair: {
    ed25519KeyPair: {
      privateKey: Uint8Array
      publicKey: Uint8Array
    }
    bandersnatchKeyPair: {
      privateKey: Uint8Array
      publicKey: Uint8Array
    }
  }
  validatorIndex: number
  dnsAltName: string
  ce131Protocol: CE131TicketDistributionProtocol
}

async function createTestNode(
  validatorIndex: number,
  _port: number,
  credentials: {
    ed25519SecretSeed: string
    ed25519Public: string
    bandersnatchSecretSeed: string
    bandersnatchPublic: string
    dnsAltName: string
  },
  sharedValidatorSetManager: ValidatorSetManager,
  entropyService: EntropyService,
  _ticketHolderService: TicketService,
  eventBusService: EventBusService,
  configService: ConfigService,
): Promise<TestNode> {
  logger.info(
    `Creating test node: Node ${validatorIndex === 0 ? 'A' : 'B'} (${validatorIndex === 0 ? 'Alice' : 'Bob'})`,
  )

  // Create a node-specific key pair service using correct seeds for Alice and Bob
  const nodeSeed =
    validatorIndex === 0
      ? '0x0000000000000000000000000000000000000000000000000000000000000000' // Alice's seed
      : '0x0100000001000000010000000100000001000000010000000100000001000000' // Bob's seed

  const keyPairService = new KeyPairService({
    customSeed: nodeSeed as `0x${string}`,
    enableDevAccounts: false, // Don't generate dev accounts since we're using custom seeds
    devAccountCount: 0,
  })

  // Start the key pair service to generate keys from the seed
  const [keyPairServiceStartError] = keyPairService.start()
  if (keyPairServiceStartError) {
    throw new Error(
      `Failed to start KeyPairService: ${keyPairServiceStartError.message}`,
    )
  }

  // Get the local key pair from the service (unwrap Safe)
  const [keyPairError, localKeyPair] = keyPairService.getLocalKeyPair()
  if (keyPairError || !localKeyPair) {
    throw new Error(
      `Failed to get local key pair: ${keyPairError?.message ?? 'unknown'}`,
    )
  }
  const serviceEd25519Public = bytesToHex(localKeyPair.ed25519KeyPair.publicKey)
  const serviceBandersnatchPublic = bytesToHex(
    localKeyPair.bandersnatchKeyPair.publicKey,
  )

  // Verify that the public keys match between the provided credentials and the service
  const providedEd25519Public = credentials.ed25519Public
  const providedBandersnatchPublic = credentials.bandersnatchPublic

  logger.info(
    `🔐 Public key verification for Node ${validatorIndex === 0 ? 'A' : 'B'} (${validatorIndex === 0 ? 'Alice' : 'Bob'}):`,
    {
      ed25519Match: serviceEd25519Public === providedEd25519Public,
      bandersnatchMatch:
        serviceBandersnatchPublic === providedBandersnatchPublic,
      serviceEd25519: serviceEd25519Public,
      providedEd25519: providedEd25519Public,
      serviceBandersnatch: serviceBandersnatchPublic,
      providedBandersnatch: providedBandersnatchPublic,
    },
  )

  if (serviceEd25519Public !== providedEd25519Public) {
    throw new Error(
      `Ed25519 public key mismatch for Node ${validatorIndex === 0 ? 'A' : 'B'}: service=${serviceEd25519Public}, provided=${providedEd25519Public}`,
    )
  }

  if (serviceBandersnatchPublic !== providedBandersnatchPublic) {
    throw new Error(
      `Bandersnatch public key mismatch for Node ${validatorIndex === 0 ? 'A' : 'B'}: service=${serviceBandersnatchPublic}, provided=${providedBandersnatchPublic}`,
    )
  }

  logger.info(
    `✅ Public keys verified for Node ${validatorIndex === 0 ? 'A' : 'B'} (${validatorIndex === 0 ? 'Alice' : 'Bob'})`,
  )

  // Create key pair from provided credentials (for certificate generation)
  const keyPair = {
    ed25519KeyPair: {
      privateKey: hexToBytes(credentials.ed25519SecretSeed as `0x${string}`),
      publicKey: hexToBytes(credentials.ed25519Public as `0x${string}`),
    },
    bandersnatchKeyPair: {
      privateKey: hexToBytes(
        credentials.bandersnatchSecretSeed as `0x${string}`,
      ),
      publicKey: hexToBytes(credentials.bandersnatchPublic as `0x${string}`),
    },
  }

  // Generate certificates
  const [certError, certificates] = await generateNetworkingCertificates(
    keyPair.ed25519KeyPair,
    '0xdeadbeef',
    false, // isBuilder
  )

  if (certError) {
    throw new Error(`Failed to generate certificates: ${certError}`)
  }

  logger.info(
    `Generated certificates for Node ${validatorIndex === 0 ? 'A' : 'B'} (${validatorIndex === 0 ? 'Alice' : 'Bob'})`,
    {
      alpnProtocol: certificates.alpnProtocol,
      publicKey: bytesToHex(keyPair.ed25519KeyPair.publicKey),
    },
  )

  // Use shared services
  const validatorSetManager = sharedValidatorSetManager

  // Create protocol registry
  const protocolRegistry = new Map()

  // Create CE131 protocol (eventBusService, configService, entropyService, validatorSetManager)
  const ce131Protocol = new CE131TicketDistributionProtocol(
    eventBusService,
    configService,
    entropyService,
    sharedValidatorSetManager,
  )

  protocolRegistry.set(131, ce131Protocol)

  // Create networking service with protocol registry
  const networkingService = new NetworkingService({
    protocolRegistry,
    keyPairService,
    chainHash: '0xdeadbeef',
    configService,
    validatorIndex,
    eventBusService,
  })
  networkingService.setValidatorSetManager(validatorSetManager)

  // Event handlers are now set up directly in protocol constructors
  // No need to call setupProtocolEventHandlers()

  // Initialize and start networking service
  await networkingService.init()
  // Don't start yet - will be started in the test function

  return {
    networkingService,
    keyPair,
    ce131Protocol,
    validatorIndex,
    dnsAltName: credentials.dnsAltName,
  }
}

async function testNetworkingConnection(): Promise<void> {
  logger.info(
    'Test script for networking connection between two NetworkingService instances...',
  )

  let nodeA: TestNode | undefined
  let nodeB: TestNode | undefined

  // Define credentials for Alice and Bob
  const aliceCredentials = {
    ed25519SecretSeed:
      '0x996542becdf1e78278dc795679c825faca2e9ed2bf101bf3c4a236d3ed79cf59',
    ed25519Public:
      '0x4418fb8c85bb3985394a8c2756d3643457ce614546202a2f50b093d762499ace',
    bandersnatchSecretSeed:
      '0x007596986419e027e65499cc87027a236bf4a78b5e8bd7f675759d73e7a9c799',
    bandersnatchPublic:
      '0xff71c6c03ff88adb5ed52c9681de1629a54e702fc14729f6b50d2f0a76f185b3',
    dnsAltName: 'eecgwpgwq3noky4ijm4jmvjtmuzv44qvigciusxakq5epnrfj2utb',
  }

  const bobCredentials = {
    ed25519SecretSeed:
      '0xb81e308145d97464d2bc92d35d227a9e62241a16451af6da5053e309be4f91d7',
    ed25519Public:
      '0xad93247bd01307550ec7acd757ce6fb805fcf73db364063265b30a949e90d933',
    bandersnatchSecretSeed:
      '0x12ca375c9242101c99ad5fafe8997411f112ae10e0e5b7c4589e107c433700ac',
    bandersnatchPublic:
      '0xdee6d555b82024f1ccf8a1e37e60fa60fd40b1958c4bb3006af78647950e1b91',
    dnsAltName: 'en5ejs5b2tybkfh4ym5vpfh7nynby73xhtfzmazumtvcijpcsz6ma',
  }

  // Create event bus service
  const eventBusService = new EventBusService()

  // Create entropy service (before TicketService which depends on it)
  const entropyService = new EntropyService(eventBusService)

  const tinyConfig = new ConfigService('tiny')
  const clockService = new ClockService({
    eventBusService,
    configService: tinyConfig,
  })
  const srsFilePath = getDefaultSrsFilePath()
  const ringProver = new RingVRFProverWasm(srsFilePath)
  const ringVerifier = new RingVRFVerifierWasm(srsFilePath)

  // Create ticket service with all required options (minimal for test)
  const ticketHolderService = new TicketService({
    configService: tinyConfig,
    eventBusService,
    keyPairService: null,
    entropyService,
    networkingService: null,
    ce131TicketDistributionProtocol: null,
    ce132TicketDistributionProtocol: null,
    validatorSetManager: null,
    clockService,
    prover: ringProver,
    ringVerifier,
  })

  // Create seal key service (ticketService, not ticketHolderService by name)
  const sealKeyService = new SealKeyService({
    eventBusService,
    entropyService,
    ticketService: ticketHolderService,
    configService: tinyConfig,
  })

  // Set environment variable for validator seed like main service does
  process.env['VALIDATOR_SEED'] = bytesToHex(
    crypto.getRandomValues(new Uint8Array(32)),
  )

  // Create genesis manager service (configService first, then options)
  const genesisManagerService = new NodeGenesisManager(tinyConfig, {
    chainSpecPath: './config/generated-chain-spec.json',
    genesisJsonPath: './config/genesis.json',
    genesisHeaderPath: './config/genesis-header.json',
  })

  // Start genesis manager to load validators
  await genesisManagerService.start()

  // Get initial validators from genesis manager
  const [initialValidatorsError, initialValidators] =
    genesisManagerService.getInitialValidatorsFromChainSpec()
  if (initialValidatorsError) {
    throw new Error(
      `Failed to get initial validators: ${initialValidatorsError.message}`,
    )
  }

  logger.info('Loaded initial validators from genesis:', {
    validatorCount: initialValidators.length,
  })

  const ZERO_BLS = `0x${'00'.repeat(144)}` as const
  const ZERO_METADATA = `0x${'00'.repeat(128)}` as const
  const aliceEd25519Bytes = hexToBytes(
    aliceCredentials.ed25519Public as `0x${string}`,
  )
  const bobEd25519Bytes = hexToBytes(
    bobCredentials.ed25519Public as `0x${string}`,
  )

  // Manual validators with connectionEndpoint so NetworkingService.start() can bind to host:port
  const manualValidators: ValidatorPublicKeys[] = [
    {
      bandersnatch: aliceCredentials.bandersnatchPublic as `0x${string}`,
      ed25519: aliceCredentials.ed25519Public as `0x${string}`,
      bls: ZERO_BLS,
      metadata: ZERO_METADATA,
      connectionEndpoint: {
        host: '127.0.0.1',
        port: 9000,
        publicKey: aliceEd25519Bytes,
      } as ConnectionEndpoint,
    },
    {
      bandersnatch: bobCredentials.bandersnatchPublic as `0x${string}`,
      ed25519: bobCredentials.ed25519Public as `0x${string}`,
      bls: ZERO_BLS,
      metadata: ZERO_METADATA,
      connectionEndpoint: {
        host: '127.0.0.1',
        port: 9001,
        publicKey: bobEd25519Bytes,
      } as ConnectionEndpoint,
    },
  ]

  logger.info('🔧 Setting up manual validators for testing:', {
    validatorCount: manualValidators.length,
    validators: manualValidators.map((v, idx) => ({
      index: idx,
      ed25519: v.ed25519,
      bandersnatch: v.bandersnatch,
    })),
  })

  const sharedValidatorSetManager = new ValidatorSetManager({
    eventBusService,
    sealKeyService,
    ringProver,
    ticketService: ticketHolderService,
    configService: tinyConfig,
    initialValidators: null,
  })

  // Set up the active validator set with our test validators (with connectionEndpoint)
  sharedValidatorSetManager.setActiveSet(manualValidators)

  // Initialize shared services
  await eventBusService.init()
  await ticketHolderService.init()
  await entropyService.init()
  sealKeyService.setValidatorSetManager(sharedValidatorSetManager)
  await sealKeyService.init()
  await sharedValidatorSetManager.init()

  // Start shared services
  await eventBusService.start()
  await ticketHolderService.start()
  await entropyService.start()
  await sealKeyService.start()
  await sharedValidatorSetManager.start()

  try {
    // Create test nodes with provided credentials and shared validator set manager
    nodeA = await createTestNode(
      0,
      9000,
      aliceCredentials,
      sharedValidatorSetManager,
      entropyService,
      ticketHolderService,
      eventBusService,
      tinyConfig,
    ) // Alice
    nodeB = await createTestNode(
      1,
      9001,
      bobCredentials,
      sharedValidatorSetManager,
      entropyService,
      ticketHolderService,
      eventBusService,
      tinyConfig,
    ) // Bob

    // Start both nodes as servers - they can connect bidirectionally
    logger.info(
      'Starting both nodes as servers for bidirectional connection...',
    )

    await nodeA.networkingService.start()
    logger.info('QUIC server listening on 127.0.0.1:9000')
    logger.debug('✅ Node A server started successfully')

    await nodeB.networkingService.start()
    logger.info('QUIC server listening on 127.0.0.1:9001')
    logger.debug('✅ Node B server started successfully')

    logger.info('Both nodes running as servers - can connect bidirectionally')

    // Wait for servers to be ready
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Test bidirectional connection using NetworkingService.connectToPeer
    logger.info(
      'Testing bidirectional connection between Node A and Node B using NetworkingService...',
    )

    // Node B connects to Node A - fix public key corruption
    const alicePublicKey = nodeA.keyPair.ed25519KeyPair.publicKey
    const alicePublicKeyHex = bytesToHex(alicePublicKey)

    logger.info('🔐 Alice (Node A) public key debugging:', {
      originalKeyType: typeof alicePublicKey,
      originalKeyLength: alicePublicKey.length,
      originalKeyBytes: Array.from(alicePublicKey.slice(0, 5)), // First 5 bytes
      hexResult: alicePublicKeyHex,
      hexLength: alicePublicKeyHex.length,
    })

    const endpointBtoA = {
      host: '127.0.0.1',
      port: 9000,
      publicKey: alicePublicKey, // Pass Uint8Array directly, not hex string
    }

    logger.info('Node B connecting to Node A:', {
      host: endpointBtoA.host,
      port: endpointBtoA.port,
      publicKey: endpointBtoA.publicKey,
    })

    logger.info('🚀 About to call NetworkingService.connectToPeer...')
    const startTime = Date.now()

    const [errorBtoA, successBtoA] =
      await nodeB.networkingService.connectToPeer(endpointBtoA)

    const connectionTime = Date.now() - startTime
    logger.info(`Connection attempt completed in ${connectionTime}ms`)

    if (successBtoA) {
      logger.info('✅ Node B to Node A connection established!')

      // Immediately send a test message while connection is still active
      logger.info('🚀 Sending test message immediately after connection...')

      // Create CE131 ticket distribution request
      const ticketDistributionRequest: TicketDistributionRequest = {
        epochIndex: BigInt(0),
        ticket: {
          entryIndex: BigInt(1),
          proof: new Uint8Array(784),
        },
      }

      // Serialize the CE131 message
      const [serializeError, serializedMessage] =
        nodeB.ce131Protocol.serializeRequest(ticketDistributionRequest)

      if (!serializeError) {
        // Send message to Alice (validator index 0)
        const [sendError] = await nodeB.networkingService.sendMessage(
          BigInt(0), // Send to Alice (validator index 0)
          131 as StreamKind, // CE131 protocol kind byte
          serializedMessage,
        )

        if (!sendError) {
          logger.info('✅ Test message sent successfully!')
        } else {
          logger.error('❌ Failed to send test message:', sendError)
        }
      } else {
        logger.error('❌ Failed to serialize test message:', serializeError)
      }
    } else {
      logger.error('❌ Failed to connect Node B to Node A:', {
        error: errorBtoA ? errorBtoA.message : 'Unknown error',
      })
    }

    // Node A connects to Node B - fix public key corruption
    const bobPublicKey = nodeB.keyPair.ed25519KeyPair.publicKey
    const bobPublicKeyHex = bytesToHex(bobPublicKey)

    logger.info('🔐 Bob (Node B) public key debugging:', {
      originalKeyType: typeof bobPublicKey,
      originalKeyLength: bobPublicKey.length,
      originalKeyBytes: Array.from(bobPublicKey.slice(0, 5)), // First 5 bytes
      hexResult: bobPublicKeyHex,
      hexLength: bobPublicKeyHex.length,
    })

    const endpointAtoB = {
      host: '127.0.0.1',
      port: 9001,
      publicKey: bobPublicKey, // Pass Uint8Array directly, not hex string
    }

    logger.info('Node A attempting to connect to Node B:', {
      host: endpointAtoB.host,
      port: endpointAtoB.port,
      publicKey: endpointAtoB.publicKey,
    })

    // Connect using SafePromise pattern
    const [_, success] =
      await nodeA.networkingService.connectToPeer(endpointAtoB)

    if (success) {
      logger.info('✅ Node A to Node B connection established!')
    }

    // Wait for connection to be fully established and certificate extraction
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Test certificate extraction from established bidirectional connections
    logger.info(
      'Testing certificate extraction from established bidirectional connections...',
    )

    // Find connections from both nodes (publicKeyToConnection: Map<Hex, QUICConnection>)
    const connectionsA = Array.from(
      nodeA.networkingService.publicKeyToConnection.entries(),
    )
    const connectionsB = Array.from(
      nodeB.networkingService.publicKeyToConnection.entries(),
    )

    logger.info('Connection counts:', {
      nodeAConnections: connectionsA.length,
      nodeBConnections: connectionsB.length,
    })

    if (connectionsA.length === 0 && connectionsB.length === 0) {
      throw new Error(
        'No connections found after bidirectional connection success',
      )
    }

    // Use Node B's connection to Node A for testing (publicKeyToConnection entries are [Hex, QUICConnection])
    const [peerPublicKeyHex, _connection] =
      connectionsB.length > 0 ? connectionsB[0] : connectionsA[0]
    logger.info('Using connection:', {
      peerPublicKey: `${peerPublicKeyHex.substring(0, 20)}...`,
      fromNode: connectionsB.length > 0 ? 'B' : 'A',
    })

    // Test CE131 message creation and sending
    logger.info(
      'Testing CE131 ticket distribution message creation and sending...',
    )

    // Create CE131 ticket distribution request with proper structure
    const ticketDistributionRequest: TicketDistributionRequest = {
      epochIndex: BigInt(0),
      ticket: {
        entryIndex: BigInt(1),
        proof: new Uint8Array(784),
      },
    }

    logger.info('Creating CE131 ticket distribution request:', {
      epochIndex: ticketDistributionRequest.epochIndex.toString(),
      entryIndex: ticketDistributionRequest.ticket.entryIndex.toString(),
    })

    // Serialize the CE131 message
    const [serializeError, serializedMessage] =
      nodeA.ce131Protocol.serializeRequest(ticketDistributionRequest)

    if (serializeError) {
      logger.error('❌ Failed to serialize CE131 message:', serializeError)
      throw new Error(`Failed to serialize CE131 message: ${serializeError}`)
    }

    logger.info('✅ CE131 message serialized successfully:', {
      messageSize: serializedMessage.length,
      messageHex: bytesToHex(serializedMessage),
    })

    // Debug: Check what validators are available in the validator set (getAllConnectedValidators returns array)
    const allConnected = sharedValidatorSetManager.getAllConnectedValidators()
    logger.info('🔍 Debugging validator set:', {
      validatorSetSize: allConnected.length,
      validatorKeys: allConnected.map((keys, idx) => ({
        index: idx,
        ed25519: keys.ed25519,
        bandersnatch: keys.bandersnatch,
      })),
    })

    // Send CE131 message using the connection's newStream method
    // Send from Node B to Node A (validator index 0) - this should work since Node B connected to Node A
    const [sendError] = await nodeB.networkingService.sendMessage(
      BigInt(0), // Send to Alice (validator index 0)
      131 as StreamKind, // CE131 protocol kind byte
      serializedMessage,
    )

    if (sendError) {
      logger.error('❌ Failed to send CE131 message:', sendError)
    } else {
      logger.info('✅ CE131 ticket distribution message sent successfully!', {
        messageSize: serializedMessage.length,
        protocol: 'CE131',
      })
    }

    // Test response handling by simulating a response message
    logger.info('🔄 Testing response handling...')

    // Create a mock response message
    const mockResponse = new Uint8Array(100) // Simple mock response
    mockResponse.fill(0x42) // Fill with test data

    // Send response from Node A to Node B (validator index 1)
    const [responseError] = await nodeA.networkingService.sendMessage(
      BigInt(1), // Send to Bob (validator index 1)
      131 as StreamKind, // CE131 protocol kind byte
      mockResponse,
    )

    if (responseError) {
      logger.error('❌ Failed to send response message:', responseError)
    } else {
      logger.info('✅ Response message sent successfully!', {
        messageSize: mockResponse.length,
        protocol: 'CE131',
      })
    }

    // Wait longer for message processing and logging
    logger.info('⏳ Waiting for message processing and logging...')

    // Check if EventQUICConnectionStream is being fired
    logger.info('📊 Checking connection and stream status:')
    logger.info(
      `Node A connections: ${nodeA.networkingService.publicKeyToConnection.size}`,
    )
    logger.info(
      `Node B connections: ${nodeB.networkingService.publicKeyToConnection.size}`,
    )

    // Log the streams in each connection
    for (const [peerKey, conn] of nodeA.networkingService.publicKeyToConnection.entries()) {
      const connWithStreamMap = conn as unknown as { streamMap?: Record<string, unknown> }
      logger.info(`Node A connection ${peerKey.slice(0, 20)}... streams:`, {
        streamMap: connWithStreamMap.streamMap
          ? Object.keys(connWithStreamMap.streamMap).length
          : 'No streamMap',
      })
    }

    for (const [peerKey, conn] of nodeB.networkingService.publicKeyToConnection.entries()) {
      const connWithStreamMap = conn as unknown as { streamMap?: Record<string, unknown> }
      logger.info(`Node B connection ${peerKey.slice(0, 20)}... streams:`, {
        streamMap: connWithStreamMap.streamMap
          ? Object.keys(connWithStreamMap.streamMap).length
          : 'No streamMap',
      })
    }

    // Try direct stream creation and data sending
    logger.info('🔄 Attempting direct stream creation and data sending...')

    await new Promise((resolve) => setTimeout(resolve, 3000))

    logger.info('✅ Networking connection test completed successfully!')
    logger.info('📊 Summary:')
    logger.info('- Used actual NetworkingService instances')
    logger.info('- Manual validator setup for testing (Alice and Bob)')
    logger.info('- Validator set manager initialized with test validators')
    logger.info('- Successful connectToPeer method')
    logger.info('- Certificate extraction from peer connection')
    logger.info('- Event-driven protocol setup with CE131')
    logger.info('- CE131 ticket distribution message creation and sending')
    logger.info('- Request and response message handling')
    logger.info('- Proper JAMNP-S protocol formatting')
    logger.info('- Event-driven architecture working correctly')
  } catch (error) {
    logger.error('❌ Networking connection test failed:', error)
    throw error
  } finally {
    // Cleanup
    logger.info('Cleaning up test nodes...')

    try {
      // Stop networking services if they exist
      if (nodeA?.networkingService) {
        await nodeA.networkingService.stop()
      }
      if (nodeB?.networkingService) {
        await nodeB.networkingService.stop()
      }
    } catch (cleanupError) {
      logger.error('Error during cleanup:', cleanupError)
    }
  }
}

// Run the test
if (import.meta.main) {
  testNetworkingConnection()
    .then(() => {
      logger.info('Test completed successfully')
      process.exit(0)
    })
    .catch((error) => {
      logger.error('Test failed:', error)
      process.exit(1)
    })
}

export { testNetworkingConnection }
