import {logger} from '@pbnjam/core'
import type { HostFunctionResult, IConfigService } from '@pbnjam/types'
import { ACCUMULATE_FUNCTIONS, RESULT_CODES } from '../../config'
import {
  type AccumulateHostFunctionContext,
  BaseAccumulateHostFunction,
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
  readonly functionId = ACCUMULATE_FUNCTIONS.BLESS
  readonly name = 'bless'
  readonly gasCost = 10n
  readonly configService: IConfigService

  constructor(configService: IConfigService) {
    super()
    this.configService = configService
  }

  execute(context: AccumulateHostFunctionContext): HostFunctionResult {
    const { registers, ram, implications } = context
    // Extract parameters from registers
    const [
      managerServiceId,
      assignersOffset,
      delegatorServiceId,
      registrarServiceId,
      alwaysAccessorsOffset,
      numberOfAlwaysAccessors,
    ] = registers.slice(7, 13)

    // Log all input parameters
    logger.info('BLESS host function invoked', {
      managerServiceId: managerServiceId.toString(),
      assignersOffset: assignersOffset.toString(),
      delegatorServiceId: delegatorServiceId.toString(),
      registrarServiceId: registrarServiceId.toString(),
      alwaysAccessorsOffset: alwaysAccessorsOffset.toString(),
      numberOfAlwaysAccessors: numberOfAlwaysAccessors.toString(),
      currentServiceId: implications[0].id.toString(),
      numCores: this.configService.numCores.toString(),
    })

    // Read assigners array from memory (Ccorecount * 4 bytes)
    // Gray Paper pvm_invocations.tex lines 696-699:
    // a = decode[4]{memory[a:4*Ccorecount]} when Nrange(a,4*Ccorecount) ⊆ readable(memory), error otherwise
    const assignersLength = BigInt(this.configService.numCores) * 4n

    const [assignersData, faultAddress] = ram.readOctets(
      assignersOffset,
      assignersLength,
    )

    // Gray Paper line 705: (panic, registers_7, ...) when {z, a} ∋ error
    // Gray Paper: registers'_7 = registers_7 (unchanged) when c = panic
    if (faultAddress || !assignersData) {
      // DO NOT modify registers[7] - it must remain unchanged on panic
      return {
        resultCode: RESULT_CODES.PANIC,
      }
    }

    // Read always accessors array from memory (n entries * 12 bytes each)
    // Gray Paper pvm_invocations.tex lines 700-703:
    // z = {build{...}} when Nrange(o,12n) ⊆ readable(memory), error otherwise
    const accessorsLength = numberOfAlwaysAccessors * 12n

    const [accessorsData, accessorsFaultAddress] = ram.readOctets(
      alwaysAccessorsOffset,
      accessorsLength,
    )

    // Gray Paper line 705: (panic, registers_7, ...) when {z, a} ∋ error
    // Gray Paper: registers'_7 = registers_7 (unchanged) when c = panic
    if (!accessorsData || accessorsFaultAddress) {
      // DO NOT modify registers[7] - it must remain unchanged on panic
      return {
        resultCode: RESULT_CODES.PANIC,
      }
    }

    // Parse assigners array (4 bytes per core ID)
    // IMPORTANT: Must account for byteOffset when creating DataView, as assignersData
    // may be a slice of a larger buffer, and .buffer returns the entire underlying ArrayBuffer
    const assigners: bigint[] = []
    const assignersView = new DataView(
      assignersData.buffer,
      assignersData.byteOffset,
      assignersData.length,
    )
    for (let i = 0; i < this.configService.numCores; i++) {
      const coreId = assignersView.getUint32(i * 4, true)
      assigners.push(BigInt(coreId))
    }

    // Parse always accessors array (12 bytes per accessor: 4 bytes service ID + 8 bytes gas)
    // IMPORTANT: Must account for byteOffset when creating DataView, as accessorsData
    // may be a slice of a larger buffer, and .buffer returns the entire underlying ArrayBuffer
    const alwaysAccessors: Map<bigint, bigint> = new Map()
    const accessorsView = new DataView(
      accessorsData.buffer,
      accessorsData.byteOffset,
      accessorsData.length,
    )
    for (let i = 0; i < Number(numberOfAlwaysAccessors); i++) {
      const serviceId = accessorsView.getUint32(i * 12, true)
      const gas = accessorsView.getBigUint64(i * 12 + 4, true)
      alwaysAccessors.set(BigInt(serviceId), gas)
    }

    // Validate service IDs
    // Gray Paper line 706: (m, v, r) not in serviceid^3 → return WHO
    // serviceid ≡ Nbits{32} (Gray Paper definitions.tex line 15, accounts.tex line 7)
    // So each service ID must be: 0 ≤ id < 2^32
    const MAX_SERVICE_ID = 2n ** 32n // 2^32 = 4294967296
    const isValidServiceId = (id: bigint): boolean => {
      return id >= 0n && id < MAX_SERVICE_ID
    }

    if (
      !isValidServiceId(managerServiceId) ||
      !isValidServiceId(delegatorServiceId) ||
      !isValidServiceId(registrarServiceId)
    ) {
      this.setAccumulateError(registers, 'WHO')
      return {
        resultCode: null, // continue execution
      }
    }

    // Update state with new privileges
    // Gray Paper: imX.state = {manager: m, assigners: a, delegator: v, registrar: r, alwaysaccers: z}
    implications[0].state.manager = managerServiceId
    implications[0].state.assigners = assigners
    implications[0].state.delegator = delegatorServiceId
    implications[0].state.registrar = registrarServiceId
    implications[0].state.alwaysaccers = alwaysAccessors

    // Set success result
    this.setAccumulateSuccess(registers)
    return {
      resultCode: null, // continue execution
    }
  }
}
