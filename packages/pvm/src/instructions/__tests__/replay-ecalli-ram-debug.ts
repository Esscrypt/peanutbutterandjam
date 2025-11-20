/**
 * Test script to analyze instructions before ECALLI and find RAM mismatches
 * 
 * This script:
 * 1. Loads the panic dump
 * 2. Finds the ECALLI instruction
 * 3. Analyzes address interaction history to find where RAM is incorrectly set/read as zeros
 */

import { readFileSync } from 'fs'
import { join } from 'path'

interface ExecutionLog {
  pc: string
  instructionName: string
  opcode: string
  message: string
  data?: Record<string, unknown>
  registers: string[]
  timestamp: number
}

interface AddressInteraction {
  instructionPC: string
  instructionOpcode: string
  instructionName: string
  instructionType: 'read' | 'write'
  region: string
  accessedAddress: string
  register?: string
  value?: string
  operands?: number[]
  encodedValue?: number[]
}

interface PanicDump {
  executionLogs: ExecutionLog[]
  postState: {
    pc: string
    registers: Record<string, string>
  }
  addressInteractionHistory: Array<{
    address: string
    interactionHistory: AddressInteraction[]
  }>
  serviceId: string
}

function loadPanicDump(filePath: string): PanicDump {
  const content = readFileSync(filePath, 'utf-8')
  return JSON.parse(content) as PanicDump
}

function findECALLIInstruction(logs: ExecutionLog[]): number {
  for (let i = 0; i < logs.length; i++) {
    if (logs[i].instructionName === 'ECALLI') {
      return i
    }
  }
  return -1
}

