import { describe, test, expect } from 'vitest'
import {
  encodeAccumulateInput,
  encodeVariableSequence,
  decodeAccumulateInput,
  decodeVariableSequence,
  decodeOperandTuple,
} from '@pbnjam/codec'
import { bytesToHex, hexToBytes } from '@pbnjam/core'
import type { OperandTuple, } from '@pbnjam/types'

describe('AccumulateInput Encoding', () => {
  /**
   * Test round-trip encoding/decoding of the 179-byte jamduna test vector
   *
   * The 179-byte hex is from submodules/jamduna/jam-test-vectors/0.7.2/preimages_light/00000002/0/0/accumulate_input
   * Gray Paper pvm_invocations.tex lines 359-360:
   * - Selector 14: encode{var{i}} where i is sequence{accinput}
   * - Gray Paper equation 126: accinput = operandtuple ∪ defxfer
   * - Gray Paper equations 279-292: OperandTuple and AccumulateInput encoding format
   *
   * Format: [sequence_length] [type_discriminator] [OperandTuple_fields...]
   * - Byte 0: sequence length (1 = one item)
   * - Byte 1: type discriminator (0 = OperandTuple)
   * - Bytes 2-33: packageHash (32 bytes)
   * - Bytes 34-65: segmentRoot (32 bytes)
   * - Bytes 66-97: authorizer (32 bytes)
   * - Bytes 98-129: payloadHash (32 bytes)
   * - Bytes 130-137: gasLimit (8 bytes, little-endian)
   * - Byte 138: result discriminator (0 = success)
   * - Bytes 139+: result blob length + data + authTrace length + data
   */
  test('should decode and re-encode the 179-byte jamduna test vector exactly', () => {
    const expectedHex =
      '0x010025d8314884a4162787493635f1da182a6fbc7b31b55c18ce74ea1369a7999f4500000000000000000000000000000000000000000000000000000000000000002357426f2313559a271d6782dc00197b379f79cbe3c6a1e72f61f7b592c509f8b5fd156d32aa8f25a91c80449f4e3bba4ea1e54aa9855b2ff53c32e42e7bc02de0809698002a0106f5d8957422098a7b2f007db98bce1bcf51c34311ab19671e7f5dcaadf54e0d9f370000000000000000'
    const expectedBytes = hexToBytes(expectedHex)
    expect(expectedBytes.length).toBe(179)

    // First try decoding just the OperandTuple (skip seq length and type discriminator)
    const operandTupleBytes = expectedBytes.slice(2)
    console.log('Testing OperandTuple decode, bytes:', operandTupleBytes.length)
    const [otError, otResult] = decodeOperandTuple(operandTupleBytes)
    if (otError) {
      console.log('OperandTuple decode error:', otError.message)
    } else {
      console.log('OperandTuple decoded: gasLimit =', otResult.value.gasLimit)
      console.log('Consumed:', otResult.consumed, 'remaining:', otResult.remaining.length)
    }

    // Decode as variable sequence of AccumulateInput
    const [decodeError, decodeResult] = decodeVariableSequence(
      expectedBytes,
      decodeAccumulateInput,
    )

    if (decodeError) {
      console.log('Sequence decode error:', decodeError.message)
    }
    expect(decodeError).toBeUndefined()
    expect(decodeResult).not.toBeNull()
    expect(decodeResult!.value.length).toBe(1) // One AccumulateInput
    expect(decodeResult!.consumed).toBe(179) // All bytes consumed
    expect(decodeResult!.remaining.length).toBe(0) // No remaining bytes

    const accumulateInput = decodeResult!.value[0]
    expect(accumulateInput.type).toBe(0) // OperandTuple

    // Verify OperandTuple fields
    const operandTuple = accumulateInput.value as OperandTuple
    expect(operandTuple.packageHash).toBe(
      '0x25d8314884a4162787493635f1da182a6fbc7b31b55c18ce74ea1369a7999f45',
    )
    expect(operandTuple.segmentRoot).toBe(
      '0x0000000000000000000000000000000000000000000000000000000000000000',
    )
    expect(operandTuple.authorizer).toBe(
      '0x2357426f2313559a271d6782dc00197b379f79cbe3c6a1e72f61f7b592c509f8',
    )
    expect(operandTuple.payloadHash).toBe(
      '0xb5fd156d32aa8f25a91c80449f4e3bba4ea1e54aa9855b2ff53c32e42e7bc02d',
    )
    // gasLimit uses natural encoding (Gray Paper):
    // e0 80 96 98 = natural encoding for 10,000,000
    // - e0 = 0b11100000: 3 leading 1 bits means l=3 (3 more bytes follow)
    // - prefix base = 256 - 32 = 224 = 0xe0, so high bits = 0
    // - low bits = 80 96 98 little-endian = 0x989680 = 10,000,000
    expect(operandTuple.gasLimit).toBe(10000000n)

    // Re-encode and verify round-trip
    const [encodeError, reEncoded] = encodeVariableSequence(
      [accumulateInput],
      encodeAccumulateInput,
    )

    expect(encodeError).toBeUndefined()
    expect(reEncoded).not.toBeNull()
    expect(reEncoded!.length).toBe(179)
    expect(bytesToHex(reEncoded!)).toBe(expectedHex)
  })

  test('should correctly parse OperandTuple result field from 179-byte vector', () => {
    const expectedHex =
      '0x010025d8314884a4162787493635f1da182a6fbc7b31b55c18ce74ea1369a7999f4500000000000000000000000000000000000000000000000000000000000000002357426f2313559a271d6782dc00197b379f79cbe3c6a1e72f61f7b592c509f8b5fd156d32aa8f25a91c80449f4e3bba4ea1e54aa9855b2ff53c32e42e7bc02de0809698002a0106f5d8957422098a7b2f007db98bce1bcf51c34311ab19671e7f5dcaadf54e0d9f370000000000000000'
    const expectedBytes = hexToBytes(expectedHex)

    // Decode as variable sequence of AccumulateInput
    const [decodeError, decodeResult] = decodeVariableSequence(
      expectedBytes,
      decodeAccumulateInput,
    )

    expect(decodeError).toBeUndefined()
    const operandTuple = decodeResult!.value[0].value as OperandTuple

    // Check result field - discriminator 0 = success, followed by var{blob}
    // Byte 138 is discriminator (should be 0 for success)
    // Bytes 139+ are length prefix + blob data
    expect(operandTuple.result).toBeInstanceOf(Uint8Array)

    // Expected result blob (from bytes after gasLimit)
    // After gasLimit (8 bytes at offset 130-137), we have:
    // - result discriminator (1 byte at 138)
    // - result blob length (variable, natural encoding)
    // - result blob data
    // - authTrace length (variable, natural encoding)
    // - authTrace data
    const resultHex = bytesToHex(operandTuple.result)
    console.log('Result blob:', resultHex, 'length:', operandTuple.result.length)

    // AuthTrace should be present
    console.log(
      'AuthTrace length:',
      operandTuple.authTrace.length,
      'data:',
      bytesToHex(operandTuple.authTrace),
    )
  })
  
  test('should handle empty AccumulateInput sequence', () => {
    // Empty sequence is encoded as just the length prefix 0x00
    const emptySequenceBytes = new Uint8Array([0])

    const [decodeError, decodeResult] = decodeVariableSequence(
      emptySequenceBytes,
      decodeAccumulateInput,
    )

    expect(decodeError).toBeUndefined()
    expect(decodeResult).not.toBeNull()
    expect(decodeResult!.value.length).toBe(0) // Empty sequence
    expect(decodeResult!.consumed).toBe(1) // Just the length prefix

    // Re-encode and verify round-trip
    const [encodeError, reEncoded] = encodeVariableSequence(
      [],
      encodeAccumulateInput,
    )

    expect(encodeError).toBeUndefined()
    expect(reEncoded).not.toBeNull()
    expect(reEncoded!.length).toBe(1)
    expect(reEncoded![0]).toBe(0)
  })
})
