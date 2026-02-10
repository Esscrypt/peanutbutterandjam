# WorkPackage Fields Explanation (Gray Paper Reference)

This document explains each field in the WorkPackage test vector (`work_package.json`) based on the Gray Paper specification.

## Gray Paper References
- **Work Package Definition**: Equation 65 (`work_packages_and_reports.tex`)
- **Work Item Definition**: Equation 77 (`work_packages_and_reports.tex`)
- **Work Context Definition**: Equation 57 (`reporting_assurance.tex`)
- **Serialization Order**: Equation 242 (`serialization.tex`)

---

## WorkPackage Fields

### 1. `auth_code_host` (Type: `serviceid`, Gray Paper: `$\wp¬authcodehost$`)

**Definition**: The index of the service which hosts the authorization code.

**Gray Paper Reference**: Equation 65, line 68
```
$\isa{\wp¬authcodehost}{\serviceid}$
```

**Usage**:
- Identifies which service account contains the authorization code
- Used in historical lookup: `histlookup(accounts[wp_authcodehost], lookup_anchor_time, wp_authcodehash)`
- The authorization code must be available from the historical lookup of this service at the lookup anchor block

**Example from test vector**: `305419896` (service ID)

---

### 2. `auth_code_hash` (Type: `hash`, Gray Paper: `$\wp¬authcodehash$`)

**Definition**: Hash of the authorization code.

**Gray Paper Reference**: Equation 65, line 69
```
$\isa{\wp¬authcodehash}{\hash}$
```

**Usage**:
- Used to compute the authorizer: `authorizer = blake(authcodehash || authconfig)` (Equation 154)
- Used in historical lookup to retrieve the actual authorization code
- The preimage (actual authorization code) must be available from the service account at the lookup anchor block

**Example from test vector**: `"0x022e5e165cc8bd586404257f5cd6f5a31177b5c951eb076c7c10174f90006eef"` (32-byte hash)

---

### 3. `authorization` (Type: `blob`, Gray Paper: `$\wp¬authtoken$`)

**Definition**: A simple blob acting as an authorization token.

**Gray Paper Reference**: Equation 65, line 67
```
$\isa{\wp¬authtoken}{\blob}$
```

**Usage**:
- Opaque data included with the work-package to help make an argument that the work-package should be authorized
- Passed to the authorization code (authorizer) during the Is-Authorized invocation
- The authorizer logic uses this token to determine if the work-package is authorized for execution
- Size is limited as part of the work-bundle size constraint (Equation 108)

**Example from test vector**: `"0x0102030405"` (arbitrary blob data)

---

### 4. `authorizer_config` (Type: `blob`, Gray Paper: `$\wp¬authconfig$`)

**Definition**: Configuration blob for the authorization code.

**Gray Paper Reference**: Equation 65, line 70
```
$\isa{\wp¬authconfig}{\blob}$
```

**Usage**:
- Opaque configuration data meaningful to the PVM authorization code
- Used to compute the authorizer: `authorizer = blake(authcodehash || authconfig)` (Equation 154)
- The authorizer is identified as the hash of the authorization code hash concatenated with this configuration
- Size is limited as part of the work-bundle size constraint (Equation 108)

**Example from test vector**: `"0x00010203040506070809"` (arbitrary blob data)

---

### 5. `context` (Type: `workcontext`, Gray Paper: `$\wp¬context$`)

**Definition**: Refinement context describing the chain state at the point the work-package was evaluated.

**Gray Paper Reference**: 
- Equation 65, line 71: `$\isa{\wp¬context}{\workcontext}$`
- Equation 57: Full workcontext definition

**Structure** (Equation 57):
```
workcontext ≡ tuple{
  anchorhash: hash,           // Anchor block header hash
  anchorpoststate: hash,      // Posterior state root after anchor block
  anchoraccoutlog: hash,     // Accumulation output log super-peak
  lookupanchorhash: hash,    // Lookup anchor block header hash
  lookupanchortime: timeslot, // Lookup anchor block timeslot
  prerequisites: set{hash}   // Prerequisite work-package hashes
}
```

