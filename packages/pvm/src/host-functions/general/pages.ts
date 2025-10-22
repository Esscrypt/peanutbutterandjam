import type {
  HostFunctionContext,
  HostFunctionResult,
  MemoryAccessType,
  PVMGuest,
  RAM,
  RefineContextPVM,
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
 * Gray Paper Specification:
 * - Function ID: 11 (pages)
 * - Gas Cost: 10
 * - Signature: Ω_Z(gascounter, registers, memory, (m, e))
 * - Parameters: registers[7:4] = [n, p, c, r]
 *   - n: machine ID
 *   - p: page start index
 *   - c: page count
 *   - r: access rights (0=none, 1=read, 2=write, 3=read+write, 4=write+preserve)
 * - Returns: registers[7] = OK, WHO, or HUH
 * - Sets page access rights and optionally clears page data
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
    refineContext?: RefineContextPVM,
  ): HostFunctionResult {
    // Validate execution
    if (context.gasCounter < this.gasCost) {
      return {
        resultCode: RESULT_CODES.OOG,
      }
    }

    context.gasCounter -= this.gasCost

    // Extract parameters from registers
    const [machineId, pageStart, pageCount, accessRights] =
      context.registers.slice(7, 11)

    // Check if refine context is available
    if (!refineContext) {
      context.registers[7] = ACCUMULATE_ERROR_CODES.WHO
      return {
        resultCode: RESULT_CODES.HALT,
      }
    }

    // Get PVM machine
    const machine = this.getPVMMachine(refineContext, machineId)
    if (!machine) {
      // Return WHO (2^64 - 4) if machine doesn't exist
      context.registers[7] = ACCUMULATE_ERROR_CODES.WHO
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
      return {
        resultCode: RESULT_CODES.HALT,
      }
    }

    // Additional validation: if r > 2, check that pages don't contain 'none' access
    if (accessRights > 2n) {
      const hasInaccessiblePages = this.checkForInaccessiblePages(
        machine.ram,
        pageStart,
        pageCount,
      )
      if (hasInaccessiblePages) {
        context.registers[7] = ACCUMULATE_ERROR_CODES.HUH
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
      return {
        resultCode: RESULT_CODES.HALT,
      }
    }

    // Return OK (0) for success
    context.registers[7] = ACCUMULATE_ERROR_CODES.OK

    return {
      resultCode: null, // continue execution
    }
  }

  private getPVMMachine(
    refineContext: RefineContextPVM,
    machineId: bigint,
  ): PVMGuest | null {
    // Gray Paper: Ω_Z(gascounter, registers, memory, (m, e))
    // where m = machines dictionary
    return refineContext.machines.get(machineId) || null
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

  private setMemoryPageAccessRights(
    machine: PVMGuest,
    pageStart: bigint,
    pageCount: bigint,
    accessRights: bigint,
  ): boolean {
    // Gray Paper: u' = u exc { ... }
    // Update RAM with new access rights and optionally clear data

    for (let i = 0n; i < pageCount; i++) {
      const pageIndex = pageStart + i
      const pageAddress = pageIndex * this.CPVM_PAGE_SIZE

      // Convert access rights to MemoryAccessType
      const accessType = this.convertAccessRights(accessRights)
      if (!accessType) {
        return false // Invalid access rights
      }

      // Clear page data if r < 3 (Gray Paper: clear when r < 3)
      if (accessRights < 3n) {
        this.clearPageData(machine.ram, pageAddress, this.CPVM_PAGE_SIZE)
      }

      // Set page access rights using the new RAM interface
      machine.ram.setPageAccessRights(
        pageAddress,
        Number(this.CPVM_PAGE_SIZE),
        accessType,
      )
    }

    return true
  }

  private convertAccessRights(accessRights: bigint): MemoryAccessType | null {
    // Gray Paper access rights mapping:
    // 0 = none, 1 = read, 2 = write, 3 = read+write, 4 = write+preserve
    switch (accessRights) {
      case 0n:
        return 'none'
      case 1n:
        return 'read'
      case 2n:
        return 'write'
      case 3n:
      case 4n:
        return 'read+write'
      default:
        return null // Invalid access rights
    }
  }

  private clearPageData(ram: RAM, startAddress: bigint, size: bigint): void {
    // Gray Paper: (u'_ram_value)[p*Cpvmpagesize...c*Cpvmpagesize] = {0, 0, ...}
    // Clear page data by writing zeros
    const zeroData = new Uint8Array(Number(size))
    ram.writeOctets(startAddress, zeroData)
  }
}
