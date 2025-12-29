async function instantiate(module, imports = {}) {
  const adaptedImports = {
    env: Object.assign(Object.create(globalThis), imports.env || {}, {
      abort(message, fileName, lineNumber, columnNumber) {
        // ~lib/builtins/abort(~lib/string/String | null?, ~lib/string/String | null?, u32?, u32?) => void
        message = __liftString(message >>> 0);
        fileName = __liftString(fileName >>> 0);
        lineNumber = lineNumber >>> 0;
        columnNumber = columnNumber >>> 0;
        (() => {
          // @external.js
          throw Error(`${message} in ${fileName}:${lineNumber}:${columnNumber}`);
        })();
      },
      "console.error"(text) {
        // ~lib/bindings/dom/console.error(~lib/string/String) => void
        text = __liftString(text >>> 0);
        console.error(text);
      },
      "console.warn"(text) {
        // ~lib/bindings/dom/console.warn(~lib/string/String) => void
        text = __liftString(text >>> 0);
        console.warn(text);
      },
      "console.info"(text) {
        // ~lib/bindings/dom/console.info(~lib/string/String) => void
        text = __liftString(text >>> 0);
        console.info(text);
      },
      "console.debug"(text) {
        // ~lib/bindings/dom/console.debug(~lib/string/String) => void
        text = __liftString(text >>> 0);
        console.debug(text);
      },
    }),
  };
  const { exports } = await WebAssembly.instantiate(module, adaptedImports);
  const memory = exports.memory || imports.env.memory;
  const adaptedExports = Object.setPrototypeOf({
    RAMType: (values => (
      // assembly/index/RAMType
      values[values.PVMRAM = exports["RAMType.PVMRAM"].valueOf()] = "PVMRAM",
      values[values.SimpleRAM = exports["RAMType.SimpleRAM"].valueOf()] = "SimpleRAM",
      values[values.MockRAM = exports["RAMType.MockRAM"].valueOf()] = "MockRAM",
      values
    ))({}),
    resetGeneric(program, registers, gas) {
      // assembly/index/resetGeneric(~lib/typedarray/Uint8Array, ~lib/typedarray/Uint8Array, u32) => void
      program = __retain(__lowerTypedArray(Uint8Array, 15, 0, program) || __notnull());
      registers = __lowerTypedArray(Uint8Array, 15, 0, registers) || __notnull();
      try {
        exports.resetGeneric(program, registers, gas);
      } finally {
        __release(program);
      }
    },
    resetGenericWithMemory(programPtr, registersPtr, pageMapPtr, chunksPtr, gas) {
      // assembly/index/resetGenericWithMemory(~lib/typedarray/Uint8Array, ~lib/typedarray/Uint8Array, ~lib/typedarray/Uint8Array, ~lib/typedarray/Uint8Array, u32) => void
      programPtr = __retain(__lowerTypedArray(Uint8Array, 15, 0, programPtr) || __notnull());
      registersPtr = __retain(__lowerTypedArray(Uint8Array, 15, 0, registersPtr) || __notnull());
      pageMapPtr = __retain(__lowerTypedArray(Uint8Array, 15, 0, pageMapPtr) || __notnull());
      chunksPtr = __lowerTypedArray(Uint8Array, 15, 0, chunksPtr) || __notnull();
      try {
        exports.resetGenericWithMemory(programPtr, registersPtr, pageMapPtr, chunksPtr, gas);
      } finally {
        __release(programPtr);
        __release(registersPtr);
        __release(pageMapPtr);
      }
    },
    nextStep() {
      // assembly/index/nextStep() => bool
      return exports.nextStep() != 0;
    },
    nSteps(steps) {
      // assembly/index/nSteps(i32) => bool
      return exports.nSteps(steps) != 0;
    },
    runBlob(program) {
      // assembly/index/runBlob(~lib/typedarray/Uint8Array) => void
      program = __lowerTypedArray(Uint8Array, 15, 0, program) || __notnull();
      exports.runBlob(program);
    },
    prepareBlob(program) {
      // assembly/index/prepareBlob(~lib/typedarray/Uint8Array) => void
      program = __lowerTypedArray(Uint8Array, 15, 0, program) || __notnull();
      exports.prepareBlob(program);
    },
    accumulateInvocation(gasLimit, program, args, context, numCores, numValidators, authQueueSize, entropyAccumulator, encodedWorkItems, configNumCores, configPreimageExpungePeriod, configEpochDuration, configMaxBlockGas, configTicketsPerValidator, configSlotDuration, configRotationPeriod, configNumValidators) {
      // assembly/index/accumulateInvocation(u32, ~lib/typedarray/Uint8Array, ~lib/typedarray/Uint8Array, ~lib/typedarray/Uint8Array, i32, i32, i32, ~lib/typedarray/Uint8Array, ~lib/typedarray/Uint8Array, i32?, u32?, u32?, u64?, u16?, u16?, u16?, u16?) => assembly/pvm/AccumulateInvocationResult
      program = __retain(__lowerTypedArray(Uint8Array, 15, 0, program) || __notnull());
      args = __retain(__lowerTypedArray(Uint8Array, 15, 0, args) || __notnull());
      context = __retain(__lowerTypedArray(Uint8Array, 15, 0, context) || __notnull());
      entropyAccumulator = __retain(__lowerTypedArray(Uint8Array, 15, 0, entropyAccumulator) || __notnull());
      encodedWorkItems = __lowerTypedArray(Uint8Array, 15, 0, encodedWorkItems) || __notnull();
      configMaxBlockGas = configMaxBlockGas || 0n;
      try {
        exports.__setArgumentsLength(arguments.length);
        return __liftInternref(exports.accumulateInvocation(gasLimit, program, args, context, numCores, numValidators, authQueueSize, entropyAccumulator, encodedWorkItems, configNumCores, configPreimageExpungePeriod, configEpochDuration, configMaxBlockGas, configTicketsPerValidator, configSlotDuration, configRotationPeriod, configNumValidators) >>> 0);
      } finally {
        __release(program);
        __release(args);
        __release(context);
        __release(entropyAccumulator);
      }
    },
    setupAccumulateInvocation(gasLimit, program, args, context, numCores, numValidators, authQueueSize, entropyAccumulator, encodedWorkItems, configNumCores, configPreimageExpungePeriod, configEpochDuration, configMaxBlockGas, configMaxRefineGas, configMaxTicketsPerExtrinsic, configTicketsPerValidator, configSlotDuration, configRotationPeriod, configNumValidators, configNumEcPiecesPerSegment, configContestDuration, configMaxLookupAnchorage, configEcPieceSize) {
      // assembly/index/setupAccumulateInvocation(u32, ~lib/typedarray/Uint8Array, ~lib/typedarray/Uint8Array, ~lib/typedarray/Uint8Array, i32, i32, i32, ~lib/typedarray/Uint8Array, ~lib/typedarray/Uint8Array, i32?, u32?, u32?, u64?, u64?, u16?, u16?, u16?, u16?, u16?, u32?, u32?, u32?, u32?) => void
      program = __retain(__lowerTypedArray(Uint8Array, 15, 0, program) || __notnull());
      args = __retain(__lowerTypedArray(Uint8Array, 15, 0, args) || __notnull());
      context = __retain(__lowerTypedArray(Uint8Array, 15, 0, context) || __notnull());
      entropyAccumulator = __retain(__lowerTypedArray(Uint8Array, 15, 0, entropyAccumulator) || __notnull());
      encodedWorkItems = __lowerTypedArray(Uint8Array, 15, 0, encodedWorkItems) || __notnull();
      configMaxBlockGas = configMaxBlockGas || 0n;
      configMaxRefineGas = configMaxRefineGas || 0n;
      try {
        exports.__setArgumentsLength(arguments.length);
        exports.setupAccumulateInvocation(gasLimit, program, args, context, numCores, numValidators, authQueueSize, entropyAccumulator, encodedWorkItems, configNumCores, configPreimageExpungePeriod, configEpochDuration, configMaxBlockGas, configMaxRefineGas, configMaxTicketsPerExtrinsic, configTicketsPerValidator, configSlotDuration, configRotationPeriod, configNumValidators, configNumEcPiecesPerSegment, configContestDuration, configMaxLookupAnchorage, configEcPieceSize);
      } finally {
        __release(program);
        __release(args);
        __release(context);
        __release(entropyAccumulator);
      }
    },
    setAccumulateInputs(inputs) {
      // assembly/index/setAccumulateInputs(~lib/array/Array<assembly/codec/AccumulateInput> | null) => void
      inputs = __lowerArray((pointer, value) => { __setU32(pointer, __lowerInternref(value) || __notnull()); }, 51, 2, inputs);
      exports.setAccumulateInputs(inputs);
    },
    runProgram() {
      // assembly/index/runProgram() => assembly/types/RunProgramResult
      return __liftInternref(exports.runProgram() >>> 0);
    },
    getProgramCounter() {
      // assembly/index/getProgramCounter() => u32
      return exports.getProgramCounter() >>> 0;
    },
    getGasLeft() {
      // assembly/index/getGasLeft() => u32
      return exports.getGasLeft() >>> 0;
    },
    setGasLeft(gas) {
      // assembly/index/setGasLeft(i64) => void
      gas = gas || 0n;
      exports.setGasLeft(gas);
    },
    getExitArg() {
      // assembly/index/getExitArg() => u32
      return exports.getExitArg() >>> 0;
    },
    getResultCode() {
      // assembly/index/getResultCode() => u32
      return exports.getResultCode() >>> 0;
    },
    getCode() {
      // assembly/index/getCode() => ~lib/typedarray/Uint8Array
      return __liftTypedArray(Uint8Array, exports.getCode() >>> 0);
    },
    getBitmask() {
      // assembly/index/getBitmask() => ~lib/typedarray/Uint8Array
      return __liftTypedArray(Uint8Array, exports.getBitmask() >>> 0);
    },
    getRegisters() {
      // assembly/index/getRegisters() => ~lib/typedarray/Uint8Array
      return __liftTypedArray(Uint8Array, exports.getRegisters() >>> 0);
    },
    setRegisters(registers) {
      // assembly/index/setRegisters(~lib/array/Array<u8>) => void
      registers = __lowerArray(__setU8, 5, 0, registers) || __notnull();
      exports.setRegisters(registers);
    },
    getRegister(index) {
      // assembly/index/getRegister(u8) => u64
      return BigInt.asUintN(64, exports.getRegister(index));
    },
    setRegister(index, value) {
      // assembly/index/setRegister(u8, u64) => void
      value = value || 0n;
      exports.setRegister(index, value);
    },
    setMemory(address, data) {
      // assembly/index/setMemory(u32, ~lib/typedarray/Uint8Array) => void
      data = __lowerTypedArray(Uint8Array, 15, 0, data) || __notnull();
      exports.setMemory(address, data);
    },
    getAccumulationContext(numCores, numValidators, authQueueSize) {
      // assembly/index/getAccumulationContext(i32, i32, i32) => ~lib/typedarray/Uint8Array
      return __liftTypedArray(Uint8Array, exports.getAccumulationContext(numCores, numValidators, authQueueSize) >>> 0);
    },
    hasAccumulationContext() {
      // assembly/index/hasAccumulationContext() => bool
      return exports.hasAccumulationContext() != 0;
    },
    initializeProgram(program, args) {
      // assembly/index/initializeProgram(~lib/typedarray/Uint8Array, ~lib/typedarray/Uint8Array) => void
      program = __retain(__lowerTypedArray(Uint8Array, 15, 0, program) || __notnull());
      args = __lowerTypedArray(Uint8Array, 15, 0, args) || __notnull();
      try {
        exports.initializeProgram(program, args);
      } finally {
        __release(program);
      }
    },
    alignToPage(size) {
      // assembly/alignment-helpers/alignToPage(u32) => u32
      return exports.alignToPage(size) >>> 0;
    },
    alignToZone(size) {
      // assembly/alignment-helpers/alignToZone(u32) => u32
      return exports.alignToZone(size) >>> 0;
    },
    decodeNatural(data) {
      // assembly/codec/decodeNatural(~lib/typedarray/Uint8Array) => assembly/codec/DecodingResult<u64> | null
      data = __lowerTypedArray(Uint8Array, 15, 0, data) || __notnull();
      return __liftInternref(exports.decodeNatural(data) >>> 0);
    },
    decodeBlob(programBlob) {
      // assembly/codec/decodeBlob(~lib/typedarray/Uint8Array) => assembly/codec/DecodedBlob | null
      programBlob = __lowerTypedArray(Uint8Array, 15, 0, programBlob) || __notnull();
      return __liftInternref(exports.decodeBlob(programBlob) >>> 0);
    },
    decodeServiceCodeFromPreimage(preimageBlob) {
      // assembly/codec/decodeServiceCodeFromPreimage(~lib/typedarray/Uint8Array) => assembly/codec/DecodingResult<assembly/codec/ServiceCodeResult> | null
      preimageBlob = __lowerTypedArray(Uint8Array, 15, 0, preimageBlob) || __notnull();
      return __liftInternref(exports.decodeServiceCodeFromPreimage(preimageBlob) >>> 0);
    },
    decodeProgram(programBlob) {
      // assembly/codec/decodeProgram(~lib/typedarray/Uint8Array) => assembly/codec/DecodedProgram | null
      programBlob = __lowerTypedArray(Uint8Array, 15, 0, programBlob) || __notnull();
      return __liftInternref(exports.decodeProgram(programBlob) >>> 0);
    },
    decodeProgramFromPreimage(preimageBlob) {
      // assembly/codec/decodeProgramFromPreimage(~lib/typedarray/Uint8Array) => assembly/codec/DecodedProgram | null
      preimageBlob = __lowerTypedArray(Uint8Array, 15, 0, preimageBlob) || __notnull();
      return __liftInternref(exports.decodeProgramFromPreimage(preimageBlob) >>> 0);
    },
    encodeServiceAccount(account, major, minor, patch) {
      // assembly/codec/encodeServiceAccount(assembly/codec/ServiceAccountData, i32?, i32?, i32?) => ~lib/typedarray/Uint8Array
      account = __lowerInternref(account) || __notnull();
      exports.__setArgumentsLength(arguments.length);
      return __liftTypedArray(Uint8Array, exports.encodeServiceAccount(account, major, minor, patch) >>> 0);
    },
    decodeServiceAccount(data, major, minor, patch) {
      // assembly/codec/decodeServiceAccount(~lib/typedarray/Uint8Array, i32?, i32?, i32?) => assembly/codec/DecodingResult<assembly/codec/ServiceAccountData> | null
      data = __lowerTypedArray(Uint8Array, 15, 0, data) || __notnull();
      exports.__setArgumentsLength(arguments.length);
      return __liftInternref(exports.decodeServiceAccount(data, major, minor, patch) >>> 0);
    },
    encodeFixedLength(value, length) {
      // assembly/codec/encodeFixedLength(u64, i32) => ~lib/typedarray/Uint8Array
      value = value || 0n;
      return __liftTypedArray(Uint8Array, exports.encodeFixedLength(value, length) >>> 0);
    },
    encodeNatural(value) {
      // assembly/codec/encodeNatural(u64) => ~lib/typedarray/Uint8Array
      value = value || 0n;
      return __liftTypedArray(Uint8Array, exports.encodeNatural(value) >>> 0);
    },
    encodeRefineContext(context) {
      // assembly/codec/encodeRefineContext(assembly/codec/RefineContext) => ~lib/typedarray/Uint8Array
      context = __lowerInternref(context) || __notnull();
      return __liftTypedArray(Uint8Array, exports.encodeRefineContext(context) >>> 0);
    },
    encodeImportReference(importRef) {
      // assembly/codec/encodeImportReference(assembly/codec/ImportSegment) => ~lib/typedarray/Uint8Array
      importRef = __lowerInternref(importRef) || __notnull();
      return __liftTypedArray(Uint8Array, exports.encodeImportReference(importRef) >>> 0);
    },
    encodeExtrinsicReference(extrinsicRef) {
      // assembly/codec/encodeExtrinsicReference(assembly/codec/ExtrinsicReference) => ~lib/typedarray/Uint8Array
      extrinsicRef = __lowerInternref(extrinsicRef) || __notnull();
      return __liftTypedArray(Uint8Array, exports.encodeExtrinsicReference(extrinsicRef) >>> 0);
    },
    encodeVariableSequence(sequence) {
      // assembly/codec/encodeVariableSequence(~lib/array/Array<~lib/typedarray/Uint8Array>) => ~lib/typedarray/Uint8Array
      sequence = __lowerArray((pointer, value) => { __setU32(pointer, __lowerTypedArray(Uint8Array, 15, 0, value) || __notnull()); }, 41, 2, sequence) || __notnull();
      return __liftTypedArray(Uint8Array, exports.encodeVariableSequence(sequence) >>> 0);
    },
    encodeWorkItem(workItem) {
      // assembly/codec/encodeWorkItem(assembly/codec/WorkItem) => ~lib/typedarray/Uint8Array
      workItem = __lowerInternref(workItem) || __notnull();
      return __liftTypedArray(Uint8Array, exports.encodeWorkItem(workItem) >>> 0);
    },
    encodeWorkItemSummary(workItem) {
      // assembly/codec/encodeWorkItemSummary(assembly/codec/WorkItem) => ~lib/typedarray/Uint8Array
      workItem = __lowerInternref(workItem) || __notnull();
      return __liftTypedArray(Uint8Array, exports.encodeWorkItemSummary(workItem) >>> 0);
    },
    decodeImportReference(data) {
      // assembly/codec/decodeImportReference(~lib/typedarray/Uint8Array) => assembly/codec/DecodingResult<assembly/codec/ImportSegment> | null
      data = __lowerTypedArray(Uint8Array, 15, 0, data) || __notnull();
      return __liftInternref(exports.decodeImportReference(data) >>> 0);
    },
    decodeExtrinsicReference(data) {
      // assembly/codec/decodeExtrinsicReference(~lib/typedarray/Uint8Array) => assembly/codec/DecodingResult<assembly/codec/ExtrinsicReference> | null
      data = __lowerTypedArray(Uint8Array, 15, 0, data) || __notnull();
      return __liftInternref(exports.decodeExtrinsicReference(data) >>> 0);
    },
    decodeWorkItem(data) {
      // assembly/codec/decodeWorkItem(~lib/typedarray/Uint8Array) => assembly/codec/DecodingResult<assembly/codec/WorkItem> | null
      data = __lowerTypedArray(Uint8Array, 15, 0, data) || __notnull();
      return __liftInternref(exports.decodeWorkItem(data) >>> 0);
    },
    encodeWorkPackage(workPackage) {
      // assembly/codec/encodeWorkPackage(assembly/codec/WorkPackage) => ~lib/typedarray/Uint8Array
      workPackage = __lowerInternref(workPackage) || __notnull();
      return __liftTypedArray(Uint8Array, exports.encodeWorkPackage(workPackage) >>> 0);
    },
    decodeAccumulateArgs(args) {
      // assembly/codec/decodeAccumulateArgs(~lib/typedarray/Uint8Array) => assembly/codec/DecodingResult<assembly/codec/DecodedAccumulateArgs> | null
      args = __lowerTypedArray(Uint8Array, 15, 0, args) || __notnull();
      return __liftInternref(exports.decodeAccumulateArgs(args) >>> 0);
    },
    decodeFixedLength(data, length) {
      // assembly/codec/decodeFixedLength(~lib/typedarray/Uint8Array, i32) => assembly/codec/DecodingResult<u64> | null
      data = __lowerTypedArray(Uint8Array, 15, 0, data) || __notnull();
      return __liftInternref(exports.decodeFixedLength(data, length) >>> 0);
    },
    decodeVariableLength(data) {
      // assembly/codec/decodeVariableLength(~lib/typedarray/Uint8Array) => assembly/codec/DecodingResult<~lib/typedarray/Uint8Array> | null
      data = __lowerTypedArray(Uint8Array, 15, 0, data) || __notnull();
      return __liftInternref(exports.decodeVariableLength(data) >>> 0);
    },
    decodeVariableSequence(data, elementDecoder) {
      // assembly/codec/decodeVariableSequence<u32>(~lib/typedarray/Uint8Array, (~lib/typedarray/Uint8Array) => assembly/codec/DecodingResult<u32> | null) => assembly/codec/DecodingResult<~lib/array/Array<u32>> | null
      data = __retain(__lowerTypedArray(Uint8Array, 15, 0, data) || __notnull());
      elementDecoder = __lowerInternref(elementDecoder) || __notnull();
      try {
        return __liftInternref(exports.decodeVariableSequence(data, elementDecoder) >>> 0);
      } finally {
        __release(data);
      }
    },
    decodeVariableSequence(data, elementDecoder) {
      // assembly/codec/decodeVariableSequence<assembly/codec/DeferredTransfer>(~lib/typedarray/Uint8Array, (~lib/typedarray/Uint8Array) => assembly/codec/DecodingResult<assembly/codec/DeferredTransfer> | null) => assembly/codec/DecodingResult<~lib/array/Array<assembly/codec/DeferredTransfer>> | null
      data = __retain(__lowerTypedArray(Uint8Array, 15, 0, data) || __notnull());
      elementDecoder = __lowerInternref(elementDecoder) || __notnull();
      try {
        return __liftInternref(exports.decodeVariableSequence(data, elementDecoder) >>> 0);
      } finally {
        __release(data);
      }
    },
    decodeVariableSequence(data, elementDecoder) {
      // assembly/codec/decodeVariableSequence<assembly/codec/ProvisionEntry>(~lib/typedarray/Uint8Array, (~lib/typedarray/Uint8Array) => assembly/codec/DecodingResult<assembly/codec/ProvisionEntry> | null) => assembly/codec/DecodingResult<~lib/array/Array<assembly/codec/ProvisionEntry>> | null
      data = __retain(__lowerTypedArray(Uint8Array, 15, 0, data) || __notnull());
      elementDecoder = __lowerInternref(elementDecoder) || __notnull();
      try {
        return __liftInternref(exports.decodeVariableSequence(data, elementDecoder) >>> 0);
      } finally {
        __release(data);
      }
    },
    decodeVariableSequence(data, elementDecoder) {
      // assembly/codec/decodeVariableSequence<assembly/codec/AccumulateInput>(~lib/typedarray/Uint8Array, (~lib/typedarray/Uint8Array) => assembly/codec/DecodingResult<assembly/codec/AccumulateInput> | null) => assembly/codec/DecodingResult<~lib/array/Array<assembly/codec/AccumulateInput>> | null
      data = __retain(__lowerTypedArray(Uint8Array, 15, 0, data) || __notnull());
      elementDecoder = __lowerInternref(elementDecoder) || __notnull();
      try {
        return __liftInternref(exports.decodeVariableSequence(data, elementDecoder) >>> 0);
      } finally {
        __release(data);
      }
    },
    decodeCompleteServiceAccount(data) {
      // assembly/codec/decodeCompleteServiceAccount(~lib/typedarray/Uint8Array) => assembly/codec/DecodingResult<assembly/codec/CompleteServiceAccount> | null
      data = __lowerTypedArray(Uint8Array, 15, 0, data) || __notnull();
      return __liftInternref(exports.decodeCompleteServiceAccount(data) >>> 0);
    },
    decodePartialState(data, numCores, numValidators, authQueueSize) {
      // assembly/codec/decodePartialState(~lib/typedarray/Uint8Array, i32, i32, i32) => assembly/codec/DecodingResult<assembly/codec/PartialState> | null
      data = __lowerTypedArray(Uint8Array, 15, 0, data) || __notnull();
      return __liftInternref(exports.decodePartialState(data, numCores, numValidators, authQueueSize) >>> 0);
    },
    decodeDeferredTransfer(data) {
      // assembly/codec/decodeDeferredTransfer(~lib/typedarray/Uint8Array) => assembly/codec/DecodingResult<assembly/codec/DeferredTransfer> | null
      data = __lowerTypedArray(Uint8Array, 15, 0, data) || __notnull();
      return __liftInternref(exports.decodeDeferredTransfer(data) >>> 0);
    },
    decodeImplications(data, numCores, numValidators, authQueueSize) {
      // assembly/codec/decodeImplications(~lib/typedarray/Uint8Array, i32, i32, i32) => assembly/codec/DecodingResult<assembly/codec/Implications> | null
      data = __lowerTypedArray(Uint8Array, 15, 0, data) || __notnull();
      return __liftInternref(exports.decodeImplications(data, numCores, numValidators, authQueueSize) >>> 0);
    },
    decodeImplicationsPair(data, numCores, numValidators, authQueueSize) {
      // assembly/codec/decodeImplicationsPair(~lib/typedarray/Uint8Array, i32, i32, i32) => assembly/codec/DecodingResult<assembly/codec/ImplicationsPair> | null
      data = __lowerTypedArray(Uint8Array, 15, 0, data) || __notnull();
      return __liftInternref(exports.decodeImplicationsPair(data, numCores, numValidators, authQueueSize) >>> 0);
    },
    encodeOptional(value, encoder) {
      // assembly/codec/encodeOptional(~lib/typedarray/Uint8Array | null, (~lib/typedarray/Uint8Array) => ~lib/typedarray/Uint8Array) => ~lib/typedarray/Uint8Array
      value = __retain(__lowerTypedArray(Uint8Array, 15, 0, value));
      encoder = __lowerInternref(encoder) || __notnull();
      try {
        return __liftTypedArray(Uint8Array, exports.encodeOptional(value, encoder) >>> 0);
      } finally {
        __release(value);
      }
    },
    encodeDeferredTransfer(transfer) {
      // assembly/codec/encodeDeferredTransfer(assembly/codec/DeferredTransfer) => ~lib/typedarray/Uint8Array
      transfer = __lowerInternref(transfer) || __notnull();
      return __liftTypedArray(Uint8Array, exports.encodeDeferredTransfer(transfer) >>> 0);
    },
    encodeWorkResult(resultType, result) {
      // assembly/codec/encodeWorkResult(u8, ~lib/typedarray/Uint8Array) => ~lib/typedarray/Uint8Array
      result = __lowerTypedArray(Uint8Array, 15, 0, result) || __notnull();
      return __liftTypedArray(Uint8Array, exports.encodeWorkResult(resultType, result) >>> 0);
    },
    encodeOperandTuple(ot) {
      // assembly/codec/encodeOperandTuple(assembly/codec/OperandTuple) => ~lib/typedarray/Uint8Array
      ot = __lowerInternref(ot) || __notnull();
      return __liftTypedArray(Uint8Array, exports.encodeOperandTuple(ot) >>> 0);
    },
    encodeAccumulateInput(input) {
      // assembly/codec/encodeAccumulateInput(assembly/codec/AccumulateInput) => ~lib/typedarray/Uint8Array
      input = __lowerInternref(input) || __notnull();
      return __liftTypedArray(Uint8Array, exports.encodeAccumulateInput(input) >>> 0);
    },
    decodeWorkResult(data) {
      // assembly/codec/decodeWorkResult(~lib/typedarray/Uint8Array) => assembly/codec/DecodingResult<assembly/codec/OperandTuple> | null
      data = __lowerTypedArray(Uint8Array, 15, 0, data) || __notnull();
      return __liftInternref(exports.decodeWorkResult(data) >>> 0);
    },
    decodeOperandTuple(data) {
      // assembly/codec/decodeOperandTuple(~lib/typedarray/Uint8Array) => assembly/codec/DecodingResult<assembly/codec/OperandTuple> | null
      data = __lowerTypedArray(Uint8Array, 15, 0, data) || __notnull();
      return __liftInternref(exports.decodeOperandTuple(data) >>> 0);
    },
    decodeAccumulateInput(data) {
      // assembly/codec/decodeAccumulateInput(~lib/typedarray/Uint8Array) => assembly/codec/DecodingResult<assembly/codec/AccumulateInput> | null
      data = __lowerTypedArray(Uint8Array, 15, 0, data) || __notnull();
      return __liftInternref(exports.decodeAccumulateInput(data) >>> 0);
    },
    encodeVariableSequenceGeneric(sequence, elementEncoder) {
      // assembly/codec/encodeVariableSequenceGeneric<u32>(~lib/array/Array<u32>, (u32) => ~lib/typedarray/Uint8Array) => ~lib/typedarray/Uint8Array
      sequence = __retain(__lowerArray(__setU32, 14, 2, sequence) || __notnull());
      elementEncoder = __lowerInternref(elementEncoder) || __notnull();
      try {
        return __liftTypedArray(Uint8Array, exports.encodeVariableSequenceGeneric(sequence, elementEncoder) >>> 0);
      } finally {
        __release(sequence);
      }
    },
    encodeVariableSequenceGeneric(sequence, elementEncoder) {
      // assembly/codec/encodeVariableSequenceGeneric<assembly/codec/DeferredTransfer>(~lib/array/Array<assembly/codec/DeferredTransfer>, (assembly/codec/DeferredTransfer) => ~lib/typedarray/Uint8Array) => ~lib/typedarray/Uint8Array
      sequence = __retain(__lowerArray((pointer, value) => { __setU32(pointer, __lowerInternref(value) || __notnull()); }, 46, 2, sequence) || __notnull());
      elementEncoder = __lowerInternref(elementEncoder) || __notnull();
      try {
        return __liftTypedArray(Uint8Array, exports.encodeVariableSequenceGeneric(sequence, elementEncoder) >>> 0);
      } finally {
        __release(sequence);
      }
    },
    encodeVariableSequenceGeneric(sequence, elementEncoder) {
      // assembly/codec/encodeVariableSequenceGeneric<assembly/codec/ProvisionEntry>(~lib/array/Array<assembly/codec/ProvisionEntry>, (assembly/codec/ProvisionEntry) => ~lib/typedarray/Uint8Array) => ~lib/typedarray/Uint8Array
      sequence = __retain(__lowerArray((pointer, value) => { __setU32(pointer, __lowerInternref(value) || __notnull()); }, 48, 2, sequence) || __notnull());
      elementEncoder = __lowerInternref(elementEncoder) || __notnull();
      try {
        return __liftTypedArray(Uint8Array, exports.encodeVariableSequenceGeneric(sequence, elementEncoder) >>> 0);
      } finally {
        __release(sequence);
      }
    },
    encodeVariableSequenceGeneric(sequence, elementEncoder) {
      // assembly/codec/encodeVariableSequenceGeneric<assembly/codec/AccumulateInput>(~lib/array/Array<assembly/codec/AccumulateInput>, (assembly/codec/AccumulateInput) => ~lib/typedarray/Uint8Array) => ~lib/typedarray/Uint8Array
      sequence = __retain(__lowerArray((pointer, value) => { __setU32(pointer, __lowerInternref(value) || __notnull()); }, 51, 2, sequence) || __notnull());
      elementEncoder = __lowerInternref(elementEncoder) || __notnull();
      try {
        return __liftTypedArray(Uint8Array, exports.encodeVariableSequenceGeneric(sequence, elementEncoder) >>> 0);
      } finally {
        __release(sequence);
      }
    },
    encodeCompleteServiceAccount(account) {
      // assembly/codec/encodeCompleteServiceAccount(assembly/codec/CompleteServiceAccount) => ~lib/typedarray/Uint8Array
      account = __lowerInternref(account) || __notnull();
      return __liftTypedArray(Uint8Array, exports.encodeCompleteServiceAccount(account) >>> 0);
    },
    encodePartialState(state, numCores, numValidators, authQueueSize) {
      // assembly/codec/encodePartialState(assembly/codec/PartialState, i32, i32, i32) => ~lib/typedarray/Uint8Array
      state = __lowerInternref(state) || __notnull();
      return __liftTypedArray(Uint8Array, exports.encodePartialState(state, numCores, numValidators, authQueueSize) >>> 0);
    },
    encodeImplications(implications, numCores, numValidators, authQueueSize) {
      // assembly/codec/encodeImplications(assembly/codec/Implications, i32, i32, i32) => ~lib/typedarray/Uint8Array
      implications = __lowerInternref(implications) || __notnull();
      return __liftTypedArray(Uint8Array, exports.encodeImplications(implications, numCores, numValidators, authQueueSize) >>> 0);
    },
    encodeImplicationsPair(pair, numCores, numValidators, authQueueSize) {
      // assembly/codec/encodeImplicationsPair(assembly/codec/ImplicationsPair, i32, i32, i32) => ~lib/typedarray/Uint8Array
      pair = __lowerInternref(pair) || __notnull();
      return __liftTypedArray(Uint8Array, exports.encodeImplicationsPair(pair, numCores, numValidators, authQueueSize) >>> 0);
    },
    DEFAULT_GAS_LIMIT: {
      // assembly/config/DEFAULT_GAS_LIMIT: u32
      valueOf() { return this.value; },
      get value() {
        return exports.DEFAULT_GAS_LIMIT.value >>> 0;
      }
    },
    MIN_GAS_COST: {
      // assembly/config/MIN_GAS_COST: u32
      valueOf() { return this.value; },
      get value() {
        return exports.MIN_GAS_COST.value >>> 0;
      }
    },
    MAX_GAS_COST: {
      // assembly/config/MAX_GAS_COST: u32
      valueOf() { return this.value; },
      get value() {
        return exports.MAX_GAS_COST.value >>> 0;
      }
    },
    RESERVED_MEMORY_END: {
      // assembly/config/RESERVED_MEMORY_END: u32
      valueOf() { return this.value; },
      get value() {
        return exports.RESERVED_MEMORY_END.value >>> 0;
      }
    },
    MAX_MEMORY_ADDRESS: {
      // assembly/config/MAX_MEMORY_ADDRESS: u32
      valueOf() { return this.value; },
      get value() {
        return exports.MAX_MEMORY_ADDRESS.value >>> 0;
      }
    },
    INITIAL_ZONE_SIZE: {
      // assembly/config/INITIAL_ZONE_SIZE: u32
      valueOf() { return this.value; },
      get value() {
        return exports.INITIAL_ZONE_SIZE.value >>> 0;
      }
    },
    PAGE_SIZE: {
      // assembly/config/PAGE_SIZE: u32
      valueOf() { return this.value; },
      get value() {
        return exports.PAGE_SIZE.value >>> 0;
      }
    },
    DYNAMIC_ADDRESS_ALIGNMENT: {
      // assembly/config/DYNAMIC_ADDRESS_ALIGNMENT: u32
      valueOf() { return this.value; },
      get value() {
        return exports.DYNAMIC_ADDRESS_ALIGNMENT.value >>> 0;
      }
    },
    ZONE_SIZE: {
      // assembly/config/ZONE_SIZE: u32
      valueOf() { return this.value; },
      get value() {
        return exports.ZONE_SIZE.value >>> 0;
      }
    },
    INIT_INPUT_SIZE: {
      // assembly/config/INIT_INPUT_SIZE: u32
      valueOf() { return this.value; },
      get value() {
        return exports.INIT_INPUT_SIZE.value >>> 0;
      }
    },
    HALT_ADDRESS: {
      // assembly/config/HALT_ADDRESS: u32
      valueOf() { return this.value; },
      get value() {
        return exports.HALT_ADDRESS.value >>> 0;
      }
    },
    STACK_SEGMENT_END: {
      // assembly/config/STACK_SEGMENT_END: u32
      valueOf() { return this.value; },
      get value() {
        return exports.STACK_SEGMENT_END.value >>> 0;
      }
    },
    ARGS_SEGMENT_START: {
      // assembly/config/ARGS_SEGMENT_START: u32
      valueOf() { return this.value; },
      get value() {
        return exports.ARGS_SEGMENT_START.value >>> 0;
      }
    },
    PACKAGE_AUTH_GAS: {
      // assembly/config/PACKAGE_AUTH_GAS: u32
      valueOf() { return this.value; },
      get value() {
        return exports.PACKAGE_AUTH_GAS.value >>> 0;
      }
    },
    MAX_AUTH_CODE_SIZE: {
      // assembly/config/MAX_AUTH_CODE_SIZE: u32
      valueOf() { return this.value; },
      get value() {
        return exports.MAX_AUTH_CODE_SIZE.value >>> 0;
      }
    },
    PACKAGE_REF_GAS: {
      // assembly/config/PACKAGE_REF_GAS: u64
      valueOf() { return this.value; },
      get value() {
        return BigInt.asUintN(64, exports.PACKAGE_REF_GAS.value);
      }
    },
    MAX_SERVICE_CODE_SIZE: {
      // assembly/config/MAX_SERVICE_CODE_SIZE: u32
      valueOf() { return this.value; },
      get value() {
        return exports.MAX_SERVICE_CODE_SIZE.value >>> 0;
      }
    },
    SEGMENT_SIZE: {
      // assembly/config/SEGMENT_SIZE: u32
      valueOf() { return this.value; },
      get value() {
        return exports.SEGMENT_SIZE.value >>> 0;
      }
    },
    MAX_PACKAGE_EXPORTS: {
      // assembly/config/MAX_PACKAGE_EXPORTS: u32
      valueOf() { return this.value; },
      get value() {
        return exports.MAX_PACKAGE_EXPORTS.value >>> 0;
      }
    },
    MIN_PUBLIC_INDEX: {
      // assembly/config/MIN_PUBLIC_INDEX: u32
      valueOf() { return this.value; },
      get value() {
        return exports.MIN_PUBLIC_INDEX.value >>> 0;
      }
    },
    isTerminationInstruction(opcode) {
      // assembly/config/isTerminationInstruction(u8) => bool
      return exports.isTerminationInstruction(opcode) != 0;
    },
    REGISTER_INIT_STACK_SEGMENT_END() {
      // assembly/config/REGISTER_INIT_STACK_SEGMENT_END() => u32
      return exports.REGISTER_INIT_STACK_SEGMENT_END() >>> 0;
    },
    REGISTER_INIT_ARGS_SEGMENT_START() {
      // assembly/config/REGISTER_INIT_ARGS_SEGMENT_START() => u32
      return exports.REGISTER_INIT_ARGS_SEGMENT_START() >>> 0;
    },
    MemoryAccessType: (values => (
      // assembly/types/MemoryAccessType
      values[values.NONE = exports["MemoryAccessType.NONE"].valueOf()] = "NONE",
      values[values.READ = exports["MemoryAccessType.READ"].valueOf()] = "READ",
      values[values.WRITE = exports["MemoryAccessType.WRITE"].valueOf()] = "WRITE",
      values
    ))({}),
    bytesToHex(bytes) {
      // assembly/types/bytesToHex(~lib/typedarray/Uint8Array) => ~lib/string/String
      bytes = __lowerTypedArray(Uint8Array, 15, 0, bytes) || __notnull();
      return __liftString(exports.bytesToHex(bytes) >>> 0);
    },
    Status: (values => (
      // assembly/wasm-wrapper/Status
      values[values.OK = exports["Status.OK"].valueOf()] = "OK",
      values[values.HALT = exports["Status.HALT"].valueOf()] = "HALT",
      values[values.PANIC = exports["Status.PANIC"].valueOf()] = "PANIC",
      values[values.FAULT = exports["Status.FAULT"].valueOf()] = "FAULT",
      values[values.HOST = exports["Status.HOST"].valueOf()] = "HOST",
      values[values.OOG = exports["Status.OOG"].valueOf()] = "OOG",
      values
    ))({}),
    createPvmShell() {
      // assembly/wasm-wrapper/createPvmShell() => assembly/wasm-wrapper/WasmPvmShellInterface
      return __liftRecord9(exports.createPvmShell() >>> 0);
    },
    roundTripSingleImplications(data, numCores, numValidators, authQueueSize) {
      // assembly/test-exports/roundTripSingleImplications(~lib/typedarray/Uint8Array, i32, i32, i32) => ~lib/typedarray/Uint8Array
      data = __lowerTypedArray(Uint8Array, 15, 0, data) || __notnull();
      return __liftTypedArray(Uint8Array, exports.roundTripSingleImplications(data, numCores, numValidators, authQueueSize) >>> 0);
    },
    roundTripImplications(data, numCores, numValidators, authQueueSize) {
      // assembly/test-exports/roundTripImplications(~lib/typedarray/Uint8Array, i32, i32, i32) => ~lib/typedarray/Uint8Array
      data = __lowerTypedArray(Uint8Array, 15, 0, data) || __notnull();
      return __liftTypedArray(Uint8Array, exports.roundTripImplications(data, numCores, numValidators, authQueueSize) >>> 0);
    },
    roundTripServiceAccount(data) {
      // assembly/test-exports/roundTripServiceAccount(~lib/typedarray/Uint8Array) => ~lib/typedarray/Uint8Array
      data = __lowerTypedArray(Uint8Array, 15, 0, data) || __notnull();
      return __liftTypedArray(Uint8Array, exports.roundTripServiceAccount(data) >>> 0);
    },
    roundTripPartialState(data, numCores, numValidators, authQueueSize) {
      // assembly/test-exports/roundTripPartialState(~lib/typedarray/Uint8Array, i32, i32, i32) => ~lib/typedarray/Uint8Array
      data = __lowerTypedArray(Uint8Array, 15, 0, data) || __notnull();
      return __liftTypedArray(Uint8Array, exports.roundTripPartialState(data, numCores, numValidators, authQueueSize) >>> 0);
    },
    getDecodedProgramFields(preimageBlob) {
      // assembly/test-exports/getDecodedProgramFields(~lib/typedarray/Uint8Array) => assembly/test-exports/DecodedProgramFields | null
      preimageBlob = __lowerTypedArray(Uint8Array, 15, 0, preimageBlob) || __notnull();
      return __liftInternref(exports.getDecodedProgramFields(preimageBlob) >>> 0);
    },
    roundTripAccumulateInputs(data) {
      // assembly/test-exports/roundTripAccumulateInputs(~lib/typedarray/Uint8Array) => ~lib/typedarray/Uint8Array
      data = __lowerTypedArray(Uint8Array, 15, 0, data) || __notnull();
      return __liftTypedArray(Uint8Array, exports.roundTripAccumulateInputs(data) >>> 0);
    },
    roundTripSingleAccumulateInput(data) {
      // assembly/test-exports/roundTripSingleAccumulateInput(~lib/typedarray/Uint8Array) => ~lib/typedarray/Uint8Array
      data = __lowerTypedArray(Uint8Array, 15, 0, data) || __notnull();
      return __liftTypedArray(Uint8Array, exports.roundTripSingleAccumulateInput(data) >>> 0);
    },
  }, exports);
  function __liftRecord9(pointer) {
    // assembly/wasm-wrapper/WasmPvmShellInterface
    // Hint: Opt-out from lifting as a record by providing an empty constructor
    if (!pointer) return null;
    return {
    };
  }
  function __liftString(pointer) {
    if (!pointer) return null;
    const
      end = pointer + new Uint32Array(memory.buffer)[pointer - 4 >>> 2] >>> 1,
      memoryU16 = new Uint16Array(memory.buffer);
    let
      start = pointer >>> 1,
      string = "";
    while (end - start > 1024) string += String.fromCharCode(...memoryU16.subarray(start, start += 1024));
    return string + String.fromCharCode(...memoryU16.subarray(start, end));
  }
  function __lowerArray(lowerElement, id, align, values) {
    if (values == null) return 0;
    const
      length = values.length,
      buffer = exports.__pin(exports.__new(length << align, 1)) >>> 0,
      header = exports.__pin(exports.__new(16, id)) >>> 0;
    __setU32(header + 0, buffer);
    __dataview.setUint32(header + 4, buffer, true);
    __dataview.setUint32(header + 8, length << align, true);
    __dataview.setUint32(header + 12, length, true);
    for (let i = 0; i < length; ++i) lowerElement(buffer + (i << align >>> 0), values[i]);
    exports.__unpin(buffer);
    exports.__unpin(header);
    return header;
  }
  function __liftTypedArray(constructor, pointer) {
    if (!pointer) return null;
    return new constructor(
      memory.buffer,
      __getU32(pointer + 4),
      __dataview.getUint32(pointer + 8, true) / constructor.BYTES_PER_ELEMENT
    ).slice();
  }
  function __lowerTypedArray(constructor, id, align, values) {
    if (values == null) return 0;
    const
      length = values.length,
      buffer = exports.__pin(exports.__new(length << align, 1)) >>> 0,
      header = exports.__new(12, id) >>> 0;
    __setU32(header + 0, buffer);
    __dataview.setUint32(header + 4, buffer, true);
    __dataview.setUint32(header + 8, length << align, true);
    new constructor(memory.buffer, buffer, length).set(values);
    exports.__unpin(buffer);
    return header;
  }
  class Internref extends Number {}
  const registry = new FinalizationRegistry(__release);
  function __liftInternref(pointer) {
    if (!pointer) return null;
    const sentinel = new Internref(__retain(pointer));
    registry.register(sentinel, pointer);
    return sentinel;
  }
  function __lowerInternref(value) {
    if (value == null) return 0;
    if (value instanceof Internref) return value.valueOf();
    throw TypeError("internref expected");
  }
  const refcounts = new Map();
  function __retain(pointer) {
    if (pointer) {
      const refcount = refcounts.get(pointer);
      if (refcount) refcounts.set(pointer, refcount + 1);
      else refcounts.set(exports.__pin(pointer), 1);
    }
    return pointer;
  }
  function __release(pointer) {
    if (pointer) {
      const refcount = refcounts.get(pointer);
      if (refcount === 1) exports.__unpin(pointer), refcounts.delete(pointer);
      else if (refcount) refcounts.set(pointer, refcount - 1);
      else throw Error(`invalid refcount '${refcount}' for reference '${pointer}'`);
    }
  }
  function __notnull() {
    throw TypeError("value must not be null");
  }
  let __dataview = new DataView(memory.buffer);
  function __setU8(pointer, value) {
    try {
      __dataview.setUint8(pointer, value, true);
    } catch {
      __dataview = new DataView(memory.buffer);
      __dataview.setUint8(pointer, value, true);
    }
  }
  function __setU32(pointer, value) {
    try {
      __dataview.setUint32(pointer, value, true);
    } catch {
      __dataview = new DataView(memory.buffer);
      __dataview.setUint32(pointer, value, true);
    }
  }
  function __getU32(pointer) {
    try {
      return __dataview.getUint32(pointer, true);
    } catch {
      __dataview = new DataView(memory.buffer);
      return __dataview.getUint32(pointer, true);
    }
  }
  return adaptedExports;
}
export const {
  memory,
  __new,
  __pin,
  __unpin,
  __collect,
  __rtti_base,
  RAMType,
  init,
  reset,
  resetGeneric,
  resetGenericWithMemory,
  nextStep,
  nSteps,
  runBlob,
  prepareBlob,
  accumulateInvocation,
  setupAccumulateInvocation,
  setAccumulateInputs,
  runProgram,
  getProgramCounter,
  setNextProgramCounter,
  getGasLeft,
  setGasLeft,
  getStatus,
  getExitArg,
  getResultCode,
  getCode,
  getBitmask,
  getRegisters,
  setRegisters,
  getRegister,
  setRegister,
  getPageDump,
  setMemory,
  getAccumulationContext,
  hasAccumulationContext,
  initPage,
  initializeProgram,
  alignToPage,
  alignToZone,
  decodeNatural,
  decodeBlob,
  decodeServiceCodeFromPreimage,
  decodeProgram,
  decodeProgramFromPreimage,
  encodeServiceAccount,
  decodeServiceAccount,
  encodeFixedLength,
  encodeNatural,
  encodeRefineContext,
  encodeImportReference,
  encodeExtrinsicReference,
  encodeVariableSequence,
  encodeWorkItem,
  encodeWorkItemSummary,
  decodeImportReference,
  decodeExtrinsicReference,
  decodeWorkItem,
  encodeWorkPackage,
  decodeAccumulateArgs,
  decodeFixedLength,
  decodeVariableLength,
  decodeVariableSequence,
  decodeCompleteServiceAccount,
  decodePartialState,
  decodeDeferredTransfer,
  decodeImplications,
  decodeImplicationsPair,
  encodeOptional,
  encodeDeferredTransfer,
  encodeWorkResult,
  encodeOperandTuple,
  encodeAccumulateInput,
  decodeWorkResult,
  decodeOperandTuple,
  decodeAccumulateInput,
  encodeVariableSequenceGeneric,
  encodeCompleteServiceAccount,
  encodePartialState,
  encodeImplications,
  encodeImplicationsPair,
  DEFAULT_GAS_LIMIT,
  MIN_GAS_COST,
  MAX_GAS_COST,
  RESERVED_MEMORY_END,
  MAX_MEMORY_ADDRESS,
  INITIAL_ZONE_SIZE,
  PAGE_SIZE,
  DYNAMIC_ADDRESS_ALIGNMENT,
  ZONE_SIZE,
  INIT_INPUT_SIZE,
  HALT_ADDRESS,
  STACK_SEGMENT_END,
  ARGS_SEGMENT_START,
  RESULT_CODE_HALT,
  RESULT_CODE_PANIC,
  RESULT_CODE_FAULT,
  RESULT_CODE_HOST,
  RESULT_CODE_OOG,
  OPCODE_TRAP,
  OPCODE_FALLTHROUGH,
  OPCODE_ECALLI,
  OPCODE_LOAD_IMM_64,
  OPCODE_STORE_IMM_U8,
  OPCODE_STORE_IMM_U16,
  OPCODE_STORE_IMM_U32,
  OPCODE_STORE_IMM_U64,
  OPCODE_JUMP,
  OPCODE_JUMP_IND,
  OPCODE_LOAD_IMM,
  OPCODE_LOAD_U8,
  OPCODE_LOAD_I8,
  OPCODE_LOAD_U16,
  OPCODE_LOAD_I16,
  OPCODE_LOAD_U32,
  OPCODE_LOAD_I32,
  OPCODE_LOAD_U64,
  OPCODE_STORE_U8,
  OPCODE_STORE_U16,
  OPCODE_STORE_U32,
  OPCODE_STORE_U64,
  OPCODE_STORE_IMM_IND_U8,
  OPCODE_STORE_IMM_IND_U16,
  OPCODE_STORE_IMM_IND_U32,
  OPCODE_STORE_IMM_IND_U64,
  OPCODE_LOAD_IMM_JUMP,
  OPCODE_BRANCH_EQ_IMM,
  OPCODE_BRANCH_NE_IMM,
  OPCODE_BRANCH_LT_U_IMM,
  OPCODE_BRANCH_LE_U_IMM,
  OPCODE_BRANCH_GE_U_IMM,
  OPCODE_BRANCH_GT_U_IMM,
  OPCODE_BRANCH_LT_S_IMM,
  OPCODE_BRANCH_LE_S_IMM,
  OPCODE_BRANCH_GE_S_IMM,
  OPCODE_BRANCH_GT_S_IMM,
  OPCODE_MOVE_REG,
  OPCODE_SBRK,
  OPCODE_COUNT_SET_BITS_64,
  OPCODE_COUNT_SET_BITS_32,
  OPCODE_LEADING_ZERO_BITS_64,
  OPCODE_LEADING_ZERO_BITS_32,
  OPCODE_TRAILING_ZERO_BITS_64,
  OPCODE_TRAILING_ZERO_BITS_32,
  OPCODE_SIGN_EXTEND_8,
  OPCODE_SIGN_EXTEND_16,
  OPCODE_ZERO_EXTEND_16,
  OPCODE_REVERSE_BYTES,
  OPCODE_STORE_IND_U8,
  OPCODE_STORE_IND_U16,
  OPCODE_STORE_IND_U32,
  OPCODE_STORE_IND_U64,
  OPCODE_LOAD_IND_U8,
  OPCODE_LOAD_IND_I8,
  OPCODE_LOAD_IND_U16,
  OPCODE_LOAD_IND_I16,
  OPCODE_LOAD_IND_U32,
  OPCODE_LOAD_IND_I32,
  OPCODE_LOAD_IND_U64,
  OPCODE_ADD_IMM_32,
  OPCODE_AND_IMM,
  OPCODE_XOR_IMM,
  OPCODE_OR_IMM,
  OPCODE_MUL_IMM_32,
  OPCODE_SET_LT_U_IMM,
  OPCODE_SET_LT_S_IMM,
  OPCODE_SHLO_L_IMM_32,
  OPCODE_SHLO_R_IMM_32,
  OPCODE_SHAR_R_IMM_32,
  OPCODE_NEG_ADD_IMM_32,
  OPCODE_SET_GT_U_IMM,
  OPCODE_SET_GT_S_IMM,
  OPCODE_SHLO_L_IMM_ALT_32,
  OPCODE_SHLO_R_IMM_ALT_32,
  OPCODE_SHAR_R_IMM_ALT_32,
  OPCODE_CMOV_IZ_IMM,
  OPCODE_CMOV_NZ_IMM,
  OPCODE_ADD_IMM_64,
  OPCODE_MUL_IMM_64,
  OPCODE_SHLO_L_IMM_64,
  OPCODE_SHLO_R_IMM_64,
  OPCODE_SHAR_R_IMM_64,
  OPCODE_NEG_ADD_IMM_64,
  OPCODE_SHLO_L_IMM_ALT_64,
  OPCODE_SHLO_R_IMM_ALT_64,
  OPCODE_SHAR_R_IMM_ALT_64,
  OPCODE_ROT_R_64_IMM,
  OPCODE_ROT_R_64_IMM_ALT,
  OPCODE_ROT_R_32_IMM,
  OPCODE_ROT_R_32_IMM_ALT,
  OPCODE_BRANCH_EQ,
  OPCODE_BRANCH_NE,
  OPCODE_BRANCH_LT_U,
  OPCODE_BRANCH_LT_S,
  OPCODE_BRANCH_GE_U,
  OPCODE_BRANCH_GE_S,
  OPCODE_LOAD_IMM_JUMP_IND,
  OPCODE_ADD_32,
  OPCODE_SUB_32,
  OPCODE_MUL_32,
  OPCODE_DIV_U_32,
  OPCODE_DIV_S_32,
  OPCODE_REM_U_32,
  OPCODE_REM_S_32,
  OPCODE_SHLO_L_32,
  OPCODE_SHLO_R_32,
  OPCODE_SHAR_R_32,
  OPCODE_ADD_64,
  OPCODE_SUB_64,
  OPCODE_MUL_64,
  OPCODE_DIV_U_64,
  OPCODE_DIV_S_64,
  OPCODE_REM_U_64,
  OPCODE_REM_S_64,
  OPCODE_SHLO_L_64,
  OPCODE_SHLO_R_64,
  OPCODE_SHAR_R_64,
  OPCODE_AND,
  OPCODE_XOR,
  OPCODE_OR,
  OPCODE_MUL_UPPER_S_S,
  OPCODE_MUL_UPPER_U_U,
  OPCODE_MUL_UPPER_S_U,
  OPCODE_SET_LT_U,
  OPCODE_SET_LT_S,
  OPCODE_CMOV_IZ,
  OPCODE_CMOV_NZ,
  OPCODE_ROT_L_64,
  OPCODE_ROT_L_32,
  OPCODE_ROT_R_64,
  OPCODE_ROT_R_32,
  OPCODE_AND_INV,
  OPCODE_OR_INV,
  OPCODE_XNOR,
  OPCODE_MAX,
  OPCODE_MAX_U,
  OPCODE_MIN,
  OPCODE_MIN_U,
  PACKAGE_AUTH_GAS,
  MAX_AUTH_CODE_SIZE,
  PACKAGE_REF_GAS,
  MAX_SERVICE_CODE_SIZE,
  SEGMENT_SIZE,
  MAX_PACKAGE_EXPORTS,
  MIN_PUBLIC_INDEX,
  FUNC_GAS,
  FUNC_FETCH,
  FUNC_LOOKUP,
  FUNC_READ,
  FUNC_WRITE,
  FUNC_INFO,
  FUNC_HISTORICAL_LOOKUP,
  FUNC_EXPORT,
  FUNC_MACHINE,
  FUNC_PEEK,
  FUNC_POKE,
  FUNC_PAGES,
  FUNC_INVOKE,
  FUNC_EXPUNGE,
  FUNC_LOG,
  FUNC_BLESS,
  FUNC_ASSIGN,
  FUNC_DESIGNATE,
  FUNC_CHECKPOINT,
  FUNC_NEW,
  FUNC_UPGRADE,
  FUNC_TRANSFER,
  FUNC_EJECT,
  FUNC_QUERY,
  FUNC_SOLICIT,
  FUNC_FORGET,
  FUNC_YIELD,
  FUNC_PROVIDE,
  ERROR_NONE,
  ERROR_WHAT,
  ERROR_OOB,
  ERROR_WHO,
  ERROR_FULL,
  ERROR_CORE,
  ERROR_CASH,
  ERROR_LOW,
  ERROR_HUH,
  ERROR_OK,
  isTerminationInstruction,
  REGISTER_INIT_STACK_SEGMENT_END,
  REGISTER_INIT_ARGS_SEGMENT_START,
  MemoryAccessType,
  bytesToHex,
  Status,
  createPvmShell,
  roundTripSingleImplications,
  roundTripImplications,
  roundTripServiceAccount,
  roundTripPartialState,
  getDecodedProgramFields,
  roundTripAccumulateInputs,
  roundTripSingleAccumulateInput,
} = await (async url => instantiate(
  await (async () => {
    const isNodeOrBun = typeof process != "undefined" && process.versions != null && (process.versions.node != null || process.versions.bun != null);
    if (isNodeOrBun) { return globalThis.WebAssembly.compile(await (await import("node:fs/promises")).readFile(url)); }
    else { return await globalThis.WebAssembly.compileStreaming(globalThis.fetch(url)); }
  })(), {
  }
))(new URL("pvm.wasm", import.meta.url));
