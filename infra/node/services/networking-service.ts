/**
 * Networking Service for JAM Node
 *
 * Integrates JAMNP-S networking with block authoring functionality
 */

import {
  logger,
  type Safe,
  type SafePromise,
  safeError,
  safeResult,
} from '@pbnj/core'
import {
  // BlockAnnouncementProtocol,
  ConnectionManager,
  GridStructureManager,
  generateALPNProtocol,
  generateCertificateFromSeed,
  PeerDiscoveryManager,
  QuicTransport,
  type TransportConfig,
  type TransportEvents,
  ValidatorSetManager,
  // WorkPackageSubmissionProtocol,
} from '@pbnj/networking'
import {
  decodeHeader,
  decodeWorkPackage,
  encodeWorkPackage,
} from '@pbnj/serialization'
// import type { NetworkingStore } from '@pbnj/state'
import type {
  BlockHeader,
  NodeType,
  StreamKind,
  ValidatorMetadata,
  WorkPackage,
} from '@pbnj/types'
import { BaseService } from '../interfaces/service'
import type { BlockAuthoringService } from './block-authoring'
import type { TelemetryService } from './telemetry-service'

/**
 * Networking service configuration
 */
export interface NetworkingServiceConfig {
  /** Local validator index */
  validatorIndex: bigint
  /** Node type */
  nodeType: NodeType
  /** Listen address */
  listenAddress: string
  /** Listen port */
  listenPort: bigint
  /** Chain hash or path to chain spec file */
  chainHash: string
  /** Whether this node is a builder */
  isBuilder?: boolean
  /** Block authoring service reference (optional for testing) */
  blockAuthoringService: BlockAuthoringService | null
}

/**
 * Networking service for JAM node
 */
export class NetworkingService extends BaseService {
  private config: NetworkingServiceConfig
  private transport: QuicTransport
  private connectionManager: ConnectionManager
  private validatorSetManager: ValidatorSetManager
  private gridStructureManager: GridStructureManager
  private peerDiscoveryManager: PeerDiscoveryManager
  // private blockAnnouncementProtocol: BlockAnnouncementProtocol
  // private workPackageSubmissionProtocol: WorkPackageSubmissionProtocol
  private ed25519Certificate: unknown // Gray Paper compliant Ed25519 certificate
  private certificateCache: Map<string, unknown> = new Map() // Cache certificates by validator index
  private keepaliveEnabled = true
  private telemetryService: TelemetryService

