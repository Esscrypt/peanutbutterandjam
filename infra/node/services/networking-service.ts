/**
 * Networking Service for JAM Node
 *
 * Integrates JAMNP-S networking with block authoring functionality
 */

import type { QUICConnection } from '@infisical/quic'
import { type events, QUICClient, QUICServer } from '@infisical/quic'
import type QUICStream from '@infisical/quic/dist/QUICStream'
import * as ed from '@noble/ed25519'
import { sha512 } from '@noble/hashes/sha2.js'
import {
  bytesToHex,
  type EventBusService,
  getEd25519KeyPairWithFallback,
  type Hex,
  logger,
} from '@pbnjam/core'

// Configure Ed25519 with SHA-512
ed.hashes.sha512 = (...m) => sha512(ed.etc.concatBytes(...m))

import {
  type DecodedNetworkingMessage,
  decodeNetworkingMessage,
  decodeNetworkingMessageWithKind,
  encodeFixedLength,
} from '@pbnjam/codec'
import type { NetworkingProtocol } from '@pbnjam/networking'
import {
  extractPublicKeyFromDERCertificate,
  generateNetworkingCertificates,
  getClientCrypto,
  getServerCrypto,
  getTlsConfig,
  Peer,
  shouldLocalInitiate,
  verifyPeerCertificate,
} from '@pbnjam/networking'
import type {
  ConnectionEndpoint,
  EpochMark,
  SafePromise,
  StreamKind,
} from '@pbnjam/types'
import { BaseService, safeError, safeResult } from '@pbnjam/types'
import type { ClockService } from './clock-service'
import type { ConfigService } from './config-service'
import type { KeyPairService } from './keypair-service'
import type { RecentHistoryService } from './recent-history-service'
import type { ValidatorSetManager } from './validator-set'

/**
 * Networking service for JAM node
 */
export class NetworkingService extends BaseService {
  private readonly protocolRegistry: Map<
    StreamKind,
    NetworkingProtocol<unknown, unknown>
  > = new Map()

  // Track peers: 1 Peer per remote (per QUIC connection); each Peer can have multiple streams
  /** Map of peer public key to Peer object */
  private readonly peers: Map<Hex, Peer> = new Map()
  /** Map of connection ID to peer public key (for reverse lookup) */
  private readonly connectionIdToPeer: Map<string, Hex> = new Map()
  /** Public key to connection map (for backward compatibility) */
  publicKeyToConnection: Map<Hex, QUICConnection> = new Map()
  /** Track which streams have sent their first message (to know if we need to send kind byte) */
  private readonly streamsWithFirstMessage: WeakSet<QUICStream> = new WeakSet()

  /**
   * Get peer by public key
   */
  private getPeer(publicKey: Hex): Peer | undefined {
    return this.peers.get(publicKey)
  }

  /**
   * Get peer by connection ID
   */
  private getPeerByConnectionId(connectionId: string): Peer | undefined {
    const publicKey = this.connectionIdToPeer.get(connectionId)
    return publicKey ? this.peers.get(publicKey) : undefined
  }

  /**
   * Add or update a peer
   */
  private setPeer(peer: Peer): void {
    this.peers.set(peer.publicKey, peer)
    this.connectionIdToPeer.set(peer.connectionId, peer.publicKey)
    this.publicKeyToConnection.set(peer.publicKey, peer.connection)
  }

  /**
   * Remove a peer and clean up all its streams
   */
  private removePeer(publicKey: Hex): void {
    const peer = this.peers.get(publicKey)
    if (peer) {
      // Clean up all streams
      for (const stream of peer.streams) {
        peer.removeStream(stream)
      }
      this.connectionIdToPeer.delete(peer.connectionId)
      this.publicKeyToConnection.delete(publicKey)
      this.peers.delete(publicKey)
    }
  }

  private server: QUICServer | null = null

  private validatorSetManagerService: ValidatorSetManager | null = null
  private clockService: ClockService | null = null
  private recentHistoryService: RecentHistoryService | null = null
  private readonly eventBusService: EventBusService
  private readonly keyPairService: KeyPairService | null
  private readonly chainHash: string
  private configService: ConfigService
  private validatorIndex: number | undefined
  private statusInterval: NodeJS.Timeout | null = null
  private epochStartSlot: bigint | null = null
  private hasConnectedThisEpoch = false

  constructor(options: {
    protocolRegistry: Map<StreamKind, NetworkingProtocol<unknown, unknown>>
    keyPairService?: KeyPairService
    chainHash: string
    configService: ConfigService
    validatorIndex?: number
    eventBusService: EventBusService
  }) {
    super('networking-service')
    this.keyPairService = options.keyPairService || null
    this.chainHash = options.chainHash
    this.protocolRegistry = options.protocolRegistry
    this.configService = options.configService
    this.validatorIndex = options.validatorIndex
    this.eventBusService = options.eventBusService
  }

  setValidatorSetManager(validatorSetManager: ValidatorSetManager): void {
    this.validatorSetManagerService = validatorSetManager
  }

  setClockService(clockService: ClockService): void {
    this.clockService = clockService
  }

  setRecentHistoryService(recentHistoryService: RecentHistoryService): void {
    this.recentHistoryService = recentHistoryService
  }

