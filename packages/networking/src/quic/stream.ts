/**
 * QUIC Stream Management for JAMNP-S
 *
 * Provides bidirectional QUIC stream creation and message framing
 */

import type { QUICStream } from '@infisical/quic'
import {
  logger,
  type Safe,
  type SafePromise,
  safeError,
  safeResult,
} from '@pbnj/core'
import type { StreamHandler, StreamInfo, StreamKind } from '@pbnj/types'
import { StreamState } from '@pbnj/types'

/**
 * Message frame for JAMNP-S
 */
export interface MessageFrame {
  /** Message length (32-bit little-endian) */
  length: number
  /** Message content */
  content: Uint8Array
}

/**
 * QUIC stream manager
 */
export class QuicStreamManager {
  private streams: Map<string, StreamInfo> = new Map()
  private streamHandlers: Map<StreamKind, StreamHandler> = new Map()

  /**
   * Register stream handler for a specific stream kind
   */
  registerStreamHandler(kind: StreamKind, handler: StreamHandler): void {
    this.streamHandlers.set(kind, handler)
  }

  /**
   * Create a new stream
   */
  async createStream(
    connectionId: string,
    kind: StreamKind,
    quicStream: QUICStream,
    isInitiator = true,
  ): SafePromise<string> {
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
      const [sendStreamKindError] = await this.sendStreamKind(streamId, kind)
      if (sendStreamKindError) {
        return safeError(sendStreamKindError)
      }
    }

    // Set up event handlers for the stream
    const [setupStreamEventHandlersError] = this.setupStreamEventHandlers(
      streamId,
      quicStream,
    )
    if (setupStreamEventHandlersError) {
      return safeError(setupStreamEventHandlersError)
    }

