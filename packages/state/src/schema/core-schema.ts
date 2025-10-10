import { relations } from 'drizzle-orm'
import {
  bigint,
  boolean,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { hash, hex, publicKey, ringProof, signature } from './core-db-types'

/**
 * Service accounts table - stores JAM service accounts (analogous to smart contracts)
 * Based on Gray Paper section 3.1 (accounts.tex)
 */
export const serviceAccounts = pgTable(
  'service_accounts',
  {
    // Service identifier (32-bit)
    serviceId: integer('service_id').primaryKey(),

    // Code hash identifying the service code
    codeHash: hash('code_hash').notNull(),

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
    parent: integer('parent').notNull(),

    // Dependent values (computed from storage)
    items: integer('items').notNull().default(0),
    octets: bigint('octets', { mode: 'bigint' }).notNull(),
    minBalance: bigint('min_balance', { mode: 'bigint' }).notNull(),

    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    parentIdx: index('idx_service_accounts_parent').on(table.parent),
    codeHashIdx: index('idx_service_accounts_code_hash').on(table.codeHash),
    balanceIdx: index('idx_service_accounts_balance').on(table.balance),
  }),
)

export const serviceAccountsRelations = relations(
  serviceAccounts,
  ({ one }) => ({
    parent: one(serviceAccounts, {
      fields: [serviceAccounts.parent],
      references: [serviceAccounts.serviceId],
    }),
  }),
)

/**
 * Service storage items - individual key-value pairs for service storage
 * Based on Gray Paper merklization section
 */
export const serviceStorage = pgTable(
  'service_storage',
  {
    id: serial('id').primaryKey(), // Composite key: serviceId + key hash
    serviceId: integer('service_id')
      .notNull()
      .references(() => serviceAccounts.serviceId),
    storageKey: hex('storage_key').notNull(), // Original key
    storageValue: hex('storage_value').notNull(), // Value as hex string
    keyHash: hash('key_hash').notNull(), // Hash of the key for merklization
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    serviceIdIdx: index('idx_service_storage_service_id').on(table.serviceId),
    keyHashIdx: index('idx_service_storage_key_hash').on(table.keyHash),
  }),
)

/**
 * Service preimages - hash to preimage mapping for service lookups
 * Based on Gray Paper accounts.tex section 3.3
 */
export const servicePreimages = pgTable(
  'service_preimages',
  {
    id: serial('id').primaryKey(), // Composite key: serviceId + hash
    serviceId: integer('service_id')
      .notNull()
      .references(() => serviceAccounts.serviceId, { onDelete: 'cascade' }),
    hash: hash('hash').notNull(), // Blake2b hash
    preimage: hex('preimage').notNull(), // Preimage as hex string
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    serviceIdIdx: index('idx_service_preimages_service_id').on(table.serviceId),
    hashIdx: index('idx_service_preimages_hash').on(table.hash),
  }),
)

/**
 * Service preimage requests - historical status of preimage availability
 * Based on Gray Paper accounts.tex section 3.3
 */
export const servicePreimageRequests = pgTable(
  'service_preimage_requests',
  {
    id: serial('id').primaryKey(),
    serviceId: integer('service_id')
      .notNull()
      .references(() => serviceAccounts.serviceId, { onDelete: 'cascade' }),
    hash: text('hash').notNull(), // Blake2b hash
    length: integer('length').notNull(), // Expected length
    status: text('status', {
      enum: ['requested', 'available', 'unavailable', 'reavailable'],
    }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    serviceIdIdx: index('idx_service_preimage_requests_service_id').on(
      table.serviceId,
    ),
    hashLengthIdx: index('idx_service_preimage_requests_hash_length').on(
      table.hash,
      table.length,
    ),
    statusIdx: index('idx_service_preimage_requests_status').on(table.status),
    // Unique constraint on serviceId + hash + length
    uniqueRequestIdx: uniqueIndex('idx_service_preimage_requests_unique').on(
      table.serviceId,
      table.hash,
      table.length,
    ),
  }),
)

export const servicePreimageTimeslots = pgTable(
  'service_preimage_timeslots',
  {
    id: serial('id').primaryKey(),
    requestId: integer('request_id')
      .notNull()
      .references(() => servicePreimageRequests.id, { onDelete: 'cascade' }),
    timeSlot: bigint('time_slot', { mode: 'bigint' }).notNull(),
    sequenceIndex: integer('sequence_index').notNull().$type<0 | 1 | 2>(), // Type-level constraint for sequence index (0-2)
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    requestIdIdx: index('idx_service_preimage_timeslots_request_id').on(
      table.requestId,
    ),
    // Unique constraint on requestId + sequenceIndex to enforce sequence ordering
    uniqueSequenceIdx: uniqueIndex(
      'idx_service_preimage_timeslots_sequence',
    ).on(table.requestId, table.sequenceIndex),
    // Index for querying by timeSlot
    timeSlotIdx: index('idx_service_preimage_timeslots_time_slot').on(
      table.timeSlot,
    ),
  }),
)

/**
 * Service privileges - privileged service indices
 * Based on Gray Paper accounts.tex section 3.5
 */
