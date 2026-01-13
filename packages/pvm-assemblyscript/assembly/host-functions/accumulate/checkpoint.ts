import {
  AccumulateHostFunctionContext,
  BaseAccumulateHostFunction,
  HostFunctionResult,
  Implications,
} from './base'
import {
  PartialState,
  AccountEntry,
  CompleteServiceAccount,
  AlwaysAccerEntry,
  DeferredTransfer,
  ProvisionEntry,
  CshEntry,
  RawCshKeyvals,
} from '../../codec'

export class CheckpointHostFunction extends BaseAccumulateHostFunction {
  functionId: u64 = u64(17) // CHECKPOINT function ID
  name: string = 'checkpoint'
  gasCost: u64 = u64(10)

  execute(context: AccumulateHostFunctionContext): HostFunctionResult {
    // Gray Paper line 748-753: Ω_C (checkpoint)
    // imY' = imX (copy regular dimension to exceptional dimension)
    // registers'_7 = gascounter' (set registers[7] to gas counter after decrement)
    const registers = context.registers
    const implications = context.implications
    const gasCounter = context.gasCounter
    const imX = implications.regular

    // Gray Paper line 752: imY' = imX
    // Deep copy imX to imY to create the checkpoint
    // This creates a rollback point for exceptional termination (OOG or panic)
    // NOTE: We MUST do a deep copy, not a reference copy, because:
    // 1. After checkpoint, execution continues and modifies imX (regular dimension)
    // 2. If imY was just a reference to imX, those modifications would also affect imY
    // 3. When rolling back to imY on panic/OOG, we'd get the modified state instead of the checkpoint
    const checkpointState = new Implications()
    checkpointState.id = imX.id
    checkpointState.state = this.deepCopyPartialState(imX.state)
    checkpointState.nextfreeid = imX.nextfreeid
    checkpointState.xfers = this.deepCopyXfers(imX.xfers)
    checkpointState.yield = imX.yield !== null ? this.copyUint8Array(imX.yield!) : null
    checkpointState.provisions = this.deepCopyProvisions(imX.provisions)

    // Set the exceptional dimension to the checkpoint
    implications.exceptional = checkpointState

    // Gray Paper line 753: registers'_7 = gascounter'
    // Note: gasCounter passed here is already gascounter' (after gas cost deduction by the executor)
    // So we should return gasCounter directly, not gasCounter - gasCost
    this.setAccumulateSuccess(registers, gasCounter)

    return new HostFunctionResult(255) // continue execution
  }

  /**
   * Deep copy a Uint8Array
   */
  private copyUint8Array(arr: Uint8Array): Uint8Array {
    const copy = new Uint8Array(arr.length)
    copy.set(arr)
    return copy
  }

  /**
   * Deep copy PartialState including all nested structures
   * Gray Paper: Must create a complete snapshot for rollback capability
   */
  private deepCopyPartialState(state: PartialState): PartialState {
    const copy = new PartialState()
    
    // Deep copy accounts array with nested ServiceAccount structures
    copy.accounts = new Array<AccountEntry>(state.accounts.length)
    for (let i = 0; i < state.accounts.length; i++) {
      const entry = state.accounts[i]
      copy.accounts[i] = new AccountEntry(entry.serviceId, this.deepCopyServiceAccount(entry.account))
    }
    
    // Deep copy stagingset
    copy.stagingset = new Array<Uint8Array>(state.stagingset.length)
    for (let i = 0; i < state.stagingset.length; i++) {
      copy.stagingset[i] = this.copyUint8Array(state.stagingset[i])
    }
    
    // Deep copy authqueue (array of arrays)
    copy.authqueue = new Array<Array<Uint8Array>>(state.authqueue.length)
    for (let i = 0; i < state.authqueue.length; i++) {
      const innerArray = state.authqueue[i]
      copy.authqueue[i] = new Array<Uint8Array>(innerArray.length)
      for (let j = 0; j < innerArray.length; j++) {
        copy.authqueue[i][j] = this.copyUint8Array(innerArray[j])
      }
    }
    
    // Copy primitive fields
    copy.manager = state.manager
    copy.delegator = state.delegator
    copy.registrar = state.registrar
    
    // Deep copy assigners
    copy.assigners = new Array<u32>(state.assigners.length)
    for (let i = 0; i < state.assigners.length; i++) {
      copy.assigners[i] = state.assigners[i]
    }
    
    // Deep copy alwaysaccers
    copy.alwaysaccers = new Array<AlwaysAccerEntry>(state.alwaysaccers.length)
    for (let i = 0; i < state.alwaysaccers.length; i++) {
      const entry = state.alwaysaccers[i]
      copy.alwaysaccers[i] = new AlwaysAccerEntry(entry.serviceId, entry.gas)
    }
    
    return copy
  }

  /**
   * Deep copy ServiceAccount including rawCshKeyvals
   */
  private deepCopyServiceAccount(account: CompleteServiceAccount): CompleteServiceAccount {
    const copy = new CompleteServiceAccount()
    copy.codehash = this.copyUint8Array(account.codehash)
    copy.balance = account.balance
    copy.minaccgas = account.minaccgas
    copy.minmemogas = account.minmemogas
    copy.octets = account.octets
    copy.gratis = account.gratis
    copy.items = account.items
    copy.created = account.created
    copy.lastacc = account.lastacc
    copy.parent = account.parent
    
    // Deep copy rawCshKeyvals
    copy.rawCshKeyvals = new RawCshKeyvals()
    const keys = account.rawCshKeyvals.keys()
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]
      const value = account.rawCshKeyvals.get(key)
      if (value !== null) {
        copy.rawCshKeyvals.set(this.copyUint8Array(key), this.copyUint8Array(value))
      }
    }
    
    return copy
  }

  /**
   * Deep copy deferred transfers array
   */
  private deepCopyXfers(xfers: Array<DeferredTransfer>): Array<DeferredTransfer> {
    const copy = new Array<DeferredTransfer>(xfers.length)
    for (let i = 0; i < xfers.length; i++) {
      const xfer = xfers[i]
      const xferCopy = new DeferredTransfer()
      xferCopy.source = xfer.source
      xferCopy.dest = xfer.dest
      xferCopy.amount = xfer.amount
      xferCopy.memo = this.copyUint8Array(xfer.memo)
      xferCopy.gasLimit = xfer.gasLimit
      copy[i] = xferCopy
    }
    return copy
  }

  /**
   * Deep copy provisions array
   */
  private deepCopyProvisions(provisions: Array<ProvisionEntry>): Array<ProvisionEntry> {
    const copy = new Array<ProvisionEntry>(provisions.length)
    for (let i = 0; i < provisions.length; i++) {
      const entry = provisions[i]
      copy[i] = new ProvisionEntry(entry.serviceId, this.copyUint8Array(entry.blob))
    }
    return copy
  }
}
