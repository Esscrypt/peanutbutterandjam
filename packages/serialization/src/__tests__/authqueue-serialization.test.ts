import { describe, expect, it } from 'vitest'
import type { AuthQueue } from '@pbnj/types'
import { decodeAuthqueue, encodeAuthqueue } from '../state/authqueue'
import { ConfigService } from '../../../../infra/node/services/config-service'

// Mock config service
const mockConfigService = new ConfigService('tiny')

describe('AuthQueue Serialization', () => {
  const mockAuthQueue: AuthQueue = {
    queue: new Map([
      [0n, ['0x1111111111111111111111111111111111111111111111111111111111111111']],
      [1n, [
        '0x2222222222222222222222222222222222222222222222222222222222222222',
        '0x3333333333333333333333333333333333333333333333333333333333333333',
      ]],
      [2n, ['0x4444444444444444444444444444444444444444444444444444444444444444']],
    ]),
    processingIndex: 0n,
  }

  const mockAuthQueueEmpty: AuthQueue = {
    queue: new Map(),
    processingIndex: 0n,
  }

  it('should encode and decode authqueue with all fields', () => {
    const [encodeError, encoded] = encodeAuthqueue(mockAuthQueue, mockConfigService)
    expect(encodeError).toBeUndefined()
    expect(encoded).toBeDefined()

    const [decodeError, decoded] = decodeAuthqueue(encoded!, mockConfigService)
    expect(decodeError).toBeUndefined()
    expect(decoded).toBeDefined()

    // Verify the decoded structure
    expect(decoded!.value.queue.size).toBe(3) // 3 cores have authorizations
    expect(decoded!.value.processingIndex).toBe(0n)

    // Verify core 0
    const core0Auths = decoded!.value.queue.get(0n)
    expect(core0Auths).toBeDefined()
    expect(core0Auths!.length).toBe(1)
    expect(core0Auths![0]).toBe('0x1111111111111111111111111111111111111111111111111111111111111111')

    // Verify core 1
    const core1Auths = decoded!.value.queue.get(1n)
    expect(core1Auths).toBeDefined()
    expect(core1Auths!.length).toBe(2)
    expect(core1Auths![0]).toBe('0x2222222222222222222222222222222222222222222222222222222222222222')
    expect(core1Auths![1]).toBe('0x3333333333333333333333333333333333333333333333333333333333333333')

    // Verify core 2
    const core2Auths = decoded!.value.queue.get(2n)
    expect(core2Auths).toBeDefined()
    expect(core2Auths!.length).toBe(1)
    expect(core2Auths![0]).toBe('0x4444444444444444444444444444444444444444444444444444444444444444')

    // Core 3 should not exist (empty)
    expect(decoded!.value.queue.has(3n)).toBe(false)
  })

  it('should encode and decode empty authqueue', () => {
    const [encodeError, encoded] = encodeAuthqueue(mockAuthQueueEmpty, mockConfigService)
    expect(encodeError).toBeUndefined()
    expect(encoded).toBeDefined()

    const [decodeError, decoded] = decodeAuthqueue(encoded!, mockConfigService)
    expect(decodeError).toBeUndefined()
    expect(decoded).toBeDefined()

    expect(decoded!.value.queue.size).toBe(0)
    expect(decoded!.value.processingIndex).toBe(0n)
  })

  it('should handle realistic authorization values', () => {
    const realisticAuthQueue: AuthQueue = {
      queue: new Map([
        [0n, [
          '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
          '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
        ]],
        [3n, ['0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef']],
      ]),
      processingIndex: 5n,
    }

    const [encodeError, encoded] = encodeAuthqueue(realisticAuthQueue, mockConfigService)
    expect(encodeError).toBeUndefined()

    const [decodeError, decoded] = decodeAuthqueue(encoded!, mockConfigService)
    expect(decodeError).toBeUndefined()

    expect(decoded!.value.queue.size).toBe(2)
    expect(decoded!.value.queue.get(0n)!.length).toBe(2)
    expect(decoded!.value.queue.get(3n)!.length).toBe(1)
  })

  it('should fail with insufficient data', () => {
    const insufficientData = new Uint8Array(10) // Less than required

    const [decodeError, decoded] = decodeAuthqueue(insufficientData, mockConfigService)
    expect(decodeError).toBeDefined()
    expect(decoded).toBeUndefined()
  })

  it('should handle cores with maximum authorizations', () => {
    // Create a core with exactly 80 authorizations (C_authqueuesize)
    const maxAuths: string[] = []
    for (let i = 1; i <= 80; i++) { // Start from 1 to avoid zero hash
      const hash = `0x${i.toString(16).padStart(64, '0')}`
      maxAuths.push(hash)
    }

    const maxAuthQueue: AuthQueue = {
      queue: new Map([[0n, maxAuths as `0x${string}`[]]]),
      processingIndex: 0n,
    }

    const [encodeError, encoded] = encodeAuthqueue(maxAuthQueue, mockConfigService)
    expect(encodeError).toBeUndefined()

    const [decodeError, decoded] = decodeAuthqueue(encoded!, mockConfigService)
    expect(decodeError).toBeUndefined()

    expect(decoded!.value.queue.get(0n)!.length).toBe(80)
  })

  it('should truncate authorizations beyond C_authqueuesize', () => {
    // Create a core with more than 80 authorizations
    const tooManyAuths: string[] = []
    for (let i = 1; i <= 100; i++) { // Start from 1 to avoid zero hash
      const hash = `0x${i.toString(16).padStart(64, '0')}`
      tooManyAuths.push(hash)
    }

    const oversizedAuthQueue: AuthQueue = {
      queue: new Map([[0n, tooManyAuths as `0x${string}`[]]]),
      processingIndex: 0n,
    }

    const [encodeError, encoded] = encodeAuthqueue(oversizedAuthQueue, mockConfigService)
    expect(encodeError).toBeUndefined()

    const [decodeError, decoded] = decodeAuthqueue(encoded!, mockConfigService)
    expect(decodeError).toBeUndefined()

    // Should only have 80 authorizations (truncated)
    expect(decoded!.value.queue.get(0n)!.length).toBe(80)
  })
})
