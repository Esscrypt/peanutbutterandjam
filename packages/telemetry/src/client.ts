/**
 * JIP-3 Telemetry Client
 *
 * Handles TCP/IP connection to telemetry server and manages event transmission
 * according to JIP-3 specification.
 */

import { createConnection, type Socket } from 'node:net'
import type { SafePromise } from '@pbnj/core'
import { logger, safeError, safeResult } from '@pbnj/core'
import type { TelemetryConfig, TelemetryEvent } from '@pbnj/types'
import {
  createTelemetryMessage,
  encodeNodeInfo,
  encodeTelemetryEvent,
} from './encoder'

export interface TelemetryClientEvents {
  connected: () => void
  disconnected: (reason: string) => void
  error: (error: Error) => void
  sent: (eventId: bigint) => void
  dropped: (eventCount: number, reason: string) => void
}

/**
 * JIP-3 Telemetry Client implementation
 */
export class TelemetryClient {
  private socket: Socket | null = null
  private eventIdCounter = 0n
  private eventBuffer: TelemetryEvent[] = []
  private isConnected = false
  private reconnectTimer: NodeJS.Timeout | null = null
  private currentRetryCount = 0
  private eventListeners: Partial<TelemetryClientEvents> = {}
  private isRunning = false

  constructor(private config: TelemetryConfig) {}

  async start(): Promise<boolean> {
    try {
      if (!this.config.enabled) {
        this.isRunning = true
        return true
      }

      logger.info('Starting telemetry client...')

      await this.connect()
      this.isRunning = true

      logger.info('Telemetry client started successfully')
      return true
    } catch (error) {
      logger.error('Failed to start telemetry client', { error })
      return false
    }
  }

  async stop(): Promise<void> {
    try {
      logger.info('Stopping telemetry client...')

      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer)
        this.reconnectTimer = null
      }

      if (this.socket) {
        this.socket.destroy()
        this.socket = null
      }

      this.isConnected = false
      this.isRunning = false

