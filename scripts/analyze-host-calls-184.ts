#!/usr/bin/env bun
/**
 * Analyze host function calls and find divergence points for timeslot 184
 */

import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

const workspaceRoot = join(__dirname, '..')
const services = [
  { index: 0, serviceId: 0 },
  { index: 0, serviceId: 3088308099 },
  { index: 0, serviceId: 3953987607 },
  { index: 0, serviceId: 3953987649 },
  { index: 0, serviceId: 516569628 },
  { index: 1, serviceId: 3953987649 },
]

function findHostCallsInTrace(
  tracePath: string,
  maxStep: number,
): Array<{ step: number; name: string; id: number }> {
  if (!existsSync(tracePath)) {
    return []
  }

  const content = readFileSync(tracePath, 'utf-8')
  const lines = content.split('\n')
  const hostCalls: Array<{ step: number; name: string; id: number }> = []

  for (const line of lines) {
    // Match: "Calling host function: NAME ID [gas used: X, gas remaining: Y] [service: Z]"
    const match = line.match(
      /Calling host function: (\w+) (\d+) \[gas used: (\d+), gas remaining: (\d+)\] \[service: (\d+)\]/,
    )
    if (match) {
      // Find the step number from previous lines
      let step = 0
      const lineIndex = lines.indexOf(line)
      for (let i = lineIndex - 1; i >= 0 && i >= lineIndex - 10; i--) {
        const stepMatch = lines[i].match(/(\w+) (\d+) (\d+) Gas:/)
        if (stepMatch) {
          step = Number.parseInt(stepMatch[2])
          break
        }
      }
      if (step > 0 && step < maxStep) {
        hostCalls.push({
          step,
          name: match[1],
          id: Number.parseInt(match[2]),
        })
      }
    }
  }

  return hostCalls
}

console.log('Analyzing host function calls for timeslot 184...\n')

for (const { index, serviceId } of services) {
  console.log(`\n${'='.repeat(80)}`)
  console.log(`Service ${serviceId} (Index ${index})`)
  console.log('='.repeat(80))

  // Try to find TypeScript trace
  const typescriptTracePath = join(
    workspaceRoot,
    'pvm-traces',
    'fuzzy',
    'modular',
    `00000184`,
    `${index}`,
    `${serviceId}`,
    'opcode',
  )

  if (existsSync(typescriptTracePath)) {
    // Read the opcode file to find ECALLI instructions (host function calls)
    const opcodes = readFileSync(typescriptTracePath, 'utf-8')
      .trim()
      .split('\n')

    // Find ECALLI instructions and their step numbers
    const hostCalls: Array<{ step: number; pc: number }> = []
    for (let i = 0; i < opcodes.length; i++) {
      if (opcodes[i].trim() === 'ECALLI') {
        // Get step number (line index + 1)
        const step = i + 1
        // Try to get PC from pc file
        const pcPath = join(
          workspaceRoot,
          'pvm-traces',
          'fuzzy',
          'modular',
          `00000184`,
          `${index}`,
          `${serviceId}`,
          'pc',
        )
        if (existsSync(pcPath)) {
          const pcs = readFileSync(pcPath, 'utf-8').trim().split('\n')
          if (pcs[i]) {
            const pc = Number.parseInt(pcs[i].trim())
            hostCalls.push({ step, pc })
          }
        }
      }
    }

    console.log(
      `Found ${hostCalls.length} host function calls (ECALLI instructions)`,
    )
    if (hostCalls.length > 0) {
      console.log('Last 5 host calls:')
      for (const call of hostCalls.slice(-5)) {
        console.log(`  Step ${call.step}, PC ${call.pc}`)
      }
    }

    // Based on user's output, divergence starts around step 29240
    // Find the last host call before that
    const divergenceStep = 29240
    const lastHostCallBeforeDivergence = hostCalls
      .filter((c) => c.step < divergenceStep)
      .slice(-1)[0]
    if (lastHostCallBeforeDivergence) {
      console.log(
        `\nLast host call before divergence (step ${divergenceStep}):`,
      )
      console.log(
        `  Step ${lastHostCallBeforeDivergence.step}, PC ${lastHostCallBeforeDivergence.pc}`,
      )
    }
  } else {
    console.log(`Trace not found: ${typescriptTracePath}`)
  }
}

console.log('\n' + '='.repeat(80))
console.log('Analysis complete')
console.log('='.repeat(80))
