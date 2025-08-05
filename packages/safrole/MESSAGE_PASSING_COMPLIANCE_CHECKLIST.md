# Safrole Message Passing Compliance Checklist

## Overview

This checklist ensures compliance with the Gray Paper specifications for message passing in the Safrole consensus protocol. The checklist is based on the formal specifications in `graypaper/text/safrole.tex` and covers all aspects of peer-to-peer communication, message validation, and state transitions.

## 1. Block Header Message Structure

### 1.1 Header Components
- [ ] **Timeslot Index** (`H_timeslot`): Must be encoded as 32-bit unsigned integer
  - Reference: Gray Paper Section 3.1, Equation 3.1
  - Must represent number of six-second periods since JAM Common Era (Jan 1, 2025, 12:00 UTC)
  - Validation: Must be greater than previous block's timeslot

- [ ] **Seal Signature** (`H_sealsig`): Must be valid Bandersnatch signature
  - Reference: Gray Paper Section 3.4, Equations 3.8-3.10
  - Message: `encode_unsigned_header(H)` (header without seal signature)
  - Context: `$jam_ticket_seal` for ticket mode, `$jam_fallback_seal` for fallback mode
  - Must be signed by validator key at index `m` in `sealtickets`

- [ ] **VRF Signature** (`H_vrfsig`): Must be valid Bandersnatch signature
  - Reference: Gray Paper Section 3.4, Equation 3.11
  - Message: Empty string `{}`
  - Context: `$jam_entropy`
  - Must be signed by same validator key as seal signature

- [ ] **Epoch Marker** (`H_epochmark`): Optional epoch transition data
  - Reference: Gray Paper Section 3.6, Equation 3.12
  - Contains: `(entropy_accumulator, entropy_1, [(k_bs, k_ed) for k in pendingset'])`
  - Only present when `e' > e` (epoch transition)

- [ ] **Winners Marker** (`H_winnersmark`): Optional winning tickets data
  - Reference: Gray Paper Section 3.6, Equation 3.13
  - Contains: `Z(ticketaccumulator)` (outside-in sequenced tickets)
  - Only present when `e' = e ∧ m < C_epochtailstart ≤ m' ∧ len(ticketaccumulator) = C_epochlen`

### 1.2 Header Serialization
- [ ] **Unsigned Header Encoding**: Must exclude seal signature component
  - Reference: Gray Paper Section 3.4
  - Used as message for seal signature verification
  - Must be deterministic and consistent across all nodes

- [ ] **Header Validation**: Must validate all components before processing
  - Timeslot must be in future relative to current time
  - Signatures must be cryptographically valid
  - Markers must be present/absent according to conditions

## 2. Extrinsic Message Processing

### 2.1 Ticket Extrinsic (`xttickets`)
- [ ] **Ticket Proof Structure**: Each ticket must contain:
  - Reference: Gray Paper Section 3.7, Equation 3.14
  - `entryIndex`: Natural number < `C_ticketentries` (1000)
  - `proof`: Bandersnatch Ring VRF proof

