import { RESULT_CODE_PANIC } from '../../config'
import {
  ACCUMULATE_ERROR_CORE,
  ACCUMULATE_ERROR_HUH,
  ACCUMULATE_ERROR_WHAT,
  ACCUMULATE_ERROR_WHO,
  AccumulateHostFunctionContext,
  BaseAccumulateHostFunction,
  HostFunctionResult,
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
  functionId: u64 = u64(15) // ASSIGN function ID
  name: string = 'assign'
  gasCost: u64 = u64(10)

  // Gray Paper constants
  C_AUTH_QUEUE_SIZE: u64 = u64(80) // Cauthqueuesize
  C_CORE_COUNT: u64 = u64(341) // Ccorecount (default, can be configured)

  execute(context: AccumulateHostFunctionContext): HostFunctionResult {
    const registers = context.registers
    const ram = context.ram
    const implications = context.implications
    // Extract parameters from registers
    const coreIndex = u64(registers[7])
    const authQueueOffset = u64(registers[8])
    const serviceIdToAssign = u64(registers[9])

    // Read auth queue from memory (80 entries * 32 bytes each)
    const authQueueLength = this.C_AUTH_QUEUE_SIZE * u64(32)
    const readResult1 = ram.readOctets(
      u32(authQueueOffset),
      u32(authQueueLength),
    )
    const authQueueData = readResult1.data
    const faultAddress = readResult1.faultAddress
    if (faultAddress !== 0) {
      this.setAccumulateError(registers, ACCUMULATE_ERROR_WHAT)
      return new HostFunctionResult(RESULT_CODE_PANIC)
    }
    if (authQueueData === null) {
      this.setAccumulateError(registers, ACCUMULATE_ERROR_WHAT)
      return new HostFunctionResult(RESULT_CODE_PANIC)
    }

    // Parse auth queue (32 bytes per entry)
    const authQueue: Uint8Array[] = []
    for (let i: i32 = 0; i < i32(this.C_AUTH_QUEUE_SIZE); i++) {
      const entry = authQueueData.slice(i * 32, (i + 1) * 32)
      authQueue.push(entry)
    }

    // Check if core index is valid
    // Gray Paper: c >= Ccorecount
    if (coreIndex >= this.C_CORE_COUNT) {
      this.setAccumulateError(registers, ACCUMULATE_ERROR_CORE)
      return new HostFunctionResult(255) // continue execution
    }

    // Get the current implications context
    const imX = implications.regular

    // Check if current service is the assigner for this core
    // Gray Paper: imX.id !== imX.state.assigners[c]
    const coreIndexI32 = i32(coreIndex)
    if (coreIndexI32 >= imX.state.assigners.length) {
      // Extend assigners array if needed
      while (imX.state.assigners.length <= coreIndexI32) {
        imX.state.assigners.push(u32(0))
      }
    }
    if (imX.id !== u64(imX.state.assigners[coreIndexI32])) {
      this.setAccumulateError(registers, ACCUMULATE_ERROR_HUH)
      return new HostFunctionResult(255) // continue execution
    }

    // Check if service account ID is valid
    // Gray Paper: a not in serviceid (assuming positive service IDs)
    if (serviceIdToAssign === u64(0)) {
      this.setAccumulateError(registers, ACCUMULATE_ERROR_WHO)
      return new HostFunctionResult(255) // continue execution
    }

    // Update auth queue and assigner for the core
    // Gray Paper: imX.state.authqueue[c] = q, imX.state.assigners[c] = a
    // Extend authqueue array if needed
    if (coreIndexI32 >= imX.state.authqueue.length) {
      while (imX.state.authqueue.length <= coreIndexI32) {
        imX.state.authqueue.push([] as Uint8Array[])
      }
    }
    imX.state.authqueue[coreIndexI32] = authQueue
    imX.state.assigners[coreIndexI32] = u32(serviceIdToAssign)

    // Set success result
    this.setAccumulateSuccess(registers)
    return new HostFunctionResult(255) // continue execution
  }
}
