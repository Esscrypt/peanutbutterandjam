import { RESULT_CODE_PANIC } from '../../config'
import {
  ACCUMULATE_ERROR_HUH,
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
  functionId: u64 = u64(16) // DESIGNATE function ID
  name: string = 'designate'
  gasCost: u64 = u64(10)

  // Gray Paper constants
  VALIDATOR_SIZE: i32 = 336 // bytes per validator

  execute(context: AccumulateHostFunctionContext): HostFunctionResult {
    const registers = context.registers
    const ram = context.ram
    const implications = context.implications
    const numValidators = context.numValidators // Get from config via context
    
    // Get the current implications context
    const imX = implications.regular

    // Extract parameters from registers
    const validatorsOffset = u64(registers[7])

    // Read validators array from memory (336 bytes per validator, up to Cvalcount validators)
    // Gray Paper: sequence[Cvalcount]{valkey} where Cvalcount comes from config
    // Gray Paper: v = sequence{memory[o+336i:336] for i in valindex} when readable, error otherwise
    const totalSize = this.VALIDATOR_SIZE * i32(numValidators)

    const readResult_validators = ram.readOctets(
      u32(validatorsOffset),
      u32(totalSize),
    )
    
    // Gray Paper: (panic, registers_7, stagingset) when v = error
    // Check memory read FIRST (before delegator check) per Gray Paper order
    // DO NOT modify registers[7] - it must remain unchanged on panic
    if (readResult_validators.faultAddress !== 0 || readResult_validators.data === null) {
      return new HostFunctionResult(RESULT_CODE_PANIC)
    }
    const validatorsData = readResult_validators.data!

    // Gray Paper: (continue, HUH, stagingset) otherwhen imX_id ≠ (imX_state)_ps_delegator
    // Check delegator AFTER successful memory read per Gray Paper order
    if (imX.id !== u64(imX.state.delegator)) {
      this.setAccumulateError(registers, ACCUMULATE_ERROR_HUH)
      return new HostFunctionResult(255) // continue execution
    }

    // Parse validators array (336 bytes per validator)
    // Note: For AssemblyScript, we store raw validator data as Uint8Array
    // Full implementation would decode ValidatorPublicKeys structure
    const validators: Uint8Array[] = []
    for (let i: i32 = 0; i < i32(numValidators); i++) {
      const validatorData = validatorsData.slice(
        i * this.VALIDATOR_SIZE,
        (i + 1) * this.VALIDATOR_SIZE,
      )
      // Note: Would decode ValidatorPublicKeys here if codec available
      // For now, store raw bytes
      validators.push(validatorData)
    }

    // Update staging set with new validators
    // Gray Paper: (imX'.state).ps_stagingset = v
    imX.state.stagingset = validators

    // Set success result
    this.setAccumulateSuccess(registers)
    return new HostFunctionResult(255) // continue execution
  }
}
