/** Exported memory */
export declare const memory: WebAssembly.Memory;
// Exported runtime interface
export declare function __new(size: number, id: number): number;
export declare function __pin(ptr: number): number;
export declare function __unpin(ptr: number): void;
export declare function __collect(): void;
export declare const __rtti_base: number;
/** assembly/index/RAMType */
export declare enum RAMType {
  /** @type `i32` */
  PVMRAM,
  /** @type `i32` */
  SimpleRAM,
  /** @type `i32` */
  MockRAM,
}
/**
 * assembly/index/init
 * @param ramType `i32`
 */
export declare function init(ramType: number): void;
/**
 * assembly/index/reset
 */
export declare function reset(): void;
/**
 * assembly/index/resetGeneric
 * @param program `~lib/typedarray/Uint8Array`
 * @param registers `~lib/typedarray/Uint8Array`
 * @param gas `u32`
 */
export declare function resetGeneric(program: Uint8Array, registers: Uint8Array, gas: number): void;
/**
 * assembly/index/resetGenericWithMemory
 * @param programPtr `~lib/typedarray/Uint8Array`
 * @param registersPtr `~lib/typedarray/Uint8Array`
 * @param pageMapPtr `~lib/typedarray/Uint8Array`
 * @param chunksPtr `~lib/typedarray/Uint8Array`
 * @param gas `u32`
 */
export declare function resetGenericWithMemory(programPtr: Uint8Array, registersPtr: Uint8Array, pageMapPtr: Uint8Array, chunksPtr: Uint8Array, gas: number): void;
/**
 * assembly/index/nextStep
 * @returns `bool`
 */
export declare function nextStep(): boolean;
/**
 * assembly/index/nSteps
 * @param steps `i32`
 * @returns `bool`
 */
export declare function nSteps(steps: number): boolean;
/**
 * assembly/index/runBlob
 * @param program `~lib/typedarray/Uint8Array`
 */
export declare function runBlob(program: Uint8Array): void;
/**
 * assembly/index/prepareBlob
 * @param program `~lib/typedarray/Uint8Array`
 */
export declare function prepareBlob(program: Uint8Array): void;
/**
 * assembly/index/accumulateInvocation
 * @param gasLimit `u32`
 * @param program `~lib/typedarray/Uint8Array`
 * @param args `~lib/typedarray/Uint8Array`
 * @param context `~lib/typedarray/Uint8Array`
 * @param numCores `i32`
 * @param numValidators `i32`
 * @param authQueueSize `i32`
 * @param entropyAccumulator `~lib/typedarray/Uint8Array`
 * @param configNumCores `i32`
 * @param configPreimageExpungePeriod `u32`
 * @param configEpochDuration `u32`
 * @param configMaxBlockGas `u64`
 * @param configTicketsPerValidator `u16`
 * @param configSlotDuration `u16`
 * @param configRotationPeriod `u16`
 * @param configNumValidators `u16`
 * @returns `assembly/pvm/AccumulateInvocationResult`
 */
export declare function accumulateInvocation(gasLimit: number, program: Uint8Array, args: Uint8Array, context: Uint8Array, numCores: number, numValidators: number, authQueueSize: number, entropyAccumulator: Uint8Array, configNumCores?: number, configPreimageExpungePeriod?: number, configEpochDuration?: number, configMaxBlockGas?: bigint, configTicketsPerValidator?: number, configSlotDuration?: number, configRotationPeriod?: number, configNumValidators?: number): __Internref239;
/**
 * assembly/index/setupAccumulateInvocation
 * @param gasLimit `u32`
 * @param program `~lib/typedarray/Uint8Array`
 * @param args `~lib/typedarray/Uint8Array`
 * @param context `~lib/typedarray/Uint8Array`
 * @param numCores `i32`
 * @param numValidators `i32`
 * @param authQueueSize `i32`
 * @param entropyAccumulator `~lib/typedarray/Uint8Array`
 * @param configNumCores `i32`
 * @param configPreimageExpungePeriod `u32`
 * @param configEpochDuration `u32`
 * @param configMaxBlockGas `u64`
 * @param configTicketsPerValidator `u16`
 * @param configSlotDuration `u16`
 * @param configRotationPeriod `u16`
 * @param configNumValidators `u16`
 */
export declare function setupAccumulateInvocation(gasLimit: number, program: Uint8Array, args: Uint8Array, context: Uint8Array, numCores: number, numValidators: number, authQueueSize: number, entropyAccumulator: Uint8Array, configNumCores?: number, configPreimageExpungePeriod?: number, configEpochDuration?: number, configMaxBlockGas?: bigint, configTicketsPerValidator?: number, configSlotDuration?: number, configRotationPeriod?: number, configNumValidators?: number): void;
/**
 * assembly/index/runProgram
 * @returns `assembly/types/RunProgramResult`
 */
export declare function runProgram(): __Internref268;
/**
 * assembly/index/getProgramCounter
 * @returns `u32`
 */
export declare function getProgramCounter(): number;
/**
 * assembly/index/setNextProgramCounter
 * @param pc `u32`
 */
export declare function setNextProgramCounter(pc: number): void;
/**
 * assembly/index/getGasLeft
 * @returns `u32`
 */
export declare function getGasLeft(): number;
/**
 * assembly/index/setGasLeft
 * @param gas `i64`
 */
export declare function setGasLeft(gas: bigint): void;
/**
 * assembly/index/getStatus
 * @returns `i32`
 */
export declare function getStatus(): number;
/**
 * assembly/index/getExitArg
 * @returns `u32`
 */
export declare function getExitArg(): number;
/**
 * assembly/index/getResultCode
 * @returns `u32`
 */
export declare function getResultCode(): number;
/**
 * assembly/index/getCode
 * @returns `~lib/typedarray/Uint8Array`
 */
export declare function getCode(): Uint8Array;
/**
 * assembly/index/getBitmask
 * @returns `~lib/typedarray/Uint8Array`
 */
export declare function getBitmask(): Uint8Array;
/**
 * assembly/index/getRegisters
 * @returns `~lib/typedarray/Uint8Array`
 */
