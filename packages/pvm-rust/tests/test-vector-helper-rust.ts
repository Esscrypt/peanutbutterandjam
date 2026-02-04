/**
 * Test vector helper for PVM Rust native binding.
 * Mirrors pvm/src/instructions/__tests__/test-vector-helper.ts but uses the NAPI native module.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const PAGE_SIZE = 4096
const PVM_TEST_VECTORS_REL = join('submodules', 'pvm-test-vectors', 'pvm', 'programs')

export function parseJsonSafe(jsonString: string): unknown {
  const quoted = jsonString.replace(
    /([:\[,]|^)\s*(\d+)\s*(?=[,\}\]])/gm,
    '$1"$2"',
  )
  return JSON.parse(quoted)
}

export interface PVMTestVector {
  name: string
  program: (number | string)[]
  'initial-regs': (number | string)[]
  'initial-pc': number | string
  'initial-gas': number | string
  'initial-page-map'?: Array<{
    address: number | string
    length: number | string
    'is-writable': boolean
  }>
  'initial-memory'?: Array<{
    address: number | string
    contents: (number | string)[]
  }>
  'expected-regs': (number | string)[]
  'expected-pc': number | string
  'expected-gas': number | string
  'expected-status': string
  'expected-memory'?: Array<{
    address: number | string
    contents: (number | string)[]
  }>
  'expected-page-fault-address'?: number | string
}

/**
 * Resolve test vectors dir by walking up until submodules/pvm-test-vectors exists.
 * Works when run from repo root, packages/, or packages/pvm-rust.
 */
export function getTestVectorsDir(): string {
  let dir = process.cwd()
  for (let i = 0; i < 10; i++) {
    const candidate = join(dir, PVM_TEST_VECTORS_REL)
    if (existsSync(candidate)) return candidate
    const parent = join(dir, '..')
    if (parent === dir) break
    dir = parent
  }
  return join(process.cwd(), PVM_TEST_VECTORS_REL)
}

/**
 * Load all test vectors whose filename starts with prefix (e.g. 'riscv_').
 */
export function loadTestVectorsByPrefix(prefix: string): PVMTestVector[] {
  const testVectorsDir = getTestVectorsDir()
  let allFiles: string[] = []
  try {
    allFiles = readdirSync(testVectorsDir)
  } catch {
    return []
  }
  const matching = allFiles.filter((f) => f.startsWith(prefix) && f.endsWith('.json'))
  const testVectors: PVMTestVector[] = []
  for (const file of matching) {
    try {
      const filePath = join(testVectorsDir, file)
      const contents = readFileSync(filePath, 'utf-8')
      const tv = parseJsonSafe(contents) as PVMTestVector
      tv.name = tv.name ?? file.replace('.json', '')
      testVectors.push(tv)
    } catch {
      continue
    }
  }
  return testVectors
}

function loadNative(): {
  init: (ramType: number) => void
  reset: () => void
  getRamTypeSimpleRam: () => number
  setRegisters: (registers: Buffer) => void
  setGasLeft: (gas: number) => void
  setNextProgramCounter: (pc: number) => void
  initPage: (address: number, length: number, accessType: number) => void
  setMemory: (address: number, data: Buffer) => void
  prepareBlob: (program: Buffer) => void
  runBlob: (program: Buffer) => void
  nextStep: () => boolean
  getRegisters: () => Buffer
  getProgramCounter: () => number
  getGasLeft: () => number
  getStatus: () => number
  getExitArg: () => number
  getPageDump: (pageIndex: number) => Buffer
  getCode: () => Buffer
  getBitmask: () => Buffer
} {
  return require('@pbnjam/pvm-rust-native/native')
}

/** Gray Paper Fskip(i): octets to next instruction opcode minus 1. */
function fskip(pc: number, bitmask: Uint8Array): number {
  for (let j = 1; j <= 24; j++) {
    const idx = pc + j
    if (idx >= bitmask.length || bitmask[idx] === 1) return j - 1
  }
  return 24
}

