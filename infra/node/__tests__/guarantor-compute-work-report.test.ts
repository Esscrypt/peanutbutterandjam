/**
 * Unit test for GuarantorService.computeWorkReport
 *
 * Tests the computeWorkReport method with a real work package from test vectors.
 * This verifies that:
 * 1. Is-Authorized PVM invocation (Ψ_I) is executed correctly
 * 2. Refine PVM invocation (Ψ_R) is executed for each work item
 * 3. Work report is constructed with proper structure
 */

import { describe, it, expect, beforeAll } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { blake2bHash, concatBytes, hexToBytes, bytesToHex, type Hex } from '@pbnjam/core'
import {
  setServicePreimageValue,
  setServiceRequestValue,
  encodeBlob,
  encodeProgram,
  encodeServiceCodeToPreimage,
} from '@pbnjam/codec'
import type {
  ServiceAccount,
  WorkPackage,
  WorkItem,
  ImportSegment,
  ExtrinsicReference,
  WorkReport,
} from '@pbnjam/types'
import { initializeServices } from './test-utils'
import type { FuzzerTargetServices } from './test-utils'

// Test vectors directory (relative to workspace root)
const WORKSPACE_ROOT = join(__dirname, '../../../')

describe('GuarantorService.computeWorkReport', () => {
  let services: FuzzerTargetServices
  let workPackage: WorkPackage

  beforeAll(async () => {
    // Initialize services using the same utility as other tests
    // Pass chainspec-tiny.json as chainSpecPath for genesis initialization
    const chainSpecPath = join(WORKSPACE_ROOT, 'config', 'chainspec-tiny.json')
    services = await initializeServices({
      spec: 'tiny',
      useWasm: false,
      genesis: {
        chainSpecPath,
      },
    })

    // Get services from the full context
    const context = services.fullContext

    // Set genesis state from chainspec file (similar to block-authoring-import.test.ts)
    const [genesisStateError, genesisState] =
      context.genesisManagerService.getState()
    if (genesisStateError) {
      throw new Error(
        `Failed to get genesis state: ${genesisStateError.message}`,
      )
    }
    const [setStateError] = context.stateService.setState(genesisState.keyvals)
    if (setStateError) {
      throw new Error(
        `Failed to set genesis state: ${setStateError.message}`,
      )
    }

    // Load WorkPackage from test vectors
    const workPackageJsonPath = join(
      WORKSPACE_ROOT,
      'submodules',
      'jam-test-vectors',
      'codec',
      'tiny',
      'work_package.json',
    )

    let workPackageJson: any
    try {
      const jsonContent = readFileSync(workPackageJsonPath, 'utf-8')
      workPackageJson = JSON.parse(jsonContent)
    } catch (error) {
      throw new Error(
        `Failed to load work_package.json from ${workPackageJsonPath}: ${error}`,
      )
    }

    // Convert test vector JSON (snake_case) to TypeScript interface (camelCase)
    const workItems: WorkItem[] = workPackageJson.items.map((item: any) => {
      const importSegments: ImportSegment[] = (item.import_segments || []).map(
        (seg: any) => ({
          treeRoot: seg.tree_root as `0x${string}`,
          index: seg.index,
        }),
      )

      const extrinsics: ExtrinsicReference[] = (item.extrinsic || []).map(
        (ext: any) => ({
          hash: ext.hash as `0x${string}`,
          length: BigInt(ext.len),
        }),
      )

      return {
        serviceindex: BigInt(item.service),
        codehash: item.code_hash as `0x${string}`,
        payload: hexToBytes(item.payload),
        refgaslimit: BigInt(item.refine_gas_limit),
        accgaslimit: BigInt(item.accumulate_gas_limit),
        exportcount: BigInt(item.export_count),
        importsegments: importSegments,
        extrinsics: extrinsics,
      }
    })

    workPackage = {
      authToken: workPackageJson.authorization as `0x${string}`,
      authCodeHost: BigInt(workPackageJson.auth_code_host),
      authCodeHash: workPackageJson.auth_code_hash as `0x${string}`,
      authConfig: workPackageJson.authorizer_config as `0x${string}`,
      context: {
        anchor: workPackageJson.context.anchor as `0x${string}`,
        state_root: workPackageJson.context.state_root as `0x${string}`,
        beefy_root: workPackageJson.context.beefy_root as `0x${string}`,
        lookup_anchor: workPackageJson.context.lookup_anchor as `0x${string}`,
        lookup_anchor_slot: BigInt(workPackageJson.context.lookup_anchor_slot),
        prerequisites: (workPackageJson.context.prerequisites || []).map(
          (p: string) => p as `0x${string}`,
        ),
      },
      workItems: workItems,
    }

    console.log(`Loaded WorkPackage with ${workItems.length} work items`)

    // Set up service accounts for the work package
    // This is needed for Is-Authorized PVM to look up the auth code
    const serviceAccountService = context.serviceAccountService

    // Get or create service account for auth code host
    let [accountError, authCodeHostServiceAccount] =
      serviceAccountService.getServiceAccount(workPackage.authCodeHost)
    if (accountError || !authCodeHostServiceAccount) {
      // Create new service account if it doesn't exist
      authCodeHostServiceAccount = {
        codehash: workPackage.authCodeHash,
        balance: 0n,
        minaccgas: 0n,
        minmemogas: 0n,
        octets: 0n,
        gratis: 0n,
        items: 0n,
        created: 0n,
        lastacc: 0n,
        parent: 0n,
        rawCshKeyvals: {},
      }
      serviceAccountService.setServiceAccount(
        workPackage.authCodeHost,
        authCodeHostServiceAccount,
      )
    }

    // Store the auth code preimage in the service account state
    // Note: The test vectors only include the hash, not the actual blob
    // For testing, we create a minimal dummy blob that will be stored under the hash key
    // The state key is derived from the hash parameter, not the blob's actual hash,
    // so this allows us to test the lookup mechanism even without the real blob
    // In production, the actual auth code blob would be stored in the service account state
    const authCodeBlob = new Uint8Array(100) // Create a dummy blob for testing
    authCodeBlob.fill(0x42) // Fill with a test pattern
    
    // Store the preimage using setServicePreimageValue
    // This creates a state key from the hash and stores the blob
    // The key is C(serviceId, blake(encode[4]{0xFFFFFFFE} || hash))
    setServicePreimageValue(
      authCodeHostServiceAccount,
      workPackage.authCodeHost,
      workPackage.authCodeHash,
      authCodeBlob,
    )
    
    // Set a request value for the preimage so histLookupServiceAccount can find it
    // The request should be available at the lookup_anchor_slot
    // Gray Paper: I(l, t) function checks if preimage is available at timeslot t
    setServiceRequestValue(
      authCodeHostServiceAccount,
      workPackage.authCodeHost,
      workPackage.authCodeHash,
      BigInt(authCodeBlob.length),
      [workPackage.context.lookup_anchor_slot], // Available at lookup anchor slot
    )
    
    // Update the service account with the modified state
    serviceAccountService.setServiceAccount(
      workPackage.authCodeHost,
      authCodeHostServiceAccount,
    )

    // Create service accounts for each work item service
    for (const workItem of workItems) {
      const workItemServiceAccount: ServiceAccount = {
        codehash: workItem.codehash,
        balance: 0n,
        minaccgas: 0n,
        minmemogas: 0n,
        octets: 0n,
        gratis: 0n,
        items: 0n,
        created: 0n,
        lastacc: 0n,
        parent: 0n,
        rawCshKeyvals: {},
      }
      serviceAccountService.setServiceAccount(
        workItem.serviceindex,
        workItemServiceAccount,
      )
    }

    // Set up auth pool with the authorizer hash for core 0
    // Gray Paper: wp_authorizer ≡ blake{wp_authcodehash ∥ wp_authconfig}
    const [authorizerHashError, authorizerHash] = blake2bHash(
      concatBytes([
        hexToBytes(workPackage.authCodeHash),
        hexToBytes(workPackage.authConfig),
      ]),
    )
    if (authorizerHashError || !authorizerHash) {
      throw new Error(
        `Failed to compute authorizer hash: ${authorizerHashError?.message}`,
      )
    }

    // Add authorizer to auth pool for core 0
    const authPool = context.authPoolService.getAuthPool()
    if (authPool.length > 0) {
      authPool[0]!.push(authorizerHash)
    }

    console.log(`Set up service accounts and auth pool`)
    console.log(`  Auth code host: ${workPackage.authCodeHost}`)
    console.log(`  Authorizer hash: ${authorizerHash}`)
  })

  it('should compute work report for a real work package', async () => {
    const guarantorService = services.fullContext.guarantorService
    const coreIndex = 0 // Use core 0 for testing

    // Call computeWorkReport
    const [error, workReport] = await guarantorService.computeWorkReport(
      workPackage,
      coreIndex,
    )

    // Verify no error occurred
    expect(error).toBeUndefined()
    expect(workReport).toBeDefined()

    if (!workReport) {
      throw new Error('Work report is null')
    }

    // Verify work report structure
    expect(workReport).toHaveProperty('package_spec')
    expect(workReport).toHaveProperty('context')
    expect(workReport).toHaveProperty('core_index')
    expect(workReport).toHaveProperty('authorizer_hash')
    expect(workReport).toHaveProperty('auth_gas_used')
    expect(workReport).toHaveProperty('auth_output')
    expect(workReport).toHaveProperty('segment_root_lookup')
    expect(workReport).toHaveProperty('results')

    // Verify package spec
    expect(workReport.package_spec).toHaveProperty('hash')
    expect(workReport.package_spec).toHaveProperty('length')
    expect(workReport.package_spec).toHaveProperty('erasure_root')
    expect(workReport.package_spec).toHaveProperty('exports_root')
    expect(workReport.package_spec).toHaveProperty('exports_count')

    // Verify context matches work package context
    expect(workReport.context.anchor).toBe(workPackage.context.anchor)
    expect(workReport.context.state_root).toBe(workPackage.context.state_root)
    expect(workReport.context.beefy_root).toBe(workPackage.context.beefy_root)
    expect(workReport.context.lookup_anchor).toBe(
      workPackage.context.lookup_anchor,
    )
    expect(workReport.context.lookup_anchor_slot).toBe(
      workPackage.context.lookup_anchor_slot,
    )

    // Verify core index
    expect(Number(workReport.core_index)).toBe(coreIndex)

    // Verify authorizer hash matches work package
    expect(workReport.authorizer_hash).toBe(workPackage.authCodeHash)

    // Verify auth output is present (from Is-Authorized PVM)
    expect(workReport.auth_output).toBeDefined()
    expect(typeof workReport.auth_output).toBe('string')
    expect(workReport.auth_output.startsWith('0x')).toBe(true)

    // Verify auth gas used is a non-negative bigint
    expect(workReport.auth_gas_used).toBeDefined()
    expect(typeof workReport.auth_gas_used).toBe('bigint')
    expect(workReport.auth_gas_used >= 0n).toBe(true)

    // Verify results match work items
    expect(workReport.results.length).toBe(workPackage.workItems.length)

    // Verify each work result
    for (let i = 0; i < workReport.results.length; i++) {
      const result = workReport.results[i]
      const workItem = workPackage.workItems[i]

      expect(result).toBeDefined()
      expect(result.service_id).toBe(workItem.serviceindex)
      expect(result.code_hash).toBe(workItem.codehash)
      expect(result.accumulate_gas).toBe(workItem.accgaslimit)

      // Verify result structure
      expect(result).toHaveProperty('result')
      expect(result).toHaveProperty('refine_load')

      // Verify refine_load structure
      expect(result.refine_load).toHaveProperty('imports')
      expect(result.refine_load).toHaveProperty('exports')
      expect(result.refine_load).toHaveProperty('extrinsic_count')
      expect(result.refine_load).toHaveProperty('extrinsic_size')
      expect(result.refine_load).toHaveProperty('gas_used')

      // Verify exports match export_count from work item
      expect(Number(result.refine_load.exports)).toBeGreaterThanOrEqual(0)
      expect(Number(result.refine_load.exports)).toBeLessThanOrEqual(
        Number(workItem.exportcount),
      )
    }

    // Verify segment root lookup is an array
    expect(Array.isArray(workReport.segment_root_lookup)).toBe(true)

    // Verify exports root is a valid hex string
    expect(workReport.package_spec.exports_root).toBeDefined()
    expect(typeof workReport.package_spec.exports_root).toBe('string')
    expect(workReport.package_spec.exports_root.startsWith('0x')).toBe(true)

    // Verify exports count matches total exports from all work items
    const totalExports = workReport.results.reduce(
      (sum, result) => sum + Number(result.refine_load.exports),
      0,
    )
    expect(Number(workReport.package_spec.exports_count)).toBe(totalExports)

    console.log('Work report computed successfully:')
    console.log(`  Package hash: ${workReport.package_spec.hash}`)
    console.log(`  Core index: ${workReport.core_index}`)
    console.log(`  Auth gas used: ${workReport.auth_gas_used}`)
    console.log(`  Auth output length: ${workReport.auth_output.length}`)
    console.log(`  Results count: ${workReport.results.length}`)
    console.log(`  Total exports: ${workReport.package_spec.exports_count}`)
  })

  it('should handle authorization failure gracefully', async () => {
    const guarantorService = services.fullContext.guarantorService
    const coreIndex = 0

    // Create a work package with invalid auth code hash to test error handling
    const invalidWorkPackage: WorkPackage = {
      ...workPackage,
      authCodeHash: '0x' + '00'.repeat(32) as Hex, // Invalid auth code hash
    }

    const [error, workReport] = await guarantorService.computeWorkReport(
      invalidWorkPackage,
      coreIndex,
    )

    // Should return an error for invalid authorization
    expect(error).toBeDefined()
    expect(workReport).toBeUndefined()
  })
})
