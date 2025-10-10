/**
 * Ticket Generation Tests
 *
 * Tests ticket generation and verification according to Gray Paper specifications
 * Reference: graypaper/text/safrole.tex equations 289-292, 305
 */

import { logger, hexToBytes, type Safe, safeError, safeResult } from '@pbnj/core'
import { beforeAll, describe, expect, it } from 'vitest'
import { generateTicketsForEpoch, verifyTicket } from '@pbnj/safrole'
import type { 
  ValidatorPublicKeys,
  ValidatorMetadata,
  ValidatorCredentials
} from '@pbnj/types'
import { RingVRFProver, getRingRoot } from '@pbnj/bandersnatch-vrf'

// Initialize logger for tests
beforeAll(() => {
  logger.init()
})

// Mock implementations for testing
class MockValidatorSetManager {
  private readonly validators: Map<bigint, ValidatorMetadata> = new Map()
  private readonly validatorIndex: Map<string, bigint> = new Map()

  constructor() {
    // Create mock validators with real key pairs
    const validator1: ValidatorMetadata = {
      index: 0,
      keys: {
        ed25519: '0x4418fb8c85bb3985394a8c2756d3643457ce614546202a2f50b093d762499ace',
        bandersnatch: '0xff71c6c03ff88adb5ed52c9681de1629a54e702fc14729f6b50d2f0a76f185b3',
        bls: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        metadata: '0x0000000000000000000000000000000000000000000000000000000000000000' as const
      },
      endpoint: {
        host: '127.0.0.1',
        port: 8080,
        publicKey: hexToBytes('0x4418fb8c85bb3985394a8c2756d3643457ce614546202a2f50b093d762499ace')
      }
    }
    const validator2: ValidatorMetadata = {
      index: 1,
      keys: {
        ed25519: '0xad93247bd01307550ec7acd757ce6fb805fcf73db364063265b30a949e90d933',
        bandersnatch: '0xdee6d555b82024f1ccf8a1e37e60fa60fd40b1958c4bb3006af78647950e1b91',
        bls: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        metadata: '0x0000000000000000000000000000000000000000000000000000000000000000' as const
      },
      endpoint: {
        host: '127.0.0.1',
        port: 8081,
        publicKey: hexToBytes('0xad93247bd01307550ec7acd757ce6fb805fcf73db364063265b30a949e90d933')
      }
    }
    const validator3: ValidatorMetadata = {
      index: 2,
      keys: {
        ed25519: '0xcab2b9ff25c2410fbe9b8a717abb298c716a03983c98ceb4def2087500b8e341',
        bandersnatch: '0x9326edb21e5541717fde24ec085000b28709847b8aab1ac51f84e94b37ca1b66',
        bls: '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
        metadata: '0x0000000000000000000000000000000000000000000000000000000000000000' as const
      },
      endpoint: {
        host: '127.0.0.1',
        port: 8082,
        publicKey: hexToBytes('0xcab2b9ff25c2410fbe9b8a717abb298c716a03983c98ceb4def2087500b8e341')
      }
    }

    this.validators.set(BigInt(0), validator1)
    this.validators.set(BigInt(1), validator2)
    this.validators.set(BigInt(2), validator3)

    this.validatorIndex.set(validator1.keys.ed25519, BigInt(0))
    this.validatorIndex.set(validator2.keys.ed25519, BigInt(1))
    this.validatorIndex.set(validator3.keys.ed25519, BigInt(2))
  }

  // BaseService implementation
  readonly name = 'mock-validator-set-manager'
  readonly initialized = true
  readonly running = true

  async init(): Promise<Safe<boolean>> {
    return safeResult(true)
  }

  async start(): Promise<Safe<boolean>> {
    return safeResult(true)
  }

  async stop(): Promise<Safe<boolean>> {
    return safeResult(true)
  }

  // IValidatorSetManager implementation
  getActiveValidators(): Map<bigint, ValidatorMetadata> {
    return this.validators
  }

  getActiveValidatorKeys(): Uint8Array[] {
    return Array.from(this.validators.values()).map(v => hexToBytes(v.keys.bandersnatch))
  }

  getPendingValidators(): Map<bigint, ValidatorMetadata> {
    return this.validators
  }

  getValidatorIndex(ed25519PublicKey: string): Safe<bigint> {
    const index = this.validatorIndex.get(ed25519PublicKey)
    if (index === undefined) {
      return safeError(new Error('Validator not found'))
    }
    return safeResult(index)
  }

  getValidatorAtIndex(validatorIndex: bigint): Safe<ValidatorPublicKeys> {
    const validator = this.validators.get(validatorIndex)
    if (!validator) {
      return safeError(new Error('Validator not found'))
    }
    return safeResult(validator.keys)
  }

  getValidatorByEd25519PublicKey(publicKey: string): Safe<ValidatorPublicKeys> {
    const index = this.validatorIndex.get(publicKey)
    if (index === undefined) {
      return safeError(new Error('Validator not found'))
    }
    return this.getValidatorAtIndex(index)
  }
}

class MockKeyPairService {
  // BaseService implementation
  readonly name = 'mock-keypair-service'
  readonly initialized = true
  readonly running = true

  async init(): Promise<Safe<boolean>> {
    return safeResult(true)
  }

  async start(): Promise<Safe<boolean>> {
    return safeResult(true)
  }