export declare function getRegisters(): Uint8Array;
/**
 * assembly/index/setRegisters
 * @param registers `~lib/array/Array<u8>`
 */
export declare function setRegisters(registers: Array<number>): void;
/**
 * assembly/index/getRegister
 * @param index `u8`
 * @returns `u64`
 */
export declare function getRegister(index: number): bigint;
/**
 * assembly/index/setRegister
 * @param index `u8`
 * @param value `u64`
 */
export declare function setRegister(index: number, value: bigint): void;
/**
 * assembly/index/getPageDump
 * @param pageIndex `i32`
 * @returns `i32`
 */
export declare function getPageDump(pageIndex: number): number;
/**
 * assembly/index/setMemory
 * @param address `u32`
 * @param data `~lib/typedarray/Uint8Array`
 */
export declare function setMemory(address: number, data: Uint8Array): void;
/**
 * assembly/index/initPage
 * @param address `u32`
 * @param length `u32`
 * @param accessType `i32`
 */
export declare function initPage(address: number, length: number, accessType: number): void;
/**
 * assembly/index/initializeProgram
 * @param program `~lib/typedarray/Uint8Array`
 * @param args `~lib/typedarray/Uint8Array`
 */
export declare function initializeProgram(program: Uint8Array, args: Uint8Array): void;
/**
 * assembly/alignment-helpers/alignToPage
 * @param size `u32`
 * @returns `u32`
 */
export declare function alignToPage(size: number): number;
/**
 * assembly/alignment-helpers/alignToZone
 * @param size `u32`
 * @returns `u32`
 */
export declare function alignToZone(size: number): number;
/**
 * assembly/codec/decodeNatural
 * @param data `~lib/typedarray/Uint8Array`
 * @returns `assembly/codec/DecodingResult<u64> | null`
 */
export declare function decodeNatural(data: Uint8Array): __Internref222 | null;
/**
 * assembly/codec/decodeBlob
 * @param programBlob `~lib/typedarray/Uint8Array`
 * @returns `assembly/codec/DecodedBlob | null`
 */
export declare function decodeBlob(programBlob: Uint8Array): __Internref224 | null;
/**
 * assembly/codec/decodeServiceCodeFromPreimage
 * @param preimageBlob `~lib/typedarray/Uint8Array`
 * @returns `assembly/codec/DecodingResult<assembly/codec/ServiceCodeResult> | null`
 */
export declare function decodeServiceCodeFromPreimage(preimageBlob: Uint8Array): __Internref221 | null;
/**
 * assembly/codec/decodeProgram
 * @param programBlob `~lib/typedarray/Uint8Array`
 * @returns `assembly/codec/DecodedProgram | null`
 */
export declare function decodeProgram(programBlob: Uint8Array): __Internref219 | null;
/**
 * assembly/codec/decodeProgramFromPreimage
 * @param preimageBlob `~lib/typedarray/Uint8Array`
 * @returns `assembly/codec/DecodedProgram | null`
 */
export declare function decodeProgramFromPreimage(preimageBlob: Uint8Array): __Internref219 | null;
/**
 * assembly/codec/encodeServiceAccount
 * @param account `assembly/codec/ServiceAccountData`
 * @returns `~lib/typedarray/Uint8Array`
 */
export declare function encodeServiceAccount(account: __Internref270): Uint8Array;
/**
 * assembly/codec/encodeFixedLength
 * @param value `u64`
 * @param length `i32`
 * @returns `~lib/typedarray/Uint8Array`
 */
export declare function encodeFixedLength(value: bigint, length: number): Uint8Array;
/**
 * assembly/codec/encodeNatural
 * @param value `u64`
 * @returns `~lib/typedarray/Uint8Array`
 */
export declare function encodeNatural(value: bigint): Uint8Array;
/**
 * assembly/codec/encodeRefineContext
 * @param context `assembly/codec/RefineContext`
 * @returns `~lib/typedarray/Uint8Array`
 */
export declare function encodeRefineContext(context: __Internref272): Uint8Array;
/**
 * assembly/codec/encodeImportReference
 * @param importRef `assembly/codec/ImportSegment`
 * @returns `~lib/typedarray/Uint8Array`
 */
export declare function encodeImportReference(importRef: __Internref273): Uint8Array;
/**
 * assembly/codec/encodeExtrinsicReference
 * @param extrinsicRef `assembly/codec/ExtrinsicReference`
 * @returns `~lib/typedarray/Uint8Array`
 */
export declare function encodeExtrinsicReference(extrinsicRef: __Internref274): Uint8Array;
/**
 * assembly/codec/encodeVariableSequence
 * @param sequence `~lib/array/Array<~lib/typedarray/Uint8Array>`
 * @returns `~lib/typedarray/Uint8Array`
 */
export declare function encodeVariableSequence(sequence: Array<Uint8Array>): Uint8Array;
/**
 * assembly/codec/encodeWorkItem
 * @param workItem `assembly/codec/WorkItem`
 * @returns `~lib/typedarray/Uint8Array`
 */
export declare function encodeWorkItem(workItem: __Internref275): Uint8Array;
/**
 * assembly/codec/encodeWorkItemSummary
 * @param workItem `assembly/codec/WorkItem`
 * @returns `~lib/typedarray/Uint8Array`
 */
export declare function encodeWorkItemSummary(workItem: __Internref275): Uint8Array;
/**
 * assembly/codec/encodeWorkPackage
 * @param workPackage `assembly/codec/WorkPackage`
 * @returns `~lib/typedarray/Uint8Array`
 */
export declare function encodeWorkPackage(workPackage: __Internref278): Uint8Array;
/**
 * assembly/codec/decodeAccumulateArgs
 * @param args `~lib/typedarray/Uint8Array`
 * @returns `assembly/codec/DecodingResult<assembly/codec/DecodedAccumulateArgs> | null`
 */
export declare function decodeAccumulateArgs(args: Uint8Array): __Internref256 | null;
/**
 * assembly/codec/decodeFixedLength
 * @param data `~lib/typedarray/Uint8Array`
 * @param length `i32`
 * @returns `assembly/codec/DecodingResult<u64> | null`
 */