  async init(): SafePromise<boolean> {
    if (this.server) {
      return safeResult(true)
    }

    // Get the private key for signing using helper with fallback logic
    const [keyPairError, ed25519KeyPair] = getEd25519KeyPairWithFallback(
      this.configService,
      this.keyPairService || undefined,
    )
    if (keyPairError || !ed25519KeyPair) {
      return safeError(
        keyPairError ||
          new Error('Failed to get Ed25519 key pair with fallback'),
      )
    }
    const privateKey = ed25519KeyPair.privateKey

    const serverCrypto = getServerCrypto(privateKey)

    const [certificateDataError, certificateData] =
      await generateNetworkingCertificates(ed25519KeyPair, this.chainHash)
    if (certificateDataError) {
      return safeError(
        new Error(
          `Failed to generate certificate data: ${certificateDataError.message}`,
        ),
      )
    }

    const tlsConfig = getTlsConfig(certificateData)

    // Create server
    this.server = new QUICServer({
      crypto: serverCrypto,
      config: {
        ...tlsConfig,
        key: tlsConfig.key!,
        cert: tlsConfig.cert!,
        verifyCallback: verifyPeerCertificate, // Enable verification callback for mutual TLS
      },
    })

    return safeResult(true)
  }

  async start(): SafePromise<boolean> {
    super.start()
    if (!this.server) {
      return safeError(new Error('Server not initialized'))
    }
    if (!this.validatorSetManagerService) {
      return safeError(new Error('Validator set manager not set'))
    }

    // Get connection endpoint from validator set manager
    if (this.validatorIndex === undefined) {
      logger.error(
        '[NetworkingService.start] No validator index configured. Cannot determine connection endpoint.',
      )
      return safeError(
        new Error(
          'No validator index configured. Cannot determine connection endpoint.',
        ),
      )
    }

    const activeValidators =
      this.validatorSetManagerService.getActiveValidators()
    if (
      activeValidators.length <= this.validatorIndex ||
      !activeValidators[this.validatorIndex]?.connectionEndpoint
    ) {
      logger.error(
        `[NetworkingService.start] Validator ${this.validatorIndex} in staging set does not have connection endpoint. Cannot start networking service.`,
        {
          validatorIndex: this.validatorIndex,
          activeSetLength: activeValidators.length,
          hasValidator: activeValidators.length > this.validatorIndex,
          hasEndpoint:
            activeValidators.length > this.validatorIndex &&
            !!activeValidators[this.validatorIndex]?.connectionEndpoint,
        },
      )
      return safeError(
        new Error(
          `Validator ${this.validatorIndex} in staging set does not have connection endpoint. Cannot start networking service.`,
        ),
      )
    }

    const endpoint = activeValidators[this.validatorIndex].connectionEndpoint!
    const listenAddress = endpoint.host
    const listenPort = endpoint.port

    logger.info(
      `[NetworkingService.start] Using connection endpoint from staging set validator ${this.validatorIndex}: ${listenAddress}:${listenPort}`,
    )

    this.setupServerConnectionOverride()

    await this.server.start({ host: listenAddress, port: listenPort })

    logger.info('[NetworkingService.start] Server started', {
      listenAddress: listenAddress,
      listenPort: listenPort,
    })

    // Start periodic status logging every 2 seconds
    this.startStatusLogging()

    // Register event handlers
    // Track epoch transitions to know when epoch starts
    this.eventBusService.addEpochTransitionCallback(
      this.handleEpochTransition.bind(this),
    )
    // Listen to conectivityChange event from clock-service (after delay)
    // TODO: this causes us to initiate connections. double check
    this.eventBusService.addConectivityChangeCallback(
      this.handleConectivityChange.bind(this),
    )

    return safeResult(true)
  }

  /**
   * Start periodic status logging
   */
  private startStatusLogging(): void {
    // Clear any existing interval
    if (this.statusInterval) {
      clearInterval(this.statusInterval)
    }

    // Log status every 2 seconds
    this.statusInterval = setInterval(() => {
      this.logNetworkStatus()
    }, 2000)
  }

  /**
   * Log network status (peers and validators)
   */
  private logNetworkStatus(): void {
    // const peerCount = this.publicKeyToConnection.size
    // let validatorCount = 0

    // Count validators by checking if peer public keys are in the validator set
    if (this.validatorSetManagerService) {
      const activeValidators =
        this.validatorSetManagerService.getActiveValidators()
      const pendingValidators =
        this.validatorSetManagerService.getPendingValidators()
      const previousValidators =
        this.validatorSetManagerService.getPreviousValidators()

      const validatorPublicKeys = new Set<Hex>()
      for (const validator of activeValidators) {
        validatorPublicKeys.add(validator.ed25519)
      }
      for (const validator of pendingValidators) {
        validatorPublicKeys.add(validator.ed25519)
      }
      for (const validator of previousValidators) {
        validatorPublicKeys.add(validator.ed25519)
      }

      // Count how many connected peers are validators
      // let validatorCount = 0
      // for (const peerPublicKey of this.publicKeyToConnection.keys()) {
      //   if (validatorPublicKeys.has(peerPublicKey)) {
      //     validatorCount++
      //   }
      // }
    }

    // Log in the format: "Net status: X peers (Y vals)"
    // logger.info(`Net status: ${peerCount} peers (${validatorCount} vals)`)
  }