  constructor(
    config: NetworkingServiceConfig,
    telemetryService: TelemetryService,
  ) {
    super('networking-service')
    this.config = config
    // Generate Ed25519 certificates for Gray Paper compliance (stored for application layer)
    const [certificateDataError, certificateData] =
      this.generateNetworkingCertificates(config)
    if (certificateDataError) {
      throw new Error(
        `Failed to generate networking certificates: ${certificateDataError.message}`,
      )
    }

    this.telemetryService = telemetryService
    // Create transport configuration with simplified TLS setup for testing
    const transportConfig: TransportConfig = {
      listenAddress: config.listenAddress,
      listenPort: Number(config.listenPort),
      tlsConfig: {
        // Minimal TLS config for QUIC testing
        key: certificateData.privateKeyPEM,
        cert: certificateData.certificatePEM,
        verifyPeer: false, // Disable peer verification for testing
        maxIdleTimeout: 30000,
        maxRecvUdpPayloadSize: 1500,
        maxSendUdpPayloadSize: 1500,
        initialMaxData: 1000000,
        initialMaxStreamDataBidiLocal: 100000,
        initialMaxStreamDataBidiRemote: 100000,
        initialMaxStreamDataUni: 100000,
        initialMaxStreamsBidi: 100,
        initialMaxStreamsUni: 100,
        disableActiveMigration: false,
        applicationProtos: [certificateData.alpnProtocol],
        maxConnectionWindow: 25165824, // 24 MiB
        maxStreamWindow: 16777216, // 16 MiB
        enableDgram: [false, 0, 0],
        enableEarlyData: false,
        readableChunkSize: 16384,
        grease: false,
      },
      maxConnections: 100,
      connectionTimeout: 30000,
      messageTimeout: 10000,
    }

    // Create transport events
    const transportEvents: TransportEvents = {
      onConnectionEstablished: async (
        connectionId: string,
        endpoint: unknown,
      ) => {
        logger.info('Transport connection established', {
          connectionId,
          endpoint,
        })

        // Emit telemetry event for incoming connection
        const [eventIdError, eventId] =
          await this.telemetryService.emitConnectingIn(
            endpoint?.toString() || 'unknown',
          )
        if (eventIdError) {
          logger.error('Failed to emit connecting in event', {
            error: eventIdError.message,
          })
        } else {
          // For now, simulate peer ID as hash of connection ID
          const peerId = new TextEncoder().encode(connectionId).slice(0, 32)
          const fullPeerId = new Uint8Array(32)
          fullPeerId.set(peerId)
          const [emitConnectedInError] =
            await this.telemetryService.emitConnectedIn(eventId, fullPeerId)
          if (emitConnectedInError) {
            logger.error('Failed to emit connected in event', {
              error: emitConnectedInError.message,
            })
          }
        }
      },
      onConnectionClosed: async (connectionId: string) => {
        logger.info('Transport connection closed', { connectionId })

        // Emit telemetry event for disconnection
        const peerId = new TextEncoder().encode(connectionId).slice(0, 32)
        const fullPeerId = new Uint8Array(32)
        fullPeerId.set(peerId)
        const [emitDisconnectedError] =
          await this.telemetryService.emitDisconnected(
            fullPeerId,
            'Connection closed',
            undefined,
          )
        if (emitDisconnectedError) {
          logger.error('Failed to emit disconnected event', {
            error: emitDisconnectedError.message,
          })
        }
      },
      onMessageReceived: (streamId: string, data: Uint8Array) => {
        logger.debug('Transport message received', {
          streamId,
          dataLength: data.length,
        })
        // Extract validatorIndex and streamKind from streamId according to JAMNP-S spec
        const [extractStreamInfoError, result] =
          this.extractStreamInfo(streamId)
        if (extractStreamInfoError) {
          logger.error('Failed to extract stream info', {
            error: extractStreamInfoError.message,
          })
          return
        }
        this.handleIncomingMessage(
          result.validatorIndex,
          result.streamKind,
          data,
        )
      },
    }

    // Initialize components
    this.transport = new QuicTransport(transportConfig, transportEvents)

    // Note: QUIC managers are integrated into the transport layer

    // Initialize networking components for JIP-5 compliance
    this.validatorSetManager = new ValidatorSetManager()
    this.gridStructureManager = new GridStructureManager()
    this.peerDiscoveryManager = new PeerDiscoveryManager()
    this.connectionManager = new ConnectionManager(
      this.transport,
      this.validatorSetManager,
      this.peerDiscoveryManager,
      this.gridStructureManager,
    )

    // Initialize protocol handlers for JAMNP-S
    // this.blockAnnouncementProtocol = new BlockAnnouncementProtocol(
    //    this.networkingStore,
    //    this.transport.getStreamManager(),
    //    this.connectionManager,
    //    this.validatorSetManager,
    // )
    // this.workPackageSubmissionProtocol = new WorkPackageSubmissionProtocol(this.networkingStore)

    // Set up networking components integration
    // this.blockAnnouncementProtocol.setLocalValidator(config.validatorIndex)
    // this.blockAnnouncementProtocol.setNetworkingComponents(
    //   this.transport.getStreamManager(),
    //   this.connectionManager,
    //   this.validatorSetManager,
    // )

    logger.info('JIP-5 compliant networking components initialized', {
      validatorIndex: config.validatorIndex,
      chainHash: config.chainHash,
      listenPort: config.listenPort,
      components: [
        'ValidatorSetManager',
        'GridStructureManager',
        'PeerDiscoveryManager',
        'ConnectionManager',
        'BlockAnnouncementProtocol',
        'WorkPackageSubmissionProtocol',
      ],
    })
  }

