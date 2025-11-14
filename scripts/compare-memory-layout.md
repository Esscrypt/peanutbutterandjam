# Memory Layout Comparison

## Key Differences Between Their Implementation and Ours

### 1. **Read-Only Data Section**

**Their implementation:**
```typescript
readonlyDataStart = SEGMENT_SIZE  // 65536
readonlyDataEnd = SEGMENT_SIZE + alignToPageSize(readOnlyLength)
```

**Our implementation:**
```typescript
roDataAddress = Z_Z  // 65536
roDataAddressEnd = roDataAddress + readOnlyDataSize  // NOT page-aligned!
// But we set access for rnp(len(o)) in initializeMemoryLayout
```

**Difference:** Their `readonlyDataEnd` is page-aligned, ours is not (but we handle padding separately).

### 2. **Heap/Read-Write Data Section**

**Their implementation:**
```typescript
heapDataStart = 2 * SEGMENT_SIZE + alignToSegmentSize(readOnlyLength)
heapDataEnd = heapDataStart + alignToPageSize(heapLength)
heapZerosEnd = heapDataStart + alignToPageSize(heapLength) + noOfHeapZerosPages * PAGE_SIZE
```

**Our implementation:**
```typescript
rwDataAddress = 2 * Z_Z  // Fixed at 131072
rwDataAddressEnd = rwDataAddress + zoneAlign(readOnlyDataSize)  // Based on roLength, not rwLength!
currentHeapPointer = rwDataAddressEnd + Z_P
// Actual rwData starts at: 2*Z_Z + zoneAlign(roLength) (calculated in initializeMemoryLayout)
```

**Major Difference:**
- Their `heapDataStart` = `2*Z_Z + zoneAlign(roLength)` - where actual rwData starts
- Our `rwDataAddress` = `2*Z_Z` - start of rwData region (includes gap)
- Their `heapDataEnd` = `heapDataStart + alignToPageSize(heapLength)` - page-aligned heap length
- Our `rwDataAddressEnd` = `2*Z_Z + zoneAlign(roLength)` - doesn't include heap length!
- Their `heapZerosEnd` includes jump table zeros (`noOfHeapZerosPages * PAGE_SIZE`)
- Our `currentHeapPointer` = `rwDataAddressEnd + Z_P` - doesn't account for heap length or jump table!

**Issue:** Our implementation doesn't account for the actual `rwData.length` when setting `rwDataAddressEnd`. We use `zoneAlign(readOnlyDataSize)` instead of where the actual rwData ends.

### 3. **Stack Section**

**Their implementation:**
```typescript
stackStart = STACK_SEGMENT - alignToPageSize(stackSize)
stackEnd = STACK_SEGMENT  // 0xfefe0000
```

**Our implementation:**
```typescript
stackAddressEnd = 0xffffffff - 2*Z_Z - Z_I + 1  // 0xfefe0000 (STACK_SEGMENT + 1)
stackAddress = stackAddressEnd - rnp_s
```

**Difference:** Their `stackEnd` is `STACK_SEGMENT` (0xfefe0000), ours is `STACK_SEGMENT + 1`. This is an off-by-one difference!

### 4. **Arguments Section**

**Their implementation:**
```typescript
argsStart = ARGS_SEGMENT  // 0xfeff0000
argsEnd = argsStart + alignToPageSize(args.length)
argsZerosEnd = argsEnd + alignToPageSize(args.length)  // BUG: Should be argsStart + alignToPageSize(args.length)?
```

**Our implementation:**
```typescript
outputAddress = 0xffffffff - Z_Z - Z_I + 1  // 0xfeff0000 (ARGS_SEGMENT + 1)
outputEnd = 0xffffffff
```

**Differences:**
1. Their `argsStart` is `ARGS_SEGMENT` (0xfeff0000), ours is `ARGS_SEGMENT + 1`
2. Their `argsZerosEnd` calculation looks wrong - it's `argsEnd + alignToPageSize(args.length)` which would be double the padding
3. Our `outputEnd` is `0xffffffff` (max address), not aligned

### 5. **Register Initialization**

**Their implementation:**
```typescript
regs[0] = LAST_PAGE  // 0xffff0000 (HALT address)
regs[1] = STACK_SEGMENT  // 0xfefe0000
regs[7] = ARGS_SEGMENT  // 0xfeff0000
regs[8] = argsLength
```

**Our implementation:**
```typescript
regs[0] = 2^32 - 2^16  // 0xffff0000 (HALT address) ✓
regs[1] = 2^32 - 2*Z_Z - Z_I  // 0xfefdffff (STACK_SEGMENT - 1) ✗
regs[7] = 2^32 - Z_Z - Z_I  // 0xfefeffff (ARGS_SEGMENT - 1) ✗
regs[8] = argsLength  ✓
```

**Match:** Our registers r1 and r7 match theirs! (We use `0xffffffff - X + 1` which equals `2^32 - X` in bigint arithmetic)

### 6. **Gap Region Handling**

**Their implementation:**
- Doesn't explicitly mention gap region
- `heapDataStart` directly calculates where data starts after zone alignment

**Our implementation:**
- Explicitly clears gap region between `roAlignedEnd` and `rwSectionStart`
- Sets gap pages to 'none' access

## Summary of Issues

1. **Stack/Args address off-by-one:** Our `stackAddressEnd` and `outputAddress` are `+1` compared to their `STACK_SEGMENT` and `ARGS_SEGMENT`
2. **Register initialization off-by-one:** Our r1 and r7 are `-1` compared to theirs
3. **Heap calculation:** Their `heapDataStart` accounts for zone alignment of roLength, our `rwDataAddress` doesn't
4. **Heap length:** Their `heapDataEnd` includes actual heap length, ours doesn't account for it in `rwDataAddressEnd`
5. **Jump table zeros:** Their `heapZerosEnd` includes jump table space, ours doesn't explicitly track this