    return safeResult(streamId)
  }

  /**
   * Handle incoming stream
   */
  async handleIncomingStream(
    connectionId: string,
    quicStream: QUICStream,
  ): SafePromise<boolean> {
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
      const [setupStreamEventHandlersError] = this.setupStreamEventHandlers(
        streamId,
        quicStream,
      )
      if (setupStreamEventHandlersError) {
        return safeError(setupStreamEventHandlersError)
      }

      logger.info(`Incoming stream ${streamId} established with kind ${kind}`)
    } catch (error) {
      return safeError(error as Error)
    }

    return safeResult(true)
  }

  /**
   * Send message on stream
   */
  async sendMessage(streamId: string, content: Uint8Array): SafePromise<void> {
    const streamInfo = this.streams.get(streamId)
    if (!streamInfo) {
      return safeError(new Error(`Stream ${streamId} not found`))
    }

    if (streamInfo.state !== StreamState.OPEN) {
      return safeError(
        new Error(
          `Stream ${streamId} is not open (state: ${streamInfo.state})`,
        ),
      )
    }

    if (!streamInfo.quicStream) {
      return safeError(
        new Error(`Stream ${streamId} has no QUIC stream available`),
      )
    }

    // Create message frame
    const frame = this.createMessageFrame(content)

    // Send frame
    const [sendFrameError] = await this.sendFrame(streamId, frame)
    if (sendFrameError) {
      return safeError(sendFrameError)
    }

    // Update last activity
    streamInfo.lastActivity = Date.now()
    this.streams.set(streamId, streamInfo)

    return safeResult(undefined)
  }

  /**
   * Close stream
   */
  async closeStream(streamId: string): SafePromise<boolean> {
    const streamInfo = this.streams.get(streamId)
    if (!streamInfo) {
      return safeError(new Error(`Stream ${streamId} not found`))
    }

    if (streamInfo.state === StreamState.CLOSED) {
      return safeResult(true)
    }

    streamInfo.state = StreamState.CLOSING

    try {
      // Close the QUIC stream if available
      if (streamInfo.quicStream) {
        await streamInfo.quicStream.destroy()
      }

      streamInfo.state = StreamState.CLOSED
      logger.info(`Stream ${streamId} closed`)
    } catch (error) {
      streamInfo.state = StreamState.ERROR
      streamInfo.error =
        error instanceof Error ? error.message : 'Unknown error'
      logger.error(`Failed to close stream ${streamId}:`, error)
      return safeError(error as Error)
    } finally {
      this.streams.set(streamId, streamInfo)
    }

    return safeResult(true)
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
      (stream) => stream.state === StreamState.OPEN,
    )
  }

  /**
   * Get streams by kind
   */
  getStreamsByKind(kind: StreamKind): StreamInfo[] {
    return Array.from(this.streams.values()).filter(
      (stream) => stream.kind === kind && stream.state === StreamState.OPEN,
    )
  }

  /**
   * Create message frame
   */
  private createMessageFrame(content: Uint8Array): MessageFrame {
    return {
      length: content.length,
      content,
    }
  }

  /**
   * Send frame on stream
   */
  private async sendFrame(
    streamId: string,
    frame: MessageFrame,
  ): SafePromise<void> {
    const streamInfo = this.streams.get(streamId)
    if (!streamInfo || !streamInfo.quicStream) {
      return safeError(
        new Error(`Stream ${streamId} not found or no QUIC stream available`),
      )
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
      logger.info(
        `Sent frame on stream ${streamId}: ${totalBuffer.length} bytes`,
      )
    } finally {
      writer.releaseLock()
    }

    return safeResult(undefined)
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
  private async sendStreamKind(
    streamId: string,
    kind: StreamKind,
  ): SafePromise<void> {
    // Send single byte representing stream kind
    const streamInfo = this.streams.get(streamId)
    if (!streamInfo || !streamInfo.quicStream) {
      return safeError(
        new Error(`Stream ${streamId} not found or no QUIC stream available`),
      )
    }

    // Create a single byte buffer with the stream kind
    const kindBuffer = new Uint8Array([kind])

    // Get the writable stream and send the byte
    const writer = streamInfo.quicStream.writable.getWriter()
    try {
      await writer.write(kindBuffer)
      logger.info(`Sent stream kind ${kind} on stream ${streamId}`)
    } finally {
      writer.releaseLock()
    }

    return safeResult(undefined)
  }

  /**
   * Set up stream event handlers
   */
  private setupStreamEventHandlers(
    streamId: string,
    quicStream: QUICStream,
  ): Safe<boolean> {
    // Set up readable stream handler
    const reader = quicStream.readable.getReader()

    const readChunk = async () => {
      try {
        const { value, done } = await reader.read()
        if (done) {
          this.handleStreamClose(streamId)
          return safeResult(true)
        }
        if (value) {
          this.handleStreamData(streamId, value)
        }
        // Continue reading
        readChunk()
      } catch (error) {
        this.handleStreamError(streamId, error as Error)
        return safeError(error as Error)
      }
    }

    // Start reading
    readChunk()

    // Handle stream close when the stream is destroyed
    quicStream.closedP
      .then(() => {
        this.handleStreamClose(streamId)
      })
      .catch((error) => {
        this.handleStreamError(streamId, error as Error)
      })

    return safeResult(true)
  }

  /**
   * Handle stream data
   */
  private handleStreamData(streamId: string, data: Uint8Array): void {
    const streamInfo = this.streams.get(streamId)
    if (!streamInfo) {
      return
    }

    streamInfo.lastActivity = Date.now()
    this.streams.set(streamId, streamInfo)

    const [frameError, frame] = this.parseMessageFrame(data)
    if (frameError) {
      logger.error(
        `Failed to parse message frame on stream ${streamId}:`,
        frameError,
      )
      return
    }

    // Handle message based on stream kind
    const handler = this.streamHandlers.get(streamInfo.kind)
    if (handler) {
      handler(streamInfo, frame?.content ?? new Uint8Array())
    }
  }

  /**
   * Parse message frame
   */
  private parseMessageFrame(data: Uint8Array): Safe<MessageFrame> {
    if (data.length < 4) {
      return safeError(new Error('Message frame too short'))
    }

    const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
    const length = view.getUint32(0, true) // 32-bit little-endian

    if (data.length < 4 + length) {
      return safeError(new Error('Message frame incomplete'))
    }

    const content = data.slice(4, 4 + length)

    return safeResult({
      length,
      content,
    })
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
