/**
 * Genesis Manager Tests
 *
 * Unit tests for GenesisManager class
 * Tests loading, validation, and parsing of genesis.json files
 */

import { describe, expect, it, beforeEach } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { GenesisManager } from '../src/genesis-manager'
import type { GenesisConfig } from '../src/types'

describe('GenesisManager', () => {
  let config: GenesisConfig

  beforeEach(() => {
    config = {
      genesisPath: '../../config/genesis.json',
      validation: {
        validateGenesis: true,
        allowEmptyGenesis: true,
        requireAccounts: false,
        requireValidators: false,
      },
      import: {
        createMissingAccounts: false,
        initializeValidators: false,
        resetExistingState: false,
        backupExistingState: false,
      },
    }
  })

  describe('Configuration', () => {
    it('should create GenesisManager with valid configuration', () => {
      const genesisManager = new GenesisManager(config)
      expect(genesisManager).toBeInstanceOf(GenesisManager)
    })

    it('should accept configuration with validation disabled', () => {
      const configWithValidationDisabled = {
        ...config,
        validation: {
          validateGenesis: false,
          allowEmptyGenesis: true,
          requireAccounts: false,
          requireValidators: false,
        },
      }
      const genesisManager = new GenesisManager(configWithValidationDisabled)
      expect(genesisManager).toBeInstanceOf(GenesisManager)
    })
  })

  describe('Genesis File Loading', () => {
    it('should load genesis from valid JSON file', async () => {
      const genesisManager = new GenesisManager(config)
      const genesisState = await genesisManager.loadGenesis()

      expect(genesisState).toBeDefined()
      expect(genesisState.genesisBlock).toBeDefined()
      expect(genesisState.state).toBeDefined()
      expect(genesisState.network).toBeDefined()
    })

    it('should throw error for non-existent genesis file', async () => {
      const invalidConfig = {
        ...config,
        genesisPath: 'non-existent-file.json',
      }
      const genesisManager = new GenesisManager(invalidConfig)

      await expect(genesisManager.loadGenesis()).rejects.toThrow('Genesis file not found')
    })

    it('should throw error for invalid JSON file', async () => {
      // Create a temporary invalid JSON file for testing
      const tempFile = '/tmp/invalid-genesis.json'
      const fs = require('fs')
      fs.writeFileSync(tempFile, 'invalid json content')

      const invalidConfig = {
        ...config,
        genesisPath: tempFile,
      }
      const genesisManager = new GenesisManager(invalidConfig)

      await expect(genesisManager.loadGenesis()).rejects.toThrow('Genesis JSON validation failed')

      // Clean up
      fs.unlinkSync(tempFile)
    })
  })

  describe('Genesis State Structure', () => {
    it('should have correct genesis block structure', async () => {
      const genesisManager = new GenesisManager(config)
      const genesisState = await genesisManager.loadGenesis()

      expect(genesisState.genesisBlock.number).toBe(0)
      expect(genesisState.genesisBlock.hash).toBeDefined()
      expect(genesisState.genesisBlock.parentHash).toBeDefined()
      expect(genesisState.genesisBlock.timestamp).toBeDefined()
    })

    it('should have correct state structure', async () => {
      const genesisManager = new GenesisManager(config)
      const genesisState = await genesisManager.loadGenesis()

      expect(genesisState.state.accounts).toBeInstanceOf(Map)
      expect(genesisState.state.validators).toBeInstanceOf(Array)
      expect(genesisState.state.safrole).toBeDefined()
      expect(genesisState.state.safrole.timeslot).toBeDefined()
      expect(genesisState.state.safrole.entropy).toBeDefined()
    })

    it('should have correct network configuration', async () => {
      const genesisManager = new GenesisManager(config)
      const genesisState = await genesisManager.loadGenesis()

      expect(genesisState.network.chainId).toBe('jam-dev')
      expect(genesisState.network.protocolVersion).toBe('1.0.0')
      expect(genesisState.network.slotDuration).toBe(6000)
      expect(genesisState.network.epochLength).toBe(600)
      expect(genesisState.network.maxValidators).toBe(100)
      expect(genesisState.network.minStake).toBe(BigInt('1000000000000000000'))
    })
  })

  describe('Genesis Validation', () => {
    it('should validate genesis block number is 0', async () => {
      const genesisManager = new GenesisManager(config)
      const genesisState = await genesisManager.loadGenesis()

      expect(genesisState.genesisBlock.number).toBe(0)
    })

    it('should validate genesis block parent hash is zero', async () => {
      const genesisManager = new GenesisManager(config)
      const genesisState = await genesisManager.loadGenesis()

      expect(genesisState.genesisBlock.parentHash).toBe(
        '0x0000000000000000000000000000000000000000000000000000000000000000'
      )
    })

    it('should validate network configuration values', async () => {
      const genesisManager = new GenesisManager(config)
      const genesisState = await genesisManager.loadGenesis()

      expect(genesisState.network.slotDuration).toBeGreaterThan(0)
      expect(genesisState.network.epochLength).toBeGreaterThan(0)
      expect(genesisState.network.maxValidators).toBeGreaterThan(0)
    })
  })

  describe('Genesis Header Parsing', () => {
    it('should parse genesis header correctly', async () => {
      const genesisManager = new GenesisManager(config)
      const genesisState = await genesisManager.loadGenesis()

      // Verify that the genesis header was parsed correctly
      expect(genesisState.genesisBlock.hash).toBe(
        '0x0000000000000000000000000000000000000000000000000000000000000000'
      )
      expect(genesisState.genesisBlock.parentHash).toBe(
        '0x0000000000000000000000000000000000000000000000000000000000000000'
      )
    })

    it('should parse safrole state from header', async () => {
      const genesisManager = new GenesisManager(config)
      const genesisState = await genesisManager.loadGenesis()

      expect(genesisState.state.safrole.epoch).toBe(0)
      expect(genesisState.state.safrole.timeslot).toBe(0)
      expect(genesisState.state.safrole.entropy).toBeDefined()
      expect(genesisState.state.safrole.tickets).toBeInstanceOf(Array)
    })
  })

  describe('Error Handling', () => {
    it('should handle validation errors gracefully', async () => {
      const configWithStrictValidation = {
        ...config,
        validation: {
          validateGenesis: true,
          allowEmptyGenesis: false,
          requireAccounts: true, // This will cause validation to fail
          requireValidators: true, // This will cause validation to fail
        },
      }
      const genesisManager = new GenesisManager(configWithStrictValidation)

      // Should throw validation error since validation is enforced
      await expect(genesisManager.loadGenesis()).rejects.toThrow('Genesis validation failed')
    })

    it('should handle file system errors', async () => {
      const invalidConfig = {
        ...config,
        genesisPath: '/invalid/path/genesis.json',
      }
      const genesisManager = new GenesisManager(invalidConfig)

      await expect(genesisManager.loadGenesis()).rejects.toThrow()
    })
  })

  describe('Integration with Zod Schema', () => {
    it('should validate genesis.json structure using Zod schema', async () => {
      const genesisManager = new GenesisManager(config)
      
      // This test verifies that the Zod schema validation is working
      // If the genesis.json file is invalid, this will throw an error
      const genesisState = await genesisManager.loadGenesis()
      
      expect(genesisState).toBeDefined()
      expect(genesisState.genesisBlock).toBeDefined()
      expect(genesisState.state).toBeDefined()
      expect(genesisState.network).toBeDefined()
    })

    it('should handle malformed genesis.json gracefully', async () => {
      // Create a temporary malformed JSON file for testing
      const tempFile = '/tmp/malformed-genesis.json'
      const fs = require('fs')
      fs.writeFileSync(tempFile, JSON.stringify({
        header: {
          parent: 'invalid-hex', // Invalid hex string
          parent_state_root: '0x0000000000000000000000000000000000000000000000000000000000000000',
          extrinsic_hash: '0x0000000000000000000000000000000000000000000000000000000000000000',
          slot: 0,
          epoch_mark: {
            entropy: '0x0000000000000000000000000000000000000000000000000000000000000000',
            tickets_entropy: '0x0000000000000000000000000000000000000000000000000000000000000000',
            validators: [],
          },
          tickets_mark: null,
          offenders_mark: [],
          author_index: 0,
          entropy_source: '0x000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
          seal: '0x000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
        },
        state: {
          state_root: '0x0000000000000000000000000000000000000000000000000000000000000000',
          keyvals: [],
        },
      }))

      const invalidConfig = {
        ...config,
        genesisPath: tempFile,
      }
      const genesisManager = new GenesisManager(invalidConfig)

      await expect(genesisManager.loadGenesis()).rejects.toThrow('Genesis JSON validation failed')

      // Clean up
      fs.unlinkSync(tempFile)
    })
  })
})
