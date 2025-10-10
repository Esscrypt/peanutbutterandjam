/**
 * AuthPool Serialization Tests
 *
 * Tests for Gray Paper compliant authpool encoding/decoding
 */

import { describe, it, expect } from 'vitest'
import type { AuthPool } from '@pbnj/types'
import { encodeAuthpool, decodeAuthpool } from '../state/authpool'
import { ConfigService } from '../../../../infra/node/services/config-service'

// Mock config service for testing
const mockConfigService = new ConfigService('tiny')

describe('AuthPool Serialization', () => {
  it('should encode and decode authpool with empty authorizations', () => {
    const authpool: AuthPool = {
      authorizations: [],
      coreAssignments: new Map(),
    }

    const [encodeError, encoded] = encodeAuthpool(authpool, mockConfigService)
    if (encodeError) {
      throw encodeError
    }

    const [decodeError, decoded] = decodeAuthpool(encoded, mockConfigService)
    if (decodeError) {
      throw decodeError
    }

    expect(decoded.value.authorizations).toEqual([])
    expect(decoded.value.coreAssignments.size).toBe(0)
  })

  it('should encode and decode authpool with authorizations', () => {
    const authpool: AuthPool = {
      authorizations: [
        '0x1111111111111111111111111111111111111111111111111111111111111111',
        '0x2222222222222222222222222222222222222222222222222222222222222222',
      ],
      coreAssignments: new Map([
        [0n, 0n], // First auth assigned to core 0
        [1n, 1n], // Second auth assigned to core 1
      ]),
    }

    const [encodeError, encoded] = encodeAuthpool(authpool, mockConfigService)
    if (encodeError) {
      throw encodeError
    }

    const [decodeError, decoded] = decodeAuthpool(encoded, mockConfigService)
    if (decodeError) {
      throw decodeError
    }

    expect(decoded.value.authorizations).toEqual(authpool.authorizations)
    expect(decoded.value.coreAssignments.get(0n)).toBe(0n)
    expect(decoded.value.coreAssignments.get(1n)).toBe(1n)
  })

  it('should handle round-robin assignment when no core assignments specified', () => {
    const authpool: AuthPool = {
      authorizations: [
        '0x1111111111111111111111111111111111111111111111111111111111111111',
        '0x2222222222222222222222222222222222222222222222222222222222222222',
        '0x3333333333333333333333333333333333333333333333333333333333333333',
      ],
      coreAssignments: new Map(), // No specific assignments
    }

    const [encodeError, encoded] = encodeAuthpool(authpool, mockConfigService)
    if (encodeError) {
      throw encodeError
    }

    const [decodeError, decoded] = decodeAuthpool(encoded, mockConfigService)
    if (decodeError) {
      throw decodeError
    }

    expect(decoded.value.authorizations).toEqual(expect.arrayContaining(authpool.authorizations))
    expect(decoded.value.authorizations).toHaveLength(authpool.authorizations.length)
    // All authorizations should be assigned to valid cores
    for (let i = 0; i < decoded.value.authorizations.length; i++) {
      const coreAssignment = decoded.value.coreAssignments.get(BigInt(i))
      expect(coreAssignment).toBeGreaterThanOrEqual(0n)
      expect(coreAssignment).toBeLessThan(2n) // tiny config has 2 cores
    }
  })
})