      logger.info('Telemetry client stopped successfully')
    } catch (error) {
      logger.error('Error stopping telemetry client', { error })
    }
  }

  /**
   * Add event listener
   */
  on<K extends keyof TelemetryClientEvents>(
    event: K,
    listener: TelemetryClientEvents[K],
  ): void {
    this.eventListeners[event] = listener
  }

  /**
   * Remove event listener
   */
  off<K extends keyof TelemetryClientEvents>(event: K): void {
    delete this.eventListeners[event]
  }

  /**
   * Emit event to listeners
   */
  private emit<K extends keyof TelemetryClientEvents>(
    event: K,
    ...args: Parameters<NonNullable<TelemetryClientEvents[K]>>
  ): void {
    const listener = this.eventListeners[event]
    if (listener) {
      try {
        // @ts-ignore - TypeScript has trouble with the spread args
        listener(...args)
      } catch (error) {
        logger.warn('Error in telemetry event listener', { event, error })
      }
    }
  }

  /**
   * Connect to telemetry server
   */
  private async connect(): Promise<void> {
    if (!this.config.endpoint || this.isConnected) {
      return
    }

    const [host, portStr] = this.config.endpoint.split(':')
    const port = Number.parseInt(portStr, 10)

    if (!host || Number.isNaN(port)) {
      throw new Error(
        `Invalid telemetry endpoint format: ${this.config.endpoint}`,
      )
    }

    return new Promise((resolve, reject) => {
      const socket = createConnection({ host, port })

      socket.on('connect', async () => {
        logger.info('Connected to telemetry server', {
          endpoint: this.config.endpoint,
        })

        this.socket = socket
        this.isConnected = true
        this.currentRetryCount = 0

        // Send node information message first
        await this.sendNodeInfo()

        // Send any buffered events
        const [error] = await this.flushEventBuffer()
        if (error) {
          logger.error('Failed to send buffered events', { error })
          socket.destroy()
          reject(error)
          return
        }

        this.emit('connected')
        resolve()
      })

      socket.on('error', (error) => {
        logger.error('Telemetry connection error', {
          endpoint: this.config.endpoint,
          error: error.message,
        })

        this.isConnected = false
        this.socket = null

        this.emit('error', error)
        this.scheduleReconnect()

        if (!this.isConnected) {
          reject(error)
        }
      })

      socket.on('close', () => {
        logger.warn('Telemetry connection closed', {
          endpoint: this.config.endpoint,
        })

        this.isConnected = false
        this.socket = null

        this.emit('disconnected', 'Connection closed')
        this.scheduleReconnect()
      })

      socket.on('timeout', () => {
        logger.warn('Telemetry connection timeout', {
          endpoint: this.config.endpoint,
        })
        socket.destroy()
      })

      // Set connection timeout
      socket.setTimeout(30000) // 30 seconds
    })
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(): void {
    if (!this.config.enabled || !this.isRunning || this.reconnectTimer) {
      return
    }

    const retrySettings = this.config.retrySettings || {
      maxRetries: 10,
      retryDelayMs: 5000,
      backoffMultiplier: 2,
    }

    if (this.currentRetryCount >= retrySettings.maxRetries) {
      logger.error('Max telemetry reconnection attempts reached', {
        attempts: this.currentRetryCount,
      })
      return
    }

    const delay =
      BigInt(retrySettings.retryDelayMs) *
      BigInt(retrySettings.backoffMultiplier) ** BigInt(this.currentRetryCount)

    logger.info('Scheduling telemetry reconnection', {
      attempt: this.currentRetryCount + 1,
      maxRetries: retrySettings.maxRetries,
      delayMs: delay,
    })

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null
      this.currentRetryCount++

      try {
        await this.connect()
      } catch (error) {
        logger.warn('Telemetry reconnection failed', { error })
      }
    }, Number(delay))
  }

  /**
   * Send node information message
   */
  private async sendNodeInfo(): SafePromise<boolean> {
    if (!this.socket || !this.isConnected) {
      return safeError(new Error('Not connected to telemetry server'))
    }

    const [error, nodeInfoContent] = encodeNodeInfo(this.config.nodeInfo)
    if (error) {
      return safeError(error)
    }
    const [error2, message] = createTelemetryMessage(nodeInfoContent)
    if (error2) {
      return safeError(error2)
    }

    return safeResult(this.socket.write(message))
  }

  /**
   * Send telemetry event
   */
  async sendEvent(event: TelemetryEvent): SafePromise<void> {
    if (!this.config.enabled) {
      return safeError(new Error('Telemetry is disabled'))
    }

    // Add timestamp if not present
    if (!event.timestamp) {
      event.timestamp = this.getCurrentJamTimestamp()
    }

    // Check buffer limits
    const maxBufferSize = this.config.maxBufferSize || 1000
    if (this.eventBuffer.length >= maxBufferSize) {
      const droppedCount = Math.ceil(Number(maxBufferSize) * 0.1) // Drop 10% of buffer
      const droppedEvents = this.eventBuffer.splice(0, droppedCount)

      logger.warn('Telemetry event buffer overflow, dropping events', {
        droppedCount,
        bufferSize: this.eventBuffer.length,
      })

      this.emit('dropped', droppedCount, 'Buffer overflow')

      // Emit a dropped event
      const droppedEvent: TelemetryEvent = {
        eventType: 0n,
        timestamp: event.timestamp,
        lastDroppedTimestamp:
          droppedEvents[droppedEvents.length - 1]?.timestamp || event.timestamp,
        droppedEventCount: BigInt(droppedCount),
      }

      this.eventBuffer.push(droppedEvent)
    }

    if (this.isConnected && this.socket) {
      const [error] = await this.sendEventImmediately(event)
      if (error) {
        logger.warn('Failed to send event immediately, buffering', { error })
        this.eventBuffer.push(event)
      }
    } else {
      this.eventBuffer.push(event)

      // Attempt to connect if not already trying
      if (!this.reconnectTimer && this.isRunning) {
        this.scheduleReconnect()
      }
    }

    return safeResult(undefined)
  }

  /**
   * Send event immediately over socket
   */
  private async sendEventImmediately(
    event: TelemetryEvent,
  ): SafePromise<boolean> {
    if (!this.socket || !this.isConnected) {
      return safeError(new Error('Not connected to telemetry server'))
    }

    const [error, eventContent] = encodeTelemetryEvent(event)
    if (error) {
      return safeError(error)
    }
    const [error2, message] = createTelemetryMessage(eventContent)
    if (error2) {
      return safeError(error2)
    }

    return safeResult(this.socket.write(message))
  }

  /**
   * Flush buffered events
   */
  private async flushEventBuffer(): SafePromise<void> {
    if (!this.isConnected || this.eventBuffer.length === 0) {
      return safeError(
        new Error('Not connected to telemetry server or no events to flush'),
      )
    }

    const events = [...this.eventBuffer]
    this.eventBuffer = []

    for (const event of events) {
      const [error] = await this.sendEventImmediately(event)
      if (error) {
        logger.warn('Failed to send buffered event', { error })
        // Put failed events back in buffer
        this.eventBuffer.unshift(event)
        break
      }
    }

    return safeResult(undefined)
  }

  /**
   * Get current JAM timestamp (microseconds since JAM Common Era)
   */
  private getCurrentJamTimestamp(): bigint {
    // JAM Common Era starts at Unix timestamp 1609459200 (2021-01-01 00:00:00 UTC)
    const jamEpochStart = 1609459200n * 1000000n // Convert to microseconds
    const currentMicros = BigInt(Date.now()) * 1000n // Convert ms to microseconds
    return currentMicros - jamEpochStart
  }

  /**
   * Get next event ID
   */
  getNextEventId(): bigint {
    return this.eventIdCounter++
  }

  /**
   * Get current connection status
   */
  isConnectedToServer(): boolean {
    return this.isConnected
  }

  /**
   * Get buffered event count
   */
  getBufferedEventCount(): number {
    return this.eventBuffer.length
  }

  /**
   * Get telemetry statistics
   */
  getStats(): {
    isConnected: boolean
    bufferedEvents: number
    eventsSent: number
    retryCount: number
  } {
    return {
      isConnected: this.isConnected,
      bufferedEvents: this.eventBuffer.length,
      eventsSent: Number(this.eventIdCounter),
      retryCount: this.currentRetryCount,
    }
  }
}