- [ ] **Ring VRF Proof Validation**:
  - Reference: Gray Paper Section 3.7
  - Root: `epochroot'` (next epoch's validator ring root)
  - Context: `$jam_ticket_seal` concatenated with `entropy'_2` and `entryIndex`
  - Message: Empty string `{}`

- [ ] **Ticket Submission Limits**:
  - Reference: Gray Paper Section 3.7, Equation 3.15
  - Maximum tickets per block: `C_maxblocktickets` when `m' < C_epochtailstart`
  - Zero tickets allowed when `m' ≥ C_epochtailstart`

- [ ] **Ticket Ordering and Uniqueness**:
  - Reference: Gray Paper Section 3.7
  - Tickets must be ordered by implied identifier (VRF output)
  - No duplicate identifiers allowed
  - No duplicates with existing `ticketaccumulator`

### 2.2 Ticket Processing Logic
- [ ] **Ticket ID Extraction**: Must use VRF output as ticket identifier
  - Reference: Gray Paper Section 3.7
  - Extract from Ring VRF proof output: `banderout(i_xt_proof)`
  - Must be deterministic and unbiasable

- [ ] **Ticket Accumulator Update**:
  - Reference: Gray Paper Section 3.7, Equation 3.16
  - Merge new tickets with existing accumulator
  - Sort by ticket ID
  - Keep top `C_epochlen` (600) tickets
  - All submitted tickets must appear in final accumulator

## 3. State Transition Messages

### 3.1 Epoch Transition Messages
- [ ] **Validator Set Rotation**:
  - Reference: Gray Paper Section 3.3, Equation 3.7
  - `activeset' = pendingset`
  - `pendingset' = Φ(stagingset)` (with offender filtering)
  - `previousset' = activeset`

- [ ] **Epoch Root Computation**:
  - Reference: Gray Paper Section 3.3
  - Must compute Bandersnatch ring root from `pendingset'`
  - Use `getringroot({k_bs for k in pendingset'})`

- [ ] **Entropy Rotation**:
  - Reference: Gray Paper Section 3.4, Equation 3.6
  - `entropy'_1 = entropy_0`
  - `entropy'_2 = entropy_1`
  - `entropy'_3 = entropy_2`

### 3.2 Regular Slot Messages
- [ ] **Entropy Accumulation**:
  - Reference: Gray Paper Section 3.4, Equation 3.5
  - `entropyaccumulator' = blake(entropyaccumulator || banderout(H_vrfsig))`
  - Must use VRF output from current block

- [ ] **Seal Ticket Sequence Update**:
  - Reference: Gray Paper Section 3.5, Equation 3.12
  - Three cases:
    1. Epoch transition with tickets: `Z(ticketaccumulator)`
    2. Same epoch: `sealtickets` unchanged
    3. Epoch transition without tickets: `F(entropy'_2, activeset')`

## 4. Cryptographic Message Validation

### 4.1 Bandersnatch Signature Validation
- [ ] **Seal Signature Verification**:
  - Reference: Gray Paper Section 3.4, Equations 3.8-3.10
  - Must verify signature against correct validator key
  - Must use correct context string
  - Must verify against unsigned header

- [ ] **VRF Signature Verification**:
  - Reference: Gray Paper Section 3.4, Equation 3.11
  - Must verify signature against same validator key
  - Must use entropy context
  - Must verify against empty message

### 4.2 Ring VRF Proof Validation
- [ ] **Proof Verification**:
  - Reference: Gray Paper Section 3.7
  - Must verify Ring VRF proof against epoch root
  - Must use correct context and message
  - Must extract deterministic ticket ID

- [ ] **Ring Root Validation**:
  - Reference: Gray Paper Section 3.3
  - Must validate epoch root against validator set
  - Must handle empty validator sets correctly

## 5. Message Ordering and Timing

### 5.1 Slot-based Message Processing
- [ ] **Slot Progression**: Must process messages in strict slot order
  - Reference: Gray Paper Section 3.1
  - Each block must have unique timeslot
  - Must reject blocks with past or duplicate timeslots

- [ ] **Epoch Boundary Handling**:
  - Reference: Gray Paper Section 3.3
  - Must detect epoch transitions: `e' > e`
  - Must apply all epoch transition rules atomically

### 5.2 Ticket Submission Timing
- [ ] **Submission Window**: Tickets only accepted during submission period
  - Reference: Gray Paper Section 3.7
  - Must reject tickets when `m' ≥ C_epochtailstart`
  - Must close contest at epoch tail start

- [ ] **Contest Closure**: Must fix seal key sequence after contest closes
  - Reference: Gray Paper Section 3.5
  - Must use accumulated tickets for next epoch
  - Must apply outside-in sequencing `Z()`

## 6. Error Handling and Validation

### 6.1 Input Validation
- [ ] **Slot Validation**: Must reject invalid slot progressions
  - Reference: Gray Paper Section 3.1
  - Must ensure `slot' > slot`
  - Must validate timeslot against wall clock

- [ ] **Extrinsic Validation**: Must validate all extrinsic components
  - Reference: Gray Paper Section 3.7
  - Must check entry index bounds
  - Must validate proof signatures
  - Must check submission limits

### 6.2 State Validation
- [ ] **State Consistency**: Must maintain state invariants
  - Reference: Gray Paper Section 3.2
  - Must validate entropy accumulator size
  - Must validate ticket accumulator size
  - Must validate validator set sizes

- [ ] **Transition Validation**: Must validate all state transitions
  - Reference: Gray Paper Section 3.3-3.7
  - Must ensure all equations are satisfied
  - Must handle edge cases correctly

## 7. Network Protocol Compliance

### 7.1 Message Serialization
- [ ] **Header Serialization**: Must follow Gray Paper serialization format
  - Reference: Gray Paper Section 4 (Serialization)
  - Must use correct encoding for all components
  - Must handle optional markers correctly

- [ ] **Extrinsic Serialization**: Must serialize extrinsics correctly
  - Reference: Gray Paper Section 4
  - Must encode ticket proofs properly
  - Must handle variable-length sequences

### 7.2 Peer Communication
- [ ] **Block Propagation**: Must propagate valid blocks to peers
  - Reference: Gray Paper Section 3
  - Must validate before propagation
  - Must include all required components

- [ ] **State Synchronization**: Must sync state with peers
  - Reference: Gray Paper Section 3
  - Must share validator sets
  - Must share entropy accumulator
  - Must share ticket accumulator

## 8. Security and Consensus Properties

### 8.1 Fork Prevention
- [ ] **Single Author Per Slot**: Must ensure only one validator per timeslot
  - Reference: Gray Paper Section 3
  - Must validate seal signatures
  - Must reject blocks with invalid authors

- [ ] **Ticket Uniqueness**: Must prevent duplicate tickets
  - Reference: Gray Paper Section 3.7
  - Must validate ticket identifiers
  - Must reject duplicate submissions

### 8.2 Entropy Security
- [ ] **VRF Unbiasability**: Must ensure entropy is unbiasable
  - Reference: Gray Paper Section 3.4
  - Must use VRF output for entropy
  - Must accumulate entropy correctly

- [ ] **Future Entropy Protection**: Must protect future entropy
  - Reference: Gray Paper Section 3.4
  - Must use historical entropy for ticket generation
  - Must prevent manipulation of future entropy

## 9. Implementation Compliance

### 9.1 Constants and Parameters
- [ ] **Epoch Length**: Must use `C_epochlen = 600`
- [ ] **Epoch Tail Start**: Must use `C_epochtailstart = 540`
- [ ] **Maximum Ticket Entries**: Must use `C_ticketentries = 1000`
- [ ] **Maximum Block Tickets**: Must use `C_maxblocktickets = 10`

### 9.2 Cryptographic Primitives
- [ ] **Bandersnatch Curve**: Must use correct curve parameters
- [ ] **Ring VRF**: Must implement Ring VRF correctly
- [ ] **Blake Hash**: Must use Blake hash function
- [ ] **Signature Schemes**: Must use correct signature schemes

### 9.3 Error Codes
- [ ] **Error Handling**: Must implement all error codes from Gray Paper
  - Reference: Gray Paper Section 4.1
  - Must handle all error conditions
  - Must provide meaningful error messages

## 10. Testing and Verification

### 10.1 Test Vector Compliance
- [ ] **Official Test Vectors**: Must pass all official test vectors
  - Reference: `jamtestvectors/` submodule
  - Must validate against known good outputs
  - Must handle edge cases correctly

### 10.2 Property-Based Testing
- [ ] **State Transition Properties**: Must maintain all state invariants
- [ ] **Message Validation Properties**: Must reject all invalid messages
- [ ] **Consensus Properties**: Must maintain consensus safety

### 10.3 Integration Testing
- [ ] **End-to-End Testing**: Must work in full network simulation
- [ ] **Performance Testing**: Must handle expected message volumes
- [ ] **Stress Testing**: Must handle network partitions and failures

## Compliance Status

- **Current Implementation**: ✅ Basic structure implemented
- **Missing Components**: 
  - ⚠️ Ring VRF validation temporarily disabled
  - ⚠️ Ticket ordering validation temporarily disabled
  - ⚠️ Some error codes not fully implemented
- **Next Steps**: 
  1. Re-enable VRF validation once fallback hash issue is resolved
  2. Implement full error handling
  3. Add comprehensive test vectors
  4. Implement network protocol layer

## References

- **Gray Paper**: `submodules/graypaper/text/safrole.tex`
- **Serialization**: `submodules/graypaper/text/serialization.tex`
- **Definitions**: `submodules/graypaper/text/definitions.tex`
- **Test Vectors**: `submodules/jamtestvectors/`
- **Current Implementation**: `packages/safrole/src/` 