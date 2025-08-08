/**
 * QUIC Stream Management for JAMNP-S
 *
 * Provides bidirectional QUIC stream creation and message framing
 */

import type { Bytes, StreamKind } from '@pbnj/types'
import type { QUICStream } from '@infisical/quic'

/**
 * Stream state
 */
export enum StreamState {
  INITIAL = 'initial',
  OPEN = 'open',
  CLOSING = 'closing',
  CLOSED = 'closed',
  ERROR = 'error',
}

/**
 * Stream information
 * JAMNP-S specification requires all streams to be bidirectional
 */
export interface StreamInfo {
  /** Stream ID */
  id: string
  /** Stream kind */
  kind: StreamKind
  /** Stream state */
  state: StreamState
  /** Connection ID */
  connectionId: string
  /** Is initiator */
  isInitiator: boolean
  /** Creation time */
  createdAt: number
  /** Last activity time */
  lastActivity: number
  /** Error message (if any) */
  error?: string
  /** QUIC stream reference (for active streams) */
  quicStream?: QUICStream
  /** Stream is bidirectional (always true for JAMNP-S) */
  isBidirectional: boolean
}

/**
 * Message frame for JAMNP-S
 */
export interface MessageFrame {
  /** Message length (32-bit little-endian) */
  length: number
  /** Message content */
  content: Bytes
}

/**
 * QUIC stream manager
 */
export class QuicStreamManager {
  private streams: Map<string, StreamInfo> = new Map()
  private streamHandlers: Map<StreamKind, (stream: StreamInfo, data: Bytes) => void> = new Map()

  constructor() {}

  /**
   * Register stream handler for a specific stream kind
   */
  registerStreamHandler(
    kind: StreamKind,
    handler: (stream: StreamInfo, data: Bytes) => void
  ): void {
    this.streamHandlers.set(kind, handler)
  }

  /**
   * Create a new stream
   */
  async createStream(
    connectionId: string,
    kind: StreamKind,
    quicStream: QUICStream,
    isInitiator: boolean = true
  ): Promise<string> {
    const streamId = this.generateStreamId()
    
    const streamInfo: StreamInfo = {
      id: streamId,
      kind,
      state: StreamState.INITIAL,
      connectionId,
      isInitiator,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      quicStream, // Assign the QUICStream to the stream info
      isBidirectional: true, // JAMNP-S streams are bidirectional
    }

    this.streams.set(streamId, streamInfo)

    // Send stream kind byte if we're the initiator
    if (isInitiator) {
      await this.sendStreamKind(streamId, kind)
    }

    // Set up event handlers for the stream
    this.setupStreamEventHandlers(streamId, quicStream)

    return streamId
  }

  /**
   * Handle incoming stream
   */
  async handleIncomingStream(
    connectionId: string,
    quicStream: QUICStream
  ): Promise<void> {
    try {
      // Read stream kind byte
      const kindByte = await this.readStreamKind(quicStream)
      const kind = kindByte as StreamKind

      // Create stream info
      const streamId = this.generateStreamId()
      const streamInfo: StreamInfo = {
        id: streamId,
        kind,
        state: StreamState.OPEN,
        connectionId,
        isInitiator: false, // We're not the initiator for incoming streams
        createdAt: Date.now(),
        lastActivity: Date.now(),
        quicStream, // Store the QUICStream reference
        isBidirectional: true, // JAMNP-S streams are bidirectional
      }

      this.streams.set(streamId, streamInfo)

      // Set up event handlers for the stream
      this.setupStreamEventHandlers(streamId, quicStream)

      console.log(`Incoming stream ${streamId} established with kind ${kind}`)
    } catch (error) {
      console.error('Failed to handle incoming stream:', error)
      throw error
    }
  }

  /**
   * Send message on stream
   */
  async sendMessage(streamId: string, content: Bytes): Promise<void> {
    const streamInfo = this.streams.get(streamId)
    if (!streamInfo) {
      throw new Error(`Stream ${streamId} not found`)
    }

    if (streamInfo.state !== StreamState.OPEN) {
      throw new Error(`Stream ${streamId} is not open (state: ${streamInfo.state})`)
    }

    if (!streamInfo.quicStream) {
      throw new Error(`Stream ${streamId} has no QUIC stream available`)
    }

    // Create message frame
    const frame = this.createMessageFrame(content)

    // Send frame
    await this.sendFrame(streamId, frame)

    // Update last activity
    streamInfo.lastActivity = Date.now()
    this.streams.set(streamId, streamInfo)
  }

  /**
   * Close stream
   */
  async closeStream(streamId: string): Promise<void> {
    const streamInfo = this.streams.get(streamId)
    if (!streamInfo) {
      return
    }

    if (streamInfo.state === StreamState.CLOSED) {
      return
    }

    streamInfo.state = StreamState.CLOSING

    try {
      // Close the QUIC stream if available
      if (streamInfo.quicStream) {
        await streamInfo.quicStream.destroy()
      }
      
      streamInfo.state = StreamState.CLOSED
      console.log(`Stream ${streamId} closed`)
    } catch (error) {
      streamInfo.state = StreamState.ERROR
      streamInfo.error = error instanceof Error ? error.message : 'Unknown error'
      console.error(`Failed to close stream ${streamId}:`, error)
      throw error
    } finally {
      this.streams.set(streamId, streamInfo)
    }
  }

  /**
   * Get stream information
   */
  getStreamInfo(streamId: string): StreamInfo | undefined {
    return this.streams.get(streamId)
  }

