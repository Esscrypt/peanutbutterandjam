import { hexToBytes } from '@pbnjam/core'
import type {
  IServiceAccountService,
  ReadyItem,
  WorkExecResultValue,
  WorkExecutionResult,
} from '@pbnjam/types'
import { WORK_REPORT_CONSTANTS } from '@pbnjam/types'
import type { Hex } from 'viem'
/**
 * Validate work-report gas constraints
 * Gray Paper reporting_assurance.tex lines 303-306:
 * ∀ wrX ∈ incomingreports:
 *   sum(work-digest gaslimit) ≤ Creportaccgas
 *   ∧ each work-digest gaslimit ≥ service minaccgas
 */
export function validateWorkReportGasConstraints(
  items: ReadyItem[],
  serviceAccountsService: IServiceAccountService,
): void {
  for (const item of items) {
    const workReport = item.workReport
    let totalGasLimit = 0n

    for (const result of workReport.results) {
      const gasLimit = BigInt(result.accumulate_gas)
      totalGasLimit += gasLimit

      // Verify each work-digest gaslimit ≥ service minaccgas
      const serviceId = result.service_id
      const [serviceAccountError, serviceAccount] =
        serviceAccountsService.getServiceAccount(serviceId)

      // Skip validation for ejected services (service account not found)
      // Gray Paper: Work reports for ejected services are processed but don't affect state
      if (serviceAccountError || !serviceAccount) {
        continue
      }

      const minAccGas = BigInt(serviceAccount.minaccgas)
      if (gasLimit < minAccGas) {
        throw new Error(
          `Work-report gas limit ${gasLimit} for service ${serviceId} is less than minimum ${minAccGas}`,
        )
      }
    }

    // Verify sum ≤ Creportaccgas
    if (totalGasLimit > WORK_REPORT_CONSTANTS.C_REPORTACCGAS) {
      throw new Error(
        `Work-report total gas limit ${totalGasLimit} exceeds Creportaccgas ${WORK_REPORT_CONSTANTS.C_REPORTACCGAS}`,
      )
    }
  }
}

/**
 * Convert WorkExecResultValue to WorkExecutionResult
 *
 * WorkExecResultValue can be:
 * - Hex string or { ok: Hex } → Uint8Array
 * - { panic: null } → 'PANIC'
 * - Error strings → WorkError
 */
export function convertWorkResultToExecutionResult(
  value: WorkExecResultValue,
): WorkExecutionResult {
  if (typeof value === 'string') {
    if (value.startsWith('0x')) {
      // Hex string: convert to Uint8Array
      return hexToBytes(value as Hex)
    } else {
      // Error string: map to WorkExecutionResult string literals
      const errorMap: Record<string, WorkExecutionResult> = {
        out_of_gas: 'OOG',
        bad_exports: 'BADEXPORTS',
        oversize: 'OVERSIZE',
        bad_code: 'BAD',
        code_oversize: 'BIG',
      }
      return errorMap[value] || 'BAD'
    }
  } else if (typeof value === 'object' && value !== null) {
    if (
      'ok' in value &&
      typeof value.ok === 'string' &&
      value.ok.startsWith('0x')
    ) {
      // { ok: Hex } → Uint8Array
      return hexToBytes(value.ok)
    } else if ('panic' in value) {
      // { panic: null } → 'PANIC'
      return 'PANIC'
    }
  }
  // Fallback to BAD error
  return 'BAD'
}