export const servicePrivileges = pgTable(
  'service_privileges',
  {
    id: text('id').primaryKey(), // Composite key: privilege_type + service_id
    privilegeType: text('privilege_type', {
      enum: ['manager', 'delegator', 'registrar', 'assigner', 'always_accers'],
    }).notNull(),
    serviceId: integer('service_id')
      .notNull()
      .references(() => serviceAccounts.serviceId),
    coreIndex: bigint('core_index', { mode: 'bigint' }), // For assigners (one per core)
    gasLimit: bigint('gas_limit', { mode: 'bigint' }), // For always_accers
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    privilegeTypeIdx: index('idx_service_privileges_type').on(
      table.privilegeType,
    ),
    serviceIdIdx: index('idx_service_privileges_service_id').on(
      table.serviceId,
    ),
  }),
)

/**
 * State trie nodes - for merklization
 * Based on Gray Paper merklization.tex
 */
export const stateTrieNodes = pgTable(
  'state_trie_nodes',
  {
    nodeHash: hash('node_hash').primaryKey(), // Blake2b hash of the node
    nodeType: text('node_type', {
      enum: ['branch', 'leaf', 'embedded_leaf'],
    }).notNull(),
    nodeData: hex('node_data').notNull(), // 512-bit encoded node data as hex
    leftChild: hash('left_child'), // Hash of left child (for branch nodes)
    rightChild: hash('right_child'), // Hash of right child (for branch nodes)
    stateKey: hex('state_key'), // 31-byte state key (for leaf nodes)
    valueHash: hash('value_hash'), // Hash of value (for regular leaf nodes)
    embeddedValue: hex('embedded_value'), // Embedded value (for embedded leaf nodes)
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    nodeTypeIdx: index('idx_state_trie_nodes_type').on(table.nodeType),
    leftChildIdx: index('idx_state_trie_nodes_left_child').on(table.leftChild),
    rightChildIdx: index('idx_state_trie_nodes_right_child').on(
      table.rightChild,
    ),
  }),
)

/**
 * State trie root - tracks the current state trie root
 */
export const stateTrieRoot = pgTable('state_trie_root', {
  id: serial('id').primaryKey().default(1), // Singleton table
  rootHash: hash('root_hash').notNull(), // Current state trie root hash
  blockNumber: bigint('block_number', { mode: 'bigint' }).notNull(), // Block number this root corresponds to
  timeSlot: bigint('time_slot', { mode: 'bigint' }).notNull(), // Time slot this root corresponds to
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
})

/**
 * Validators table - stores validator information
 */
export const validators = pgTable(
  'validators',
  {
    index: bigint('index', { mode: 'bigint' }).primaryKey(),
    publicKey: publicKey('public_key').notNull(),
    metadataHost: text('metadata_host').notNull(),
    metadataPort: integer('metadata_port').notNull(),
    epoch: bigint('epoch', { mode: 'bigint' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    isActive: boolean('is_active').default(true).notNull(),
  },
  (table) => ({
    epochIdx: index('idx_validators_epoch').on(table.epoch),
    activeIdx: index('idx_validators_active').on(table.isActive),
  }),
)

// ============================================================================
// JAM Block Storage Schema
// ============================================================================

/**
 * JAM Block Storage Strategy:
 *
 * 1. **blockHeaders** - Normalized storage of all BlockHeader fields
 *    - Primary key: blockHash (Blake2b hash of serialized header)
 *    - All Gray Paper fields stored individually for efficient querying
 *    - Indexed on parent, timeslot, author, block number
 *
 * 2. **Extrinsic Tables** - Fully normalized storage of all extrinsics
 *    - **safroleTickets** - Individual Safrole consensus tickets (XT_tickets)
 *    - **preimages** - Individual preimage data blobs (XT_preimages)
 *    - **guarantees** - Individual work report guarantees (XT_guarantees)
 *    - **guaranteeCredentials** - Validator signatures for guarantees
 *    - **assurances** - Individual data availability assurances (XT_assurances)
 *    - **disputes** - Individual dispute extrinsics (XT_disputes)
 *    - All linked to blocks via blockHash foreign key with cascade delete
 *    - Proper indexing for efficient querying by validator, type, hash, etc.
 *
 * 3. **blocks** - Summary table with aggregated extrinsic counts
 *    - Quick access to block metadata and statistics
 *    - Extrinsic counts computed from normalized tables
 *    - Status tracking for block processing pipeline
 *
 * Benefits:
 * - Full normalization enables efficient querying of individual extrinsics
 * - Proper foreign key relationships ensure data integrity
 * - Indexes optimize common query patterns (by validator, type, hash)
 * - No JSONB usage - all data is properly typed and queryable
 * - Supports complex analytics and reporting on extrinsic data
 *
 * Block Hash Calculation:
 * - blockHash = Blake2b(serialize(blockHeader))
 * - This follows the Gray Paper specification
 * - Used as primary key and foreign key across all block-related tables
 */

/**
 * Block headers table - stores JAM block headers
 * Based on Gray Paper BlockHeader interface (global-state.ts)
 * Primary key is the block hash (Blake2b hash of serialized header)
 */
export const blockHeaders = pgTable(
  'block_headers',
  {
    // Block hash (Blake2b of serialized header) - PRIMARY KEY
    blockHash: hash('block_hash').primaryKey(),

    // Gray Paper BlockHeader fields
    parent: hash('parent').notNull().unique(),

    timeslot: bigint('timeslot', { mode: 'bigint' }).notNull(),
    authorIndex: bigint('author_index', { mode: 'bigint' }).notNull(),

    encodedHeader: text('encoded_header').notNull(),
    // Metadata
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
  },
  (table) => ({
    parentIdx: index('idx_block_headers_parent').on(table.parent),
    encodedHeaderIdx: index('idx_block_headers_encoded_header').on(
      table.encodedHeader,
    ),
  }),
)

// In a separate relations file or at the bottom of your schema
// Relations for one-to-one relationship
export const blockHeadersRelations = relations(blockHeaders, ({ one }) => ({
  parent: one(blockHeaders, {
    fields: [blockHeaders.parent],
    references: [blockHeaders.blockHash],
  }),
  child: one(blockHeaders, {
    fields: [blockHeaders.blockHash],
    references: [blockHeaders.parent],
  }),
}))

// ============================================================================
// JAM Block Header Markers - Normalized Tables
// ============================================================================

/**
 * Epoch marks table - stores epoch marker data (H_epochmark)
 * Based on Gray Paper EpochMark interface
 */
export const epochMarks = pgTable(
  'epoch_marks',
  {
    id: serial('id').primaryKey(),
    blockHash: hash('block_hash')
      .notNull()
      .unique()
      .references(() => blockHeaders.blockHash, { onDelete: 'cascade' }),

    // EpochMark fields (Gray Paper)
    entropyAccumulator: hash('entropy_accumulator').notNull(), // Entropy accumulator hash
    entropy1: hash('entropy1').notNull(), // Entropy1 hash

    // Metadata
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    blockHashIdx: index('idx_epoch_marks_block_hash').on(table.blockHash),
  }),
)

/**
 * Epoch mark validators table - stores validator key pairs for epoch marks
 * Based on Gray Paper ValidatorKeyPair interface
 */
export const epochMarkValidators = pgTable(
  'epoch_mark_validators',
  {
    id: serial('id').primaryKey(),
    epochMarkId: integer('epoch_mark_id')
      .notNull()
      .references(() => epochMarks.id, { onDelete: 'cascade' }),

    // ValidatorKeyPair fields (Gray Paper)
    validatorIndex: bigint('validator_index', { mode: 'bigint' }).notNull(), // Index in validator set
    bandersnatch: publicKey('bandersnatch').notNull(), // Bandersnatch public key (hex)
    ed25519: publicKey('ed25519').notNull(), // Ed25519 public key (hex)

    // Metadata
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    epochMarkIdIdx: index('idx_epoch_mark_validators_epoch_mark_id').on(
      table.epochMarkId,
    ),
    validatorIndexIdx: index('idx_epoch_mark_validators_validator_index').on(
      table.validatorIndex,
    ),
  }),
)