export declare function decodeFixedLength(data: Uint8Array, length: number): __Internref222 | null;
/**
 * assembly/codec/decodeVariableLength
 * @param data `~lib/typedarray/Uint8Array`
 * @returns `assembly/codec/DecodingResult<~lib/typedarray/Uint8Array> | null`
 */
export declare function decodeVariableLength(data: Uint8Array): __Internref244 | null;
/**
 * assembly/codec/decodeVariableSequence<u32>
 * @param data `~lib/typedarray/Uint8Array`
 * @param elementDecoder `(~lib/typedarray/Uint8Array) => assembly/codec/DecodingResult<u32> | null`
 * @returns `assembly/codec/DecodingResult<~lib/array/Array<u32>> | null`
 */
export declare function decodeVariableSequence(data: Uint8Array, elementDecoder: __Internref248): __Internref247 | null;
/**
 * assembly/codec/decodeVariableSequence<assembly/codec/DeferredTransfer>
 * @param data `~lib/typedarray/Uint8Array`
 * @param elementDecoder `(~lib/typedarray/Uint8Array) => assembly/codec/DecodingResult<assembly/codec/DeferredTransfer> | null`
 * @returns `assembly/codec/DecodingResult<~lib/array/Array<assembly/codec/DeferredTransfer>> | null`
 */
export declare function decodeVariableSequence(data: Uint8Array, elementDecoder: __Internref251): __Internref250 | null;
/**
 * assembly/codec/decodeVariableSequence<assembly/codec/ProvisionEntry>
 * @param data `~lib/typedarray/Uint8Array`
 * @param elementDecoder `(~lib/typedarray/Uint8Array) => assembly/codec/DecodingResult<assembly/codec/ProvisionEntry> | null`
 * @returns `assembly/codec/DecodingResult<~lib/array/Array<assembly/codec/ProvisionEntry>> | null`
 */
export declare function decodeVariableSequence(data: Uint8Array, elementDecoder: __Internref254): __Internref253 | null;
/**
 * assembly/codec/decodeCompleteServiceAccount
 * @param data `~lib/typedarray/Uint8Array`
 * @returns `assembly/codec/DecodingResult<assembly/codec/CompleteServiceAccount> | null`
 */
export declare function decodeCompleteServiceAccount(data: Uint8Array): __Internref245 | null;
/**
 * assembly/codec/decodePartialState
 * @param data `~lib/typedarray/Uint8Array`
 * @param numCores `i32`
 * @param numValidators `i32`
 * @param authQueueSize `i32`
 * @returns `assembly/codec/DecodingResult<assembly/codec/PartialState> | null`
 */
export declare function decodePartialState(data: Uint8Array, numCores: number, numValidators: number, authQueueSize: number): __Internref243 | null;
/**
 * assembly/codec/decodeDeferredTransfer
 * @param data `~lib/typedarray/Uint8Array`
 * @returns `assembly/codec/DecodingResult<assembly/codec/DeferredTransfer> | null`
 */
export declare function decodeDeferredTransfer(data: Uint8Array): __Internref249 | null;
/**
 * assembly/codec/decodeImplications
 * @param data `~lib/typedarray/Uint8Array`
 * @param numCores `i32`
 * @param numValidators `i32`
 * @param authQueueSize `i32`
 * @returns `assembly/codec/DecodingResult<assembly/codec/Implications> | null`
 */
export declare function decodeImplications(data: Uint8Array, numCores: number, numValidators: number, authQueueSize: number): __Internref242 | null;
/**
 * assembly/codec/decodeImplicationsPair
 * @param data `~lib/typedarray/Uint8Array`
 * @param numCores `i32`
 * @param numValidators `i32`
 * @param authQueueSize `i32`
 * @returns `assembly/codec/DecodingResult<assembly/codec/ImplicationsPair> | null`
 */
export declare function decodeImplicationsPair(data: Uint8Array, numCores: number, numValidators: number, authQueueSize: number): __Internref241 | null;
/**
 * assembly/codec/encodeOptional
 * @param value `~lib/typedarray/Uint8Array | null`
 * @param encoder `(~lib/typedarray/Uint8Array) => ~lib/typedarray/Uint8Array`
 * @returns `~lib/typedarray/Uint8Array`
 */
export declare function encodeOptional(value: Uint8Array | null, encoder: __Internref265): Uint8Array;
/**
 * assembly/codec/encodeDeferredTransfer
 * @param transfer `assembly/codec/DeferredTransfer`
 * @returns `~lib/typedarray/Uint8Array`
 */
export declare function encodeDeferredTransfer(transfer: __Internref41): Uint8Array;
/**
 * assembly/codec/encodeVariableSequenceGeneric<u32>
 * @param sequence `~lib/array/Array<u32>`
 * @param elementEncoder `(u32) => ~lib/typedarray/Uint8Array`
 * @returns `~lib/typedarray/Uint8Array`
 */
export declare function encodeVariableSequenceGeneric(sequence: Array<number>, elementEncoder: __Internref262): Uint8Array;
/**
 * assembly/codec/encodeVariableSequenceGeneric<assembly/codec/DeferredTransfer>
 * @param sequence `~lib/array/Array<assembly/codec/DeferredTransfer>`
 * @param elementEncoder `(assembly/codec/DeferredTransfer) => ~lib/typedarray/Uint8Array`
 * @returns `~lib/typedarray/Uint8Array`
 */
export declare function encodeVariableSequenceGeneric(sequence: Array<__Internref41>, elementEncoder: __Internref264): Uint8Array;
/**
 * assembly/codec/encodeVariableSequenceGeneric<assembly/codec/ProvisionEntry>
 * @param sequence `~lib/array/Array<assembly/codec/ProvisionEntry>`
 * @param elementEncoder `(assembly/codec/ProvisionEntry) => ~lib/typedarray/Uint8Array`
 * @returns `~lib/typedarray/Uint8Array`
 */
export declare function encodeVariableSequenceGeneric(sequence: Array<__Internref43>, elementEncoder: __Internref267): Uint8Array;
/**
 * assembly/codec/encodeCompleteServiceAccount
 * @param account `assembly/codec/CompleteServiceAccount`
 * @returns `~lib/typedarray/Uint8Array`
 */