function analyzeRAMIssues(dump: PanicDump, ecalliIndex: number): void {
  const ecalliPC = BigInt(dump.executionLogs[ecalliIndex].pc)
  console.log(`\n=== Analyzing RAM Issues Before ECALLI at PC ${ecalliPC} ===\n`)
  
  // Build a map of writes by address
  const writesByAddress = new Map<bigint, AddressInteraction[]>()
  const readsByAddress = new Map<bigint, AddressInteraction[]>()
  
  for (const addrEntry of dump.addressInteractionHistory) {
    const address = BigInt(addrEntry.address)
    
    for (const interaction of addrEntry.interactionHistory) {
      const interactionPC = BigInt(interaction.instructionPC)
      
      // Only check interactions before ECALLI
      if (interactionPC >= ecalliPC) {
        continue
      }
      
      if (interaction.instructionType === 'write') {
        if (!writesByAddress.has(address)) {
          writesByAddress.set(address, [])
        }
        writesByAddress.get(address)!.push(interaction)
      } else if (interaction.instructionType === 'read') {
        if (!readsByAddress.has(address)) {
          readsByAddress.set(address, [])
        }
        readsByAddress.get(address)!.push(interaction)
      }
    }
  }
  
  console.log(`Found ${writesByAddress.size} addresses with writes`)
  console.log(`Found ${readsByAddress.size} addresses with reads\n`)
  
  // Check for writes that set non-zero values but subsequent reads return zeros
  console.log('=== Checking for Writes Followed by Zero Reads ===\n')
  
  let issueCount = 0
  for (const [address, writes] of writesByAddress.entries()) {
    // Find the last write before ECALLI
    const lastWrite = writes
      .filter((w) => BigInt(w.instructionPC) < ecalliPC)
      .sort((a, b) => Number(BigInt(b.instructionPC) - BigInt(a.instructionPC)))[0]
    
    if (!lastWrite || !lastWrite.encodedValue) {
      continue
    }
    
    // Check if the write set non-zero values
    const hasNonZero = lastWrite.encodedValue.some((b) => b !== 0)
    if (!hasNonZero) {
      continue // Skip writes that set all zeros
    }
    
    // Find reads after this write
    const reads = readsByAddress.get(address) || []
    const readsAfterWrite = reads.filter(
      (r) => BigInt(r.instructionPC) > BigInt(lastWrite.instructionPC) && BigInt(r.instructionPC) < ecalliPC,
    )
    
    for (const read of readsAfterWrite) {
      // Check if read returned zero when it shouldn't
      if (read.value && BigInt(read.value) === 0n) {
        issueCount++
        console.log(`❌ Issue #${issueCount}: Address ${address.toString()}`)
        console.log(`   Write at PC ${lastWrite.instructionPC} (${lastWrite.instructionName}):`)
        console.log(`     Encoded value: [${lastWrite.encodedValue.join(', ')}]`)
        console.log(`   Read at PC ${read.instructionPC} (${read.instructionName}):`)
        console.log(`     Read value: ${read.value} (ZERO!)`)
        console.log(`     Register: ${read.register || 'N/A'}`)
        console.log('')
      }
    }
  }
  
  // Check for addresses that should have data but are all zeros
  console.log('\n=== Checking Arguments Segment (r7/r8) ===\n')
  
  const r7 = BigInt(dump.postState.registers.r7)
  const r8 = BigInt(dump.postState.registers.r8)
  
  console.log(`r7 (arguments start): ${r7.toString()}`)
  console.log(`r8 (arguments length): ${r8.toString()}\n`)
  
  // Find all interactions with the arguments segment
  const argSegmentInteractions: Array<{
    address: bigint
    interaction: AddressInteraction
  }> = []
  
  for (const addrEntry of dump.addressInteractionHistory) {
    const address = BigInt(addrEntry.address)
    
    // Check if address is in arguments segment
    if (address >= r7 && address < r7 + r8) {
      for (const interaction of addrEntry.interactionHistory) {
        const interactionPC = BigInt(interaction.instructionPC)
        if (interactionPC < ecalliPC) {
          argSegmentInteractions.push({ address, interaction })
        }
      }
    }
  }
  
  // Sort by PC
  argSegmentInteractions.sort((a, b) =>
    Number(BigInt(a.interaction.instructionPC) - BigInt(b.interaction.instructionPC)),
  )
  
  console.log(`Found ${argSegmentInteractions.length} interactions with arguments segment\n`)
  
  // Check for writes to arguments segment
  const argWrites = argSegmentInteractions.filter(
    (i) => i.interaction.instructionType === 'write',
  )
  console.log(`Writes to arguments segment: ${argWrites.length}`)
  
  for (const { address, interaction } of argWrites) {
    if (interaction.encodedValue) {
      const offset = Number(address - r7)
      console.log(
        `  PC ${interaction.instructionPC}: Write at offset ${offset}, value: [${interaction.encodedValue.join(', ')}]`,
      )
    }
  }
  
  // Check for reads from arguments segment that return zeros
  const argReads = argSegmentInteractions.filter(
    (i) => i.interaction.instructionType === 'read',
  )
  console.log(`\nReads from arguments segment: ${argReads.length}`)
  
  let zeroReadCount = 0
  for (const { address, interaction } of argReads) {
    if (interaction.value && BigInt(interaction.value) === 0n) {
      zeroReadCount++
      const offset = Number(address - r7)
      console.log(
        `  ⚠️  PC ${interaction.instructionPC}: Read at offset ${offset} returned ZERO (${interaction.instructionName})`,
      )
    }
  }
  
  if (zeroReadCount > 0) {
    console.log(`\n❌ Found ${zeroReadCount} reads from arguments segment that returned zero!`)
  }
  
  // Check the ECALLI instruction itself
  console.log('\n=== ECALLI Instruction Context ===\n')
  const ecalliLog = dump.executionLogs[ecalliIndex]
  console.log(`PC: ${ecalliLog.pc}`)
  console.log(`Registers:`, ecalliLog.registers)
  if (ecalliLog.data) {
    console.log(`Data:`, JSON.stringify(ecalliLog.data, null, 2))
  }
  
  // Check what registers[7] and registers[8] are at ECALLI
  const ecalliR7 = BigInt(ecalliLog.registers[7])
  const ecalliR8 = BigInt(ecalliLog.registers[8])
  console.log(`\nr7 at ECALLI: ${ecalliR7.toString()}`)
  console.log(`r8 at ECALLI: ${ecalliR8.toString()}`)
  
  // Track register r7 and r8 changes
  console.log('\n=== Tracking r7 and r8 Register Changes ===\n')
  
  const r7History: Array<{ pc: string; value: bigint; instruction: string }> = []
  const r8History: Array<{ pc: string; value: bigint; instruction: string }> = []
  
  for (let i = 0; i < ecalliIndex; i++) {
    const log = dump.executionLogs[i]
    const r7 = BigInt(log.registers[7])
    const r8 = BigInt(log.registers[8])
    
    // Track when r7 changes
    if (r7History.length === 0 || r7History[r7History.length - 1].value !== r7) {
      r7History.push({
        pc: log.pc,
        value: r7,
        instruction: log.instructionName,
      })
    }
    
    // Track when r8 changes
    if (r8History.length === 0 || r8History[r8History.length - 1].value !== r8) {
      r8History.push({
        pc: log.pc,
        value: r8,
        instruction: log.instructionName,
      })
    }
  }
  
  console.log('r7 value changes:')
  for (const entry of r7History) {
    console.log(`  PC ${entry.pc} (${entry.instruction}): ${entry.value.toString()}`)
  }
  
  console.log('\nr8 value changes:')
  for (const entry of r8History) {
    console.log(`  PC ${entry.pc} (${entry.instruction}): ${entry.value.toString()}`)
  }
  
  // Find when r7 and r8 were zeroed
  const r7ZeroedAt = r7History.find((e) => e.value === 0n)
  const r8ZeroedAt = r8History.find((e) => e.value === 0n)
  
  if (r7ZeroedAt) {
    console.log(`\n❌ r7 was zeroed at PC ${r7ZeroedAt.pc} (${r7ZeroedAt.instruction})`)
    // Show instructions around this point
    const zeroedIndex = dump.executionLogs.findIndex((l) => l.pc === r7ZeroedAt.pc)
    if (zeroedIndex >= 0) {
      console.log('\nInstructions around r7 zeroing:')
      for (let i = Math.max(0, zeroedIndex - 3); i <= Math.min(ecalliIndex, zeroedIndex + 3); i++) {
        const log = dump.executionLogs[i]
        const r7 = BigInt(log.registers[7])
        const r8 = BigInt(log.registers[8])
        const marker = i === zeroedIndex ? '>>> ' : '    '
        console.log(
          `${marker}PC ${log.pc}: ${log.instructionName} - r7=${r7.toString()}, r8=${r8.toString()}`,
        )
      }
    }
  }
  
  if (r8ZeroedAt) {
    console.log(`\n❌ r8 was zeroed at PC ${r8ZeroedAt.pc} (${r8ZeroedAt.instruction})`)
  }
  
  // Check initial values
  const firstLog = dump.executionLogs[0]
  const initialR7 = BigInt(firstLog.registers[7])
  const initialR8 = BigInt(firstLog.registers[8])
  console.log(`\nInitial r7: ${initialR7.toString()}`)
  console.log(`Initial r8: ${initialR8.toString()}`)
  
  if (initialR7 > 0n && ecalliR7 === 0n) {
    console.log(`\n❌ r7 was non-zero initially (${initialR7.toString()}) but zero at ECALLI!`)
  }
  
  if (initialR8 > 0n && ecalliR8 === 0n) {
    console.log(`\n❌ r8 was non-zero initially (${initialR8.toString()}) but zero at ECALLI!`)
  }
}

function main() {
  const workspaceRoot = process.cwd().includes('/packages/pvm')
    ? process.cwd().split('/packages/pvm')[0]
    : process.cwd()
  
  const dumpPath = join(
    workspaceRoot,
    'panic-dumps',
    'oog-2025-11-15T14-47-14-607Z.json',
  )
  
  console.log(`Loading panic dump from: ${dumpPath}`)
  const dump = loadPanicDump(dumpPath)
  
  console.log(`Total execution logs: ${dump.executionLogs.length}`)
  console.log(`Service ID: ${dump.serviceId}`)
  
  // Find ECALLI instruction
  const ecalliIndex = findECALLIInstruction(dump.executionLogs)
  if (ecalliIndex === -1) {
    console.error('❌ ECALLI instruction not found in execution logs')
    process.exit(1)
  }
  
  console.log(`Found ECALLI at index ${ecalliIndex} (PC ${dump.executionLogs[ecalliIndex].pc})`)
  console.log(`Analyzing ${ecalliIndex} instructions before ECALLI...\n`)
  
  // Analyze RAM issues
  analyzeRAMIssues(dump, ecalliIndex)
  
  console.log('\n=== Analysis Complete ===\n')
}

if (require.main === module) {
  try {
    main()
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

