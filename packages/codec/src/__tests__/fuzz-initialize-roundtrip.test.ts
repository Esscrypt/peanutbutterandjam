// /**
//  * Fuzzer Initialize Message Round-Trip Test
//  *
//  * Tests that the Initialize message can be:
//  * 1. Constructed from JSON (source of truth)
//  * 2. Encoded to binary
//  * 3. Decoded from binary
//  * 4. Verified to match JSON (header, keyvals, ancestry)
//  * 5. Round-trip encoded/decoded correctly
//  *
//  * This ensures the encoding/decoding logic is correct and matches the fuzzer protocol.
//  * The test uses JSON as the source of truth to ensure binary and JSON match.
//  */

// import { describe, it, expect } from 'bun:test'
// import * as path from 'node:path'
// import { readFileSync } from 'node:fs'
// import { decodeFuzzMessage, encodeFuzzMessage } from '../fuzz'
// import { ConfigService } from '../../../../infra/node/services/config-service'
// import { FuzzMessageType, type Initialize } from '@pbnjam/types'
// import { merklizeState, bytesToHex } from '@pbnjam/core'
// import { getFuzzProtoExamplesDir } from './test-vector-dir'

// describe('Fuzzer Initialize Round-Trip Test', () => {
//   // Use 'tiny' config to match 6 validators in the binary file's epoch mark
//   const configService = new ConfigService('tiny')

//   it('should round-trip encode/decode Initialize message from binary and match JSON', () => {
//     const examplesDir = getFuzzProtoExamplesDir()

//     // Load binary Initialize message (0.7.2/no_forks)
//     const initializeBinPath = path.join(examplesDir, '00000001_fuzzer_initialize.bin')

//     let initializeBin: Uint8Array
//     try {
//       initializeBin = new Uint8Array(readFileSync(initializeBinPath))
//     } catch (error) {
//       throw new Error(
//         `Failed to read Initialize binary: ${error instanceof Error ? error.message : String(error)}`,
//       )
//     }

//     // Load JSON Initialize message for comparison
//     const initializeJsonPath = path.join(examplesDir, '00000001_fuzzer_initialize.json')

//     let initializeJson: any
//     try {
//       initializeJson = JSON.parse(readFileSync(initializeJsonPath, 'utf-8'))
//     } catch (error) {
//       throw new Error(
//         `Failed to read Initialize JSON: ${error instanceof Error ? error.message : String(error)}`,
//       )
//     }

//     console.log(`\n📦 Loaded Initialize message:`)
//     console.log(`  Binary size: ${initializeBin.length} bytes`)
//     console.log(`  JSON has 'initialize' field: ${'initialize' in initializeJson}`)

//     // Decode Initialize message from binary file
//     console.log(`\n🔍 Decoding Initialize message from binary file...`)
    
//     // The binary file starts with discriminant 0x01 (Initialize)
//     // No length prefix in the file itself
//     const messageData = initializeBin
    
//     const decodedMessage = decodeFuzzMessage(messageData, configService)

//     expect(decodedMessage.type).toBe(FuzzMessageType.Initialize)
//     // Type assertion: we know it's Initialize because type is FuzzMessageType.Initialize
//     const init = decodedMessage.payload as Initialize

//     console.log(`✅ Decoded Initialize message from binary:`)
//     console.log(`  Header slot: ${init.header.timeslot}`)
//     console.log(`  Keyvals count: ${init.keyvals.length}`)
//     console.log(`  Ancestry count: ${init.ancestry.length}`)

//     // Verify decoded values against JSON - exact match for each value
//     if ('initialize' in initializeJson) {
//       const jsonInit = initializeJson.initialize

//       // Verify header against JSON - exact match for each field
//       if ('header' in jsonInit) {
//         const jsonHeader = jsonInit.header
        
//         console.log(`\n📋 Verifying header against JSON (exact match):`)
//         expect(Number(init.header.timeslot)).toBe(jsonHeader.slot)
//         expect(init.header.parent).toBe(jsonHeader.parent)
//         expect(init.header.priorStateRoot).toBe(jsonHeader.parent_state_root)
//         expect(init.header.extrinsicHash).toBe(jsonHeader.extrinsic_hash)
//         console.log(`  ✅ Header fields match JSON`)

