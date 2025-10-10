/**
 * Tests for dispute state serialization
 */

import { describe, expect, it } from 'vitest'
import type { Disputes } from '@pbnj/types'
import type { Hex } from '@pbnj/core'
import { decodeDisputeState, encodeDisputeState } from '../state/disputes'

describe('Dispute State Serialization', () => {
  it('should encode and decode empty disputes', () => {
    const disputes: Disputes = {
      goodSet: new Set(),
      badSet: new Set(),
      wonkySet: new Set(),
      offenders: new Set(),
    }

    const [encodeError, encoded] = encodeDisputeState(disputes)
    expect(encodeError).toBeUndefined()
    expect(encoded).toBeDefined()

    const [decodeError, decoded] = decodeDisputeState(encoded!)
    expect(decodeError).toBeUndefined()
    expect(decoded).toBeDefined()
    expect(decoded!.value).toEqual(disputes)
  })

  it('should encode and decode disputes with work-report hashes', () => {
    const disputes: Disputes = {
      goodSet: new Set([
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as Hex,
        '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890' as Hex,
      ]),
      badSet: new Set([
        '0x9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba' as Hex,
      ]),
      wonkySet: new Set([
        '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321' as Hex,
      ]),
      offenders: new Set([
        '0x1111111111111111111111111111111111111111111111111111111111111111' as Hex,
        '0x2222222222222222222222222222222222222222222222222222222222222222' as Hex,
      ]),
    }

    const [encodeError, encoded] = encodeDisputeState(disputes)
    expect(encodeError).toBeUndefined()
    expect(encoded).toBeDefined()

    const [decodeError, decoded] = decodeDisputeState(encoded!)
    expect(decodeError).toBeUndefined()
    expect(decoded).toBeDefined()
    expect(decoded!.value).toEqual(disputes)
  })

  it('should maintain deterministic ordering', () => {
    const disputes: Disputes = {
      goodSet: new Set([
        '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc' as Hex,
        '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as Hex,
        '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' as Hex,
      ]),
      badSet: new Set(),
      wonkySet: new Set(),
      offenders: new Set(),
    }

    const [encodeError1, encoded1] = encodeDisputeState(disputes)
    expect(encodeError1).toBeUndefined()

    const [encodeError2, encoded2] = encodeDisputeState(disputes)
    expect(encodeError2).toBeUndefined()

    // Multiple encodings should produce identical results
    expect(encoded1).toEqual(encoded2)
  })

  it('should handle large dispute sets', () => {
    const disputes: Disputes = {
      goodSet: new Set(),
      badSet: new Set(),
      wonkySet: new Set(),
      offenders: new Set(),
    }

    // Add many offenders
    for (let i = 0; i < 100; i++) {
      const key = `0x${i.toString(16).padStart(64, '0')}` as Hex
      disputes.offenders.add(key)
    }

    const [encodeError, encoded] = encodeDisputeState(disputes)
    expect(encodeError).toBeUndefined()
    expect(encoded).toBeDefined()

    const [decodeError, decoded] = decodeDisputeState(encoded!)
    expect(decodeError).toBeUndefined()
    expect(decoded).toBeDefined()
    expect(decoded!.value.offenders.size).toBe(100)
  })

  it('should handle round-trip with mixed content', () => {
    const disputes: Disputes = {
      goodSet: new Set([
        '0x1111111111111111111111111111111111111111111111111111111111111111' as Hex,
        '0x3333333333333333333333333333333333333333333333333333333333333333' as Hex,
      ]),
      badSet: new Set([
        '0x2222222222222222222222222222222222222222222222222222222222222222' as Hex,
      ]),
      wonkySet: new Set([
        '0x4444444444444444444444444444444444444444444444444444444444444444' as Hex,
        '0x5555555555555555555555555555555555555555555555555555555555555555' as Hex,
        '0x6666666666666666666666666666666666666666666666666666666666666666' as Hex,
      ]),
      offenders: new Set([
        '0x7777777777777777777777777777777777777777777777777777777777777777' as Hex,
      ]),
    }

    const [encodeError, encoded] = encodeDisputeState(disputes)
    expect(encodeError).toBeUndefined()
    expect(encoded).toBeDefined()

    const [decodeError, decoded] = decodeDisputeState(encoded!)
    expect(decodeError).toBeUndefined()
    expect(decoded).toBeDefined()
    expect(decoded!.value).toEqual(disputes)
  })
})