/**
 * Winners marks table - stores winning tickets for next epoch (H_winnersmark)
 * Based on Gray Paper Ticket interface (Safrole tickets)
 */
export const winnersMarks = pgTable(
  'winners_marks',
  {
    id: serial('id').primaryKey(),
    blockHash: hash('block_hash')
      .notNull()
      .references(() => blockHeaders.blockHash, { onDelete: 'cascade' }),

    // Ticket fields (Gray Paper)
    sequenceIndex: integer('sequence_index').notNull(), // Order within winners mark array
    ticketId: integer('ticket_id')
      .notNull()
      .references(() => safroleTickets.ticketId, { onDelete: 'cascade' }), // Ticket identifier hash
    entryIndex: bigint('entry_index', { mode: 'bigint' }).notNull(), // Entry index
    proof: ringProof('proof').notNull(), // VRF proof (hex)

    // Metadata
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    blockHashIdx: index('idx_winners_marks_block_hash').on(table.blockHash),
    sequenceIndexIdx: index('idx_winners_marks_sequence_index').on(
      table.sequenceIndex,
    ),
    entryIndexIdx: index('idx_winners_marks_entry_index').on(table.entryIndex),
  }),
)

/**
 * Offenders marks table - stores offending validator keys (H_offendersmark)
 * Based on Gray Paper offenders mark specification
 */
export const offendersMarks = pgTable(
  'offenders_marks',
  {
    id: serial('id').primaryKey(),
    blockHash: hash('block_hash')
      .notNull()
      .references(() => blockHeaders.blockHash, { onDelete: 'cascade' }),

    // Offender fields (Gray Paper)
    sequenceIndex: integer('sequence_index').notNull(), // Order within offenders mark array
    offenderKey: publicKey('offender_key').notNull(), // Ed25519 key of misbehaving validator (hex)

    // Metadata
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    blockHashIdx: index('idx_offenders_marks_block_hash').on(table.blockHash),
    sequenceIndexIdx: index('idx_offenders_marks_sequence_index').on(
      table.sequenceIndex,
    ),
    offenderKeyIdx: index('idx_offenders_marks_offender_key').on(
      table.offenderKey,
    ),
  }),
)

// ============================================================================
// JAM Extrinsics Schema - Normalized Tables
// ============================================================================

/**
 * Safrole tickets table - stores individual tickets (XT_tickets)
 * Based on Gray Paper SafroleTicket interface
 */
export const safroleTickets = pgTable(
  'safrole_tickets',
  {
    ticketId: hash('ticket_id').notNull().primaryKey(), // st_id - ticket identifier hash
    // SafroleTicket fields (Gray Paper)
    entryIndex: bigint('entry_index', { mode: 'bigint' }).notNull(), // st_entryindex
    proof: ringProof('proof').notNull(), // VRF proof (hex)

    // Metadata
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    entryIndexIdx: index('idx_safrole_tickets_entry_index').on(
      table.entryIndex,
    ),
  }),
)

