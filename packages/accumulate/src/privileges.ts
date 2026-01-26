import type { IPrivilegesService } from '@pbnjam/types'
/**
 * Apply privileges using Gray Paper R function
 * Gray Paper accpar equations 220-238:
 * - manager and alwaysaccers come directly from manager's poststate
 * - delegator, registrar, assigners use R(original, manager_poststate, holder_poststate)
 * - R(o, a, b) = b when a = o (manager didn't change), else a (manager changed)
 */
export function applyPrivilegesWithRFunction(
  initialPrivileges: {
    manager: bigint
    assigners: bigint[]
    delegator: bigint
    registrar: bigint
    alwaysaccers: Map<bigint, bigint>
  },
  servicePoststates: Map<
    bigint,
    {
      manager: bigint
      assigners: bigint[]
      delegator: bigint
      registrar: bigint
      alwaysaccers: Map<bigint, bigint>
    }
  >,
  privilegesService: IPrivilegesService,
): void {
  // Get current (initial) privilege holders
  const currentManager = initialPrivileges.manager
  const currentDelegator = initialPrivileges.delegator
  const currentRegistrar = initialPrivileges.registrar

  // Get manager's poststate (if manager was accumulated)
  // If manager wasn't accumulated, treat as if manager didn't change any privileges
  const managerPoststate = servicePoststates.get(currentManager)

  // Gray Paper R function: R(o, a, b) = b when a = o, else a
  // o = original value, a = manager's poststate, b = current holder's poststate
  // If manager wasn't accumulated, a = o (manager didn't change), so result = b (holder's value)
  const R = <T>(
    original: T,
    managerValue: T | undefined,
    holderValue: T,
  ): T => {
    // If manager didn't change (managerValue === original or manager not accumulated), use holder's value
    // Otherwise, use manager's value (manager takes priority)
    const effectiveManagerValue = managerValue ?? original // If manager not accumulated, treat as unchanged
    return effectiveManagerValue === original
      ? holderValue
      : effectiveManagerValue
  }

  // Gray Paper equation 221-222: manager and alwaysaccers come from manager's poststate
  // If manager wasn't accumulated, keep current values
  if (managerPoststate) {
    privilegesService.setManager(managerPoststate.manager)
    privilegesService.setAlwaysAccers(managerPoststate.alwaysaccers)
  }

  // Gray Paper equation 229-233: delegator' = R(delegator, managerPoststate.delegator, delegatorService.poststate.delegator)
  const delegatorPoststate = servicePoststates.get(currentDelegator)
  const newDelegator = R(
    currentDelegator,
    managerPoststate?.delegator,
    delegatorPoststate?.delegator ?? currentDelegator,
  )
  privilegesService.setDelegator(newDelegator)

  // Gray Paper equation 234-238: registrar' = R(registrar, managerPoststate.registrar, registrarService.poststate.registrar)
  const registrarPoststate = servicePoststates.get(currentRegistrar)
  const newRegistrar = R(
    currentRegistrar,
    managerPoststate?.registrar,
    registrarPoststate?.registrar ?? currentRegistrar,
  )
  privilegesService.setRegistrar(newRegistrar)

  // Gray Paper equation 223-228: assigners[c] = R(assigners[c], managerPoststate.assigners[c], assignerService.poststate.assigners[c])
  const newAssigners: bigint[] = []
  for (let c = 0; c < initialPrivileges.assigners.length; c++) {
    const currentAssigner = initialPrivileges.assigners[c] ?? 0n
    const assignerPoststate = servicePoststates.get(currentAssigner)
    const newAssigner = R(
      currentAssigner,
      managerPoststate?.assigners[c],
      assignerPoststate?.assigners[c] ?? currentAssigner,
    )
    newAssigners.push(newAssigner)
  }
  privilegesService.setAssigners(newAssigners)
}
