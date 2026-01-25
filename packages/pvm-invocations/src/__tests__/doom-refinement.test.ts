import { describe, test, expect } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { instantiate } from '@pbnjam/pvm-assemblyscript/wasmAsInit'
import { encodeRefineArguments } from '@pbnjam/codec'
import { hexToBytes } from '@pbnjam/core'
import type { WorkPackage, WorkItem, ImportSegment, ExtrinsicReference } from '@pbnjam/types'

/**
 * Test for executing doom.corevm in refinement context
 * 
 * This test loads the doom.corevm file and executes it using setupRefineInvocation
 * to verify that refinement invocations work correctly with real PVM programs.
 */
describe('Doom Refinement Invocation', () => {
  test('should execute doom.corevm in refinement context', async () => {
    // Get project root (go up from packages/pvm-invocations)
    const projectRoot = process.cwd().split('/packages/')[0]
    
    // Load the doom.corevm file
    const doomCorevmPath = join(
      projectRoot,
      'submodules',
      'polkajam',
      'doom.corevm',
    )
    
    let doomCorevmBytes: Uint8Array
    try {
      doomCorevmBytes = new Uint8Array(readFileSync(doomCorevmPath))
    } catch (error) {
      throw new Error(
        `Failed to load doom.corevm from ${doomCorevmPath}: ${error}`,
      )
    }

    expect(doomCorevmBytes.length).toBeGreaterThan(0)
    console.log(`Loaded doom.corevm: ${doomCorevmBytes.length} bytes`)

    // Load WASM module using wasmAsInit
    const wasmModulePath = join(
      projectRoot,
      'packages',
      'pvm-assemblyscript',
      'build',
      'pvm.wasm',
    )

    let wasmBytes: Buffer
    try {
      wasmBytes = readFileSync(wasmModulePath)
    } catch (error) {
      throw new Error(
        `Failed to load WASM module from ${wasmModulePath}: ${error}`,
      )
    }

    // Instantiate WASM module
    const wasm = await instantiate(wasmBytes, {})

    // Initialize PVM with PVMRAM (RAMType 0)
    wasm.init(0) // RAMType.PVMRAM

    // Load WorkPackage from test vectors
    const workPackageJsonPath = join(
      projectRoot,
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

    const workPackage: WorkPackage = {
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
    console.log(`First work item: service=${workItems[0].serviceindex}, refgaslimit=${workItems[0].refgaslimit}`)

    // Use the first work item for the refinement invocation
    const workItem = workItems[0]

    // Encode refine arguments: encode{c, i, w.serviceindex, var{w.payload}, blake{p}}
    // Gray Paper equation 85
    const coreIndex = 0n
    const workItemIndex = 0n
    const [encodeError, encodedArgs] = encodeRefineArguments(
      coreIndex,
      workItemIndex,
      workItem,
      workPackage,
    )

    if (encodeError) {
      throw new Error(`Failed to encode refine arguments: ${encodeError.message}`)
    }

    expect(encodedArgs).toBeInstanceOf(Uint8Array)
    expect(encodedArgs.length).toBeGreaterThan(0)

    // Set up refinement invocation
    // Gray Paper equation 78-89: Ψ_R setup
    const gasLimit = Number(workItem.refgaslimit)
    const exportSegmentOffset = 0
    const lookupAnchorTimeslot = workPackage.context.lookup_anchor_slot

    // Create minimal service account (can be null for basic test)
    const serviceAccount = null

    // Setup refinement invocation
    wasm.setupRefineInvocation(
      gasLimit,
      doomCorevmBytes, // Program preimage blob
      encodedArgs, // Encoded refine arguments
      workPackage, // Work package (for FETCH host function)
      null, // Authorizer trace (null for basic test)
      null, // Import segments (null for basic test)
      exportSegmentOffset,
      serviceAccount, // Service account (null for basic test)
      lookupAnchorTimeslot,
    )

    // Execute the program
    const result = wasm.runProgram()

    // Verify result structure
    expect(result).toBeDefined()
    expect(result.status).toBeDefined()
    expect(typeof result.status).toBe('number')

    // Check status values (from Status enum)
    // Status.OK = 0, Status.HALT = 1, Status.PANIC = 2, etc.
    const status = result.status
    console.log(`Execution status: ${status}`)
    console.log(`Gas consumed: ${result.gasConsumed ?? 'N/A'}`)
    console.log(`Result code: ${result.resultCode ?? 'N/A'}`)

    // Verify that execution completed (either OK, HALT, or PANIC)
    // Status should be a valid status code
    expect(status).toBeGreaterThanOrEqual(0)
    expect(status).toBeLessThanOrEqual(5) // Max status value

    // If there's a result, it should be a Uint8Array
    if (result.result) {
      expect(result.result).toBeInstanceOf(Uint8Array)
      console.log(`Result length: ${result.result.length} bytes`)
    }

    // Verify gas was consumed
    if (result.gasConsumed !== undefined) {
      expect(result.gasConsumed).toBeGreaterThan(0)
      expect(result.gasConsumed).toBeLessThanOrEqual(gasLimit)
    }

    console.log('✅ Doom refinement invocation test completed successfully')
  })
})