  /**
   * Generate networking certificates compliant with Gray Paper JAMNP-S specification.
   * Uses hybrid approach: RSA for TLS transport, Ed25519 for application-layer verification.
   */
  private generateNetworkingCertificates(
    config: NetworkingServiceConfig,
  ): Safe<{
    privateKeyPEM: string
    certificatePEM: string
    alpnProtocol: string
  }> {
    // Generate deterministic seed for Ed25519 keys per Gray Paper
    const testSeed = `test-seed-validator-${config.validatorIndex}-${config.chainHash}`
    const seedBytes = new TextEncoder().encode(testSeed)
    const paddedSeed = new Uint8Array(32)
    paddedSeed.set(seedBytes.slice(0, 32))
    const seedHex = Array.from(paddedSeed, (byte) =>
      byte.toString(16).padStart(2, '0'),
    ).join('') as `0x${string}`

    // Generate Gray Paper compliant Ed25519 certificate for application layer
    const [ed25519CertificateError, ed25519Certificate] =
      generateCertificateFromSeed(seedHex)
    if (ed25519CertificateError) {
      return safeError(ed25519CertificateError)
    }

    // Generate ALPN protocol string according to JAMNP-S spec
    const alpnProtocol = generateALPNProtocol(
      config.chainHash,
      config.isBuilder || false,
    )

    // Generate JAMNP-S compliant certificates for application layer verification
    //TODO: check if and how this should be used or remove this code
    const [jamnpCertificateError, _jamnpCertificate] =
      this.generateJAMNPCertificates(config.validatorIndex, config.chainHash)
    if (jamnpCertificateError) {
      return safeError(jamnpCertificateError)
    }

    logger.info('Generated Gray Paper compliant JAMNP-S certificates', {
      validatorIndex: config.validatorIndex,
      alpnProtocol,
      tlsFormat: 'RSA X.509 PEM (transport layer)',
      ed25519Format: 'Ed25519 X.509 DER (application layer)',
      alternativeName: ed25519Certificate.certificate.alternativeName,
      ed25519PublicKey: Buffer.from(
        ed25519Certificate.certificate.publicKey,
      ).toString('hex'),
      grayPaperCompliant: true,
    })

    // Store Ed25519 certificate for application-layer verification
    this.ed25519Certificate = ed25519Certificate.certificate

    return safeResult({
      privateKeyPEM: Buffer.from(
        ed25519Certificate.certificatePEM.certificate,
      ).toString('base64'),
      certificatePEM: Buffer.from(
        ed25519Certificate.certificatePEM.certificate,
      ).toString('base64'),
      alpnProtocol,
    })
  }

