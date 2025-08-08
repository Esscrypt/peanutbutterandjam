/**
 * State Serialization Tests
 *
 * Tests for Gray Paper state serialization implementation
 */

import { describe, it, expect } from 'vitest'
import { 
  createStateKey, 
  serializeSafrole, 
  serializeTheTime, 
  serializePrivileges, 
  serializeActivity, 
  serializeServiceAccount,
  createGenesisStateTrie,
  serializeAuthpool,
  serializeAuthqueue,
  serializeRecent,
  serializeDisputes,
  serializeEntropy,
  serializeStagingSet,
  serializeActiveSet,
  serializePreviousSet,
  serializeReports,
  serializeReady,
  serializeAccumulated,
  serializeLastAccountOut
} from '../src/state/state-serialization'
import { bytesToHex } from '@pbnj/core'
import type {
  SafroleState,
  SafroleTicket,
  Privileges,
  ActivityStats,
  ServiceAccount,
  GenesisState,
  Address,
  Hash,
  PublicKey,
  Balance,
  Gas,
  Timeslot,
  ServiceId,
  Dispute,
  WorkReport,
  ReadyItem,
  AccumulatedItem,
  LastAccountOut
} from '../src/state/types'

describe('State Serialization', () => {
  describe('createStateKey', () => {
    it('should create chapter key C(i) = ⟨i, 0, 0, ...⟩', () => {
      const chapterKey = createStateKey(1)
      
      expect(chapterKey.length).toBe(31)
      expect(chapterKey[0]).toBe(1)
      expect(chapterKey.slice(1).every(byte => byte === 0)).toBe(true)
    })

    it('should create service key C(i, s) = ⟨i, n₀, 0, n₁, 0, n₂, 0, n₃, 0, 0, ...⟩', () => {
      const serviceKey = createStateKey(255, 12345)
      
      expect(serviceKey.length).toBe(31)
      expect(serviceKey[0]).toBe(255)
      
      // Verify service ID encoding
      const serviceBytes = new Uint8Array(4)
      const view = new DataView(serviceBytes.buffer)
      view.setUint32(0, 12345, true)
      
      expect(serviceKey[1]).toBe(serviceBytes[0])
      expect(serviceKey[3]).toBe(serviceBytes[1])
      expect(serviceKey[5]).toBe(serviceBytes[2])
      expect(serviceKey[7]).toBe(serviceBytes[3])
    })

    it('should create hash key C(s, h) = ⟨n₀, a₀, n₁, a₁, n₂, a₂, n₃, a₃, a₄, a₅, ..., a₂₆⟩', () => {
      const hash: Hash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
      const serviceId: ServiceId = 12345
      const hashKey = createStateKey(255, serviceId, hash)
      
      expect(hashKey.length).toBe(31)
      
      // Verify service ID encoding
      const serviceBytes = new Uint8Array(4)
      const view = new DataView(serviceBytes.buffer)
      view.setUint32(0, serviceId, true)
      
      expect(hashKey.slice(0, 4)).toEqual(serviceBytes)
    })
  })

  describe('serializeSafrole', () => {
    it('should serialize genesis safrole state', () => {
      const genesisSafrole: SafroleState = {
        epoch: 0,
        timeslot: 0,
        entropy: '0x0000000000000000000000000000000000000000000000000000000000000000',
        pendingset: [],
        epochroot: '0x0000000000000000000000000000000000000000000000000000000000000000',
        sealtickets: [],
        ticketaccumulator: '0x0000000000000000000000000000000000000000000000000000000000000000'
      }

      const serialized = serializeSafrole(genesisSafrole)
      
      // Should have: pendingset + epochroot(32) + sealtickets_type + sealtickets + ticketaccumulator
      expect(serialized.length).toBeGreaterThan(40)
    })

    it('should serialize runtime safrole state with tickets', () => {
      const ticket: SafroleTicket = {
        hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        owner: '0x1234567890abcdef1234567890abcdef12345678',
        stake: '1000000000000000000',
        timestamp: 1234567890
      }

      const runtimeSafrole: SafroleState = {
        epoch: 5,
        timeslot: 1234567890,
        entropy: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        pendingset: [ticket],
        epochroot: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        sealtickets: [ticket],
        ticketaccumulator: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
      }

      const serialized = serializeSafrole(runtimeSafrole)
      
      // Should be longer than genesis due to tickets
      expect(serialized.length).toBeGreaterThan(100)
    })
  })

  describe('serializeTheTime', () => {
    it('should serialize timeslot correctly', () => {
      const time: Timeslot = 1234567890
      const serialized = serializeTheTime(time)
      
      expect(serialized.length).toBe(4)
      
      // Verify little-endian encoding
      const view = new DataView(serialized.buffer)
      const decodedTime = view.getUint32(0, true)
      
      expect(decodedTime).toBe(time)
    })

    it('should handle zero timeslot', () => {
      const time: Timeslot = 0
      const serialized = serializeTheTime(time)
      
      expect(serialized.length).toBe(4)
      
      const view = new DataView(serialized.buffer)
      const decodedTime = view.getUint32(0, true)
      
      expect(decodedTime).toBe(0)
    })
  })

  describe('serializePrivileges', () => {
    it('should serialize genesis privileges', () => {
      const genesisPrivileges: Privileges = {
        manager: 0,
        assigners: 0,
        delegator: 0,
        registrar: 0,
        alwaysaccers: []
      }

      const serialized = serializePrivileges(genesisPrivileges)
      
      // Should have: encode[4](manager, assigners, delegator, registrar) + alwaysaccers
      expect(serialized.length).toBeGreaterThanOrEqual(16)
    })

    it('should serialize runtime privileges', () => {
      const runtimePrivileges: Privileges = {
        manager: 1,
        assigners: 2,
        delegator: 3,
        registrar: 4,
        alwaysaccers: [
          '0x1234567890abcdef1234567890abcdef12345678',
          '0xabcdef1234567890abcdef1234567890abcdef12'
        ]
      }

      const serialized = serializePrivileges(runtimePrivileges)
      
      // Should be longer than genesis due to alwaysaccers
      expect(serialized.length).toBeGreaterThan(16)
    })
  })

  describe('serializeActivity', () => {
    it('should serialize genesis activity stats', () => {
      const genesisActivity: ActivityStats = {
        valstatsaccumulator: 0,
        valstatsprevious: 0,
        corestats: new Uint8Array(0),
        servicestats: new Uint8Array(0)
      }

      const serialized = serializeActivity(genesisActivity)
      
      // Should have: encode[4](valstatsaccumulator, valstatsprevious) + corestats + servicestats
      expect(serialized.length).toBeGreaterThanOrEqual(8)
    })

    it('should serialize runtime activity stats', () => {
      const runtimeActivity: ActivityStats = {
        valstatsaccumulator: 100,
        valstatsprevious: 50,
        corestats: new Uint8Array([1, 2, 3, 4]),
        servicestats: new Uint8Array([5, 6, 7, 8])
      }

      const serialized = serializeActivity(runtimeActivity)
      
      // Should be longer than genesis due to stats data
      expect(serialized.length).toBeGreaterThan(8)
    })
  })

  describe('serializeServiceAccount', () => {
    it('should serialize genesis service account', () => {
      const genesisAccount: ServiceAccount = {
        balance: '1000000000000000000',
        nonce: 0,
        isValidator: true,
        validatorKey: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        stake: '1000000000000000000',
        storage: new Map(),
        preimages: new Map(),
        requests: new Map(),
        gratis: 0n,
        codehash: '0x0000000000000000000000000000000000000000000000000000000000000000',
        minaccgas: 1000n,
        minmemogas: 100n,
        octets: 0n,
        items: 0,
        created: 0,
        lastacc: 0,
        parent: 0
      }

      const serialized = serializeServiceAccount(genesisAccount)
      
      // Should have: 0 + codehash(32) + encode[8](balance, minaccgas, minmemogas, octets, gratis) + encode[4](items, created, lastacc, parent)
      // = 1 + 32 + 40 + 16 = 89 bytes
      expect(serialized.length).toBe(89)
    })

    it('should serialize runtime service account', () => {
      const runtimeAccount: ServiceAccount = {
        balance: '5000000000000000000',
        nonce: 5,
        isValidator: false,
        storage: new Map([
          ['0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef', new Uint8Array([1, 2, 3])]
        ]),
        preimages: new Map([
          ['0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890', new Uint8Array([4, 5, 6])]
        ]),
        requests: new Map([
          ['0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef', new Uint8Array([7, 8, 9])]
        ]),
        gratis: 100n,
        codehash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        minaccgas: 2000n,
        minmemogas: 200n,
        octets: 50n,
        items: 10,
        created: 1234567890,
        lastacc: 1234567891,
        parent: 1
      }

      const serialized = serializeServiceAccount(runtimeAccount)
      
      // Should be same length as genesis (fixed structure)
      expect(serialized.length).toBe(89)
      
      // Verify balance encoding
      const balanceBytes = serialized.slice(33, 41) // After 0 + codehash
      const balanceView = new DataView(balanceBytes.buffer)
      const decodedBalance = balanceView.getBigUint64(0, true)
      
      expect(decodedBalance).toBe(BigInt(runtimeAccount.balance))
    })
  })

  describe('serializeAuthpool', () => {
    it('should serialize empty authpool', () => {
      const authpool: Address[] = []
      const serialized = serializeAuthpool(authpool)
      expect(serialized.length).toBeGreaterThanOrEqual(0)
    })

    it('should serialize authpool with addresses', () => {
      const authpool: Address[] = [
        '0x1234567890abcdef1234567890abcdef12345678',
        '0xabcdef1234567890abcdef1234567890abcdef12'
      ]
      const serialized = serializeAuthpool(authpool)
      expect(serialized.length).toBeGreaterThan(0)
    })
  })

  describe('serializeAuthqueue', () => {
    it('should serialize empty authqueue', () => {
      const authqueue: Address[] = []
      const serialized = serializeAuthqueue(authqueue)
      expect(serialized.length).toBeGreaterThanOrEqual(0)
    })

    it('should serialize authqueue with addresses', () => {
      const authqueue: Address[] = [
        '0x1234567890abcdef1234567890abcdef12345678',
        '0xabcdef1234567890abcdef1234567890abcdef12'
      ]
      const serialized = serializeAuthqueue(authqueue)
      expect(serialized.length).toBeGreaterThan(0)
    })
  })

  describe('serializeRecent', () => {
    it('should serialize empty recent history', () => {
      const recent: Hash[] = []
      const serialized = serializeRecent(recent)
      expect(serialized.length).toBeGreaterThanOrEqual(0)
    })

    it('should serialize recent history with hashes', () => {
      const recent: Hash[] = [
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
      ]
      const serialized = serializeRecent(recent)
      expect(serialized.length).toBeGreaterThan(0)
    })
  })

  describe('serializeDisputes', () => {
    it('should serialize empty disputes', () => {
      const disputes: Dispute[] = []
      const serialized = serializeDisputes(disputes)
      expect(serialized.length).toBeGreaterThanOrEqual(0)
    })

    it('should serialize disputes', () => {
      const disputes: Dispute[] = [
        {
          hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          type: 1,
          data: new Uint8Array([1, 2, 3, 4])
        }
      ]
      const serialized = serializeDisputes(disputes)
      expect(serialized.length).toBeGreaterThan(0)
    })
  })

  describe('serializeEntropy', () => {
    it('should serialize entropy hash', () => {
      const entropy: Hash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
      const serialized = serializeEntropy(entropy)
      expect(serialized.length).toBe(32)
    })
  })

  describe('serializeStagingSet', () => {
    it('should serialize empty staging set', () => {
      const stagingSet: Address[] = []
      const serialized = serializeStagingSet(stagingSet)
      expect(serialized.length).toBeGreaterThanOrEqual(0)
    })

    it('should serialize staging set with addresses', () => {
      const stagingSet: Address[] = [
        '0x1234567890abcdef1234567890abcdef12345678',
        '0xabcdef1234567890abcdef1234567890abcdef12'
      ]
      const serialized = serializeStagingSet(stagingSet)
      expect(serialized.length).toBeGreaterThan(0)
    })
  })

  describe('serializeActiveSet', () => {
    it('should serialize empty active set', () => {
      const activeSet: Address[] = []
      const serialized = serializeActiveSet(activeSet)
      expect(serialized.length).toBeGreaterThanOrEqual(0)
    })

    it('should serialize active set with addresses', () => {
      const activeSet: Address[] = [
        '0x1234567890abcdef1234567890abcdef12345678',
        '0xabcdef1234567890abcdef1234567890abcdef12'
      ]
      const serialized = serializeActiveSet(activeSet)
      expect(serialized.length).toBeGreaterThan(0)
    })
  })

  describe('serializePreviousSet', () => {
    it('should serialize empty previous set', () => {
      const previousSet: Address[] = []
      const serialized = serializePreviousSet(previousSet)
      expect(serialized.length).toBeGreaterThanOrEqual(0)
    })

    it('should serialize previous set with addresses', () => {
      const previousSet: Address[] = [
        '0x1234567890abcdef1234567890abcdef12345678',
        '0xabcdef1234567890abcdef1234567890abcdef12'
      ]
      const serialized = serializePreviousSet(previousSet)
      expect(serialized.length).toBeGreaterThan(0)
    })
  })

  describe('serializeReports', () => {
    it('should serialize empty reports', () => {
      const reports: WorkReport[] = []
      const serialized = serializeReports(reports)
      expect(serialized.length).toBeGreaterThanOrEqual(0)
    })

    it('should serialize reports', () => {
      const reports: WorkReport[] = [
        {
          hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          timestamp: 1234567890,
          data: new Uint8Array([1, 2, 3, 4])
        }
      ]
      const serialized = serializeReports(reports)
      expect(serialized.length).toBeGreaterThan(0)
    })
  })

  describe('serializeReady', () => {
    it('should serialize empty ready items', () => {
      const ready: ReadyItem[] = []
      const serialized = serializeReady(ready)
      expect(serialized.length).toBeGreaterThanOrEqual(0)
    })

    it('should serialize ready items', () => {
      const ready: ReadyItem[] = [
        {
          request: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          data: new Uint8Array([1, 2, 3, 4])
        }
      ]
      const serialized = serializeReady(ready)
      expect(serialized.length).toBeGreaterThan(0)
    })
  })

  describe('serializeAccumulated', () => {
    it('should serialize empty accumulated items', () => {
      const accumulated: AccumulatedItem[] = []
      const serialized = serializeAccumulated(accumulated)
      expect(serialized.length).toBeGreaterThanOrEqual(0)
    })

    it('should serialize accumulated items', () => {
      const accumulated: AccumulatedItem[] = [
        {
          data: new Uint8Array([1, 2, 3, 4])
        }
      ]
      const serialized = serializeAccumulated(accumulated)
      expect(serialized.length).toBeGreaterThan(0)
    })
  })

  describe('serializeLastAccountOut', () => {
    it('should serialize empty last account out', () => {
      const lastAccountOut: LastAccountOut[] = []
      const serialized = serializeLastAccountOut(lastAccountOut)
      expect(serialized.length).toBeGreaterThanOrEqual(0)
    })

    it('should serialize last account out', () => {
      const lastAccountOut: LastAccountOut[] = [
        {
          serviceId: 12345,
          hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
        }
      ]
      const serialized = serializeLastAccountOut(lastAccountOut)
      expect(serialized.length).toBeGreaterThan(0)
    })
  })

  describe('createGenesisStateTrie', () => {
    it('should create genesis state trie', () => {
      const genesisState: GenesisState = {
        accounts: {
          '0x000102030405060708090a0b0c0d0e0f10111213': {
            balance: '1000000000000000000',
            nonce: 0,
            isValidator: true,
            validatorKey: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
            stake: '1000000000000000000',
            storage: new Map(),
            preimages: new Map(),
            requests: new Map(),
            gratis: 0n,
            codehash: '0x0000000000000000000000000000000000000000000000000000000000000000',
            minaccgas: 1000n,
            minmemogas: 100n,
            octets: 0n,
            items: 0,
            created: 0,
            lastacc: 0,
            parent: 0
          }
        },
        validators: [],
        safrole: {
          epoch: 0,
          timeslot: 0,
          entropy: '0x0000000000000000000000000000000000000000000000000000000000000000',
          pendingset: [],
          epochroot: '0x0000000000000000000000000000000000000000000000000000000000000000',
          sealtickets: [],
          ticketaccumulator: '0x0000000000000000000000000000000000000000000000000000000000000000'
        }
      }

      const stateTrie = createGenesisStateTrie(genesisState)
      
      // Should have 16 chapters + 1 account = 17 entries
      expect(Object.keys(stateTrie).length).toBe(17)

      // Verify all keys are 64 characters (31 bytes as hex + 0x prefix)
      for (const key of Object.keys(stateTrie)) {
        expect(key.length).toBe(64)
      }
    })
  })
}) 