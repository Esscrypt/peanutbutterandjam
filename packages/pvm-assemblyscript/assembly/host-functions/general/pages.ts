import { RAM, RefineInvocationContext } from '../../pbnj-types-compat'
import { MemoryAccessType } from '../../types'
import { PVMGuest } from './base'
import { HostFunctionResult } from '../accumulate/base'
import { HostFunctionContext, HostFunctionParams, PagesParams } from './base'
import { BaseHostFunction } from './base'
import {
  ACCUMULATE_ERROR_CODES,
  GENERAL_FUNCTIONS,
  MEMORY_CONFIG,
  RESULT_CODES,
} from '../../config'

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
 *   {none, none, .}  when r = 0
 *   {R, R, .}        when r = 1 ∨ r = 3
 *   {W, W, .}        when r = 2 ∨ r = 4
 * }
 *
 * Page data (equation 606-609):
 * (u'_ram_value)[p*Cpvmpagesize.(p+c)*Cpvmpagesize] = {
 *   {0, 0, .}                when r < 3  (clear data)
 *   (u_ram_value)[p*Cpvmpagesize.(p+c)*Cpvmpagesize]  when r >= 3 (preserve data)
 * }
 *
 * Return codes:
 * - registers[7] = WHO when n ∉ keys(m)
 * - registers[7] = HUH when r > 4 ∨ p < 16 ∨ p+c >= 2^32/Cpvmpagesize
 * - registers[7] = HUH when r > 2 ∧ (u_ram_access)[p:c] ∋ none
 * - registers[7] = OK otherwise
 */
export class PagesHostFunction extends BaseHostFunction {
  functionId: u64 = GENERAL_FUNCTIONS.PAGES
  name: string = 'pages'
  gasCost: u64 = 10

  execute(
    context: HostFunctionContext,
    params: HostFunctionParams | null,
  ): HostFunctionResult {
    if (!params) {
      return new HostFunctionResult(RESULT_CODES.PANIC)
    }
    const pagesParams = params as PagesParams
    if (!pagesParams.refineContext) {
      return new HostFunctionResult(RESULT_CODES.PANIC)
    }
    
    // Gray Paper: Extract parameters from registers
    // registers[7:4] = (n, p, c, r)
    const machineId = context.registers[7]
    const pageStart = u32(context.registers[8])
    const pageCount = u32(context.registers[9])
    const accessRights = u32(context.registers[10])

    // Gray Paper equation 601-604: Get machine RAM
    // u = m[n].ram if n in keys(m), error otherwise
    const refineContext = pagesParams.refineContext!
    const machine = refineContext.machines.get(machineId)
    if (!machine) {
      // Gray Paper equation 617: Return WHO if machine doesn't exist
      context.registers[7] = ACCUMULATE_ERROR_CODES.WHO
      return new HostFunctionResult(255) // continue execution
    }

    // Gray Paper equation 618: Validate parameters
    // Return HUH if r > 4 ∨ p < 16 ∨ p+c >= 2^32/Cpvmpagesize
    const MIN_PAGE_INDEX: u32 = 16 // Gray Paper: p < 16 is invalid
    const MAX_PAGE_INDEX: u32 = u32((u64(2) ** 32) / u64(MEMORY_CONFIG.PAGE_SIZE)) // Gray Paper: p+c >= 2^32/Cpvmpagesize is invalid

    if (
      accessRights > 4 ||
      pageStart < MIN_PAGE_INDEX ||
      pageStart + pageCount >= MAX_PAGE_INDEX
    ) {
      // Gray Paper equation 619: Return HUH if invalid parameters
      context.registers[7] = ACCUMULATE_ERROR_CODES.HUH
      return new HostFunctionResult(255) // continue execution
    }

    // Gray Paper equation 619: Additional validation
    // Return HUH if r > 2 ∧ (u_ram_access)[p:c] ∋ none
    if (accessRights > 2) {
      const hasInaccessiblePages = this.checkForInaccessiblePages(
        machine.pvm.state.ram,
        pageStart,
        pageCount,
      )
      if (hasInaccessiblePages) {
        context.registers[7] = ACCUMULATE_ERROR_CODES.HUH
        return new HostFunctionResult(255) // continue execution
      }
    }

    // Gray Paper equation 605-614: Set memory page access rights and data
    this.setMemoryPageAccessRights(
      machine,
      pageStart,
      pageCount,
      accessRights,
    )

    // Gray Paper equation 620: Return OK for success
    context.registers[7] = ACCUMULATE_ERROR_CODES.OK

    return new HostFunctionResult(255) // continue execution
  }

  checkForInaccessiblePages(
    ram: RAM,
    pageStart: u32,
    pageCount: u32,
  ): bool {
    // Gray Paper equation 619: r > 2 ∧ (u_ram_access)[p:c] ∋ none
    // Check if any pages in the range have 'none' access
    const PAGE_SIZE = MEMORY_CONFIG.PAGE_SIZE
    for (let i: u32 = 0; i < pageCount; i++) {
      const pageIndex = pageStart + i
      const pageAddress = u32(pageIndex * PAGE_SIZE)

      // Check if the page has 'none' access
      const accessResult = ram.isReadableWithFault(pageAddress, PAGE_SIZE)
      if (!accessResult.success) {
        return true // Found inaccessible page
      }
    }
    return false
  }

  /**
   * Set memory page access rights and optionally clear data
   *
   * Gray Paper equation 605-614:
   * 1. Clear data if r < 3: (u'_ram_value) = {0, 0, .}
   * 2. Preserve data if r >= 3: (u'_ram_value) = (u_ram_value)
   * 3. Set access rights per convertAccessRights()
   */
  setMemoryPageAccessRights(
    machine: PVMGuest,
    pageStart: u32,
    pageCount: u32,
    accessRights: u32,
  ): void {
    const PAGE_SIZE = u32(MEMORY_CONFIG.PAGE_SIZE)
    const accessType = this.convertAccessRights(accessRights)
    // accessRights is already validated to be <= 4, so accessType should never be null
    if (!accessType) {
      // Return early instead of throwing to avoid WASM abort
      return
    }

    for (let i: u32 = 0; i < pageCount; i++) {
      const pageIndex = pageStart + i
      const pageAddress = u32(pageIndex * PAGE_SIZE)

      // Gray Paper equation 606-609: Clear page data when r < 3
      if (accessRights < 3) {
        this.clearPageData(
          machine.pvm.state.ram,
          pageAddress,
          PAGE_SIZE,
        )
      }

      // Gray Paper equation 610-614: Set access rights
      machine.pvm.state.ram.setPageAccessRights(
        pageAddress,
        PAGE_SIZE,
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
  convertAccessRights(accessRights: u32): MemoryAccessType {
    switch (accessRights) {
      case 0:
        return MemoryAccessType.NONE // r = 0
      case 1:
      case 3:
        return MemoryAccessType.READ // r = 1 ∨ r = 3 → R
      case 2:
      case 4:
        return MemoryAccessType.WRITE // r = 2 ∨ r = 4 → W
      default:
        return MemoryAccessType.NONE // Invalid r - default to NONE
    }
  }

  /**
   * Clear page data by writing zeros
   *
   * Gray Paper equation 606-609:
   * (u'_ram_value)[p*Cpvmpagesize.(p+c)*Cpvmpagesize] = {0, 0, .}
   */
  clearPageData(ram: RAM, startAddress: u32, size: u32): void {
    const zeroData = new Uint8Array(size)
    ram.writeOctets(startAddress, zeroData)
  }
}
