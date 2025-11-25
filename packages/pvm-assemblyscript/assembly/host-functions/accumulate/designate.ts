import { RESULT_CODE_PANIC } from '../../config'
import {
  ACCUMULATE_ERROR_HUH,
  ACCUMULATE_ERROR_WHAT,
  AccumulateHostFunctionContext,
  BaseAccumulateHostFunction,
  HostFunctionResult,
} from './base'

/**
 * DESIGNATE accumulation host function (Ω_D)
 *
 * Designates validators (only delegator can do this)
 *
 * Gray Paper Specification:
 * - Function ID: 16 (designate)
 * - Gas Cost: 10
 * - Parameters: registers[7] = o
 *   - o: validators array offset in memory
 * - Returns: registers[7] = OK or error code
 *
 * Gray Paper Logic:
 * 1. Read validators array from memory (336 bytes per validator, up to Cvalcount validators)
 * 2. Check if current service is the delegator (imX.id === imX.state.ps_delegator)
 * 3. Update staging set with new validators
 * 4. Return OK on success, HUH if not delegator, PANIC on error
 */
export class DesignateHostFunction extends BaseAccumulateHostFunction {
  functionId: u64 = u64(17) // DESIGNATE function ID
  name: string = 'designate'
  gasCost: u64 = u64(10)

  // Gray Paper constants
  C_VALCOUNT: i32 = 1023 // Cvalcount (number of validators)
  VALIDATOR_SIZE: i32 = 336 // bytes per validator

  execute(context: AccumulateHostFunctionContext): HostFunctionResult {
    const registers = context.registers
    const ram = context.ram
    const implications = context.implications
    // Extract parameters from registers
    const validatorsOffset = u64(registers[7])

    // Read validators array from memory (336 bytes per validator, up to Cvalcount validators)
    // Gray Paper: sequence[Cvalcount]{valkey} where Cvalcount = 1023
    const totalSize = this.VALIDATOR_SIZE * this.C_VALCOUNT

    const readResult_validators = ram.readOctets(
      u32(validatorsOffset),
      u32(totalSize),
    )
    if (readResult_validators.faultAddress !== 0) {
      this.setAccumulateError(registers, ACCUMULATE_ERROR_WHAT)
      return new HostFunctionResult(RESULT_CODE_PANIC)
    }
    if (readResult_validators.data === null) {
      this.setAccumulateError(registers, ACCUMULATE_ERROR_WHAT)
      return new HostFunctionResult(RESULT_CODE_PANIC)
    }
    const validatorsData = readResult_validators.data!

    // Parse validators array (336 bytes per validator)
    // Note: For AssemblyScript, we store raw validator data as Uint8Array
    // Full implementation would decode ValidatorPublicKeys structure
    const validators: Uint8Array[] = []
    for (let i: i32 = 0; i < this.C_VALCOUNT; i++) {
      const validatorData = validatorsData.slice(
        i * this.VALIDATOR_SIZE,
        (i + 1) * this.VALIDATOR_SIZE,
      )
      // Note: Would decode ValidatorPublicKeys here if codec available
      // For now, store raw bytes
      validators.push(validatorData)
    }

    // Get the current implications context
    const imX = implications.regular

    // Check if current service is the delegator
    // Gray Paper: imX.id !== imX.state.ps_delegator
    if (imX.id !== u64(imX.state.delegator)) {
      this.setAccumulateError(registers, ACCUMULATE_ERROR_HUH)
      return new HostFunctionResult(255) // continue execution
    }

    // Update staging set with new validators
    // Gray Paper: (imX'.state).ps_stagingset = v
    imX.state.stagingset = validators

    // Set success result
    this.setAccumulateSuccess(registers)
    return new HostFunctionResult(255) // continue execution
  }
}
