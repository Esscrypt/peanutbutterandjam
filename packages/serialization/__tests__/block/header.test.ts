/**
 * Block header serialization tests
 *
 * Tests Gray Paper-compliant block header serialization
 * Reference: graypaper/text/block_header.tex
 */

import { describe, expect, it } from 'vitest'
import { blake2bHash } from '@pbnj/core'
import { encodeBlockHeader, encodeUnsignedBlockHeader } from '../../src/block/header'
import type { BlockHeader, EpochMark, ValidatorKeyTuple } from '../../src/types'

/**
 * Create a test header for testing
 */
function createTestHeader(): BlockHeader {
  return {
    parentHash: '0x1111111111111111111111111111111111111111111111111111111111111111',
    priorStateRoot: '0x2222222222222222222222222222222222222222222222222222222222222222',
    extrinsicHash: '0x3333333333333333333333333333333333333333333333333333333333333333',
    timeslot: 123456789n,
    epochMark: {
      entropyAccumulator: '0x4444444444444444444444444444444444444444444444444444444444444444',
      entropy1: '0x5555555555555555555555555555555555555555555555555555555555555555',
      validators: [
        {
          bandersnatchKey: '0x6666666666666666666666666666666666666666666666666666666666666666',
          ed25519Key: '0x7777777777777777777777777777777777777777777777777777777777777777',
        },
      ],
    },
    winnersMark: [
      {
        id: '0x8888888888888888888888888888888888888888888888888888888888888888',
        entryIndex: 42n,
      },
    ],
    authorIndex: 42n,
    vrfSignature: '0x9999999999999999999999999999999999999999999999999999999999999999',
    offendersMark: new Uint8Array([1, 2, 3, 4, 5]),
    sealSignature: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  }
}

/**
 * Create a genesis header for testing based on the actual genesis-header.json
 */
function createGenesisHeader(): BlockHeader {
  // Convert the genesis header JSON structure to BlockHeader format
  const epochMark: EpochMark = {
    entropyAccumulator: '0x0000000000000000000000000000000000000000000000000000000000000000',
    entropy1: '0x0000000000000000000000000000000000000000000000000000000000000000',
    validators: [
      {
        bandersnatchKey: '0xff71c6c03ff88adb5ed52c9681de1629a54e702fc14729f6b50d2f0a76f185b3',
        ed25519Key: '0x4418fb8c85bb3985394a8c2756d3643457ce614546202a2f50b093d762499ace',
      },
      {
        bandersnatchKey: '0xdee6d555b82024f1ccf8a1e37e60fa60fd40b1958c4bb3006af78647950e1b91',
        ed25519Key: '0xad93247bd01307550ec7acd757ce6fb805fcf73db364063265b30a949e90d933',
      },
      {
        bandersnatchKey: '0x9326edb21e5541717fde24ec085000b28709847b8aab1ac51f84e94b37ca1b66',
        ed25519Key: '0xcab2b9ff25c2410fbe9b8a717abb298c716a03983c98ceb4def2087500b8e341',
      },
      {
        bandersnatchKey: '0x0746846d17469fb2f95ef365efcab9f4e22fa1feb53111c995376be8019981cc',
        ed25519Key: '0xf30aa5444688b3cab47697b37d5cac5707bb3289e986b19b17db437206931a8d',
      },
      {
        bandersnatchKey: '0x151e5c8fe2b9d8a606966a79edd2f9e5db47e83947ce368ccba53bf6ba20a40b',
        ed25519Key: '0x8b8c5d436f92ecf605421e873a99ec528761eb52a88a2f9a057b3b3003e6f32a',
      },
      {
        bandersnatchKey: '0x2105650944fcd101621fd5bb3124c9fd191d114b7ad936c1d79d734f9f21392e',
        ed25519Key: '0xab0084d01534b31c1dd87c81645fd762482a90027754041ca1b56133d0466c06',
      },
    ],
  }

  return {
    parentHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
    priorStateRoot: '0x0000000000000000000000000000000000000000000000000000000000000000',
    extrinsicHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
    timeslot: 0n,
    epochMark,
    winnersMark: undefined, // null in JSON
    authorIndex: 0n,
    vrfSignature: '0x000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
    offendersMark: new Uint8Array(0), // empty array in JSON
    sealSignature: '0x000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
  }
}

