import { describe, expect, it } from 'vitest'
import { encodePrivileges, decodePrivileges } from '../state/privileges'
import type { IConfigService, Privileges } from '@pbnj/types'

describe('Privileges Serialization', () => {
  const configService: IConfigService = {
    numCores: 341,
    numValidators: 1023,
    epochDuration: 12,
    ticketsPerValidator: 1023,
    maxTicketsPerExtrinsic: 1023,
    contestDuration: 12,
    rotationPeriod: 12,
    numEcPiecesPerSegment: 12,
    maxBlockGas: 1023,
    maxRefineGas: 1023,
    preimageExpungePeriod: 12,
    slotDuration: 12,
  } as IConfigService
  
  const mockPrivileges: Privileges = {
    manager: 1n,
    delegator: 2n,
    registrar: 3n,
    assigners: [4n, 5n, 6n], // One per core
    alwaysaccers: new Map([
      [10n, 1000n],
      [11n, 2000n],
    ]),
  }

  const mockPrivilegesEmpty: Privileges = {
    manager: 0n,
    delegator: 0n,
    registrar: 0n,
    assigners: [0n, 0n, 0n],
    alwaysaccers: new Map(),
  }

  it('should encode and decode privileges with all fields', () => {
    const [encodeError, encodedData] = encodePrivileges(
      mockPrivileges,
      configService,
    )
    expect(encodeError).toBeUndefined()
    expect(encodedData).toBeDefined()

    const [decodeError, decoded] = decodePrivileges(encodedData!, configService)
    expect(decodeError).toBeUndefined()
    expect(decoded).toBeDefined()
    expect(decoded!.value.manager).toBe(1n)
    expect(decoded!.value.delegator).toBe(2n)
    expect(decoded!.value.registrar).toBe(3n)
    expect(decoded!.value.assigners.length).toBe(configService.numCores)
    expect(decoded!.value.assigners[0]).toBe(4n)
    expect(decoded!.value.assigners[1]).toBe(5n)
    expect(decoded!.value.assigners[2]).toBe(6n)
    expect(decoded!.value.alwaysaccers.size).toBe(2)
    expect(decoded!.value.alwaysaccers.get(10n)).toBe(1000n)
    expect(decoded!.value.alwaysaccers.get(11n)).toBe(2000n)
  })

  it('should encode and decode empty privileges', () => {
    const [encodeError, encodedData] = encodePrivileges(mockPrivilegesEmpty, configService)
    expect(encodeError).toBeUndefined()
    expect(encodedData).toBeDefined()

    const [decodeError, decoded] = decodePrivileges(encodedData!, configService)
    expect(decodeError).toBeUndefined()
    expect(decoded).toBeDefined()
    expect(decoded!.value.manager).toBe(0n)
    expect(decoded!.value.delegator).toBe(0n)
    expect(decoded!.value.registrar).toBe(0n)
    expect(decoded!.value.assigners.length).toBe(configService.numCores)
    expect(decoded!.value.assigners.every((a) => a === 0n)).toBe(true)
    expect(decoded!.value.alwaysaccers.size).toBe(0)
  })

  it('should handle round-trip with realistic privilege values', () => {
    const realisticPrivileges: Privileges = {
      manager: 100n,
      delegator: 200n,
      registrar: 300n,
      assigners: [400n, 500n, 600n],
      alwaysaccers: new Map([
        [1000n, 50000n],
        [1001n, 75000n],
        [1002n, 100000n],
      ]),
    }

    const [encodeError, encodedData] = encodePrivileges(realisticPrivileges, configService)
    expect(encodeError).toBeUndefined()
    expect(encodedData).toBeDefined()

    const [decodeError, decoded] = decodePrivileges(encodedData!, configService)
    expect(decodeError).toBeUndefined()
    expect(decoded).toBeDefined()
    expect(decoded!.value.manager).toBe(100n)
    expect(decoded!.value.delegator).toBe(200n)
    expect(decoded!.value.registrar).toBe(300n)
    expect(decoded!.value.assigners.length).toBe(configService.numCores)
    expect(decoded!.value.assigners[0]).toBe(400n)
    expect(decoded!.value.assigners[1]).toBe(500n)
    expect(decoded!.value.assigners[2]).toBe(600n)
    expect(decoded!.value.alwaysaccers.size).toBe(3)
    expect(decoded!.value.alwaysaccers.get(1000n)).toBe(50000n)
    expect(decoded!.value.alwaysaccers.get(1001n)).toBe(75000n)
    expect(decoded!.value.alwaysaccers.get(1002n)).toBe(100000n)
  })

  it('should fail with insufficient data for privileges header', () => {
    const insufficientData = new Uint8Array([1, 2, 3]) // Only 3 bytes, need 16

    const [decodeError, decoded] = decodePrivileges(
      insufficientData,
      configService,
    )
    expect(decodeError).toBeDefined()
    expect(decoded).toBeUndefined()
  })

  it('should handle invalid alwaysaccers entry gracefully', () => {
    // Create data with valid header but invalid alwaysaccers entry
    const header = new Uint8Array(16) // Valid 16-byte header
    const invalidEntry = new Uint8Array([1, 2, 3]) // Only 3 bytes, need at least 8
    const data = new Uint8Array([...header, ...invalidEntry])

    const [decodeError, decoded] = decodePrivileges(data, configService)
    expect(decodeError).toBeUndefined()
    expect(decoded).toBeDefined()
    expect(decoded!.value.alwaysaccers.size).toBe(0) // Empty dictionary for invalid data
  })

  it('should preserve remaining data after decoding', () => {
    const [encodeError, encodedData] = encodePrivileges(
      mockPrivileges,
      configService,
    )
    expect(encodeError).toBeUndefined()

    // Add extra data after the encoded privileges
    const extraData = new Uint8Array([0x42, 0x43, 0x44])
    const combinedData = new Uint8Array(encodedData!.length + extraData.length)
    combinedData.set(encodedData!)
    combinedData.set(extraData, encodedData!.length)

    const [decodeError, decoded] = decodePrivileges(combinedData, configService)
    expect(decodeError).toBeUndefined()
    expect(decoded).toBeDefined()
    expect(decoded!.value.manager).toBe(1n)
    expect(decoded!.remaining).toEqual(extraData)
  })

  it('should handle large service IDs and gas values', () => {
    const largePrivileges: Privileges = {
      manager: 4294967295n, // Max 32-bit value
      delegator: 4294967294n,
      registrar: 4294967293n,
      assigners: [4294967292n, 4294967291n, 4294967290n],
      alwaysaccers: new Map([
        [4294967295n, 4294967295n],
      ]),
    }

    const [encodeError, encodedData] = encodePrivileges(largePrivileges, configService)
    expect(encodeError).toBeUndefined()
    expect(encodedData).toBeDefined()

    const [decodeError, decoded] = decodePrivileges(encodedData!, configService)
    expect(decodeError).toBeUndefined()
    expect(decoded).toBeDefined()
    expect(decoded!.value.manager).toBe(4294967295n)
    expect(decoded!.value.delegator).toBe(4294967294n)
    expect(decoded!.value.registrar).toBe(4294967293n)
    expect(decoded!.value.assigners.length).toBe(configService.numCores)
    expect(decoded!.value.assigners[0]).toBe(4294967292n)
    expect(decoded!.value.assigners[1]).toBe(4294967291n)
    expect(decoded!.value.assigners[2]).toBe(4294967290n)
    expect(decoded!.value.alwaysaccers.get(4294967295n)).toBe(4294967295n)
  })
})