  async stop(): SafePromise<boolean> {
    super.stop()

    // Clear status logging interval
    if (this.statusInterval) {
      clearInterval(this.statusInterval)
      this.statusInterval = null
    }

    // Remove event listeners
    this.eventBusService.removeEpochTransitionCallback(
      this.handleEpochTransition.bind(this),
    )
    this.eventBusService.removeConectivityChangeCallback(
      this.handleConectivityChange.bind(this),
    )

    if (!this.server) {
      return safeError(new Error('Server not initialized'))
    }
    await this.server.stop({ isApp: true })
    return safeResult(true)
  }

  /**
   * Handle epoch transition events to track epoch start
   */
  private async handleEpochTransition(event: {
    slot: bigint
    epochMark: EpochMark | null
  }): Promise<void> {
    this.epochStartSlot = event.slot
    this.hasConnectedThisEpoch = false
  }

  /**
   * Handle conectivityChange event from clock-service
   * This event is emitted after max(⌊E/30⌋,1) slots have elapsed since epoch transition
   * We still need to check if the first block in epoch has been finalized before connecting
   */
  private async handleConectivityChange(_event: {
    slot: bigint
  }): Promise<void> {
    if (
      !this.recentHistoryService ||
      !this.validatorSetManagerService ||
      !this.clockService
    ) {
      logger.error(
        '[NetworkingService.handleConectivityChange] Missing dependencies',
        {
          recentHistoryService: !!this.recentHistoryService,
          validatorSetManagerService: !!this.validatorSetManagerService,
          clockService: !!this.clockService,
        },
      )
      return
    }

    // Skip if we've already connected this epoch
    if (this.hasConnectedThisEpoch) {
      logger.debug(
        '[NetworkingService.handleConectivityChange] Already connected this epoch',
        {
          hasConnectedThisEpoch: this.hasConnectedThisEpoch,
        },
      )
      return
    }

    // Skip if we don't have an epoch start slot yet
    if (this.epochStartSlot === null) {
      const currentEpoch = this.clockService.getCurrentEpoch()
      const epochDuration = BigInt(this.configService.epochDuration)
      this.epochStartSlot = currentEpoch * epochDuration
    }

    // Check condition: First block in epoch has been finalized
    const recentHistory = this.recentHistoryService.getRecentHistory()
    if (recentHistory.length === 0) {
      logger.debug(
        '[NetworkingService.handleConectivityChange] No recent history',
        {
          recentHistoryLength: recentHistory.length,
        },
      )
      return
    }

    // The oldest block in recent history is considered finalized
    const currentSlot = this.clockService.getCurrentSlot()
    const oldestBlockSlot = currentSlot - BigInt(recentHistory.length - 1)

    // Check if the first block in epoch (epochStartSlot) has been finalized
    const firstBlockInEpochFinalized = oldestBlockSlot <= this.epochStartSlot

    if (!firstBlockInEpochFinalized) {
      logger.debug(
        '[NetworkingService.handleConectivityChange] First block in epoch not finalized',
        {
          oldestBlockSlot: oldestBlockSlot,
          currentSlot: currentSlot,
          epochStartSlot: this.epochStartSlot,
        },
      )
      return
    }

    // Condition met - connect to peers from active set
    await this.connectToActiveSetPeers()
    this.hasConnectedThisEpoch = true
  }

  /**
   * Connect to peers from the active validator set
   */
  private async connectToActiveSetPeers(): Promise<void> {
    if (!this.validatorSetManagerService) {
      logger.error('[NetworkingService] Validator set manager not set')
      return
    }

    const activeValidators =
      this.validatorSetManagerService.getActiveValidators()

    // Get local public key to avoid connecting to ourselves
    const [keyPairError, ed25519KeyPair] = getEd25519KeyPairWithFallback(
      this.configService,
      this.keyPairService || undefined,
    )
    if (keyPairError || !ed25519KeyPair) {
      logger.error('[NetworkingService] Failed to get local Ed25519 key pair')
      return
    }
    const localPublicKey = bytesToHex(ed25519KeyPair.publicKey)

    logger.info('[NetworkingService] Connecting to active set peers', {
      activeSetSize: activeValidators.length,
      localPublicKey: `${localPublicKey.slice(0, 20)}...`,
    })

    // Connect to each validator in the active set (except ourselves)
    for (const validator of activeValidators) {
      // Skip if this is our own validator
      if (validator.ed25519 === localPublicKey) {
        continue
      }

      // Skip if we're already connected
      if (this.isConnectedToPeer(validator.ed25519)) {
        continue
      }

      // Skip if validator doesn't have connection endpoint
      if (!validator.connectionEndpoint) {
        logger.debug(
          '[NetworkingService] Validator missing connection endpoint',
          {
            validatorKey: `${validator.ed25519.slice(0, 20)}...`,
          },
        )
        continue
      }

      // Attempt to connect
      logger.info('[NetworkingService] Attempting to connect to peer', {
        validatorKey: `${validator.ed25519.slice(0, 20)}...`,
        endpoint: `${validator.connectionEndpoint.host}:${validator.connectionEndpoint.port}`,
      })

      const [connectError] = await this.connectToPeer(
        validator.connectionEndpoint,
      )
      if (connectError) {
        logger.debug('[NetworkingService] Failed to connect to peer', {
          validatorKey: `${validator.ed25519.slice(0, 20)}...`,
          error: connectError.message,
        })
      } else {
        logger.info('[NetworkingService] Successfully connected to peer', {
          validatorKey: `${validator.ed25519.slice(0, 20)}...`,
        })
      }
    }
  }

