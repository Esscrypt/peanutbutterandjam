import type {
  HostFunctionResult,
  ImplicationsPair,
  RAM,
  RegisterState,
} from '@pbnj/types'
import { ACCUMULATE_FUNCTIONS, RESULT_CODES } from '../../config'
import { BaseAccumulateHostFunction } from './base'

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
  readonly functionId = ACCUMULATE_FUNCTIONS.BLESS
  readonly name = 'bless'
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
      const [m, a, v, r, o, n] = registers.slice(7, 13)

      // Gray Paper constants
      const C_CORE_COUNT = 341n // Ccorecount

      // Read assigners array from memory (341 cores * 4 bytes each)
      const assignersLength = C_CORE_COUNT * 4n
      const assignersData = ram.readOctets(a, assignersLength)
      if (!assignersData) {
        this.setAccumulateError(registers, 'WHAT')
        return {
          resultCode: RESULT_CODES.PANIC,
        }
      }

      // Read always accessors array from memory (n entries * 12 bytes each)
      const accessorsLength = n * 12n
      const accessorsData = ram.readOctets(o, accessorsLength)
      if (!accessorsData) {
        this.setAccumulateError(registers, 'WHAT')
        return {
          resultCode: RESULT_CODES.PANIC,
        }
      }

      // Parse assigners array (4 bytes per core ID)
      const assigners: bigint[] = []
      for (let i = 0; i < Number(C_CORE_COUNT); i++) {
        const coreId = new DataView(assignersData.buffer, i * 4, 4).getUint32(
          0,
          true,
        )
        assigners.push(BigInt(coreId))
      }

      // Parse always accessors array (12 bytes per accessor: 4 bytes service ID + 8 bytes gas)
      const alwaysAccessors: Map<bigint, bigint> = new Map()
      for (let i = 0; i < Number(n); i++) {
        const serviceId = new DataView(
          accessorsData.buffer,
          i * 12,
          4,
        ).getUint32(0, true)
        const gas = new DataView(
          accessorsData.buffer,
          i * 12 + 4,
          8,
        ).getBigUint64(0, true)
        alwaysAccessors.set(BigInt(serviceId), gas)
      }

      // Validate service IDs
      // Gray Paper: (m, v, r) not in serviceid^3
      if (m < 0n || v < 0n || r < 0n) {
        this.setAccumulateError(registers, 'WHO')
        return {
          resultCode: null, // continue execution
        }
      }

      // Get the current implications context
      const [imX] = context

      // Update state with new privileges
      // Gray Paper: imX.state = {manager: m, assigners: a, delegator: v, registrar: r, alwaysaccers: z}
      imX.state.manager = m
      imX.state.assigners = assigners
      imX.state.delegator = v
      imX.state.registrar = r
      imX.state.alwaysaccers = alwaysAccessors

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