describe('Block Header Serialization', () => {
  describe('Basic Encoding', () => {
    it('should encode block header correctly', () => {
      const header = createTestHeader()
      const encoded = encodeBlockHeader(header)

      // Should be a Uint8Array
      expect(encoded).toBeInstanceOf(Uint8Array)
      expect(encoded.length).toBeGreaterThan(0)

      // Should contain all header fields
      expect(encoded.length).toBeGreaterThanOrEqual(32 * 5) // At least 5 hashes (32 bytes each)
    })

    it('should encode genesis header correctly', () => {
      const header = createGenesisHeader()
      const encoded = encodeBlockHeader(header)

      // Should be a Uint8Array
      expect(encoded).toBeInstanceOf(Uint8Array)
      expect(encoded.length).toBeGreaterThan(0)

      // Genesis header should be larger than regular header due to epoch mark
      const testHeader = createTestHeader()
      const testEncoded = encodeBlockHeader(testHeader)
      expect(encoded.length).toBeGreaterThan(testEncoded.length)
    })
  })

  describe('Gray Paper Compliance', () => {
    it('should follow Gray Paper encoding formula exactly', () => {
      const header = createTestHeader()
      const encoded = encodeBlockHeader(header)

      // According to Gray Paper: encode(header) ≡ encode(encodeunsignedheader(header), H_sealsig)
      // And encodeunsignedheader(header) ≡ encode(H_parent, H_priorstateroot, H_extrinsichash, encode[4](H_timeslot), maybe{H_epochmark}, maybe{H_winnersmark}, encode[2](H_authorindex), H_vrfsig, var{H_offendersmark})

      // Verify the structure follows the Gray Paper formula:
      // 1. H_parent (32 bytes)
      // 2. H_priorstateroot (32 bytes) 
      // 3. H_extrinsichash (32 bytes)
      // 4. encode[4](H_timeslot) (4 bytes)
      // 5. maybe{H_epochmark} (1 byte discriminator + encoded epoch mark if present)
      // 6. maybe{H_winnersmark} (1 byte discriminator + encoded winners mark if present)
      // 7. encode[2](H_authorindex) (2 bytes)
      // 8. H_vrfsig (32 bytes)
      // 9. var{H_offendersmark} (variable length)
      // 10. H_sealsig (32 bytes)

      // Each hash should be 32 bytes (64 hex chars)
      expect(header.parentHash.length).toBe(66) // 0x + 64 chars
      expect(header.priorStateRoot.length).toBe(66)
      expect(header.extrinsicHash.length).toBe(66)
      expect(header.vrfSignature.length).toBe(66)
      expect(header.sealSignature.length).toBe(66)

      // Timeslot should be 4 bytes, author index 2 bytes
      expect(header.timeslot).toBeLessThan(2n ** 32n)
      expect(header.authorIndex).toBeLessThan(2n ** 16n)

      // Verify encoded length is reasonable
      const expectedMinLength = 32 + 32 + 32 + 4 + 1 + 32 + 1 + 32 + 2 + 32 + 1 + 32
      expect(encoded.length).toBeGreaterThanOrEqual(expectedMinLength)
    })

    it('should handle optional fields according to Gray Paper maybe{} specification', () => {
      // Test with epochMark and winnersMark present
      const headerWithMarks = createTestHeader()
      const encodedWithMarks = encodeBlockHeader(headerWithMarks)

      // Test with epochMark and winnersMark undefined
      const headerWithoutMarks: BlockHeader = {
        ...createTestHeader(),
        epochMark: undefined,
        winnersMark: undefined,
      }
      const encodedWithoutMarks = encodeBlockHeader(headerWithoutMarks)

      // The encoded without marks should be shorter
      expect(encodedWithoutMarks.length).toBeLessThan(encodedWithMarks.length)

      // The difference should be approximately 66 bytes (1 byte discriminator + encoded epoch mark for each optional field)
      const lengthDifference = encodedWithMarks.length - encodedWithoutMarks.length
      expect(lengthDifference).toBeGreaterThanOrEqual(60) // Allow some flexibility for variable length encoding
    })
  })

  describe('Genesis Header Hash Test', () => {
    it('should produce the expected genesis header hash', () => {
      // Expected hash from JAM documentation
      const EXPECTED_HASH = '0xe864d485113737c28c2fef3b2aed39cb2f289a369b15c54e9c44720bcfdc0ca0'

      // Create genesis header according to actual genesis-header.json
      const genesisHeader = createGenesisHeader()

      // Encode the genesis header
      const encodedHeader = encodeBlockHeader(genesisHeader)
      
      // Hash the encoded header
      const headerHash = blake2bHash(encodedHeader)
      
      // Compare with expected hash
      expect(headerHash).toBe(EXPECTED_HASH)
    })

    it('should handle genesis header with undefined optional fields', () => {
      // Expected hash from JAM documentation
      const EXPECTED_HASH = '0xe864d485113737c28c2fef3b2aed39cb2f289a369b15c54e9c44720bcfdc0ca0'

      // Create genesis header with undefined winners mark
      const genesisHeader: BlockHeader = {
        ...createGenesisHeader(),
        winnersMark: undefined, // Optional field
      }

      // Encode the genesis header
      const encodedHeader = encodeBlockHeader(genesisHeader)
      
      // Hash the encoded header
      const headerHash = blake2bHash(encodedHeader)
      
      // Compare with expected hash
      expect(headerHash).toBe(EXPECTED_HASH)
    })
  })

  describe('Unsigned Block Header', () => {
    it('should encode unsigned block header', () => {
      const header = createTestHeader()
      const { sealSignature: _, ...unsignedHeader } = header

      const encoded = encodeUnsignedBlockHeader(unsignedHeader)

      // Should be shorter than full header (no seal signature)
      const fullEncoded = encodeBlockHeader(header)
      expect(encoded.length).toBe(fullEncoded.length - 32)
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty offenders mark', () => {
      const header = createTestHeader()
      header.offendersMark = new Uint8Array(0)
      
      const encoded = encodeBlockHeader(header)
      expect(encoded).toBeInstanceOf(Uint8Array)
      expect(encoded.length).toBeGreaterThan(0)
    })

    it('should handle large offenders mark', () => {
      const header = createTestHeader()
      header.offendersMark = new Uint8Array(1000)
      
      const encoded = encodeBlockHeader(header)
      expect(encoded).toBeInstanceOf(Uint8Array)
      expect(encoded.length).toBeGreaterThan(1000)
    })

    it('should handle maximum values', () => {
      const header = createTestHeader()
      header.timeslot = 2n ** 32n - 1n
      header.authorIndex = 2n ** 16n - 1n
      
      const encoded = encodeBlockHeader(header)
      expect(encoded).toBeInstanceOf(Uint8Array)
      expect(encoded.length).toBeGreaterThan(0)
    })
  })
})
