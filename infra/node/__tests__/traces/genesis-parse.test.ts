/**
 * Genesis Parse Test
 *
 * Tests parsing of genesis.json files from test vectors using NodeGenesisManager
 */

import { describe, it, expect } from 'bun:test'
import * as path from 'node:path'
import { NodeGenesisManager } from '../../services/genesis-manager'
import { ConfigService } from '../../services/config-service'

// Test vectors directory (relative to workspace root)
const WORKSPACE_ROOT = path.join(__dirname, '../../../../')

describe('Genesis Parse Tests', () => {
  const configService = new ConfigService('tiny')

  describe('Fallback Genesis', () => {
    it('should parse genesis.json from traces/fallback', () => {
      const genesisJsonPath = path.join(
        WORKSPACE_ROOT,
        'submodules/jam-test-vectors/traces/fallback/genesis.json',
      )

      const genesisManager = new NodeGenesisManager(configService, {
        genesisJsonPath,
      })

      // Verify genesis JSON was loaded
      const [error, genesisJson] = genesisManager.getGenesisJson()
      expect(error).toBeUndefined()
      expect(genesisJson).toBeDefined()

      if (genesisJson) {
        // Verify genesis JSON structure
        expect(genesisJson.header).toBeDefined()
        expect(genesisJson.header.parent).toBeDefined()
        expect(genesisJson.header.parent_state_root).toBeDefined()
        expect(genesisJson.header.extrinsic_hash).toBeDefined()
        expect(genesisJson.header.slot).toBeDefined()
        expect(genesisJson.header.epoch_mark).toBeDefined()
        expect(genesisJson.header.epoch_mark.entropy).toBeDefined()
        expect(genesisJson.header.epoch_mark.tickets_entropy).toBeDefined()
        expect(genesisJson.header.epoch_mark.validators).toBeDefined()
        expect(Array.isArray(genesisJson.header.epoch_mark.validators)).toBe(
          true,
        )

        // Verify state structure
        expect(genesisJson.state).toBeDefined()
        expect(genesisJson.state.state_root).toBeDefined()
        expect(genesisJson.state.keyvals).toBeDefined()
        expect(Array.isArray(genesisJson.state.keyvals)).toBe(true)

        // Verify validators array
        const validators = genesisJson.header.epoch_mark.validators
        expect(validators.length).toBeGreaterThan(0)

        // Verify each validator has required fields
        for (const validator of validators) {
          expect(validator.bandersnatch).toBeDefined()
          expect(validator.ed25519).toBeDefined()
          expect(
            validator.bandersnatch.startsWith('0x') &&
              validator.bandersnatch.length === 66,
          ).toBe(true)
          expect(
            validator.ed25519.startsWith('0x') &&
              validator.ed25519.length === 66,
          ).toBe(true)
        }
      }
    })

    it('should have valid genesis header structure', () => {
      const genesisJsonPath = path.join(
        WORKSPACE_ROOT,
        'submodules/jam-test-vectors/traces/fallback/genesis.json',
      )

      const genesisManager = new NodeGenesisManager(configService, {
        genesisJsonPath,
      })

      const [error, genesisJson] = genesisManager.getGenesisJson()
      expect(error).toBeUndefined()

      if (genesisJson) {
        const header = genesisJson.header

        // Verify header fields
        expect(header.parent).toBe(
          '0x0000000000000000000000000000000000000000000000000000000000000000',
        )
        expect(header.slot).toBe(0)
        expect(header.author_index).toBeDefined()
        expect(header.entropy_source).toBeDefined()
        expect(header.seal).toBeDefined()
        expect(header.offenders_mark).toBeDefined()
        expect(Array.isArray(header.offenders_mark)).toBe(true)

        // Verify epoch_mark structure
        expect(header.epoch_mark.entropy).toBeDefined()
        expect(header.epoch_mark.tickets_entropy).toBeDefined()
        expect(Array.isArray(header.epoch_mark.validators)).toBe(true)

        // Verify entropy is valid hex
        expect(
          header.epoch_mark.entropy.startsWith('0x') &&
            header.epoch_mark.entropy.length === 66,
        ).toBe(true)
        expect(
          header.epoch_mark.tickets_entropy.startsWith('0x') &&
            header.epoch_mark.tickets_entropy.length === 66,
        ).toBe(true)
      }
    })

    it('should have valid state keyvals', () => {
      const genesisJsonPath = path.join(
        WORKSPACE_ROOT,
        'submodules/jam-test-vectors/traces/fallback/genesis.json',
      )

      const genesisManager = new NodeGenesisManager(configService, {
        genesisJsonPath,
      })

      const [error, stateResult] = genesisManager.getState()
      expect(error).toBeUndefined()

      if (stateResult) {
        const keyvals = stateResult.keyvals

        // Verify keyvals array
        expect(keyvals.length).toBeGreaterThan(0)

        // Verify each keyval has required fields
        for (const keyval of keyvals) {
          expect(keyval.key).toBeDefined()
          expect(keyval.value).toBeDefined()
          expect(keyval.key.startsWith('0x')).toBe(true)
          expect(keyval.value.startsWith('0x')).toBe(true)
        }

        // Verify state root is valid hex
        expect(
          stateResult.state_root.startsWith('0x') &&
            stateResult.state_root.length === 66,
        ).toBe(true)
      }
    })
  })
})

