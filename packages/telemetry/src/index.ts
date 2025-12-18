/**
 * @pbnjam/telemetry - JIP-3 Telemetry Package
 *
 * This package provides a complete implementation of JIP-3 telemetry for JAM nodes,
 * including message encoding, client connection management, and event emission.
 *
 * JIP-3 specifies the telemetry protocol for JAM nodes to integrate with JAM Tart
 * (Testing, Analytics and Research Telemetry).
 */

import type { TelemetryConfig } from '@pbnjam/types'

export * from './client'
export * from './encoder'

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