  /**
   * Send a message according to JAMNP-S specification
   *
   * JAMNP-S requires:
   * 1. 32-bit little-endian message size
   * 2. Kind byte (protocol identifier)
   * 3. Message content
   */
  async sendMessage(
    validatorIndex: bigint,
    kindByte: StreamKind,
    message: Uint8Array,
  ): SafePromise<void> {
    if (!this.validatorSetManagerService) {
      return safeError(new Error('Validator set manager not set'))
    }
    const [validatorPublicKeyError, validatorPublicKey] =
      this.validatorSetManagerService.getValidatorAtIndex(
        Number(validatorIndex),
      )
    if (validatorPublicKeyError) {
      logger.error('❌ Failed to get validator public key', {
        validatorIndex: validatorIndex.toString(),
        error: validatorPublicKeyError.message,
      })
      return safeError(validatorPublicKeyError)
    }

    logger.info('🔑 Found validator public key', {
      validatorIndex: validatorIndex.toString(),
      publicKey: validatorPublicKey.ed25519,
    })

    // Send size first - convert Uint8Array to hex string for lookup
    const validatorPublicKeyHex = validatorPublicKey.ed25519
    return await this.sendMessageByPublicKey(
      validatorPublicKeyHex,
      kindByte,
      message,
    )
  }

  async sendMessageByPublicKey(
    publicKey: Hex,
    kindByte: StreamKind,
    message: Uint8Array,
  ): SafePromise<void> {
    const peer = this.getPeer(publicKey)
    if (!peer) {
      logger.error('❌ No peer found for validator', {
        publicKey: publicKey,
        peersCount: this.peers.size,
        availablePeers: Array.from(this.peers.keys()),
      })
      return safeError(new Error(`Validator ${publicKey} not found`))
    }

    // Use primary stream for sending (first stream created/received)
    if (!peer.primaryStream) {
      logger.error('❌ No stream available for peer', {
        publicKey: publicKey,
        totalStreams: peer.streams.size,
      })
      return safeError(new Error(`No stream available for peer ${publicKey}`))
    }

    const stream = peer.primaryStream
    const writer = stream.writable.getWriter()
    try {
      // Check if this is the first message on this stream
      const isFirstMessage = !this.streamsWithFirstMessage.has(stream)

      if (isFirstMessage) {
        // First message: send kind byte, then size+content
        this.streamsWithFirstMessage.add(stream)

        // Send kind byte first
        const kindByteBuffer = new Uint8Array([kindByte])
        await writer.write(kindByteBuffer)
      }

      // Send message: [4-byte size (little-endian)][message content]
      const [encodeSizeError, sizeBytes] = encodeFixedLength(
        BigInt(message.length),
        4n,
      )
      if (encodeSizeError) {
        return safeError(encodeSizeError)
      }

      // Combine size + message content
      const messageBuffer = new Uint8Array(4 + message.length)
      messageBuffer.set(sizeBytes, 0)
      messageBuffer.set(message, 4)

      await writer.write(messageBuffer)
    } finally {
      writer.releaseLock()
    }
    return safeResult(undefined)
  }

  /**
   * Close the writable side of a stream for a peer
   *
   * This sends FIN to indicate we're done sending data on this stream.
   * Used after sending requests (e.g., CE129 state requests) to signal completion.
   *
   * @param publicKey - Public key of the peer
   * @returns Safe result indicating success or failure
   */
  async closeStreamForPeer(publicKey: Hex): SafePromise<void> {
    const peer = this.getPeer(publicKey)
    if (!peer) {
      logger.warn('No peer found to close stream', {
        publicKey: `${publicKey.substring(0, 20)}...`,
      })
      return safeError(
        new Error(`Peer ${publicKey.substring(0, 20)}... not found`),
      )
    }

    // Close primary stream
    if (!peer.primaryStream) {
      logger.warn('No primary stream found to close', {
        publicKey: `${publicKey.substring(0, 20)}...`,
        totalStreams: peer.streams.size,
      })
      return safeError(
        new Error(
          `No primary stream for peer ${publicKey.substring(0, 20)}...`,
        ),
      )
    }

    const stream = peer.primaryStream
    const writer = stream.writable.getWriter()
    try {
      await writer.close()
    } catch (error) {
      logger.error('Failed to close stream', {
        publicKey: `${publicKey.substring(0, 20)}...`,
        error: error instanceof Error ? error.message : String(error),
      })
      return safeError(
        error instanceof Error ? error : new Error('Failed to close stream'),
      )
    } finally {
      writer.releaseLock()
    }

    return safeResult(undefined)
  }

  /**
   * Set up data listener on a stream to handle incoming messages
   * Called once per stream when the stream is created
   * Processes messages continuously until the stream ends
   */
  private setupStreamDataListener(
    stream: QUICStream,
    peerPublicKey: Hex,
  ): void {
    this.readStreamData(stream, peerPublicKey).catch((error) => {
      this.handleStreamReadError(error, stream, peerPublicKey)
    })
  }

