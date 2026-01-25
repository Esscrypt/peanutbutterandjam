import { describe, it, expect } from 'bun:test'
import { hexToBytes, bytesToHex } from '@pbnjam/core'
import { decodeNetworkingMessage } from '../networking/message'

describe('Networking Message Decode', () => {
  it('should analyze the provided hex message structure', () => {
    // Message: 0x0049000000c63ee9132f8da544cc2c58ff83ad07f3f85ddf1386a185c8ce06fd
    const hexMessage = '0x0049000000c63ee9132f8da544cc2c58ff83ad07f3f85ddf1386a185c8ce06fd'
    const messageBytes = hexToBytes(hexMessage)

    console.log('\n=== Message Structure Analysis ===')
    console.log('Input hex:', hexMessage)
    console.log('Total bytes:', messageBytes.length)

    // Analyze the size prefix
    const sizePrefix = messageBytes.slice(0, 4)
    const sizeLE = new DataView(sizePrefix.buffer, sizePrefix.byteOffset).getUint32(0, true)
    console.log('\nSize prefix (4 bytes):', bytesToHex(sizePrefix))
    console.log('Size (little-endian):', sizeLE, `(0x${sizeLE.toString(16)})`)

    // Analyze what follows
    const afterSize = messageBytes.slice(4)
    console.log('Bytes after size prefix:', afterSize.length)
    console.log('Kind byte (byte 4):', `0x${afterSize[0]?.toString(16).padStart(2, '0') || '??'}`)
    console.log('Message content (bytes 5+):', bytesToHex(afterSize.slice(1)))

    // Try to decode
    console.log('\n=== Decoding Attempt ===')
    const [decodeError, decodedResult] = decodeNetworkingMessage(messageBytes)
    
    if (decodeError) {
      console.log('❌ Decode error (expected):', decodeError.message)
      console.log('\nReason: The size field indicates', sizeLE, 'bytes, but only', afterSize.length, 'bytes are available after the size prefix.')
      console.log('This message appears to be malformed or incomplete.')
      expect(decodeError).toBeDefined()
      return
    }

    // If decoding succeeded (unlikely)
    const { messageContent, consumed, remaining } = decodedResult.value

    console.log('✅ Decoded message:')
    console.log('  Message content length:', messageContent.length, 'bytes')
    console.log('  Message content (hex):', bytesToHex(messageContent))
    console.log('  Consumed bytes:', consumed)
    console.log('  Remaining bytes:', remaining.length)

    expect(messageContent).toBeDefined()
  })

  it('should show what a correctly formatted message would look like', () => {
    // Example: If the actual message content is 28 bytes (32 total - 4 size prefix)
    // and kind byte is 0x00, then the size should be 29 (1 kind byte + 28 content)
    const kindByte = 0x00
    const messageContent = hexToBytes('0xc63ee9132f8da544cc2c58ff83ad07f3f85ddf1386a185c8ce06fd')
    
    console.log('\n=== Correct Message Format Example ===')
    console.log('Kind byte:', `0x${kindByte.toString(16).padStart(2, '0')}`)
    console.log('Message content length:', messageContent.length, 'bytes')
    console.log('Expected size field:', 1 + messageContent.length, 'bytes (kind byte + content)')
    console.log('Size in hex (little-endian):', (1 + messageContent.length).toString(16).padStart(8, '0'))
    
    // Show what the correct encoding would be
    const correctSize = 1 + messageContent.length // 29 bytes
    const sizeBuffer = new ArrayBuffer(4)
    new DataView(sizeBuffer).setUint32(0, correctSize, true)
    const sizeBytes = new Uint8Array(sizeBuffer)
    
    console.log('Correct size prefix:', bytesToHex(sizeBytes))
    console.log('Full correct message would be:', bytesToHex(sizeBytes) + kindByte.toString(16).padStart(2, '0') + bytesToHex(messageContent))
  })
})

