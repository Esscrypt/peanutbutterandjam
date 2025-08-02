# Development Guide

## Quick Start

### Prerequisites

1. **Install Dependencies**:
   ```bash
   bun install
   ```

2. **Initialize Submodules**:
   ```bash
   git submodule init
   git submodule update
   ```

3. **Verify Gray Paper Access**:
   ```bash
   ls graypaper/text/safrole.tex  # Should exist
   ls jamtestvectors/stf/safrole/ # Should exist
   ```

### Development Workflow

1. **Read the Gray Paper**: Always consult the relevant Gray Paper sections before implementing
2. **Use Test Vectors**: Validate your implementation against official test vectors
3. **Follow Implementation Guide**: See [JAM Implementation Guide](.cursor/rules/jam-implementation-guide.mdc)
4. **Adhere to Rules**: Follow [Gray Paper Adherence Rules](.cursor/rules/graypaper-adherence.mdc)

## Key Resources

### Gray Paper Sections

| Component | File | Description |
|-----------|------|-------------|
| **Safrole** | `graypaper/text/safrole.tex` | Consensus protocol |
| **PVM** | `graypaper/text/pvm.tex` | Para Virtual Machine |
| **Work Packages** | `graypaper/text/work_packages_and_reports.tex` | Work package handling |
| **Erasure Coding** | `graypaper/text/erasure_coding.tex` | Data availability |
| **Serialization** | `graypaper/text/serialization.tex` | Data formats |
| **Definitions** | `graypaper/text/definitions.tex` | Protocol definitions |

### Test Vectors

| Component | Directory | Description |
|-----------|-----------|-------------|
| **Safrole** | `jamtestvectors/stf/safrole/` | Consensus tests |
| **PVM** | `jamtestvectors/stf/pvm/` | Virtual machine tests |
| **Erasure Coding** | `jamtestvectors/erasure/` | Data availability tests |
| **Codec** | `jamtestvectors/codec/` | Serialization tests |

## Implementation Checklist

### Before Starting

- [ ] Read relevant Gray Paper sections
- [ ] Review test vector requirements
- [ ] Understand mathematical foundations
- [ ] Plan implementation structure

### During Implementation

- [ ] Follow Gray Paper specifications exactly
- [ ] Reference specific Gray Paper sections in code
- [ ] Implement comprehensive error handling
- [ ] Add detailed documentation
- [ ] Write unit tests

### Before Submission

- [ ] All test vectors pass
- [ ] Documentation is complete
- [ ] Gray Paper compliance verified
- [ ] Performance is acceptable
- [ ] Security review completed

## Testing

### Run Test Vectors

```bash
# Test Safrole consensus
./pbnj test-safrole --vectors=tiny

# Test specific vector
./pbnj test-safrole --vector=publish-tickets-with-mark-1

# Test all components
./pbnj test-all --vectors=full
```

### Validate Test Vector Format

```bash
cd jamtestvectors
./scripts/validate-all.sh
```

### Convert Binary to JSON

```bash
cd jamtestvectors
./scripts/convert-all.sh
```

## Code Standards

### Documentation

```typescript
/**
 * Implements Safrole ticket accumulator as specified in Gray Paper Section 3.1
 * Reference: graypaper/text/safrole.tex
 * 
 * @param tickets - Array of ticket envelopes
 * @param maxSize - Maximum accumulator size
 * @returns Updated accumulator state
 */
function updateTicketAccumulator(tickets: TicketEnvelope[], maxSize: number): AccumulatorState {
  // Implementation follows Gray Paper Section 3.1.2
}
```

### Error Handling

```typescript
/**
 * Error codes as defined in Gray Paper Section 4.1
 * Reference: graypaper/text/safrole.tex
 */
enum SafroleError {
  BAD_SLOT = 0,           // Section 4.1.1
  UNEXPECTED_TICKET = 1,  // Section 4.1.2
  BAD_TICKET_ORDER = 2,   // Section 4.1.3
  BAD_TICKET_PROOF = 3,   // Section 4.1.4
  BAD_TICKET_ATTEMPT = 4, // Section 4.1.5
  DUPLICATE_TICKET = 6    // Section 4.1.6
}
```

### Testing

```typescript
describe('Safrole Ticket Accumulator', () => {
  it('should follow Gray Paper Section 3.1.2', () => {
    // Test implementation against Gray Paper specification
  });
  
  it('should handle edge cases from Section 3.1.3', () => {
    // Test edge cases as specified
  });
});
```

## Common Issues

### Test Vector Failures

**Problem**: Test vectors fail validation
**Solution**: 
1. Check Gray Paper compliance
2. Verify mathematical correctness
3. Ensure state transitions are correct
4. Fix implementation, not test vectors

### Performance Issues

**Problem**: Implementation is too slow
**Solution**:
1. Profile the code
2. Optimize without violating protocol semantics
3. Ensure optimizations preserve correctness
4. Document performance trade-offs

### Documentation Gaps

**Problem**: Missing Gray Paper references
**Solution**:
1. Add specific section references
2. Include mathematical formulas
3. Document implementation decisions
4. Link to relevant test vectors

## Getting Help

- **Gray Paper**: https://graypaper.com/
- **Community Docs**: https://docs.jamcha.in/
- **Test Vectors**: `jamtestvectors/` submodule
- **Implementation Guide**: [JAM Implementation Guide](.cursor/rules/jam-implementation-guide.mdc)

## Remember

- **The Gray Paper is authoritative** - When in doubt, consult the Gray Paper
- **Test vectors are correct** - Fix implementation, not tests
- **Documentation is required** - Always reference Gray Paper sections
- **Performance matters** - But not at the expense of correctness 