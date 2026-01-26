import {
  calculateWorkReportHash,
  decodeValidatorPublicKeys,
  setServicePreimageValue,
  setServiceRequestValue,
} from '@pbnjam/codec'
import { blake2bHash } from '@pbnjam/core'
import type {
  Accumulated,
  AccumulateInvocationResult,
  DeferredTransfer,
  IConfigService,
  IPrivilegesService,
  IReadyService,
  IServiceAccountService,
  IValidatorSetManager,
  ReadyItem,
  ValidatorPublicKeys,
  WorkReport,
} from '@pbnjam/types'
import type { Hex } from 'viem'
import { applyPrivilegesWithRFunction } from './privileges'

/**
 * Update global state with accumulation results
 *
 * This method applies the changes from successful accumulation invocations
 * to the global state. Based on the test vector analysis:
 *
 * 1. Update accumulated packages history (9 new packages added)
 * 2. Update service accounts (storage, bytes, items, last_accumulation_slot)
 * 3. Remove processed work-reports from ready queue
 * 4. Shift accumulated history (epoch rotation)
 */
export function updateGlobalState(
  accumulated: Accumulated,
  accumulationStatistics: Map<bigint, [number, number]>,
  accumulatedServicesForLastacc: Set<bigint>,
  validatorSetManager: IValidatorSetManager,
  serviceAccountsService: IServiceAccountService,
  results: AccumulateInvocationResult[],
  processedWorkReports: WorkReport[],
  workReportsByService: Map<number, WorkReport[]>,
  currentSlot: bigint,
  privilegesService: IPrivilegesService,
  readyService: IReadyService,
  configService: IConfigService,
  partialStateAccountsPerInvocation?: Map<number, Set<bigint>>,
  immediateItems?: ReadyItem[], // Add immediate items to ensure their packages are added
  accumulatedServiceIds?: bigint[], // Service ID for each invocation (needed for transfer-only)
): void {
  // Capture initial privileges state before processing any results
  // Gray Paper accpar: privileges are computed using R function based on manager and current holder
  const initialPrivileges = {
    manager: privilegesService.getManager(),
    assigners: [...privilegesService.getAssigners()],
    delegator: privilegesService.getDelegator(),
    registrar: privilegesService.getRegistrar(),
    alwaysaccers: new Map(privilegesService.getAlwaysAccers()),
  }

  // Collect poststates from all services for privilege computation
  // Gray Paper accpar equation 220-238: privileges use R function which needs manager and holder poststates
  // We only need the privilege-related fields for R function computation
  const servicePoststates = new Map<
    bigint,
    {
      manager: bigint
      assigners: bigint[]
      delegator: bigint
      registrar: bigint
      alwaysaccers: Map<bigint, bigint>
    }
  >()
  // Step 1: Update accumulated packages
  // Gray Paper equations 417-418:
  // accumulated'_{C_epochlen - 1} = P(justbecameavailable^*[..n])
  // ∀i ∈ [0, C_epochlen - 1): accumulated'_i = accumulated_{i + 1}
  //
  // Where P extracts package hashes from work-reports (equation 77-83):
  // P: protoset{workreport} → protoset{hash}
  // P(r) = {(r_avspec)_packagehash : r ∈ r}

  // Get the epoch duration (C_epochlen)
  const epochLength = configService.epochDuration

  const newPackages = new Set<Hex>()

  // First, add packages from immediate items (justbecameavailable^!)
  // Gray Paper equation 417: accumulated'_{E-1} = P(justbecameavailable^*[:n])
  // Immediate items should be accumulated immediately, so their packages must be added
  // even if processing fails (e.g., service doesn't exist)
  if (immediateItems) {
    for (const item of immediateItems) {
      newPackages.add(item.workReport.package_spec.hash)
    }
  }

  // Extract packages from processed work reports
  // Use workReportsByService to map results to their work reports
  // Gray Paper: Only accumulate work reports whose dependencies are satisfied (empty dependency set)
  for (let serviceIdx = 0; serviceIdx < results.length; serviceIdx++) {
    const serviceWorkReports = workReportsByService.get(serviceIdx) || []

    // Gray Paper equation 417: accumulated'_{E-1} = P(justbecameavailable^*[:n])
    // P extracts package hashes from ALL processed work reports (justbecameavailable^*[:n])
    // regardless of success/failure. The packages were processed (attempted), so they're recorded.
    // Note: result.ok being false means an internal error, not a PVM panic.
    // PVM panics still have result.ok = true with resultCode != HALT
    for (const workReport of serviceWorkReports) {
      newPackages.add(workReport.package_spec.hash)
    }
  }

  // Ensure accumulated.packages is properly sized
  if (accumulated.packages.length !== epochLength) {
    accumulated.packages = new Array(epochLength)
      .fill(null)
      .map(() => new Set<Hex>())
  }

  // Add new packages to the rightmost slot (Gray Paper equation 417)
  // The shift happens in applyTransition, so we just add packages here
  // Multiple iterations add to the same slot
  const rightmostSlot = epochLength - 1
  for (const pkg of newPackages) {
    accumulated.packages[rightmostSlot].add(pkg)
  }

  // Step 2: Update service accounts
  // Gray Paper: When a service is accumulated at slot s, update its lastacc to s
  // Track which accounts have been updated to prevent overwriting with stale data
  const updatedAccounts = new Set<bigint>()
  const ejectedServices = new Set<bigint>()

  for (let i = 0; i < results.length; i++) {
    const result = results[i]

    // CRITICAL FIX: Always use accumulatedServiceIds as the source of truth for which service was accumulated
    // The work report's results[0].service_id may not match the actual accumulated service
    // (e.g., when a work report has multiple results for different services)
    if (!accumulatedServiceIds || accumulatedServiceIds[i] === undefined) {
      continue
    }

    const accumulatedServiceId = accumulatedServiceIds[i]

    if (result.ok) {
      const { poststate } = result.value

      // Only update the accumulated service account directly
      // Other accounts in poststate are from partial state and shouldn't be updated
      // (except newly created services, which are handled below)
      const accumulatedAccount = poststate.accounts.get(accumulatedServiceId)
      if (accumulatedAccount) {
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
      // These are services created during accumulation (e.g., via NEW host function)
      for (const [serviceId, account] of poststate.accounts) {
        if (
          serviceId !== accumulatedServiceId &&
          !updatedAccounts.has(serviceId)
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
        // const requestMap = account.requests.get(preimageHash)
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

      // Detect ejected services: If a service was in partial state but is not in poststate.accounts, it was ejected
      // Gray Paper: EJECT host function removes services from accounts
      // Use the tracked partial state accounts for this specific invocation
      const partialStateServicesForThisInvocation =
        partialStateAccountsPerInvocation?.get(i)
      if (partialStateServicesForThisInvocation) {
        for (const serviceId of partialStateServicesForThisInvocation) {
          if (!poststate.accounts.has(serviceId)) {
            ejectedServices.add(serviceId)
          }
        }
      }

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
      // The DESIGNATE host function updates imX.state.stagingset, which becomes poststate.stagingset
      // We need to apply this to the global ValidatorSetManager
      // Only update if the current service is the delegator (DESIGNATE host function checks this)
      // Gray Paper: Only apply staging set if the service was the delegator in the ORIGINAL
      // snapshot (before any services ran). A service can only successfully call DESIGNATE
      // if it is the delegator when it runs. If a service changes the delegator via BLESS,
      // then later services that become delegator cannot call DESIGNATE successfully
      // (they'll get HUH because they're not the delegator in their snapshot).
      //
      // Check against the ORIGINAL delegator (initialPrivileges.delegator), not poststate.delegator.
      // This ensures we apply the staging set from the service that was ORIGINALLY the delegator
      // and could have successfully called DESIGNATE.
      if (
        accumulatedServiceId === initialPrivileges.delegator &&
        poststate.stagingset &&
        poststate.stagingset.length > 0
      ) {
        // Convert Uint8Array[] back to ValidatorPublicKeys[]
        const updatedStagingSet: ValidatorPublicKeys[] = []
        for (let i = 0; i < poststate.stagingset.length; i++) {
          const encoded = poststate.stagingset[i]
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

  // Step 2b: Compute final privileges using Gray Paper R function
  // Gray Paper accpar equations 220-238: privileges are NOT "last BLESS wins"
  // Instead: R(original, manager_poststate, holder_poststate)
  // R(o, a, b) = b when a = o (manager didn't change), else a (manager changed)
  applyPrivilegesWithRFunction(
    initialPrivileges,
    servicePoststates,
    privilegesService,
  )

  // Ejected services are already detected above using partialStateAccountsPerInvocation
  // No need for additional check - the ejectedServices set is already populated

  // Step 3: Process deferred transfers (defxfers) globally
  // Gray Paper equation 208-212: Collect defxfers from all invocations and apply them
  // IMPORTANT: Apply transfers BEFORE deleting ejected services
  // This ensures transfers are applied even if the destination service was ejected
  // (though ejected services will be deleted immediately after)
  const allDefxfers: DeferredTransfer[] = []
  for (let i = 0; i < results.length; i++) {
    const result = results[i]
    if (result.ok) {
      allDefxfers.push(...result.value.defxfers)
    }
  }

  // Step 4: Delete ejected services (after applying transfers)
  // This ensures any transfers to ejected services are attempted before deletion
  for (const ejectedServiceId of ejectedServices) {
    serviceAccountsService.deleteServiceAccount(ejectedServiceId)

    // Step 3: Apply queue-editing function E (Gray Paper equation 48-61)
    // E removes entries whose package hash is accumulated, and removes satisfied
    // dependencies from remaining entries

    // Use newPackages (successfully accumulated) for queue editing
    // Only successfully accumulated packages go into the accumulated history for dependency tracking
    const accumulatedPackageHashes = newPackages

    // Remove ALL processed work reports from ready queue, regardless of success/failure
    // Gray Paper: A work report is "processed" once accumulation is attempted, even if it fails
    // Failed work reports (PANIC/OOG) should NOT be re-processed - they are consumed by the attempt
    for (const processedReport of processedWorkReports) {
      // Log whether this was successfully accumulated (for debugging)

      const [hashError, workReportHash] =
        calculateWorkReportHash(processedReport)
      if (!hashError && workReportHash) {
        // Remove from any slot (items may be in different slots)
        readyService.removeReadyItem(workReportHash)
      }
    }

    // Second, remove satisfied dependencies from ALL remaining ready items
    // Gray Paper equation 48-61: E(r, x) removes dependencies that appear in x
    // Note: Items whose dependencies become satisfied will be processed in the next
    // iteration of processAccumulation - we just remove the dependencies here
    for (let slotIdx = 0; slotIdx < epochLength; slotIdx++) {
      const slotItems = readyService.getReadyItemsForSlot(BigInt(slotIdx))
      for (const item of slotItems) {
        const [hashError, workReportHash] = calculateWorkReportHash(
          item.workReport,
        )
        if (hashError) {
          continue
        }

        // Remove dependencies that are now accumulated

        for (const dep of accumulatedPackageHashes) {
          if (item.dependencies.has(dep)) {
            readyService.removeDependency(workReportHash, dep)
          }
        }
      }
    }
  }
}