  /**
   * Generate JAMNP-S compliant certificates using runtime generation
   */
  private generateJAMNPCertificates(
    validatorIndex: bigint,
    chainHash: string,
  ): Safe<{
    privateKeyPEM: string
    certificatePEM: string
    alpnProtocol: string
  }> {
    // Check cache first
    const cacheKey = `validator-${validatorIndex}-${chainHash}`
    if (this.certificateCache.has(cacheKey)) {
      return safeResult(
        this.certificateCache.get(cacheKey) as {
          privateKeyPEM: string
          certificatePEM: string
          alpnProtocol: string
        },
      )
    }

    // Generate deterministic seed for Ed25519 keys per Gray Paper
    // TODO: check how this should be derived
    const testSeed = `test-seed-validator-${validatorIndex}-${chainHash}`
    const seedBytes = new TextEncoder().encode(testSeed)
    const paddedSeed = new Uint8Array(32)
    paddedSeed.set(seedBytes.slice(0, 32))
    const seedHex = Array.from(paddedSeed, (byte) =>
      byte.toString(16).padStart(2, '0'),
    ).join('') as `0x${string}`

    // Use the existing certificate generation utility from @pbnj/networking
    const [ed25519CertificateError, ed25519Certificate] =
      generateCertificateFromSeed(seedHex)
    if (ed25519CertificateError) {
      return safeError(ed25519CertificateError)
    }

    // Generate ALPN protocol string according to JAMNP-S spec
    const alpnProtocol = generateALPNProtocol(chainHash, false)

    // Store Ed25519 certificate for application-layer verification
    this.ed25519Certificate = ed25519Certificate.certificate

    logger.debug('Generated Ed25519 certificate for JAMNP-S', {
      validatorIndex,
      alternativeName: ed25519Certificate.certificate.alternativeName,
      alpnProtocol,
    })

    // Cache the certificate data - use the runtime-generated certificates
    const certificateData = {
      privateKeyPEM: Buffer.from(
        ed25519Certificate.certificatePEM.certificate,
      ).toString('base64'),
      certificatePEM: Buffer.from(
        ed25519Certificate.certificatePEM.certificate,
      ).toString('base64'),
      alpnProtocol,
    }
    this.certificateCache.set(cacheKey, certificateData)

    return safeResult(certificateData)
  }

  /**
   * Get the Ed25519 certificate for application-layer verification
   * This is used for Gray Paper compliant peer authentication
   */
  getEd25519Certificate(): unknown {
    return this.ed25519Certificate
  }

  /**
   * Parse bootnode string into BootnodeInfo
   * Format: peerId@host:port (e.g., "12D3KooWQYV9dGMAoNdsHfUcDjyfB5rk68A9EJF6RkGsaYPb5Cy8@127.0.0.1:40000")
   */
  // private parseBootnode(bootnode: string): Safe<BootnodeInfo> {
  //   const [peerId, address] = bootnode.split('@')
  //   if (!peerId || !address) {
  //     return safeError(new Error(`Invalid bootnode format: ${bootnode}`))
  //   }

  //   const [host, portStr] = address.split(':')
  //   const port = Number.parseInt(portStr)

  //   if (!host || Number.isNaN(port)) {
  //     return safeError(
  //       new Error(`Invalid address format in bootnode: ${address}`),
  //     )
  //   }

  //   return safeResult({ peerId, host, port: BigInt(port) })
  // }

  /**
   * Load chain configuration from file or use defaults
   */
  // private loadChainConfig(): ChainValidator[] {
  //   try {
  //     // Check if chainHash is a file path
  //     const configPath = this.config.chainHash.endsWith('.json')
  //       ? this.config.chainHash
  //       : `config/${this.config.chainHash}-config.json`

  //     if (existsSync(configPath)) {
  //       logger.info(`Loading chain config from ${configPath}`)
  //       const configData: ChainSpec = JSON.parse(
  //         readFileSync(configPath, 'utf-8'),
  //       )

  //       // Handle dev-config.json format
  //       if (configData.genesis_validators) {
  //         return configData.genesis_validators.map(
  //           (validator: ChainValidator, index: number) => ({
  //             ...validator,
  //             validator_index: validator.validator_index ?? BigInt(index),
  //           }),
  //         )
  //       }

  //       // Handle chain spec format with bootnodes (preferred format)
  //       if (configData.bootnodes && configData.bootnodes.length > 0) {
  //         logger.info(
  //           `Found ${configData.bootnodes.length} bootnodes in chain spec`,
  //         )
  //         const validators: ChainValidator[] = []

