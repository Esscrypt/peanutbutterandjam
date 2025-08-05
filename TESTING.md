# Testing Your System Against JAM Test Vectors

This guide explains how to test your PeanutButterAndJam implementation against the official JAM test vectors from the [w3f/jamtestvectors](https://github.com/w3f/jamtestvectors) repository.

## Overview

The JAM test vectors provide comprehensive test cases for validating your implementation of the JAM protocol components:

- **State Transition Functions (STF)**: Safrole, Disputes, History, Assurances, Reports, Statistics, Authorizations, Preimages, Accumulate
- **Codec**: Encoding/decoding tests
- **Erasure Coding**: Data recovery tests
- **Block Import Traces**: Fallback, Safrole, and Work Reports scenarios

## Prerequisites

### 1. Python Dependencies

Install the required Python libraries:

```bash
# Install asn1tools (required for validation)
pip install asn1tools

# Install jam-types (required for binary conversion)
pip install git+https://github.com/davxy/jam-types.git
```

### 2. Submodule Setup

The test vectors are included as a git submodule. If you haven't already, initialize and update the submodule:

```bash
# Initialize submodules (if not already done)
git submodule init
git submodule update

# Or clone with submodules
git clone --recursive https://github.com/your-repo/peanutbutterandjam.git
```

## Test Vector Types

### Tiny Vectors (Recommended for Development)
- **Validators**: 6
- **Cores**: 2
- **Epoch Period**: 12
- **Core Assignment Rotation**: 4
- **Ticket Attempts**: 3

Use these for quick testing and development iterations.

### Full Vectors (Production Validation)
- **Validators**: 1023
- **Cores**: 341
- **Epoch Period**: 600
- **Core Assignment Rotation**: 10
- **Ticket Attempts**: 2

Use these for comprehensive production validation.

## Running Tests

### 1. Validate Test Vector Format

First, validate that the test vectors are properly formatted:

```bash
cd submodules/jamtestvectors
./scripts/validate-all.sh
```

This will run validation scripts for all STF components and verify the JSON files against the ASN.1 schemas.

### 2. Convert Binary to JSON (Optional)

If you prefer to work with JSON format for easier debugging:

```bash
cd submodules/jamtestvectors
./scripts/convert-all.sh
```

This converts all binary test vector files to JSON format.

### 3. Test Specific STF Components

#### Safrole (Consensus Protocol)

Test your Safrole implementation:

```bash
cd submodules/jamtestvectors/stf/safrole

# Test tiny vectors
python3 validate.py

# Run a specific test case
python3 -c "
import json
from safrole import SafroleTestVector

# Load a test vector
with open('tiny/publish-tickets-with-mark-1.json', 'r') as f:
    test_data = json.load(f)

# Create test vector instance
test_vector = SafroleTestVector.from_json(test_data)

# Your implementation should process this test vector
# and produce the expected output
print(f'Input: {test_vector.input}')
print(f'Expected Output: {test_vector.output}')
print(f'Initial State: {test_vector.state}')
"
```

#### Other STF Components

Test other components similarly:

```bash
# Disputes
cd jamtestvectors/stf/disputes
python3 validate.py

# History
cd jamtestvectors/stf/history
python3 validate.py

# Assurances
cd jamtestvectors/stf/assurances
python3 validate.py

# Reports
cd jamtestvectors/stf/reports
python3 validate.py

# Statistics
cd jamtestvectors/stf/statistics
python3 validate.py

# Authorizations
cd jamtestvectors/stf/authorizations
python3 validate.py

# Preimages
cd jamtestvectors/stf/preimages
python3 validate.py

# Accumulate
cd jamtestvectors/stf/accumulate
python3 validate.py
```

## Integration with Your CLI

### 1. Add Test Commands to Your CLI

Extend your CLI to include test vector validation:

```typescript
// In packages/cli/src/commands.ts
export class CommandHandler {
  async execute(command: string, args: any) {
    switch (command) {
      // ... existing commands ...
      
      case 'test-stf':
        await this.testSTF(args);
        break;
        
      case 'test-safrole':
        await this.testSafrole(args);
        break;
        
      case 'test-all':
        await this.testAll(args);
        break;
    }
  }

  private async testSTF(args: any) {
    // Implement STF testing logic
    console.log('Testing State Transition Functions...');
    
    // Load test vectors from jamtestvectors/stf/
    // Run your implementation against each test vector
    // Compare outputs with expected results
  }

  private async testSafrole(args: any) {
    // Implement Safrole-specific testing
    console.log('Testing Safrole consensus protocol...');
    
    // Test tiny vectors first
    const tinyVectors = await this.loadTestVectors('jamtestvectors/stf/safrole/tiny');
    
    for (const vector of tinyVectors) {
      const result = await this.runSafroleTest(vector);
      this.validateResult(vector, result);
    }
  }

  private async testAll(args: any) {
    // Run all test suites
    await this.testSafrole(args);
    // Add other component tests
  }
}
```

### 2. Test Vector Processing

Create a test vector processor:

```typescript
// In packages/cli/src/test-vectors.ts
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export interface TestVector {
  name: string;
  state: any;
  input: any;
  output: any;
  description?: string;
}

export class TestVectorProcessor {
  async loadTestVectors(directory: string): Promise<TestVector[]> {
    const vectors: TestVector[] = [];
    const files = readdirSync(directory);
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        const path = join(directory, file);
        const content = readFileSync(path, 'utf-8');
        const data = JSON.parse(content);
        
        vectors.push({
          name: file.replace('.json', ''),
          state: data.state,
          input: data.input,
          output: data.output,
          description: data.description
        });
      }
    }
    
    return vectors;
  }

  async runSafroleTest(vector: TestVector): Promise<any> {
    // Implement your Safrole STF logic here
    // This should process the input and produce an output
    // that matches the expected output in the test vector
    
    const { state, input } = vector;
    
    // Your Safrole implementation
    const result = await this.executeSafroleSTF(state, input);
    
    return result;
  }

  private async executeSafroleSTF(state: any, input: any): Promise<any> {
    // TODO: Implement your Safrole STF logic
    // This is where you'll integrate with your actual implementation
    
    // Example structure:
    // 1. Validate input against current state
    // 2. Apply state transitions
    // 3. Generate output (epoch marks, ticket marks, etc.)
    // 4. Return result
    
    throw new Error('Safrole STF implementation required');
  }

  validateResult(vector: TestVector, result: any): boolean {
    const expected = vector.output;
    
    // Compare result with expected output
    const isValid = JSON.stringify(result) === JSON.stringify(expected);
    
    if (!isValid) {
      console.error(`❌ Test failed: ${vector.name}`);
      console.error('Expected:', expected);
      console.error('Got:', result);
    } else {
      console.log(`✅ Test passed: ${vector.name}`);
    }
    
    return isValid;
  }
}
```

## Test Execution Workflow

### 1. Development Testing

For quick development iterations:

```bash
# Test with tiny vectors
./pbnj test-safrole --vectors=tiny

# Test specific vector
./pbnj test-safrole --vector=publish-tickets-with-mark-1
```

### 2. Comprehensive Testing

For full validation:

```bash
# Test all components with full vectors
./pbnj test-all --vectors=full

# Test specific component
./pbnj test-stf --component=safrole --vectors=full
```

### 3. Continuous Integration

Add to your CI pipeline:

```yaml
# In .github/workflows/test.yml
- name: Test JAM Vectors
  run: |
    cd jamtestvectors
    ./scripts/validate-all.sh
    
    cd ..
    ./pbnj test-all --vectors=tiny
```

## Understanding Test Results

### Success Indicators
- ✅ All test vectors pass validation
- ✅ Your implementation produces expected outputs
- ✅ No errors in ASN.1 schema validation

### Common Issues
- **Schema Mismatch**: Your implementation doesn't follow the ASN.1 schema
- **State Transition Errors**: Incorrect state updates
- **Output Format Issues**: Wrong output structure or values
- **Timing Issues**: Incorrect slot/epoch progression

### Debugging Tips

1. **Start with Tiny Vectors**: Use tiny vectors for initial development
2. **Check ASN.1 Schema**: Ensure your data structures match the schema
3. **Validate Inputs**: Verify input parsing before processing
4. **Compare State**: Check intermediate state changes
5. **Use JSON Format**: Convert binary vectors to JSON for easier debugging

## Test Vector Categories

### Safrole Test Cases
- **Epoch Changes**: Progress through epochs with/without tickets
- **Ticket Publishing**: Submit and validate tickets
- **Mark Generation**: Create epoch and ticket marks
- **Fallback Mechanisms**: Handle insufficient tickets

### Other Components
- **Disputes**: Handle validator disputes
- **History**: Maintain historical data
- **Assurances**: Process validator assurances
- **Reports**: Handle work reports
- **Statistics**: Track protocol statistics
- **Authorizations**: Manage authorizations
- **Preimages**: Handle preimage submissions
- **Accumulate**: Process accumulation operations

## Next Steps

1. **Implement STF Logic**: Add your Safrole and other STF implementations
2. **Add Test Commands**: Extend your CLI with test vector commands
3. **Run Tiny Tests**: Start with tiny vectors for development
4. **Validate Full Tests**: Use full vectors for production validation
5. **Add CI Integration**: Include test vector validation in your CI pipeline

For more information, refer to the [JAM community documentation](https://docs.jamcha.in/basics/chain-spec) and the [test vectors repository](https://github.com/w3f/jamtestvectors). 