# State Transition Dependency Graph Analysis

## Gray Paper Dependency Graph (overview.tex, Equations 48-64)

The Gray Paper defines a strict dependency graph for state transitions. The `≺` symbol means "depends on" - the left side must be computed after all items on the right side.

### Core Dependency Sequence

```
1. thetime' ≺ theheader                                    (eq 49)
2. recenthistorypostparentstaterootupdate ≺ (theheader, recenthistory)  (eq 50)
3. entropy' ≺ (theheader, thetime, entropy)              (eq 52)
4. disputes' ≺ (xt_disputes, disputes)                    (eq 55)
5. reportspostjudgement ≺ (xt_disputes, reports)           (eq 56) [removenonpositive]
6. reportspostguarantees ≺ (xt_assurances, reportspostjudgement)  (eq 57)
7. justbecameavailable* ≺ (xt_assurances, reportspostjudgement)   (eq 59)
8. reports' ≺ (xt_guarantees, reportspostguarantees, activeset, thetime')  (eq 58)
9. (ready', accumulated', accountspostxfer, privileges', stagingset', 
   authqueue', lastaccout', accumulationstatistics) ≺ 
   (justbecameavailable*, ready, accumulated, accountspre, privileges, 
    stagingset, authqueue, thetime, thetime')              (eq 60) [ACCUMULATION]
10. recenthistory' ≺ (theheader, xt_guarantees, 
                     recenthistorypostparentstaterootupdate, lastaccout')  (eq 61)
11. accountspostpreimage ≺ (xt_preimages, accountspostxfer, thetime')  (eq 62)
12. authpool' ≺ (theheader, xt_guarantees, authqueue', authpool)  (eq 63)
13. activity' ≺ (xt_guarantees, xt_preimages, xt_assurances, xt_tickets, 
                thetime, activeset', activity, theheader, accumulationstatistics)  (eq 64)
```

### Key Intermediate States

- **reportspostjudgement**: Reports after disputes are applied (removes bad/wonky reports)
- **reportspostguarantees**: Reports after assurances are processed (removes available/timed-out reports)
- **justbecameavailable***: Work reports that became available from assurances
- **accountspostxfer**: Service accounts after accumulation (transfers applied)
- **lastaccout'**: Last accumulation output (from accumulation process)

## Correct Processing Order (According to Gray Paper)

### Phase 1: Early State Updates (Independent)
1. **thetime'** - Update current timeslot (depends only on header)
2. **recenthistorypostparentstaterootupdate** - Update parent state root in recent history
3. **entropy'** - Update entropy accumulator (depends on header, thetime, entropy)
   - Note: Accumulation uses `entropy'` (updated value), so entropy must be updated before accumulation

### Phase 2: Disputes Processing
4. **disputes'** - Apply disputes to disputes state
5. **reportspostjudgement** - Remove disputed work reports from cores (eq:removenonpositive)
   - Remove reports with approval < floor(2/3*Cvalcount) (bad or wonky verdicts)

### Phase 3: Assurances Processing
6. **reportspostguarantees** - Process assurances on reports (after disputes)
   - Remove reports that became available (super-majority) or timed out
7. **justbecameavailable*** - Extract newly available work reports (ρ̂)

### Phase 4: Guarantees Processing
8. **reports'** - Apply guarantees (add new work reports to cores)
   - Depends on: xt_guarantees, reportspostguarantees, activeset, thetime'
   - Note: Guarantees can be PRE-VALIDATED earlier (before assurances) to fail fast

### Phase 5: Accumulation
9. **Accumulation** (eq 60) - Process available work reports
   - Updates: ready', accumulated', accountspostxfer, privileges', stagingset', 
     authqueue', lastaccout', accumulationstatistics
   - Depends on: justbecameavailable*, ready, accumulated, accountspre, privileges,
     stagingset, authqueue, thetime, thetime'
   - **CRITICAL**: Uses `entropy'` (updated entropy), so entropy must be updated before this

### Phase 6: Post-Accumulation Updates
10. **recenthistory'** - Update recent history with accumulation outputs
    - Depends on: theheader, xt_guarantees, recenthistorypostparentstaterootupdate, lastaccout'
11. **accountspostpreimage** - Apply preimages to service accounts
    - Depends on: xt_preimages, accountspostxfer, thetime'
    - **MUST happen AFTER accumulation** (depends on accountspostxfer)