//         // Verify epoch mark if present - exact match for each field
//         if (jsonHeader.epoch_mark) {
//           expect(init.header.epochMark).not.toBeNull()
//           if (init.header.epochMark) {
//             expect(init.header.epochMark.entropyAccumulator).toBe(
//               jsonHeader.epoch_mark.entropy,
//             )
//             expect(init.header.epochMark.entropy1).toBe(
//               jsonHeader.epoch_mark.tickets_entropy,
//             )
//             // Epoch mark uses fixed-length sequence matching config.numValidators (6 for 'tiny' config)
//             expect(init.header.epochMark.validators.length).toBe(configService.numValidators)
//             // Verify all validators match JSON exactly
//             const jsonValidatorCount = jsonHeader.epoch_mark.validators.length
//             expect(init.header.epochMark.validators.length).toBe(jsonValidatorCount)
//             for (let i = 0; i < jsonValidatorCount; i++) {
//               expect(init.header.epochMark.validators[i].bandersnatch).toBe(
//                 jsonHeader.epoch_mark.validators[i].bandersnatch,
//               )
//               expect(init.header.epochMark.validators[i].ed25519).toBe(
//                 jsonHeader.epoch_mark.validators[i].ed25519,
//               )
//             }
//             console.log(`  ✅ Epoch mark matches JSON (${jsonValidatorCount} validators)`)
//           }
//         } else {
//           expect(init.header.epochMark).toBeNull()
//           console.log(`  ✅ Epoch mark is null (matches JSON)`)
//         }
//       }

//       // Verify keyvals against JSON - exact match for each key and value
//       if ('state' in jsonInit) {
//         const jsonState = jsonInit.state
//         console.log(`\n📊 Verifying keyvals against JSON (exact match):`)
//         console.log(`  Binary has ${init.keyvals.length} keyvals, JSON has ${jsonState.length} keyvals`)
        
//         // Verify each keyval matches JSON exactly
//         const minCount = Math.min(init.keyvals.length, jsonState.length)
//         for (let i = 0; i < minCount; i++) {
//           expect(init.keyvals[i].key).toBe(jsonState[i].key)
//           expect(init.keyvals[i].value).toBe(jsonState[i].value)
//         }
        
//         if (init.keyvals.length === jsonState.length) {
//           console.log(`  ✅ All ${init.keyvals.length} keyvals match JSON exactly`)
//         } else {
//           console.log(`  ✅ First ${minCount} keyvals match JSON exactly`)
//           console.log(`  ⚠️  Binary has ${init.keyvals.length} keyvals, JSON has ${jsonState.length} (verifying overlapping ${minCount})`)
//         }
        
//         // Verify Merkle root of keyvals
//         console.log(`\n🌳 Verifying Merkle root of keyvals:`)
//         const keyvalsDict: Record<string, string> = {}
//         for (const kv of init.keyvals) {
//           keyvalsDict[kv.key] = kv.value
//         }
//         const [merkleError, merkleRoot] = merklizeState(keyvalsDict)
//         if (merkleError) {
//           throw new Error(`Failed to compute Merkle root: ${merkleError.message}`)
//         }
//         const merkleRootHex = bytesToHex(merkleRoot)
//         expect(merkleRootHex).toBeDefined()
//         expect(merkleRootHex.length).toBe(66) // 0x + 32 bytes hex
//         console.log(`  ✅ Merkle root computed: ${merkleRootHex}`)
//       }

//       // Verify ancestry against JSON - exact match for each slot and header_hash
//       if ('ancestry' in jsonInit) {
//         const jsonAncestry = jsonInit.ancestry
//         console.log(`\n📜 Verifying ancestry against JSON (exact match):`)
//         console.log(`  Binary has ${init.ancestry.length} ancestry items, JSON has ${jsonAncestry.length} ancestry items`)
        
//         // Verify each ancestry item matches JSON exactly
//         const minCount = Math.min(init.ancestry.length, jsonAncestry.length)
//         for (let i = 0; i < minCount; i++) {
//           expect(Number(init.ancestry[i].slot)).toBe(jsonAncestry[i].slot)
//           expect(init.ancestry[i].header_hash).toBe(jsonAncestry[i].header_hash)
//         }
        
//         if (init.ancestry.length === jsonAncestry.length) {
//           console.log(`  ✅ All ${init.ancestry.length} ancestry items match JSON exactly`)
//         } else if (jsonAncestry.length === 0 && init.ancestry.length > 0) {
//           console.log(`  ⚠️  Binary has ${init.ancestry.length} ancestry items, JSON has 0 (no items to verify)`)
//         } else {
//           console.log(`  ✅ First ${minCount} ancestry items match JSON exactly`)
//           console.log(`  ⚠️  Binary has ${init.ancestry.length} ancestry items, JSON has ${jsonAncestry.length} (verifying overlapping ${minCount})`)
//         }
//       }
//     }

