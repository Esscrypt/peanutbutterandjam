/**
 * Unit Tests for Key Generation
 *
 * Tests deterministic key generation according to JAM specification
 * Reference: https://docs.jamcha.in/basics/dev-accounts
 */

import { describe, expect, it } from 'vitest'
import { generateValidatorKeys } from '../utils/key-generation'

// Expected values from JAM documentation
const EXPECTED_KEYS = {
  Alice: {
    index: 0,
    seed: '0x0000000000000000000000000000000000000000000000000000000000000000',
    ed25519_secret_seed:
      '0x996542becdf1e78278dc795679c825faca2e9ed2bf101bf3c4a236d3ed79cf59',
    ed25519_public:
      '0x4418fb8c85bb3985394a8c2756d3643457ce614546202a2f50b093d762499ace',
    bandersnatch_secret_seed:
      '0x007596986419e027e65499cc87027a236bf4a78b5e8bd7f675759d73e7a9c799',
    bandersnatch_public:
      '0xff71c6c03ff88adb5ed52c9681de1629a54e702fc14729f6b50d2f0a76f185b3',
    dnsAltName: 'eecgwpgwq3noky4ijm4jmvjtmuzv44qvigciusxakq5epnrfj2utb',
  },
  Bob: {
    index: 1,
    seed: '0x0100000001000000010000000100000001000000010000000100000001000000',
    ed25519_secret_seed:
      '0xb81e308145d97464d2bc92d35d227a9e62241a16451af6da5053e309be4f91d7',
    ed25519_public:
      '0xad93247bd01307550ec7acd757ce6fb805fcf73db364063265b30a949e90d933',
    bandersnatch_secret_seed:
      '0x12ca375c9242101c99ad5fafe8997411f112ae10e0e5b7c4589e107c433700ac',
    bandersnatch_public:
      '0xdee6d555b82024f1ccf8a1e37e60fa60fd40b1958c4bb3006af78647950e1b91',
    dnsAltName: 'en5ejs5b2tybkfh4ym5vpfh7nynby73xhtfzmazumtvcijpcsz6ma',
  },
  Carol: {
    index: 2,
    seed: '0x0200000002000000020000000200000002000000020000000200000002000000',
    ed25519_secret_seed:
      '0x0093c8c10a88ebbc99b35b72897a26d259313ee9bad97436a437d2e43aaafa0f',
    ed25519_public:
      '0xcab2b9ff25c2410fbe9b8a717abb298c716a03983c98ceb4def2087500b8e341',
    bandersnatch_secret_seed:
      '0x3d71dc0ffd02d90524fda3e4a220e7ec514a258c59457d3077ce4d4f003fd98a',
    bandersnatch_public:
      '0x9326edb21e5541717fde24ec085000b28709847b8aab1ac51f84e94b37ca1b66',
    dnsAltName: 'ekwmt37xecoq6a7otkm4ux5gfmm4uwbat4bg5m223shckhaaxdpqa',
  },
  David: {
    index: 3,
    seed: '0x0300000003000000030000000300000003000000030000000300000003000000',
    ed25519_secret_seed:
      '0x69b3a7031787e12bfbdcac1b7a737b3e5a9f9450c37e215f6d3b57730e21001a',
    ed25519_public:
      '0xf30aa5444688b3cab47697b37d5cac5707bb3289e986b19b17db437206931a8d',
    bandersnatch_secret_seed:
      '0x107a9148b39a1099eeaee13ac0e3c6b9c256258b51c967747af0f8749398a276',
    bandersnatch_public:
      '0x0746846d17469fb2f95ef365efcab9f4e22fa1feb53111c995376be8019981cc',
    dnsAltName: 'etxckkczii4mvm22ox4m3horvx2bwlzerjxbd3n6c36qehdms2idb',
  },
  Eve: {
    index: 4,
    seed: '0x0400000004000000040000000400000004000000040000000400000004000000',
    ed25519_secret_seed:
      '0xb4de9ebf8db5428930baa5a98d26679ab2a03eae7c791d582e6b75b7f018d0d4',
    ed25519_public:
      '0x8b8c5d436f92ecf605421e873a99ec528761eb52a88a2f9a057b3b3003e6f32a',
    bandersnatch_secret_seed:
      '0x0bb36f5ba8e3ba602781bb714e67182410440ce18aa800c4cb4dd22525b70409',
    bandersnatch_public:
      '0x151e5c8fe2b9d8a606966a79edd2f9e5db47e83947ce368ccba53bf6ba20a40b',
    dnsAltName: 'eled3vb5nse3n7cii6ybvtms5s2bdwvlkivc7cnwa33oatby4txka',
  },
  Fergie: {
    index: 5,
    seed: '0x0500000005000000050000000500000005000000050000000500000005000000',
    ed25519_secret_seed:
      '0x4a6482f8f479e3ba2b845f8cef284f4b3208ba3241ed82caa1b5ce9fc6281730',
    ed25519_public:
      '0xab0084d01534b31c1dd87c81645fd762482a90027754041ca1b56133d0466c06',
    bandersnatch_secret_seed:
      '0x75e73b8364bf4753c5802021c6aa6548cddb63fe668e3cacf7b48cdb6824bb09',
    bandersnatch_public:
      '0x2105650944fcd101621fd5bb3124c9fd191d114b7ad936c1d79d734f9f21392e',
    dnsAltName: 'elfaiiixcuzmzroa34lajwp52cdsucikaxdviaoeuvnygdi3imtba',
  },
}

