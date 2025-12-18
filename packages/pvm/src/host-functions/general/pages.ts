import type {
  HostFunctionContext,
  HostFunctionResult,
  MemoryAccessType,
  PVMGuest,
  RAM,
  RefineInvocationContext,
} from '@pbnjam/types'
import {
  ACCUMULATE_ERROR_CODES,
  GENERAL_FUNCTIONS,
  MEMORY_CONFIG,
} from '../../config'
import { BaseHostFunction } from './base'

/**
 * PAGES host function (Ω_Z)
 *
 * Manages memory pages in PVM machine instances
 *
 * Gray Paper Specification (pvm-invocations.tex line 102, 597-622):
 * - Function ID: 11 (pages)
 * - Gas Cost: 10
 * - Signature: Ω_Z(gascounter, registers, memory, (m, e))
 *   - (m, e) = refine context pair (machines, export segments)
 * - Uses registers[7:4] = (n, p, c, r) where:
 *   - n = machine ID
 *   - p = page start index (must be >= 16)
 *   - c = page count
 *   - r = access mode (0=none, 1=R, 2=W, 3=R+preserve, 4=W+preserve)
 *
 * Access rights (equation 610-614):
 * (u'_ram_access)[p:c] = {
 *   {none, none, ...}  when r = 0
 *   {R, R, ...}        when r = 1 ∨ r = 3
 *   {W, W, ...}        when r = 2 ∨ r = 4
 * }
 *
 * Page data (equation 606-609):
 * (u'_ram_value)[p*Cpvmpagesize...(p+c)*Cpvmpagesize] = {
 *   {0, 0, ...}                when r < 3  (clear data)
 *   (u_ram_value)[p*Cpvmpagesize...(p+c)*Cpvmpagesize]  when r >= 3 (preserve data)
 * }
 *
 * Return codes:
 * - registers[7] = WHO when n ∉ keys(m)
 * - registers[7] = HUH when r > 4 ∨ p < 16 ∨ p+c >= 2^32/Cpvmpagesize
 * - registers[7] = HUH when r > 2 ∧ (u_ram_access)[p:c] ∋ none
 * - registers[7] = OK otherwise
 */
/**
 * Pages host function parameters matching Gray Paper signature
 * Gray Paper: Ω_Z(gascounter, registers, memory, (m, e))
 *
 * @param refineContext - Refine context pair (m, e) - machines and export segments
 */
export interface PagesParams {
  refineContext: RefineInvocationContext
}

export class PagesHostFunction extends BaseHostFunction {
  readonly functionId = GENERAL_FUNCTIONS.PAGES
  readonly name = 'pages'
  readonly gasCost = 10n

  execute(
    context: HostFunctionContext,
    params: PagesParams,
  ): HostFunctionResult {
    // Gray Paper: Extract parameters from registers
    // registers[7:4] = (n, p, c, r)
    const [machineId, pageStart, pageCount, accessRights] =
      context.registers.slice(7, 11)

    // Gray Paper equation 601-604: Get machine RAM
    // u = m[n].ram if n in keys(m), error otherwise
    const machine = params.refineContext.machines.get(machineId)
    if (!machine) {
      // Gray Paper equation 617: Return WHO if machine doesn't exist
      context.registers[7] = ACCUMULATE_ERROR_CODES.WHO
      return {
        resultCode: null, // continue execution
      }
    }

    // Gray Paper equation 618: Validate parameters
    // Return HUH if r > 4 ∨ p < 16 ∨ p+c >= 2^32/Cpvmpagesize
    const MIN_PAGE_INDEX = 16n // Gray Paper: p < 16 is invalid
    const MAX_PAGE_INDEX = 2n ** 32n / BigInt(MEMORY_CONFIG.PAGE_SIZE) // Gray Paper: p+c >= 2^32/Cpvmpagesize is invalid

    if (
      accessRights > 4n ||
      pageStart < MIN_PAGE_INDEX ||
      pageStart + pageCount >= MAX_PAGE_INDEX
    ) {
      // Gray Paper equation 619: Return HUH if invalid parameters
      context.registers[7] = ACCUMULATE_ERROR_CODES.HUH
      return {
        resultCode: null, // continue execution
      }
    }

    // Gray Paper equation 619: Additional validation
    // Return HUH if r > 2 ∧ (u_ram_access)[p:c] ∋ none
    if (accessRights > 2n) {
      const hasInaccessiblePages = this.checkForInaccessiblePages(
        machine.pvm.state.ram,
        pageStart,
        pageCount,
      )
      if (hasInaccessiblePages) {
        context.registers[7] = ACCUMULATE_ERROR_CODES.HUH
        return {
          resultCode: null, // continue execution
        }
      }
    }

    // Gray Paper equation 605-614: Set memory page access rights and data
    this.setMemoryPageAccessRights(machine, pageStart, pageCount, accessRights)

    // Gray Paper equation 620: Return OK for success
    context.registers[7] = ACCUMULATE_ERROR_CODES.OK

    return {
      resultCode: null, // continue execution
    }
  }