export declare function encodeCompleteServiceAccount(account: __Internref25): Uint8Array;
/**
 * assembly/codec/encodePartialState
 * @param state `assembly/codec/PartialState`
 * @param numCores `i32`
 * @param numValidators `i32`
 * @param authQueueSize `i32`
 * @returns `~lib/typedarray/Uint8Array`
 */
export declare function encodePartialState(state: __Internref23, numCores: number, numValidators: number, authQueueSize: number): Uint8Array;
/**
 * assembly/codec/encodeImplications
 * @param implications `assembly/codec/Implications`
 * @param numCores `i32`
 * @param numValidators `i32`
 * @param authQueueSize `i32`
 * @returns `~lib/typedarray/Uint8Array`
 */
export declare function encodeImplications(implications: __Internref22, numCores: number, numValidators: number, authQueueSize: number): Uint8Array;
/**
 * assembly/codec/encodeImplicationsPair
 * @param pair `assembly/codec/ImplicationsPair`
 * @param numCores `i32`
 * @param numValidators `i32`
 * @param authQueueSize `i32`
 * @returns `~lib/typedarray/Uint8Array`
 */
export declare function encodeImplicationsPair(pair: __Internref21, numCores: number, numValidators: number, authQueueSize: number): Uint8Array;
/** assembly/config/DEFAULT_GAS_LIMIT */
export declare const DEFAULT_GAS_LIMIT: {
  /** @type `u32` */
  get value(): number
};
/** assembly/config/MIN_GAS_COST */
export declare const MIN_GAS_COST: {
  /** @type `u32` */
  get value(): number
};
/** assembly/config/MAX_GAS_COST */
export declare const MAX_GAS_COST: {
  /** @type `u32` */
  get value(): number
};
/** assembly/config/RESERVED_MEMORY_END */
export declare const RESERVED_MEMORY_END: {
  /** @type `u32` */
  get value(): number
};
/** assembly/config/MAX_MEMORY_ADDRESS */
export declare const MAX_MEMORY_ADDRESS: {
  /** @type `u32` */
  get value(): number
};
/** assembly/config/INITIAL_ZONE_SIZE */
export declare const INITIAL_ZONE_SIZE: {
  /** @type `u32` */
  get value(): number
};
/** assembly/config/PAGE_SIZE */
export declare const PAGE_SIZE: {
  /** @type `u32` */
  get value(): number
};
/** assembly/config/DYNAMIC_ADDRESS_ALIGNMENT */
export declare const DYNAMIC_ADDRESS_ALIGNMENT: {
  /** @type `u32` */
  get value(): number
};
/** assembly/config/ZONE_SIZE */
export declare const ZONE_SIZE: {
  /** @type `u32` */
  get value(): number
};
/** assembly/config/INIT_INPUT_SIZE */
export declare const INIT_INPUT_SIZE: {
  /** @type `u32` */
  get value(): number
};
/** assembly/config/HALT_ADDRESS */
export declare const HALT_ADDRESS: {
  /** @type `u32` */
  get value(): number
};
/** assembly/config/STACK_SEGMENT_END */
export declare const STACK_SEGMENT_END: {
  /** @type `u32` */
  get value(): number
};
/** assembly/config/ARGS_SEGMENT_START */
export declare const ARGS_SEGMENT_START: {
  /** @type `u32` */
  get value(): number
};
/** assembly/config/RESULT_CODE_HALT */
export declare const RESULT_CODE_HALT: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/RESULT_CODE_PANIC */
export declare const RESULT_CODE_PANIC: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/RESULT_CODE_FAULT */
export declare const RESULT_CODE_FAULT: {
  /** @type `i32` */
  get value(): number
};
/** assembly/config/RESULT_CODE_HOST */
export declare const RESULT_CODE_HOST: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/RESULT_CODE_OOG */
export declare const RESULT_CODE_OOG: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_TRAP */
export declare const OPCODE_TRAP: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_FALLTHROUGH */
export declare const OPCODE_FALLTHROUGH: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_ECALLI */
export declare const OPCODE_ECALLI: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_LOAD_IMM_64 */
export declare const OPCODE_LOAD_IMM_64: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_STORE_IMM_U8 */
export declare const OPCODE_STORE_IMM_U8: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_STORE_IMM_U16 */
export declare const OPCODE_STORE_IMM_U16: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_STORE_IMM_U32 */
export declare const OPCODE_STORE_IMM_U32: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_STORE_IMM_U64 */
export declare const OPCODE_STORE_IMM_U64: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_JUMP */
export declare const OPCODE_JUMP: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_JUMP_IND */
export declare const OPCODE_JUMP_IND: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_LOAD_IMM */
export declare const OPCODE_LOAD_IMM: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_LOAD_U8 */
export declare const OPCODE_LOAD_U8: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_LOAD_I8 */
export declare const OPCODE_LOAD_I8: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_LOAD_U16 */
export declare const OPCODE_LOAD_U16: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_LOAD_I16 */
export declare const OPCODE_LOAD_I16: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_LOAD_U32 */
export declare const OPCODE_LOAD_U32: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_LOAD_I32 */
export declare const OPCODE_LOAD_I32: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_LOAD_U64 */
export declare const OPCODE_LOAD_U64: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_STORE_U8 */
export declare const OPCODE_STORE_U8: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_STORE_U16 */
export declare const OPCODE_STORE_U16: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_STORE_U32 */
export declare const OPCODE_STORE_U32: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_STORE_U64 */
export declare const OPCODE_STORE_U64: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_STORE_IMM_IND_U8 */
export declare const OPCODE_STORE_IMM_IND_U8: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_STORE_IMM_IND_U16 */
export declare const OPCODE_STORE_IMM_IND_U16: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_STORE_IMM_IND_U32 */
export declare const OPCODE_STORE_IMM_IND_U32: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_STORE_IMM_IND_U64 */
export declare const OPCODE_STORE_IMM_IND_U64: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_LOAD_IMM_JUMP */
export declare const OPCODE_LOAD_IMM_JUMP: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_BRANCH_EQ_IMM */
export declare const OPCODE_BRANCH_EQ_IMM: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_BRANCH_NE_IMM */
export declare const OPCODE_BRANCH_NE_IMM: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_BRANCH_LT_U_IMM */
export declare const OPCODE_BRANCH_LT_U_IMM: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_BRANCH_LE_U_IMM */
export declare const OPCODE_BRANCH_LE_U_IMM: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_BRANCH_GE_U_IMM */
export declare const OPCODE_BRANCH_GE_U_IMM: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_BRANCH_GT_U_IMM */
export declare const OPCODE_BRANCH_GT_U_IMM: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_BRANCH_LT_S_IMM */
export declare const OPCODE_BRANCH_LT_S_IMM: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_BRANCH_LE_S_IMM */
export declare const OPCODE_BRANCH_LE_S_IMM: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_BRANCH_GE_S_IMM */
export declare const OPCODE_BRANCH_GE_S_IMM: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_BRANCH_GT_S_IMM */
export declare const OPCODE_BRANCH_GT_S_IMM: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_MOVE_REG */
export declare const OPCODE_MOVE_REG: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_SBRK */
export declare const OPCODE_SBRK: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_COUNT_SET_BITS_64 */
export declare const OPCODE_COUNT_SET_BITS_64: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_COUNT_SET_BITS_32 */
export declare const OPCODE_COUNT_SET_BITS_32: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_LEADING_ZERO_BITS_64 */
export declare const OPCODE_LEADING_ZERO_BITS_64: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_LEADING_ZERO_BITS_32 */
export declare const OPCODE_LEADING_ZERO_BITS_32: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_TRAILING_ZERO_BITS_64 */
export declare const OPCODE_TRAILING_ZERO_BITS_64: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_TRAILING_ZERO_BITS_32 */
export declare const OPCODE_TRAILING_ZERO_BITS_32: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_SIGN_EXTEND_8 */
export declare const OPCODE_SIGN_EXTEND_8: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_SIGN_EXTEND_16 */
export declare const OPCODE_SIGN_EXTEND_16: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_ZERO_EXTEND_16 */
export declare const OPCODE_ZERO_EXTEND_16: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_REVERSE_BYTES */
export declare const OPCODE_REVERSE_BYTES: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_STORE_IND_U8 */
export declare const OPCODE_STORE_IND_U8: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_STORE_IND_U16 */
export declare const OPCODE_STORE_IND_U16: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_STORE_IND_U32 */
export declare const OPCODE_STORE_IND_U32: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_STORE_IND_U64 */
export declare const OPCODE_STORE_IND_U64: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_LOAD_IND_U8 */
export declare const OPCODE_LOAD_IND_U8: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_LOAD_IND_I8 */
export declare const OPCODE_LOAD_IND_I8: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_LOAD_IND_U16 */
export declare const OPCODE_LOAD_IND_U16: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_LOAD_IND_I16 */
export declare const OPCODE_LOAD_IND_I16: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_LOAD_IND_U32 */
export declare const OPCODE_LOAD_IND_U32: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_LOAD_IND_I32 */
export declare const OPCODE_LOAD_IND_I32: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_LOAD_IND_U64 */
export declare const OPCODE_LOAD_IND_U64: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_ADD_IMM_32 */
export declare const OPCODE_ADD_IMM_32: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_AND_IMM */
export declare const OPCODE_AND_IMM: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_XOR_IMM */
export declare const OPCODE_XOR_IMM: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_OR_IMM */
export declare const OPCODE_OR_IMM: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_MUL_IMM_32 */
export declare const OPCODE_MUL_IMM_32: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_SET_LT_U_IMM */
export declare const OPCODE_SET_LT_U_IMM: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_SET_LT_S_IMM */
export declare const OPCODE_SET_LT_S_IMM: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_SHLO_L_IMM_32 */
export declare const OPCODE_SHLO_L_IMM_32: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_SHLO_R_IMM_32 */
export declare const OPCODE_SHLO_R_IMM_32: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_SHAR_R_IMM_32 */
export declare const OPCODE_SHAR_R_IMM_32: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_NEG_ADD_IMM_32 */
export declare const OPCODE_NEG_ADD_IMM_32: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_SET_GT_U_IMM */
export declare const OPCODE_SET_GT_U_IMM: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_SET_GT_S_IMM */
export declare const OPCODE_SET_GT_S_IMM: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_SHLO_L_IMM_ALT_32 */
export declare const OPCODE_SHLO_L_IMM_ALT_32: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_SHLO_R_IMM_ALT_32 */
export declare const OPCODE_SHLO_R_IMM_ALT_32: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_SHAR_R_IMM_ALT_32 */
export declare const OPCODE_SHAR_R_IMM_ALT_32: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_CMOV_IZ_IMM */
export declare const OPCODE_CMOV_IZ_IMM: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_CMOV_NZ_IMM */
export declare const OPCODE_CMOV_NZ_IMM: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_ADD_IMM_64 */
export declare const OPCODE_ADD_IMM_64: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_MUL_IMM_64 */
export declare const OPCODE_MUL_IMM_64: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_SHLO_L_IMM_64 */
export declare const OPCODE_SHLO_L_IMM_64: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_SHLO_R_IMM_64 */
export declare const OPCODE_SHLO_R_IMM_64: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_SHAR_R_IMM_64 */
export declare const OPCODE_SHAR_R_IMM_64: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_NEG_ADD_IMM_64 */
export declare const OPCODE_NEG_ADD_IMM_64: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_SHLO_L_IMM_ALT_64 */
export declare const OPCODE_SHLO_L_IMM_ALT_64: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_SHLO_R_IMM_ALT_64 */
export declare const OPCODE_SHLO_R_IMM_ALT_64: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_SHAR_R_IMM_ALT_64 */
export declare const OPCODE_SHAR_R_IMM_ALT_64: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_ROT_R_64_IMM */
export declare const OPCODE_ROT_R_64_IMM: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_ROT_R_64_IMM_ALT */
export declare const OPCODE_ROT_R_64_IMM_ALT: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_ROT_R_32_IMM */
export declare const OPCODE_ROT_R_32_IMM: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_ROT_R_32_IMM_ALT */
export declare const OPCODE_ROT_R_32_IMM_ALT: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_BRANCH_EQ */
export declare const OPCODE_BRANCH_EQ: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_BRANCH_NE */
export declare const OPCODE_BRANCH_NE: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_BRANCH_LT_U */
export declare const OPCODE_BRANCH_LT_U: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_BRANCH_LT_S */
export declare const OPCODE_BRANCH_LT_S: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_BRANCH_GE_U */
export declare const OPCODE_BRANCH_GE_U: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_BRANCH_GE_S */
export declare const OPCODE_BRANCH_GE_S: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_LOAD_IMM_JUMP_IND */
export declare const OPCODE_LOAD_IMM_JUMP_IND: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_ADD_32 */
export declare const OPCODE_ADD_32: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_SUB_32 */
export declare const OPCODE_SUB_32: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_MUL_32 */
export declare const OPCODE_MUL_32: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_DIV_U_32 */
export declare const OPCODE_DIV_U_32: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_DIV_S_32 */
export declare const OPCODE_DIV_S_32: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_REM_U_32 */
export declare const OPCODE_REM_U_32: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_REM_S_32 */
export declare const OPCODE_REM_S_32: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_SHLO_L_32 */
export declare const OPCODE_SHLO_L_32: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_SHLO_R_32 */
export declare const OPCODE_SHLO_R_32: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_SHAR_R_32 */
export declare const OPCODE_SHAR_R_32: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_ADD_64 */
export declare const OPCODE_ADD_64: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_SUB_64 */
export declare const OPCODE_SUB_64: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_MUL_64 */
export declare const OPCODE_MUL_64: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_DIV_U_64 */
export declare const OPCODE_DIV_U_64: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_DIV_S_64 */
export declare const OPCODE_DIV_S_64: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_REM_U_64 */
export declare const OPCODE_REM_U_64: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_REM_S_64 */
export declare const OPCODE_REM_S_64: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_SHLO_L_64 */
export declare const OPCODE_SHLO_L_64: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_SHLO_R_64 */
export declare const OPCODE_SHLO_R_64: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_SHAR_R_64 */
export declare const OPCODE_SHAR_R_64: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_AND */
export declare const OPCODE_AND: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_XOR */
export declare const OPCODE_XOR: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_OR */
export declare const OPCODE_OR: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_MUL_UPPER_S_S */
export declare const OPCODE_MUL_UPPER_S_S: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_MUL_UPPER_U_U */
export declare const OPCODE_MUL_UPPER_U_U: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_MUL_UPPER_S_U */
export declare const OPCODE_MUL_UPPER_S_U: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_SET_LT_U */
export declare const OPCODE_SET_LT_U: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_SET_LT_S */
export declare const OPCODE_SET_LT_S: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_CMOV_IZ */
export declare const OPCODE_CMOV_IZ: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_CMOV_NZ */
export declare const OPCODE_CMOV_NZ: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_ROT_L_64 */
export declare const OPCODE_ROT_L_64: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_ROT_L_32 */
export declare const OPCODE_ROT_L_32: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_ROT_R_64 */
export declare const OPCODE_ROT_R_64: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_ROT_R_32 */
export declare const OPCODE_ROT_R_32: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_AND_INV */
export declare const OPCODE_AND_INV: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_OR_INV */
export declare const OPCODE_OR_INV: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_XNOR */
export declare const OPCODE_XNOR: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_MAX */
export declare const OPCODE_MAX: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_MAX_U */
export declare const OPCODE_MAX_U: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_MIN */
export declare const OPCODE_MIN: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/OPCODE_MIN_U */
export declare const OPCODE_MIN_U: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/PACKAGE_AUTH_GAS */
export declare const PACKAGE_AUTH_GAS: {
  /** @type `u32` */
  get value(): number
};
/** assembly/config/MAX_AUTH_CODE_SIZE */
export declare const MAX_AUTH_CODE_SIZE: {
  /** @type `u32` */
  get value(): number
};
/** assembly/config/PACKAGE_REF_GAS */
export declare const PACKAGE_REF_GAS: {
  /** @type `u64` */
  get value(): bigint
};
/** assembly/config/MAX_SERVICE_CODE_SIZE */
export declare const MAX_SERVICE_CODE_SIZE: {
  /** @type `u32` */
  get value(): number
};
/** assembly/config/SEGMENT_SIZE */
export declare const SEGMENT_SIZE: {
  /** @type `u32` */
  get value(): number
};
/** assembly/config/MAX_PACKAGE_EXPORTS */
export declare const MAX_PACKAGE_EXPORTS: {
  /** @type `u32` */
  get value(): number
};
/** assembly/config/MIN_PUBLIC_INDEX */
export declare const MIN_PUBLIC_INDEX: {
  /** @type `u32` */
  get value(): number
};
/** assembly/config/FUNC_GAS */
export declare const FUNC_GAS: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/FUNC_FETCH */
export declare const FUNC_FETCH: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/FUNC_LOOKUP */
export declare const FUNC_LOOKUP: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/FUNC_READ */
export declare const FUNC_READ: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/FUNC_WRITE */
export declare const FUNC_WRITE: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/FUNC_INFO */
export declare const FUNC_INFO: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/FUNC_HISTORICAL_LOOKUP */
export declare const FUNC_HISTORICAL_LOOKUP: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/FUNC_EXPORT */
export declare const FUNC_EXPORT: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/FUNC_MACHINE */
export declare const FUNC_MACHINE: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/FUNC_PEEK */
export declare const FUNC_PEEK: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/FUNC_POKE */
export declare const FUNC_POKE: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/FUNC_PAGES */
export declare const FUNC_PAGES: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/FUNC_INVOKE */
export declare const FUNC_INVOKE: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/FUNC_EXPUNGE */
export declare const FUNC_EXPUNGE: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/FUNC_LOG */
export declare const FUNC_LOG: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/FUNC_BLESS */
export declare const FUNC_BLESS: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/FUNC_ASSIGN */
export declare const FUNC_ASSIGN: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/FUNC_DESIGNATE */
export declare const FUNC_DESIGNATE: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/FUNC_CHECKPOINT */
export declare const FUNC_CHECKPOINT: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/FUNC_NEW */
export declare const FUNC_NEW: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/FUNC_UPGRADE */
export declare const FUNC_UPGRADE: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/FUNC_TRANSFER */
export declare const FUNC_TRANSFER: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/FUNC_EJECT */
export declare const FUNC_EJECT: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/FUNC_QUERY */
export declare const FUNC_QUERY: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/FUNC_SOLICIT */
export declare const FUNC_SOLICIT: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/FUNC_FORGET */
export declare const FUNC_FORGET: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/FUNC_YIELD */
export declare const FUNC_YIELD: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/FUNC_PROVIDE */
export declare const FUNC_PROVIDE: {
  /** @type `u8` */
  get value(): number
};
/** assembly/config/ERROR_NONE */
export declare const ERROR_NONE: {
  /** @type `i64` */
  get value(): bigint
};
/** assembly/config/ERROR_WHAT */
export declare const ERROR_WHAT: {
  /** @type `i64` */
  get value(): bigint
};
/** assembly/config/ERROR_OOB */
export declare const ERROR_OOB: {
  /** @type `i64` */
  get value(): bigint
};
/** assembly/config/ERROR_WHO */
export declare const ERROR_WHO: {
  /** @type `i64` */
  get value(): bigint
};
/** assembly/config/ERROR_FULL */
export declare const ERROR_FULL: {
  /** @type `i64` */
  get value(): bigint
};
/** assembly/config/ERROR_CORE */
export declare const ERROR_CORE: {
  /** @type `i64` */
  get value(): bigint
};
/** assembly/config/ERROR_CASH */
export declare const ERROR_CASH: {
  /** @type `i64` */
  get value(): bigint
};
/** assembly/config/ERROR_LOW */
export declare const ERROR_LOW: {
  /** @type `i64` */
  get value(): bigint
};
/** assembly/config/ERROR_HUH */
export declare const ERROR_HUH: {
  /** @type `i64` */
  get value(): bigint
};
/** assembly/config/ERROR_OK */
export declare const ERROR_OK: {
  /** @type `i64` */
  get value(): bigint
};
/**
 * assembly/config/isTerminationInstruction
 * @param opcode `u8`
 * @returns `bool`
 */