/**
 * Preimages table - stores individual preimages (XT_preimages)
 * Based on Gray Paper Preimage interface
 */
export const preimages = pgTable(
  'preimages',
  {
    // id: serial('id').primaryKey(), // Composite: blockHash + hash
    // blockHash: hash('block_hash')
    //   .notNull()
    //   .references(() => blockHeaders.blockHash, { onDelete: 'cascade' }),

    // Preimage fields (Gray Paper)
    hash: hash('hash').notNull().primaryKey(), // Blake2b hash of the data
    serviceIndex: bigint('service_index', { mode: 'bigint' })
      .notNull()
      .references(() => serviceAccounts.serviceId, { onDelete: 'cascade' }),
    data: hex('data').notNull(), // Preimage data (hex encoded)

    // Metadata
    creationSlot: bigint('creation_slot', { mode: 'bigint' }).notNull(),
  },
  (table) => ({
    // blockHashIdx: index('idx_preimages_block_hash').on(table.blockHash),
    hashIdx: index('idx_preimages_hash').on(table.hash),
    serviceIndexIdx: index('idx_preimages_service_index').on(
      table.serviceIndex,
    ),
  }),
)

/**
 * Guarantees table - stores individual guarantees (XT_guarantees)
 * Based on Gray Paper Guarantee interface
 */
export const guarantees = pgTable(
  'guarantees',
  {
    id: serial('id').primaryKey(), // Composite: blockHash + sequence
    blockHash: hash('block_hash')
      .notNull()
      .references(() => blockHeaders.blockHash, { onDelete: 'cascade' }),

    // Guarantee fields (Gray Paper)
    workReportHash: hash('work_report_hash').notNull(), // Hash of the work report
    timeslot: bigint('timeslot', { mode: 'bigint' }).notNull(), // Timeslot when created
    validatorIndex: bigint('validator_index', { mode: 'bigint' }).notNull(), // Guaranteeing validator
    signature: signature('signature').notNull(), // Ed25519 signature (hex)

    // Work report details (extracted for querying)
    packageHash: hash('package_hash').notNull(), // Work package hash
    contextHash: hash('context_hash').notNull(), // Refinement context hash
    coreIndex: integer('core_index').notNull(), // Core where work was executed
    authorizerHash: hash('authorizer_hash').notNull(), // Authorizer service hash
    output: hex('output').notNull(), // Work output data (hex)
    gasUsed: bigint('gas_used', { mode: 'bigint' }).notNull(), // Gas consumed

    // Metadata
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    blockHashIdx: index('idx_guarantees_block_hash').on(table.blockHash),
    workReportHashIdx: index('idx_guarantees_work_report_hash').on(
      table.workReportHash,
    ),
    validatorIndexIdx: index('idx_guarantees_validator_index').on(
      table.validatorIndex,
    ),
    packageHashIdx: index('idx_guarantees_package_hash').on(table.packageHash),
    coreIndexIdx: index('idx_guarantees_core_index').on(table.coreIndex),
    timeslotIdx: index('idx_guarantees_timeslot').on(table.timeslot),
  }),
)

/**
 * Guarantee credentials table - stores validator signatures for guarantees
 * Based on Gray Paper Credential interface (part of Guarantee)
 */
export const guaranteeCredentials = pgTable(
  'guarantee_credentials',
  {
    id: serial('id').primaryKey(), // Composite: guarantee_id + validator_index
    guaranteeId: integer('guarantee_id')
      .notNull()
      .references(() => guarantees.id, { onDelete: 'cascade' }),

    // Credential fields (Gray Paper)
    validatorIndex: bigint('validator_index', { mode: 'bigint' }).notNull(), // Signing validator
    value: bigint('value', { mode: 'bigint' }).notNull(), // Credential value
    signature: signature('signature').notNull(), // Ed25519 signature (hex)

    // Metadata
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    guaranteeIdIdx: index('idx_guarantee_credentials_guarantee_id').on(
      table.guaranteeId,
    ),
    validatorIndexIdx: index('idx_guarantee_credentials_validator_index').on(
      table.validatorIndex,
    ),
  }),
)

/**
 * Assurances table - stores individual assurances (XT_assurances)
 * Based on Gray Paper Assurance interface
 */
export const assurances = pgTable(
  'assurances',
  {
    id: serial('id').primaryKey(), // Composite: blockHash + sequence
    blockHash: hash('block_hash')
      .notNull()
      .references(() => blockHeaders.blockHash, { onDelete: 'cascade' }),

    // Assurance fields (Gray Paper)
    anchor: hash('anchor').notNull(), // Anchor hash for availability
    assurer: bigint('assurer', { mode: 'bigint' }).notNull(), // Assuring validator index
    signature: signature('signature').notNull(), // Ed25519 signature (hex)

    // Availability data
    availabilities: hash('availabilities').notNull(), // Bitfield of chunk availability (hex)
    chunkCount: integer('chunk_count').notNull(), // Number of chunks
    availableChunks: integer('available_chunks').notNull(), // Number of available chunks

    // Metadata
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    blockHashIdx: index('idx_assurances_block_hash').on(table.blockHash),
    anchorIdx: index('idx_assurances_anchor').on(table.anchor),
    assurerIdx: index('idx_assurances_assurer').on(table.assurer),
    availableChunksIdx: index('idx_assurances_available_chunks').on(
      table.availableChunks,
    ),
  }),
)

