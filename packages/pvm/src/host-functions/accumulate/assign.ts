import type {
  HostFunctionResult,
  ImplicationsPair,
  RAM,
  RegisterState,
} from '@pbnj/types'
import { ACCUMULATE_FUNCTIONS, RESULT_CODES } from '../../config'
import { BaseAccumulateHostFunction } from './base'

/**
 * ASSIGN accumulation host function (Ω_A)
 *
 * Assigns core to service account
 *
 * Gray Paper Specification:
 * - Function ID: 15 (assign)
 * - Gas Cost: 10
 * - Parameters: registers[7-9] = c, o, a
 *   - c: core index
 *   - o: auth queue offset in memory
 *   - a: service account ID to assign
 * - Returns: registers[7] = OK or error code
 *
 * Gray Paper Logic:
 * 1. Read auth queue from memory (80 entries * 32 bytes each)
 * 2. Check if core index is valid (< 341)
 * 3. Check if current service is the assigner for this core
 * 4. Check if service account ID is valid
 * 5. Update auth queue and assigner for the core
 */
export class AssignHostFunction extends BaseAccumulateHostFunction {
  readonly functionId = ACCUMULATE_FUNCTIONS.ASSIGN
  readonly name = 'assign'
  readonly gasCost = 10n

  execute(
    gasCounter: bigint,
    registers: RegisterState,
    ram: RAM,
    context: ImplicationsPair,
  ): HostFunctionResult {
    // Validate execution
    if (gasCounter < this.gasCost) {
      return {
        resultCode: RESULT_CODES.OOG,
      }
    }

    try {
      // Extract parameters from registers
      const [c, o, a] = registers.slice(7, 10)

      // Gray Paper constants
      const C_AUTH_QUEUE_SIZE = 80n // Cauthqueuesize
      const C_CORE_COUNT = 341n // Ccorecount

      // Read auth queue from memory (80 entries * 32 bytes each)
      const authQueueLength = C_AUTH_QUEUE_SIZE * 32n
      const authQueueData = ram.readOctets(o, authQueueLength)
      if (!authQueueData) {
        this.setAccumulateError(registers, 'WHAT')
        return {
          resultCode: RESULT_CODES.PANIC,
        }
      }

      // Parse auth queue (32 bytes per entry)
      const authQueue: Uint8Array[] = []
      for (let i = 0; i < Number(C_AUTH_QUEUE_SIZE); i++) {
        const entry = authQueueData.slice(i * 32, (i + 1) * 32)
        authQueue.push(entry)
      }

      // Check if core index is valid
      // Gray Paper: c >= Ccorecount
      if (c >= C_CORE_COUNT) {
        this.setAccumulateError(registers, 'CORE')
        return {
          resultCode: null, // continue execution
        }
      }

      // Get the current implications context
      const [imX] = context

      // Check if current service is the assigner for this core
      // Gray Paper: imX.id !== imX.state.assigners[c]
      const coreIndex = Number(c)
      if (imX.id !== imX.state.assigners[coreIndex]) {
        this.setAccumulateError(registers, 'HUH')
        return {
          resultCode: null, // continue execution
        }
      }

      // Check if service account ID is valid
      // Gray Paper: a not in serviceid (assuming positive service IDs)
      if (a < 0n) {
        this.setAccumulateError(registers, 'WHO')
        return {
          resultCode: null, // continue execution
        }
      }

      // Update auth queue and assigner for the core
      // Gray Paper: imX.state.authqueue[c] = q, imX.state.assigners[c] = a
      imX.state.authqueue[coreIndex] = authQueue
      imX.state.assigners[coreIndex] = a

      // Set success result
      this.setAccumulateSuccess(registers)
      return {
        resultCode: null, // continue execution
      }
    } catch {
      this.setAccumulateError(registers, 'WHAT')
      return {
        resultCode: RESULT_CODES.PANIC,
      }
    }
  }
}
