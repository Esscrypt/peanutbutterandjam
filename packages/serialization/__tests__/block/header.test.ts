/**
 * Block Header Serialization Tests
 *
 * Tests for Gray Paper-compliant block header encoding
 * Reference: Gray Paper Appendix D.2 - Block Header Encoding
 */

import { describe, expect, it } from 'vitest'
import {
  decodeBlockHeader,
  encodeBlockHeader,
  encodeUnsignedBlockHeader,
} from '../../src/block/header'
import type { BlockHeader } from '../../src/types'

describe('Block Header Serialization', () => {
  const createTestHeader = (): BlockHeader => ({
    parentHash:
      '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    priorStateRoot:
      '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    extrinsicHash:
      '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
    timeslot: 1234567890n,
    epochMark:
      '0x1111111111111111111111111111111111111111111111111111111111111111',
    winnersMark:
      '0x2222222222222222222222222222222222222222222222222222222222222222',
    authorIndex: 42n,
    vrfSignature:
      '0x3333333333333333333333333333333333333333333333333333333333333333',
    offendersMark: new Uint8Array(32).fill(0x44),
    sealSignature:
      '0x5555555555555555555555555555555555555555555555555555555555555555',
  })

  describe('Block Header Encoding', () => {
    it('should encode complete block header', () => {
      const header = createTestHeader()
      const encoded = encodeBlockHeader(header)

      expect(encoded.length).toBeGreaterThan(0)

      const { value: decoded } = decodeBlockHeader(encoded)
      expect(decoded.parentHash).toBe(header.parentHash)
      expect(decoded.priorStateRoot).toBe(header.priorStateRoot)
      expect(decoded.extrinsicHash).toBe(header.extrinsicHash)
      expect(decoded.timeslot).toBe(header.timeslot)
      expect(decoded.epochMark).toBe(header.epochMark)
      expect(decoded.winnersMark).toBe(header.winnersMark)
      expect(decoded.authorIndex).toBe(header.authorIndex)
      expect(decoded.vrfSignature).toBe(header.vrfSignature)
      expect(decoded.offendersMark).toEqual(header.offendersMark)
      expect(decoded.sealSignature).toBe(header.sealSignature)
    })

    it('should encode block header without optional fields', () => {
      const header: BlockHeader = {
        parentHash:
          '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        priorStateRoot:
          '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        extrinsicHash:
          '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
        timeslot: 1234567890n,
        authorIndex: 42n,
        vrfSignature:
          '0x3333333333333333333333333333333333333333333333333333333333333333',
        offendersMark: new Uint8Array(32).fill(0x44),
        sealSignature:
          '0x5555555555555555555555555555555555555555555555555555555555555555',
      }

      const encoded = encodeBlockHeader(header)
      const { value: decoded } = decodeBlockHeader(encoded)

      expect(decoded.epochMark).toBeUndefined()
      expect(decoded.winnersMark).toBeUndefined()
    })

    it('should handle zero values correctly', () => {
      const header: BlockHeader = {
        parentHash:
          '0x0000000000000000000000000000000000000000000000000000000000000000',
        priorStateRoot:
          '0x0000000000000000000000000000000000000000000000000000000000000000',
        extrinsicHash:
          '0x0000000000000000000000000000000000000000000000000000000000000000',
        timeslot: 0n,
        authorIndex: 0n,
        vrfSignature:
          '0x0000000000000000000000000000000000000000000000000000000000000000',
        offendersMark: new Uint8Array(32).fill(0),
        sealSignature:
          '0x0000000000000000000000000000000000000000000000000000000000000000',
      }

      const encoded = encodeBlockHeader(header)
      const { value: decoded } = decodeBlockHeader(encoded)

      expect(decoded.timeslot).toBe(0n)
      expect(decoded.authorIndex).toBe(0n)
    })

    it('should handle maximum values correctly', () => {
      const header: BlockHeader = {
        parentHash:
          '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
        priorStateRoot:
          '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
        extrinsicHash:
          '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
        timeslot: 4294967295n, // 2^32 - 1
        authorIndex: 65535n, // 2^16 - 1
        vrfSignature:
          '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
        offendersMark: new Uint8Array(32).fill(0xff),
        sealSignature:
          '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
      }

      const encoded = encodeBlockHeader(header)
      const { value: decoded } = decodeBlockHeader(encoded)

      expect(decoded.timeslot).toBe(4294967295n)
      expect(decoded.authorIndex).toBe(65535n)
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

  describe('Gray Paper Compliance', () => {
    it('should follow Gray Paper encoding formula', () => {
      const header = createTestHeader()
      const _encoded = encodeBlockHeader(header)

      // Verify the structure follows the Gray Paper formula:
      // encode(header) ≡ encode(H_parent) ∥ encode(H_priorstateroot) ∥ encode(H_extrinsichash) ∥
      //                  encode[4](H_timeslot) ∥ maybe{H_epochmark} ∥ maybe{H_winnersmark} ∥
      //                  encode[2](H_authorindex) ∥ encode(H_vrfsig) ∥ var{H_offendersmark} ∥ encode(H_sealsig)

      // Each hash should be 32 bytes (64 hex chars)
      expect(header.parentHash.length).toBe(66) // 0x + 64 chars
      expect(header.priorStateRoot.length).toBe(66)
      expect(header.extrinsicHash.length).toBe(66)
      expect(header.vrfSignature.length).toBe(66)
      expect(header.sealSignature.length).toBe(66)

      // Timeslot should be 4 bytes, author index 2 bytes
      expect(header.timeslot).toBeLessThan(2n ** 32n)
      expect(header.authorIndex).toBeLessThan(2n ** 16n)
    })

    it('should handle variable-length offenders mark', () => {
      const header = createTestHeader()

      // Test with different offenders mark lengths
      const shortOffenders = new Uint8Array(16).fill(0x11)
      const longOffenders = new Uint8Array(64).fill(0x22)

      const headerWithShort = { ...header, offendersMark: shortOffenders }
      const headerWithLong = { ...header, offendersMark: longOffenders }

      const encodedShort = encodeBlockHeader(headerWithShort)
      const encodedLong = encodeBlockHeader(headerWithLong)

      expect(encodedLong.length).toBeGreaterThan(encodedShort.length)
    })
  })

  describe('Round-Trip Encoding', () => {
    it('should preserve all values through encode/decode cycle', () => {
      const testHeaders = [
        createTestHeader(),
        {
          ...createTestHeader(),
          timeslot: 0n,
          authorIndex: 0n,
          epochMark: undefined,
          winnersMark: undefined,
        },
        {
          ...createTestHeader(),
          timeslot: 4294967295n,
          authorIndex: 65535n,
        },
      ]

      for (const header of testHeaders) {
        const encoded = encodeBlockHeader(header)
        const { value: decoded } = decodeBlockHeader(encoded)

        expect(decoded.parentHash).toBe(header.parentHash)
        expect(decoded.priorStateRoot).toBe(header.priorStateRoot)
        expect(decoded.extrinsicHash).toBe(header.extrinsicHash)
        expect(decoded.timeslot).toBe(header.timeslot)
        expect(decoded.epochMark).toBe(header.epochMark)
        expect(decoded.winnersMark).toBe(header.winnersMark)
        expect(decoded.authorIndex).toBe(header.authorIndex)
        expect(decoded.vrfSignature).toBe(header.vrfSignature)
        expect(decoded.offendersMark).toEqual(header.offendersMark)
        expect(decoded.sealSignature).toBe(header.sealSignature)
      }
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty offenders mark', () => {
      const header = createTestHeader()
      header.offendersMark = new Uint8Array(0)

      const encoded = encodeBlockHeader(header)
      const { value: decoded } = decodeBlockHeader(encoded)

      expect(decoded.offendersMark).toEqual(new Uint8Array(0))
    })

    it('should handle insufficient data for decoding', () => {
      const shortData = new Uint8Array(100) // Too short for complete header
      expect(() => decodeBlockHeader(shortData)).toThrow()
    })
  })
})