/**
 * Disputes table - stores individual dispute extrinsics (XT_disputes)
 * Based on Gray Paper Dispute interface - main container for all dispute types
 */
export const disputes = pgTable(
  'disputes',
  {
    id: serial('id').primaryKey(), // Auto-increment primary key
    blockHash: hash('block_hash')
      .notNull()
      .references(() => blockHeaders.blockHash, { onDelete: 'cascade' }),

    // Dispute metadata
    sequenceIndex: integer('sequence_index').notNull(), // Order within block

    // Metadata
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    blockHashIdx: index('idx_disputes_block_hash').on(table.blockHash),
    sequenceIdx: index('idx_disputes_sequence').on(table.sequenceIndex),
  }),
)

/**
 * Validity disputes table - stores individual validity disputes (V component)
 * Based on Gray Paper ValidityDispute interface
 */
export const validityDisputes = pgTable(
  'validity_disputes',
  {
    id: serial('id').primaryKey(),
    disputeId: integer('dispute_id')
      .notNull()
      .references(() => disputes.id, { onDelete: 'cascade' }),

    // ValidityDispute fields (Gray Paper)
    reportHash: hash('report_hash').notNull(), // Hash of work-report being disputed
    epochIndex: bigint('epoch_index', { mode: 'bigint' }).notNull(), // Epoch when dispute raised

    // Metadata
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    disputeIdIdx: index('idx_validity_disputes_dispute_id').on(table.disputeId),
    reportHashIdx: index('idx_validity_disputes_report_hash').on(
      table.reportHash,
    ),
    epochIndexIdx: index('idx_validity_disputes_epoch_index').on(
      table.epochIndex,
    ),
  }),
)

/**
 * Judgments table - stores individual validator judgments (part of validity disputes)
 * Based on Gray Paper Judgment interface
 */
export const judgments = pgTable(
  'judgments',
  {
    id: serial('id').primaryKey(),
    validityDisputeId: integer('validity_dispute_id')
      .notNull()
      .references(() => validityDisputes.id, { onDelete: 'cascade' }),

    // Judgment fields (Gray Paper)
    validity: boolean('validity').notNull(), // Validator's judgment: true = valid, false = invalid
    judgeIndex: bigint('judge_index', { mode: 'bigint' }).notNull(), // Index of judging validator
    signature: signature('signature').notNull(), // Ed25519 signature from validator (hex)

    // Metadata
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    validityDisputeIdIdx: index('idx_judgments_validity_dispute_id').on(
      table.validityDisputeId,
    ),
    judgeIndexIdx: index('idx_judgments_judge_index').on(table.judgeIndex),
    validityIdx: index('idx_judgments_validity').on(table.validity),
  }),
)

/**
 * Challenge disputes table - stores challenge dispute data (C component)
 * Based on Gray Paper challenge dispute structure
 */
export const challengeDisputes = pgTable(
  'challenge_disputes',
  {
    id: serial('id').primaryKey(),
    disputeId: integer('dispute_id')
      .notNull()
      .references(() => disputes.id, { onDelete: 'cascade' }),

    // Challenge dispute fields (Gray Paper)
    challengeData: hex('challenge_data').notNull(), // Raw challenge data (hex encoded)
    challengerIndex: bigint('challenger_index', { mode: 'bigint' }).notNull(), // Challenging validator
    targetValidatorIndex: bigint('target_validator_index', {
      mode: 'bigint',
    }).notNull(), // Accused validator
    evidence: hash('evidence').notNull(), // Proof of misbehavior (hex)
    signature: signature('signature').notNull(), // Challenger's Ed25519 signature (hex)

    // Metadata
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    disputeIdIdx: index('idx_challenge_disputes_dispute_id').on(
      table.disputeId,
    ),
    challengerIndexIdx: index('idx_challenge_disputes_challenger_index').on(
      table.challengerIndex,
    ),
    targetValidatorIndexIdx: index(
      'idx_challenge_disputes_target_validator_index',
    ).on(table.targetValidatorIndex),
  }),
)

/**
 * Finality disputes table - stores finality dispute data (F component)
 * Based on Gray Paper finality dispute structure
 */
export const finalityDisputes = pgTable(
  'finality_disputes',
  {
    id: serial('id').primaryKey(),
    disputeId: integer('dispute_id')
      .notNull()
      .references(() => disputes.id, { onDelete: 'cascade' }),

    // Finality dispute fields (Gray Paper)
    finalityData: hex('finality_data').notNull(), // Raw finality dispute data (hex encoded)
    disputerIndex: bigint('disputer_index', { mode: 'bigint' }).notNull(), // Disputing validator
    contradictionEvidence: hex('contradiction_evidence').notNull(), // Proof of judgment contradiction (hex)
    signature: signature('signature').notNull(), // Disputer's Ed25519 signature (hex)

    // Metadata
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    disputeIdIdx: index('idx_finality_disputes_dispute_id').on(table.disputeId),
    disputerIndexIdx: index('idx_finality_disputes_disputer_index').on(
      table.disputerIndex,
    ),
  }),
)

/**
 * Blocks summary table - aggregated view of block data
 * This table provides quick access to block metadata and extrinsic counts
 * The actual extrinsic data is stored in the normalized tables above
 */
