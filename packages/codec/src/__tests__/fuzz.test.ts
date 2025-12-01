import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'fs'
import { join } from 'path'
import { bytesToHex, hexToBytes } from '@pbnj/core'
import {
  FuzzMessageType,
  type FuzzPeerInfo,
  type FuzzMessage,
  type IConfigService,
  type StateRoot,
  type ErrorMessage,
  type Block,
} from '@pbnj/types'
import { decodeFuzzMessage, encodeFuzzMessage } from '../fuzz'
import { decodeBlock, encodeBlock } from '../block/body'
import { ConfigService } from '../../../../infra/node/services/config-service'

describe('JAM Conformance Protocol Codec', () => {
  const config: IConfigService = new ConfigService('tiny')

  describe('README Examples', () => {
    /**
     * Test against examples from README.md
     * Reference: https://github.com/gavofyork/graypaper/blob/main/fuzz/fuzz-v1.asn
     */
    
    it('should encode PeerInfo to match README example', () => {
      // From README: PeerInfo example
      const peerInfo: FuzzPeerInfo = {
        fuzz_version: 1,
        fuzz_features: 2,
        jam_version: { major: 0, minor: 7, patch: 0 },
        app_version: { major: 0, minor: 1, patch: 25 },
        app_name: 'fuzzer',
      }

      const message: FuzzMessage = {
        type: FuzzMessageType.PeerInfo,
        payload: peerInfo,
      }

      const encoded = encodeFuzzMessage(message, config)
      // README shows: 0x0001020000000007000001190666757a7a6572
      // This is the message payload WITHOUT length prefix
      // encodeFuzzMessage now returns: [discriminant][payload] (no length prefix)
      // The length prefix is added by the transport layer (sendMessage)
      
      expect(bytesToHex(encoded)).toBe('0x0001020000000007000001190666757a7a6572')
    })

    it('should decode PeerInfo from README example', () => {
      // README encoded value (message payload: discriminant + content, no length prefix)
      const encodedPayload = hexToBytes('0x0001020000000007000001190666757a7a6572')
      
      const decoded = decodeFuzzMessage(encodedPayload, config)
      expect(decoded.type).toBe(FuzzMessageType.PeerInfo)
      
      const payload = decoded.payload as FuzzPeerInfo
      expect(payload.fuzz_version).toBe(1)
      expect(payload.fuzz_features).toBe(2)
      expect(payload.jam_version).toEqual({ major: 0, minor: 7, patch: 0 })
      expect(payload.app_version).toEqual({ major: 0, minor: 1, patch: 25 })
      expect(payload.app_name).toBe('fuzzer')
    })

    it('should encode StateRoot to match README example', () => {
      // From README: StateRoot example
      const stateRootHash = '0x4559342d3a32a8cbc3c46399a80753abff8bf785aa9d6f623e0de045ba6701fe'
      const message: FuzzMessage = {
        type: FuzzMessageType.StateRoot,
        payload: { state_root: stateRootHash as `0x${string}` },
      }

      const encoded = encodeFuzzMessage(message, config)
      // README shows: 0x024559342d3a32a8cbc3c46399a80753abff8bf785aa9d6f623e0de045ba6701fe
      // This is the message payload WITHOUT length prefix
      // encodeFuzzMessage now returns: [discriminant][payload] (no length prefix)
      
      expect(bytesToHex(encoded)).toBe('0x024559342d3a32a8cbc3c46399a80753abff8bf785aa9d6f623e0de045ba6701fe')
    })

    it('should decode StateRoot from README example', () => {
      // README encoded value (message payload only, no length prefix)
      const encodedPayload = hexToBytes('0x024559342d3a32a8cbc3c46399a80753abff8bf785aa9d6f623e0de045ba6701fe')
      
      const decoded = decodeFuzzMessage(encodedPayload, config)
      expect(decoded.type).toBe(FuzzMessageType.StateRoot)
      
      const payload = decoded.payload as StateRoot
      expect(payload.state_root).toBe('0x4559342d3a32a8cbc3c46399a80753abff8bf785aa9d6f623e0de045ba6701fe')
    })

    it('should encode Error to match README example', () => {
      // From README: Error example
      const errorMessage = 'Chain error: block execution failure: preimages error: preimage not required'
      const message: FuzzMessage = {
        type: FuzzMessageType.Error,
        payload: { error: errorMessage },
      }

      const encoded = encodeFuzzMessage(message, config)
      // README shows: 0xff4c436861696e206572726f723a20626c6f636b20657865637574696f6e206661696c7572653a20707265696d61676573206572726f723a20707265696d616765206e6f74207265717569726564
      // This is the message payload WITHOUT length prefix
      // encodeFuzzMessage now returns: [discriminant][payload] (no length prefix)
      
      expect(bytesToHex(encoded)).toBe('0xff4c436861696e206572726f723a20626c6f636b20657865637574696f6e206661696c7572653a20707265696d61676573206572726f723a20707265696d616765206e6f74207265717569726564')
    })

    it('should decode Error from README example', () => {
      // README encoded value (message payload only, no length prefix)
      const encodedPayload = hexToBytes('0xff4c436861696e206572726f723a20626c6f636b20657865637574696f6e206661696c7572653a20707265696d61676573206572726f723a20707265696d616765206e6f74207265717569726564')
      
      const decoded = decodeFuzzMessage(encodedPayload, config)
      expect(decoded.type).toBe(FuzzMessageType.Error)
      
      const payload = decoded.payload as ErrorMessage
      expect(payload.error).toBe('Chain error: block execution failure: preimages error: preimage not required')
    })

    it('should round-trip encode/decode PeerInfo from README example', () => {
      const peerInfo: FuzzPeerInfo = {
        fuzz_version: 1,
        fuzz_features: 2,
        jam_version: { major: 0, minor: 7, patch: 0 },
        app_version: { major: 0, minor: 1, patch: 25 },
        app_name: 'fuzzer',
      }

      const message: FuzzMessage = {
        type: FuzzMessageType.PeerInfo,
        payload: peerInfo,
      }

      const encoded = encodeFuzzMessage(message, config)
      const decoded = decodeFuzzMessage(encoded, config)
      
      expect(decoded.type).toBe(FuzzMessageType.PeerInfo)
      const decodedPayload = decoded.payload as FuzzPeerInfo
      expect(decodedPayload).toEqual(peerInfo)
    })

    it('should round-trip encode/decode StateRoot from README example', () => {
      const stateRootHash = '0x4559342d3a32a8cbc3c46399a80753abff8bf785aa9d6f623e0de045ba6701fe'
      const message: FuzzMessage = {
        type: FuzzMessageType.StateRoot,
        payload: { state_root: stateRootHash as `0x${string}` },
      }

      const encoded = encodeFuzzMessage(message, config)
      const decoded = decodeFuzzMessage(encoded, config)
      
      expect(decoded.type).toBe(FuzzMessageType.StateRoot)
      const decodedPayload = decoded.payload as StateRoot
      expect(decodedPayload.state_root).toBe(stateRootHash)
    })

    it('should round-trip encode/decode Error from README example', () => {
      const errorMessage = 'Chain error: block execution failure: preimages error: preimage not required'
      const message: FuzzMessage = {
        type: FuzzMessageType.Error,
        payload: { error: errorMessage },
      }

      const encoded = encodeFuzzMessage(message, config)
      const decoded = decodeFuzzMessage(encoded, config)
      
      expect(decoded.type).toBe(FuzzMessageType.Error)
      const decodedPayload = decoded.payload as ErrorMessage
      expect(decodedPayload.error).toBe(errorMessage)
    })
  })
  it('should encode and decode PeerInfo correctly', () => {
    const peerInfo: FuzzPeerInfo = {
      fuzz_version: 1,
      fuzz_features: 2,
      jam_version: { major: 0, minor: 7, patch: 0 },
      app_version: { major: 0, minor: 1, patch: 25 },
      app_name: 'fuzzer',
    }

    const message: FuzzMessage = {
      type: FuzzMessageType.PeerInfo,
      payload: peerInfo,
    }

    const encoded = encodeFuzzMessage(message, config)
    // encodeFuzzMessage returns: [discriminant][payload] (no length prefix)
    // Expected: 00 + 01 + 02000000 + 000700 + 000119 + 06 + "fuzzer"
    // "fuzzer" hex: 66757a7a6572
    // Payload hex: 0001020000000007000001190666757a7a6572

    expect(bytesToHex(encoded)).toBe('0x0001020000000007000001190666757a7a6572')

    // decodeFuzzMessage expects: [discriminant][payload] (no length prefix)
    const decoded = decodeFuzzMessage(encoded, config)
    expect(decoded.type).toBe(FuzzMessageType.PeerInfo)
    expect((decoded.payload as FuzzPeerInfo).app_name).toBe('fuzzer')
    expect((decoded.payload as FuzzPeerInfo).fuzz_features).toBe(2)
  })

  it('should encode and decode StateRoot correctly', () => {
    const stateRootHash = '0x4545454545454545454545454545454545454545454545454545454545454545'
    const message: FuzzMessage = {
      type: FuzzMessageType.StateRoot,
      payload: { state_root: stateRootHash as `0x${string}` },
    }

    const encoded = encodeFuzzMessage(message, config)
    // encodeFuzzMessage returns: [discriminant][payload] (no length prefix)
    // Payload: 02 + 32 bytes
    
    const decoded = decodeFuzzMessage(encoded, config)
    expect(decoded.type).toBe(FuzzMessageType.StateRoot)
    expect((decoded.payload as any).state_root).toBe(stateRootHash)
  })

  it('should encode and decode ImportBlock correctly', () => {
    // Load a valid block from test vectors (required for this test)
    const testVectorsDir = join(__dirname, '../../../../submodules/jamtestvectors/codec/full')
    const binaryPath = join(testVectorsDir, 'block.bin')
    
    let validBlock: Block
    try {
      const binaryData = readFileSync(binaryPath)
      const [error, decodedBlock] = decodeBlock(binaryData, config)
      if (error) {
        throw new Error(`Failed to decode test vector block: ${error.message}`)
      }
      validBlock = decodedBlock.value
    } catch (err) {
      // Skip test if test vectors are not available
      // A valid block requires proper structure that matches the config
      // which is best obtained from test vectors
      if (err instanceof Error && err.message.includes('ENOENT')) {
        console.warn(`Skipping test: Test vectors not available at ${binaryPath}. Please initialize jamtestvectors submodule.`)
        return
      }
      throw err
    }

    // Verify that encodeBlock produces non-empty output
    const [encodeError, encodedBlockData] = encodeBlock(validBlock, config)
    if (encodeError) {
      throw new Error(`Failed to encode block: ${encodeError.message}`)
    }
    expect(encodedBlockData.length).toBeGreaterThan(0)
    expect(encodedBlockData).toBeInstanceOf(Uint8Array)

    const message: FuzzMessage = {
      type: FuzzMessageType.ImportBlock,
      payload: { block: validBlock },
    }

    // Encode the fuzz message with error handling
    let encoded: Uint8Array
    try {
      encoded = encodeFuzzMessage(message, config)
      expect(encoded.length).toBeGreaterThan(4) // At least length prefix + discriminant
      
      // Debug: Verify the structure
      const messagePayload = encoded.subarray(4) // Skip 4-byte length prefix
      const discriminant = messagePayload[0]
      const importBlockPayload = messagePayload.subarray(1) // Skip discriminant
      
      expect(discriminant).toBe(0x03) // ImportBlock discriminant
      expect(importBlockPayload.length).toBeGreaterThan(0)
      
      if (importBlockPayload.length === 0) {
        throw new Error(
          `Encoded ImportBlock payload is empty. ` +
          `Total encoded length: ${encoded.length}, ` +
          `Message payload length: ${messagePayload.length}, ` +
          `Block encoded length: ${encodedBlockData.length}`
        )
      }
    } catch (err) {
      throw new Error(`Failed to encode ImportBlock message: ${err instanceof Error ? err.message : String(err)}`)
    }

    // Decode the fuzz message with error handling
    let decoded: FuzzMessage
    try {
      // encodeFuzzMessage returns: [discriminant][payload] (no length prefix)
      // decodeFuzzMessage expects: [discriminant][payload] (no length prefix)
      if (encoded.length === 0) {
        throw new Error(`Encoded message is empty`)
      }
      decoded = decodeFuzzMessage(encoded, config)
    } catch (err) {
      throw new Error(`Failed to decode ImportBlock message: ${err instanceof Error ? err.message : String(err)}`)
    }

    expect(decoded.type).toBe(FuzzMessageType.ImportBlock)
    expect((decoded.payload as any).block).toBeDefined()
    expect((decoded.payload as any).block.header).toBeDefined()
    expect((decoded.payload as any).block.body).toBeDefined()
  })

  it('should differentiate ImportBlock and StateRoot', () => {
    // StateRoot (32 bytes)
    const stateRootMsg: FuzzMessage = {
      type: FuzzMessageType.StateRoot,
      payload: { state_root: ('0x' + '00'.repeat(32)) as `0x${string}` },
    }
    
    let encodedStateRoot: Uint8Array
    try {
      encodedStateRoot = encodeFuzzMessage(stateRootMsg, config)
    } catch (err) {
      throw new Error(`Failed to encode StateRoot message: ${err instanceof Error ? err.message : String(err)}`)
    }
    
    let decodedStateRoot: FuzzMessage
    try {
      // encodeFuzzMessage returns: [discriminant][payload] (no length prefix)
      decodedStateRoot = decodeFuzzMessage(encodedStateRoot, config)
    } catch (err) {
      throw new Error(`Failed to decode StateRoot message: ${err instanceof Error ? err.message : String(err)}`)
    }
    
    expect(decodedStateRoot.type).toBe(FuzzMessageType.StateRoot)

    // Load a valid block from test vectors (required for this test)
    const testVectorsDir = join(__dirname, '../../../../submodules/jamtestvectors/codec/full')
    const binaryPath = join(testVectorsDir, 'block.bin')
    
    let validBlock: Block
    try {
      const binaryData = readFileSync(binaryPath)
      const [error, decodedBlock] = decodeBlock(binaryData, config)
      if (error) {
        throw new Error(`Failed to decode test vector block: ${error.message}`)
      }
      validBlock = decodedBlock.value
    } catch (err) {
      // Skip test if test vectors are not available
      if (err instanceof Error && err.message.includes('ENOENT')) {
        console.warn(`Skipping test: Test vectors not available at ${binaryPath}. Please initialize jamtestvectors submodule.`)
        return
      }
      throw err
    }

    // Verify that encodeBlock produces non-empty output
    const [encodeError, encodedBlockData] = encodeBlock(validBlock, config)
    if (encodeError) {
      throw new Error(`Failed to encode block: ${encodeError.message}`)
    }
    expect(encodedBlockData.length).toBeGreaterThan(0)

    const blockMsg: FuzzMessage = {
      type: FuzzMessageType.ImportBlock,
      payload: { block: validBlock },
    }
    
    let encodedBlock: Uint8Array
    try {
      encodedBlock = encodeFuzzMessage(blockMsg, config)
      expect(encodedBlock.length).toBeGreaterThan(4) // At least length prefix + discriminant
    } catch (err) {
      throw new Error(`Failed to encode ImportBlock message: ${err instanceof Error ? err.message : String(err)}`)
    }
    
    let decodedBlock: FuzzMessage
    try {
      // encodeFuzzMessage returns: [discriminant][payload] (no length prefix)
      decodedBlock = decodeFuzzMessage(encodedBlock, config)
    } catch (err) {
      throw new Error(`Failed to decode ImportBlock message: ${err instanceof Error ? err.message : String(err)}`)
    }
    
    expect(decodedBlock.type).toBe(FuzzMessageType.ImportBlock)
    
    // Verify that ImportBlock and StateRoot produce different encodings
    expect(encodedBlock.length).not.toBe(encodedStateRoot.length)
  })
})
