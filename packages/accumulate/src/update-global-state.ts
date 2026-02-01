import {
  decodeValidatorPublicKeys,
  setServicePreimageValue,
  setServiceRequestValue,
} from '@pbnjam/codec'
import { blake2bHash } from '@pbnjam/core'
import type {
  AccumulateInvocationResult,
  IServiceAccountService,
  IValidatorSetManager,
  ValidatorPublicKeys,
} from '@pbnjam/types'

/**
 * Apply accumulation results to service accounts, provisions, privileges, and staging set.
 * Mutates servicePoststates, updatedAccounts, and ejectedServices.
 */
export function applyAccumulationResultsToState(
  results: AccumulateInvocationResult[],
  accumulatedServiceIds: bigint[] | undefined,
  currentSlot: bigint,
  partialStateAccountsPerInvocation: Map<number, Set<bigint>> | undefined,
  delegatorServiceId: bigint,
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
  updatedAccounts: Set<bigint>,
  ejectedServices: Set<bigint>,
  accumulationStatistics: Map<bigint, [number, number]>,
  accumulatedServicesForLastacc: Set<bigint>,
  serviceAccountsService: IServiceAccountService,
  validatorSetManager: IValidatorSetManager,
  _batchInvocationIndex?: number,
): void {
  // Pass 1: detect all ejected services so we can skip re-adding them in pass 2
  for (let i = 0; i < results.length; i++) {
    const result = results[i]
    if (!accumulatedServiceIds || accumulatedServiceIds[i] === undefined) {
      continue
    }
    if (result.ok) {
      const { poststate } = result.value
      const partialStateServicesForThisInvocation =
        partialStateAccountsPerInvocation?.get(i)
      if (partialStateServicesForThisInvocation) {
        for (const serviceId of partialStateServicesForThisInvocation) {
          if (!poststate.accounts.has(serviceId)) {
            ejectedServices.add(serviceId)
          }
        }
      }
    }
  }

  // Pass 2: apply account updates (skip when in ejectedServices or already deleted)
  for (let i = 0; i < results.length; i++) {
    const result = results[i]

    if (!accumulatedServiceIds || accumulatedServiceIds[i] === undefined) {
      continue
    }

    const accumulatedServiceId = accumulatedServiceIds[i]

    if (result.ok) {
      const { poststate } = result.value

      // Only update the accumulated service account directly
      // Other accounts in poststate are from partial state and shouldn't be updated
      // (except newly created services, which are handled below)
      // Apply accumulated account even when in ejectedServices so transfers and metadata (balance, octets, items)
      // are applied before we replace with tombstone; tombstone then preserves those and clears keyvals.
      const accumulatedAccount = poststate.accounts.get(accumulatedServiceId)
      const [existingAccountError] =
        serviceAccountsService.getServiceAccount(accumulatedServiceId)
      const alreadyDeleted = !!existingAccountError
      if (accumulatedAccount && !alreadyDeleted) {
        // Gray Paper equation 410-412: lastacc is updated AFTER all accumulation iterations complete
        // ONLY if service is in accumulationStatistics (i.e., had work items or used gas)
        // Services that only receive transfers without executing code should NOT have lastacc updated
        if (accumulationStatistics.has(accumulatedServiceId)) {
          accumulatedServicesForLastacc.add(accumulatedServiceId)
        }

        // Update the service account (without modifying lastacc - that's done later)
        serviceAccountsService.setServiceAccount(
          accumulatedServiceId,
          accumulatedAccount,
        )
        updatedAccounts.add(accumulatedServiceId)
      }

      // Handle newly created services (services in poststate but not in updatedAccounts)
      // These are services created during accumulation (e.g., via NEW host function).
      // Only set services that were NOT in partial state for this invocation - otherwise we would
      // re-add services that were ejected in a previous batch (updateGlobalState is called per batch
      // with a fresh ejectedServices set, so a later batch could re-add an ejected service from poststate).
      const partialStateForInvocation =
        partialStateAccountsPerInvocation?.get(i)
      for (const [serviceId, account] of poststate.accounts) {
        const wasInPartialState = partialStateForInvocation?.has(serviceId)
        if (
          serviceId !== accumulatedServiceId &&
          !updatedAccounts.has(serviceId) &&
          !ejectedServices.has(serviceId) &&
          !wasInPartialState
        ) {
          // Newly created service - keep lastacc = 0 (they're created, not accumulated)
          // Gray Paper: New services have lastacc = 0
          serviceAccountsService.setServiceAccount(serviceId, account)
          updatedAccounts.add(serviceId)
        }
      }

      // Gray Paper line 213-216: Apply provisions from accumulation output
      // local_fnprovide: For each (serviceId, preimageData) in provisions:
      //   - Set preimages[blake(preimageData)] = preimageData
      //   - Set requests[(blake(preimageData), len(preimageData))] = [currentSlot]
      const { provisions } = result.value

      for (const [provisionServiceId, preimageData] of provisions) {
        const [hashError, preimageHash] = blake2bHash(preimageData)
        if (hashError || !preimageHash) {
          continue
        }

        // Get the service account (may have been updated above)
        const [accountError, account] =
          serviceAccountsService.getServiceAccount(provisionServiceId)
        if (accountError || !account) {
          continue
        }

        // Check if provision is still providable (request exists and is not already provided)
        const preimageLength = BigInt(preimageData.length)
        const request = serviceAccountsService.getServiceAccountRequest(
          provisionServiceId,
          preimageHash,
          preimageLength,
        )
        if (!request) {
          continue
        }

        // Apply the provision
        // Gray Paper line 275-276: set preimages[blake(i)] = i, requests[(blake(i), len(i))] = [thetime']
        // Use helper functions to set preimage and request values in rawCshKeyvals
        setServicePreimageValue(
          account,
          provisionServiceId,
          preimageHash,
          preimageData,
        )
        setServiceRequestValue(
          account,
          provisionServiceId,
          preimageHash,
          preimageLength,
          [currentSlot],
        )

        // Save the updated account
        serviceAccountsService.setServiceAccount(provisionServiceId, account)
        updatedAccounts.add(provisionServiceId)
      }

      // (Ejected services were detected in pass 1)

      // Special case: If the accumulated service is not in poststate.accounts
      // (e.g., it was ejected during accumulation), we still need to track it
      // for lastacc update at the end of all accumulation iterations
      // ONLY if service is in accumulationStatistics
      if (!poststate.accounts.has(accumulatedServiceId)) {
        if (accumulationStatistics.has(accumulatedServiceId)) {
          accumulatedServicesForLastacc.add(accumulatedServiceId)
        }
      }

      // Collect this service's poststate privileges for later R function computation
      // Gray Paper accpar: privileges are computed using R function based on manager and current holder
      servicePoststates.set(accumulatedServiceId, {
        manager: poststate.manager,
        assigners: [...poststate.assigners],
        delegator: poststate.delegator,
        registrar: poststate.registrar,
        alwaysaccers: new Map(poststate.alwaysaccers),
      })

      // Gray Paper: Apply staging set update if the delegator service called DESIGNATE
      if (
        accumulatedServiceId === delegatorServiceId &&
        poststate.stagingset &&
        poststate.stagingset.length > 0
      ) {
        // Convert Uint8Array[] back to ValidatorPublicKeys[]
        const updatedStagingSet: ValidatorPublicKeys[] = []
        for (let j = 0; j < poststate.stagingset.length; j++) {
          const encoded = poststate.stagingset[j]
          const [decodeError, decoded] = decodeValidatorPublicKeys(encoded)
          if (decodeError || !decoded) {
            continue
          }
          updatedStagingSet.push(decoded.value)
        }
        if (updatedStagingSet.length > 0) {
          validatorSetManager.setStagingSet(updatedStagingSet)
        }
      }
    } else {
      // Track for deferred lastacc update even on failure (Gray Paper eq 410-412)
      // sa_lastacc = s when s ∈ keys(accumulationstatistics), regardless of success/failure
      // ONLY if service is in accumulationStatistics
      if (accumulationStatistics.has(accumulatedServiceId)) {
        accumulatedServicesForLastacc.add(accumulatedServiceId)
      }
    }
  }

  // Clear keyvals and mark ejected so C(255,s) stays in state trie; keyvals cleared
  for (const ejectedServiceId of ejectedServices) {
    serviceAccountsService.clearKeyvalsAndMarkEjected(ejectedServiceId)
  }
}
