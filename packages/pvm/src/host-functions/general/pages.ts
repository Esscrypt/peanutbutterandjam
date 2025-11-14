import type {
  HostFunctionContext,
  HostFunctionResult,
  MemoryAccessType,
  PVMGuest,
  RAM,
  RefineInvocationContext,
} from '@pbnj/types'
import { PVM_CONSTANTS } from '@pbnj/types'
import {
  ACCUMULATE_ERROR_CODES,
  GENERAL_FUNCTIONS,
  RESULT_CODES,
} from '../../config'
import { BaseHostFunction } from './base'

/**
 * PAGES host function (Ω_Z)
 *
 * Manages memory pages in PVM machine instances
 *
 * *** GRAY PAPER FORMULA ***
 * Gray Paper: pvm_invocations.tex, Ω_Z (pages = 11)
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
 *
 * Gray Paper Specification:
 * - Function ID: 11 (pages)
 * - Gas Cost: 10
 * - Parameters: registers[7:4] = [n, p, c, r]
 *   - n: machine ID
 *   - p: page start index (must be >= 16)
 *   - c: page count
 *   - r: access mode (0=none, 1=R, 2=W, 3=R+preserve, 4=W+preserve)
 */
export class PagesHostFunction extends BaseHostFunction {
  readonly functionId = GENERAL_FUNCTIONS.PAGES
  readonly name = 'pages'
  readonly gasCost = 10n

  // Gray Paper constants
  private readonly CPVM_PAGE_SIZE = PVM_CONSTANTS.PAGE_SIZE // Cpvmpagesize = 2^12
  private readonly MIN_PAGE_INDEX = 16n // Gray Paper: p < 16 is invalid
  private readonly MAX_PAGE_INDEX = 2n ** 32n / this.CPVM_PAGE_SIZE // Gray Paper: p+c >= 2^32/Cpvmpagesize is invalid

  execute(
    context: HostFunctionContext,
    refineContext: RefineInvocationContext | null,
  ): HostFunctionResult {
    // Extract parameters from registers
    const [machineId, pageStart, pageCount, accessRights] =
      context.registers.slice(7, 11)

    // Check if refine context is available
    if (!refineContext) {
      context.registers[7] = ACCUMULATE_ERROR_CODES.WHO
      context.log('Pages host function: No refine context available')
      return {
        resultCode: RESULT_CODES.HALT,
      }
    }

    // Get PVM machine
    const machine = refineContext.machines.get(machineId)
    if (!machine) {
      // Return WHO (2^64 - 4) if machine doesn't exist
      context.registers[7] = ACCUMULATE_ERROR_CODES.WHO
      context.log('Pages host function: Machine not found', {
        machineId: machineId.toString(),
      })
      return {
        resultCode: RESULT_CODES.HALT,
      }
    }

    // Validate parameters according to Gray Paper
    if (
      accessRights > 4n ||
      pageStart < this.MIN_PAGE_INDEX ||
      pageStart + pageCount >= this.MAX_PAGE_INDEX
    ) {
      // Return HUH (2^64 - 9) if invalid parameters
      context.registers[7] = ACCUMULATE_ERROR_CODES.HUH
      context.log('Pages host function: Invalid parameters', {
        machineId: machineId.toString(),
        pageStart: pageStart.toString(),
        pageCount: pageCount.toString(),
        accessRights: accessRights.toString(),
      })
      return {
        resultCode: RESULT_CODES.HALT,
      }
    }

    // Additional validation: if r > 2, check that pages don't contain 'none' access
    if (accessRights > 2n) {
      const hasInaccessiblePages = this.checkForInaccessiblePages(
        machine.pvm.state.ram,
        pageStart,
        pageCount,
      )
      if (hasInaccessiblePages) {
        context.registers[7] = ACCUMULATE_ERROR_CODES.HUH
        context.log('Pages host function: Pages contain inaccessible access', {
          machineId: machineId.toString(),
          pageStart: pageStart.toString(),
          pageCount: pageCount.toString(),
          accessRights: accessRights.toString(),
        })
        return {
          resultCode: RESULT_CODES.HALT,
        }
      }
    }

    // Set memory page access rights and data
    const success = this.setMemoryPageAccessRights(
      machine,
      pageStart,
      pageCount,
      accessRights,
    )

    if (!success) {
      context.registers[7] = ACCUMULATE_ERROR_CODES.HUH
      context.log('Pages host function: Failed to set page access rights', {
        machineId: machineId.toString(),
        pageStart: pageStart.toString(),
        pageCount: pageCount.toString(),
        accessRights: accessRights.toString(),
      })
      return {
        resultCode: RESULT_CODES.HALT,
      }
    }

    // Return OK (0) for success
    context.registers[7] = ACCUMULATE_ERROR_CODES.OK

    context.log('Pages host function: Page access rights set successfully', {
      machineId: machineId.toString(),
      pageStart: pageStart.toString(),
      pageCount: pageCount.toString(),
      accessRights: accessRights.toString(),
    })

    return {
      resultCode: null, // continue execution
    }
  }

  private checkForInaccessiblePages(
    ram: RAM,
    pageStart: bigint,
    pageCount: bigint,
  ): boolean {
    // Gray Paper: r > 2 ∧ (u_ram_access)[p:c] ∋ none
    // Check if any pages in the range have 'none' access
    for (let i = 0n; i < pageCount; i++) {
      const pageIndex = pageStart + i
      const pageAddress = pageIndex * this.CPVM_PAGE_SIZE

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
   * Gray Paper equation 606-614:
   * 1. Clear data if r < 3: (u'_ram_value) = {0, 0, ...}
   * 2. Preserve data if r >= 3: (u'_ram_value) = (u_ram_value)
   * 3. Set access rights per convertAccessRights()
   */
  private setMemoryPageAccessRights(
    machine: PVMGuest,
    pageStart: bigint,
    pageCount: bigint,
    accessRights: bigint,
  ): boolean {
    for (let i = 0n; i < pageCount; i++) {
      const pageIndex = pageStart + i
      const pageAddress = pageIndex * this.CPVM_PAGE_SIZE

      // Convert access rights to MemoryAccessType
      const accessType = this.convertAccessRights(accessRights)
      if (!accessType) {
        return false
      }

      // Gray Paper equation 606-609: Clear page data when r < 3
      if (accessRights < 3n) {
        this.clearPageData(
          machine.pvm.state.ram,
          pageAddress,
          this.CPVM_PAGE_SIZE,
        )
      }

      // Gray Paper equation 610-614: Set access rights
      machine.pvm.state.ram.setPageAccessRights(
        pageAddress,
        Number(this.CPVM_PAGE_SIZE),
        accessType,
      )
    }

    return true
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
