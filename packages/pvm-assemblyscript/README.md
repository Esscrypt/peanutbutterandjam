# @pbnj/pvm-assemblyscript

PVM implementation in AssemblyScript that compiles to **true WebAssembly**.

## 🚀 Quick Start

```bash
# Install dependencies
cd packages/pvm-assemblyscript
npm install

# Build WASM module
npm run build

# Run tests
npm test
```

## 📦 What Gets Built

After running `npm run build`, you'll get:

```
build/
├── pvm.wasm              # Optimized WASM binary (release)
├── pvm.wat               # WebAssembly text format (human-readable)
├── pvm.js                # JavaScript loader/bindings
├── pvm.d.ts              # TypeScript definitions
├── pvm.debug.wasm        # Debug WASM binary
└── pvm.debug.wat         # Debug text format
```

## 🔨 Build Commands

```bash
# Build both debug and release
npm run build

# Build only release (optimized)
npm run build:wasm

# Build only debug (with symbols)
npm run asbuild:debug

# Clean build artifacts
npm run clean
```

## 📖 Usage

### In Node.js

```javascript
import { readFileSync } from 'fs';
import { instantiate } from '@assemblyscript/loader';

// Load WASM module
const wasmModule = await instantiate(
  readFileSync('build/pvm.wasm'),
  {}
);

const { exports } = wasmModule;

// Initialize PVM
exports.init();

// Create program in WASM memory
const program = new Uint8Array([/* your PVM bytecode */]);
const programPtr = exports.__new(program.length, 0);
new Uint8Array(exports.memory.buffer, programPtr, program.length).set(program);

// Create registers (13 x 8 bytes)
const registers = new Uint8Array(104);
const registersPtr = exports.__new(104, 0);
new Uint8Array(exports.memory.buffer, registersPtr, 104).set(registers);

// Reset PVM
exports.resetGeneric(programPtr, program.length, registersPtr, 10_000_000n);

// Execute
while (exports.nextStep()) {
  console.log(`PC: ${exports.getProgramCounter()}`);
}

console.log(`Status: ${exports.getStatus()}`);
console.log(`Exit code: ${exports.getExitArg()}`);
```

### In Browser

```html
<script type="module">
import { instantiate } from './build/pvm.js';

// Fetch and instantiate WASM
const response = await fetch('./build/pvm.wasm');
const buffer = await response.arrayBuffer();
const { exports } = await instantiate(buffer);

// Use exports...
exports.init();
console.log('PVM initialized!');
</script>
```

## 🔍 API Reference

### Core Functions

- `init()` - Initialize PVM state
- `resetGeneric(programPtr, programLen, registersPtr, gas)` - Reset with program
- `nextStep()` - Execute one instruction
- `nSteps(steps)` - Execute N instructions

### State Access

- `getProgramCounter()` - Get current PC
- `setProgramCounter(pc)` - Set PC
- `getGasLeft()` - Get remaining gas
- `setGasLeft(gas)` - Set gas
- `getStatus()` - Get execution status
- `getExitArg()` - Get exit code (from r7)

### Register Operations

- `getRegister(index)` - Get single register
- `setRegister(index, value)` - Set single register
- `getRegisters(outputPtr)` - Get all 13 registers (writes 104 bytes)
- `setRegisters(inputPtr)` - Set all 13 registers (reads 104 bytes)

### Memory Operations

- `getPageDump(pageIndex, outputPtr)` - Read 4KB page
- `setMemory(address, dataPtr, dataLen)` - Write to memory

### Memory Management

- `__new(size, id)` - Allocate memory in WASM
- `__pin(ptr)` - Pin memory (prevent GC)
- `__unpin(ptr)` - Unpin memory
- `memory` - Exported WebAssembly.Memory

## 🎯 Current Status

**Phase 1: Basic Structure** ✅
- ✅ Project setup
- ✅ Build configuration
- ✅ Basic API skeleton
- ✅ Memory management
- ✅ Register operations
- ✅ Test framework

**Phase 2: Instruction Implementation** 🚧
- ⏳ Instruction parser
- ⏳ Arithmetic instructions
- ⏳ Memory instructions
- ⏳ Control flow
- ⏳ Host functions

**Phase 3: Full PVM** ⏳
- ⏳ Complete Gray Paper compliance
- ⏳ Test vector validation
- ⏳ Performance optimization
- ⏳ Documentation

## 🔧 Development

### File Structure

```
pvm-assemblyscript/
├── assembly/           # AssemblyScript source
│   ├── index.ts       # Main exports
│   ├── types.ts       # Type definitions (TODO)
│   ├── instructions/  # Instruction implementations (TODO)
│   └── host.ts        # Host functions (TODO)
├── tests/             # Test files
│   └── index.js       # Node.js test runner
├── build/             # Compiled output
├── asconfig.json      # AssemblyScript config
└── package.json
```

### Adding Instructions

1. Create instruction file in `assembly/instructions/`
2. Import and register in `assembly/index.ts`
3. Add tests in `tests/`

### Debugging

```bash
# Build with debug symbols
npm run asbuild:debug

# Inspect WAT (text format)
cat build/pvm.debug.wat

# Use Chrome DevTools
# - Open chrome://inspect
# - Load WASM module
# - Set breakpoints in WAT
```

## 📊 Performance

Expected performance after full implementation:

- **10-100x faster** than JavaScript PVM
- **Near-native speed** for compute operations
- **Small binary size**: ~50-200 KB (vs 500KB+ for JS bundle)
- **Zero runtime overhead**: Pure WebAssembly

## 🔗 Related

- [AssemblyScript Documentation](https://www.assemblyscript.org/)
- [Gray Paper](https://graypaper.com/)
- [PVM TypeScript Implementation](../pvm/)
- [WASM Build Guide](./WASM-BUILD.md)

## 📝 License

Same as main project.