/** Opcode number -> name for trace logging (matches config.rs). */
const OPCODE_NAMES: Record<number, string> = {
  0: 'TRAP',
  1: 'FALLTHROUGH',
  10: 'ECALLI',
  20: 'LOAD_IMM_64',
  30: 'STORE_IMM_U8',
  31: 'STORE_IMM_U16',
  32: 'STORE_IMM_U32',
  33: 'STORE_IMM_U64',
  40: 'JUMP',
  50: 'JUMP_IND',
  51: 'LOAD_IMM',
  52: 'LOAD_U8',
  53: 'LOAD_I8',
  54: 'LOAD_U16',
  55: 'LOAD_I16',
  56: 'LOAD_U32',
  57: 'LOAD_I32',
  58: 'LOAD_U64',
  59: 'STORE_U8',
  60: 'STORE_U16',
  61: 'STORE_U32',
  62: 'STORE_U64',
  70: 'STORE_IMM_IND_U8',
  71: 'STORE_IMM_IND_U16',
  72: 'STORE_IMM_IND_U32',
  73: 'STORE_IMM_IND_U64',
  80: 'LOAD_IMM_JUMP',
  81: 'BRANCH_EQ_IMM',
  82: 'BRANCH_NE_IMM',
  83: 'BRANCH_LT_U_IMM',
  84: 'BRANCH_LE_U_IMM',
  85: 'BRANCH_GE_U_IMM',
  86: 'BRANCH_GT_U_IMM',
  87: 'BRANCH_LT_S_IMM',
  88: 'BRANCH_LE_S_IMM',
  89: 'BRANCH_GE_S_IMM',
  90: 'BRANCH_GT_S_IMM',
  100: 'MOVE_REG',
  101: 'SBRK',
  149: 'ADD_IMM_64',
  180: 'LOAD_IMM_JUMP_IND',
}

function getOpcodeName(opcode: number): string {
  return OPCODE_NAMES[opcode] ?? `opcode_${opcode}`
}

export interface ExecuteTestVectorOptions {
  /** When true, run step-by-step and log each instruction (pc, opcode, name) to console. */
  trace?: boolean
}

/**
 * Execute a test vector using the Rust native PVM binding.
 * Same signature as executeTestVector in pvm-assemblyscript/tests/test-vector-helper.ts.
 * When options.trace is true, logs each executed instruction to console.
 */