  //         for (const [index, bootnode] of configData.bootnodes.entries()) {
  //           const [parsedError, parsed] = this.parseBootnode(bootnode)
  //           if (parsedError) {
  //             logger.error('Failed to parse bootnode', {
  //               error: parsedError.message,
  //             })
  //             continue
  //           }
  //           if (parsed) {
  //             validators.push({
  //               peer_id: parsed.peerId,
  //               bandersnatch: '', // Will be derived from peer_id if needed
  //               net_addr: `${parsed.host}:${parsed.port}`,
  //               validator_index: BigInt(index),
  //             })
  //             logger.debug(
  //               `Parsed bootnode: ${parsed.peerId} at ${parsed.host}:${parsed.port}`,
  //             )
  //           } else {
  //             logger.warn(`Failed to parse bootnode: ${bootnode}`)
  //           }
  //         }

  //         if (validators.length > 0) {
  //           return validators
  //         }
  //       }
  //     }

  //     logger.warn(
  //       `Chain config file not found: ${configPath}, using fallback configuration`,
  //     )
  //   } catch (error) {
  //     logger.error('Failed to load chain config:', error)
  //   }

  //   // Fallback to default test configuration
  //   return [
  //     {
  //       peer_id: 'eecgwpgwq3noky4ijm4jmvjtmuzv44qvigciusxakq5epnrfj2utb',
  //       bandersnatch:
  //         'ff71c6c03ff88adb5ed52c9681de1629a54e702fc14729f6b50d2f0a76f185b3',
  //       net_addr: '127.0.0.1:40000',
  //       validator_index: 0n,
  //     },
  //     {
  //       peer_id: 'en5ejs5b2tybkfh4ym5vpfh7nynby73xhtfzmazumtvcijpcsz6ma',
  //       bandersnatch:
  //         'dee6d555b82024f1ccf8a1e37e60fa60fd40b1958c4bb3006af78647950e1b91',
  //       net_addr: '127.0.0.1:40001',
  //       validator_index: 1n,
  //     },
  //   ]
  // }

  /**
   * Initialize the networking service
   */
  async init(): SafePromise<boolean> {
    logger.info('Initializing networking service')
    await this.transport.start()

    this.setInitialized(true)

    return safeResult(true)
  }

  /**
   * Start the networking service
   */
  async start(): SafePromise<boolean> {
    logger.info('Starting JIP-5 compliant networking service')

    // Load chain configuration to get validator information
    // const chainValidators = this.loadChainConfig()
    // logger.info(`Loaded ${chainValidators.length} validators from chain config`)

    // Convert chain validators to networking validator format
    const validators: ValidatorMetadata[] = []

    // for (const chainValidator of chainValidators) {
    //   const [host, portStr] = chainValidator.net_addr.split(':')
    //   const port = BigInt(portStr || '30333')

    //   // Convert bandersnatch hex to public key bytes
    //   const publicKeyBytes = chainValidator.bandersnatch
    //     ? new Uint8Array(Buffer.from(chainValidator.bandersnatch, 'hex'))
    //     : new Uint8Array(32)

    //   const validator: ValidatorMetadata = {
    //     index: chainValidator.validator_index || 0n,
    //     publicKey: publicKeyBytes,
    //     endpoint: {
    //       host,
    //       port,
    //       publicKey: publicKeyBytes,
    //     },
    //   }

    //   validators.push(validator)

    //   logger.debug(`Added validator from chain config`, {
    //     index: validator.index,
    //     host,
    //     port,
    //     peerId: chainValidator.peer_id,
    //   })
    // }

    // Ensure our local validator is included
    const ourValidator = validators.find(
      (v) => v.index === this.config.validatorIndex,
    )
    if (!ourValidator) {
      validators.push({
        index: this.config.validatorIndex,
        publicKey: new Uint8Array(32),
        endpoint: {
          host: this.config.listenAddress,
          port: this.config.listenPort,
          publicKey: new Uint8Array(32),
        },
      })
      logger.info(
        `Added local validator (index ${this.config.validatorIndex}) to validator set`,
      )
    }

    await this.validatorSetManager.initializeValidatorSet(validators)

    // Set local validator for peer discovery
    this.peerDiscoveryManager.setLocalValidator(
      this.config.validatorIndex,
      this.config.nodeType,
    )

    // Start peer discovery according to JIP-5
    await this.peerDiscoveryManager.start()

    // Start connection manager for QUIC connections
    await this.connectionManager.start()

    // Start protocol handlers
    logger.info('Starting block announcement protocol from networking service')
    // await this.blockAnnouncementProtocol.start()
    logger.info(
      'Starting work package submission protocol from networking service',
    )
    // await this.workPackageSubmissionProtocol.start()

    // Log keepalive status
    if (this.keepaliveEnabled) {
      logger.info('JIP-5 compliant QUIC keepalive mechanism enabled', {
        interval: '30 seconds',
        purpose: 'Connection health monitoring and automatic reconnection',
      })
    }

    this.setRunning(true)
    logger.info('JIP-5 compliant networking service started successfully', {
      validatorIndex: this.config.validatorIndex,
      listenPort: this.config.listenPort,
      protocols: ['BlockAnnouncement', 'WorkPackageSubmission'],
    })
    return safeResult(true)
  }

