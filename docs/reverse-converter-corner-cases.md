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

## Snapshot generation parity (status)

`generateSnapshot` (SD differential → FHIRSchema merge → SD snapshot) reaches full
element key-set parity against the official US Core snapshots and near-full parity
for R4–R6 core:

| package | profiles | exact key-set | precision | recall |
| --- | --- | --- | --- | --- |
| hl7.fhir.us.core 8.0.0-ballot | 67 | 67 | 1.000 | 1.000 |
| hl7.fhir.r4.core 4.0.1 | 649 | 626 | 1.000 | 0.992 |
| hl7.fhir.r4b.core 4.3.0 | 645 | 622 | 1.000 | 0.992 |
| hl7.fhir.r5.core 5.0.0 | 295 | 261 | 0.997 | 0.982 |
| hl7.fhir.r6.core 6.0.0-ballot | 229 | 197 | 0.997 | 0.976 |

Remaining gaps are element-field level (they do not change the element key-set):

1. **Primitive `System.*` type representation** — R4 encodes `Element.id`, `Extension.url`,
   and primitive `.value` with `type[0].code = "http://hl7.org/fhirpath/System.String"` and
   the FHIR type in a `structuredefinition-fhir-type` extension. The forward converter keeps
   only the FHIR type, so the round-trip emits the plain FHIR type code instead.
2. **Array → scalar narrowing** — when a derived profile narrows an inherited `0..*` element
   to `0..1`, FHIRSchema's sparse cardinality cannot distinguish "constrained to 1" from
   "unconstrained scalar", so the merged element may keep `array: true`. (Recording `max` on
   scalars would diverge from the canonical FHIRSchema format / golden output.)
3. **Extension-definition internals** — simple vs complex extension `Extension.extension`
   (`0..0` vs `0..*`) and `Extension.value[x]` (`1..1` vs `0..0`) suppression, plus the
   extension root element cardinality, are not yet reconstructed.
4. **`value[x]` choice type-list edge cases** in vital-signs-style profiles.

## Practical guidance

1. Treat roundtrip as semantic compatibility, not byte-for-byte SD equality.
2. For strict publishing workflows, keep original StructureDefinitions as source-of-truth artifacts.
3. Use tests that validate key constraints/cardinality/types rather than full JSON identity where lossy areas are involved.
