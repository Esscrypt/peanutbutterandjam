import { describe, expect, it } from 'vitest'
import { ZodError } from 'zod'
import {
  type ChainSpecConfig,
  generateChainSpec,
} from '../src/utils/chain-spec'

describe('generateChainSpec', () => {
  const validConfig: ChainSpecConfig = {
    id: 'dev',
    genesis_validators: [
      {
        peer_id: 'eecgwpgwq3noky4ijm4jmvjtmuzv44qvigciusxakq5epnrfj2utb',
        bandersnatch:
          'ff71c6c03ff88adb5ed52c9681de1629a54e702fc14729f6b50d2f0a76f185b3',
        net_addr: '127.0.0.1:40000',
      },
      {
        peer_id: 'en5ejs5b2tybkfh4ym5vpfh7nynby73xhtfzmazumtvcijpcsz6ma',
        bandersnatch:
          'dee6d555b82024f1ccf8a1e37e60fa60fd40b1958c4bb3006af78647950e1b91',
        net_addr: '127.0.0.1:40001',
      },
    ],
  }

  it('should generate chain spec with valid config', () => {
    const result = generateChainSpec(validConfig)

    expect(result).toBeDefined()
    expect(result.id).toBeDefined()
    expect(result.genesis_state).toBeDefined()
    expect(result.id).toBe('dev')
    expect(typeof result.genesis_state).toBe('object')
  })

  it('should validate required fields', () => {
    const invalidConfig = {
      // Missing id
      genesis_validators: [
        {
          peer_id: 'test',
          bandersnatch:
            'ff71c6c03ff88adb5ed52c9681de1629a54e702fc14729f6b50d2f0a76f185b3',
          net_addr: '127.0.0.1:40000',
        },
      ],
    }

    expect(() => generateChainSpec(invalidConfig as any)).toThrow(ZodError)
  })

  it('should validate genesis validators array', () => {
    const invalidConfig = {
      id: 'dev',
      genesis_validators: [], // Empty array
    }

    expect(() => generateChainSpec(invalidConfig)).toThrow(ZodError)
  })

  it('should validate bandersnatch key format', () => {
    const invalidConfig = {
      id: 'dev',
      genesis_validators: [
        {
          peer_id: 'test',
          bandersnatch: 'invalid-key', // Invalid format
          net_addr: '127.0.0.1:40000',
        },
      ],
    }

    expect(() => generateChainSpec(invalidConfig)).toThrow(ZodError)
  })

  it('should validate peer_id is not empty', () => {
    const invalidConfig = {
      id: 'dev',
      genesis_validators: [
        {
          peer_id: '', // Empty string
          bandersnatch:
            'ff71c6c03ff88adb5ed52c9681de1629a54e702fc14729f6b50d2f0a76f185b3',
          net_addr: '127.0.0.1:40000',
        },
      ],
    }

    expect(() => generateChainSpec(invalidConfig)).toThrow(ZodError)
  })

  it('should validate net_addr is not empty', () => {
    const invalidConfig = {
      id: 'dev',
      genesis_validators: [
        {
          peer_id: 'test',
          bandersnatch:
            'ff71c6c03ff88adb5ed52c9681de1629a54e702fc14729f6b50d2f0a76f185b3',
          net_addr: '', // Empty string
        },
      ],
    }

    expect(() => generateChainSpec(invalidConfig)).toThrow(ZodError)
  })

  it('should handle multiple validators correctly', () => {
    const multiValidatorConfig: ChainSpecConfig = {
      id: 'test',
      genesis_validators: [
        {
          peer_id: 'validator1',
          bandersnatch:
            'ff71c6c03ff88adb5ed52c9681de1629a54e702fc14729f6b50d2f0a76f185b3',
          net_addr: '127.0.0.1:40000',
        },
        {
          peer_id: 'validator2',
          bandersnatch:
            'dee6d555b82024f1ccf8a1e37e60fa60fd40b1958c4bb3006af78647950e1b91',
          net_addr: '127.0.0.1:40001',
        },
        {
          peer_id: 'validator3',
          bandersnatch:
            '9326edb21e5541717fde24ec085000b28709847b8aab1ac51f84e94b37ca1b66',
          net_addr: '127.0.0.1:40002',
        },
      ],
    }

    const result = generateChainSpec(multiValidatorConfig)

    expect(result.id).toBe('test')
    expect(typeof result.genesis_state).toBe('object')
    expect(Object.keys(result.genesis_state).length).toBeGreaterThan(0)
  })
})