  /**
   * Get all active streams
   */
  getActiveStreams(): StreamInfo[] {
    return Array.from(this.streams.values()).filter(
      stream => stream.state === StreamState.OPEN
    )
  }

  /**
   * Get streams by kind
   */
  getStreamsByKind(kind: StreamKind): StreamInfo[] {
    return Array.from(this.streams.values()).filter(
      stream => stream.kind === kind && stream.state === StreamState.OPEN
    )
  }

  /**
   * Create message frame
   */
  private createMessageFrame(content: Bytes): MessageFrame {
    return {
      length: content.length,
      content,
    }
  }

  /**
   * Send frame on stream
   */
  private async sendFrame(streamId: string, frame: MessageFrame): Promise<void> {
    const streamInfo = this.streams.get(streamId)
    if (!streamInfo || !streamInfo.quicStream) {
      throw new Error(`Stream ${streamId} not found or no QUIC stream available`)
    }

    // Create buffer with length prefix and content
    const lengthBuffer = new ArrayBuffer(4)
    const lengthView = new DataView(lengthBuffer)
    lengthView.setUint32(0, frame.length, true) // 32-bit little-endian

    const totalBuffer = new Uint8Array(4 + frame.content.length)
    totalBuffer.set(new Uint8Array(lengthBuffer), 0)
    totalBuffer.set(frame.content, 4)

    // Send the buffer using the QUIC stream's writable
    const writer = streamInfo.quicStream.writable.getWriter()
    try {
      await writer.write(totalBuffer)
      console.log(`Sent frame on stream ${streamId}: ${totalBuffer.length} bytes`)
    } finally {
      writer.releaseLock()
    }
  }

  /**
   * Read stream kind byte
   */
  private async readStreamKind(quicStream: QUICStream): Promise<number> {
    // Read single byte from stream to identify stream kind
    // UP stream kinds are numbered starting from 0
    // CE stream kinds are numbered starting from 128
    const reader = quicStream.readable.getReader()
    
    try {
      const { value, done } = await reader.read()
      if (done || !value || value.length === 0) {
        throw new Error('Failed to read stream kind byte')
      }
      
      // Return the first byte as the stream kind
      return value[0]
    } finally {
      reader.releaseLock()
    }
  }

  /**
   * Send stream kind byte
   */
  private async sendStreamKind(streamId: string, kind: StreamKind): Promise<void> {
    // Send single byte representing stream kind
    const streamInfo = this.streams.get(streamId)
    if (!streamInfo || !streamInfo.quicStream) {
      throw new Error(`Stream ${streamId} not found or no QUIC stream available`)
    }
    
    // Create a single byte buffer with the stream kind
    const kindBuffer = new Uint8Array([kind])
    
    // Get the writable stream and send the byte
    const writer = streamInfo.quicStream.writable.getWriter()
    try {
      await writer.write(kindBuffer)
      console.log(`Sent stream kind ${kind} on stream ${streamId}`)
    } finally {
      writer.releaseLock()
    }
  }

  /**
   * Set up stream event handlers
   */
  private setupStreamEventHandlers(streamId: string, quicStream: QUICStream): void {
    // Set up readable stream handler
    const reader = quicStream.readable.getReader()
    
    const readChunk = async () => {
      try {
        const { value, done } = await reader.read()
        if (done) {
          this.handleStreamClose(streamId)
          return
        }
        if (value) {
          this.handleStreamData(streamId, value)
        }
        // Continue reading
        readChunk()
      } catch (error) {
        this.handleStreamError(streamId, error as Error)
      }
    }
    
    // Start reading
    readChunk()
    
    // Handle stream close when the stream is destroyed
    quicStream.closedP.then(() => {
      this.handleStreamClose(streamId)
    }).catch((error) => {
      this.handleStreamError(streamId, error as Error)
    })
  }

  /**
   * Handle stream data
   */
  private handleStreamData(streamId: string, data: Bytes): void {
    const streamInfo = this.streams.get(streamId)
    if (!streamInfo) {
      return
    }

    streamInfo.lastActivity = Date.now()
    this.streams.set(streamId, streamInfo)

    // Parse message frame
    try {
      const frame = this.parseMessageFrame(data)
      
      // Handle message based on stream kind
      const handler = this.streamHandlers.get(streamInfo.kind)
      if (handler) {
        handler(streamInfo, frame.content)
      }
    } catch (error) {
      console.error(`Failed to parse message frame on stream ${streamId}:`, error)
    }
  }

  /**
   * Parse message frame
   */
  private parseMessageFrame(data: Bytes): MessageFrame {
    if (data.length < 4) {
      throw new Error('Message frame too short')
    }

    const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
    const length = view.getUint32(0, true) // 32-bit little-endian
    
    if (data.length < 4 + length) {
      throw new Error('Message frame incomplete')
    }

    const content = data.slice(4, 4 + length)

    return {
      length,
      content,
    }
  }

  /**
   * Handle stream close
   */
  private handleStreamClose(streamId: string): void {
    const streamInfo = this.streams.get(streamId)
    if (streamInfo) {
      streamInfo.state = StreamState.CLOSED
      this.streams.set(streamId, streamInfo)
    }
  }

  /**
   * Handle stream error
   */
  private handleStreamError(streamId: string, error: Error): void {
    const streamInfo = this.streams.get(streamId)
    if (streamInfo) {
      streamInfo.state = StreamState.ERROR
      streamInfo.error = error.message
      this.streams.set(streamId, streamInfo)
    }
  }

  /**
   * Generate unique stream ID
   */
  private generateStreamId(): string {
    return `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
} 