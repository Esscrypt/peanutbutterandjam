import { describe, expect, it } from 'vitest'
import { generateChainSpec } from '../utils/chain-spec'

describe('Chain Spec Generator', () => {
  const validConfig = {
    id: 'test-chain',
    genesis_validators: [
      {
        peer_id: 'validator1',
        bandersnatch: 'ff71c6c03ff88adb5ed52c9681de1629a54e702fc14729f6b50d2f0a76f185b3',
        net_addr: '127.0.0.1:40000',
        validator_index: 0,
        stake: '1000000000000000000',
      },
      {
        peer_id: 'validator2',
        bandersnatch: 'dee6d555b82024f1ccf8a1e37e60fa60fd40b1958c4bb3006af78647950e1b91',
        net_addr: '127.0.0.1:40001',
        validator_index: 1,
        stake: '1000000000000000000',
      },
    ],
  }

  describe('generateChainSpec', () => {
    it('should generate a valid chain spec with basic configuration', () => {
      const chainSpec = generateChainSpec(validConfig)

      expect(chainSpec).toBeDefined()
      expect(chainSpec.id).toBe('test-chain')
      expect(typeof chainSpec.genesis_state).toBe('object')
      expect(Object.keys(chainSpec.genesis_state).length).toBeGreaterThan(0)
    })

    it('should generate state trie entries', () => {
      const chainSpec = generateChainSpec(validConfig)

      expect(chainSpec.genesis_state).toBeDefined()
      expect(typeof chainSpec.genesis_state).toBe('object')
      
      // Check that we have state trie entries (keys should be 62-character hex strings)
      const stateKeys = Object.keys(chainSpec.genesis_state)
      expect(stateKeys.length).toBeGreaterThan(0)
      
      // All keys should be 62-character hex strings (31 Uint8Array without 0x prefix)
      for (const key of stateKeys) {
        expect(key).toMatch(/^[a-fA-F0-9]{62}$/)
      }
    })

    it('should generate deterministic addresses for validators', () => {
      const config1 = {
        id: 'test-chain',
        genesis_validators: [
          {
            peer_id: 'validator1',
            bandersnatch: 'ff71c6c03ff88adb5ed52c9681de1629a54e702fc14729f6b50d2f0a76f185b3',
            net_addr: '127.0.0.1:40000',
            validator_index: 0,
            stake: '1000000000000000000',
          },
        ],
      }

      const config2 = {
        id: 'test-chain-2',
        genesis_validators: [
          {
            peer_id: 'validator1-different',
            bandersnatch: 'ff71c6c03ff88adb5ed52c9681de1629a54e702fc14729f6b50d2f0a76f185b3',
            net_addr: '127.0.0.1:40001',
            validator_index: 0,
            stake: '1000000000000000000',
          },
        ],
      }

      const spec1 = generateChainSpec(config1)
      const spec2 = generateChainSpec(config2)

      // Same validator indices should produce same state trie structure
      expect(Object.keys(spec1.genesis_state).length).toBe(Object.keys(spec2.genesis_state).length)
    })

    it('should handle optional fields correctly', () => {
      const minimalConfig = {
        id: 'minimal-chain',
        genesis_validators: [
          {
            peer_id: 'validator1',
            bandersnatch: 'ff71c6c03ff88adb5ed52c9681de1629a54e702fc14729f6b50d2f0a76f185b3',
            net_addr: '127.0.0.1:40000',
            validator_index: 0,
            stake: '1000000000000000000',
          },
        ],
      }

      const chainSpec = generateChainSpec(minimalConfig)

      expect(chainSpec.id).toBe('minimal-chain')
      expect(typeof chainSpec.genesis_state).toBe('object')
      expect(Object.keys(chainSpec.genesis_state).length).toBeGreaterThan(0)
    })

    it('should handle empty accounts array', () => {
      const configWithoutAccounts = { ...validConfig, accounts: [] }
      const chainSpec = generateChainSpec(configWithoutAccounts)

      // Should still have state trie entries
      expect(typeof chainSpec.genesis_state).toBe('object')
      expect(Object.keys(chainSpec.genesis_state).length).toBeGreaterThan(0)
    })
  })

  describe('validation', () => {
    it('should throw error for invalid chain ID', () => {
      const invalidConfig = {
        id: '',
        genesis_validators: [
          {
            peer_id: 'validator1',
            bandersnatch: 'ff71c6c03ff88adb5ed52c9681de1629a54e702fc14729f6b50d2f0a76f185b3',
            net_addr: '127.0.0.1:40000',
            validator_index: 0,
            stake: '1000000000000000000',
          },
        ],
      }

      expect(() => generateChainSpec(invalidConfig)).toThrow()
    })

    it('should throw error for empty genesis validators', () => {
      const invalidConfig = {
        id: 'test-chain',
        genesis_validators: [],
      }

      expect(() => generateChainSpec(invalidConfig)).toThrow()
    })

    it('should throw error for invalid bandersnatch key format', () => {
      const invalidConfig = {
        id: 'test-chain',
        genesis_validators: [
          {
            peer_id: 'validator1',
            bandersnatch: 'invalid-key',
            net_addr: '127.0.0.1:40000',
            validator_index: 0,
            stake: '1000000000000000000',
          },
        ],
      }

      expect(() => generateChainSpec(invalidConfig)).toThrow()
    })

    it('should throw error for invalid stake format', () => {
      const invalidConfig = {
        id: 'test-chain',
        genesis_validators: [
          {
            peer_id: 'validator1',
            bandersnatch: 'ff71c6c03ff88adb5ed52c9681de1629a54e702fc14729f6b50d2f0a76f185b3',
            net_addr: '127.0.0.1:40000',
            stake: 'invalid-stake',
            validator_index: 0,
          },
        ],
      }

      expect(() => generateChainSpec(invalidConfig)).toThrow()
    })

    it('should throw error for invalid account address format', () => {
      const invalidConfig = {
        id: 'test-chain',
        genesis_validators: [
          {
            peer_id: 'validator1',
            bandersnatch: 'ff71c6c03ff88adb5ed52c9681de1629a54e702fc14729f6b50d2f0a76f185b3',
            net_addr: '127.0.0.1:40000',
            validator_index: 0,
            stake: '1000000000000000000',
          },
        ],
        accounts: [
          {
            address: 'invalid-address', // This is what we're testing - invalid address format
            balance: '1000000000000000000',
            nonce: 0,
            isValidator: false,
          },
        ],
      }

      expect(() => generateChainSpec(invalidConfig)).toThrow()
    })

    it('should throw error for invalid account balance format', () => {
      const invalidConfig = {
        id: 'test-chain',
        genesis_validators: [
          {
            peer_id: 'validator1',
            bandersnatch: 'ff71c6c03ff88adb5ed52c9681de1629a54e702fc14729f6b50d2f0a76f185b3',
            net_addr: '127.0.0.1:40000',
            validator_index: 0,
            stake: '1000000000000000000',
          },
        ],
        accounts: [
          {
            address: '0x1234567890123456789012345678901234567890',
            balance: 'invalid-balance', // This is what we're testing - invalid balance format
            nonce: 0,
            isValidator: false,
          },
        ],
      }

      expect(() => generateChainSpec(invalidConfig)).toThrow()
    })
  })

  describe('structure validation', () => {
    it('should match polkajam format structure', () => {
      const chainSpec = generateChainSpec(validConfig)

      // Check top-level structure
      expect(chainSpec).toHaveProperty('id')
      expect(chainSpec).toHaveProperty('genesis_state')
      expect(chainSpec).not.toHaveProperty('bootnodes')
      expect(chainSpec).not.toHaveProperty('name')
      expect(chainSpec).not.toHaveProperty('genesis_header')

      // Check genesis_state is a flat key-value mapping
      expect(typeof chainSpec.genesis_state).toBe('object')
      expect(Array.isArray(chainSpec.genesis_state)).toBe(false)
    })

    it('should generate valid hex strings for state keys', () => {
      const chainSpec = generateChainSpec(validConfig)

      // All state keys should be valid 62-character hex strings (31 Uint8Array without 0x prefix)
      for (const key of Object.keys(chainSpec.genesis_state)) {
        expect(key).toMatch(/^[a-fA-F0-9]{62}$/)
      }
    })

    it('should generate valid hex strings for state values', () => {
      const chainSpec = generateChainSpec(validConfig)

      // All state values should be valid hex strings (with or without 0x prefix)
      for (const value of Object.values(chainSpec.genesis_state)) {
        expect(value).toMatch(/^(0x)?[a-fA-F0-9]*$/)
      }
    })
  })

  describe('edge cases', () => {
    it('should handle large validator indices', () => {
      const configWithLargeIndex = {
        id: 'test-chain',
        genesis_validators: [
          {
            peer_id: 'validator1',
            bandersnatch: 'ff71c6c03ff88adb5ed52c9681de1629a54e702fc14729f6b50d2f0a76f185b3',
            net_addr: '127.0.0.1:40000',
            validator_index: 999999,
            stake: '1000000000000000000',
          },
        ],
      }

      const chainSpec = generateChainSpec(configWithLargeIndex)
      expect(typeof chainSpec.genesis_state).toBe('object')
      expect(Object.keys(chainSpec.genesis_state).length).toBeGreaterThan(0)
    })

    it('should handle zero stake', () => {
      const configWithZeroStake = {
        id: 'test-chain',
        genesis_validators: [
          {
            peer_id: 'validator1',
            bandersnatch: 'ff71c6c03ff88adb5ed52c9681de1629a54e702fc14729f6b50d2f0a76f185b3',
            net_addr: '127.0.0.1:40000',
            stake: '0',
            validator_index: 0,
          },
        ],
      }

      const chainSpec = generateChainSpec(configWithZeroStake)
      expect(typeof chainSpec.genesis_state).toBe('object')
      expect(Object.keys(chainSpec.genesis_state).length).toBeGreaterThan(0)
    })

    it('should handle very large stake values', () => {
      const configWithLargeStake = {
        id: 'test-chain',
        genesis_validators: [
          {
            peer_id: 'validator1',
            bandersnatch: 'ff71c6c03ff88adb5ed52c9681de1629a54e702fc14729f6b50d2f0a76f185b3',
            net_addr: '127.0.0.1:40000',
            stake: '9999999999999999999999999999999999999999999999999999999999999999',
            validator_index: 0,
          },
        ],
      }

      const chainSpec = generateChainSpec(configWithLargeStake)
      expect(typeof chainSpec.genesis_state).toBe('object')
      expect(Object.keys(chainSpec.genesis_state).length).toBeGreaterThan(0)
    })
  })
}) 