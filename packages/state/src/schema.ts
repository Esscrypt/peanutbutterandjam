import { pgTable, integer, text, timestamp, boolean, index, bigint, jsonb } from 'drizzle-orm/pg-core'
import type { ValidatorIndex } from '@pbnj/types'

/**
 * Service accounts table - stores JAM service accounts (analogous to smart contracts)
 * Based on Gray Paper section 3.1 (accounts.tex)
 */
export const serviceAccounts = pgTable('service_accounts', {
  // Service identifier (32-bit)
  serviceId: integer('service_id').primaryKey(),
  
  // Storage dictionary mapping blob keys to blob values
  storage: jsonb('storage').notNull().default({}),
  
  // Preimage lookup dictionary mapping hash to blob
  preimages: jsonb('preimages').notNull().default({}),
  
  // Preimage requests dictionary mapping (hash, length) to time slots
  requests: jsonb('requests').notNull().default({}),
  
  // Code hash identifying the service code
  codeHash: text('code_hash').notNull(),
  
  // Service balance
  balance: bigint('balance', { mode: 'bigint' }).notNull(),
  
  // Gratis storage offset
  gratis: bigint('gratis', { mode: 'bigint' }).notNull(),
  
  // Minimum gas required for accumulation per work-item
  minAccGas: bigint('min_acc_gas', { mode: 'bigint' }).notNull(),
  
  // Minimum gas required for accumulation per deferred-transfer
  minMemoGas: bigint('min_memo_gas', { mode: 'bigint' }).notNull(),
  
  // Time slot at creation
  created: integer('created').notNull(),
  
  // Time slot at most recent accumulation
  lastAcc: integer('last_acc').notNull(),
  
  // Parent service ID
  parent: integer('parent'),
  
  // Dependent values (computed from storage)
  items: integer('items').notNull().default(0),
  octets: bigint('octets', { mode: 'bigint' }).notNull(),
  minBalance: bigint('min_balance', { mode: 'bigint' }).notNull(),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  parentIdx: index('idx_service_accounts_parent').on(table.parent),
  codeHashIdx: index('idx_service_accounts_code_hash').on(table.codeHash),
  balanceIdx: index('idx_service_accounts_balance').on(table.balance),
}))

/**
 * Service storage items - individual key-value pairs for service storage
 * Based on Gray Paper merklization section
 */
export const serviceStorage = pgTable('service_storage', {
  id: text('id').primaryKey(), // Composite key: serviceId + key hash
  serviceId: integer('service_id').notNull().references(() => serviceAccounts.serviceId),
  storageKey: text('storage_key').notNull(), // Original key
  storageValue: text('storage_value').notNull(), // Value as hex string
  keyHash: text('key_hash').notNull(), // Hash of the key for merklization
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  serviceIdIdx: index('idx_service_storage_service_id').on(table.serviceId),
  keyHashIdx: index('idx_service_storage_key_hash').on(table.keyHash),
}))

/**
 * Service preimages - hash to preimage mapping for service lookups
 * Based on Gray Paper accounts.tex section 3.3
 */
export const servicePreimages = pgTable('service_preimages', {
  id: text('id').primaryKey(), // Composite key: serviceId + hash
  serviceId: integer('service_id').notNull().references(() => serviceAccounts.serviceId),
  hash: text('hash').notNull(), // Blake2b hash
  preimage: text('preimage').notNull(), // Preimage as hex string
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  serviceIdIdx: index('idx_service_preimages_service_id').on(table.serviceId),
  hashIdx: index('idx_service_preimages_hash').on(table.hash),
}))

/**
 * Service preimage requests - historical status of preimage availability
 * Based on Gray Paper accounts.tex section 3.3
 */
export const servicePreimageRequests = pgTable('service_preimage_requests', {
  id: text('id').primaryKey(), // Composite key: serviceId + hash + length
  serviceId: integer('service_id').notNull().references(() => serviceAccounts.serviceId),
  hash: text('hash').notNull(), // Blake2b hash
  length: integer('length').notNull(), // Expected length
  timeSlots: jsonb('time_slots').notNull(), // Array of up to 3 time slots
  status: text('status', { enum: ['requested', 'available', 'unavailable', 'reavailable'] }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  serviceIdIdx: index('idx_service_preimage_requests_service_id').on(table.serviceId),
  hashLengthIdx: index('idx_service_preimage_requests_hash_length').on(table.hash, table.length),
  statusIdx: index('idx_service_preimage_requests_status').on(table.status),
}))