  /**
   * Read and process stream data using codec for message parsing
   * JAMNP-S: First message is [1-byte kind][4-byte size][message content]
   * Subsequent messages are [4-byte size][message content] (kind is known from first message)
   * Reads entire stream, parses all messages, then processes them
   */
  private async readStreamData(
    stream: QUICStream,
    peerPublicKey: Hex,
  ): Promise<void> {
    if (!stream.readable) {
      logger.warn('[NetworkingService] Stream has no readable side', {
        peerPublicKey: `${peerPublicKey.slice(0, 20)}...`,
      })
      return
    }

    const peer = this.getPeer(peerPublicKey)
    if (!peer) {
      logger.error('[NetworkingService] Peer not found for stream data', {
        peerPublicKey: `${peerPublicKey.slice(0, 20)}...`,
      })
      return
    }

    const reader = stream.readable.getReader()
    const { value } = await reader.read()
    if (!value) {
      logger.error('[NetworkingService] No value read from stream', {
        peerPublicKey: `${peerPublicKey.slice(0, 20)}...`,
      })
      return
    }
    let kindByte: StreamKind | undefined
    if (value.length === 1) {
      kindByte = value[0] as StreamKind
    } else {
      const [decodeError, networkingMessage] =
        decodeNetworkingMessageWithKind(value)
      if (decodeError) {
        logger.error(
          '[NetworkingService] Failed to decode networking message',
          {
            error: decodeError.message,
          },
        )
        return
      }
      kindByte = networkingMessage.value.kindByte
    }
    const { value: messageData } = await reader.read()
    if (!messageData) {
      logger.error('[NetworkingService] No message data read from stream', {
        peerPublicKey: `${peerPublicKey.slice(0, 20)}...`,
        messageData: messageData,
      })
      return
    }

    const [decodeError, networkingMessage] =
      decodeNetworkingMessage(messageData)
    if (decodeError) {
      logger.error('[NetworkingService] Failed to decode networking message', {
        error: decodeError.message,
      })
      return
    }
    logger.debug('[NetworkingService] Decoded networking message', {
      kindByte: kindByte,
      messageContentLength: networkingMessage.value.messageContent.length,
      messageContentHex: bytesToHex(networkingMessage.value.messageContent),
    })

    await this.processCompleteMessage(
      kindByte,
      networkingMessage.value,
      peerPublicKey,
    )
  }

  /**
   * Handle stream read errors
   * Only logs unexpected errors
   */
  private handleStreamReadError(
    error: unknown,
    stream: QUICStream,
    peerPublicKey: Hex,
  ): void {
    const errorMessage = error instanceof Error ? error.message : String(error)

    // Expected errors during cleanup (stream closed/reset)
    const isExpectedError =
      errorMessage.includes('null') ||
      errorMessage.includes('Peer closed') ||
      errorMessage === 'read 1' ||
      errorMessage.includes('read 1')

    const peer = this.getPeer(peerPublicKey)
    if (isExpectedError) {
      if (peer) {
        peer.readers.delete(stream)
      }
      return
    }

    // Log unexpected errors
    const streamState = {
      readable: !!stream.readable,
      writable: !!stream.writable,
      // biome-ignore lint/suspicious/noExplicitAny: QUIC stream types don't expose all properties
      closed: (stream as any).closed,
      // biome-ignore lint/suspicious/noExplicitAny: QUIC stream types don't expose all properties
      errored: (stream as any).errored,
    }

    logger.error('[NetworkingService] Unexpected error reading from stream', {
      error: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      peerPublicKey: `${peerPublicKey.slice(0, 20)}...`,
      streamState,
      totalStreams: peer?.streams.size || 0,
    })

    if (peer) {
      peer.readers.delete(stream)
    }
  }

  /**
   * Process a complete decoded message
   */
  private async processCompleteMessage(
    kindByte: StreamKind,
    decoded: DecodedNetworkingMessage,
    peerPublicKey: Hex,
  ): Promise<void> {
    const { messageContent: messageData } = decoded

    // Get the protocol handler
    const protocol = this.protocolRegistry.get(kindByte)
    if (protocol === undefined) {
      logger.error('❌ No protocol found for kind byte', {
        peerPublicKey: `${peerPublicKey.slice(0, 20)}...`,
        kindByte,
      })
      return
    }

    logger.info('[NetworkingService] Processing message with protocol', {
      peerPublicKey: `${peerPublicKey.slice(0, 20)}...`,
      kindByte,
      protocolName: protocol.constructor.name,
      messageSize: messageData.length,
    })

    // Use event-driven approach - non-blocking
    // This is a REQUEST coming from a peer
    const [parseError, event] = protocol.handleStreamData(
      messageData,
      peerPublicKey,
      'request', // Explicitly mark as request
    )
    if (parseError) {
      logger.error('[NetworkingService] Failed to parse request message', {
        peerPublicKey: `${peerPublicKey.slice(0, 20)}...`,
        kindByte,
        error: parseError.message,
      })
      return
    }

    logger.info('[NetworkingService] Successfully processed message', {
      peerPublicKey: `${peerPublicKey.slice(0, 20)}...`,
      kindByte,
      protocolName: protocol.constructor.name,
      messageId: event?.messageId,
      messageType: event?.messageType,
    })
  }

