import { customType } from 'drizzle-orm/pg-core'
import type { Address, Hex } from 'viem'

export const evmAddress = customType<{
  data: Address
  driverData: string
}>({
  dataType() {
    return 'varchar(42)' // evm address is 42 characters
  },
  toDriver(value: Address): string {
    return value as string
  },
  fromDriver(value: string): Address {
    return value as Address
  },
})

export const hash = customType<{
  data: Hex
  driverData: string
}>({
  dataType() {
    return 'varchar(66)'
  },
  toDriver(value: Hex): string {
    return value as string
  },
  fromDriver(value: string): Hex {
    return value as Hex
  },
})

export const publicKey = customType<{
  data: Hex
  driverData: string
}>({
  dataType() {
    return 'varchar(66)'
  },
  toDriver(value: Hex): string {
    return value as string
  },
  fromDriver(value: string): Hex {
    return value as Hex
  },
})

export const signature = customType<{
  data: Hex
  driverData: string
}>({
  dataType() {
    return 'varchar(130)' // 0x + 128 hex characters = 130 total
  },
  toDriver(value: Hex): string {
    return value as string
  },
  fromDriver(value: string): Hex {
    return value as Hex
  },
})

export const hex = customType<{
  data: Hex
  driverData: string
}>({
  dataType() {
    return 'varchar(256)'
  },
  toDriver(value: Hex): string {
    return value as string
  },
  fromDriver(value: string): Hex {
    return value as Hex
  },
})

export const ringProof = customType<{
  data: Hex
  driverData: string
}>({
  dataType() {
    return 'varchar(1570)' // 0x + (784 bytes * 2 hex chars) = 1570 chars
  },
  toDriver(value: Hex): string {
    return value as string
  },
  fromDriver(value: string): Hex {
    return value as Hex
  },
})