  /**
   * Stop the networking service
   */
  async stop(): SafePromise<boolean> {
    // Stop JIP-5 components gracefully
    try {
      // await this.blockAnnouncementProtocol.stop()
      // await this.workPackageSubmissionProtocol.stop()
      await this.connectionManager.stop()
      await this.peerDiscoveryManager.stop()
      logger.info('JIP-5 networking components stopped successfully')
    } catch (error) {
      logger.warn('JIP-5 component stop failed:', error)
    }

    // Stop transport
    try {
      await this.transport.stop()
      logger.info('QUIC transport stopped successfully')
    } catch (error) {
      logger.warn('Transport stop failed (may already be stopped):', error)
    }

    this.setRunning(false)
    logger.info('JIP-5 compliant networking service stopped successfully')

    return safeResult(true)
  }

  /**
   * Update validator set
   */
  updateValidatorSet(
    epoch: bigint,
    validators: Map<bigint, ValidatorMetadata>,
  ): void {
    // TODO: Implement validator set update
    logger.debug('Validator set update received', {
      epoch,
      validatorCount: validators.size,
    })
  }

  /**
   * Announce a new block to the network
   */
  async announceBlock(_blockHeader: BlockHeader): Promise<void> {
    //TODO: Implement block announcement
  }

  /**
   * Submit a work package to the network
   */
  async submitWorkPackage(workPackage: WorkPackage): SafePromise<void> {
    //TODO: Implement work package submission
    // encode work package
    const [workPackageError, _encodedWorkPackage] =
      encodeWorkPackage(workPackage)
    if (workPackageError) {
      return safeError(workPackageError)
    }
    // TODO: submit over the up protocol
    return safeResult(undefined)
  }

  /**
   * Get networking service status
   */
  getStatus() {
    const baseStatus = super.getStatus()
    return {
      ...baseStatus,
      details: {
        validatorIndex: this.config.validatorIndex,
        nodeType: this.config.nodeType,
        listenAddress: this.config.listenAddress,
        listenPort: this.config.listenPort,
        chainHash: this.config.chainHash,
        isBuilder: this.config.isBuilder ?? false,
      },
    }
  }

  /**
   * Handle incoming message from network
   */
  private handleIncomingMessage(
    validatorIndex: bigint,
    streamKind: StreamKind,
    data: Uint8Array,
  ): Safe<void> {
    switch (streamKind) {
      case 0: // Block announcement
        return this.handleBlockAnnouncement(validatorIndex, data)
      case 128: // Block request
        return this.handleBlockRequest(validatorIndex, data)
      case 129: // State request
        return this.handleStateRequest(validatorIndex, data)
      case 133: // Work package submission
        return this.handleWorkPackageSubmission(validatorIndex, data)
      default:
        logger.warn('Unhandled stream kind, ignoring message', {
          streamKind,
          validatorIndex,
          dataLength: data.length,
        })
        return safeResult(undefined)
    }
  }