  async serverConnectionHandler(
    event: events.EventQUICServerConnection,
  ): Promise<void> {
    if (!event.detail) {
      logger.error('❌ EventQUICServerConnection received with no detail')
      return
    }
    if (!event.detail.connectionIdShared) {
      logger.error(
        '❌ EventQUICServerConnection received with no connectionIdShared',
      )
      return
    }
    const connection = event.detail
    const connectionId = connection.connectionIdShared.toString()

    // Check if peer already exists for this connection
    if (this.connectionIdToPeer.has(connectionId)) {
      logger.warn('❌ Connection already exists', {
        connectionId: `${connectionId.slice(0, 20)}...`,
      })
      return
    }

    // Extract certificate to get peer public key for server role validation
    // biome-ignore lint/suspicious/noExplicitAny: QUIC connection type doesn't expose certDERs property
    const certDERs = (connection as any).certDERs

    if (certDERs && certDERs.length > 0) {
      const [extractError, peerPublicKey] = extractPublicKeyFromDERCertificate(
        certDERs[0],
      )

      if (!extractError && peerPublicKey) {
        const publicKeyHex = bytesToHex(peerPublicKey)

        // Create endpoint from connection info
        // Note: We don't have the endpoint info at server connection time,
        // so we'll create a placeholder and update it later if needed
        const endpoint: ConnectionEndpoint = {
          host: '', // Will be set when we have connection info
          port: 0,
          publicKey: peerPublicKey,
        }

        // Check if we already have a peer for this public key (enforce 1 connection per peer)
        if (this.peers.has(publicKeyHex)) {
          logger.warn(
            '[NetworkingService] Rejecting additional connection - already have 1 connection per peer',
            {
              peerPublicKey: `${publicKeyHex.slice(0, 20)}...`,
              connectionId: `${connectionId.slice(0, 20)}...`,
              reason: 'Only 1 connection per peer is allowed',
            },
          )
          return
        }

        // Create peer object (as server, we don't create streams - wait for remote)
        const peer = new Peer(
          connectionId,
          publicKeyHex,
          connection,
          endpoint,
          false,
        )
        this.setPeer(peer)

        logger.info(
          '[NetworkingService] Server connection established, waiting for EventQUICConnectionStream',
          {
            connectionId: `${connectionId.slice(0, 20)}...`,
            peerPublicKey: `${publicKeyHex.slice(0, 20)}...`,
          },
        )
      } else {
        logger.error(
          '[NetworkingService] ❌ Failed to extract peer public key from certificate',
          {
            error:
              extractError instanceof Error
                ? extractError.message
                : String(extractError),
            connectionId: `${connectionId.slice(0, 20)}...`,
            certificateSize: certDERs[0]?.length,
            hasCertificate: !!certDERs[0],
          },
        )
      }
    } else {
      logger.warn(
        '[NetworkingService] ⚠️ No peer certificates available for connection',
        {
          connectionId: `${connectionId.slice(0, 20)}...`,
          certDERs: certDERs,
          certDERsType: typeof certDERs,
        },
      )
    }

    // Only set up essential events: stream creation and connection close

    // Set up connection events for streams and cleanup
    connection.addEventListener(
      'EventQUICConnectionStream',
      async (streamEvent: events.EventQUICConnectionStream) => {
        if (!streamEvent.detail) {
          logger.warn('⚠️ Stream event has no detail property')
          return
        }

        const stream = streamEvent.detail

        // Get peer for this connection
        const peer = this.getPeerByConnectionId(connectionId)
        if (!peer) {
          logger.warn('⚠️ No peer found for stream data listener setup', {
            connectionId: `${connectionId.slice(0, 20)}...`,
          })
          return
        }

        // Accept all streams from remote (server side - we don't create streams)
        peer.addStream(stream)
        logger.info(
          '[NetworkingService] Stream received from EventQUICConnectionStream, setting up listener',
          {
            peerPublicKey: `${peer.publicKey.slice(0, 20)}...`,
            connectionId: `${connectionId.slice(0, 20)}...`,
            totalStreams: peer.streams.size,
          },
        )
        this.setupStreamDataListener(stream, peer.publicKey)
      },
    )

    connection.addEventListener(
      'EventQUICConnectionClose',
      async (_closeEvent: events.EventQUICConnectionClose) => {
        const closeConnectionId =
          connection.connectionIdShared?.toString() || connectionId

        // Clean up peer (which includes connection, stream, streamKind, etc.)
        const peer = this.getPeerByConnectionId(closeConnectionId)
        if (peer) {
          this.removePeer(peer.publicKey)
        }
      },
    )
  }

  /**
   * OVERRIDE: Override the server's internal handleEventQUICConnection method
   * This intercepts all incoming connections before they're processed internally
   */
  private setupServerConnectionOverride(): void {
    this.server?.addEventListener(
      'EventQUICServerConnection',
      this.serverConnectionHandler.bind(this),
    )

    this.server?.addEventListener(
      'EventQUICServerConnectionClose',
      this.serverConnectionCloseHandler.bind(this),
    )

    // Also listen for the raw connection events from the library for debugging
    logger.info('✅ Server connection event listeners set up successfully')
  }