**Usage**:
- **`anchor`** (`anchorhash`): Block header hash denoting when the work-package was evaluated. Used to identify the block state for execution.
- **`state_root`** (`anchorpoststate`): State root hash of the posterior state after the anchor block was executed. Used to verify state consistency.
- **`beefy_root`** (`anchoraccoutlog`): Accumulation output log super-peak (Beefy root hash). Used for cross-chain verification.
- **`lookup_anchor`** (`lookupanchorhash`): Lookup anchor block header hash. Used for historical lookups of service code.
- **`lookup_anchor_slot`** (`lookupanchortime`): Lookup anchor block timeslot. Used in historical lookup: `histlookup(accounts[service], lookup_anchor_time, codehash)`
- **`prerequisites`**: Set of work-package hashes that must be processed before this work-package. Used for dependency ordering.

**Constraints**:
- `lookup_anchor_time >= current_timeslot - Cmaxlookupanchorage` (Equation 341)
- Anchor block must exist in chain history (Equation 346)
- Prerequisites must be processed before this work-package

**Example from test vector**:
```json
{
  "anchor": "0xc0564c5e0de0942589df4343ad1956da66797240e2a2f2d6f8116b5047768986",
  "state_root": "0xf6967658df626fa39cbfb6014b50196d23bc2cfbfa71a7591ca7715472dd2b48",
  "beefy_root": "0x9329de635d4bbb8c47cdccbbc1285e48bf9dbad365af44b205343e99dea298f3",
  "lookup_anchor": "0x60751ab5b251361fbfd3ad5b0e84f051ccece6b00830aed31a5354e00b20b9ed",
  "lookup_anchor_slot": 33,
  "prerequisites": []
}
```

---

### 6. `items` (Type: `sequence[1:Cmaxpackageitems]{workitem}`, Gray Paper: `$\wp¬workitems$`)

**Definition**: Sequence of work items to be executed.

**Gray Paper Reference**: Equation 65, line 72
```
$\isa{\wp¬workitems}{\sequence[1:\Cmaxpackageitems]{\workitem}}$
```

**Usage**:
- Contains one or more work items (minimum 1, maximum `Cmaxpackageitems`)
- Each work item is executed sequentially during refinement
- All work items share the same work-package context and authorization
- Total gas limits across all items are constrained (Equation 121-125)

**Constraints**:
- Total exports: `sum(exportcount) <= Cmaxpackageexports = 3072` (Equation 94)
- Total imports: `sum(len(importsegments)) <= Cmaxpackageimports = 3072` (Equation 94)
- Total extrinsics: `sum(len(extrinsics)) <= Cmaxpackagexts = 128` (Equation 94)
- Total refine gas: `sum(refgaslimit) < Cpackagerefgas` (Equation 125)
- Total accumulate gas: `sum(accgaslimit) < Creportaccgas` (Equation 123)

---

## WorkItem Fields

### 1. `service` (Type: `serviceid`, Gray Paper: `$\wi¬serviceindex$`)

**Definition**: The identifier of the service to which this work item relates.

**Gray Paper Reference**: Equation 77, line 79
```
$\isa{\wi¬serviceindex}{\serviceid}$
```

**Usage**:
- Identifies which service account's code should be executed
- Used in historical lookup: `histlookup(accounts[serviceindex], lookup_anchor_time, codehash)`
- The service must exist in the accounts dictionary
- The service code must be available at the lookup anchor block

**Example from test vector**: `16909060` (service ID)

---

### 2. `code_hash` (Type: `hash`, Gray Paper: `$\wi¬codehash$`)

**Definition**: Code hash of the service at the time of reporting.

**Gray Paper Reference**: Equation 77, line 80
```
$\isa{\wi¬codehash}{\hash}$
```

**Usage**:
- Hash of the service code that should be executed
- Used in historical lookup to retrieve the actual service code
- The preimage (actual service code) must be available from the service account at the lookup anchor block
- If code is not found: returns `BAD` error (Equation 82)
- If code exceeds `Cmaxservicecodesize`: returns `BIG` error (Equation 83)