  async stop(): Promise<Safe<boolean>> {
    return safeResult(true)
  }

  // IKeyPairService implementation
  getLocalKeyPair(): ValidatorCredentials {
    return {
      ed25519KeyPair: {
        publicKey: hexToBytes('0x4418fb8c85bb3985394a8c2756d3643457ce614546202a2f50b093d762499ace'),
        privateKey: hexToBytes('0x996542becdf1e78278dc795679c825faca2e9ed2bf101bf3c4a236d3ed79cf59')
      },
      bandersnatchKeyPair: {
        publicKey: hexToBytes('0xff71c6c03ff88adb5ed52c9681de1629a54e702fc14729f6b50d2f0a76f185b3'),
        privateKey: hexToBytes('0x007596986419e027e65499cc87027a236bf4a78b5e8bd7f675759d73e7a9c799')
      },
      blsKeyPair: {
        publicKey: hexToBytes('0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd'),
        privateKey: hexToBytes('0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee')
      },
      seed: hexToBytes('0x0000000000000000000000000000000000000000000000000000000000000000'),
      metadata: hexToBytes('0x0000000000000000000000000000000000000000000000000000000000000000')
    }
  }
}

class MockEntropyService {
  // BaseService implementation
  readonly name = 'mock-entropy-service'
  readonly initialized = true
  readonly running = true

  async init(): Promise<Safe<boolean>> {
    return safeResult(true)
  }

  async start(): Promise<Safe<boolean>> {
    return safeResult(true)
  }

  async stop(): Promise<Safe<boolean>> {
    return safeResult(true)
  }

  // IEntropyService implementation
  getEntropy2(): Uint8Array {
    // Return a fixed entropy for testing
    return hexToBytes('0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef')
  }

  getEntropy1(): Uint8Array {
    return hexToBytes('0xcafebabecafebabecafebabecafebabecafebabecafebabecafebabecafebabe')
  }

  getEntropy3(): Uint8Array {
    return hexToBytes('0xfeedfacefeedfacefeedfacefeedfacefeedfacefeedfacefeedfacefeedface')
  }

  getEntropyAccumulator(): Uint8Array {
    return hexToBytes('0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef')
  }
}

class MockConfigService {
  get ticketsPerValidator(): number {
    return 3
  }
}

describe('Ticket Generation and Verification', () => {
  let validatorSetManager: MockValidatorSetManager
  let keyPairService: MockKeyPairService
  let entropyService: MockEntropyService
  let prover: RingVRFProver
  let configService: MockConfigService
  beforeAll(() => {
    console.log('Initializing logger')
    // Set logger level to debug for tests
    process.env['PINO_LEVEL'] = 'debug'
    logger.init()
    console.log('Logger initialized')
    
    console.log('Creating mock services')
    validatorSetManager = new MockValidatorSetManager()
    console.log('MockValidatorSetManager created')
    keyPairService = new MockKeyPairService()
    console.log('MockKeyPairService created')
    entropyService = new MockEntropyService()
    console.log('MockEntropyService created')
    configService = new MockConfigService()
    console.log('MockConfigService created')
    prover = new RingVRFProver()
  })

  it('should generate tickets and verify each one', () => {
    console.log('Starting test - generating tickets')
    
    // Generate tickets for the epoch
    const [generateError, tickets] = generateTicketsForEpoch(
      validatorSetManager as any,
      keyPairService as any,
      entropyService as any,
      prover,
      configService as any
    )

    // Verify no generation error
    expect(generateError).toBeUndefined()
    expect(tickets).toBeDefined()
    expect(tickets!.length).toBeGreaterThan(0)

    console.log(`Generated ${tickets!.length} tickets`)

    // Get the actual epoch root for verification
    const [epochRootError, epochRoot] = getRingRoot(
      validatorSetManager.getActiveValidatorKeys(),
      keyPairService as any,
      validatorSetManager as any,
      prover
    )
    expect(epochRootError).toBeUndefined()
    expect(epochRoot).toBeDefined()

    // Verify each generated ticket by entry index
    // Note: tickets are sorted by ID after generation, so we need to find by entryIndex
    for (let entryIndex = 0; entryIndex < tickets!.length; entryIndex++) {
      // Find the ticket with the matching entry index
      const ticket = tickets!.find(t => t.entryIndex === BigInt(entryIndex))
      
      if (!ticket) {
        console.log(`No ticket found for entry index ${entryIndex}`)
        continue
      }

      console.log(`Verifying ticket for entry index ${entryIndex}:`, {
        id: ticket.id.substring(0, 16) + '...',
        entryIndex: ticket.entryIndex.toString(),
        proofLength: ticket.proof.length
      })

      // Verify the ticket using verifyTicket function
      const [verifyError, isValid] = verifyTicket(
        ticket,
        keyPairService as any,
        entropyService as any,
        validatorSetManager as any,
      )

      // Log the verification result for debugging
      console.log(`Ticket for entry index ${entryIndex} verification result:`, {
        error: verifyError,
        isValid: isValid
      })

      // Check verification result
      expect(verifyError).toBeUndefined()
      expect(isValid).toBe(true)

      console.log(`Ticket for entry index ${entryIndex} verification: ${isValid ? 'PASSED' : 'FAILED'}`)
    }

    console.log('All tickets generated and verified successfully!')
  })
})
