# FHIRSchema -> StructureDefinition: Corner Cases

This project now supports a backward converter (`toStructureDefinition`) from FHIRSchema into a FHIR `StructureDefinition` differential.

The conversion is best-effort. Some SD details are irreversibly lost in `SD -> FHIRSchema`, so exact reconstruction is impossible in specific cases.

## Irreversible / lossy areas

1. Metadata not represented in FHIRSchema
Only fields carried in FHIRSchema header can be restored. Fields like `id`, `title`, `date`, publisher/contact metadata, mappings, examples, aliases, requirements, comments, and other authoring-time details are not recoverable.

2. Differential vs snapshot provenance
FHIRSchema is a normalized representation and does not preserve whether a rule originally came from differential or snapshot context. The backward converter always emits a differential list.

3. Element-level authoring annotations
`ElementDefinition.id`, `alias`, `mapping`, `example`, `condition`, `definition`, and `requirements` are intentionally stripped by the forward converter, so they cannot be rebuilt.

4. Slicing semantics beyond retained shape
FHIRSchema stores normalized slice structures (`slicing`, `slices`, `match`, optional `schema`). Some source SD authoring patterns (adjacency/order nuances, exact discriminator derivation shape, or equivalent-but-different slice encodings) cannot be reconstructed exactly.

5. Choice element reconstruction
FHIRSchema encodes choices as `choices` + `choiceOf`. The backward converter emits `[x]` declarations and typed variants when needed, but the exact original representation (single multi-type element vs fully expanded typed differential entries) may differ while remaining semantically equivalent.

6. Content references
`contentReference` is converted to `elementReference` in FHIRSchema. Backward conversion restores only local references that still match the current schema URL/path convention.

7. Fixed/pattern normalization
Forward conversion normalizes both `fixed[x]` and `pattern[x]` into `pattern` (plus optional inferred `type`). This means original distinction (`fixed` vs `pattern`) may be unrecoverable.

## Practical guidance

1. Treat roundtrip as semantic compatibility, not byte-for-byte SD equality.
2. For strict publishing workflows, keep original StructureDefinitions as source-of-truth artifacts.
3. Use tests that validate key constraints/cardinality/types rather than full JSON identity where lossy areas are involved.
