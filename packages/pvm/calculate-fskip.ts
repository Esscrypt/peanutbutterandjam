#!/usr/bin/env bun

/**
 * Calculate Fskip using all-1s bitmask according to Gray Paper
 *
 * From Gray Paper pvm.tex line 81:
 * Fskip(i) = min(24, j ∈ N : (k ∥ {1,1,...})_{i + 1 + j} = 1)
 *
 * Where:
 * - k is the opcode bitmask
 * - {1,1,...} represents an infinite sequence of 1s
 * - i is the instruction index
 * - j is the search distance
 *
 * For an all-1s bitmask, k = 0xFF (all bits set to 1)
 * The sequence becomes: k ∥ {1,1,...} = 0xFF ∥ 0xFF ∥ 0xFF ∥ ...
 *
 * Usage: bun run calculate-fskip.ts
 */

/**
 * Calculate Fskip for a given instruction index and bitmask
 *
 * @param instructionIndex - The instruction index i
 * @param bitmask - The opcode bitmask k (as a number)
 * @param maxSearchDistance - Maximum distance to search (default 24)
 * @returns The Fskip value
 */
function calculateFskip(
  instructionIndex: number,
  bitmask: number,
  maxSearchDistance = 24,
): number {
  console.log(
    `\n🔍 Calculating Fskip(${instructionIndex}) with bitmask 0x${bitmask.toString(16).toUpperCase()}`,
  )

  // For an all-1s bitmask, every bit position is 1
  // So we need to find the first position where the bit is 0
  // Since all bits are 1, Fskip should be 0

  console.log(
    `   Bitmask: 0x${bitmask.toString(16).toUpperCase()} (${bitmask.toString(2).padStart(8, '0')})`,
  )

  // Check if bitmask is all 1s
  const isAllOnes = bitmask === 0xff
  console.log(`   Is all-1s bitmask: ${isAllOnes}`)

  if (isAllOnes) {
    console.log(`   ✅ All-1s bitmask detected: Fskip(${instructionIndex}) = 0`)
    return 0
  }

  // For non-all-1s bitmasks, search for the first 0 bit
  for (let j = 0; j <= maxSearchDistance; j++) {
    const bitPosition = instructionIndex + 1 + j

    // Calculate which bit to check in the bitmask
    const bitIndex = bitPosition % 8
    const bitValue = (bitmask >> (7 - bitIndex)) & 1

    console.log(
      `   j=${j}: bitPosition=${bitPosition}, bitIndex=${bitIndex}, bitValue=${bitValue}`,
    )

    if (bitValue === 1) {
      console.log(
        `   ✅ Found first 1 bit at j=${j}: Fskip(${instructionIndex}) = ${j}`,
      )
      return j
    }
  }

  console.log(
    `   ⚠️  No 1 bit found within maxSearchDistance=${maxSearchDistance}: Fskip(${instructionIndex}) = ${maxSearchDistance}`,
  )
  return maxSearchDistance
}

/**
 * Calculate Fskip for multiple instruction indices
 */
function calculateFskipMultiple(
  instructionIndices: number[],
  bitmask: number,
  maxSearchDistance = 24,
): Map<number, number> {
  const results = new Map<number, number>()

  console.log(`\n📊 Calculating Fskip for multiple instruction indices`)
  console.log(`   Bitmask: 0x${bitmask.toString(16).toUpperCase()}`)
  console.log(`   Max search distance: ${maxSearchDistance}`)

  for (const i of instructionIndices) {
    const fskip = calculateFskip(i, bitmask, maxSearchDistance)
    results.set(i, fskip)
  }

  return results
}

/**
 * Analyze the Gray Paper Fskip function
 */
