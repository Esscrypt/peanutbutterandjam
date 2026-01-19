/**
 * Networking Service for JAM Node
 *
 * Integrates JAMNP-S networking with block authoring functionality
 */

import type { QUICConnection } from '@infisical/quic'
import { type events, QUICClient, QUICServer } from '@infisical/quic'
import type QUICStream from '@infisical/quic/dist/QUICStream'
// import type { EventAll } from '@matrixai/events'
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

import { decodeNetworkingMessage, encodeNetworkingMessage } from '@pbnjam/codec'
import type { NetworkingProtocol } from '@pbnjam/networking'
import {
  extractPublicKeyFromDERCertificate,
  generateNetworkingCertificates,
  getClientCrypto,
  getServerCrypto,
  getTlsConfig,
  shouldLocalInitiate,
  verifyPeerCertificate,
} from '@pbnjam/networking'
import type { ConnectionEndpoint, SafePromise, StreamKind } from '@pbnjam/types'
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

  // Track QUIC connections directly
  /** public key of the validator to the connection */
  private readonly connections: Map<
    string,
    { connection: QUICConnection; publicKey: Hex }
  > = new Map()
  publicKeyToConnection: Map<Hex, QUICConnection> = new Map()
  /** public key of the validator to the stream */
  private readonly streams: Map<Hex, QUICStream> = new Map()

  private server: QUICServer | null = null

  private validatorSetManagerService: ValidatorSetManager | null = null
  private clockService: ClockService | null = null
  private recentHistoryService: RecentHistoryService | null = null
  private eventBusService: EventBusService | null = null
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
  }) {
    super('networking-service')
    this.keyPairService = options.keyPairService || null
    this.chainHash = options.chainHash
    this.protocolRegistry = options.protocolRegistry
    this.configService = options.configService
    this.validatorIndex = options.validatorIndex
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

  setEventBusService(eventBusService: EventBusService): void {
    this.eventBusService = eventBusService
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

    logger.info('[NetworkingService] Server TLS configuration', {
      alpnProtocol: certificateData.alpnProtocol,
      chainHash: this.chainHash,
      chainHashPrefix: this.chainHash.startsWith('0x')
        ? this.chainHash.slice(2, 10)
        : this.chainHash.slice(0, 8),
    })

    const tlsConfig = getTlsConfig(certificateData)

    logger.info('[NetworkingService] Server TLS config created', {
      applicationProtos: tlsConfig.applicationProtos,
      applicationProtosLength: tlsConfig.applicationProtos?.length ?? 0,
      hasApplicationProtos: !!tlsConfig.applicationProtos,
    })

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

    // Start periodic status logging every 2 seconds
    this.startStatusLogging()

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
    const peerCount = this.publicKeyToConnection.size
    let validatorCount = 0

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
      for (const peerPublicKey of this.publicKeyToConnection.keys()) {
        if (validatorPublicKeys.has(peerPublicKey)) {
          validatorCount++
        }
      }
    }

    // Log in the format: "Net status: X peers (Y vals)"
    logger.info(`Net status: ${peerCount} peers (${validatorCount} vals)`)
  }

  async stop(): SafePromise<boolean> {
    super.stop()

    // Clear status logging interval
    if (this.statusInterval) {
      clearInterval(this.statusInterval)
      this.statusInterval = null
    }

    // Remove slot change listener
    if (this.eventBusService) {
      this.eventBusService.removeSlotChangeCallback(
        this.handleSlotChange.bind(this),
      )
    }

    if (!this.server) {
      return safeError(new Error('Server not initialized'))
    }
    await this.server.stop({ isApp: true })
    return safeResult(true)
  }

  /**
   * Handle slot change events to check peer connectivity conditions
   * Conditions:
   * 1. First block in the epoch has been finalized
   * 2. max(⌊E/30⌋,1) slots have elapsed since the beginning of the epoch
   */
  private async handleSlotChange(event: {
    slot: bigint
    epoch: bigint
    isEpochTransition: boolean
  }): Promise<void> {
    if (
      !this.clockService ||
      !this.recentHistoryService ||
      !this.validatorSetManagerService
    ) {
      return
    }

    // Track epoch start on epoch transition
    if (event.isEpochTransition) {
      this.epochStartSlot = event.slot
      this.hasConnectedThisEpoch = false
      logger.info('[NetworkingService] Epoch transition detected', {
        epoch: event.epoch.toString(),
        epochStartSlot: this.epochStartSlot.toString(),
      })
      return
    }

    // Skip if we've already connected this epoch
    if (this.hasConnectedThisEpoch) {
      return
    }

    // Skip if we don't have an epoch start slot yet
    if (this.epochStartSlot === null) {
      // Initialize with current slot if we haven't tracked epoch start yet
      const currentEpoch = this.clockService.getCurrentEpoch()
      const epochDuration = BigInt(this.configService.epochDuration)
      this.epochStartSlot = currentEpoch * epochDuration
    }

    // Calculate required delay: max(⌊E/30⌋,1) slots
    const epochDuration = this.configService.epochDuration
    const requiredDelaySlots = Math.max(Math.floor(epochDuration / 30), 1)
    const slotsSinceEpochStart = Number(event.slot - this.epochStartSlot)

    // Check condition 2: max(⌊E/30⌋,1) slots have elapsed
    if (slotsSinceEpochStart < requiredDelaySlots) {
      return
    }

    // Check condition 1: First block in epoch has been finalized
    // The first block in the epoch would be at epochStartSlot
    // We consider it finalized if the oldest finalized block is at or before epochStartSlot
    const recentHistory = this.recentHistoryService.getRecentHistory()
    if (recentHistory.length === 0) {
      return
    }

    // The oldest block in recent history is considered finalized
    // Calculate the slot of the oldest finalized block
    const currentSlot = this.clockService.getCurrentSlot()
    const oldestBlockSlot = currentSlot - BigInt(recentHistory.length - 1)

    // Check if the first block in epoch (epochStartSlot) has been finalized
    // The first block in epoch is finalized if oldestBlockSlot <= epochStartSlot
    // This means we've finalized at least up to (and including) the epoch start slot
    const firstBlockInEpochFinalized = oldestBlockSlot <= this.epochStartSlot

    if (!firstBlockInEpochFinalized) {
      logger.debug(
        '[NetworkingService] First block in epoch not yet finalized',
        {
          epochStartSlot: this.epochStartSlot.toString(),
          oldestBlockSlot: oldestBlockSlot.toString(),
          currentSlot: currentSlot.toString(),
        },
      )
      return
    }

    // Both conditions met - connect to peers from active set
    logger.info('[NetworkingService] Conditions met for peer connectivity', {
      epochStartSlot: this.epochStartSlot.toString(),
      slotsSinceEpochStart,
      requiredDelaySlots,
      firstBlockFinalized: true,
    })

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
    // Encode message using JAMNP-S format
    const [encodeError, encodedMessage] = encodeNetworkingMessage(
      kindByte,
      message,
    )
    if (encodeError) {
      logger.error('❌ Failed to encode networking message', {
        publicKey: publicKey,
        error: encodeError.message,
      })
      return safeError(encodeError)
    }

    logger.info('📦 Encoded networking message', {
      originalMessageSize: message.length,
      messageSize: encodedMessage.messageSize,
      encodedSize: encodedMessage.encoded.length,
      kindByte,
    })

    const stream = this.streams.get(publicKey)
    if (!stream) {
      logger.error('❌ No stream found for validator', {
        publicKey: publicKey,
        streamsCount: this.streams.size,
        availableStreams: Array.from(this.streams.keys()),
      })
      return safeError(
        new Error(`Validator ${publicKey} not found in streams map`),
      )
    }

    logger.info('🔄 Found stream for validator', {
      publicKey: publicKey,
      streamReadable: !!stream.readable,
      streamWritable: !!stream.writable,
    })

    const writer = stream.writable.getWriter()
    try {
      logger.info('📝 Writing encoded message to stream...', {
        kindByte,
        originalMessageSize: message.length,
        messageSize: encodedMessage.messageSize,
        messagePreview: `${bytesToHex(message.slice(0, Math.min(16, message.length)))}...`,
        encodedSize: encodedMessage.encoded.length,
      })
      await writer.write(encodedMessage.encoded)

      logger.info('✅ Message successfully written to stream', {
        publicKey: publicKey,
        messageSize: message.length,
      })
    } finally {
      writer.releaseLock()
    }
    return safeResult(undefined)
  }

  /**
   * Handle incoming QUIC stream - reads complete message
   */
  async handleIncomingData(quicStream: QUICStream): SafePromise<number> {
    // Access connection ID safely from the stream
    const connectionId =
      // biome-ignore lint/suspicious/noExplicitAny: QUIC stream types don't expose connection property
      (quicStream as any).connection?.connectionIdShared?.toString() ||
      'unknown'
    logger.info('📨 Handling incoming QUIC stream data...', {
      connectionId: `${connectionId.slice(0, 20)}...`,
    })

    let messageData: Uint8Array
    let kindByte: StreamKind

    try {
      // Check if the stream is locked
      // biome-ignore lint/suspicious/noExplicitAny: QUIC stream readable property type is incomplete
      const isLocked = (quicStream.readable as any).locked
      if (isLocked) {
        logger.warn('⚠️ Stream is locked, cannot read data directly', {
          connectionId: `${connectionId.slice(0, 20)}...`,
        })
        // Return early - the data will be processed in setupStreamDataReading
        return safeResult(0)
      }

      const reader = quicStream.readable.getReader()
      const chunks: Uint8Array[] = []
      let totalBytes = 0

      try {
        // Read all chunks until the stream is done
        while (true) {
          const { value, done } = await reader.read()

          if (done) {
            logger.info('📖 Stream reading completed', {
              connectionId: `${connectionId.slice(0, 20)}...`,
              totalChunks: chunks.length,
              totalBytes,
            })
            break
          }

          if (value) {
            chunks.push(value)
            totalBytes += value.length
            logger.debug('📖 Read chunk from stream', {
              connectionId: `${connectionId.slice(0, 20)}...`,
              chunkSize: value.length,
              totalBytes,
            })
          }
        }
      } finally {
        reader.releaseLock()
      }

      if (chunks.length === 0) {
        logger.error('❌ No data received from stream', {
          connectionId: `${connectionId.slice(0, 20)}...`,
        })
        return safeError(new Error('No data received from stream'))
      }

      // Combine all chunks into a single message
      const completeMessage = new Uint8Array(totalBytes)
      let offset = 0
      for (const chunk of chunks) {
        completeMessage.set(chunk, offset)
        offset += chunk.length
      }

      logger.info('✅ Complete message assembled from chunks', {
        connectionId: `${connectionId.slice(0, 20)}...`,
        totalChunks: chunks.length,
        totalBytes,
        messagePreview: bytesToHex(
          completeMessage.slice(0, Math.min(32, completeMessage.length)),
        ),
      })

      // Extract kind byte and message data
      if (completeMessage.length < 1) {
        logger.error('❌ Message too short - no kind byte', {
          connectionId: `${connectionId.slice(0, 20)}...`,
          messageLength: completeMessage.length,
        })
        return safeError(new Error('Message too short - no kind byte'))
      }

      kindByte = completeMessage[0] as StreamKind
      messageData = completeMessage.slice(1)

      logger.info('✅ Message parsed successfully', {
        connectionId: `${connectionId.slice(0, 20)}...`,
        kindByte,
        messageDataLength: messageData.length,
        messageDataPreview: bytesToHex(
          messageData.slice(0, Math.min(16, messageData.length)),
        ),
      })
    } catch (error) {
      logger.error('❌ Error reading from stream:', {
        error: error instanceof Error ? error.message : String(error),
        connectionId: `${connectionId.slice(0, 20)}...`,
      })
      return safeError(new Error(`Error reading from stream: ${error}`))
    }

    // Get sender context
    const senderPublicKey = this.connections.get(connectionId)?.publicKey
    if (!senderPublicKey) {
      logger.error('❌ Failed to get sender public key', {
        connectionId: `${connectionId.slice(0, 20)}...`,
      })
      return safeError(new Error('Failed to get sender public key'))
    }

    const protocol = this.protocolRegistry.get(kindByte)
    if (!protocol) {
      logger.error('❌ Failed to get protocol', {
        connectionId: `${connectionId.slice(0, 20)}...`,
        kindByte,
      })
      return safeError(new Error('Failed to get protocol'))
    }

    logger.info('🔄 Processing message with protocol', {
      connectionId: `${connectionId.slice(0, 20)}...`,
      kindByte,
      protocolName: protocol.constructor.name,
      messageDataLength: messageData.length,
    })

    // Use event-driven approach - non-blocking
    // This is a RESPONSE to our request
    const [parseError, event] = protocol.handleStreamData(
      messageData,
      senderPublicKey,
      'response', // Explicitly mark as response
    )
    if (parseError) {
      logger.error('❌ Failed to parse response message', {
        connectionId: `${connectionId.slice(0, 20)}...`,
        kindByte,
        error: parseError.message,
      })
      return safeError(parseError)
    }

    logger.info('✅ Response message parsed and event emitted', {
      connectionId: `${connectionId.slice(0, 20)}...`,
      kindByte,
      messageId: event.messageId,
      timestamp: event.timestamp,
      messageType: event.messageType,
    })

    return safeResult(kindByte)
  }

  /**
   * Set up data listener on a stream to handle incoming messages
   */
  private setupStreamDataListener(
    stream: QUICStream,
    peerPublicKey: Hex,
  ): void {
    // Set up a reader to continuously read data from the stream
    const startReading = async () => {
      try {
        const reader = stream.readable.getReader()

        while (true) {
          const { value, done } = await reader.read()

          if (done) {
            logger.debug('📖 Stream reading completed', {
              peerPublicKey: `${peerPublicKey.slice(0, 20)}...`,
            })
            break
          }

          if (value) {
            logger.info('📨 Data received on stream', {
              peerPublicKey: `${peerPublicKey.slice(0, 20)}...`,
              dataSize: value.length,
              dataPreview: bytesToHex(
                value.slice(0, Math.min(16, value.length)),
              ),
            })

            // Process the incoming data directly
            await this.processIncomingStreamData(value, peerPublicKey)
          }
        }
      } catch (error) {
        // Only log errors that aren't expected during cleanup
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        if (
          !errorMessage.includes('null') &&
          !errorMessage.includes('Peer closed')
        ) {
          logger.error('❌ Unexpected error reading from stream:', {
            error: errorMessage,
            peerPublicKey: `${peerPublicKey.slice(0, 20)}...`,
          })
        } else {
          logger.debug('🔌 Stream closed (expected during cleanup)', {
            error: errorMessage,
            peerPublicKey: `${peerPublicKey.slice(0, 20)}...`,
          })
        }
      }
    }

    // Start reading in the background
    startReading().catch((error) => {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      if (
        !errorMessage.includes('null') &&
        !errorMessage.includes('Peer closed')
      ) {
        logger.error('❌ Stream reading failed:', {
          error: errorMessage,
          peerPublicKey: `${peerPublicKey.slice(0, 20)}...`,
        })
      }
    })
  }

  /**
   * Process incoming stream data according to JAMNP-S format
   * Format: [4-byte size buffer][message content with kind byte]
   */
  private async processIncomingStreamData(
    data: Uint8Array,
    peerPublicKey: Hex,
  ): Promise<void> {
    logger.info('🔄 Processing incoming stream data', {
      peerPublicKey: `${peerPublicKey.slice(0, 20)}...`,
      dataSize: data.length,
      dataPreview: bytesToHex(data.slice(0, Math.min(32, data.length))),
    })

    try {
      // Decode JAMNP-S message
      const [decodeError, decodedResult] = decodeNetworkingMessage(data)
      if (decodeError) {
        logger.error('❌ Failed to decode networking message', {
          peerPublicKey: `${peerPublicKey.slice(0, 20)}...`,
          error: decodeError.message,
          dataLength: data.length,
        })
        return
      }

      const {
        kindByte,
        messageContent: messageData,
        consumed,
      } = decodedResult.value

      logger.info('✅ JAMNP-S message decoded', {
        peerPublicKey: `${peerPublicKey.slice(0, 20)}...`,
        kindByte,
        messageDataLength: messageData.length,
        consumed,
        messageDataPreview: bytesToHex(
          messageData.slice(0, Math.min(16, messageData.length)),
        ),
      })

      // Get the protocol handler
      const protocol = this.protocolRegistry.get(kindByte)
      if (!protocol) {
        logger.error('❌ No protocol found for kind byte', {
          peerPublicKey: `${peerPublicKey.slice(0, 20)}...`,
          kindByte,
        })
        return
      }

      logger.info('🔄 Processing message with protocol', {
        peerPublicKey: `${peerPublicKey.slice(0, 20)}...`,
        kindByte,
        protocolName: protocol.constructor.name,
        messageDataLength: messageData.length,
      })

      // Use event-driven approach - non-blocking
      // This is a REQUEST coming from a peer
      const [parseError, event] = protocol.handleStreamData(
        messageData,
        peerPublicKey,
        'request', // Explicitly mark as request
      )
      if (parseError) {
        logger.error('❌ Failed to parse request message', {
          peerPublicKey: `${peerPublicKey.slice(0, 20)}...`,
          kindByte,
          error: parseError.message,
        })
        return
      }

      logger.info('✅ Request message parsed and event emitted', {
        peerPublicKey: `${peerPublicKey.slice(0, 20)}...`,
        kindByte,
        messageId: event.messageId,
        timestamp: event.timestamp,
        messageType: event.messageType,
      })
    } catch (error) {
      logger.error('❌ Error processing stream data:', {
        error: error instanceof Error ? error.message : String(error),
        peerPublicKey: `${peerPublicKey.slice(0, 20)}...`,
      })
    }
  }

  async serverConnectionHandler(
    event: events.EventQUICServerConnection,
  ): Promise<void> {
    logger.info('🎯 EVENT: EventQUICServerConnection received:', {
      eventType: event.type,
      hasDetail: !!event.detail,
      detailKeys: event.detail ? Object.keys(event.detail) : [],
      timestamp: new Date().toISOString(),
    })
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
    logger.info('🎯 EventQUICServerConnection received:', {
      eventType: event.type,
      hasDetail: !!event.detail,
      detailKeys: event.detail ? Object.keys(event.detail) : [],
      connectionId: `${connectionId.slice(0, 32)}...`,
    })

    if (this.connections.has(connectionId)) {
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
        this.connections.set(connectionId, {
          connection,
          publicKey: publicKeyHex,
        })

        // Create a bidirectional stream for server-to-client communication
        try {
          const serverStream = connection.newStream('bidi')
          this.streams.set(publicKeyHex, serverStream)

          // Set up data listener on the server stream
          this.setupStreamDataListener(serverStream, publicKeyHex)
        } catch (error) {
          logger.error('❌ Failed to create server stream:', {
            error: error instanceof Error ? error.message : String(error),
            connectionId: `${connectionId.slice(0, 20)}...`,
            peerPublicKey: `${publicKeyHex.slice(0, 20)}...`,
          })
        }
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
      // biome-ignore lint/suspicious/noExplicitAny: QUIC event types are not fully typed
      async (streamEvent: any) => {
        if (!streamEvent?.detail) {
          logger.warn('⚠️ Stream event has no detail property')
          return
        }

        const stream = streamEvent.detail
        logger.info('📡 New stream received in connection:', {
          connectionId: `${connectionId.slice(0, 20)}...`,
          streamId: stream?.id,
          streamReadable: !!stream?.readable,
          streamWritable: !!stream?.writable,
        })

        // Set up data listener on the stream to handle incoming messages
        const peerPublicKey = this.connections.get(connectionId)?.publicKey
        if (peerPublicKey) {
          this.setupStreamDataListener(stream, peerPublicKey)
        } else {
          logger.warn(
            '⚠️ No peer public key found for stream data listener setup',
            {
              connectionId: `${connectionId.slice(0, 20)}...`,
            },
          )
        }
      },
    )

    connection.addEventListener(
      'EventQUICConnectionClose',
      async (closeEvent: events.EventQUICConnectionClose) => {
        const closeConnectionId =
          connection.connectionIdShared?.toString() || connectionId
        const connectionData = this.connections.get(closeConnectionId)

        // Decode reason field if it's a Uint8Array
        let decodedReason: string | undefined
        if (closeEvent?.detail?.data?.reason instanceof Uint8Array) {
          try {
            decodedReason = new TextDecoder('utf-8').decode(
              closeEvent.detail.data.reason,
            )
          } catch {
            decodedReason = `[Failed to decode: ${closeEvent.detail.data.reason.length} bytes]`
          }
        }

        logger.info('[NetworkingService] 🔌 Connection closed', {
          connectionId: `${closeConnectionId.slice(0, 32)}...`,
          hasCloseEvent: !!closeEvent,
          closeEventType: closeEvent?.type,
          closeEventDetail: closeEvent?.detail,
          closeEventData: closeEvent?.detail?.data,
          closeEventDataErrorCode: closeEvent?.detail?.data?.errorCode,
          closeEventDataReason:
            decodedReason || closeEvent?.detail?.data?.reason,
          closeEventDataReasonRaw:
            closeEvent?.detail?.data?.reason instanceof Uint8Array
              ? Array.from(closeEvent.detail.data.reason)
              : closeEvent?.detail?.data?.reason,
          closeEventCause: closeEvent?.detail?.cause,
          closeEventTimestamp: closeEvent?.detail?.timestamp,
          hadConnectionData: !!connectionData,
          peerPublicKey: connectionData?.publicKey
            ? `${connectionData.publicKey.slice(0, 20)}...`
            : 'unknown',
          wasInConnections: this.connections.has(closeConnectionId),
          wasInPublicKeyMap: connectionData
            ? this.publicKeyToConnection.has(connectionData.publicKey)
            : false,
        })

        // Clean up all connection mappings
        if (connectionData) {
          this.publicKeyToConnection.delete(connectionData.publicKey)
        }
        this.connections.delete(closeConnectionId)
        // Clean up connection context
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
    const serverEvents = [
      'EventQUICServerConnection',
      'EventQUICServerError',
      'EventQUICSocketStarted',
      'EventQUICSocketStopped',
      'EventQUICSocketError',
      'EventQUICConnectionStart',
      'EventQUICConnectionStarted',
      'EventQUICConnectionStop',
      'EventQUICConnectionStopped',
      'EventQUICConnectionError',
      'EventQUICConnectionClose',
      'EventQUICServerStart',
    ]

    // Add debug listeners for all server events
    for (const eventName of serverEvents) {
      // biome-ignore lint/suspicious/noExplicitAny: QUIC server event types are not fully typed
      this.server?.addEventListener(eventName, (event: any) => {
        // Log connection close and error events with more detail
        if (
          eventName === 'EventQUICConnectionClose' ||
          eventName === 'EventQUICConnectionError'
        ) {
          // Decode reason field if it's a Uint8Array
          let decodedReason: string | undefined
          if (event?.detail?.data?.reason instanceof Uint8Array) {
            try {
              decodedReason = new TextDecoder('utf-8').decode(
                event.detail.data.reason,
              )
            } catch {
              decodedReason = `[Failed to decode: ${event.detail.data.reason.length} bytes]`
            }
          }

          logger.info(`[NetworkingService] 🔔 Server event: ${eventName}`, {
            hasDetail: !!event?.detail,
            detailType: typeof event?.detail,
            detailKeys: event?.detail ? Object.keys(event?.detail) : [],
            detailData: event?.detail?.data,
            detailDataErrorCode: event?.detail?.data?.errorCode,
            detailDataReason: decodedReason || event?.detail?.data?.reason,
            detailDataReasonRaw:
              event?.detail?.data?.reason instanceof Uint8Array
                ? Array.from(event.detail.data.reason)
                : event?.detail?.data?.reason,
            detailCause: event?.detail?.cause,
            detailTimestamp: event?.detail?.timestamp,
            detailMessage: event?.detail?.message,
            detailCode: event?.detail?.code,
            fullDetail: event?.detail
              ? JSON.stringify(event.detail, null, 2)
              : undefined,
          })
        } else {
          logger.debug(`[NetworkingService] 🔔 Server event: ${eventName}`, {
            hasDetail: !!event?.detail,
            detailType: typeof event?.detail,
            detailKeys: event?.detail ? Object.keys(event?.detail) : [],
          })
        }
      })
    }

    logger.info('✅ Server connection event listeners set up successfully')
  }

  private async serverConnectionCloseHandler(
    event: events.EventQUICConnectionStopped,
  ): Promise<void> {
    logger.info(
      '[NetworkingService] 🎯 EventQUICServerConnectionClose received',
      {
        eventType: event.type,
        hasDetail: !!event.detail,
        detailType: typeof event.detail,
        detailKeys: event.detail ? Object.keys(event.detail) : [],
        fullEvent: JSON.stringify(event, null, 2),
      },
    )
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
    const connectionData = this.connections.get(connectionId)
    if (!connectionData) {
      logger.warn(
        '[NetworkingService] ⚠️ Connection not found in connections map',
        {
          connectionId: `${connectionId.slice(0, 32)}...`,
          totalConnections: this.connections.size,
          connectionIds: Array.from(this.connections.keys()).map(
            (id) => `${id.slice(0, 20)}...`,
          ),
        },
      )
      return
    }

    logger.info('[NetworkingService] 🧹 Cleaning up connection', {
      connectionId: `${connectionId.slice(0, 32)}...`,
      peerPublicKey: `${connectionData.publicKey.slice(0, 20)}...`,
      wasInPublicKeyMap: this.publicKeyToConnection.has(
        connectionData.publicKey,
      ),
      totalConnectionsBefore: this.connections.size,
      totalPublicKeyConnectionsBefore: this.publicKeyToConnection.size,
    })

    this.publicKeyToConnection.delete(connectionData.publicKey)

    // Clean up connection mappings
    this.connections.delete(connectionId)

    logger.debug('[NetworkingService] ✅ Connection cleanup completed', {
      connectionId: `${connectionId.slice(0, 32)}...`,
      totalConnectionsAfter: this.connections.size,
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
        if (this.publicKeyToConnection.has(bytesToHex(endpoint.publicKey))) {
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

      // 9. Create bidirectional stream for communication
      const stream = quicConnection.newStream('bidi')
      this.streams.set(bytesToHex(endpoint.publicKey), stream)

      // Set up data listener on the stream to handle incoming messages
      this.setupStreamDataListener(stream, bytesToHex(endpoint.publicKey))

      logger.debug('✅ Bidirectional stream created and stored')

      // 10. Store connection
      this.connections.set(quicConnection.connectionIdShared.toString(), {
        connection: quicConnection,
        publicKey: bytesToHex(endpoint.publicKey),
      })

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
    return this.publicKeyToConnection.has(publicKey)
  }

  /**
   * Close a connection
   */
  async closeConnection(publicKey: Hex): SafePromise<boolean> {
    const connection = this.publicKeyToConnection.get(publicKey)
    if (!connection) {
      return safeError(new Error(`Connection ${publicKey} not found`))
    }

    try {
      // Close the QUIC connection if available
      if (connection) {
        await connection.stop({ isApp: true })
      }
    } catch (error) {
      logger.error(`Failed to close connection ${publicKey}:`, error)
    } finally {
      this.publicKeyToConnection.delete(publicKey)
      this.connections.delete(connection.connectionIdShared.toString())
    }

    return safeResult(true)
  }
}
