/**
 * Unit Test: State Keyval Decode Failures
 *
 * Tests two specific state keyvals that fail to decode and explains why:
 * 1. Chapter 12 (Privileges) - value too short
 * 2. Chapter 255 (Service Account) - value length mismatch
 */

import { describe, it, expect } from 'bun:test'
import { decodePrivileges } from '@pbnjam/codec'
import { decodeServiceAccount } from '@pbnjam/codec'
import { hexToBytes } from '@pbnjam/core'
import { ConfigService } from '../config-service'

describe('State Keyval Decode Failures', () => {
  const configService = new ConfigService('tiny')

  describe('Chapter 12 (Privileges) - Key 0x0c000000000000000000000000000000000000000000000000000000000000', () => {
    const key = '0x0c000000000000000000000000000000000000000000000000000000000000'
    const value = '0x0000000000000000000000000000000000'

    it('should fail to decode due to insufficient data length', () => {
      const valueBytes = hexToBytes(value)
      
      // Verify the value length
      expect(valueBytes.length).toBe(17) // 34 hex chars / 2 = 17 bytes
      
      // Try to decode with v0.7.2 (expects registrar field)
      const [error, result] = decodePrivileges(
        valueBytes,
        configService,
        { major: 0, minor: 7, patch: 2 }
      )
      
      expect(error).toBeDefined()
      expect(result).toBeUndefined()
      expect(error?.message).toContain('Insufficient data')
      
      console.log(`\n❌ Chapter 12 (Privileges) decode failure:`)
      console.log(`   Key: ${key}`)
      console.log(`   Value: ${value}`)
      console.log(`   Value length: ${valueBytes.length} bytes`)
      console.log(`   Error: ${error?.message}`)
      console.log(`\n   Why it fails:`)
      console.log(`   - decodePrivileges expects minimum:`)
      console.log(`     * 4 bytes for manager`)
      console.log(`     * 4 * coreCount bytes for assigners (minimum 4 bytes)`)
      console.log(`     * 4 bytes for delegator`)
      console.log(`     * 4 bytes for registrar (v0.7.1+)`)
      console.log(`     * Variable-length dictionary for alwaysaccers`)
      console.log(`   - Minimum required: 16 bytes + dictionary encoding`)
      console.log(`   - Actual value: ${valueBytes.length} bytes (too short)`)
    })

    it('should also fail with v0.7.0 format (no registrar)', () => {
      const valueBytes = hexToBytes(value)
      
      // Try to decode with v0.7.0 (no registrar field)
      const [error, result] = decodePrivileges(
        valueBytes,
        configService,
        { major: 0, minor: 7, patch: 0 }
      )
      
      expect(error).toBeDefined()
      expect(result).toBeUndefined()
      
      console.log(`\n   v0.7.0 format also fails:`)
      console.log(`   - Minimum required: 12 bytes + dictionary encoding`)
      console.log(`   - Actual value: ${valueBytes.length} bytes (still too short)`)
    })

    it('should explain the expected structure', () => {
      console.log(`\n   Expected structure for Chapter 12 (Privileges):`)
      console.log(`   C(12) ↦ encode{`)
      console.log(`     encode[4]{manager, assigners, delegator, registrar},`)
      console.log(`     alwaysaccers`)
      console.log(`   }`)
      console.log(`   - manager: 4 bytes (service ID)`)
      console.log(`   - assigners: 4 * coreCount bytes (sequence of service IDs)`)
      console.log(`   - delegator: 4 bytes (service ID)`)
      console.log(`   - registrar: 4 bytes (service ID, v0.7.1+ only)`)
      console.log(`   - alwaysaccers: dictionary{serviceid}{gas} (variable length)`)
    })
  })

  describe('Chapter 255 (Service Account) - Key 0xff000000000000000000000000000000000000000000000000000000000000', () => {
    const key = '0xff000000000000000000000000000000000000000000000000000000000000'
    const value = '0xcbb31ef5b91515d0453189f41ebe3b7be6724553d252318bfd46803b708383c6ffffffffffffffff0a000000000000000a00000000000000e577020000000000ffffffffffffffff04000000000000000000000000000000'

    it('should fail to decode due to length mismatch', () => {
      const valueBytes = hexToBytes(value)
      
      // Verify the value length
      expect(valueBytes.length).toBe(88) // 178 hex chars (including 0x) - 2 / 2 = 88 bytes
      
      // Try to decode with v0.7.2 (expects discriminator)
      const [error, result] = decodeServiceAccount(
        valueBytes,
        { major: 0, minor: 7, patch: 2 }
      )
      
      expect(error).toBeDefined()
      expect(result).toBeUndefined()
      
      console.log(`\n❌ Chapter 255 (Service Account) decode failure:`)
      console.log(`   Key: ${key}`)
      console.log(`   Value: ${value}`)
      console.log(`   Value length: ${valueBytes.length} bytes`)
      console.log(`   Error: ${error?.message}`)
      console.log(`\n   Why it fails:`)
      console.log(`   - decodeServiceAccount expects (v0.7.2):`)
      console.log(`     * 1 byte discriminator`)
      console.log(`     * 32 bytes for codehash`)
      console.log(`     * 40 bytes for encode[8]{balance, minaccgas, minmemogas, octets, gratis}`)
      console.log(`     * 16 bytes for encode[4]{items, created, lastacc, parent}`)
      console.log(`   - Total required: 1 + 32 + 40 + 16 = 89 bytes`)
      console.log(`   - Actual value: ${valueBytes.length} bytes (${89 - valueBytes.length} bytes short)`)
    })

    it('should also fail with v0.7.0 format (no discriminator)', () => {
      const valueBytes = hexToBytes(value)
      
      // Try to decode with v0.7.0 (no discriminator)
      const [error, result] = decodeServiceAccount(
        valueBytes,
        { major: 0, minor: 7, patch: 0 }
      )
      
      expect(error).toBeDefined()
      expect(result).toBeUndefined()
      
      console.log(`\n   v0.7.0 format also fails:`)
      console.log(`   - Required: 32 + 40 + 16 = 88 bytes`)
      console.log(`   - Actual value: ${valueBytes.length} bytes (${88 - valueBytes.length} bytes short)`)
    })

    it('should explain the expected structure', () => {
      console.log(`\n   Expected structure for Chapter 255 (Service Account):`)
      console.log(`   C(255, s) ↦ encode{`)
      console.log(`     0 (discriminator, v0.7.1+ only),`)
      console.log(`     sa_codehash (32 bytes),`)
      console.log(`     encode[8]{sa_balance, sa_minaccgas, sa_minmemogas, sa_octets, sa_gratis} (40 bytes),`)
      console.log(`     encode[4]{sa_items, sa_created, sa_lastacc, sa_parent} (16 bytes)`)
      console.log(`   }`)
      console.log(`   - v0.7.2 format: 1 + 32 + 40 + 16 = 89 bytes`)
      console.log(`   - v0.7.0 format: 32 + 40 + 16 = 88 bytes`)
    })

    it('should analyze the actual value structure', () => {
      const valueBytes = hexToBytes(value)
      
      console.log(`\n   Actual value analysis:`)
      console.log(`   - Total length: ${valueBytes.length} bytes`)
      console.log(`   - First 32 bytes (potential codehash): ${value.substring(0, 66)}`)
      console.log(`   - Next 40 bytes (potential 8-byte fields): ${value.substring(66, 146)}`)
      console.log(`   - Remaining ${valueBytes.length - 72} bytes: ${value.substring(146)}`)
      console.log(`   - Missing: ${89 - valueBytes.length} bytes for v0.7.2 format`)
      console.log(`   - Missing: ${88 - valueBytes.length} bytes for v0.7.0 format`)
    })
  })

  describe('Summary', () => {
    it('should summarize why these keyvals cannot be decoded', () => {
      console.log(`\n📋 Summary of Decode Failures:`)
      console.log(`\n1. Chapter 12 (Privileges) - Key 0x0c...:`)
      console.log(`   - Value: 0x0000000000000000000000000000000000 (17 bytes)`)
      console.log(`   - Required minimum: 16+ bytes + dictionary encoding`)
      console.log(`   - Issue: Value is too short, missing required fields`)
      console.log(`   - Likely cause: Incomplete or corrupted state data`)
      console.log(`\n2. Chapter 255 (Service Account) - Key 0xff...:`)
      console.log(`   - Value: 0xcbb3...04000000000000000000000000000000 (88 bytes)`)
      console.log(`   - Required: 89 bytes (v0.7.2) or 88 bytes (v0.7.0)`)
      console.log(`   - Issue: Value is 1 byte short for v0.7.2 (missing discriminator)`)
      console.log(`   - Likely cause: Truncated data or version mismatch`)
      console.log(`\n💡 These keyvals are logged as unprocessed in setState()`)
      console.log(`   and do not prevent state processing from continuing.`)
    })
  })
})