describe('Key Generation', () => {
  describe('Deterministic Behavior', () => {
    it('should generate the same keys for the same index multiple times', () => {
      const index = 0
      const keys1 = generateValidatorKeys(index)
      const keys2 = generateValidatorKeys(index)
      const keys3 = generateValidatorKeys(index)

      expect(keys1).toEqual(keys2)
      expect(keys2).toEqual(keys3)
      expect(keys1).toEqual(keys3)
    })

    it('should generate different keys for different indices', () => {
      const keys0 = generateValidatorKeys(0)
      const keys1 = generateValidatorKeys(1)
      const keys2 = generateValidatorKeys(2)

      expect(keys0).not.toEqual(keys1)
      expect(keys1).not.toEqual(keys2)
      expect(keys0).not.toEqual(keys2)
    })

    it('should generate consistent seeds for the same index', () => {
      const index = 42
      const keys1 = generateValidatorKeys(index)
      const keys2 = generateValidatorKeys(index)

      expect(keys1.seed).toBe(keys2.seed)
    })

    it('should generate different seeds for different indices', () => {
      const keys0 = generateValidatorKeys(0)
      const keys1 = generateValidatorKeys(1)

      expect(keys0.seed).not.toBe(keys1.seed)
    })
  })

  describe('Seed Generation', () => {
    it('should generate correct seed pattern for index 0', () => {
      const keys = generateValidatorKeys(0)
      expect(keys.seed).toBe(
        '0x0000000000000000000000000000000000000000000000000000000000000000',
      )
    })

    it('should generate correct seed pattern for index 1', () => {
      const keys = generateValidatorKeys(1)
      expect(keys.seed).toBe(
        '0x0100000001000000010000000100000001000000010000000100000001000000',
      )
    })

    it('should generate correct seed pattern for index 255', () => {
      const keys = generateValidatorKeys(255)
      expect(keys.seed).toBe(
        '0xff000000ff000000ff000000ff000000ff000000ff000000ff000000ff000000',
      )
    })

    it('should generate correct seed pattern for index 65535', () => {
      const keys = generateValidatorKeys(65535)
      expect(keys.seed).toBe(
        '0xffff0000ffff0000ffff0000ffff0000ffff0000ffff0000ffff0000ffff0000',
      )
    })
  })

  describe('Key Format Validation', () => {
    it('should generate valid hex strings for all keys', () => {
      const keys = generateValidatorKeys(0)

      // Check that all keys are valid hex strings
      expect(keys.seed).toMatch(/^0x[0-9a-f]{64}$/)
      expect(keys.ed25519_secret_seed).toMatch(/^0x[0-9a-f]{64}$/)
      expect(keys.ed25519_public).toMatch(/^0x[0-9a-f]{64}$/)
      expect(keys.bandersnatch_secret_seed).toMatch(/^0x[0-9a-f]{64}$/)
      expect(keys.bandersnatch_public).toMatch(/^0x[0-9a-f]{64}$/)
    })

    it('should generate valid DNS alternative names', () => {
      const keys = generateValidatorKeys(0)

      // DNS names should be base32-like and 52 characters
      expect(keys.dnsAltName).toMatch(/^[a-z2-7]{52}$/)
      expect(keys.dnsAltName.length).toBe(52)
    })

    it('should generate different DNS names for different indices', () => {
      const keys0 = generateValidatorKeys(0)
      const keys1 = generateValidatorKeys(1)

      expect(keys0.dnsAltName).not.toBe(keys1.dnsAltName)
    })
  })

  describe('JAM Documentation Compliance', () => {
    Object.entries(EXPECTED_KEYS).forEach(([name, expected]) => {
      it(`should generate correct keys for ${name}`, () => {
        const keys = generateValidatorKeys(expected.index)

        expect(keys.seed).toBe(expected.seed)
        expect(keys.ed25519_secret_seed).toBe(expected.ed25519_secret_seed)
        expect(keys.ed25519_public).toBe(expected.ed25519_public)
        expect(keys.bandersnatch_secret_seed).toBe(
          expected.bandersnatch_secret_seed,
        )
        expect(keys.bandersnatch_public).toBe(expected.bandersnatch_public)
        expect(keys.dnsAltName).toBe(expected.dnsAltName)
      })
    })
  })

  describe('Edge Cases', () => {
    it('should handle index 0 correctly', () => {
      const keys = generateValidatorKeys(0)
      expect(keys.seed).toBe(
        '0x0000000000000000000000000000000000000000000000000000000000000000',
      )
    })

    it('should handle large indices correctly', () => {
      const keys = generateValidatorKeys(4294967295) // Max 32-bit unsigned int
      expect(keys.seed).toBe(
        '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
      )
    })

    it('should handle negative indices (wrapped to positive)', () => {
      const keys = generateValidatorKeys(-1)
      // Should wrap to 4294967295 due to 32-bit unsigned arithmetic
      expect(keys.seed).toBe(
        '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
      )
    })
  })

  describe('Performance', () => {
    it('should generate keys quickly for multiple indices', () => {
      const startTime = Date.now()

      for (let i = 0; i < 1000; i++) {
        generateValidatorKeys(i)
      }

      const endTime = Date.now()
      const duration = endTime - startTime

      // Should complete 1000 key generations in under 1 second
      expect(duration).toBeLessThan(1000)
    })
  })

  describe('Cryptographic Properties', () => {
    it('should generate different Ed25519 keys for different indices', () => {
      const keys0 = generateValidatorKeys(0)
      const keys1 = generateValidatorKeys(1)
      const keys2 = generateValidatorKeys(2)

      expect(keys0.ed25519_public).not.toBe(keys1.ed25519_public)
      expect(keys1.ed25519_public).not.toBe(keys2.ed25519_public)
      expect(keys0.ed25519_public).not.toBe(keys2.ed25519_public)
    })

    it('should generate different Bandersnatch keys for different indices', () => {
      const keys0 = generateValidatorKeys(0)
      const keys1 = generateValidatorKeys(1)
      const keys2 = generateValidatorKeys(2)

      expect(keys0.bandersnatch_public).not.toBe(keys1.bandersnatch_public)
      expect(keys1.bandersnatch_public).not.toBe(keys2.bandersnatch_public)
      expect(keys0.bandersnatch_public).not.toBe(keys2.bandersnatch_public)
    })

    it('should generate different secret seeds for different indices', () => {
      const keys0 = generateValidatorKeys(0)
      const keys1 = generateValidatorKeys(1)

      expect(keys0.ed25519_secret_seed).not.toBe(keys1.ed25519_secret_seed)
      expect(keys0.bandersnatch_secret_seed).not.toBe(
        keys1.bandersnatch_secret_seed,
      )
    })
  })
})