function analyzeGrayPaperFskip(): void {
  console.log('📚 Gray Paper Fskip Analysis')
  console.log('='.repeat(50))

  console.log('\n📖 Definition from Gray Paper pvm.tex line 81:')
  console.log('   Fskip(i) = min(24, j ∈ N : (k ∥ {1,1,...})_{i + 1 + j} = 1)')
  console.log('\n   Where:')
  console.log('   - k is the opcode bitmask')
  console.log('   - {1,1,...} represents an infinite sequence of 1s')
  console.log('   - i is the instruction index')
  console.log('   - j is the search distance')

  console.log('\n🔍 For an all-1s bitmask (k = 0xFF):')
  console.log('   - Every bit position is 1')
  console.log('   - The sequence k ∥ {1,1,...} = 0xFF ∥ 0xFF ∥ 0xFF ∥ ...')
  console.log('   - All bits in the sequence are 1')
  console.log('   - Fskip(i) = 0 for any instruction index i')

  console.log('\n🧮 Mathematical proof:')
  console.log('   For k = 0xFF (all bits set to 1):')
  console.log(
    '   - (k ∥ {1,1,...})_{i + 1 + 0} = (0xFF ∥ 0xFF ∥ ...)_{i + 1} = 1',
  )
  console.log('   - Since the first bit (j=0) is 1, Fskip(i) = 0')

  console.log('\n📈 Implications for operand length:')
  console.log('   - If Fskip(i) = 0, then the skip distance ℓ = 0')
  console.log('   - This means l_X = min(4, ℓ) = min(4, 0) = 0')
  console.log(
    '   - And l_Y = min(4, max(0, ℓ - l_X - 1)) = min(4, max(0, 0 - 0 - 1)) = 0',
  )
  console.log('   - So operands would have 0 length, which seems incorrect')

  console.log('\n🤔 This suggests:')
  console.log(
    '   - Either the Gray Paper calculation is different from test vectors',
  )
  console.log('   - Or test vectors use a different bitmask than all-1s')
  console.log('   - Or there is a minimum operand length constraint')
}

/**
 * Test different bitmask scenarios
 */
function testBitmaskScenarios(): void {
  console.log('\n🧪 Testing Different Bitmask Scenarios')
  console.log('='.repeat(50))

  const testCases = [
    { name: 'All 1s', bitmask: 0xff },
    { name: 'All 0s', bitmask: 0x00 },
    { name: 'Alternating', bitmask: 0xaa },
    { name: 'Half 1s', bitmask: 0xf0 },
    { name: 'Quarter 1s', bitmask: 0xc0 },
  ]

  const instructionIndices = [0, 1, 2, 3, 4]

  for (const testCase of testCases) {
    console.log(
      `\n📋 ${testCase.name} bitmask (0x${testCase.bitmask.toString(16).toUpperCase()}):`,
    )
    const results = calculateFskipMultiple(instructionIndices, testCase.bitmask)

    console.log('   Results:')
    for (const [i, fskip] of results) {
      console.log(`     Fskip(${i}) = ${fskip}`)
    }
  }
}

/**
 * Main function
 */
function main(): void {
  console.log('🚀 Fskip Calculator for Gray Paper')
  console.log('='.repeat(50))

  // Analyze the Gray Paper definition
  analyzeGrayPaperFskip()

  // Test different bitmask scenarios
  testBitmaskScenarios()

  // Specific test for all-1s bitmask
  console.log('\n🎯 Specific Test: All-1s Bitmask')
  console.log('='.repeat(50))

  const allOnesBitmask = 0xff
  const instructionIndices = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

  const results = calculateFskipMultiple(instructionIndices, allOnesBitmask)

  console.log('\n📊 Summary Results:')
  console.log('Instruction Index | Fskip Value')
  console.log('-'.repeat(30))
  for (const [i, fskip] of results) {
    console.log(`${i.toString().padEnd(17)} | ${fskip}`)
  }

  console.log('\n💡 Key Insights:')
  console.log(
    '   - For all-1s bitmask, Fskip(i) = 0 for all instruction indices',
  )
  console.log('   - This means skip distance ℓ = 0')
  console.log(
    '   - Operand lengths would be 0, which contradicts test vector observations',
  )
  console.log(
    '   - Test vectors likely use a different bitmask or have additional constraints',
  )

  console.log('\n✨ Analysis complete!')
}

// Run the analysis
main()