export const blocks = pgTable(
  'blocks',
  {
    // Block hash - PRIMARY KEY (references blockHeaders)
    blockHash: hash('block_hash')
      .primaryKey()
      .references(() => blockHeaders.blockHash, { onDelete: 'cascade' }),

    parent: hash('parent').notNull().unique(),

    // Key fields extracted for indexing and quick access
    timeslot: bigint('timeslot', { mode: 'bigint' }).notNull(),
    blockNumber: bigint('block_number', { mode: 'bigint' }),
    authorIndex: bigint('author_index', { mode: 'bigint' }).notNull(),

    encodedBlock: text('encoded_block').notNull(),
    // Status tracking
    status: text('status', {
      enum: ['pending', 'validated', 'finalized', 'orphaned'],
    })
      .notNull()
      .default('pending'),

    // Metadata
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    finalizedAt: timestamp('finalized_at', { withTimezone: true }),
  },
  (table) => ({
    timeslotIdx: index('idx_blocks_timeslot').on(table.timeslot),
    blockNumberIdx: index('idx_blocks_block_number').on(table.blockNumber),
    authorIdx: index('idx_blocks_author').on(table.authorIndex),
    statusIdx: index('idx_blocks_status').on(table.status),
  }),
)

// ============================================================================
// JAM Work Package, Work Report, and Work Digest Schema
// ============================================================================

/**
 * Work packages table - stores JAM work packages
 * Based on Gray Paper WorkPackage interface (serialization.ts)
 */
export const workPackages = pgTable(
  'work_packages',
  {
    // Work package hash (Blake2b of serialized package) - UNIQUE
    packageHash: hash('package_hash').notNull().unique().primaryKey(),

    // WorkPackage fields (Gray Paper)
    authToken: hex('auth_token').notNull(), // Authorization token
    authCodeHost: bigint('auth_code_host', { mode: 'bigint' }).notNull(), // Service hosting authorization code
    authCodeHash: hash('auth_code_hash').notNull(), // Authorization code hash
    authConfig: hex('auth_config').notNull(), // Authorization configuration

    // Work context fields (flattened for efficient querying)
    contextAnchor: hash('context_anchor').notNull(), // Anchor block hash
    contextState: hash('context_state').notNull(), // State root
    contextBelief: hash('context_belief').notNull(), // Belief state
    contextEpochMark: hash('context_epoch_mark'), // Optional epoch mark

    // Work items count (actual items stored in separate table)
    workItemCount: integer('work_item_count').notNull().default(0),

    // Work package data (serialized)
    data: hex('data').notNull(), // Full serialized work package data

    // Status tracking
    status: text('status', {
      enum: ['pending', 'processing', 'completed', 'failed'],
    })
      .notNull()
      .default('pending'),

    // Core assignment
    coreIndex: integer('core_index'), // Core assigned to process this work package

    // Metadata
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
  },
  (table) => ({
    packageHashIdx: index('idx_work_packages_package_hash').on(
      table.packageHash,
    ),
    authCodeHostIdx: index('idx_work_packages_auth_code_host').on(
      table.authCodeHost,
    ),
    authCodeHashIdx: index('idx_work_packages_auth_code_hash').on(
      table.authCodeHash,
    ),
    contextAnchorIdx: index('idx_work_packages_context_anchor').on(
      table.contextAnchor,
    ),
    statusIdx: index('idx_work_packages_status').on(table.status),
    coreIndexIdx: index('idx_work_packages_core_index').on(table.coreIndex),
    createdAtIdx: index('idx_work_packages_created_at').on(table.createdAt),
  }),
)

/**
 * Import segments table - stores import segment references for work items
 * Based on Gray Paper ImportSpec (ASN.1) and test vectors
 */
export const importSegments = pgTable(
  'import_segments',
  {
    id: serial('id').primaryKey(),
    workItemId: integer('work_item_id')
      .notNull()
      .references(() => workItems.id, { onDelete: 'cascade' }),

    // ImportSegment fields (Gray Paper/ASN.1)
    treeRoot: hash('tree_root').notNull(), // Root hash of the segment tree
    index: integer('index').notNull(), // U16 index of the segment (0-65535)

    // Sequence within work item
    sequenceIndex: integer('sequence_index').notNull(),

    // Metadata
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    workItemIdIdx: index('idx_import_segments_work_item_id').on(
      table.workItemId,
    ),
    treeRootIdx: index('idx_import_segments_tree_root').on(table.treeRoot),
    indexIdx: index('idx_import_segments_index').on(table.index),
    sequenceIndexIdx: index('idx_import_segments_sequence_index').on(
      table.sequenceIndex,
    ),
    // Composite index for efficient lookups
    treeRootIndexIdx: index('idx_import_segments_tree_root_index').on(
      table.treeRoot,
      table.index,
    ),
  }),
)

/**
 * Work items table - stores individual work items within work packages
 * Based on Gray Paper WorkItem interface
 */
