import { RESULT_CODE_PANIC } from '../../config'
import { DeferredTransfer } from '../../codec'
import {
  ACCUMULATE_ERROR_WHO,
  ACCUMULATE_ERROR_LOW,
  ACCUMULATE_ERROR_CASH,
  ACCUMULATE_ERROR_HUH,
  ACCUMULATE_ERROR_OK,
  AccumulateHostFunctionContext,
  BaseAccumulateHostFunction,
  HostFunctionResult,
} from './base'

/**
 * TRANSFER accumulation host function (Ω_T)
 *
 * Transfers tokens between service accounts
 *
 * Gray Paper Specification:
 * - Function ID: 20 (transfer)
 * - Gas Cost: 10 + l (gasLimit) on success, 10 on error
 * - Parameters: registers[7-10] = dest, amount, l, o
 *   - dest: destination service account ID
 *   - amount: transfer amount
 *   - l: gas limit for the transfer
 *   - o: memo offset in memory
 * - Returns: registers[7] = OK or error code
 *
 * Gray Paper Logic:
 * 1. Read memo from memory (128 bytes)
 * 2. Check if destination service exists
 * 3. Check if gas limit is sufficient for destination
 * 4. Check if sender has sufficient balance
 * 5. Create deferred transfer entry
 * 6. Deduct amount from sender's balance
 */
export class TransferHostFunction extends BaseAccumulateHostFunction {
  functionId: u64 = u64(20) // TRANSFER function ID
  name: string = 'transfer'
  gasCost: u64 = u64(10) // Base cost, actual cost is 10 + gasLimit on success

  execute(context: AccumulateHostFunctionContext): HostFunctionResult {
    const registers = context.registers
    const ram = context.ram
    const implications = context.implications
    
    // Extract parameters from registers
    // Gray Paper pvm_invocations.tex line 818: [dest, amount, l, o] = registers[7:4]
    const destinationServiceId = u64(registers[7])
    const amount = u64(registers[8])
    const gasLimit = u64(registers[9])
    const memoOffset = u64(registers[10])

    // Read memo from memory (128 bytes - Gray Paper Cmemosize)
    // Gray Paper pvm_invocations.tex lines 820-832:
    // t = error when Nrange(o, Cmemosize) not readable
    // c = panic when t = error
    // registers'_7 = registers_7 (unchanged) when c = panic
    const C_MEMO_SIZE: u32 = 128
    const readResult_memo = ram.readOctets(u32(memoOffset), C_MEMO_SIZE)
    if (readResult_memo.faultAddress !== 0 || readResult_memo.data === null) {
      // Gray Paper line 832: c = panic when t = error
      // Gray Paper line 839: registers'_7 = registers_7 (unchanged) when c = panic
      // DO NOT modify registers[7] - it must remain unchanged on panic
      return new HostFunctionResult(RESULT_CODE_PANIC)
    }
    const memoData = readResult_memo.data!

    // Get the current implications context
    const imX = implications.regular

    // Get current service account
    const currentAccountEntry = this.findAccountEntry(imX.state.accounts, imX.id)
    if (currentAccountEntry === null) {
      this.setAccumulateError(registers, ACCUMULATE_ERROR_HUH)
      return new HostFunctionResult(255) // continue execution
    }
    const currentService = currentAccountEntry.account

    // Check if destination service exists
    const destAccountEntry = this.findAccountEntry(imX.state.accounts, destinationServiceId)
    if (destAccountEntry === null) {
      this.setAccumulateError(registers, ACCUMULATE_ERROR_WHO)
      return new HostFunctionResult(255) // continue execution
    }
    const destService = destAccountEntry.account

    // Check if gas limit is sufficient for destination
    // Gray Paper: l < destService.sa_minmemogas
    if (gasLimit < destService.minmemogas) {
      this.setAccumulateError(registers, ACCUMULATE_ERROR_LOW)
      return new HostFunctionResult(255) // continue execution
    }

    // Check if sender has sufficient balance after transfer
    // Gray Paper line 830: b = (imX_self)_sa_balance - amount
    // Gray Paper line 835: CASH when b < (imX_self)_sa_minbalance
    // Gray Paper accounts.tex: sa_minbalance = max(0, Cbasedeposit + Citemdeposit * items + Cbytedeposit * octets - gratis)
    if (currentService.balance < amount) {
      // Would result in negative balance - insufficient funds
      this.setAccumulateError(registers, ACCUMULATE_ERROR_CASH)
      return new HostFunctionResult(255) // continue execution
    }
    const balanceAfterTransfer = currentService.balance - amount

    // Calculate minbalance according to Gray Paper accounts.tex
    const C_BASEDEPOSIT: u64 = u64(100)
    const C_ITEMDEPOSIT: u64 = u64(10)
    const C_BYTEDEPOSIT: u64 = u64(1)
    const baseDeposit = C_BASEDEPOSIT
    const itemDeposit = C_ITEMDEPOSIT * u64(currentService.items)
    const byteDeposit = C_BYTEDEPOSIT * currentService.octets
    const totalDeposit = baseDeposit + itemDeposit + byteDeposit
    const minbalance = totalDeposit > currentService.gratis
      ? totalDeposit - currentService.gratis
      : u64(0)

    if (balanceAfterTransfer < minbalance) {
      this.setAccumulateError(registers, ACCUMULATE_ERROR_CASH)
      return new HostFunctionResult(255) // continue execution
    }

    // Create deferred transfer entry
    // Gray Paper: t = {source: imX.id, dest, amount, memo, gas: l}
    const deferredTransfer = new DeferredTransfer()
    deferredTransfer.source = u32(imX.id)
    deferredTransfer.dest = u32(destinationServiceId)
    deferredTransfer.amount = amount
    deferredTransfer.memo = memoData
    deferredTransfer.gasLimit = gasLimit

    // Add transfer to xfers list
    imX.xfers.push(deferredTransfer)

    // Deduct amount from sender's balance
    currentService.balance = balanceAfterTransfer

    // Set success result
    this.setAccumulateSuccess(registers, ACCUMULATE_ERROR_OK)

    // Gray Paper: On success, gas cost is 10 + l (where l = gasLimit)
    // Return with additionalGasCost to deduct gasLimit from gas counter
    return new HostFunctionResult(255, gasLimit) // continue execution, deduct gasLimit
  }
}
