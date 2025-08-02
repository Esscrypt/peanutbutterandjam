import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
export class TestVectorProcessor {
    vectorsPath;
    constructor(vectorsPath = 'jamtestvectors') {
        this.vectorsPath = vectorsPath;
    }
    async loadTestVectors(directory) {
        const fullPath = join(this.vectorsPath, directory);
        if (!existsSync(fullPath)) {
            throw new Error(`Test vectors directory not found: ${fullPath}`);
        }
        const vectors = [];
        const files = readdirSync(fullPath);
        for (const file of files) {
            if (file.endsWith('.json')) {
                const path = join(fullPath, file);
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
    async runSafroleTest(vector) {
        // TODO: Implement your Safrole STF logic here
        // This should process the input and produce an output
        // that matches the expected output in the test vector
        const { state, input } = vector;
        // Your Safrole implementation
        const result = await this.executeSafroleSTF(state, input);
        return result;
    }
    async executeSafroleSTF(state, input) {
        // TODO: Implement your Safrole STF logic
        // This is where you'll integrate with your actual implementation
        // Example structure:
        // 1. Validate input against current state
        // 2. Apply state transitions
        // 3. Generate output (epoch marks, ticket marks, etc.)
        // 4. Return result
        console.log('⚠️  Safrole STF implementation required');
        console.log('State:', JSON.stringify(state, null, 2));
        console.log('Input:', JSON.stringify(input, null, 2));
        // For now, return a mock result that will fail validation
        // This helps identify which test vectors need implementation
        return {
            ok: {
                epoch_mark: null,
                tickets_mark: null
            }
        };
    }
    validateResult(vector, result) {
        const expected = vector.output;
        // Compare result with expected output
        const isValid = JSON.stringify(result) === JSON.stringify(expected);
        if (!isValid) {
            console.error(`❌ Test failed: ${vector.name}`);
            console.error('Expected:', JSON.stringify(expected, null, 2));
            console.error('Got:', JSON.stringify(result, null, 2));
        }
        else {
            console.log(`✅ Test passed: ${vector.name}`);
        }
        return isValid;
    }
    async validateTestVectors() {
        console.log('🔍 Validating test vector format...');
        try {
            const { execSync } = await import('child_process');
            execSync('./scripts/validate-all.sh', {
                cwd: this.vectorsPath,
                stdio: 'inherit'
            });
            console.log('✅ Test vectors validation passed');
        }
        catch (error) {
            console.error('❌ Test vectors validation failed:', error);
            throw error;
        }
    }
    async convertBinaryToJson() {
        console.log('🔄 Converting binary test vectors to JSON...');
        try {
            const { execSync } = await import('child_process');
            execSync('./scripts/convert-all.sh', {
                cwd: this.vectorsPath,
                stdio: 'inherit'
            });
            console.log('✅ Binary to JSON conversion completed');
        }
        catch (error) {
            console.error('❌ Binary to JSON conversion failed:', error);
            throw error;
        }
    }
}
//# sourceMappingURL=test-vectors.js.map