/**
 * Service privileges - privileged service indices
 * Based on Gray Paper accounts.tex section 3.5
 */
export const servicePrivileges = pgTable('service_privileges', {
  id: text('id').primaryKey(), // Composite key: privilege_type + service_id
  privilegeType: text('privilege_type', { 
    enum: ['manager', 'delegator', 'registrar', 'assigner', 'always_accers'] 
  }).notNull(),
  serviceId: integer('service_id').notNull().references(() => serviceAccounts.serviceId),
  coreIndex: integer('core_index'), // For assigners (one per core)
  gasLimit: bigint('gas_limit', { mode: 'bigint' }), // For always_accers
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  privilegeTypeIdx: index('idx_service_privileges_type').on(table.privilegeType),
  serviceIdIdx: index('idx_service_privileges_service_id').on(table.serviceId),
}))

/**
 * State trie nodes - for merklization
 * Based on Gray Paper merklization.tex
 */
export const stateTrieNodes = pgTable('state_trie_nodes', {
  nodeHash: text('node_hash').primaryKey(), // Blake2b hash of the node
  nodeType: text('node_type', { enum: ['branch', 'leaf', 'embedded_leaf'] }).notNull(),
  nodeData: text('node_data').notNull(), // 512-bit encoded node data as hex
  leftChild: text('left_child'), // Hash of left child (for branch nodes)
  rightChild: text('right_child'), // Hash of right child (for branch nodes)
  stateKey: text('state_key'), // 31-byte state key (for leaf nodes)
  valueHash: text('value_hash'), // Hash of value (for regular leaf nodes)
  embeddedValue: text('embedded_value'), // Embedded value (for embedded leaf nodes)
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  nodeTypeIdx: index('idx_state_trie_nodes_type').on(table.nodeType),
  leftChildIdx: index('idx_state_trie_nodes_left_child').on(table.leftChild),
  rightChildIdx: index('idx_state_trie_nodes_right_child').on(table.rightChild),
}))

/**
 * State trie root - tracks the current state trie root
 */
export const stateTrieRoot = pgTable('state_trie_root', {
  id: integer('id').primaryKey().default(1), // Singleton table
  rootHash: text('root_hash').notNull(), // Current state trie root hash
  blockNumber: integer('block_number').notNull(), // Block number this root corresponds to
  timeSlot: integer('time_slot').notNull(), // Time slot this root corresponds to
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

/**
 * Validators table - stores validator information
 */
export const validators = pgTable('validators', {
  index: integer('index').primaryKey(),
  publicKey: text('public_key').notNull(),
  metadataHost: text('metadata_host').notNull(),
  metadataPort: integer('metadata_port').notNull(),
  epoch: integer('epoch').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
}, (table) => ({
  epochIdx: index('idx_validators_epoch').on(table.epoch),
  activeIdx: index('idx_validators_active').on(table.isActive),
}))

// Type inference
export type ServiceAccount = typeof serviceAccounts.$inferSelect
export type NewServiceAccount = typeof serviceAccounts.$inferInsert
export type ServiceStorage = typeof serviceStorage.$inferSelect
export type NewServiceStorage = typeof serviceStorage.$inferInsert
export type ServicePreimage = typeof servicePreimages.$inferSelect
export type NewServicePreimage = typeof servicePreimages.$inferInsert
export type ServicePreimageRequest = typeof servicePreimageRequests.$inferSelect
export type NewServicePreimageRequest = typeof servicePreimageRequests.$inferInsert
export type ServicePrivilege = typeof servicePrivileges.$inferSelect
export type NewServicePrivilege = typeof servicePrivileges.$inferInsert
export type StateTrieNode = typeof stateTrieNodes.$inferSelect
export type NewStateTrieNode = typeof stateTrieNodes.$inferInsert
export type StateTrieRoot = typeof stateTrieRoot.$inferSelect
export type NewStateTrieRoot = typeof stateTrieRoot.$inferInsert
export type Validator = typeof validators.$inferSelect
export type NewValidator = typeof validators.$inferInsert 