**Example from test vector**: `"0x70a50829851e8f6a8c80f92806ae0e95eb7c06ad064e311cc39107b3219e532e"` (32-byte hash)

---

### 3. `payload` (Type: `blob`, Gray Paper: `$\wi¬payload$`)

**Definition**: Payload blob passed to the service code during refinement.

**Gray Paper Reference**: Equation 77, line 81
```
$\isa{\wi¬payload}{\blob}$
```

**Usage**:
- Arbitrary data passed as an argument to the Refine invocation
- Encoded as part of refine arguments: `encode(coreIndex, workItemIndex, serviceindex, var{payload}, blake{workpackage})` (Equation 85)
- The payload hash is included in the work digest: `payloadhash = blake(payload)` (Equation 141)
- Size is limited as part of the work-bundle size constraint (Equation 108)

**Example from test vector**: `"0x0102030405"` (arbitrary blob data)

---

### 4. `refine_gas_limit` (Type: `gas`, Gray Paper: `$\wi¬refgaslimit$`)

**Definition**: Gas limit for the Refinement invocation.

**Gray Paper Reference**: Equation 77, line 82
```
$\isa{\wi¬refgaslimit}{\gas}$
```

**Usage**:
- Maximum gas that can be consumed during the Refine invocation (Ψ_R)
- Used to initialize the PVM gas counter for refinement execution
- Total across all work items must be less than `Cpackagerefgas` (Equation 125)
- If gas is exhausted during execution, the work item returns `OOG` (Out-of-Gas) error

**Example from test vector**: `42` (gas units)

---

### 5. `accumulate_gas_limit` (Type: `gas`, Gray Paper: `$\wi¬accgaslimit$`)

**Definition**: Gas limit for the Accumulation invocation.

**Gray Paper Reference**: Equation 77, line 83
```
$\isa{\wi¬accgaslimit}{\gas}$
```

**Usage**:
- Maximum gas that can be consumed during the Accumulate invocation (Ψ_A)
- Used to initialize the PVM gas counter for accumulation execution
- Total across all work items must be less than `Creportaccgas` (Equation 123)
- Included in the work digest: `gaslimit = accgaslimit` (Equation 142)
- If gas is exhausted during execution, the work item returns `OOG` error

**Example from test vector**: `42` (gas units)

---

### 6. `export_count` (Type: `N`, Gray Paper: `$\wi¬exportcount$`)

**Definition**: Number of data segments exported by this work item.

**Gray Paper Reference**: Equation 77, line 84
```
$\isa{\wi¬exportcount}{\N}$
```

**Usage**:
- Declares how many export segments (each 4104 bytes) this work item will produce
- Used to allocate space in the work-report for exported segments
- Exported segments are generated during Refine execution via the EXPORT host function
- If the actual number of exports doesn't match this count, the work item returns `BADEXPORTS` error
- Total across all work items must be <= `Cmaxpackageexports = 3072` (Equation 94)
- Included in work digest: `exportcount` (Equation 146)

**Example from test vector**: `4` (segments)

---

### 7. `import_segments` (Type: `sequence{tuple{hash ∪ (hash^⊞), N}}`, Gray Paper: `$\wi¬importsegments$`)

**Definition**: Sequence of imported data segments that identify prior exported segments.

**Gray Paper Reference**: Equation 77, line 85
```
$\isa{\wi¬importsegments}{\sequence{\tuple{\hash \cup (\hash^\boxplus),\N}}}$
```

**Structure**: Each import segment is a tuple:
- **`tree_root`** (or work-package hash): Either:
  - A segment-root hash (from `hash`): Direct reference to a segment tree root
  - A work-package hash (from `hash^⊞`): Hash of the exporting work-package (must be converted to segment-root)
- **`index`**: Index into the segment tree to identify the specific segment

**Usage**:
- References segments exported by previous work-packages
- Used by the FETCH host function during Refine execution to retrieve segment data
- Segments are fetched from the D³L (Distributed, Decentralized, Data Lake)
- If referenced via work-package hash, must be converted to segment-root and reported in work-report's `srlookup`
- Total across all work items must be <= `Cmaxpackageimports = 3072` (Equation 94)
- Each segment is 4104 bytes (Csegmentsize)
- Included in work digest: `importcount = len(importsegments)` (Equation 145)