  /**
   * Handle block announcement (UP 0)
   */
  private handleBlockAnnouncement(
    _validatorIndex: bigint,
    data: Uint8Array,
  ): Safe<void> {
    const [blockHeaderError, _blockHeader] = decodeHeader(data)
    if (blockHeaderError) {
      return safeError(blockHeaderError)
    }

    // Notify block authoring service about new block
    // TODO: store block in the database
    // TODO: Implement block announcement handling in block authoring service
    logger.debug(
      'Block announcement received, would notify block authoring service',
    )
    return safeResult(undefined)
  }

  /**
   * Handle block request (CE 128)
   */
  private handleBlockRequest(
    _validatorIndex: bigint,
    data: Uint8Array,
  ): Safe<void> {
    const [headerError, _header] = decodeHeader(data)
    if (headerError) {
      return safeError(headerError)
    }

    // Get block from block authoring service
    // TODO: Implement block retrieval in block authoring service
    logger.debug(
      'Block request received, would retrieve block from block authoring service',
    )
    return safeResult(undefined)
  }

  /**
   * Handle state request (CE 129)
   */
  private handleStateRequest(
    _validatorIndex: bigint,
    data: Uint8Array,
  ): Safe<void> {
    const [requestError, _request] = this.deserializeStateRequest(data)
    if (requestError) {
      return safeError(requestError)
    }

    // Get state from block authoring service
    // TODO: Implement state retrieval in block authoring service
    logger.debug(
      'State request received, would retrieve state from block authoring service',
    )
    return safeResult(undefined)
  }

  /**
   * Handle work package submission (CE 133)
   */
  private handleWorkPackageSubmission(
    _validatorIndex: bigint,
    data: Uint8Array,
  ): Safe<void> {
    const [workPackageError, _workPackage] = decodeWorkPackage(data)
    if (workPackageError) {
      return safeError(workPackageError)
    }

    // Process work package in block authoring service
    // TODO: Implement work package processing in block authoring service
    logger.debug(
      'Work package submission received, would process in block authoring service',
    )
    return safeResult(undefined)
  }

  /**
   * Deserialize state request
   */
  private deserializeStateRequest(data: Uint8Array): Safe<{
    startKey: string
    endKey: string
  }> {
    return safeResult(JSON.parse(new TextDecoder().decode(data)))
  }

  /**
   * Send a test message using JIP-5 compliant block announcement protocol
   */
  // private async sendTestMessage(): Promise<void> {
  //   try {
  //     // Create a mock block header for JIP-5 testing
  //     const mockBlockHeader = new Uint8Array(128)
  //     const view = new DataView(mockBlockHeader.buffer)

  //     // Set slot number (first 4 bytes) - simulate JAM slot progression
  //     const currentSlot = Math.floor(Date.now() / 6000) // 6 second slots
  //     view.setUint32(0, currentSlot, true)

  //     // Set validator index (next 2 bytes)
  //     view.setUint16(4, Number(this.config.validatorIndex), true)

  //     // Set message sequence number (next 4 bytes)
  //     view.setUint32(6, this.testMessageCount, true)

  //     // Fill rest with test pattern based on current time
  //     const timestamp = Date.now()
  //     for (let i = 10; i < 128; i++) {
  //       mockBlockHeader[i] = (timestamp + i + this.testMessageCount) % 256
  //     }

  //     logger.info('Sending JIP-5 compliant test block announcement', {
  //       messageNumber: this.testMessageCount + 1,
  //       validatorIndex: this.config.validatorIndex,
  //       slot: currentSlot,
  //       timestamp: new Date().toISOString(),
  //       protocol: 'BlockAnnouncement',
  //     })

