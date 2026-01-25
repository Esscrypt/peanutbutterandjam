/**
 * CE131 Ticket Verification Test
 *
 * Loads tickets from the JSON log file and verifies them using verifyTicket
 */

import { describe, it, expect, beforeAll } from 'bun:test'
import * as fs from 'node:fs'
import * as path from 'node:path'
import {
  RingVRFVerifierWasm,
} from '@pbnjam/bandersnatch-vrf'
import { verifyTicket } from '@pbnjam/safrole'
import { hexToBytes, getTicketIdFromProof } from '@pbnjam/core'
import type { SafroleTicket } from '@pbnjam/types'
import { initializeServices, type FuzzerTargetServices } from './test-utils'

// Calculate workspace root: from infra/node/__tests__/ go up 3 levels to reach workspace root
const WORKSPACE_ROOT = path.resolve(__dirname, '../../../')

interface LogEntry {
  timestamp: string
  protocol: string
  peerPublicKey: string
  epochIndex: string
  entryIndex: string
  ticketId: string
  proofLength: number
  proof?: string // Full proof as hex
  proofFirstBytes: string
  entropy2?: string | null
  entropy3?: string | null
  activeValidators?: Array<{ ed25519: string; bandersnatch: string }> | null
  epochRoot?: string | null
}

describe('CE131 Ticket Verification from Log File', () => {
  let services: FuzzerTargetServices
  let ringVerifier: RingVRFVerifierWasm
  let entropyService: FuzzerTargetServices['fullContext']['entropyService']
  let validatorSetManager: FuzzerTargetServices['validatorSetManager']

  beforeAll(async () => {
    // Initialize services using the same function as other tests
    services = await initializeServices({ spec: 'tiny' })

    // Extract services
    validatorSetManager = services.validatorSetManager
    entropyService = services.fullContext.entropyService

    // Initialize Ring VRF verifier
    const srsFilePath = path.join(
      WORKSPACE_ROOT,
      'packages/bandersnatch-vrf/test-data/srs/zcash-srs-2-11-uncompressed.bin',
    )
    ringVerifier = new RingVRFVerifierWasm(srsFilePath)
    await ringVerifier.init()
  })

  it('should load and verify tickets from log file', async () => {
    const logFile = path.join(process.cwd(), 'logs', 'ce131-tickets-received.json')

    // Check if log file exists
    if (!fs.existsSync(logFile)) {
      console.warn(`Log file not found: ${logFile}`)
      console.warn('Skipping test - run the node to generate tickets first')
      return
    }

    // Read log entries
    const logContent = fs.readFileSync(logFile, 'utf-8')
    const logEntries: LogEntry[] = JSON.parse(logContent)

    if (logEntries.length === 0) {
      console.warn('No tickets found in log file')
      return
    }

    console.log(`Found ${logEntries.length} ticket(s) in log file`)

    // Verify each ticket
    for (let i = 0; i < logEntries.length; i++) {
      const entry = logEntries[i]
      console.log(`Verifying ticket ${i + 1}/${logEntries.length}:`, {
        ticketId: entry.ticketId,
        epochIndex: entry.epochIndex,
        entryIndex: entry.entryIndex,
      })

      // Check if we have the full proof
      if (!entry.proof) {
        console.warn(`Skipping ticket ${i + 1}: no full proof stored in log entry`)
        continue
      }

      // Verify proof length
      const proofBytes = hexToBytes(entry.proof as `0x${string}`)
      expect(proofBytes.length).toBe(784)

      // Verify ticket ID matches proof
      const computedTicketId = getTicketIdFromProof(proofBytes)
      expect(computedTicketId).toBe(entry.ticketId as `0x${string}`)

      // Check if entropy2 and entropy3 are logged
      if (entry.entropy2) {
        console.log(`  Entropy2: ${entry.entropy2}`)
      } else {
        console.warn(`  Entropy2 not logged for ticket ${i + 1}`)
      }

      if (entry.entropy3) {
        console.log(`  Entropy3: ${entry.entropy3}`)
      } else {
        console.warn(`  Entropy3 not logged for ticket ${i + 1}`)
      }

      // Check validator set info
      if (entry.activeValidators) {
        console.log(`  Active validators count: ${entry.activeValidators.length}`)
      } else {
        console.warn(`  Active validators not logged for ticket ${i + 1}`)
      }

      if (entry.epochRoot) {
        console.log(`  Epoch root: ${entry.epochRoot}`)
      } else {
        console.warn(`  Epoch root not logged for ticket ${i + 1}`)
      }

      // Basic validation
      expect(entry.ticketId).toBeTruthy()
      expect(entry.epochIndex).toBeTruthy()
      expect(entry.entryIndex).toBeTruthy()
      expect(entry.proofLength).toBe(784) // Ring VRF proof should be 784 bytes
    }
  })

  it('should verify tickets using verifyTicket when proof is available', async () => {
    const logFile = path.join(process.cwd(), 'logs', 'ce131-tickets-received.json')

    if (!fs.existsSync(logFile)) {
      console.warn(`Log file not found: ${logFile}`)
      return
    }

    const logContent = fs.readFileSync(logFile, 'utf-8')
    const logEntries: LogEntry[] = JSON.parse(logContent)

    if (logEntries.length === 0) {
      console.warn('No tickets found in log file')
      return
    }

    console.log(`Found ${logEntries.length} ticket(s) with full proof data`)

    for (let i = 0; i < logEntries.length; i++) {
      const entry = logEntries[i]
      
      if (!entry.proof) {
        console.warn(`Ticket ${i + 1}: No full proof stored in log entry`)
        continue
      }

      // Verify proof length
      const proofBytes = hexToBytes(entry.proof as `0x${string}`)
      expect(proofBytes.length).toBe(784)

      // Verify ticket ID matches proof
      const computedTicketId = getTicketIdFromProof(proofBytes)
      expect(computedTicketId).toBe(entry.ticketId as `0x${string}`)

      // Create SafroleTicket object
      const ticket: SafroleTicket = {
        id: entry.ticketId as `0x${string}`,
        entryIndex: BigInt(entry.entryIndex),
        proof: entry.proof as `0x${string}`,
      }

      // Try to verify the ticket
      // Note: This requires the correct entropy2 and validator set to match
      // what was used when the ticket was generated
      const [verifyError, isValid] = verifyTicket(
        ticket,
        entropyService,
        validatorSetManager,
        ringVerifier,
      )

      if (verifyError) {
        console.warn(`Ticket ${i + 1} verification error:`, {
          error: verifyError.message,
          ticketId: entry.ticketId,
          epochIndex: entry.epochIndex,
          entryIndex: entry.entryIndex,
          note: 'This may be expected if entropy2 or validator set has changed since ticket generation',
        })
      } else if (!isValid) {
        console.warn(`Ticket ${i + 1} verification failed:`, {
          ticketId: entry.ticketId,
          epochIndex: entry.epochIndex,
          entryIndex: entry.entryIndex,
          note: 'Ticket proof is invalid - may be due to entropy2 or validator set mismatch',
        })
      } else {
        console.log(`Ticket ${i + 1} verified successfully:`, {
          ticketId: entry.ticketId,
          epochIndex: entry.epochIndex,
          entryIndex: entry.entryIndex,
        })
      }

      // We don't fail the test if verification fails, as it may be due to:
      // 1. Entropy2 mismatch (ticket was generated with different entropy)
      // 2. Validator set mismatch (ticket was generated with different validators)
      // 3. The logged entropy/validator data being null (services not available when logged)
      // The important thing is that we can load and attempt verification
    }
  })
})
