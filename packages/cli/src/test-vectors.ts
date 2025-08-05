// import { existsSync, readdirSync, readFileSync } from 'node:fs'
// import { join } from 'node:path'
// import { logger } from '@pbnj/core'
// import type { SafroleInput, SafroleOutput, SafroleState } from '@pbnj/safrole'
// import { executeSafroleSTF } from '@pbnj/safrole'

// export interface TestVector {
//   name: string
//   state: unknown
//   input: unknown
//   output: unknown
//   description?: string
// }

// export class TestVectorProcessor {
//   private vectorsPath: string

//   constructor(vectorsPath = 'submodules/jamtestvectors') {
//     this.vectorsPath = vectorsPath
//   }

//   async loadTestVectors(directory: string): Promise<TestVector[]> {
//     const fullPath = join(this.vectorsPath, directory)

//     if (!existsSync(fullPath)) {
//       throw new Error(`Test vectors directory not found: ${fullPath}`)
//     }

//     const vectors: TestVector[] = []
//     const files = readdirSync(fullPath)

//     for (const file of files) {
//       if (file.endsWith('.json')) {
//         const path = join(fullPath, file)
//         const content = readFileSync(path, 'utf-8')
//         const data = JSON.parse(content)

//         vectors.push({
//           name: file.replace('.json', ''),
//           state: data.pre_state,
//           input: data.input,
//           output: data.post_state,
//           description: data.description,
//         })
//       }
//     }

//     return vectors
//   }

//   async runSafroleTest(vector: TestVector): Promise<SafroleOutput> {
//     logger.info('Running Safrole test', { vectorName: vector.name })

//     // Convert test vector data to Safrole types
//     const state = this.convertToSafroleState(vector.state)
//     const input = this.convertToSafroleInput(vector.input)

//     // Execute Safrole STF
//     const result = await executeSafroleSTF(state, input)

//     return result
//   }

//   private convertToSafroleState(stateData: unknown): SafroleState {
//     const data = stateData as unknown

//     return {
//       slot: data.tau || 0,
//       entropy: data.eta || [],
//       pendingSet: data.lambda || [],
//       activeSet: data.kappa || [],
//       previousSet: data.gamma_k || [],
//       epochRoot: data.gamma_z || '',
//       sealTickets: data.iota || [],
//       ticketAccumulator: data.gamma_a || [],
//     }
//   }

//   private convertToSafroleInput(inputData: unknown): SafroleInput {
//     const data = inputData as unknown

//     return {
//       slot: data.slot || 0,
//       entropy: data.entropy || '',
//       extrinsic: (data.extrinsic || []).map((ext: unknown) => ({
//         entryIndex: ext.attempt || 0,
//         signature: ext.signature || '',
//       })),
//     }
//   }

//   validateResult(vector: TestVector, result: SafroleOutput): boolean {
//     const expected = vector.output as unknown

//     // Convert result back to test vector format for comparison
//     const actualState = this.convertFromSafroleState(result.state)

//     // Compare states
//     const stateMatch = JSON.stringify(actualState) === JSON.stringify(expected)

//     if (!stateMatch) {
//       logger.error('Test failed: state mismatch', {
//         vectorName: vector.name,
//         expected: JSON.stringify(expected, null, 2),
//         actual: JSON.stringify(actualState, null, 2),
//       })
//     } else {
//       logger.info('Test passed', { vectorName: vector.name })
//     }

//     return stateMatch
//   }

//   private convertFromSafroleState(state: SafroleState): unknown {
//     return {
//       tau: state.slot,
//       eta: state.entropy,
//       lambda: state.pendingSet,
//       kappa: state.activeSet,
//       gamma_k: state.previousSet,
//       gamma_z: state.epochRoot,
//       iota: state.sealTickets,
//       gamma_a: state.ticketAccumulator,
//       gamma_s: {
//         keys: Array.isArray(state.sealTickets) ? state.sealTickets : [],
//       },
//       post_offenders: [],
//     }
//   }

//   async validateTestVectors(): Promise<void> {
//     const { execSync } = await import('node:child_process')
//     execSync('./scripts/validate-all.sh', {
//       cwd: this.vectorsPath,
//       stdio: 'inherit',
//     })
//   }

//   async convertBinaryToJson(): Promise<void> {
//     const { execSync } = await import('node:child_process')
//     execSync('./scripts/convert-all.sh', {
//       cwd: this.vectorsPath,
//       stdio: 'inherit',
//     })
//   }
// }