export async function executeTestVectorRust(
  testVector: PVMTestVector,
  options: ExecuteTestVectorOptions = {},
): Promise<{
  registers: Uint8Array
  pc: number
  gas: number
  status: string
  faultAddress: bigint | null
  memory: Map<bigint, number>
  parseResult: {
    instructions: Array<{ opcode: bigint; operands: Uint8Array; pc: bigint }>
    jumpTable: bigint[]
    bitmask: Uint8Array
    success: boolean
  }
}> {
  const native = loadNative()
  native.reset()
  native.init(native.getRamTypeSimpleRam())

  const programBytes = testVector.program.map(Number)
  const programBlob = Buffer.from(programBytes)

  native.prepareBlob(programBlob)

  const initialRegisters = new Uint8Array(104)
  const initialRegisterView = new DataView(initialRegisters.buffer)
  for (let i = 0; i < 13; i++) {
    const value = BigInt(String(testVector['initial-regs'][i]))
    initialRegisterView.setBigUint64(i * 8, value, true)
  }
  native.setRegisters(Buffer.from(initialRegisters))
  native.setGasLeft(Number(testVector['initial-gas']))
  native.setNextProgramCounter(Number(testVector['initial-pc']))

  if (testVector['initial-page-map']) {
    for (const page of testVector['initial-page-map']) {
      const address = Number(page.address)
      const length = Number(page.length)
      const accessType = page['is-writable'] ? 2 : 1
      native.initPage(address, length, accessType)
    }
  }

  if (testVector['initial-memory']) {
    for (const memBlock of testVector['initial-memory']) {
      const address = Number(memBlock.address)
      const contents = memBlock.contents.map(Number)
      native.setMemory(address, Buffer.from(contents))
    }
  }

  const trace = options.trace === true
  if (trace) {
    const codeBuf = native.getCode()
    const bitmaskBuf = native.getBitmask()
    const code = new Uint8Array(codeBuf.buffer, codeBuf.byteOffset, codeBuf.byteLength)
    const bitmask = new Uint8Array(
      bitmaskBuf.buffer,
      bitmaskBuf.byteOffset,
      bitmaskBuf.byteLength,
    )
    let step = 0
    for (;;) {
      const pcBefore = native.getProgramCounter()
      const skip = fskip(pcBefore, bitmask)
      const opcode = code[pcBefore] ?? 0
      const name = getOpcodeName(opcode)
      const operandsLen = Math.min(skip, Math.max(0, code.length - pcBefore - 1))
      const operandsHex =
        operandsLen > 0
          ? Array.from(code.slice(pcBefore + 1, pcBefore + 1 + operandsLen))
              .map((b) => b.toString(16).padStart(2, '0'))
              .join(' ')
          : ''
      console.log(
        `  [${step}] pc=${pcBefore} opcode=${opcode} (${name}) fskip=${skip} operands=[${operandsHex}]`,
      )
      if (!native.nextStep()) break
      step++
    }
    const finalPc = native.getProgramCounter()
    const finalStatus = native.getStatus()
    const statusNames: Record<number, string> = {
      0: 'halt',
      1: 'halt',
      2: 'panic',
      3: 'page-fault',
      4: 'host',
      5: 'out-of-gas',
    }
    console.log(`  stopped pc=${finalPc} status=${statusNames[finalStatus] ?? finalStatus}`)
  } else {
    while (native.nextStep()) {}
  }

  const finalRegisters = native.getRegisters()
  const finalPC = native.getProgramCounter()
  const finalGas = native.getGasLeft()
  const statusCode = native.getStatus()
  const exitArg = native.getExitArg()

  const statusMap: Record<number, string> = {
    0: 'halt',
    1: 'halt',
    2: 'panic',
    3: 'page-fault',
    4: 'host',
    5: 'out-of-gas',
  }
  const status = statusMap[statusCode] ?? 'panic'

  const finalMemory = new Map<bigint, number>()
  if (testVector['expected-memory']) {
    for (const memBlock of testVector['expected-memory']) {
      const address = Number(memBlock.address)
      const length = memBlock.contents.length
      const pageIndex = Math.floor(address / PAGE_SIZE)
      const pageData = native.getPageDump(pageIndex)
      if (pageData && pageData.length > 0) {
        for (let i = 0; i < length; i++) {
          const addr = address + i
          const pageIdx = Math.floor(addr / PAGE_SIZE)
          const offset = addr % PAGE_SIZE
          if (pageIdx === pageIndex) {
            finalMemory.set(BigInt(addr), pageData[offset])
          } else {
            const otherPage = native.getPageDump(pageIdx)
            if (otherPage?.length) finalMemory.set(BigInt(addr), otherPage[offset])
          }
        }
      }
    }
  }

  const faultAddress: bigint | null =
    statusCode === 3 ? (exitArg !== 0 ? BigInt(exitArg) : null) : null

  return {
    registers: new Uint8Array(
      finalRegisters.buffer,
      finalRegisters.byteOffset,
      finalRegisters.byteLength,
    ),
    pc: finalPC,
    gas: finalGas,
    status,
    faultAddress,
    memory: finalMemory,
    parseResult: {
      instructions: [],
      jumpTable: [],
      bitmask: new Uint8Array(0),
      success: false,
    },
  }
}