export const workItems = pgTable(
  'work_items',
  {
    id: serial('id').primaryKey(),
    workPackageHash: hash('work_package_hash')
      .notNull()
      .references(() => workPackages.packageHash, { onDelete: 'cascade' }),

    // Work item fields (Gray Paper)
    serviceIndex: bigint('service_index', { mode: 'bigint' }).notNull(), // Service identifier
    codeHash: hash('code_hash').notNull(), // Service code hash
    payload: hex('payload').notNull(), // Work item payload
    gasLimit: bigint('gas_limit', { mode: 'bigint' }).notNull(), // Gas limit for refinement
    accGasLimit: bigint('acc_gas_limit', { mode: 'bigint' }).notNull(), // Gas limit for accumulation

    // Import segments count (actual segments stored in separate table)
    importSegmentCount: integer('import_segment_count').notNull().default(0),
    extrinsics: text('extrinsics').notNull(), // JSON array of extrinsic blob hashes and lengths
    exportCount: integer('export_count').notNull(), // Number of exported segments

    // Sequence within work package
    sequenceIndex: integer('sequence_index').notNull(),

    // Metadata
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    workPackageHashIdx: index('idx_work_items_work_package_hash').on(
      table.workPackageHash,
    ),
    serviceIndexIdx: index('idx_work_items_service_index').on(
      table.serviceIndex,
    ),
    codeHashIdx: index('idx_work_items_code_hash').on(table.codeHash),
    sequenceIndexIdx: index('idx_work_items_sequence_index').on(
      table.sequenceIndex,
    ),
  }),
)

/**
 * Work reports table - stores JAM work reports
 * Based on Gray Paper WorkReport interface (serialization.ts)
 */
export const workReports = pgTable(
  'work_reports',
  {
    // Work report hash (Blake2b of serialized report) - UNIQUE
    reportHash: hash('report_hash').notNull().unique().primaryKey(),

    // Reference to the work package that generated this report
    workPackageHash: hash('work_package_hash').references(
      () => workPackages.packageHash,
      { onDelete: 'set null' },
    ),

    // WorkReport fields (Gray Paper)
    coreIndex: bigint('core_index', { mode: 'bigint' }).notNull(), // Core that processed the work
    authorizer: hash('authorizer').notNull(), // Authorizer hash
    authTrace: hex('auth_trace').notNull(), // Authorization trace
    authGasUsed: bigint('auth_gas_used', { mode: 'bigint' }).notNull(), // Gas used for authorization

    // Availability specification
    packageHash: hash('package_hash').notNull(), // Work package hash
    erasureRoot: hash('erasure_root').notNull(), // Erasure coding root
    exportsRoot: hash('exports_root').notNull(), // Exports merkle root
    exportsCount: integer('exports_count').notNull(), // Number of exported segments

    // Context (same as work package, but may differ due to processing)
    contextAnchor: hash('context_anchor').notNull(), // Anchor block hash
    contextState: hash('context_state').notNull(), // State root
    contextBelief: hash('context_belief').notNull(), // Belief state
    contextEpochMark: hash('context_epoch_mark'), // Optional epoch mark

    // Digest count (actual digests stored in separate table)
    digestCount: integer('digest_count').notNull().default(0),

    // Segment root lookup (stored as JSON object)
    srLookup: text('sr_lookup').notNull(), // JSON object mapping work package hashes to segment roots

    // Work report data (serialized)
    data: hex('data').notNull(), // Full serialized work report data

    // Status tracking
    status: text('status', {
      enum: ['pending', 'guaranteed', 'available', 'finalized'],
    })
      .notNull()
      .default('pending'),

    // Metadata
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    guaranteedAt: timestamp('guaranteed_at', { withTimezone: true }),
    finalizedAt: timestamp('finalized_at', { withTimezone: true }),
  },
  (table) => ({
    workPackageHashIdx: index('idx_work_reports_work_package_hash').on(
      table.workPackageHash,
    ),
    coreIndexIdx: index('idx_work_reports_core_index').on(table.coreIndex),
    authorizerIdx: index('idx_work_reports_authorizer').on(table.authorizer),
    packageHashIdx: index('idx_work_reports_package_hash').on(
      table.packageHash,
    ),
    erasureRootIdx: index('idx_work_reports_erasure_root').on(
      table.erasureRoot,
    ),
    statusIdx: index('idx_work_reports_status').on(table.status),
    createdAtIdx: index('idx_work_reports_created_at').on(table.createdAt),
  }),
)

/**
 * Work results table - stores individual work results within work reports
 * Based on Gray Paper WorkResult interface (serialization.ts)
 */
export const workResults = pgTable(
  'work_results',
  {
    id: serial('id').primaryKey(),
    workReportHash: hash('work_report_hash')
      .notNull()
      .references(() => workReports.reportHash, { onDelete: 'cascade' }),

    // WorkResult fields (Gray Paper)
    serviceId: bigint('service_id', { mode: 'bigint' })
      .notNull()
      .references(() => workItems.serviceIndex, { onDelete: 'cascade' }), // Service whose state is altered
    codeHash: hash('code_hash')
      .notNull()
      .references(() => serviceAccounts.codeHash, { onDelete: 'cascade' }), // Service code hash at time of reporting
    payloadHash: hash('payload_hash').notNull(), // Hash of work-item payload
    accumulateGas: bigint('accumulate_gas', { mode: 'bigint' }).notNull(), // Gas limit for accumulation

    // Work execution result (enum)
    result: integer('result').notNull(), // WorkExecResult enum (0=Ok, 1=OutOfGas, 2=Panic, etc.)

    // RefineLoad fields (nested structure)
    gasUsed: bigint('gas_used', { mode: 'bigint' }).notNull(), // Actual gas consumed
    imports: bigint('imports', { mode: 'bigint' }).notNull(), // Number of imported segments
    extrinsicCount: bigint('extrinsic_count', { mode: 'bigint' }).notNull(), // Number of extrinsics
    extrinsicSize: bigint('extrinsic_size', { mode: 'bigint' }).notNull(), // Total size of extrinsics
    exports: bigint('exports', { mode: 'bigint' }).notNull(), // Number of exported segments

    // Sequence within work report
    sequenceIndex: integer('sequence_index').notNull(),

    // Metadata
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    workReportHashIdx: index('idx_work_results_work_report_hash').on(
      table.workReportHash,
    ),
    serviceIdIdx: index('idx_work_results_service_id').on(table.serviceId),
    codeHashIdx: index('idx_work_results_code_hash').on(table.codeHash),
    payloadHashIdx: index('idx_work_results_payload_hash').on(
      table.payloadHash,
    ),
    sequenceIndexIdx: index('idx_work_results_sequence_index').on(
      table.sequenceIndex,
    ),
    gasUsedIdx: index('idx_work_results_gas_used').on(table.gasUsed),
  }),
)

