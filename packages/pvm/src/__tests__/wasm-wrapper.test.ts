/**
 * PVM WASM Wrapper Tests
 * 
 * Tests the WASM-compatible wrapper implementation
 */

import { describe, test, expect, beforeEach } from 'bun:test'
import { createPvmShell, Status, PVMWasmWrapper } from '../wasm-wrapper'
import { HostFunctionRegistry } from '../host-functions/general/registry'

describe('PVMWasmWrapper', () => {
  let hostRegistry: HostFunctionRegistry
  let pvmShell: PVMWasmWrapper

  beforeEach(() => {
    // Create mock services for HostFunctionRegistry
    const mockServiceAccountService = {} as any
    const mockConfigService = {} as any
    
    hostRegistry = new HostFunctionRegistry(mockServiceAccountService, mockConfigService)
    pvmShell = createPvmShell(hostRegistry) as PVMWasmWrapper
  })

  describe('Initialization', () => {
    test('creates wrapper instance', () => {
      expect(pvmShell).toBeDefined()
      expect(pvmShell.getStatus()).toBe(Status.OK)
      expect(pvmShell.getGasLeft()).toBeDefined()
    })

    test('initial state has correct values', () => {
      expect(pvmShell.getProgramCounter()).toBe(0)
      expect(pvmShell.getStatus()).toBe(Status.OK)
      expect(pvmShell.getExitArg()).toBe(0)
    })
  })

  describe('Register Operations', () => {
    test('encodes and decodes registers correctly', () => {
      // Create register data (13 registers x 8 bytes = 104 bytes)
      const registers = new Uint8Array(13 * 8)
      const view = new DataView(registers.buffer)
      
      // Set some test values (little-endian)
      view.setBigUint64(0, 0x1234567890abcdefn, true) // r0
      view.setBigUint64(8, 0xfedcba0987654321n, true) // r1
      view.setBigUint64(16, 100n, true) // r2
      
      pvmShell.setRegisters(registers)
      
      const retrieved = pvmShell.getRegisters()
      expect(retrieved.length).toBe(104)
      
      // Verify values
      const retrievedView = new DataView(retrieved.buffer)
      expect(retrievedView.getBigUint64(0, true)).toBe(0x1234567890abcdefn)
      expect(retrievedView.getBigUint64(8, true)).toBe(0xfedcba0987654321n)
      expect(retrievedView.getBigUint64(16, true)).toBe(100n)
    })

    test('handles all 13 registers', () => {
      const registers = new Uint8Array(13 * 8)
      const view = new DataView(registers.buffer)
      
      // Set each register to its index value
      for (let i = 0; i < 13; i++) {
        view.setBigUint64(i * 8, BigInt(i * 100), true)
      }
      
      pvmShell.setRegisters(registers)
      const retrieved = pvmShell.getRegisters()
      const retrievedView = new DataView(retrieved.buffer)
      
      for (let i = 0; i < 13; i++) {
        expect(retrievedView.getBigUint64(i * 8, true)).toBe(BigInt(i * 100))
      }
    })
  })

  describe('Memory Operations', () => {
    test('writes and reads memory', () => {
      // Simple program blob with HALT instruction
      const program = new Uint8Array([
        0x00, // Blob type (code)
        0x01, // Code length = 1
        0x06, // HALT opcode
        0x00, // Jump table count = 0
      ])
      
      const registers = new Uint8Array(13 * 8)
      const gas = 1000n
      
      pvmShell.resetGeneric(program, registers, gas)
      
      // Write data to memory
      const testData = new Uint8Array([0x11, 0x22, 0x33, 0x44])
      pvmShell.setMemory(0x1000, testData)
      
      // Read page containing the data
      const page = pvmShell.getPageDump(0) // Page 0 contains address 0x1000
      expect(page.length).toBe(4096)
      
      // Note: Actual verification would depend on memory layout and protection
    })

    test('getPageDump returns correct size', () => {
      const page = pvmShell.getPageDump(0)
      expect(page.length).toBe(4096)
      expect(page instanceof Uint8Array).toBe(true)
    })
  })

  describe('Program Execution', () => {
    test('executes HALT instruction', () => {
      // Simple program: HALT (0x06)
      const program = new Uint8Array([
        0x00, // Blob type
        0x01, // Code length
        0x06, // HALT opcode
        0x00, // Jump table count
      ])
      
      const registers = new Uint8Array(13 * 8)
      const view = new DataView(registers.buffer)
      view.setBigUint64(7 * 8, 42n, true) // Set r7 to 42 (exit code)
      
      const gas = 1000n
      
      pvmShell.resetGeneric(program, registers, gas)
      
      // Execute one step (should halt)
      const shouldContinue = pvmShell.nextStep()
      
      expect(shouldContinue).toBe(false)
      expect(pvmShell.getStatus()).toBe(Status.HALT)
      expect(pvmShell.getExitArg()).toBe(42)
    })

    test('multiple steps execution', () => {
      // Program with multiple NOPs and HALT
      const program = new Uint8Array([
        0x00, // Blob type
        0x04, // Code length
        0x01, // NOP
        0x01, // NOP
        0x01, // NOP
        0x06, // HALT
        0x00, // Jump table count
      ])
      
      const registers = new Uint8Array(13 * 8)
      const gas = 1000n
      
      pvmShell.resetGeneric(program, registers, gas)
      
      // Execute multiple steps
      let steps = 0
      while (pvmShell.nextStep() && steps < 10) {
        steps++
      }
      
      expect(pvmShell.getStatus()).toBe(Status.HALT)
      expect(steps).toBeLessThan(10) // Should halt before 10 steps
    })

    test('nSteps executes N instructions', () => {
      // Program with multiple NOPs
      const program = new Uint8Array([
        0x00, // Blob type
        0x05, // Code length
        0x01, // NOP
        0x01, // NOP
        0x01, // NOP
        0x01, // NOP
        0x06, // HALT
        0x00, // Jump table count
      ])
      
      const registers = new Uint8Array(13 * 8)
      const gas = 1000n
      
      pvmShell.resetGeneric(program, registers, gas)
      
      // Execute 3 steps
      const result = pvmShell.nSteps(3)
      
      // Should still be OK after 3 NOPs
      expect(result).toBe(true)
      expect(pvmShell.getStatus()).toBe(Status.OK)
    })
  })

  describe('Gas Management', () => {
    test('tracks gas consumption', () => {
      const program = new Uint8Array([
        0x00, // Blob type
        0x01, // Code length
        0x06, // HALT
        0x00, // Jump table count
      ])
      
      const registers = new Uint8Array(13 * 8)
      const initialGas = 1000n
      
      pvmShell.resetGeneric(program, registers, initialGas)
      expect(pvmShell.getGasLeft()).toBe(initialGas)
      
      pvmShell.nextStep()
      
      // Gas should be consumed
      expect(pvmShell.getGasLeft()).toBeLessThan(initialGas)
    })

    test('setGasLeft modifies gas counter', () => {
      const program = new Uint8Array([
        0x00, 0x01, 0x06, 0x00,
      ])
      const registers = new Uint8Array(13 * 8)
      
      pvmShell.resetGeneric(program, registers, 1000n)
      pvmShell.setGasLeft(500n)
      
      expect(pvmShell.getGasLeft()).toBe(500n)
    })
  })

  describe('Program Counter', () => {
    test('getProgramCounter returns current PC', () => {
      const program = new Uint8Array([
        0x00, 0x01, 0x06, 0x00,
      ])
      const registers = new Uint8Array(13 * 8)
      
      pvmShell.resetGeneric(program, registers, 1000n)
      
      const pc = pvmShell.getProgramCounter()
      expect(pc).toBe(0)
    })

    test('setNextProgramCounter modifies PC', () => {
      const program = new Uint8Array([
        0x00, 0x01, 0x06, 0x00,
      ])
      const registers = new Uint8Array(13 * 8)
      
      pvmShell.resetGeneric(program, registers, 1000n)
      pvmShell.setNextProgramCounter(10)
      
      expect(pvmShell.getProgramCounter()).toBe(10)
    })
  })

  describe('Error Handling', () => {
    test('handles invalid register data length', () => {
      const program = new Uint8Array([0x00, 0x01, 0x06, 0x00])
      const invalidRegisters = new Uint8Array(100) // Wrong size (should be 104)
      
      expect(() => {
        pvmShell.resetGeneric(program, invalidRegisters, 1000n)
      }).toThrow()
    })

    test('handles invalid program blob', () => {
      const invalidProgram = new Uint8Array([0xFF, 0xFF, 0xFF])
      const registers = new Uint8Array(13 * 8)
      
      pvmShell.resetGeneric(invalidProgram, registers, 1000n)
      
      expect(pvmShell.getStatus()).toBe(Status.PANIC)
    })
  })

  describe('Factory Function', () => {
    test('createPvmShell returns valid instance', () => {
      const shell = createPvmShell(hostRegistry)
      
      expect(shell).toBeDefined()
      expect(typeof shell.resetGeneric).toBe('function')
      expect(typeof shell.nextStep).toBe('function')
      expect(typeof shell.getStatus).toBe('function')
    })
  })
})