  private checkForInaccessiblePages(
    ram: RAM,
    pageStart: bigint,
    pageCount: bigint,
  ): boolean {
    // Gray Paper equation 619: r > 2 ∧ (u_ram_access)[p:c] ∋ none
    // Check if any pages in the range have 'none' access
    const PAGE_SIZE = BigInt(MEMORY_CONFIG.PAGE_SIZE)
    for (let i = 0n; i < pageCount; i++) {
      const pageIndex = pageStart + i
      const pageAddress = pageIndex * PAGE_SIZE

      // Check if the page has 'none' access
      const accessType = ram.getPageAccessType(pageAddress)
      if (accessType === 'none') {
        return true // Found inaccessible page
      }
    }
    return false
  }

  /**
   * Set memory page access rights and optionally clear data
   *
   * Gray Paper equation 605-614:
   * 1. Clear data if r < 3: (u'_ram_value) = {0, 0, ...}
   * 2. Preserve data if r >= 3: (u'_ram_value) = (u_ram_value)
   * 3. Set access rights per convertAccessRights()
   */
  private setMemoryPageAccessRights(
    machine: PVMGuest,
    pageStart: bigint,
    pageCount: bigint,
    accessRights: bigint,
  ): void {
    const PAGE_SIZE = BigInt(MEMORY_CONFIG.PAGE_SIZE)
    const accessType = this.convertAccessRights(accessRights)
    // accessRights is already validated to be <= 4, so accessType should never be null
    if (!accessType) {
      throw new Error(`Invalid access rights: ${accessRights}`)
    }

    for (let i = 0n; i < pageCount; i++) {
      const pageIndex = pageStart + i
      const pageAddress = pageIndex * PAGE_SIZE

      // Gray Paper equation 606-609: Clear page data when r < 3
      if (accessRights < 3n) {
        this.clearPageData(machine.pvm.state.ram, pageAddress, PAGE_SIZE)
      }

      // Gray Paper equation 610-614: Set access rights
      machine.pvm.state.ram.setPageAccessRights(
        pageAddress,
        Number(PAGE_SIZE),
        accessType,
      )
    }
  }

  /**
   * Convert access rights parameter r to MemoryAccessType
   *
   * Gray Paper equation 610-614:
   * r = 0 → none access (no read/write)
   * r = 1 or 3 → read access only (R)
   * r = 2 or 4 → write access only (W)
   */
  private convertAccessRights(accessRights: bigint): MemoryAccessType | null {
    switch (accessRights) {
      case 0n:
        return 'none' // r = 0
      case 1n:
      case 3n:
        return 'read' // r = 1 ∨ r = 3 → R
      case 2n:
      case 4n:
        return 'write' // r = 2 ∨ r = 4 → W
      default:
        return null // Invalid r
    }
  }

  /**
   * Clear page data by writing zeros
   *
   * Gray Paper equation 606-609:
   * (u'_ram_value)[p*Cpvmpagesize...(p+c)*Cpvmpagesize] = {0, 0, ...}
   */
  private clearPageData(ram: RAM, startAddress: bigint, size: bigint): void {
    const zeroData = new Uint8Array(Number(size))
    ram.writeOctets(startAddress, zeroData)
  }
}
