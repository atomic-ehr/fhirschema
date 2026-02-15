# FS to SD Converter Algorithm

## Overview

This document specifies the reverse conversion algorithm from `FS` to `StructureDefinition` differential.

Implementation entry points:
- `src/converter/reverse.ts`
  - `toStructureDefinition(...)`
  - `addElementTree(...)`
  - `buildBaseElement(...)`

## Goals

1. Reconstruct a valid differential-oriented `StructureDefinition` from `FS`.
2. Preserve validation semantics represented in FS.
3. Emit deterministic output suitable for roundtrip and snapshot workflows.

## Inputs and outputs

Input:
- `FS`

Output:
- `StructureDefinition` with `differential.element`

Primary function:
- `toStructureDefinition(schema, options?)` in `src/converter/reverse.ts`

## Algorithm

### 1. Build header

`toStructureDefinition` maps top-level fields:
- `url`, `version`, `name`, `description`, `status`, `kind`, `type`, `baseDefinition`, `derivation`

Root differential row is initialized as:
- `{ path: schema.type, min: 0, max: '*' }`
- Exception: if `schema.type === 'Extension'`, root `max` is `1`

Code:
- `src/converter/reverse.ts` (`toStructureDefinition`)

### 2. Walk element tree

The converter recursively traverses `schema.elements` using `addElementTree`.

For each element:
1. Compute SD path (`<parent>.<name>` or `<parent>.<name>[x]` for choices).
2. Build base row via `buildBaseElement`.
3. Recurse into nested `elements`.

Code:
- `src/converter/reverse.ts` (`addElementTree`)

### 3. Cardinality reconstruction

`applyCardinality` maps FS cardinality to SD:
- explicit `max = 0` is preserved as suppression
- array fields -> `max='*'` or numeric `max`
- required scalar (`required` set) -> `min=1`, `max='1'`

Code:
- `src/converter/reverse.ts` (`applyCardinality`)

### 4. Type reconstruction

`buildType` maps:
- standard `type`
- `Reference + refers -> targetProfile`
- extension URL semantics

Code:
- `src/converter/reverse.ts` (`buildType`)

### 5. Constraints and bindings

`buildBaseElement` applies:
- constraints map -> `constraint[]`
- binding block -> `binding`
- `bindingName` extension mapping

Code:
- `src/converter/reverse.ts` (`buildConstraintArray`, `buildBinding`, `buildBaseElement`)

### 6. Pattern and fixed-like fields

Pattern mapping:
- `pattern.type + pattern.value` -> `patternX`
- if `pattern.type` is absent, type is inferred from primitive value

Additional passthrough:
- keeps `fixedX/defaultValueX/patternX` explicit fields when present
- preserves non-structural passthrough fields unless they collide with generated fields

Code:
- `src/converter/reverse.ts` (`buildPatternFields`, `inferPatternType`, `buildBaseElement`)

### 7. Choice reconstruction

Parent choice row:
- `name[x]` with `type[]` built from `choices`

Variant rows:
- controlled by `emitChoiceVariants` mode:
  - `all`
  - `constrained`
  - `strict`
- suppressed parent choice (`max=0`) prevents variant expansion

Code:
- `src/converter/reverse.ts` (`fromChoiceElementName`, `hasVariantSpecificFields`, `addElementTree`)

### 8. Slicing reconstruction

For `slicing.slices` entries:
1. emit parent slicing metadata (`discriminator`, `rules`, `ordered`)
2. emit slice rows with `sliceName`
3. map slice-level `min/max`
4. recurse into slice schema elements

Code:
- `src/converter/reverse.ts` (`addElementTree`)

## Corner cases and lossiness

Not all SD authoring details are recoverable from FS.
See:
- `docs/reverse-converter-corner-cases.md`

Typical non-reversible areas:
- original `ElementDefinition.id` formatting
- authoring comments/mappings/examples
- exact fixed-vs-pattern provenance in some normalized flows
- differential authoring style details

## Complexity

Approximate complexity:
- Time: `O(E)` where `E` is number of emitted elements
- Space: `O(E)`

## Related code

- `src/converter/reverse.ts`
- `src/converter/types.ts`
- `test/unit/reverse-converter.test.ts`
- `test/golden/roundtrip.test.ts`
