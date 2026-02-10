/**
 * Ticket Generation and Verification Test
 *
 * Tests the complete ticket generation and verification flow according to Gray Paper Eq. 292
 * bsringproof{epochroot'}{Xticket ∥ entropy'_2 ∥ xt_entryindex}{[]}
 */

import { describe, it, expect, beforeAll } from 'bun:test'
import {
  RingVRFProverWasm,
  RingVRFVerifierWasm,
} from '@pbnjam/bandersnatch-vrf'
import {
  generateTicketsForEpoch,
  verifyTicket,
} from '@pbnjam/safrole'
import {
  generateDevAccountValidatorKeyPair,
  bytesToHex,
  hexToBytes,
} from '@pbnjam/core'
import { join } from 'node:path'
import type { ValidatorPublicKeys } from '@pbnjam/types'
import { initializeServices, type FuzzerTargetServices } from '../../__tests__/test-utils'
import { EventBusService } from '@pbnjam/core'
import { ValidatorSetManager } from '../validator-set'

const WORKSPACE_ROOT = join(__dirname, '../../../../')

describe('Ticket Generation and Verification', () => {
  let services: FuzzerTargetServices
  let ringProver: RingVRFProverWasm
  let ringVerifier: RingVRFVerifierWasm
  let configService: FuzzerTargetServices['configService']
  let entropyService: FuzzerTargetServices['fullContext']['entropyService']
  let validatorSetManager: FuzzerTargetServices['validatorSetManager']
  let keyPairService: FuzzerTargetServices['fullContext']['keyPairService']

  beforeAll(async () => {
    // Initialize services using the same function as other tests
    services = await initializeServices({ spec: 'tiny' })

    // Extract services from the returned object
    configService = services.configService
    validatorSetManager = services.validatorSetManager

    // Extract additional services from fullContext
    const context = services.fullContext
    entropyService = context.entropyService
    keyPairService = context.keyPairService

    // Initialize Ring VRF prover and verifier
    // Use uncompressed SRS file - Ring VRF prover expects uncompressed arkworks format
    const srsFilePath = join(
      WORKSPACE_ROOT,
      'packages/bandersnatch-vrf/test-data/srs/zcash-srs-2-11-uncompressed.bin',
    )
    ringProver = new RingVRFProverWasm(srsFilePath)
    ringVerifier = new RingVRFVerifierWasm(srsFilePath)

    // Initialize WASM modules
    await ringProver.init()
    await ringVerifier.init()

    // Generate validator key pairs for testing
    // Create 3 validators for a small ring
    const validators: ValidatorPublicKeys[] = []
    for (let i = 0; i < 3; i++) {
      const [keyPairError, keyPair] = generateDevAccountValidatorKeyPair(i)
      if (keyPairError || !keyPair) {
        throw new Error(`Failed to generate validator key pair ${i}`)
      }
      validators.push({
        bandersnatch: bytesToHex(keyPair.bandersnatchKeyPair.publicKey),
        ed25519: bytesToHex(keyPair.ed25519KeyPair.publicKey),
        bls: bytesToHex(new Uint8Array(144).fill(0)), // Dummy BLS key
        metadata: bytesToHex(new Uint8Array(128).fill(0)), // Dummy metadata
      })
    }

    // Set pending set to the validators (for next epoch)
    // This is what tickets will be generated for
    validatorSetManager.setPendingSet(validators)
    validatorSetManager.setActiveSet(validators)

    // Set validatorIndex to 0 so getValidatorCredentialsWithFallback uses dev account keys
    // This avoids needing keyPairService (which may be null)
    configService.validatorIndex = 0
  })

  it('should generate and verify a ticket successfully', async () => {
    // Step 1: Generate tickets for the epoch
    // keyPairService can be null - getValidatorCredentialsWithFallback will use
    // configService.validatorIndex (set to 0 in beforeAll) to generate dev account keys
    const [generateError, tickets] = generateTicketsForEpoch(
      validatorSetManager,
      keyPairService || undefined,
      entropyService,
      ringProver,
      configService,
    )

    expect(generateError).toBeUndefined()
    expect(tickets).toBeDefined()
    expect(tickets!.length).toBeGreaterThan(0)

    // Step 2: Verify each generated ticket
    for (const ticket of tickets!) {
      const [verifyError, isValid] = verifyTicket(
        ticket,
        entropyService,
        validatorSetManager,
        ringVerifier,
      )

      expect(verifyError).toBeUndefined()
      expect(isValid).toBe(true)
    }
  })

  it('should use correct ring keys from pending set', async () => {
    // Generate tickets
    // keyPairService can be null - getValidatorCredentialsWithFallback will use
    // configService.validatorIndex (set to 0 in beforeAll) to generate dev account keys
    const [generateError, tickets] = generateTicketsForEpoch(
      validatorSetManager,
      keyPairService || undefined,
      entropyService,
      ringProver,
      configService,
    )

    expect(generateError).toBeUndefined()
    expect(tickets).toBeDefined()
    expect(tickets!.length).toBeGreaterThan(0)

    // Get pending validators (should be used for ring root)
    const pendingValidators = validatorSetManager.getPendingValidators()
    expect(pendingValidators.length).toBe(3)

    // Verify ticket uses correct ring
    const ticket = tickets![0]
    const [verifyError, isValid] = verifyTicket(
      ticket,
      entropyService,
      validatorSetManager,
      ringVerifier,
    )

    expect(verifyError).toBeUndefined()
    expect(isValid).toBe(true)
  })

  it('should use correct entropy_2 for verification', async () => {
    // Generate tickets
    // keyPairService can be null - getValidatorCredentialsWithFallback will use
    // configService.validatorIndex (set to 0 in beforeAll) to generate dev account keys
    const [generateError, tickets] = generateTicketsForEpoch(
      validatorSetManager,
      keyPairService || undefined,
      entropyService,
      ringProver,
      configService,
    )

    expect(generateError).toBeUndefined()
    expect(tickets).toBeDefined()
    expect(tickets!.length).toBeGreaterThan(0)

    // Get entropy_2 used during generation
    const entropy2 = entropyService.getEntropy2()
    expect(entropy2).toHaveLength(32)

    // Verify ticket (should use same entropy_2)
    const ticket = tickets![0]
    const [verifyError, isValid] = verifyTicket(
      ticket,
      entropyService,
      validatorSetManager,
      ringVerifier,
    )

    expect(verifyError).toBeUndefined()
    expect(isValid).toBe(true)
  })

  it('should fail verification with wrong ring keys', async () => {
    // Generate tickets
    // keyPairService can be null - getValidatorCredentialsWithFallback will use
    // configService.validatorIndex (set to 0 in beforeAll) to generate dev account keys
    const [generateError, tickets] = generateTicketsForEpoch(
      validatorSetManager,
      keyPairService || undefined,
      entropyService,
      ringProver,
      configService,
    )

    expect(generateError).toBeUndefined()
    expect(tickets).toBeDefined()
    expect(tickets!.length).toBeGreaterThan(0)

    // Create a validator set manager with different validators
    const eventBusService = new EventBusService()
    const differentValidators: ValidatorPublicKeys[] = []
    for (let i = 3; i < 6; i++) {
      const [keyPairError, keyPair] = generateDevAccountValidatorKeyPair(i)
      if (keyPairError || !keyPair) {
        throw new Error(`Failed to generate validator key pair ${i}`)
      }
      differentValidators.push({
        bandersnatch: bytesToHex(keyPair.bandersnatchKeyPair.publicKey),
        ed25519: bytesToHex(keyPair.ed25519KeyPair.publicKey),
        bls: bytesToHex(new Uint8Array(144).fill(0)),
        metadata: bytesToHex(new Uint8Array(128).fill(0)),
      })
    }

    const wrongValidatorSetManager = new ValidatorSetManager({
      eventBusService,
      sealKeyService: null,
      ringProver,
      ticketService: null,
      configService,
      initialValidators: differentValidators,
    })
    wrongValidatorSetManager.setPendingSet(differentValidators)
    await wrongValidatorSetManager.start()

    // Verify ticket with wrong ring keys (should fail)
    const ticket = tickets![0]
    const [verifyError, isValid] = verifyTicket(
      ticket,
      entropyService,
      wrongValidatorSetManager,
      ringVerifier,
    )

    // Verification should fail because ring keys don't match
    expect(verifyError !== undefined || isValid === false).toBe(true)
  })

  it('should handle entry index encoding correctly', async () => {
    // Generate tickets
    // keyPairService can be null - getValidatorCredentialsWithFallback will use
    // configService.validatorIndex (set to 0 in beforeAll) to generate dev account keys
    const [generateError, tickets] = generateTicketsForEpoch(
      validatorSetManager,
      keyPairService || undefined,
      entropyService,
      ringProver,
      configService,
    )

    expect(generateError).toBeUndefined()
    expect(tickets).toBeDefined()

    // Verify all tickets have valid entry indices
    for (const ticket of tickets!) {
      expect(ticket.entryIndex).toBeGreaterThanOrEqual(0n)
      expect(ticket.entryIndex).toBeLessThan(BigInt(configService.ticketsPerValidator))

      // Verify the ticket
      const [verifyError, isValid] = verifyTicket(
        ticket,
        entropyService,
        validatorSetManager,
        ringVerifier,
      )

      expect(verifyError).toBeUndefined()
      expect(isValid).toBe(true)
    }
  })
})
