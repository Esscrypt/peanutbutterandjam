# Fetch Host Call Register Analysis

## Problem
The fetch host call (ECALLI with hostCallId=1) is receiving all required registers set to zero:
- `registers[10]` = 0 (selector)
- `registers[7]` = 0 (outputOffset)
- `registers[8]` = 0 (fromOffset)
- `registers[9]` = 0 (length)

## Expected Behavior
According to `fetch.ts`, the fetch function expects:
- `registers[10]` = selector (0-15 for different fetch types)
- `registers[7]` = outputOffset (memory address where fetched data should be written)
- `registers[8]` = fromOffset (start offset within fetched data)
- `registers[9]` = length (number of bytes to write)

## Trace Analysis

### Before ECALLI (PC 17124)
Looking at the trace before the fetch call:

1. **Lines 851-860**: Multiple `STORE_IND_U64` instructions
   - These write TO memory, not TO registers
   - They use register[0], register[5], register[6] as VALUES
   - They use register[1] as the base address
   - They do NOT set registers 7, 8, 9, 10

2. **Line 861-864**: `LOAD_IMM` sets `register[7] = 0`
   - This explicitly zeros register 7

3. **Line 871-874**: `LOAD_IMM` sets `register[8] = 0`
   - This explicitly zeros register 8

4. **Line 880-883**: `LOAD_IMM` sets `register[9] = 0`
   - This explicitly zeros register 9

5. **Register 10**: Never explicitly set, remains at default value 0

6. **Line 929-937**: `LOAD_IMM` sets `register[0] = 244`
   - This is the host call ID (244 = ECALLI with hostCallId=1)

7. **Line 939**: `ECALLI` with `hostCallId = 1` (fetch)

## Root Cause

The program code is **explicitly zeroing registers 7, 8, 9** before the fetch call, and **never setting register 10**. This suggests:

1. **Missing Instructions**: There should be instructions BEFORE the LOAD_IMM that zero these registers, which should:
   - Load values from memory (using LOAD_IND instructions)
   - Or load immediate values for the actual parameters
   - Or load from the argument data section

2. **Possible Issues**:
   - The program might be incorrectly written
   - Arguments might be expected to be loaded from memory but aren't
   - The program might expect different parameter passing conventions

## Instructions That Should Store Values

Before the fetch call, the program should have instructions that set:
- `register[10]` = selector value (e.g., 0 for system constants)
- `register[7]` = output memory address (where to write fetched data)
- `register[8]` = fromOffset (start offset in fetched data, typically 0)
- `register[9]` = length (how many bytes to write)

### Expected Instruction Pattern

```pvm
// Load selector (0 = system constants)
LOAD_IMM register[10], 0

// Load output offset (memory address where to write)
// This might come from register[1] + offset, or from memory
// Example: LOAD_IND_U64 register[7], register[1], <offset>

// Load fromOffset (typically 0)
LOAD_IMM register[8], 0

// Load length (how many bytes to fetch)
// This might come from a constant or from memory
// Example: LOAD_IMM register[9], <length>
```

## Current Trace Pattern

The current trace shows:
```
LOAD_IMM register[7], 0  // ❌ Should be a memory address
LOAD_IMM register[8], 0  // ✅ OK for fromOffset
LOAD_IMM register[9], 0  // ❌ Should be a positive length
// register[10] never set  // ❌ Should be selector
```

## Questions to Investigate

1. **Should registers 7, 8, 9 be loaded from memory?**
   - Check if there's a standard location where fetch parameters are stored
   - Check if they should be loaded from the argument data section

2. **Is register[10] supposed to be set?**
   - With selector=0, fetch returns system constants
   - But the program should still explicitly set it

3. **Is the program code correct?**
   - The explicit zeroing might be intentional (for initialization)
   - But subsequent instructions should then set the actual values

## Recommendations

1. **Add logging** to see if there are instructions BETWEEN the LOAD_IMM zeroing and the ECALLI that should set these registers
2. **Check the decoded program** to see if there are missing LOAD_IND or LOAD_IMM instructions
3. **Verify argument passing** - check if arguments should be loaded from the argument data section (register[7] points to the start)
4. **Check Gray Paper** for the exact calling convention for fetch host function

