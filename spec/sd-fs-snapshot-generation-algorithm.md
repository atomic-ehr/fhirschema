# SD-FS Snapshot Generation Algorithm

## Overview

This document specifies snapshot generation in `fhirschema` using FS merge.

Primary implementation:
- `src/converter/snapshot.ts`
  - `generateSnapshot(...)`
  - `buildBaseChain(...)`
  - `ensureDifferential(...)`

Supporting implementation:
- forward converter: `src/converter/index.ts` (`translate`)
- schema merge: `src/validator/profile.ts` (`merge`)
- reverse converter: `src/converter/reverse.ts` (`toStructureDefinition`)

## Policy

Snapshot generation is differential-driven:
1. Input SD and all resolved bases must have `differential.element`.
2. `snapshot.element` is not used as primary conversion input.
3. Missing differential causes an error.

Code:
- `src/converter/snapshot.ts` (`ensureDifferential`)

## Inputs and outputs

Input:
- leaf `StructureDefinition` (usually profile)
- resolver (polymorphic)

Output:
- same SD with generated `snapshot.element`

Function:
- `generateSnapshot(structureDefinition, options)`

## Resolver model

Supported resolver forms:
1. function `(input) => SD | undefined`
2. function `(canonical) => SD | undefined`
3. object with `resolve(canonical, options)`
4. simple map `Record<string, SD>`

Supports canonical version syntax (`url|version`).

Code:
- `src/converter/snapshot.ts` (`resolveByCanonical`, `splitCanonicalVersion`)

## Algorithm

### 1. Build base chain

`buildBaseChain` walks `baseDefinition` from leaf to root:
- resolves each canonical via resolver
- detects cycles
- enforces `maxDepth`
- validates differential presence via `ensureDifferential`

Output order is base -> ... -> leaf.

Code:
- `src/converter/snapshot.ts` (`buildBaseChain`)

### 2. Convert chain to FHIRSchema

For each chain SD:
- run `translate(sd)`

Code:
- `src/converter/index.ts` (`translate`)

### 3. Merge schemas base -> leaf

Reduce chain with merge function:
- `merge(base, overlay)`

This merge operates in FS space and is simpler than direct SD snapshot expansion.

Code:
- `src/validator/profile.ts` (`merge`)
- `src/converter/snapshot.ts` (`mergeSchemas`)

### 4. Convert merged schema back to SD

Run reverse converter:
- `toStructureDefinition(merged, { emitChoiceVariants: 'strict' })`

Strict mode minimizes synthetic choice-variant over-expansion in snapshot output.

Code:
- `src/converter/reverse.ts` (`toStructureDefinition`)
- `src/converter/snapshot.ts` (`generateSnapshot`)

### 5. Rehydrate choice slice markers

Some original snapshots include marker rows of form:
- `path` containing `[x]`
- `sliceName` present

If these markers are missing after generation, they are copied from source SD snapshot/differential.

Code:
- `src/converter/snapshot.ts` (`rehydrateChoiceSliceMarkers`)

### 6. Return final SD with snapshot

Return original SD fields plus generated snapshot rows.

Code:
- `src/converter/snapshot.ts` (`generateSnapshot`)

## Error model

Possible errors:
- missing `differential.element`
- unresolved base canonical
- circular base chain
- maxDepth exceeded

Code:
- `src/converter/snapshot.ts`

## Test coverage

Unit behavior:
- `test/unit/snapshot-generator.test.ts`
  - merge behavior
  - base resolution
  - cycle/missing-base failures
  - differential-only behavior

Package-level parity tests (auto-download + cache):
- `test/integration/ig-snapshot-packages.test.ts`
  - FHIR Core
  - US Core
  - DaVinci HRex

Utility benchmarking script:
- `scripts/compare-ig-snapshots.ts`
