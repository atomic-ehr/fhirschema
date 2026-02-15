# SD -> FS Converter Analysis

This is a technical analysis of the existing `translate` converter in `src/converter/index.ts`.

## Pipeline summary

1. Header mapping (`buildResourceHeader`)
Maps SD metadata to FS and computes `class` (`profile`, `extension`, or `kind`).

2. Differential selection (`getDifferential`)
Uses only `differential.element` and skips root path entries.

3. Iterative stack algorithm
For each differential element:
- parse path (`parsePath`)
- enrich against previous path (`enrichPath`)
- compute enter/exit operations (`calculateActions`)
- transform element fields (`transformElement`)
- apply actions to stack (`applyActions`)

4. Choice expansion
`choice-handler.ts` expands `value[x]`-style definitions into parent `choices` plus typed children with `choiceOf`.

5. Final unwind + normalization
Remaining exits are applied, then schema is normalized (required sorting, stable nested element ordering by index).

## Strengths

1. Deterministic output shape
The stack algorithm plus normalization yields stable conversion output.

2. Good slicing support
Handles sliced transitions and nested slices with discriminator-derived matching.

3. Practical FHIR mappings
Covers cardinality, type, Reference target profiles, pattern/fixed normalization, binding extraction, and constraints.

4. Robust test coverage
Unit and golden tests validate algorithm behavior and many real-world profiles.

## Known limitations / design tradeoffs

1. Differential-only approach
Snapshot content is mostly ignored (except one binding lookup for choice declarations), so some information can be missed when differential is sparse.

2. Information loss by design
Many ElementDefinition authoring fields are dropped (`id`, `alias`, mapping/example blocks, etc.) for validator-oriented schema simplification.

3. Fixed vs pattern collapsed
Both are normalized into `pattern`, which helps runtime validation but loses original authoring intent.

4. Extension and slicing normalization
The generated FS is semantically focused; exact original SD authoring layout/order is not preserved.

## Complexity profile

- Time: approximately O(N * P), where N is number of differential elements and P is average path depth.
- Memory: O(N) for stack and resulting schema.
- Practical behavior: linear in profile size, with additional cost in deep slicing/choice-heavy profiles.

## Suggested improvements

1. Add optional strict mode preserving more ElementDefinition fields.
2. Expand roundtrip tests (SD -> FS -> SD -> FS) for representable subsets.
3. Add diagnostics hooks (e.g., list of dropped fields) to improve transparency for profile authors.