export declare function isTerminationInstruction(opcode: number): boolean;
/**
 * assembly/config/REGISTER_INIT_STACK_SEGMENT_END
 * @returns `u32`
 */
export declare function REGISTER_INIT_STACK_SEGMENT_END(): number;
/**
 * assembly/config/REGISTER_INIT_ARGS_SEGMENT_START
 * @returns `u32`
 */
export declare function REGISTER_INIT_ARGS_SEGMENT_START(): number;
/** assembly/types/MemoryAccessType */
export declare enum MemoryAccessType {
  /** @type `i32` */
  NONE,
  /** @type `i32` */
  READ,
  /** @type `i32` */
  WRITE,
}
/**
 * assembly/types/bytesToHex
 * @param bytes `~lib/typedarray/Uint8Array`
 * @returns `~lib/string/String`
 */
export declare function bytesToHex(bytes: Uint8Array): string;
/** assembly/wasm-wrapper/Status */
export declare enum Status {
  /** @type `i32` */
  OK,
  /** @type `i32` */
  HALT,
  /** @type `i32` */
  PANIC,
  /** @type `i32` */
  FAULT,
  /** @type `i32` */
  HOST,
  /** @type `i32` */
  OOG,
}
/**
 * assembly/wasm-wrapper/createPvmShell
 * @returns `assembly/wasm-wrapper/WasmPvmShellInterface`
 */
