import { RESULT_CODE_PANIC } from '../../config'
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
  functionId: u64 = u64(16) // BLESS function ID
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
    const readResult_assignersData = ram.readOctets(
      assignersOffset,
      assignersLength,
    )
    if (faultAddress_readResult !== null || faultAddress !== null) {
      this.setAccumulateError(registers, ACCUMULATE_ERROR_WHAT)
      return new HostFunctionResult(RESULT_CODE_PANIC)
    }
    if (assignersData === null) {
      this.setAccumulateError(registers, ACCUMULATE_ERROR_WHAT)
      return new HostFunctionResult(RESULT_CODE_PANIC)
    }

    // Read always accessors array from memory (n entries * 12 bytes each)
    const accessorsLength = numberOfAlwaysAccessors * u64(12)
    const readResult_accessorsData = ram.readOctets(
      alwaysAccessorsOffset,
      accessorsLength,
    )
    if (accessorsData === null) {
      this.setAccumulateError(registers, ACCUMULATE_ERROR_WHAT)
      return new HostFunctionResult(RESULT_CODE_PANIC)
    }
    if (accessorsFaultAddress !== null) {
      this.setAccumulateError(registers, ACCUMULATE_ERROR_WHAT)
      return new HostFunctionResult(RESULT_CODE_PANIC)
    }

    // Parse assigners array (4 bytes per core ID, little-endian)
    const assigners: u64[] = []
    for (let i: i32 = 0; i < i32(this.C_CORE_COUNT); i++) {
      const offset = i * 4
      // Read 4 bytes as little-endian u32, then convert to u64
      let coreId: u32 = u32(0)
      coreId |= u32(assignersData[offset])
      coreId |= u32(assignersData[offset + 1]) << 8
      coreId |= u32(assignersData[offset + 2]) << 16
      coreId |= u32(assignersData[offset + 3]) << 24
      assigners.push(u64(coreId))
    }

    // Parse always accessors array (12 bytes per accessor: 4 bytes service ID + 8 bytes gas, little-endian)
    const alwaysAccessors = new Map<u64, u64>()
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
      alwaysAccessors.set(u64(serviceId), gas)
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
      return new HostFunctionResult(null) // continue execution
    }

    // Update state with new privileges
    // Gray Paper: imX.state = {manager: m, assigners: a, delegator: v, registrar: r, alwaysaccers: z}
    const imX = implications.regular
    imX.state.manager = managerServiceId
    imX.state.assigners = assigners
    imX.state.delegator = delegatorServiceId
    imX.state.registrar = registrarServiceId
    imX.state.alwaysaccers = alwaysAccessors

    // Set success result
    this.setAccumulateSuccess(registers)
    return new HostFunctionResult(null) // continue execution
  }
}
