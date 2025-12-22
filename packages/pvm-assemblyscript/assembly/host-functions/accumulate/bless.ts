import { RESULT_CODE_PANIC } from '../../config'
import { AlwaysAccerEntry } from '../../codec'
import {
  ACCUMULATE_ERROR_WHAT,
  ACCUMULATE_ERROR_WHO,
  AccumulateHostFunctionContext,
  BaseAccumulateHostFunction,
  HostFunctionResult,
} from './base'

/**
 * BLESS accumulation host function (Ω_B)
 *
 * Empowers service with manager, assigners, delegator, registrar, and always accessors
 *
 * Gray Paper Specification:
 * - Function ID: 14 (bless)
 * - Gas Cost: 10
 * - Parameters: registers[7-12] = m, a, v, r, o, n
 *   - m: manager service ID
 *   - a: assigners array offset in memory
 *   - v: delegator service ID
 *   - r: registrar service ID
 *   - o: always accessors array offset in memory
 *   - n: number of always accessors
 * - Returns: registers[7] = OK or error code
 *
 * Gray Paper Logic:
 * 1. Read assigners array from memory (341 cores * 4 bytes each)
 * 2. Read always accessors array from memory (n entries * 12 bytes each)
 * 3. Validate service IDs are valid
 * 4. Update state with new privileges
 */
export class BlessHostFunction extends BaseAccumulateHostFunction {
  functionId: u64 = u64(14) // BLESS function ID
  name: string = 'bless'
  gasCost: u64 = u64(10)

  // Gray Paper constants
  C_CORE_COUNT: u64 = u64(341) // Ccorecount (default)

  execute(context: AccumulateHostFunctionContext): HostFunctionResult {
    const registers = context.registers
    const ram = context.ram
    const implications = context.implications
    // Extract parameters from registers
    const managerServiceId = u64(registers[7])
    const assignersOffset = u64(registers[8])
    const delegatorServiceId = u64(registers[9])
    const registrarServiceId = u64(registers[10])
    const alwaysAccessorsOffset = u64(registers[11])
    const numberOfAlwaysAccessors = u64(registers[12])

    // Read assigners array from memory (341 cores * 4 bytes each)
    const assignersLength = this.C_CORE_COUNT * u64(4)
    const readResult_assigners = ram.readOctets(
      u32(assignersOffset),
      u32(assignersLength),
    )
    if (readResult_assigners.faultAddress !== 0) {
      this.setAccumulateError(registers, ACCUMULATE_ERROR_WHAT)
      return new HostFunctionResult(RESULT_CODE_PANIC)
    }
    if (readResult_assigners.data === null) {
      this.setAccumulateError(registers, ACCUMULATE_ERROR_WHAT)
      return new HostFunctionResult(RESULT_CODE_PANIC)
    }
    const assignersData = readResult_assigners.data!

    // Read always accessors array from memory (n entries * 12 bytes each)
    const accessorsLength = numberOfAlwaysAccessors * u64(12)
    const readResult_accessors = ram.readOctets(
      u32(alwaysAccessorsOffset),
      u32(accessorsLength),
    )
    if (readResult_accessors.faultAddress !== 0) {
      this.setAccumulateError(registers, ACCUMULATE_ERROR_WHAT)
      return new HostFunctionResult(RESULT_CODE_PANIC)
    }
    if (readResult_accessors.data === null) {
      this.setAccumulateError(registers, ACCUMULATE_ERROR_WHAT)
      return new HostFunctionResult(RESULT_CODE_PANIC)
    }
    const accessorsData = readResult_accessors.data!

    // Parse assigners array (4 bytes per core ID, little-endian)
    const assigners: u32[] = []
    for (let i: i32 = 0; i < i32(this.C_CORE_COUNT); i++) {
      const offset = i * 4
      // Read 4 bytes as little-endian u32
      let coreId: u32 = u32(0)
      coreId |= u32(assignersData[offset])
      coreId |= u32(assignersData[offset + 1]) << 8
      coreId |= u32(assignersData[offset + 2]) << 16
      coreId |= u32(assignersData[offset + 3]) << 24
      assigners.push(coreId)
    }

    // Parse always accessors array (12 bytes per accessor: 4 bytes service ID + 8 bytes gas, little-endian)
    const alwaysAccessors: Array<AlwaysAccerEntry> = []
    for (let i: i32 = 0; i < i32(numberOfAlwaysAccessors); i++) {
      const offset = i * 12
      // Read service ID (4 bytes, little-endian)
      let serviceId: u32 = u32(0)
      serviceId |= u32(accessorsData[offset])
      serviceId |= u32(accessorsData[offset + 1]) << 8
      serviceId |= u32(accessorsData[offset + 2]) << 16
      serviceId |= u32(accessorsData[offset + 3]) << 24
      // Read gas (8 bytes, little-endian)
      let gas: u64 = u64(0)
      gas |= u64(accessorsData[offset + 4])
      gas |= u64(accessorsData[offset + 5]) << 8
      gas |= u64(accessorsData[offset + 6]) << 16
      gas |= u64(accessorsData[offset + 7]) << 24
      gas |= u64(accessorsData[offset + 8]) << 32
      gas |= u64(accessorsData[offset + 9]) << 40
      gas |= u64(accessorsData[offset + 10]) << 48
      gas |= u64(accessorsData[offset + 11]) << 56
      alwaysAccessors.push(new AlwaysAccerEntry(serviceId, gas))
    }

    // Validate service IDs
    // Gray Paper line 706: (m, v, r) not in serviceid^3 → return WHO
    // serviceid ≡ Nbits{32} (Gray Paper definitions.tex line 15, accounts.tex line 7)
    // So each service ID must be: 0 ≤ id < 2^32
    const MAX_SERVICE_ID: u64 = u64(4294967296) // 2^32
    const isValidServiceId = (id: u64): bool => {
      return id < MAX_SERVICE_ID
    }

    if (
      !isValidServiceId(managerServiceId) ||
      !isValidServiceId(delegatorServiceId) ||
      !isValidServiceId(registrarServiceId)
    ) {
      this.setAccumulateError(registers, ACCUMULATE_ERROR_WHO)
      return new HostFunctionResult(255) // continue execution
    }

    // Update state with new privileges
    // Gray Paper: imX.state = {manager: m, assigners: a, delegator: v, registrar: r, alwaysaccers: z}
    const imX = implications.regular
    imX.state.manager = u32(managerServiceId)
    imX.state.assigners = assigners
    imX.state.delegator = u32(delegatorServiceId)
    imX.state.registrar = u32(registrarServiceId)
    imX.state.alwaysaccers = alwaysAccessors

    // Set success result
    this.setAccumulateSuccess(registers)
    return new HostFunctionResult(255) // continue execution
  }
}