  private async serverConnectionCloseHandler(
    event: events.EventQUICConnectionStopped,
  ): Promise<void> {
    if (!event.detail) {
      logger.error(
        '[NetworkingService] ❌ EventQUICServerConnectionClose received with no detail',
        {
          eventType: event.type,
          eventKeys: Object.keys(event),
        },
      )
      return
    }
    // EventQUICConnectionStopped detail is the connection object itself
    const connection = event.detail as QUICConnection
    const connectionId = connection.connectionIdShared?.toString()
    if (!connectionId) {
      logger.error(
        '[NetworkingService] ❌ Connection has no connectionIdShared',
        {
          connectionType: typeof connection,
          connectionKeys: connection ? Object.keys(connection) : [],
          hasConnectionIdShared: !!connection?.connectionIdShared,
        },
      )
      return
    }
    const peer = this.getPeerByConnectionId(connectionId)
    if (!peer) {
      logger.warn('[NetworkingService] ⚠️ Connection not found in peers map', {
        connectionId: `${connectionId.slice(0, 32)}...`,
        totalPeers: this.peers.size,
        connectionIds: Array.from(this.connectionIdToPeer.keys()).map(
          (id) => `${id.slice(0, 20)}...`,
        ),
      })
      return
    }

    logger.info('[NetworkingService] 🧹 Cleaning up connection', {
      connectionId: `${connectionId.slice(0, 32)}...`,
      peerPublicKey: `${peer.publicKey.slice(0, 20)}...`,
      wasInPublicKeyMap: this.publicKeyToConnection.has(peer.publicKey),
      totalPeersBefore: this.peers.size,
      totalPublicKeyConnectionsBefore: this.publicKeyToConnection.size,
    })

    // Clean up peer (which includes connection, stream, streamKind, etc.)
    this.removePeer(peer.publicKey)

    logger.debug('[NetworkingService] ✅ Connection cleanup completed', {
      connectionId: `${connectionId.slice(0, 32)}...`,
      totalPeersAfter: this.peers.size,
      totalPublicKeyConnectionsAfter: this.publicKeyToConnection.size,
    })
  }

  // biome-ignore lint/suspicious/noExplicitAny: QUIC error event type is not fully typed
  async serverErrorHandler(event: any): Promise<void> {
    logger.error('[NetworkingService] ❌ Server error received', {
      eventType: event?.type,
      eventDetail: event?.detail,
      errorMessage: event?.detail?.message,
      errorCode: event?.detail?.code,
      errorCause: event?.detail?.cause,
      fullEvent: JSON.stringify(event, null, 2),
    })
  }

