import type { HostFunctionResult, IConfigService } from '@pbnjam/types'
import { ACCUMULATE_FUNCTIONS, RESULT_CODES } from '../../config'
import {
  type AccumulateHostFunctionContext,
  BaseAccumulateHostFunction,
} from './base'

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

  constructor(private readonly configService: IConfigService) {
    super()
  }

  execute(context: AccumulateHostFunctionContext): HostFunctionResult {
    const { registers, ram, implications } = context
    // Extract parameters from registers
    const [coreIndex, authQueueOffset, serviceIdToAssign] = registers.slice(
      7,
      10,
    )

    // Gray Paper constants
    const C_AUTH_QUEUE_SIZE = 80n // Cauthqueuesize
    const C_CORE_COUNT = this.configService.numCores // Ccorecount

    // Log all input parameters
    context.log('ASSIGN host function invoked', {
      coreIndex: coreIndex.toString(),
      authQueueOffset: authQueueOffset.toString(),
      serviceIdToAssign: serviceIdToAssign.toString(),
      currentServiceId: implications[0].id.toString(),
      manager: implications[0].state.manager.toString(),
      numCores: C_CORE_COUNT.toString(),
    })

    // Read auth queue from memory (80 entries * 32 bytes each)
    // Gray Paper pvm_invocations.tex lines 717-720:
    // q = sequence{memory[o+32i:32] for i in N_Cauthqueuesize} when Nrange(o,32*Cauthqueuesize) ⊆ readable(memory), error otherwise
    const authQueueLength = C_AUTH_QUEUE_SIZE * 32n
    const [authQueueData, faultAddress] = ram.readOctets(
      authQueueOffset,
      authQueueLength,
    )
    // Gray Paper line 722: (panic, registers_7, ...) when q = error
    // Gray Paper: registers'_7 = registers_7 (unchanged) when c = panic
    if (faultAddress || !authQueueData) {
      // DO NOT modify registers[7] - it must remain unchanged on panic
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
    if (coreIndex >= C_CORE_COUNT) {
      this.setAccumulateError(registers, 'CORE')
      return {
        resultCode: null, // continue execution
      }
    }

    // Get the current implications context
    const [imX] = implications

    // Check if current service is the assigner for this core
    // Gray Paper: imX.id !== imX.state.assigners[c]
    if (imX.id !== imX.state.assigners[Number(coreIndex)]) {
      this.setAccumulateError(registers, 'HUH')
      return {
        resultCode: null, // continue execution
      }
    }

    // Check if service account ID is valid
    // Gray Paper: a not in serviceid (assuming positive service IDs)
    if (serviceIdToAssign < 0n) {
      this.setAccumulateError(registers, 'WHO')
      return {
        resultCode: null, // continue execution
      }
    }

    // Update auth queue and assigner for the core
    // Gray Paper: imX.state.authqueue[c] = q, imX.state.assigners[c] = a
    imX.state.authqueue[Number(coreIndex)] = authQueue
    imX.state.assigners[Number(coreIndex)] = serviceIdToAssign

    // Set success result
    this.setAccumulateSuccess(registers)
    return {
      resultCode: null, // continue execution
    }
  }
}
