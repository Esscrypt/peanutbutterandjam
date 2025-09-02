/**
 * @pbnj/telemetry - JIP-3 Telemetry Package
 *
 * This package provides a complete implementation of JIP-3 telemetry for JAM nodes,
 * including message encoding, client connection management, and event emission.
 *
 * JIP-3 specifies the telemetry protocol for JAM nodes to integrate with JAM Tart
 * (Testing, Analytics and Research Telemetry).
 */

import type { TelemetryConfig } from '@pbnj/types'
import { TelemetryClient } from './client'
import { TelemetryEventEmitter } from './events'

export * from './client'
export * from './encoder'
export * from './events'

/**
 * Create a telemetry system with client and event emitter
 */
export function createTelemetrySystem(config: TelemetryConfig) {
  const client = new TelemetryClient(config)
  const events = new TelemetryEventEmitter(client)

  return {
    client,
    events,
    async start() {
      await client.init()
      return await client.start()
    },
    async stop() {
      await client.stop()
    },
    getStats() {
      return client.getStats()
    },
  }
}

/**
 * Default telemetry configuration
 */
export const DEFAULT_TELEMETRY_CONFIG: Partial<TelemetryConfig> = {
  enabled: false,
  maxBufferSize: 1000n,
  retrySettings: {
    maxRetries: 10n,
    retryDelayMs: 5000n,
    backoffMultiplier: 2n,
  },
}