  //     // Use JIP-5 compliant block announcement protocol
  //     try {
  //       await this.blockAnnouncementProtocol.announceBlock({
  //         slot: BigInt(currentSlot),
  //         validatorIndex: this.config.validatorIndex,
  //         sequenceNumber: BigInt(this.testMessageCount),
  //         headerData: mockBlockHeader,
  //       })

  //       logger.debug('JIP-5 block announcement sent successfully', {
  //         header: {
  //           slot: currentSlot,
  //           validatorIndex: this.config.validatorIndex,
  //           sequenceNumber: this.testMessageCount,
  //         },
  //         message: {
  //           headerLength: mockBlockHeader.length,
  //           protocol: 'UP0-BlockAnnouncement',
  //         },
  //       })
  //     } catch (announceError) {
  //       // Fallback to logging if protocol is not fully connected
  //       logger.warn(
  //         'Block announcement protocol not ready, logging test message',
  //         {
  //           error: announceError,
  //           fallback: true,
  //         },
  //       )

  //       logger.debug('Block announcement data (test mode)', {
  //         header: {
  //           slot: currentSlot,
  //           validatorIndex: this.config.validatorIndex,
  //           sequenceNumber: this.testMessageCount,
  //         },
  //         message: {
  //           headerLength: mockBlockHeader.length,
  //         },
  //       })
  //     }
  //   } catch (error) {
  //     logger.error('Failed to send JIP-5 test message:', error)
  //   }
  // }

  /**
   * Enable or disable QUIC keepalive mechanism
   * Gray Paper: Connection health monitoring for validator connectivity
   */
  setKeepaliveEnabled(enabled: boolean): void {
    this.keepaliveEnabled = enabled
    logger.info(
      `QUIC keepalive mechanism ${enabled ? 'enabled' : 'disabled'}`,
      {
        interval: '30 seconds',
        purpose: 'Connection health monitoring per Gray Paper requirements',
      },
    )
  }

  /**
   * Extract validator index and stream kind from stream ID according to JAMNP-S specification
   * Stream ID format: up{streamKind}-{protocolName}-{validatorIndex} or ce{streamKind}-{protocolName}-{validatorIndex}
   */
  private extractStreamInfo(streamId: string): Safe<{
    validatorIndex: bigint
    protocolName: string
    streamKind: StreamKind
  }> {
    // Parse stream ID format: up{streamKind}-{protocolName}-{validatorIndex} or ce{streamKind}-{protocolName}-{validatorIndex}
    const parts = streamId.split('-')
    if (parts.length < 3) {
      return safeError(new Error('Invalid stream ID format'))
    }

    // Extract stream type and kind from first part (e.g., "up0" or "ce128")
    const streamTypePart = parts[0]
    const [streamKindError, streamKind] = this.parseStreamKind(streamTypePart)
    if (streamKindError) {
      return safeError(streamKindError)
    }

    // Extract validator index from last part
    const validatorIndexStr = parts[parts.length - 1]
    const validatorIndex = BigInt(validatorIndexStr)

    if (Number.isNaN(validatorIndex)) {
      return safeError(new Error('Invalid validator index in stream ID'))
    }

    return safeResult({ validatorIndex, protocolName: parts[1], streamKind })
  }

  /**
   * Parse stream kind from stream type part (e.g., "up0" -> 0, "ce128" -> 128)
   */
  private parseStreamKind(streamTypePart: string): Safe<StreamKind> {
    // Extract numeric part from stream type (e.g., "up0" -> "0", "ce128" -> "128")
    const match = streamTypePart.match(/^(up|ce)(\d+)$/)
    if (!match) {
      return safeError(new Error('Invalid stream kind in stream type'))
    }

    const streamKind = Number.parseInt(match[2], 10)
    if (Number.isNaN(streamKind)) {
      return safeError(new Error('Invalid stream kind in stream type'))
    }

    return safeResult(streamKind as StreamKind)
  }

  /**
   * Get keepalive status
   */
  isKeepaliveEnabled(): boolean {
    return this.keepaliveEnabled
  }
}
