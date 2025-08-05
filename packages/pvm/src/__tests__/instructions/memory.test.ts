import { beforeEach, describe, expect, it } from 'vitest'
import { RESULT_CODES } from '../../config'
import { InstructionRegistry } from '../../instructions/registry'

describe('Memory Instructions', () => {
  let registry: InstructionRegistry

  beforeEach(() => {
    registry = InstructionRegistry.getInstance()
  })

  describe('Load Instructions', () => {
    describe('LOAD_U8', () => {
      it('should load unsigned 8-bit value from memory', () => {
        const handler = registry.getHandler(0x52)!
        const memoryCells = new Map()
        memoryCells.set(100, 0x42)

        const context = {
          instruction: { opcode: 0x52, operands: [0, 100], address: 0 },
          instructionPointer: 0,
          gasCounter: 100n,
          registers: {
            r0: 0n,
            r1: 0n,
            r2: 0n,
            r3: 0n,
            r4: 0n,
            r5: 0n,
            r6: 0n,
            r7: 0n,
            r8: 0,
            r9: 0,
            r10: 0,
            r11: 0,
            r12: 0,
          },
          ram: {
            cells: memoryCells,
            readOctet: (addr: number) => memoryCells.get(addr) || 0,
            writeOctet: (addr: number, value: number) =>
              memoryCells.set(addr, value),
            readOctets: (addr: number, count: number) =>
              Array.from(
                { length: count },
                (_, i) => memoryCells.get(addr + i) || 0,
              ),
            writeOctets: (addr: number, values: number[]) =>
              values.forEach((v, i) => memoryCells.set(addr + i, v)),
            isReadable: () => true,
            isWritable: () => true,
            getMemoryLayout: () => ({
              stackStart: 0,
              heapStart: 0,
              totalSize: 0,
            }),
          },
          callStack: {
            frames: [],
            pushFrame: () => {},
            popFrame: () => undefined,
            getCurrentFrame: () => undefined,
            isEmpty: () => true,
            getDepth: () => 0,
          },
          stackPointer: 0,
        }

        const result = handler.execute(context)
        expect(result.resultCode).toBe(RESULT_CODES.HALT)
        expect(result.newInstructionPointer).toBe(1)
        expect(result.newRegisters!.r0).toBe(0x42n)
      })
    })

    describe('LOAD_I8', () => {
      it('should load signed 8-bit value from memory', () => {
        const handler = registry.getHandler(0x53)!
        const memoryCells = new Map()
        memoryCells.set(100, 0xfe) // -2 in signed 8-bit

        const context = {
          instruction: { opcode: 0x53, operands: [0, 100], address: 0 },
          instructionPointer: 0,
          gasCounter: 100n,
          registers: {
            r0: 0n,
            r1: 0n,
            r2: 0n,
            r3: 0n,
            r4: 0n,
            r5: 0n,
            r6: 0n,
            r7: 0n,
            r8: 0,
            r9: 0,
            r10: 0,
            r11: 0,
            r12: 0,
          },
          ram: {
            cells: memoryCells,
            readOctet: (addr: number) => memoryCells.get(addr) || 0,
            writeOctet: (addr: number, value: number) =>
              memoryCells.set(addr, value),
            readOctets: (addr: number, count: number) =>
              Array.from(
                { length: count },
                (_, i) => memoryCells.get(addr + i) || 0,
              ),
            writeOctets: (addr: number, values: number[]) =>
              values.forEach((v, i) => memoryCells.set(addr + i, v)),
            isReadable: () => true,
            isWritable: () => true,
            getMemoryLayout: () => ({
              stackStart: 0,
              heapStart: 0,
              totalSize: 0,
            }),
          },
          callStack: {
            frames: [],
            pushFrame: () => {},
            popFrame: () => undefined,
            getCurrentFrame: () => undefined,
            isEmpty: () => true,
            getDepth: () => 0,
          },
          stackPointer: 0,
        }

        const result = handler.execute(context)
        expect(result.resultCode).toBe(RESULT_CODES.HALT)
        expect(result.newInstructionPointer).toBe(1)
        expect(result.newRegisters!.r0).toBe(-2n) // Sign extended
      })
    })

    describe('LOAD_U16', () => {
      it('should load unsigned 16-bit value from memory', () => {
        const handler = registry.getHandler(0x54)!
        const memoryCells = new Map()
        memoryCells.set(100, 0x34) // Little endian: 0x1234
        memoryCells.set(101, 0x12)

        const context = {
          instruction: { opcode: 0x54, operands: [0, 100], address: 0 },
          instructionPointer: 0,
          gasCounter: 100n,
          registers: {
            r0: 0n,
            r1: 0n,
            r2: 0n,
            r3: 0n,
            r4: 0n,
            r5: 0n,
            r6: 0n,
            r7: 0n,
            r8: 0,
            r9: 0,
            r10: 0,
            r11: 0,
            r12: 0,
          },
          ram: {
            cells: memoryCells,
            readOctet: (addr: number) => memoryCells.get(addr) || 0,
            writeOctet: (addr: number, value: number) =>
              memoryCells.set(addr, value),
            readOctets: (addr: number, count: number) =>
              Array.from(
                { length: count },
                (_, i) => memoryCells.get(addr + i) || 0,
              ),
            writeOctets: (addr: number, values: number[]) =>
              values.forEach((v, i) => memoryCells.set(addr + i, v)),
            isReadable: () => true,
            isWritable: () => true,
            getMemoryLayout: () => ({
              stackStart: 0,
              heapStart: 0,
              totalSize: 0,
            }),
          },
          callStack: {
            frames: [],
            pushFrame: () => {},
            popFrame: () => undefined,
            getCurrentFrame: () => undefined,
            isEmpty: () => true,
            getDepth: () => 0,
          },
          stackPointer: 0,
        }

        const result = handler.execute(context)
        expect(result.resultCode).toBe(RESULT_CODES.HALT)
        expect(result.newInstructionPointer).toBe(1)
        expect(result.newRegisters!.r0).toBe(0x1234n)
      })
    })

    describe('LOAD_U32', () => {
      it('should load unsigned 32-bit value from memory', () => {
        const handler = registry.getHandler(0x56)!
        const memoryCells = new Map()
        memoryCells.set(100, 0x78) // Little endian: 0x12345678
        memoryCells.set(101, 0x56)
        memoryCells.set(102, 0x34)
        memoryCells.set(103, 0x12)

        const context = {
          instruction: { opcode: 0x56, operands: [0, 100], address: 0 },
          instructionPointer: 0,
          gasCounter: 100n,
          registers: {
            r0: 0n,
            r1: 0n,
            r2: 0n,
            r3: 0n,
            r4: 0n,
            r5: 0n,
            r6: 0n,
            r7: 0n,
            r8: 0,
            r9: 0,
            r10: 0,
            r11: 0,
            r12: 0,
          },
          ram: {
            cells: memoryCells,
            readOctet: (addr: number) => memoryCells.get(addr) || 0,
            writeOctet: (addr: number, value: number) =>
              memoryCells.set(addr, value),
            readOctets: (addr: number, count: number) =>
              Array.from(
                { length: count },
                (_, i) => memoryCells.get(addr + i) || 0,
              ),
            writeOctets: (addr: number, values: number[]) =>
              values.forEach((v, i) => memoryCells.set(addr + i, v)),
            isReadable: () => true,
            isWritable: () => true,
            getMemoryLayout: () => ({
              stackStart: 0,
              heapStart: 0,
              totalSize: 0,
            }),
          },
          callStack: {
            frames: [],
            pushFrame: () => {},
            popFrame: () => undefined,
            getCurrentFrame: () => undefined,
            isEmpty: () => true,
            getDepth: () => 0,
          },
          stackPointer: 0,
        }

        const result = handler.execute(context)
        expect(result.resultCode).toBe(RESULT_CODES.HALT)
        expect(result.newInstructionPointer).toBe(1)
        expect(result.newRegisters!.r0).toBe(0x12345678n)
      })
    })

    describe('LOAD_U64', () => {
      it('should load unsigned 64-bit value from memory', () => {
        const handler = registry.getHandler(0x58)!
        const memoryCells = new Map()
        memoryCells.set(100, 0xef) // Little endian: 0x123456789ABCDEF0
        memoryCells.set(101, 0xcd)
        memoryCells.set(102, 0xab)
        memoryCells.set(103, 0x89)
        memoryCells.set(104, 0x67)
        memoryCells.set(105, 0x45)
        memoryCells.set(106, 0x23)
        memoryCells.set(107, 0x01)

        const context = {
          instruction: { opcode: 0x58, operands: [0, 100], address: 0 },
          instructionPointer: 0,
          gasCounter: 100n,
          registers: {
            r0: 0n,
            r1: 0n,
            r2: 0n,
            r3: 0n,
            r4: 0n,
            r5: 0n,
            r6: 0n,
            r7: 0n,
            r8: 0,
            r9: 0,
            r10: 0,
            r11: 0,
            r12: 0,
          },
          ram: {
            cells: memoryCells,
            readOctet: (addr: number) => memoryCells.get(addr) || 0,
            writeOctet: (addr: number, value: number) =>
              memoryCells.set(addr, value),
            readOctets: (addr: number, count: number) =>
              Array.from(
                { length: count },
                (_, i) => memoryCells.get(addr + i) || 0,
              ),
            writeOctets: (addr: number, values: number[]) =>
              values.forEach((v, i) => memoryCells.set(addr + i, v)),
            isReadable: () => true,
            isWritable: () => true,
            getMemoryLayout: () => ({
              stackStart: 0,
              heapStart: 0,
              totalSize: 0,
            }),
          },
          callStack: {
            frames: [],
            pushFrame: () => {},
            popFrame: () => undefined,
            getCurrentFrame: () => undefined,
            isEmpty: () => true,
            getDepth: () => 0,
          },
          stackPointer: 0,
        }

        const result = handler.execute(context)
        expect(result.resultCode).toBe(RESULT_CODES.HALT)
        expect(result.newInstructionPointer).toBe(1)
        expect(result.newRegisters!.r0).toBe(0x123456789abcdef0n)
      })
    })
  })

  describe('Store Instructions', () => {
    describe('STORE_U8', () => {
      it('should store 8-bit value to memory', () => {
        const handler = registry.getHandler(0x59)!
        const memoryCells = new Map()

        const context = {
          instruction: { opcode: 0x59, operands: [0, 100], address: 0 },
          instructionPointer: 0,
          gasCounter: 100n,
          registers: {
            r0: 0x42n,
            r1: 0n,
            r2: 0n,
            r3: 0n,
            r4: 0n,
            r5: 0n,
            r6: 0n,
            r7: 0n,
            r8: 0,
            r9: 0,
            r10: 0,
            r11: 0,
            r12: 0,
          },
          ram: {
            cells: memoryCells,
            readOctet: (addr: number) => memoryCells.get(addr) || 0,
            writeOctet: (addr: number, value: number) =>
              memoryCells.set(addr, value),
            readOctets: (addr: number, count: number) =>
              Array.from(
                { length: count },
                (_, i) => memoryCells.get(addr + i) || 0,
              ),
            writeOctets: (addr: number, values: number[]) =>
              values.forEach((v, i) => memoryCells.set(addr + i, v)),
            isReadable: () => true,
            isWritable: () => true,
            getMemoryLayout: () => ({
              stackStart: 0,
              heapStart: 0,
              totalSize: 0,
            }),
          },
          callStack: {
            frames: [],
            pushFrame: () => {},
            popFrame: () => undefined,
            getCurrentFrame: () => undefined,
            isEmpty: () => true,
            getDepth: () => 0,
          },
          stackPointer: 0,
        }

        const result = handler.execute(context)
        expect(result.resultCode).toBe(RESULT_CODES.HALT)
        expect(result.newInstructionPointer).toBe(1)
        expect(memoryCells.get(100)).toBe(0x42)
      })
    })

    describe('STORE_U16', () => {
      it('should store 16-bit value to memory', () => {
        const handler = registry.getHandler(0x5a)!
        const memoryCells = new Map()

        const context = {
          instruction: { opcode: 0x5a, operands: [0, 100], address: 0 },
          instructionPointer: 0,
          gasCounter: 100n,
          registers: {
            r0: 0x1234n,
            r1: 0n,
            r2: 0n,
            r3: 0n,
            r4: 0n,
            r5: 0n,
            r6: 0n,
            r7: 0n,
            r8: 0,
            r9: 0,
            r10: 0,
            r11: 0,
            r12: 0,
          },
          ram: {
            cells: memoryCells,
            readOctet: (addr: number) => memoryCells.get(addr) || 0,
            writeOctet: (addr: number, value: number) =>
              memoryCells.set(addr, value),
            readOctets: (addr: number, count: number) =>
              Array.from(
                { length: count },
                (_, i) => memoryCells.get(addr + i) || 0,
              ),
            writeOctets: (addr: number, values: number[]) =>
              values.forEach((v, i) => memoryCells.set(addr + i, v)),
            isReadable: () => true,
            isWritable: () => true,
            getMemoryLayout: () => ({
              stackStart: 0,
              heapStart: 0,
              totalSize: 0,
            }),
          },
          callStack: {
            frames: [],
            pushFrame: () => {},
            popFrame: () => undefined,
            getCurrentFrame: () => undefined,
            isEmpty: () => true,
            getDepth: () => 0,
          },
          stackPointer: 0,
        }

        const result = handler.execute(context)
        expect(result.resultCode).toBe(RESULT_CODES.HALT)
        expect(result.newInstructionPointer).toBe(1)
        expect(memoryCells.get(100)).toBe(0x34) // Little endian
        expect(memoryCells.get(101)).toBe(0x12)
      })
    })

    describe('STORE_U32', () => {
      it('should store 32-bit value to memory', () => {
        const handler = registry.getHandler(0x5b)!
        const memoryCells = new Map()

        const context = {
          instruction: { opcode: 0x5b, operands: [0, 100], address: 0 },
          instructionPointer: 0,
          gasCounter: 100n,
          registers: {
            r0: 0x12345678n,
            r1: 0n,
            r2: 0n,
            r3: 0n,
            r4: 0n,
            r5: 0n,
            r6: 0n,
            r7: 0n,
            r8: 0,
            r9: 0,
            r10: 0,
            r11: 0,
            r12: 0,
          },
          ram: {
            cells: memoryCells,
            readOctet: (addr: number) => memoryCells.get(addr) || 0,
            writeOctet: (addr: number, value: number) =>
              memoryCells.set(addr, value),
            readOctets: (addr: number, count: number) =>
              Array.from(
                { length: count },
                (_, i) => memoryCells.get(addr + i) || 0,
              ),
            writeOctets: (addr: number, values: number[]) =>
              values.forEach((v, i) => memoryCells.set(addr + i, v)),
            isReadable: () => true,
            isWritable: () => true,
            getMemoryLayout: () => ({
              stackStart: 0,
              heapStart: 0,
              totalSize: 0,
            }),
          },
          callStack: {
            frames: [],
            pushFrame: () => {},
            popFrame: () => undefined,
            getCurrentFrame: () => undefined,
            isEmpty: () => true,
            getDepth: () => 0,
          },
          stackPointer: 0,
        }

        const result = handler.execute(context)
        expect(result.resultCode).toBe(RESULT_CODES.HALT)
        expect(result.newInstructionPointer).toBe(1)
        expect(memoryCells.get(100)).toBe(0x78) // Little endian
        expect(memoryCells.get(101)).toBe(0x56)
        expect(memoryCells.get(102)).toBe(0x34)
        expect(memoryCells.get(103)).toBe(0x12)
      })
    })

    describe('STORE_U64', () => {
      it('should store 64-bit value to memory', () => {
        const handler = registry.getHandler(0x5c)!
        const memoryCells = new Map()

        const context = {
          instruction: { opcode: 0x5c, operands: [0, 100], address: 0 },
          instructionPointer: 0,
          gasCounter: 100n,
          registers: {
            r0: 0x123456789abcdef0n,
            r1: 0n,
            r2: 0n,
            r3: 0n,
            r4: 0n,
            r5: 0n,
            r6: 0n,
            r7: 0n,
            r8: 0,
            r9: 0,
            r10: 0,
            r11: 0,
            r12: 0,
          },
          ram: {
            cells: memoryCells,
            readOctet: (addr: number) => memoryCells.get(addr) || 0,
            writeOctet: (addr: number, value: number) =>
              memoryCells.set(addr, value),
            readOctets: (addr: number, count: number) =>
              Array.from(
                { length: count },
                (_, i) => memoryCells.get(addr + i) || 0,
              ),
            writeOctets: (addr: number, values: number[]) =>
              values.forEach((v, i) => memoryCells.set(addr + i, v)),
            isReadable: () => true,
            isWritable: () => true,
            getMemoryLayout: () => ({
              stackStart: 0,
              heapStart: 0,
              totalSize: 0,
            }),
          },
          callStack: {
            frames: [],
            pushFrame: () => {},
            popFrame: () => undefined,
            getCurrentFrame: () => undefined,
            isEmpty: () => true,
            getDepth: () => 0,
          },
          stackPointer: 0,
        }

        const result = handler.execute(context)
        expect(result.resultCode).toBe(RESULT_CODES.HALT)
        expect(result.newInstructionPointer).toBe(1)
        expect(memoryCells.get(100)).toBe(0xf0) // Little endian
        expect(memoryCells.get(101)).toBe(0xde)
        expect(memoryCells.get(102)).toBe(0xbc)
        expect(memoryCells.get(103)).toBe(0x9a)
        expect(memoryCells.get(104)).toBe(0x78)
        expect(memoryCells.get(105)).toBe(0x56)
        expect(memoryCells.get(106)).toBe(0x34)
        expect(memoryCells.get(107)).toBe(0x12)
      })
    })
  })

  describe('Indirect Memory Operations', () => {
    describe('LOAD_IND_U8', () => {
      it('should load unsigned 8-bit value from register + immediate address', () => {
        const handler = registry.getHandler(0x124)!
        const memoryCells = new Map()
        memoryCells.set(110, 0x42) // Base address 100 + offset 10

        const context = {
          instruction: { opcode: 0x124, operands: [0, 1, 10], address: 0 },
          instructionPointer: 0,
          gasCounter: 100n,
          registers: {
            r0: 0n,
            r1: 100n,
            r2: 0n,
            r3: 0n,
            r4: 0n,
            r5: 0n,
            r6: 0n,
            r7: 0n,
            r8: 0,
            r9: 0,
            r10: 0,
            r11: 0,
            r12: 0,
          },
          ram: {
            cells: memoryCells,
            readOctet: (addr: number) => memoryCells.get(addr) || 0,
            writeOctet: (addr: number, value: number) =>
              memoryCells.set(addr, value),
            readOctets: (addr: number, count: number) =>
              Array.from(
                { length: count },
                (_, i) => memoryCells.get(addr + i) || 0,
              ),
            writeOctets: (addr: number, values: number[]) =>
              values.forEach((v, i) => memoryCells.set(addr + i, v)),
            isReadable: () => true,
            isWritable: () => true,
            getMemoryLayout: () => ({
              stackStart: 0,
              heapStart: 0,
              totalSize: 0,
            }),
          },
          callStack: {
            frames: [],
            pushFrame: () => {},
            popFrame: () => undefined,
            getCurrentFrame: () => undefined,
            isEmpty: () => true,
            getDepth: () => 0,
          },
          stackPointer: 0,
        }

        const result = handler.execute(context)
        expect(result.resultCode).toBe(RESULT_CODES.HALT)
        expect(result.newInstructionPointer).toBe(1)
        expect(result.newRegisters!.r0).toBe(0x42n)
      })
    })

    describe('STORE_IND_U8', () => {
      it('should store 8-bit value to register + immediate address', () => {
        const handler = registry.getHandler(0x120)!
        const memoryCells = new Map()

        const context = {
          instruction: { opcode: 0x120, operands: [0, 1, 10], address: 0 },
          instructionPointer: 0,
          gasCounter: 100n,
          registers: {
            r0: 0x42n,
            r1: 100n,
            r2: 0n,
            r3: 0n,
            r4: 0n,
            r5: 0n,
            r6: 0n,
            r7: 0n,
            r8: 0,
            r9: 0,
            r10: 0,
            r11: 0,
            r12: 0,
          },
          ram: {
            cells: memoryCells,
            readOctet: (addr: number) => memoryCells.get(addr) || 0,
            writeOctet: (addr: number, value: number) =>
              memoryCells.set(addr, value),
            readOctets: (addr: number, count: number) =>
              Array.from(
                { length: count },
                (_, i) => memoryCells.get(addr + i) || 0,
              ),
            writeOctets: (addr: number, values: number[]) =>
              values.forEach((v, i) => memoryCells.set(addr + i, v)),
            isReadable: () => true,
            isWritable: () => true,
            getMemoryLayout: () => ({
              stackStart: 0,
              heapStart: 0,
              totalSize: 0,
            }),
          },
          callStack: {
            frames: [],
            pushFrame: () => {},
            popFrame: () => undefined,
            getCurrentFrame: () => undefined,
            isEmpty: () => true,
            getDepth: () => 0,
          },
          stackPointer: 0,
        }

        const result = handler.execute(context)
        expect(result.resultCode).toBe(RESULT_CODES.HALT)
        expect(result.newInstructionPointer).toBe(1)
        expect(memoryCells.get(110)).toBe(0x42) // Base address 100 + offset 10
      })
    })
  })

  describe('Immediate Store Instructions', () => {
    describe('STORE_IMM_U8', () => {
      it('should store immediate 8-bit value to memory', () => {
        const handler = registry.getHandler(0x30)!
        const memoryCells = new Map()

        const context = {
          instruction: { opcode: 0x30, operands: [100, 0x42], address: 0 },
          instructionPointer: 0,
          gasCounter: 100n,
          registers: {
            r0: 0n,
            r1: 0n,
            r2: 0n,
            r3: 0n,
            r4: 0n,
            r5: 0n,
            r6: 0n,
            r7: 0n,
            r8: 0,
            r9: 0,
            r10: 0,
            r11: 0,
            r12: 0,
          },
          ram: {
            cells: memoryCells,
            readOctet: (addr: number) => memoryCells.get(addr) || 0,
            writeOctet: (addr: number, value: number) =>
              memoryCells.set(addr, value),
            readOctets: (addr: number, count: number) =>
              Array.from(
                { length: count },
                (_, i) => memoryCells.get(addr + i) || 0,
              ),
            writeOctets: (addr: number, values: number[]) =>
              values.forEach((v, i) => memoryCells.set(addr + i, v)),
            isReadable: () => true,
            isWritable: () => true,
            getMemoryLayout: () => ({
              stackStart: 0,
              heapStart: 0,
              totalSize: 0,
            }),
          },
          callStack: {
            frames: [],
            pushFrame: () => {},
            popFrame: () => undefined,
            getCurrentFrame: () => undefined,
            isEmpty: () => true,
            getDepth: () => 0,
          },
          stackPointer: 0,
        }

        const result = handler.execute(context)
        expect(result.resultCode).toBe(RESULT_CODES.HALT)
        expect(result.newInstructionPointer).toBe(1)
        expect(memoryCells.get(100)).toBe(0x42)
      })
    })

    describe('STORE_IMM_U16', () => {
      it('should store immediate 16-bit value to memory', () => {
        const handler = registry.getHandler(0x31)!
        const memoryCells = new Map()

        const context = {
          instruction: {
            opcode: 0x31,
            operands: [100, 0x34, 0x12],
            address: 0,
          },
          instructionPointer: 0,
          gasCounter: 100n,
          registers: {
            r0: 0n,
            r1: 0n,
            r2: 0n,
            r3: 0n,
            r4: 0n,
            r5: 0n,
            r6: 0n,
            r7: 0n,
            r8: 0,
            r9: 0,
            r10: 0,
            r11: 0,
            r12: 0,
          },
          ram: {
            cells: memoryCells,
            readOctet: (addr: number) => memoryCells.get(addr) || 0,
            writeOctet: (addr: number, value: number) =>
              memoryCells.set(addr, value),
            readOctets: (addr: number, count: number) =>
              Array.from(
                { length: count },
                (_, i) => memoryCells.get(addr + i) || 0,
              ),
            writeOctets: (addr: number, values: number[]) =>
              values.forEach((v, i) => memoryCells.set(addr + i, v)),
            isReadable: () => true,
            isWritable: () => true,
            getMemoryLayout: () => ({
              stackStart: 0,
              heapStart: 0,
              totalSize: 0,
            }),
          },
          callStack: {
            frames: [],
            pushFrame: () => {},
            popFrame: () => undefined,
            getCurrentFrame: () => undefined,
            isEmpty: () => true,
            getDepth: () => 0,
          },
          stackPointer: 0,
        }

        const result = handler.execute(context)
        expect(result.resultCode).toBe(RESULT_CODES.HALT)
        expect(result.newInstructionPointer).toBe(1)
        expect(memoryCells.get(100)).toBe(0x34) // Little endian
        expect(memoryCells.get(101)).toBe(0x12)
      })
    })
  })
})