12. **authpool'** - Update authorization pool
    - Depends on: theheader, xt_guarantees, authqueue', authpool
    - **MUST happen AFTER accumulation** (depends on authqueue' from accumulation)

### Phase 7: Final Updates
13. **activity'** - Update statistics
    - Depends on: xt_guarantees, xt_preimages, xt_assurances, xt_tickets, thetime,
      activeset', activity, theheader, accumulationstatistics
    - **MUST happen LAST** (depends on accumulationstatistics)

### Special Cases
- **Tickets (xt_tickets)**: Part of safrole' (eq 51), can be processed early
- **Safrole'**: Depends on entropy', activeset', disputes', so must happen after these

## Current Implementation Analysis

### Current Order in block-importer-service.ts

```typescript
1. validateBlockHeader()
2. Update previous block's state root (for anchor validation)
3. Validate & Apply Disputes
4. Remove disputed work reports (reportspostjudgement) ✓ CORRECT
5. PRE-VALIDATE guarantees (early validation) ✓ CORRECT
6. Validate & Apply Assurances
7. Filter disputed work reports from available reports ✓ CORRECT
8. Apply Guarantees
9. Process winnersMark
10. Apply Tickets
11. Apply Preimages ❌ WRONG ORDER
12. Update Entropy (via event) ⚠️ TIMING ISSUE
13. Update thetime ⚠️ TIMING ISSUE
14. Update Authpool ❌ WRONG ORDER
15. Reset Statistics
16. Accumulation
17. Update accout belt
18. Add to recent history
19. Update Statistics (activity)
```

### Issues Identified

#### ❌ Issue 1: Preimages Applied Before Accumulation
**Current**: Preimages are applied at step 11, BEFORE accumulation (step 16)
**Gray Paper**: `accountspostpreimage ≺ (xt_preimages, accountspostxfer, thetime')` (eq 62)
**Problem**: Preimages depend on `accountspostxfer`, which is produced by accumulation. Preimages must be applied AFTER accumulation.

**Impact**: Preimages may reference service account state that hasn't been updated by accumulation yet.

#### ❌ Issue 2: Authpool Updated Before Accumulation
**Current**: Authpool is updated at step 14, BEFORE accumulation (step 16)
**Gray Paper**: `authpool' ≺ (theheader, xt_guarantees, authqueue', authpool)` (eq 63)
**Problem**: Authpool depends on `authqueue'`, which is produced by accumulation. Authpool must be updated AFTER accumulation.

**Impact**: Authpool may not reflect the correct authqueue state from accumulation.

#### ⚠️ Issue 3: Entropy Update Timing
**Current**: Entropy is updated at step 12, AFTER guarantees/tickets but BEFORE accumulation
**Gray Paper**: 
- `entropy' ≺ (theheader, thetime, entropy)` (eq 52) - can be early
- Accumulation uses `entropy'` (updated value) per pvm_invocations.tex eq 185
**Status**: This is actually CORRECT - entropy must be updated before accumulation uses it.

#### ⚠️ Issue 4: thetime Update Timing
**Current**: thetime is updated at step 13, AFTER entropy but BEFORE accumulation
**Gray Paper**: 
- `thetime' ≺ theheader` (eq 49) - can be very early
- `reports' ≺ (xt_guarantees, reportspostguarantees, activeset, thetime')` (eq 58)
- Accumulation depends on `thetime` and `thetime'` (eq 60)
**Status**: This is CORRECT - thetime can be updated early, and accumulation needs it.

#### ⚠️ Issue 5: Tickets Processing Order
**Current**: Tickets are applied at step 10, after guarantees
**Gray Paper**: `safrole' ≺ (theheader, thetime, xt_tickets, safrole, stagingset, entropy', activeset', disputes')` (eq 51)
**Status**: Tickets are part of safrole and can be processed early. Current order is acceptable but could be earlier.

## Recommended Correct Order

```typescript
1. validateBlockHeader()
2. Update previous block's state root (for anchor validation)
3. Update thetime' (early - depends only on header) ✓
4. Update recenthistorypostparentstaterootupdate ✓
5. Update entropy' (before accumulation uses it) ✓
6. Validate & Apply Disputes
7. Remove disputed work reports (reportspostjudgement) ✓
8. PRE-VALIDATE guarantees (early validation) ✓
9. Validate & Apply Assurances
10. Filter disputed work reports from available reports ✓
11. Apply Guarantees
12. Process winnersMark
13. Apply Tickets (can be earlier, but current position is OK)
14. Reset Statistics (before accumulation)
15. Accumulation (produces accountspostxfer, authqueue', lastaccout', etc.)
16. Update accout belt (depends on lastaccout')
17. Add to recent history (depends on lastaccout')
18. Apply Preimages (MUST be after accumulation - depends on accountspostxfer) ⚠️ FIX
19. Update Authpool (MUST be after accumulation - depends on authqueue') ⚠️ FIX
20. Update Statistics (activity) (depends on accumulationstatistics) ✓
```

## Critical Fixes Required

### Fix 1: Move Preimages After Accumulation
```typescript
// BEFORE (WRONG):
// Apply preimages at step 11
this.serviceAccountService.applyPreimages(...)

// AFTER (CORRECT):
// Apply preimages AFTER accumulation (step 18)
// Move to after accumulation completes
```

### Fix 2: Move Authpool Update After Accumulation
```typescript
// BEFORE (WRONG):
// Update authpool at step 14
this.authPoolService.applyBlockTransition(...)

// AFTER (CORRECT):
// Update authpool AFTER accumulation (step 19)
// Move to after accumulation completes
```

## Dependency Graph Visualization

```
theheader
  ├─> thetime' (early)
  ├─> recenthistorypostparentstaterootupdate
  └─> entropy' (early, before accumulation)

xt_disputes
  └─> disputes'
      └─> reportspostjudgement (removenonpositive)

xt_assurances + reportspostjudgement
  ├─> reportspostguarantees
  └─> justbecameavailable*

xt_guarantees + reportspostguarantees + activeset + thetime'
  └─> reports'

justbecameavailable* + ready + accumulated + ... + thetime + thetime'
  └─> [ACCUMULATION]
      ├─> accountspostxfer
      ├─> authqueue'
      ├─> lastaccout'
      └─> accumulationstatistics

accountspostxfer + xt_preimages + thetime'
  └─> accountspostpreimage

authqueue' + theheader + xt_guarantees + authpool
  └─> authpool'

accumulationstatistics + xt_guarantees + xt_preimages + ...
  └─> activity'
```

## Summary

The current implementation has **2 critical ordering issues**:

1. **Preimages are applied before accumulation** - They should be applied after accumulation since they depend on `accountspostxfer`
2. **Authpool is updated before accumulation** - It should be updated after accumulation since it depends on `authqueue'`

All other operations are in the correct order according to the Gray Paper dependency graph.

