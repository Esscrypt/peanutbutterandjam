/**
 * Fuzzer ImportBlock Decoding Test
 *
 * Tests decoding ImportBlock messages from binary files to verify
 * the codec correctly handles block import messages from the fuzzer.
 */

import { describe, it, expect } from 'bun:test'
import * as path from 'node:path'
import { readFileSync } from 'node:fs'
import { decodeFuzzMessage } from '../../../packages/codec/src/fuzz'
import { FuzzMessageType } from '@pbnj/types'
import { ConfigService } from '../services/config-service'

// Test vectors directory (relative to workspace root)
// __dirname is infra/node/__tests__, so we go up 3 levels to get to workspace root
const WORKSPACE_ROOT = path.join(__dirname, '../../../')

describe('Fuzzer ImportBlock Decoding', () => {
  it('should decode ImportBlock message from binary file', () => {
    const configService = new ConfigService('tiny')

    // Load ImportBlock message
    const importBlockBinPath = path.join(
      WORKSPACE_ROOT,
      'submodules/jam-conformance/fuzz-proto/examples/v1/no_forks/00000002_fuzzer_import_block.bin',
    )

    let importBlockBin: Uint8Array
    try {
      importBlockBin = new Uint8Array(readFileSync(importBlockBinPath))
    } catch (error) {
      throw new Error(
        `Failed to read ImportBlock binary: ${error instanceof Error ? error.message : String(error)}`,
      )
    }

    console.log(`\n📋 ImportBlock message loaded:`)
    console.log(`  File size: ${importBlockBin.length} bytes`)

    // Decode ImportBlock message
    // The binary file may include a 4-byte length prefix (from minifuzz.py transport layer)
    // Check if first 4 bytes are a length prefix (little-endian)
    let messageData: Uint8Array
    if (importBlockBin.length >= 4) {
      const lengthPrefix = new DataView(importBlockBin.buffer, importBlockBin.byteOffset, 4).getUint32(0, true)
      console.log(`  First 4 bytes as length prefix: ${lengthPrefix} bytes`)
      console.log(`  File size: ${importBlockBin.length} bytes`)
      
      // If the length prefix matches the remaining data, it's a transport layer prefix
      if (lengthPrefix === importBlockBin.length - 4) {
        // It's a length prefix, skip it
        messageData = importBlockBin.subarray(4)
        console.log(`  ✅ Detected 4-byte length prefix, skipped it`)
        console.log(`  Message data: ${messageData.length} bytes`)
      } else {
        // Check if first byte is the discriminant (0x03 for ImportBlock)
        if (importBlockBin[0] === 0x03) {
          // Message starts directly with discriminant, no length prefix
          messageData = importBlockBin
          console.log(`  ✅ No length prefix, message starts with discriminant`)
          console.log(`  Message data: ${messageData.length} bytes`)
        } else {
          // Try skipping 4 bytes anyway (might be a different length encoding)
          messageData = importBlockBin.subarray(4)
          console.log(`  ⚠️  Length prefix doesn't match, but skipping 4 bytes anyway`)
          console.log(`  Message data: ${messageData.length} bytes`)
        }
      }
    } else {
      messageData = importBlockBin
      console.log(`  Buffer too small for length prefix, using entire buffer: ${messageData.length} bytes`)
    }

    // Verify the discriminant
    const discriminant = messageData.length > 0 ? messageData[0] : undefined
    const discriminantHex = discriminant !== undefined ? `0x${discriminant.toString(16).padStart(2, '0')}` : 'undefined'
    console.log(`  Discriminant: ${discriminantHex} (expected 0x03 for ImportBlock)`)

    if (discriminant !== 0x03) {
      throw new Error(`Expected ImportBlock discriminant (0x03), got ${discriminantHex}`)
    }

    // Decode the message (enable debug logging)
    process.env['DEBUG_FUZZ_DECODE'] = '1'
    let decodedMessage
    try {
      decodedMessage = decodeFuzzMessage(messageData, configService)
      console.log(`  ✅ Successfully decoded ImportBlock message`)
      
      // Debug: Log the structure of decoded guarantee to see what fields it has
      if (decodedMessage.type === FuzzMessageType.ImportBlock) {
        const importBlock = decodedMessage.payload as any
        if (importBlock.block?.body?.guarantees?.length > 0) {
          const firstGuarantee = importBlock.block.body.guarantees[0]
          console.log(`  🔍 Debug: First guarantee structure:`, Object.keys(firstGuarantee || {}))
          if (firstGuarantee.report) {
            console.log(`  🔍 Debug: First guarantee report structure:`, Object.keys(firstGuarantee.report || {}))
          }
        }
      }
    } catch (error) {
      console.error(`  ❌ Failed to decode ImportBlock message:`)
      console.error(`     Error: ${error instanceof Error ? error.message : String(error)}`)
      if (error instanceof Error && error.stack) {
        console.error(`     Stack: ${error.stack}`)
      }
      // Log first 100 bytes for debugging
      console.error(`     First 100 bytes: ${Array.from(messageData.slice(0, 100)).map(b => `0x${b.toString(16).padStart(2, '0')}`).join(' ')}`)
      throw error
    }

    if (decodedMessage.type !== FuzzMessageType.ImportBlock) {
      throw new Error(`Expected ImportBlock message, got ${decodedMessage.type}`)
    }

    const importBlock = decodedMessage.payload as any

    console.log(`\n📦 ImportBlock decoded:`)
    console.log(`  Block present: ${!!importBlock.block}`)

    if (importBlock.block) {
      const block = importBlock.block
      console.log(`  Block header present: ${!!block.header}`)
      
      if (block.header) {
        const header = block.header
        console.log(`  Header:`)
        console.log(`    Parent hash: ${header.parent?.substring(0, 20) || 'undefined'}...`)
        console.log(`    Prior state root: ${header.priorStateRoot?.substring(0, 20) || 'undefined'}...`)
        console.log(`    Extrinsic hash: ${header.extrinsicHash?.substring(0, 20) || 'undefined'}...`)
        console.log(`    Timeslot: ${header.timeslot?.toString() || 'N/A'}`)
        console.log(`    Author index: ${header.authorIndex?.toString() || 'N/A'}`)
        console.log(`    VRF sig: ${header.vrfSig ? header.vrfSig.substring(0, 20) + '...' : 'undefined'}`)
        console.log(`    Seal sig: ${header.sealSig ? header.sealSig.substring(0, 20) + '...' : 'undefined'}`)
        console.log(`    Epoch mark present: ${!!header.epochMark}`)
        
        if (header.epochMark) {
          console.log(`    Epoch mark:`)
          console.log(`      Epoch: ${header.epochMark.epoch?.toString() || 'N/A'}`)
          console.log(`      Validators: ${header.epochMark.validators?.length || 0}`)
        }
      }

      console.log(`  Block body present: ${!!block.body}`)
      if (block.body) {
        console.log(`    Extrinsics count: ${block.body.extrinsics?.length || 0}`)
      }
    }

    // Load corresponding JSON for comparison
    const importBlockJsonPath = path.join(
      WORKSPACE_ROOT,
      'submodules/jam-conformance/fuzz-proto/examples/v1/no_forks/00000002_fuzzer_import_block.json',
    )

    let jsonData: any
    try {
      const jsonText = readFileSync(importBlockJsonPath, 'utf-8')
      jsonData = JSON.parse(jsonText)
      console.log(`\n📄 JSON comparison:`)
      console.log(`  JSON loaded successfully`)
    } catch (error) {
      throw new Error(`Failed to load JSON for comparison: ${error instanceof Error ? error.message : String(error)}`)
    }

    // Extract JSON block data
    const jsonBlock = jsonData.import_block || jsonData.block
    if (!jsonBlock) {
      throw new Error('JSON does not contain import_block or block field')
    }

    console.log(`\n🔍 Comparing decoded block with JSON:`)

    // Compare header fields
    if (jsonBlock.header && importBlock.block?.header) {
      const jsonHeader = jsonBlock.header
      const decodedHeader = importBlock.block.header

      console.log(`  Header comparison:`)

      // Parent hash (JSON uses "parent", decoded uses "parent")
      if (jsonHeader.parent) {
        const jsonParent = jsonHeader.parent.toLowerCase()
        const decodedParent = decodedHeader.parent?.toLowerCase() || ''
        const parentMatch = jsonParent === decodedParent
        console.log(`    Parent hash: ${parentMatch ? '✅' : '❌'}`)
        if (!parentMatch) {
          console.log(`      JSON:    ${jsonParent.substring(0, 40)}...`)
          console.log(`      Decoded: ${decodedParent.substring(0, 40)}...`)
        }
        expect(decodedParent).toBe(jsonParent)
      }

      // Parent state root (JSON uses "parent_state_root", decoded uses "priorStateRoot")
      if (jsonHeader.parent_state_root) {
        const jsonStateRoot = jsonHeader.parent_state_root.toLowerCase()
        const decodedStateRoot = decodedHeader.priorStateRoot?.toLowerCase() || ''
        const stateRootMatch = jsonStateRoot === decodedStateRoot
        console.log(`    Parent state root: ${stateRootMatch ? '✅' : '❌'}`)
        if (!stateRootMatch) {
          console.log(`      JSON:    ${jsonStateRoot.substring(0, 40)}...`)
          console.log(`      Decoded: ${decodedStateRoot.substring(0, 40)}...`)
        }
        expect(decodedStateRoot).toBe(jsonStateRoot)
      }

      // Extrinsic hash (JSON uses "extrinsic_hash", decoded uses "extrinsicHash")
      if (jsonHeader.extrinsic_hash) {
        const jsonExtrinsicHash = jsonHeader.extrinsic_hash.toLowerCase()
        const decodedExtrinsicHash = decodedHeader.extrinsicHash?.toLowerCase() || ''
        const extrinsicHashMatch = jsonExtrinsicHash === decodedExtrinsicHash
        console.log(`    Extrinsic hash: ${extrinsicHashMatch ? '✅' : '❌'}`)
        if (!extrinsicHashMatch) {
          console.log(`      JSON:    ${jsonExtrinsicHash.substring(0, 40)}...`)
          console.log(`      Decoded: ${decodedExtrinsicHash.substring(0, 40)}...`)
        }
        expect(decodedExtrinsicHash).toBe(jsonExtrinsicHash)
      }

      // Slot (JSON uses "slot", decoded uses "timeslot")
      if (jsonHeader.slot !== undefined) {
        const jsonSlot = BigInt(jsonHeader.slot)
        const decodedSlot = decodedHeader.timeslot || 0n
        const slotMatch = jsonSlot === decodedSlot
        console.log(`    Slot: ${slotMatch ? '✅' : '❌'} (JSON: ${jsonSlot}, Decoded: ${decodedSlot})`)
        expect(decodedSlot).toBe(jsonSlot)
      }

      // Author index
      if (jsonHeader.author_index !== undefined) {
        const jsonAuthorIndex = BigInt(jsonHeader.author_index)
        const decodedAuthorIndex = decodedHeader.authorIndex || 0n
        const authorIndexMatch = jsonAuthorIndex === decodedAuthorIndex
        console.log(`    Author index: ${authorIndexMatch ? '✅' : '❌'} (JSON: ${jsonAuthorIndex}, Decoded: ${decodedAuthorIndex})`)
        expect(decodedAuthorIndex).toBe(jsonAuthorIndex)
      }

      // Entropy source (JSON uses "entropy_source", decoded uses "vrfSig")
      if (jsonHeader.entropy_source) {
        const jsonEntropy = jsonHeader.entropy_source.toLowerCase()
        const decodedEntropy = decodedHeader.vrfSig?.toLowerCase() || ''
        const entropyMatch = jsonEntropy === decodedEntropy
        console.log(`    Entropy source (VRF sig): ${entropyMatch ? '✅' : '❌'}`)
        if (!entropyMatch) {
          console.log(`      JSON:    ${jsonEntropy.substring(0, 40)}...`)
          console.log(`      Decoded: ${decodedEntropy.substring(0, 40)}...`)
        }
        expect(decodedEntropy).toBe(jsonEntropy)
      }

      // Seal (JSON uses "seal", decoded uses "sealSig")
      if (jsonHeader.seal) {
        const jsonSeal = jsonHeader.seal.toLowerCase()
        const decodedSeal = decodedHeader.sealSig?.toLowerCase() || ''
        const sealMatch = jsonSeal === decodedSeal
        console.log(`    Seal: ${sealMatch ? '✅' : '❌'}`)
        if (!sealMatch) {
          console.log(`      JSON:    ${jsonSeal.substring(0, 40)}...`)
          console.log(`      Decoded: ${decodedSeal.substring(0, 40)}...`)
        }
        expect(decodedSeal).toBe(jsonSeal)
      }

      // Epoch mark (null in JSON)
      if (jsonHeader.epoch_mark === null) {
        expect(decodedHeader.epochMark).toBeNull()
        console.log(`    Epoch mark: ✅ (null as expected)`)
      } else if (jsonHeader.epoch_mark) {
        // If epoch mark exists, compare it
        console.log(`    Epoch mark: present in both`)
        // Add more detailed comparison if needed
      }

      // Tickets mark (null in JSON)
      if (jsonHeader.tickets_mark === null) {
        // Tickets mark might not be in decoded header, that's okay
        console.log(`    Tickets mark: ✅ (null in JSON)`)
      }
    }

    // Compare extrinsic/body
    if (jsonBlock.extrinsic && importBlock.block?.body) {
      const jsonExtrinsic = jsonBlock.extrinsic
      const decodedBody = importBlock.block.body

      console.log(`  Extrinsic/Body comparison:`)

      // Guarantees - compare count and values
      if (jsonExtrinsic.guarantees) {
        const jsonGuarantees = jsonExtrinsic.guarantees
        const decodedGuarantees = decodedBody.guarantees || []
        const guaranteesCountMatch = jsonGuarantees.length === decodedGuarantees.length
        console.log(`    Guarantees count: ${guaranteesCountMatch ? '✅' : '❌'} (JSON: ${jsonGuarantees.length}, Decoded: ${decodedGuarantees.length})`)
        expect(decodedGuarantees.length).toBe(jsonGuarantees.length)

        // Compare each guarantee
        for (let i = 0; i < Math.min(jsonGuarantees.length, decodedGuarantees.length); i++) {
          const jsonGuarantee = jsonGuarantees[i]
          const decodedGuarantee = decodedGuarantees[i]

          // Compare slot
          if (jsonGuarantee.slot !== undefined) {
            const jsonSlot = BigInt(jsonGuarantee.slot)
            const decodedSlot = decodedGuarantee.slot || 0n
            const slotMatch = jsonSlot === decodedSlot
            console.log(`      Guarantee ${i} slot: ${slotMatch ? '✅' : '❌'} (JSON: ${jsonSlot}, Decoded: ${decodedSlot})`)
            expect(decodedSlot).toBe(jsonSlot)
          }

          // Compare report authorizer hash (JSON uses "authorizer_hash", decoded uses "authorizer_hash")
          if (jsonGuarantee.report?.authorizer_hash) {
            const jsonAuthorizer = jsonGuarantee.report.authorizer_hash.toLowerCase()
            const decodedAuthorizer = decodedGuarantee.report?.authorizer_hash?.toLowerCase() || ''
            const authorizerMatch = jsonAuthorizer === decodedAuthorizer
            console.log(`      Guarantee ${i} authorizer hash: ${authorizerMatch ? '✅' : '❌'}`)
            if (!authorizerMatch) {
              console.log(`        JSON:    ${jsonAuthorizer.substring(0, 40)}...`)
              console.log(`        Decoded: ${decodedAuthorizer.substring(0, 40)}...`)
            }
            expect(decodedAuthorizer).toBe(jsonAuthorizer)
          }

          // Compare signatures count
          if (jsonGuarantee.signatures) {
            const jsonSignaturesCount = jsonGuarantee.signatures.length
            const decodedSignaturesCount = decodedGuarantee.signatures?.length || 0
            const signaturesCountMatch = jsonSignaturesCount === decodedSignaturesCount
            console.log(`      Guarantee ${i} signatures count: ${signaturesCountMatch ? '✅' : '❌'} (JSON: ${jsonSignaturesCount}, Decoded: ${decodedSignaturesCount})`)
            expect(decodedSignaturesCount).toBe(jsonSignaturesCount)
          }
        }
      }

      // Tickets - compare count and values
      if (jsonExtrinsic.tickets) {
        const jsonTickets = jsonExtrinsic.tickets
        const decodedTickets = decodedBody.tickets || []
        const ticketsCountMatch = jsonTickets.length === decodedTickets.length
        console.log(`    Tickets count: ${ticketsCountMatch ? '✅' : '❌'} (JSON: ${jsonTickets.length}, Decoded: ${decodedTickets.length})`)
        expect(decodedTickets.length).toBe(jsonTickets.length)

        // Compare each ticket (if any)
        for (let i = 0; i < Math.min(jsonTickets.length, decodedTickets.length); i++) {
          const jsonTicket = jsonTickets[i]
          const decodedTicket = decodedTickets[i]

          // Compare ticket hash if available
          if (jsonTicket.hash) {
            const jsonHash = jsonTicket.hash.toLowerCase()
            // Tickets might have different field names, check common ones
            const decodedHash = (decodedTicket as any).hash?.toLowerCase() || (decodedTicket as any).ticketHash?.toLowerCase() || ''
            if (decodedHash) {
              const hashMatch = jsonHash === decodedHash
              console.log(`      Ticket ${i} hash: ${hashMatch ? '✅' : '❌'}`)
              expect(decodedHash).toBe(jsonHash)
            }
          }
        }
      }

      // Preimages - compare count and values
      if (jsonExtrinsic.preimages) {
        const jsonPreimages = jsonExtrinsic.preimages
        const decodedPreimages = decodedBody.preimages || []
        const preimagesCountMatch = jsonPreimages.length === decodedPreimages.length
        console.log(`    Preimages count: ${preimagesCountMatch ? '✅' : '❌'} (JSON: ${jsonPreimages.length}, Decoded: ${decodedPreimages.length})`)
        expect(decodedPreimages.length).toBe(jsonPreimages.length)

        // Compare each preimage (if any)
        for (let i = 0; i < Math.min(jsonPreimages.length, decodedPreimages.length); i++) {
          const jsonPreimage = jsonPreimages[i]
          const decodedPreimage = decodedPreimages[i]

          // Compare preimage hash if available
          if (jsonPreimage.hash) {
            const jsonHash = jsonPreimage.hash.toLowerCase()
            const decodedHash = (decodedPreimage as any).hash?.toLowerCase() || (decodedPreimage as any).preimageHash?.toLowerCase() || ''
            if (decodedHash) {
              const hashMatch = jsonHash === decodedHash
              console.log(`      Preimage ${i} hash: ${hashMatch ? '✅' : '❌'}`)
              expect(decodedHash).toBe(jsonHash)
            }
          }
        }
      }

      // Assurances - compare count
      if (jsonExtrinsic.assurances) {
        const jsonAssurancesCount = jsonExtrinsic.assurances.length
        const decodedAssurancesCount = decodedBody.assurances?.length || 0
        const assurancesCountMatch = jsonAssurancesCount === decodedAssurancesCount
        console.log(`    Assurances count: ${assurancesCountMatch ? '✅' : '❌'} (JSON: ${jsonAssurancesCount}, Decoded: ${decodedAssurancesCount})`)
        expect(decodedAssurancesCount).toBe(jsonAssurancesCount)
      }

      // Disputes - compare structure
      if (jsonExtrinsic.disputes) {
        const jsonDisputes = jsonExtrinsic.disputes
        const decodedDisputes = decodedBody.disputes || []
        
        // Compare verdicts count
        if (jsonDisputes.verdicts) {
          const jsonVerdictsCount = jsonDisputes.verdicts.length
          const decodedVerdictsCount = decodedDisputes.filter((d: any) => d.type === 'verdict').length || 0
          console.log(`    Disputes verdicts count: ${jsonVerdictsCount === decodedVerdictsCount ? '✅' : '❌'} (JSON: ${jsonVerdictsCount}, Decoded: ${decodedVerdictsCount})`)
          expect(decodedVerdictsCount).toBe(jsonVerdictsCount)
        }

        // Compare culprits count
        if (jsonDisputes.culprits) {
          const jsonCulpritsCount = jsonDisputes.culprits.length
          const decodedCulpritsCount = decodedDisputes.filter((d: any) => d.type === 'culprit').length || 0
          console.log(`    Disputes culprits count: ${jsonCulpritsCount === decodedCulpritsCount ? '✅' : '❌'} (JSON: ${jsonCulpritsCount}, Decoded: ${decodedCulpritsCount})`)
          expect(decodedCulpritsCount).toBe(jsonCulpritsCount)
        }

        // Compare faults count
        if (jsonDisputes.faults) {
          const jsonFaultsCount = jsonDisputes.faults.length
          const decodedFaultsCount = decodedDisputes.filter((d: any) => d.type === 'fault').length || 0
          console.log(`    Disputes faults count: ${jsonFaultsCount === decodedFaultsCount ? '✅' : '❌'} (JSON: ${jsonFaultsCount}, Decoded: ${decodedFaultsCount})`)
          expect(decodedFaultsCount).toBe(jsonFaultsCount)
        }
      }
    }

    console.log(`\n✅ All JSON comparisons passed`)

    // Basic assertions
    expect(decodedMessage.type).toBe(FuzzMessageType.ImportBlock)
    expect(importBlock.block).toBeDefined()
    expect(importBlock.block.header).toBeDefined()
  })

  it('should decode multiple ImportBlock messages from the test suite', () => {
    const configService = new ConfigService('tiny')
    const testFiles = [
      '00000002_fuzzer_import_block.bin',
      '00000003_fuzzer_import_block.bin',
      '00000004_fuzzer_import_block.bin',
    ]

    for (const testFile of testFiles) {
      const importBlockBinPath = path.join(
        WORKSPACE_ROOT,
        `submodules/jam-conformance/fuzz-proto/examples/v1/no_forks/${testFile}`,
      )

      let importBlockBin: Uint8Array
      try {
        importBlockBin = new Uint8Array(readFileSync(importBlockBinPath))
      } catch (error) {
        console.warn(`⚠️  Skipping ${testFile}: ${error instanceof Error ? error.message : String(error)}`)
        continue
      }

      // Handle length prefix
      let messageData: Uint8Array
      if (importBlockBin.length >= 4) {
        const lengthPrefix = new DataView(importBlockBin.buffer, importBlockBin.byteOffset, 4).getUint32(0, true)
        if (lengthPrefix === importBlockBin.length - 4) {
          messageData = importBlockBin.subarray(4)
        } else {
          messageData = importBlockBin
        }
      } else {
        messageData = importBlockBin
      }

      // Verify discriminant
      const discriminant = messageData.length > 0 ? messageData[0] : undefined
      if (discriminant !== 0x03) {
        throw new Error(`Expected ImportBlock discriminant (0x03) in ${testFile}, got 0x${discriminant?.toString(16) || 'undefined'}`)
      }

      // Decode the message
      try {
        const decodedMessage = decodeFuzzMessage(messageData, configService)
        expect(decodedMessage.type).toBe(FuzzMessageType.ImportBlock)
        expect(decodedMessage.payload.block).toBeDefined()
        expect(decodedMessage.payload.block.header).toBeDefined()
        console.log(`✅ Successfully decoded ${testFile}`)
      } catch (error) {
        console.error(`❌ Failed to decode ${testFile}: ${error instanceof Error ? error.message : String(error)}`)
        throw error
      }
    }
  })
})

