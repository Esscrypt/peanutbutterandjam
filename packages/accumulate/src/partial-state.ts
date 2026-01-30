import { encodeValidatorPublicKeys } from '@pbnjam/codec'
import { hexToBytes, logger } from '@pbnjam/core'
import type {
  IAuthQueueService,
  IConfigService,
  IPrivilegesService,
  IServiceAccountService,
  IValidatorSetManager,
  PartialState,
  ServiceAccount,
} from '@pbnjam/types'
/**
 * Create partial state for PVM invocation
 */
/**
 * Create partial state for PVM invocation
 *
 * Gray Paper accumulation.tex equation 134 (eq:partialstate):
 * partialstate ≡ tuple{
 *   ps_accounts: dictionary{serviceid}{serviceaccount},
 *   ps_stagingset: sequence[Cvalcount]{valkey},  // MUST have exactly Cvalcount validators
 *   ps_authqueue: sequence[Ccorecount]{sequence[Cauthqueuesize]{hash}},
 *   ps_manager: serviceid,
 *   ps_assigners: sequence[Ccorecount]{serviceid},
 *   ps_delegator: serviceid,
 *   ps_registrar: serviceid,
 *   ps_alwaysaccers: dictionary{serviceid}{gas}
 * }
 *
 * The staging set MUST be a fixed-length sequence of exactly Cvalcount validators.
 * If not initialized, we pad with null validators (all zeros) to meet the requirement.
 */
export function createPartialState(
  validatorSetManager: IValidatorSetManager,
  configService: IConfigService,
  serviceAccountsService: IServiceAccountService,
  authQueueService: IAuthQueueService,
  privilegesService: IPrivilegesService,
): PartialState {
  // Get staging validators - MUST have exactly Cvalcount elements
  let stagingset: Uint8Array[] = []

  const stagingValidatorsMap = validatorSetManager.getStagingValidators()
  const stagingValidatorsArray = Array.from(stagingValidatorsMap.values())

  // Convert to Uint8Array format
  stagingset = stagingValidatorsArray.map(encodeValidatorPublicKeys)

  // Gray Paper requires exactly Cvalcount validators in the staging set
  // If we have fewer (or zero), pad with null validators
  const requiredCount = configService.numValidators
  if (stagingset.length < requiredCount) {
    // Create null validators using ValidatorSetManager's method
    // Gray Paper: null keys replace blacklisted validators (equation 122-123)
    const nullValidators = validatorSetManager.createNullValidatorSet(
      requiredCount - stagingset.length,
    )

    // Encode null validators to Uint8Array format and append
    const nullValidatorsEncoded = nullValidators.map(encodeValidatorPublicKeys)
    stagingset = [...stagingset, ...nullValidatorsEncoded]
  } else if (stagingset.length > requiredCount) {
    // Truncate if somehow we have more than required (shouldn't happen, but be safe)
    logger.warn(
      '[AccumulationService] Staging set has more than Cvalcount validators, truncating',
      {
        currentCount: stagingset.length,
        requiredCount,
      },
    )
    stagingset = stagingset.slice(0, requiredCount)
  }

  const accounts = serviceAccountsService.getServiceAccounts().accounts

  return {
    accounts,
    stagingset,
    authqueue: authQueueService
      .getAuthQueue()
      .map((queue) => queue.map((item) => hexToBytes(item))),
    manager: privilegesService.getManager(),
    assigners: privilegesService.getAssigners(),
    delegator: privilegesService.getDelegator(),
    registrar: privilegesService.getRegistrar(),
    alwaysaccers: privilegesService.getAlwaysAccers(),
  }
}

/**
 * Create a SNAPSHOT of the partial state with deep-cloned accounts.
 * Gray Paper accpar: All services in the same batch see the state from the START of the batch.
 * This method clones all storage/preimages/requests maps to prevent modifications
 * from one service affecting another service in the same batch.
 */
export function createPartialStateSnapshot(
  validatorSetManager: IValidatorSetManager,
  configService: IConfigService,
  serviceAccountsService: IServiceAccountService,
  authQueueService: IAuthQueueService,
  privilegesService: IPrivilegesService,
): PartialState {
  return clonePartialState(
    createPartialState(
      validatorSetManager,
      configService,
      serviceAccountsService,
      authQueueService,
      privilegesService,
    ),
  )
}

/**
 * Deep clone a partial state to prevent modifications from affecting the original.
 * Used to give each invocation in a batch its own copy of the state.
 */
export function clonePartialState(originalState: PartialState): PartialState {
  // Deep clone accounts to prevent modifications from affecting other services
  const clonedAccounts = new Map<bigint, ServiceAccount>()
  for (const [serviceId, account] of originalState.accounts) {
    const clonedAccount: ServiceAccount = {
      ...account,
      rawCshKeyvals: JSON.parse(JSON.stringify(account.rawCshKeyvals)),
    }
    clonedAccounts.set(serviceId, clonedAccount)
  }

  // Deep clone authqueue (2D array) - assign host function modifies this
  const clonedAuthqueue: Uint8Array[][] = originalState.authqueue.map(
    (coreQueue) => coreQueue.map((entry) => new Uint8Array(entry)),
  )

  // Deep clone assigners array - assign host function modifies this
  const clonedAssigners = [...originalState.assigners]

  // Clone alwaysaccers map - bless host function modifies this
  const clonedAlwaysaccers = new Map(originalState.alwaysaccers)

  // Deep clone stagingset array (though it's not modified by host functions)
  const clonedStagingset = originalState.stagingset.map(
    (entry) => new Uint8Array(entry),
  )

  return {
    ...originalState,
    accounts: clonedAccounts,
    authqueue: clonedAuthqueue, // Deep cloned - assign modifies this
    assigners: clonedAssigners, // Deep cloned - assign modifies this
    alwaysaccers: clonedAlwaysaccers, // Deep cloned - bless modifies this
    stagingset: clonedStagingset, // Deep cloned for consistency
    // manager, delegator, registrar are primitives (bigint), so they're copied by value
  }
}
