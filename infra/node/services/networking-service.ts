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
import { bytesToHex, type Hex, logger } from '@pbnjam/core'

// Configure Ed25519 with SHA-512
ed.hashes.sha512 = (...m) => sha512(ed.etc.concatBytes(...m))

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
import type { KeyPairService } from './keypair-service'
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
  private readonly listenAddress: string
  private readonly listenPort: number
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
  private readonly keyPairService: KeyPairService
  private readonly chainHash: string

  constructor(options: {
    listenAddress: string
    listenPort: number
    protocolRegistry: Map<StreamKind, NetworkingProtocol<unknown, unknown>>
    keyPairService: KeyPairService
    chainHash: string
  }) {
    super('networking-service')
    this.listenAddress = options.listenAddress
    this.listenPort = options.listenPort
    this.keyPairService = options.keyPairService
    this.chainHash = options.chainHash
    this.protocolRegistry = options.protocolRegistry
    // Convert PEM to raw private key bytes
  }

  setValidatorSetManager(validatorSetManager: ValidatorSetManager): void {
    this.validatorSetManagerService = validatorSetManager
  }

  async init(): SafePromise<boolean> {
    if (this.server) {
      return safeResult(true)
    }
    const privateKey =
      this.keyPairService.getLocalKeyPair().ed25519KeyPair.privateKey
    const localKeyPair = this.keyPairService.getLocalKeyPair()
    const serverCrypto = getServerCrypto(privateKey)

    const [certificateDataError, certificateData] =
      await generateNetworkingCertificates(
        localKeyPair.ed25519KeyPair,
        this.chainHash.slice(0, 8),
      )
    if (certificateDataError) {
      throw new Error('Failed to generate certificate data')
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
    this.setupServerConnectionOverride()

    await this.server.start({ host: this.listenAddress, port: this.listenPort })

    return safeResult(true)
  }

  async stop(): SafePromise<boolean> {
    super.stop()
    if (!this.server) {
      return safeError(new Error('Server not initialized'))
    }
    await this.server.stop({ isApp: true })
    return safeResult(true)
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
    // Add kind byte to message content
    const messageWithKind = new Uint8Array(1 + message.length)
    messageWithKind[0] = kindByte
    messageWithKind.set(message, 1)

    // Create size buffer (32-bit little-endian) for the complete message
    const sizeBuffer = new ArrayBuffer(4)
    const sizeView = new DataView(sizeBuffer)
    sizeView.setUint32(0, messageWithKind.length, true) // little-endian

    logger.info('📦 Created size buffer for message', {
      originalMessageSize: message.length,
      messageWithKindSize: messageWithKind.length,
      sizeBufferHex: bytesToHex(new Uint8Array(sizeBuffer)),
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
      // Combine size buffer and message content into a single write
      const combinedMessage = new Uint8Array(
        sizeBuffer.byteLength + messageWithKind.length,
      )
      combinedMessage.set(new Uint8Array(sizeBuffer), 0)
      combinedMessage.set(messageWithKind, sizeBuffer.byteLength)

      logger.info('📝 Writing combined message to stream...', {
        sizeBuffer: bytesToHex(new Uint8Array(sizeBuffer)),
        kindByte,
        originalMessageSize: message.length,
        messageWithKindSize: messageWithKind.length,
        messagePreview: `${bytesToHex(message.slice(0, Math.min(16, message.length)))}...`,
        combinedSize: combinedMessage.length,
      })
      await writer.write(combinedMessage)

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
      (quicStream as any).connection?.connectionIdShared?.toString() ||
      'unknown'
    logger.info('📨 Handling incoming QUIC stream data...', {
      connectionId: `${connectionId.slice(0, 20)}...`,
    })

    let messageData: Uint8Array
    let kindByte: StreamKind

    try {
      // Check if the stream is locked
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
    logger.info('🔗 Setting up data listener on stream', {
      peerPublicKey: `${peerPublicKey.slice(0, 20)}...`,
    })

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
      // JAMNP-S format: [4-byte size buffer][message content]
      if (data.length < 5) {
        logger.error('❌ Data too short for JAMNP-S format', {
          peerPublicKey: `${peerPublicKey.slice(0, 20)}...`,
          dataLength: data.length,
          expectedMinLength: 5,
        })
        return
      }

      // Extract size buffer (first 4 bytes, little-endian)
      const sizeBuffer = data.slice(0, 4)
      const messageSize = new DataView(
        sizeBuffer.buffer,
        sizeBuffer.byteOffset,
      ).getUint32(0, true)

      // Extract message content (remaining bytes)
      const messageContent = data.slice(4)

      logger.info('✅ JAMNP-S message parsed', {
        peerPublicKey: `${peerPublicKey.slice(0, 20)}...`,
        sizeBuffer: bytesToHex(sizeBuffer),
        expectedMessageSize: messageSize,
        actualMessageSize: messageContent.length,
        messageContentPreview: bytesToHex(
          messageContent.slice(0, Math.min(16, messageContent.length)),
        ),
      })

      // Verify message size matches
      if (messageContent.length !== messageSize) {
        logger.error('❌ Message size mismatch', {
          peerPublicKey: `${peerPublicKey.slice(0, 20)}...`,
          expectedSize: messageSize,
          actualSize: messageContent.length,
        })
        return
      }

      // Extract kind byte from message content (not from size buffer)
      if (messageContent.length < 1) {
        logger.error('❌ Message content too short - no kind byte', {
          peerPublicKey: `${peerPublicKey.slice(0, 20)}...`,
          messageContentLength: messageContent.length,
        })
        return
      }

      const kindByte = messageContent[0] as StreamKind
      const messageData = messageContent.slice(1)

      logger.info('✅ Message parsed from stream data', {
        peerPublicKey: `${peerPublicKey.slice(0, 20)}...`,
        kindByte,
        messageDataLength: messageData.length,
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
    const certDERs = (connection as any).certDERs
    if (certDERs && certDERs.length > 0) {
      const [extractError, peerPublicKey] = extractPublicKeyFromDERCertificate(
        certDERs[0],
      )

      if (!extractError && peerPublicKey) {
        const publicKeyHex = bytesToHex(peerPublicKey)
        logger.info('✅ Successfully extracted public key:', {
          connectionId: `${connectionId.slice(0, 20)}...`,
          extractedKey: publicKeyHex,
          keyLength: peerPublicKey.length,
        })

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

          logger.info('✅ Created server stream for peer communication', {
            connectionId: `${connectionId.slice(0, 20)}...`,
            peerPublicKey: `${publicKeyHex.slice(0, 20)}...`,
            streamId: (serverStream as any).id || 'unknown',
          })
        } catch (error) {
          logger.error('❌ Failed to create server stream:', {
            error: error instanceof Error ? error.message : String(error),
            connectionId: `${connectionId.slice(0, 20)}...`,
            peerPublicKey: `${publicKeyHex.slice(0, 20)}...`,
          })
        }
      } else {
        logger.error(
          '❌ Failed to extract peer public key for server role assignment:',
          {
            error: extractError,
            connectionId: `${connectionId.slice(0, 20)}...`,
          },
        )
      }
    } else {
      logger.warn(
        '⚠️ No peer certificates available for server role assignment:',
        {
          connectionId: `${connectionId.slice(0, 20)}...`,
        },
      )
    }

    // Only set up essential events: stream creation and connection close

    // Set up connection events for streams and cleanup
    connection.addEventListener(
      'EventQUICConnectionStream',
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

    connection.addEventListener('EventQUICConnectionClose', async () => {
      logger.debug('🧹 Cleaning up connection mappings', {
        connectionId: `${connectionId.slice(0, 32)}...`,
      })
      // Clean up all connection mappings
      this.connections.delete(connectionId)
      // Clean up connection context
    })
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
      this.server?.addEventListener(eventName, (event: any) => {
        logger.debug(`🔔 Server event received: ${eventName}`, {
          hasDetail: !!event?.detail,
          detailType: typeof event?.detail,
          detailKeys: event?.detail ? Object.keys(event?.detail) : [],
        })
      })
    }

    logger.info('✅ Server connection event listeners set up successfully')
  }

  private async serverConnectionCloseHandler(
    event: events.EventQUICConnectionStopped,
  ): Promise<void> {
    logger.info('🎯 EventQUICServerConnectionClose received!', {
      eventType: event.type,
      hasDetail: !!event.detail,
      detailType: typeof event.detail,
      detailKeys: event.detail ? Object.keys(event.detail) : [],
      event: JSON.stringify(event),
    })
    if (!event.detail) {
      logger.error(
        '❌[serverConnectionCloseHandler] EventQUICServerConnectionClose received with no detail',
      )
      return
    }
    // EventQUICConnectionStopped detail is the connection object itself
    const connection = event.detail as QUICConnection
    const connectionId = connection.connectionIdShared?.toString()
    if (!connectionId) {
      logger.error(
        '❌[serverConnectionCloseHandler] Connection has no connectionIdShared',
      )
      return
    }
    const connectionData = this.connections.get(connectionId)
    if (!connectionData) {
      logger.error('❌[serverConnectionCloseHandler] Connection not found')
      return
    }
    this.publicKeyToConnection.delete(connectionData.publicKey)

    // Clean up connection mappings
    this.connections.delete(
      connectionData.connection.connectionIdShared.toString(),
    )
  }

  async serverErrorHandler(event: any): Promise<void> {
    logger.error('❌ Server error:', event.detail)
  }

  /**
   * Connect to a peer with JAMNP-S compliance
   */
  async connectToPeer(endpoint: ConnectionEndpoint): SafePromise<boolean> {
    try {
      logger.debug('Starting connectToPeer...')

      // 1. Check preferred initiator logic
      const localKeyPair = this.keyPairService.getLocalKeyPair()
      if (!localKeyPair) {
        throw new Error('No local key pair available')
      }
      const localEd25519Key = localKeyPair.ed25519KeyPair.publicKey

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

      const clientCrypto = getClientCrypto()

      const [certificateDataError, certificateData] =
        await generateNetworkingCertificates(
          localKeyPair.ed25519KeyPair,
          this.chainHash.slice(0, 8),
        )
      if (certificateDataError) {
        throw new Error('Failed to generate certificate data')
      }
      const tlsConfig = getTlsConfig(certificateData)

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