  /**
   * Connect to a peer with JAMNP-S compliance
   */
  async connectToPeer(endpoint: ConnectionEndpoint): SafePromise<boolean> {
    try {
      logger.debug('Starting connectToPeer...')

      // 1. Check preferred initiator logic
      // Get the local Ed25519 public key using helper with fallback logic
      const [keyPairError, ed25519KeyPair] = getEd25519KeyPairWithFallback(
        this.configService,
        this.keyPairService || undefined,
      )
      if (keyPairError || !ed25519KeyPair) {
        return safeError(
          keyPairError ||
            new Error(
              'No validatorIndex set in configService and no KeyPairService available, cannot determine local Ed25519 key',
            ),
        )
      }
      const localEd25519Key = ed25519KeyPair.publicKey

      const shouldInitiate = shouldLocalInitiate(
        localEd25519Key,
        endpoint.publicKey,
      )

      logger.info('🎯 JAMNP-S Preferred Initiator Check:', {
        localKey: bytesToHex(localEd25519Key),
        remoteKey: bytesToHex(endpoint.publicKey),
        shouldInitiate,
        reason: shouldInitiate
          ? 'Local node is preferred initiator for this connection'
          : 'Remote node is preferred initiator - will act as server only',
      })

      if (!shouldInitiate) {
        logger.info(
          '⏳ Not preferred initiator, waiting for peer to connect to us',
          {
            localKey: bytesToHex(localEd25519Key),
            remoteKey: bytesToHex(endpoint.publicKey),
          },
        )
        // Skip client connection - peer should connect to us instead
        // TODO: wait for 5 seconds and then try to connect to the peer if it is not connected
        await new Promise((resolve) => setTimeout(resolve, 5000))
        if (this.isConnectedToPeer(bytesToHex(endpoint.publicKey))) {
          return safeResult(true)
        }
        return safeError(new Error('Not preferred initiator'))
      }

      logger.info('✅ Acting as CLIENT - preferred initiator confirmed')

      // Get the key pair for certificate generation
      const [clientKeyPairError, clientEd25519KeyPair] =
        getEd25519KeyPairWithFallback(
          this.configService,
          this.keyPairService || undefined,
        )
      if (clientKeyPairError || !clientEd25519KeyPair) {
        return safeError(
          clientKeyPairError ||
            new Error(
              'No validatorIndex set in configService and no KeyPairService available, cannot generate certificates',
            ),
        )
      }

      const clientCrypto = getClientCrypto()

      const [certificateDataError, certificateData] =
        await generateNetworkingCertificates(
          clientEd25519KeyPair,
          this.chainHash,
        )
      if (certificateDataError) {
        return safeError(
          new Error(
            `Failed to generate certificate data: ${certificateDataError.message}`,
          ),
        )
      }
      const tlsConfig = getTlsConfig(certificateData)

      logger.info('[NetworkingService] Client TLS configuration', {
        alpnProtocol: certificateData.alpnProtocol,
        applicationProtos: tlsConfig.applicationProtos,
        hasApplicationProtos: !!tlsConfig.applicationProtos,
        applicationProtosLength: tlsConfig.applicationProtos?.length ?? 0,
        endpoint: `${endpoint.host}:${endpoint.port}`,
      })

      // Use matching TLS config with certificates for mutual TLS
      const clientConfig = {
        host: endpoint.host,
        port: Math.floor(Number.parseInt(endpoint.port.toString())),
        crypto: clientCrypto,
        config: {
          ...tlsConfig, // Use same TLS config as server
          verifyPeer: true, // Must be true for verifyCallback to be called
          verifyCallback: verifyPeerCertificate,
        },
      }

      logger.info('[NetworkingService] Client config created', {
        host: clientConfig.host,
        port: clientConfig.port,
        hasConfig: !!clientConfig.config,
        configApplicationProtos: clientConfig.config.applicationProtos,
        configApplicationProtosLength:
          clientConfig.config.applicationProtos?.length ?? 0,
      })

      // Add timeout and debugging for QUICClient.createQUICClient
      const client = await QUICClient.createQUICClient(clientConfig)

      // 7. Get the QUIC connection
      const quicConnection = client.connection
      logger.debug('📡 Got QUIC connection as a client:', {
        connectionId: quicConnection.connectionId,
        connectionIdShared: quicConnection.connectionIdShared,
        hasConnectionId: !!quicConnection.connectionIdShared,
      })

      logger.debug(
        'QUIC client created, waiting for connection establishment...',
      )

      // 8. Wait for connection to be fully established
      if (!quicConnection.connectionIdShared) {
        logger.debug(
          'Connection not immediately ready, waiting for establishment...',
        )

        // Wait for connection establishment with timeout
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Connection establishment timeout'))
          }, 10000) // 10 second timeout

          const checkConnection = () => {
            if (quicConnection.connectionIdShared) {
              clearTimeout(timeout)
              resolve()
            }
          }

          // Listen for connection events
          quicConnection.addEventListener('open', checkConnection)
          quicConnection.addEventListener('connected', checkConnection)

          // Immediate check
          checkConnection()

          // Periodic check
          const interval = setInterval(() => {
            if (quicConnection.connectionIdShared) {
              clearInterval(interval)
              clearTimeout(timeout)
              resolve()
            }
          }, 100)

          setTimeout(() => clearInterval(interval), 10000)
        })

        logger.debug('✅ Connection established successfully!')
      }

      // 9. Create peer and stream (1 connection per peer, 1 stream per connection)
      const peerPublicKey = bytesToHex(endpoint.publicKey)
      const connectionId = quicConnection.connectionIdShared.toString()

      // Check if peer already exists (enforce 1 connection per peer)
      if (this.peers.has(peerPublicKey)) {
        logger.warn(
          '[NetworkingService] Rejecting additional connection - already have 1 connection per peer',
          {
            peerPublicKey: `${peerPublicKey.slice(0, 20)}...`,
            connectionId: `${connectionId.slice(0, 20)}...`,
            reason: 'Only 1 connection per peer is allowed',
          },
        )
        return safeResult(true)
      }

      // Create peer object (as client/initiator)
      const peer = new Peer(
        connectionId,
        peerPublicKey,
        quicConnection,
        endpoint,
        true,
      )
      this.setPeer(peer)

      // As client (initiator), create the first stream
      const stream = quicConnection.newStream('bidi')
      peer.addStream(stream)

      logger.info(
        '[NetworkingService] New peer created (client/initiator, stream created)',
        {
          peerPublicKey: `${peerPublicKey.slice(0, 20)}...`,
          connectionId: `${connectionId.slice(0, 20)}...`,
        },
      )

      // Set up data listener on the stream
      this.setupStreamDataListener(stream, peerPublicKey)

      // Listen for EventQUICConnectionStream in case remote creates additional streams
      quicConnection.addEventListener(
        'EventQUICConnectionStream',
        async (streamEvent: events.EventQUICConnectionStream) => {
          if (!streamEvent.detail) {
            return
          }

          const remoteStream = streamEvent.detail

          // Accept all streams from remote
          peer.addStream(remoteStream)
          logger.info(
            '[NetworkingService] Additional stream received from remote on client connection',
            {
              peerPublicKey: `${peerPublicKey.slice(0, 20)}...`,
              connectionId: `${connectionId.slice(0, 20)}...`,
              totalStreams: peer.streams.size,
            },
          )
          this.setupStreamDataListener(remoteStream, peerPublicKey)
        },
      )

      return safeResult(true)
    } catch (error) {
      logger.error('Failed to connect to peer with JAMNP-S compliance', {
        error,
        endpoint: {
          host: endpoint.host,
          port: endpoint.port.toString(),
          publicKey: bytesToHex(endpoint.publicKey),
        },
      })
      throw error
    }
  }

  public isConnectedToPeer(publicKey: Hex): boolean {
    return this.peers.has(publicKey)
  }

  /**
   * Close a connection
   */
  async closeConnection(publicKey: Hex): SafePromise<boolean> {
    const peer = this.getPeer(publicKey)
    if (!peer) {
      return safeError(new Error(`Connection ${publicKey} not found`))
    }

    try {
      // Close the QUIC connection
      await peer.connection.stop({ isApp: true })
    } catch (error) {
      logger.error(`Failed to close connection ${publicKey}:`, error)
    } finally {
      // Clean up peer (which includes connection, stream, streamKind, etc.)
      this.removePeer(publicKey)
    }

    return safeResult(true)
  }
}