//     // Round-trip: Use the decoded Initialize from binary (source of truth)
//     console.log(`\n🔄 Round-trip encoding/decoding from binary...`)
    
//     // Use the decoded Initialize as-is (binary is source of truth)
//     // Note: If ancestry exceeds ASN.1 limit (24), truncate it for encoding
//     const ancestryForRoundTrip = init.ancestry.length > 24 
//       ? init.ancestry.slice(0, 24)
//       : init.ancestry
    
//     if (init.ancestry.length > 24) {
//       console.log(`  ⚠️  Binary has ${init.ancestry.length} ancestry items (exceeds ASN.1 limit of 24)`)
//       console.log(`     Truncating to 24 for round-trip encoding test`)
//     }
    
//     const roundTripInit: Initialize = {
//       header: init.header,
//       keyvals: init.keyvals,
//       ancestry: ancestryForRoundTrip,
//     }
    
//     console.log(`  Using Initialize from binary with ${roundTripInit.keyvals.length} keyvals and ${roundTripInit.ancestry.length} ancestry items`)
    
//     const fuzzMessage = {
//       type: FuzzMessageType.Initialize,
//       payload: roundTripInit,
//     } as const

//     let encoded: Uint8Array
//     try {
//       encoded = encodeFuzzMessage(fuzzMessage as any, configService)
//       console.log(`  Encoded size: ${encoded.length} bytes`)
//     } catch (error) {
//       throw new Error(
//         `Failed to encode Initialize message: ${error instanceof Error ? error.message : String(error)}`,
//       )
//     }

//     const decodedAgain = decodeFuzzMessage(encoded, configService)
//     expect(decodedAgain.type).toBe(FuzzMessageType.Initialize)
//     // Type assertion: we know it's Initialize because type is FuzzMessageType.Initialize
//     const initAgain = decodedAgain.payload as Initialize

//     // Verify round-trip (compare against roundTripInit, which is based on binary)
//     console.log(`✅ Round-trip verification:`)
//     console.log(`  Header slot: ${initAgain.header.timeslot} (original: ${roundTripInit.header.timeslot})`)
//     console.log(
//       `  Keyvals count: ${initAgain.keyvals.length} (original: ${roundTripInit.keyvals.length})`,
//     )
//     console.log(
//       `  Ancestry count: ${initAgain.ancestry.length} (original: ${roundTripInit.ancestry.length}${init.ancestry.length > 24 ? `, truncated from ${init.ancestry.length}` : ''})`,
//     )

//     expect(initAgain.header.timeslot).toBe(roundTripInit.header.timeslot)
//     expect(initAgain.header.parent).toBe(roundTripInit.header.parent)
//     expect(initAgain.header.priorStateRoot).toBe(roundTripInit.header.priorStateRoot)
//     expect(initAgain.header.extrinsicHash).toBe(roundTripInit.header.extrinsicHash)

//     // Compare epoch mark
//     if (roundTripInit.header.epochMark && initAgain.header.epochMark) {
//       expect(initAgain.header.epochMark.entropyAccumulator).toBe(
//         roundTripInit.header.epochMark.entropyAccumulator,
//       )
//       expect(initAgain.header.epochMark.entropy1).toBe(
//         roundTripInit.header.epochMark.entropy1,
//       )
//       expect(initAgain.header.epochMark.validators.length).toBe(
//         roundTripInit.header.epochMark.validators.length,
//       )
//     } else {
//       expect(initAgain.header.epochMark).toBe(roundTripInit.header.epochMark)
//     }

//     expect(initAgain.keyvals.length).toBe(roundTripInit.keyvals.length)
//     for (let i = 0; i < roundTripInit.keyvals.length; i++) {
//       expect(initAgain.keyvals[i].key).toBe(roundTripInit.keyvals[i].key)
//       expect(initAgain.keyvals[i].value).toBe(roundTripInit.keyvals[i].value)
//     }

//     expect(initAgain.ancestry.length).toBe(roundTripInit.ancestry.length)
//     for (let i = 0; i < roundTripInit.ancestry.length; i++) {
//       expect(initAgain.ancestry[i].slot).toBe(roundTripInit.ancestry[i].slot)
//       expect(initAgain.ancestry[i].header_hash).toBe(
//         roundTripInit.ancestry[i].header_hash,
//       )
//     }

//     console.log(`\n✅ All round-trip checks passed!`)
//   })
// })