export declare function createPvmShell(): __Record5<never>;
/**
 * assembly/test-exports/roundTripSingleImplications
 * @param data `~lib/typedarray/Uint8Array`
 * @param numCores `i32`
 * @param numValidators `i32`
 * @param authQueueSize `i32`
 * @returns `~lib/typedarray/Uint8Array`
 */
export declare function roundTripSingleImplications(data: Uint8Array, numCores: number, numValidators: number, authQueueSize: number): Uint8Array;
/**
 * assembly/test-exports/roundTripImplications
 * @param data `~lib/typedarray/Uint8Array`
 * @param numCores `i32`
 * @param numValidators `i32`
 * @param authQueueSize `i32`
 * @returns `~lib/typedarray/Uint8Array`
 */
export declare function roundTripImplications(data: Uint8Array, numCores: number, numValidators: number, authQueueSize: number): Uint8Array;
/**
 * assembly/test-exports/roundTripServiceAccount
 * @param data `~lib/typedarray/Uint8Array`
 * @returns `~lib/typedarray/Uint8Array`
 */
export declare function roundTripServiceAccount(data: Uint8Array): Uint8Array;
/**
 * assembly/test-exports/roundTripPartialState
 * @param data `~lib/typedarray/Uint8Array`
 * @param numCores `i32`
 * @param numValidators `i32`
 * @param authQueueSize `i32`
 * @returns `~lib/typedarray/Uint8Array`
 */
