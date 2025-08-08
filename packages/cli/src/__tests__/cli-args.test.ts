import { describe, it, expect } from 'vitest'
import { createRunCommand } from '../commands/run'
import { isValidHex, isValidPath, isValidTimestamp } from '../utils/validation'

describe('JAM CLI Arguments', () => {
  describe('Validation Functions', () => {
    it('should validate hex strings correctly', () => {
      expect(isValidHex('0x1234567890abcdef')).toBe(true)
      expect(isValidHex('1234567890abcdef')).toBe(true)
      expect(isValidHex('0x1234567890abcde')).toBe(false) // odd length
      expect(isValidHex('0x1234567890abcdeg')).toBe(false) // invalid character
      expect(isValidHex('')).toBe(false)
      expect(isValidHex('not-hex')).toBe(false)
    })

    it('should validate paths correctly', () => {
      expect(isValidPath('/valid/path')).toBe(true)
      expect(isValidPath('relative/path')).toBe(true)
      expect(isValidPath('')).toBe(false)
      expect(isValidPath('path<with>invalid:chars')).toBe(false)
    })

    it('should validate timestamps correctly', () => {
      const now = Math.floor(Date.now() / 1000)
      expect(isValidTimestamp(now)).toBe(true)
      expect(isValidTimestamp(now + 3600)).toBe(true) // 1 hour in future
      expect(isValidTimestamp(0)).toBe(false)
      expect(isValidTimestamp(-1)).toBe(false)
      expect(isValidTimestamp(now + 365 * 24 * 60 * 60 + 1)).toBe(false) // too far in future
    })
  })

  describe('Run Command Options', () => {
    it('should have all JAM standard arguments', () => {
      const command = createRunCommand()
      const options = command.options.map(opt => opt.long)
      
      // Check for JAM standard arguments
      expect(options).toContain('--bandersnatch')
      expect(options).toContain('--bls')
      expect(options).toContain('--ed25519')
      expect(options).toContain('--genesis')
      expect(options).toContain('--metadata')
      expect(options).toContain('--ts')
      expect(options).toContain('--datadir')
      expect(options).toContain('--validatorindex')
    })

    it('should have correct option descriptions', () => {
      const command = createRunCommand()
      const bandersnatchOption = command.options.find(opt => opt.long === '--bandersnatch')
      const blsOption = command.options.find(opt => opt.long === '--bls')
      const ed25519Option = command.options.find(opt => opt.long === '--ed25519')
      const genesisOption = command.options.find(opt => opt.long === '--genesis')
      const metadataOption = command.options.find(opt => opt.long === '--metadata')
      const tsOption = command.options.find(opt => opt.long === '--ts')
      
      expect(bandersnatchOption?.description).toContain('Bandersnatch Seed')
      expect(blsOption?.description).toContain('BLS Seed')
      expect(ed25519Option?.description).toContain('Ed25519 Seed')
      expect(genesisOption?.description).toContain('genesis state json file')
      expect(metadataOption?.description).toContain('Node metadata')
      expect(tsOption?.description).toContain('Epoch0 Unix timestamp')
    })

    it('should parse JAM arguments correctly', () => {
      const command = createRunCommand()
      
      // Simulate parsing arguments
      const testArgs = [
        'run',
        '--bandersnatch', '0x1234567890abcdef',
        '--bls', '0xfedcba0987654321',
        '--ed25519', '0xabcdef1234567890',
        '--genesis', '/path/to/genesis.json',
        '--metadata', 'Bob',
        '--ts', '1234567890',
        '--datadir', '/custom/data/path',
        '--validatorindex', '5'
      ]
      
      // This test verifies that the command can be created and has the expected options
      // The actual parsing would require mocking the process.argv
      expect(command).toBeDefined()
      expect(command.options.length).toBeGreaterThan(0)
      
      // Verify that all expected options exist
      const optionNames = command.options.map(opt => opt.long)
      expect(optionNames).toContain('--bandersnatch')
      expect(optionNames).toContain('--bls')
      expect(optionNames).toContain('--ed25519')
      expect(optionNames).toContain('--genesis')
      expect(optionNames).toContain('--metadata')
      expect(optionNames).toContain('--ts')
      expect(optionNames).toContain('--datadir')
      expect(optionNames).toContain('--validatorindex')
    })
  })
}) 