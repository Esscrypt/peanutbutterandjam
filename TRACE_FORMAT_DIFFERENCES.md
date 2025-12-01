# Trace Format Differences Analysis

## Comparison: jamduna vs Our Implementation

### Format Differences

#### Instruction Lines

**jamduna format:**
```
JUMP 1 5 Gas: 19999999 Registers:[4294901760, 4278059008, 0, 0, 0, 0, 0, 4278124544, 3, 0, 0, 0, 0]
```

**Our format (before fix):**
```
accumulate: JUMP            step:     1 pc:     5 gas:   9999 Registers:[4294901760 4278059008 0 0 0 0 0 4278124544 9 0 0 0 0]
```

**Our format (after fix):**
```
JUMP 1 5 Gas: 9999 Registers:[4294901760, 4278059008, 0, 0, 0, 0, 0, 4278124544, 9, 0, 0, 0, 0]
```

**Key differences:**
1. ✅ **Removed "accumulate:" prefix** - jamduna doesn't use it
2. ✅ **Changed format** - `<INSTRUCTION> <STEP> <PC> Gas: <GAS>` instead of labeled fields
3. ✅ **Comma-separated registers** - `Registers:[val1, val2, ...]` instead of space-separated
4. ⚠️ **Gas values differ** - This is expected (different gas limits/execution paths)
5. ⚠️ **PC values differ** - This is expected (different code execution paths)
6. ⚠️ **Register values differ** - This is expected (different execution states)

#### Host Function Calls

**jamduna format:**
```
Calling host function: FETCH 1 [gas used: 48, gas remaining: 19999952] [service: 0]
ECALLI 38 93898 Gas: 19999952 Registers:[2824, 4278057144, 0, 0, 0, 3, 18446744073709551607, 134, 0, 0, 0, 0, 0]
```

**Our format (before fix):**
```
Calling host function: FETCH 1 [gas used: 10, gas remaining: 9952] [service: 1729]
accumulate: ECALLI          step:    38 pc: 17128 gas:   9952 Registers:[1 4278057384 0 0 0 9 18446744073709551607 200 0 0 0 0 0]
```

**Our format (after fix):**
```
Calling host function: FETCH 1 [gas used: 10, gas remaining: 9952] [service: 1729]
ECALLI 38 17128 Gas: 9952 Registers:[1, 4278057384, 0, 0, 0, 9, 18446744073709551607, 200, 0, 0, 0, 0, 0]
```

**Key differences:**
1. ✅ **Format matches** - Host function call format is correct
2. ⚠️ **Gas used differs** - jamduna shows 48 gas used (includes actual host function execution cost), we show 10 (just base cost)
   - **Note**: This may be because jamduna includes the actual host function execution cost in the gas calculation, while we only capture the base 10 gas cost. The host function may consume additional gas during execution.
3. ⚠️ **Service ID differs** - jamduna shows 0, we show 1729 (this is expected - different test data)

### Filename Structure

**jamduna format:**
```
00000004.log  (8-digit zero-padded block number)
```

**Our format (before fix):**
```
trace-ts-service-1729-1764509155301.log  (timestamp-based)
```

**Our format (after fix):**
```
00000004.log  (if blockNumber provided)
trace-1764509155301.log  (fallback to timestamp if no blockNumber)
```

### Directory Structure

**jamduna structure:**
```
jam-test-vectors/
  0.7.1/
    preimages_light/
      00000001.log
      00000002.log
      00000004.log
      ...
```

**Our structure:**
```
pvm-traces/
  trace-ts-service-1729-1764509155301.log
  trace-wasm-service-1729-1764509155301.log
  ...
```

**Recommendation:** We should organize traces by test vector set and block number to match jamduna structure:
```
pvm-traces/
  preimages_light/
    00000004.log
  accumulate_ready_queued_reports-1/
    00000001.log
```

### Summary of Changes Made

1. ✅ **Removed "accumulate:" prefix** from instruction lines
2. ✅ **Changed instruction format** to match jamduna: `<INSTRUCTION> <STEP> <PC> Gas: <GAS>`
3. ✅ **Changed register format** to comma-separated: `Registers:[val1, val2, ...]`
4. ✅ **Added `generateTraceFilename()` function** to create jamduna-style filenames
5. ✅ **Updated `writeTraceDump()`** to accept `blockNumber` parameter
6. ⚠️ **Host function gas calculation** - May need to include actual host function execution cost, not just base 10 gas

### Remaining Issues

1. **Host function gas calculation**: jamduna shows total gas used including host function execution, we only show base cost. This may be correct if the host function gas is deducted during execution, but we should verify.

2. **Execution differences**: The actual execution traces differ (PC values, register values, gas amounts), which is expected if:
   - Different gas limits are used
   - Different code paths are taken
   - Different initial states

3. **Directory structure**: Consider organizing traces by test vector set to match jamduna structure.