export declare function roundTripPartialState(data: Uint8Array, numCores: number, numValidators: number, authQueueSize: number): Uint8Array;
/**
 * assembly/test-exports/getDecodedProgramFields
 * @param preimageBlob `~lib/typedarray/Uint8Array`
 * @returns `assembly/test-exports/DecodedProgramFields | null`
 */
export declare function getDecodedProgramFields(preimageBlob: Uint8Array): __Internref280 | null;
/** assembly/pvm/AccumulateInvocationResult */
declare class __Internref239 extends Number {
  private __nominal239: symbol;
  private __nominal0: symbol;
}
/** assembly/types/RunProgramResult */
declare class __Internref268 extends Number {
  private __nominal268: symbol;
  private __nominal0: symbol;
}
/** assembly/codec/DecodingResult<u64> */
declare class __Internref222 extends Number {
  private __nominal222: symbol;
  private __nominal0: symbol;
}
/** assembly/codec/DecodedBlob */
declare class __Internref224 extends Number {
  private __nominal224: symbol;
  private __nominal0: symbol;
}
/** assembly/codec/DecodingResult<assembly/codec/ServiceCodeResult> */
declare class __Internref221 extends Number {
  private __nominal221: symbol;
  private __nominal0: symbol;
}
/** assembly/codec/DecodedProgram */
declare class __Internref219 extends Number {
  private __nominal219: symbol;
  private __nominal0: symbol;
}
/** assembly/codec/ServiceAccountData */
declare class __Internref270 extends Number {
  private __nominal270: symbol;
  private __nominal0: symbol;
}
/** assembly/codec/RefineContext */
declare class __Internref272 extends Number {
  private __nominal272: symbol;
  private __nominal0: symbol;
}
/** assembly/codec/ImportSegment */
declare class __Internref273 extends Number {
  private __nominal273: symbol;
  private __nominal0: symbol;
}
/** assembly/codec/ExtrinsicReference */
declare class __Internref274 extends Number {
  private __nominal274: symbol;
  private __nominal0: symbol;
}
/** assembly/codec/WorkItem */
declare class __Internref275 extends Number {
  private __nominal275: symbol;
  private __nominal0: symbol;
}
/** assembly/codec/WorkPackage */
declare class __Internref278 extends Number {
  private __nominal278: symbol;
  private __nominal0: symbol;
}
/** assembly/codec/DecodingResult<assembly/codec/DecodedAccumulateArgs> */
declare class __Internref256 extends Number {
  private __nominal256: symbol;
  private __nominal0: symbol;
}
/** assembly/codec/DecodingResult<~lib/typedarray/Uint8Array> */
declare class __Internref244 extends Number {
  private __nominal244: symbol;
  private __nominal0: symbol;
}
/** ~lib/function/Function<%28~lib/typedarray/Uint8Array%29=>assembly/codec/DecodingResult<u32>|null> */
declare class __Internref248 extends Number {
  private __nominal248: symbol;
  private __nominal0: symbol;
}
/** assembly/codec/DecodingResult<~lib/array/Array<u32>> */
declare class __Internref247 extends Number {
  private __nominal247: symbol;
  private __nominal0: symbol;
}
/** ~lib/function/Function<%28~lib/typedarray/Uint8Array%29=>assembly/codec/DecodingResult<assembly/codec/DeferredTransfer>|null> */
declare class __Internref251 extends Number {
  private __nominal251: symbol;
  private __nominal0: symbol;
}
/** assembly/codec/DecodingResult<~lib/array/Array<assembly/codec/DeferredTransfer>> */
declare class __Internref250 extends Number {
  private __nominal250: symbol;
  private __nominal0: symbol;
}
/** ~lib/function/Function<%28~lib/typedarray/Uint8Array%29=>assembly/codec/DecodingResult<assembly/codec/ProvisionEntry>|null> */
declare class __Internref254 extends Number {
  private __nominal254: symbol;
  private __nominal0: symbol;
}
/** assembly/codec/DecodingResult<~lib/array/Array<assembly/codec/ProvisionEntry>> */
declare class __Internref253 extends Number {
  private __nominal253: symbol;
  private __nominal0: symbol;
}
/** assembly/codec/DecodingResult<assembly/codec/CompleteServiceAccount> */
declare class __Internref245 extends Number {
  private __nominal245: symbol;
  private __nominal0: symbol;
}
/** assembly/codec/DecodingResult<assembly/codec/PartialState> */
declare class __Internref243 extends Number {
  private __nominal243: symbol;
  private __nominal0: symbol;
}
/** assembly/codec/DecodingResult<assembly/codec/DeferredTransfer> */
declare class __Internref249 extends Number {
  private __nominal249: symbol;
  private __nominal0: symbol;
}
/** assembly/codec/DecodingResult<assembly/codec/Implications> */
declare class __Internref242 extends Number {
  private __nominal242: symbol;
  private __nominal0: symbol;
}
/** assembly/codec/DecodingResult<assembly/codec/ImplicationsPair> */
declare class __Internref241 extends Number {
  private __nominal241: symbol;
  private __nominal0: symbol;
}
/** ~lib/function/Function<%28~lib/typedarray/Uint8Array%29=>~lib/typedarray/Uint8Array> */
declare class __Internref265 extends Number {
  private __nominal265: symbol;
  private __nominal0: symbol;
}
/** assembly/codec/DeferredTransfer */
declare class __Internref41 extends Number {
  private __nominal41: symbol;
  private __nominal0: symbol;
}
/** ~lib/function/Function<%28u32%29=>~lib/typedarray/Uint8Array> */
declare class __Internref262 extends Number {
  private __nominal262: symbol;
  private __nominal0: symbol;
}
/** ~lib/function/Function<%28assembly/codec/DeferredTransfer%29=>~lib/typedarray/Uint8Array> */
declare class __Internref264 extends Number {
  private __nominal264: symbol;
  private __nominal0: symbol;
}
/** assembly/codec/ProvisionEntry */
declare class __Internref43 extends Number {
  private __nominal43: symbol;
  private __nominal0: symbol;
}
/** ~lib/function/Function<%28assembly/codec/ProvisionEntry%29=>~lib/typedarray/Uint8Array> */
declare class __Internref267 extends Number {
  private __nominal267: symbol;
  private __nominal0: symbol;
}
/** assembly/codec/CompleteServiceAccount */
declare class __Internref25 extends Number {
  private __nominal25: symbol;
  private __nominal0: symbol;
}
/** assembly/codec/PartialState */
declare class __Internref23 extends Number {
  private __nominal23: symbol;
  private __nominal0: symbol;
}
/** assembly/codec/Implications */
declare class __Internref22 extends Number {
  private __nominal22: symbol;
  private __nominal0: symbol;
}
/** assembly/codec/ImplicationsPair */
declare class __Internref21 extends Number {
  private __nominal21: symbol;
  private __nominal0: symbol;
}
/** assembly/wasm-wrapper/WasmPvmShellInterface */
declare interface __Record5<TOmittable> {
}
/** assembly/test-exports/DecodedProgramFields */
declare class __Internref280 extends Number {
  private __nominal280: symbol;
  private __nominal0: symbol;
}