**Gray Paper Note** (Equation 90):
> "A value drawn from the regular $\hash$ implies the hash value is of the segment-root containing the export, whereas a value drawn from $\hash^\boxplus$ implies the hash value is the hash of the exporting work-package. In the latter case it must be converted into a segment-root by the guarantor and this conversion reported in the work-report for on-chain validation."

**Example from test vector**:
```json
[
  {
    "tree_root": "0x461236a7eb29dcffc1dd282ce1de0e0ed691fc80e91e02276fe8f778f088a1b8",
    "index": 0
  },
  {
    "tree_root": "0xe7cb536522c1c1b41fff8021055b774e929530941ea12c10f1213c56455f29ad",
    "index": 1
  }
]
```

---

### 8. `extrinsic` (Type: `sequence{tuple{hash, N}}`, Gray Paper: `$\wi¬extrinsics$`)

**Definition**: Sequence of blob hashes and lengths to be introduced in this block.

**Gray Paper Reference**: Equation 77, line 86
```
$\isa{\wi¬extrinsics}{\sequence{\tuple{\hash, \N}}}$
```

**Structure**: Each extrinsic is a tuple:
- **`hash`**: Hash of the extrinsic data blob
- **`len`**: Length of the extrinsic data in bytes

**Usage**:
- Extrinsic data are blobs introduced into the system alongside the work-package
- Exposed to the Refine logic as an argument via the FETCH host function
- The preimage (actual data) must be known by the guarantor (assumed to be passed alongside the work-package)
- Total across all work items must be <= `Cmaxpackagexts = 128` (Equation 94)
- Included in work digest:
  - `xtcount = len(extrinsics)` (Equation 147)
  - `xtsize = sum(len for all extrinsics)` (Equation 148)

**Gray Paper Note** (Equation 104):
> "We make an assumption that the preimage to each extrinsic hash in each work-item is known by the guarantor. In general this data will be passed to the guarantor alongside the work-package."

**Example from test vector**:
```json
[
  {
    "hash": "0x381a0e351c5593018bbc87dd6694695caa1c0c1ddb24e70995da878d89495bf1",
    "len": 16
  },
  {
    "hash": "0x6c437d85cd8327f42a35d427ede1b5871347d3aae7442f2df1ff80f834acf17a",
    "len": 17
  }
]
```

---

## Serialization Order

According to Gray Paper Equation 242 (`serialization.tex`), the WorkPackage is serialized as:
1. `encode[4]{authcodehost}` - 4-byte fixed-length service ID
2. `authcodehash` - 32-byte hash
3. `context` - work context structure
4. `var{authtoken}` - variable-length blob with length prefix
5. `var{authconfig}` - variable-length blob with length prefix
6. `var{workitems}` - variable-length sequence with length prefix

---

## Key Constraints Summary

1. **Bandwidth Limits** (Equation 94):
   - Total exports: ≤ 3072
   - Total imports: ≤ 3072
   - Total extrinsics: ≤ 128

2. **Gas Limits** (Equation 121-125):
   - Total refine gas: < `Cpackagerefgas`
   - Total accumulate gas: < `Creportaccgas`

3. **Bundle Size** (Equation 108):
   - Total size (token + config + payloads + imports + extrinsics) ≤ 13,791,360 bytes (~13.6 MB)

4. **Historical Lookup** (Equation 154-160):
   - Authorization code must be available from `authcodehost` at `lookup_anchor_time`
   - Service code must be available from `serviceindex` at `lookup_anchor_time`
   - Lookup anchor time must be within `Cmaxlookupanchorage` of current timeslot

---

## References

- **Gray Paper Section**: "Work Packages and Work Reports" (`work_packages_and_reports.tex`)
- **Work Package Definition**: Equation 65
- **Work Item Definition**: Equation 77
- **Work Context Definition**: Equation 57 (`reporting_assurance.tex`)
- **Serialization**: Equation 242 (`serialization.tex`)
- **Authorization**: Section "Authorizers and Authorizations" (`authorization.tex`)