// Type inference
export type DbServiceAccount = typeof serviceAccounts.$inferSelect
export type DbNewServiceAccount = typeof serviceAccounts.$inferInsert
export type DbServiceStorage = typeof serviceStorage.$inferSelect
export type DbNewServiceStorage = typeof serviceStorage.$inferInsert
export type DbServicePreimage = typeof servicePreimages.$inferSelect
export type DbNewServicePreimage = typeof servicePreimages.$inferInsert
export type DbServicePreimageRequest =
  typeof servicePreimageRequests.$inferSelect
export type DbNewServicePreimageRequest =
  typeof servicePreimageRequests.$inferInsert
export type DbServicePreimageTimeslot =
  typeof servicePreimageTimeslots.$inferSelect
export type DbNewServicePreimageTimeslot =
  typeof servicePreimageTimeslots.$inferInsert
export type DbServicePrivilege = typeof servicePrivileges.$inferSelect
export type DbNewServicePrivilege = typeof servicePrivileges.$inferInsert
export type DbStateTrieNode = typeof stateTrieNodes.$inferSelect
export type DbNewStateTrieNode = typeof stateTrieNodes.$inferInsert
export type DbStateTrieRoot = typeof stateTrieRoot.$inferSelect
export type DbNewStateTrieRoot = typeof stateTrieRoot.$inferInsert
export type DbValidator = typeof validators.$inferSelect
export type DbNewValidator = typeof validators.$inferInsert
// Block and extrinsic types
export type DbBlockHeader = typeof blockHeaders.$inferSelect
export type DbNewBlockHeader = typeof blockHeaders.$inferInsert
// Header marker types
export type DbEpochMark = typeof epochMarks.$inferSelect
export type DbNewEpochMark = typeof epochMarks.$inferInsert
export type DbEpochMarkValidator = typeof epochMarkValidators.$inferSelect
export type DbNewEpochMarkValidator = typeof epochMarkValidators.$inferInsert
export type DbWinnersMark = typeof winnersMarks.$inferSelect
export type DbNewWinnersMark = typeof winnersMarks.$inferInsert
export type DbOffendersMark = typeof offendersMarks.$inferSelect
export type DbNewOffendersMark = typeof offendersMarks.$inferInsert
export type DbSafroleTicket = typeof safroleTickets.$inferSelect
export type DbNewSafroleTicket = typeof safroleTickets.$inferInsert
export type DbPreimage = typeof preimages.$inferSelect
export type DbNewPreimage = typeof preimages.$inferInsert
export type DbGuarantee = typeof guarantees.$inferSelect
export type DbNewGuarantee = typeof guarantees.$inferInsert
export type DbGuaranteeCredential = typeof guaranteeCredentials.$inferSelect
export type DbNewGuaranteeCredential = typeof guaranteeCredentials.$inferInsert
export type DbAssurance = typeof assurances.$inferSelect
export type DbNewAssurance = typeof assurances.$inferInsert
export type DbDispute = typeof disputes.$inferSelect
export type DbNewDispute = typeof disputes.$inferInsert
export type DbValidityDispute = typeof validityDisputes.$inferSelect
export type DbNewValidityDispute = typeof validityDisputes.$inferInsert
export type DbJudgment = typeof judgments.$inferSelect
export type DbNewJudgment = typeof judgments.$inferInsert
export type DbChallengeDispute = typeof challengeDisputes.$inferSelect
export type DbNewChallengeDispute = typeof challengeDisputes.$inferInsert
export type DbFinalityDispute = typeof finalityDisputes.$inferSelect
export type DbNewFinalityDispute = typeof finalityDisputes.$inferInsert
export type DbBlock = typeof blocks.$inferSelect
export type DbNewBlock = typeof blocks.$inferInsert
// Work package types
export type DbWorkPackage = typeof workPackages.$inferSelect
export type DbNewWorkPackage = typeof workPackages.$inferInsert
export type DbWorkItem = typeof workItems.$inferSelect
export type DbNewWorkItem = typeof workItems.$inferInsert
export type DbWorkReport = typeof workReports.$inferSelect
export type DbNewWorkReport = typeof workReports.$inferInsert
export type DbWorkResult = typeof workResults.$inferSelect
export type DbNewWorkResult = typeof workResults.$inferInsert
export type DbImportSegment = typeof importSegments.$inferSelect
export type DbNewImportSegment = typeof importSegments.$inferInsert
