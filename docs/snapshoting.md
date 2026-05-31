# Snapshot generation

`generateSnapshot(sd, { resolver })` produces a FHIR `StructureDefinition.snapshot`
from a profile's **differential**, by going *through* FHIRSchema:

```
SD.differential ──translate──▶ FHIRSchema ──merge chain──▶ merged FHIRSchema
                                                                  │
   SD.snapshot ◀──reverse + expand──────────────────────────────┘
```

The idea: FHIRSchema is a clean, normalized overlay format, so "apply a base then a
derived profile" becomes a simple recursive merge of FHIRSchema nodes. We translate
every link of the base chain, merge, then translate the result back to a snapshot
element list.

> **Self-contained.** `generateSnapshot` derives the snapshot **purely** from the
> input's `differential.element` plus the resolved base chain (each resolved through
> `ctx.resolve`). It **never reads the input SD's own `snapshot`** — feeding a bogus
> one changes nothing (guarded by `test/unit/snapshot-ignores-input-snapshot.test.ts`).
> This mirrors the validator's snapshot-less property: everything inherited is resolved
> structurally at generation time, not copied from an answer key.

## Pipeline

Implemented in `src/converter/snapshot.ts`:

1. **`buildResolvedBaseChain`** — walk `baseDefinition` from leaf to root, plus any
   profiles referenced by `structuredefinition-implements` extensions. Returns
   base→leaf order. Each link must have a `differential.element` (`ensureDifferential`).
2. **`translate`** (`src/converter/index.ts`) — each SD differential → FHIRSchema
   (snapshot mode passes `{ explicitMaxCardinality: true }`, see "array → max" below).
3. **`foldSchemaChain`** — fold the chain with `mergeFHIRSchema` (`src/converter/merge.ts`)
   in base→leaf order. Snapshot mode passes `{ unionArrays: true }` so `required` /
   `excluded` are **unioned** across the chain (a base requirement must survive a
   derived layer that doesn't restate it). This is the overlay-merge primitive at the
   heart of snapshot generation; overlay scalar fields win, `elements` and
   `slicing.slices` merge recursively.
4. **`toStructureDefinition`** (`src/converter/to-structure-definition.ts`) — merged FHIRSchema → SD
   differential-style element list (the reverse converter).
5. **`fillChoiceVariantTypes`** — a typed choice-variant row may omit its type
   (`component.valueQuantity` with no `type`); infer it from the variant name so the
   next step can expand it.
6. **`expandInheritedTypeElements`** — the structural expander. An element's datatype
   children are materialized **iff the profile "reaches into" it** — i.e. some merged
   element is a strict descendant (`reachedParents`). When it does, the type's *full*
   one-level child set is resolved via `ctx.resolve` and added, recursing down the
   touched spine; an untouched inherited datatype element is left unexpanded (matching
   FHIR). The same gate bounds `contentReference` recursion (a nested cref expands only
   if it too is reached into — no depth cap needed) and primitive expansion (a
   primitive's `.value`/`.id` appear only when a child is pinned). A still-multi-typed
   `[x]` is skipped (ambiguous). A constrained-but-untyped child has its type filled.
7. **`normalizeChoicePathsToXStyle`** — FHIR snapshots use canonical `[x]`-style choice
   paths, not typed variants. Rename `valueQuantity[.child]` → `value[x][.child]`; a
   type-narrowed choice at an unsliced position becomes a `value[x]:valueQuantity`
   **slice** with `value[x].*` children, while one narrowed inside a sliced parent
   (`component:systolic`) just gets `value[x].*` children. The mapping comes from the
   `value[x]` base row the reverse converter keeps — no input snapshot needed.
8. **`rehydrateChoiceSliceMarkers`** — re-add `value[x]:variant` markers from the
   **chain differentials** (a childless variant is dropped by the reverse converter),
   with the same sliced-parent suppression.
9. **`dedupeElements`** — collapse any duplicate `(path, sliceName)` rows (choice
   narrowing can produce a base `value[x]` row and a rewritten variant row at the same
   key). Duplicate element ids are invalid FHIR, so this is an output invariant.

## Parity against official distribution snapshots

The IG packages ship official snapshots, so we generate ours **blind** (the input
snapshot is ignored) and diff element key-sets (`path|sliceName`). Measured against
cached packages (`test/integration/ig-snapshot-packages.test.ts`):

| package | profiles | exact key-set | precision | recall |
| --- | --- | --- | --- | --- |
| hl7.fhir.us.core 8.0.0-ballot | 67 | **67** | 1.000 | 1.000 |
| hl7.fhir.us.davinci-cdex 2.1.0 | 8 | 6 | 0.996 | 0.993 |
| hl7.fhir.us.davinci-hrex 1.1.0 | 14 | 11 | 0.911 | 0.929 |
| hl7.fhir.r4.core 4.0.1 | 653 | 624 | 0.994 | 0.985 |
| hl7.fhir.r4b.core 4.3.0 | 649 | 621 | 0.994 | 0.985 |
| hl7.fhir.r5.core 5.0.0 | 305 | 260 | 0.965 | 0.949 |
| hl7.fhir.r6.core 6.0.0-ballot4 | 239 | 196 | 0.956 | 0.935 |

- **precision** = generated keys also in official / generated keys (no invented rows).
- **recall** = generated keys also in official / official keys (no missing rows).
- These are the **honest self-contained** numbers (no input-snapshot oracle). US Core
  is exact; the cores are slightly lower — the cost of deriving everything structurally
  rather than peeking at the shipped snapshot. The earlier "1.000 precision" figures
  for the cores were oracle-assisted.

### How to reproduce

```bash
# full report (downloads to /tmp, prints totals + heavy-miss/extra lists)
bun run scripts/compare-uscore-snapshots.ts

# any package vs its distribution snapshot:
#   npm install --registry https://fs.get-ig.org/pkgs <pkg>@<version>
# packages are also fetched as ndjson.gz from https://fs.get-ig.org/rs/<id>-<ver>.ndjson.gz
# and cached under .cache/ig-packages (gitignored).
bun test test/integration/ig-snapshot-packages.test.ts
```

## Known field-level gaps

Element **key-set** parity is full for US Core and near-full for the cores; the
remaining diffs are at the *field* level (they don't add/remove element keys).

### 1. R4 `System.*` primitive type representation (cosmetic — intentionally not fixed)

R4 encodes the type of "system primitive" positions specially:

```json
"type": [{
  "extension": [{ "url": ".../structuredefinition-fhir-type", "valueUrl": "string" }],
  "code": "http://hl7.org/fhirpath/System.String"
}]
```

`code` holds the FHIRPath **system** type; the real FHIR type sits in the
`structuredefinition-fhir-type` extension (primitive `.value` rows also carry a `regex`
extension). The FHIRSchema forward converter (`element-transformer.buildElementType`)
**normalizes this away** — it lifts the FHIR type out of the extension and stores it
plainly (`type: "string"`), discarding the `System.String` wrapper and `regex`. That is
by design: FHIRSchema stores the usable FHIR type, not the R4 serialization artifact.

So our snapshot emits `type: [{ code: "string" }]` where the official emits
`code: "http://hl7.org/fhirpath/System.String"`. **Semantically identical** — both say
"FHIR string". It affects no element key, no validation, and no consumer that reads the
FHIR type.

Scope (US Core 8.0.0-ballot), all at depth 1:

| position | count | note |
| --- | --- | --- |
| `Type.id` | 67 | one root `id` per profile, `valueUrl: string`, `System.String` |
| `Extension.url` | 12 | extension definitions, `valueUrl: uri`, `System.String` |
| primitive `.value` | 0 | only appear when a profile pins them; none in US Core |

Note: **nested** `.id` rows (`Patient.identifier.id`, …) already match — they come from
`expandInheritedTypeElements`, which clones the *raw* datatype-SD element (System.String
intact). Only the root `id` and `Extension.url` go through the lossy
`translate → merge → reverse` path.

Decision: **not reproduced.** Our representation is cleaner and equivalent. If
byte-identical snapshots are ever required, the cheapest faithful route is a reverse-side
rule that re-emits `System.String` + `fhir-type` for `Type.id` / `Extension.url` (static,
~10 lines, no FHIRSchema-format change, no golden-test impact) — or simply normalize
`System.*` away in the comparison before diffing.

### 2. Extension-definition internals

Simple vs complex extension shaping is not yet reconstructed:
`Extension.extension` (`0..0` for simple, `0..*` for complex), `Extension.value[x]`
(`1..1` for simple, `0..0` for complex), and the extension root element's cardinality.

### Resolved

- **Array → max narrowing** — when a constraint tightens an inherited `0..*` element
  to max=1, the element looks scalar in isolation (the canonical translate drops
  `array`/`max` for it). Array-ness is hereditary, so this used to keep `array: true`
  with no `max`, emitting `0..*` instead of `0..1`. The snapshot pipeline now translates
  the chain with `explicitMaxCardinality: true`, which preserves the literal `max` on
  such an element; the base's `array: true` is folded in by the merge, yielding "an
  array with max 1" → the reverse emits `0..1`/`1..1`. The *canonical* `translate` keeps
  the flag off, so genuine scalars stay sparse and golden/roundtrip output is unchanged.
  Fixed `Coverage.payor` and reduced US Core field-level mismatch.
  (`test/unit/snapshot-array-max-narrowing.test.ts`)
- **Input-snapshot oracle removed** — datatype/primitive/contentReference expansion
  and choice-path styling were previously gated/styled by reading the input SD's own
  `snapshot`. All of that is now derived structurally from the differential + resolved
  base chain (the `reachedParents` "reach-into" rule, full type expansion via
  `ctx.resolve`, deterministic `[x]`-style normalization, slice markers from the chain
  differentials). `generateSnapshot` no longer reads `structureDefinition.snapshot`.
  US Core stays 67/67 exact, fully self-contained.
- **Resliced `value[x]` datatype children** — when a `value[x]` is constrained to
  different types under different parent slices, each *reached-into* variant's datatype
  children expand (the per-anchor expansion key includes the element's type signature,
  so same-path rows don't collapse to the first type).
- **`contentReference` recursion** (recursive backbones like
  `Parameters.parameter.part.part`) — expanded per reference, bounded structurally by
  `reachedParents` (a nested cref expands only if it is itself reached into).

## Tests

- Self-containment (the load-bearing invariant):
  `test/unit/snapshot-ignores-input-snapshot.test.ts` — a bogus input snapshot must not
  change the output.
- Structural expansion (blind, one root cause each):
  `test/unit/snapshot-selfcontained-expansion.test.ts` (reach-into rule),
  `snapshot-datatype-expansion.test.ts` (type-fill, primitive policy),
  `snapshot-choice-children.test.ts` / `snapshot-resliced-choice.test.ts` (choice
  normalization), `snapshot-content-reference.test.ts` (cref bound),
  `snapshot-array-max-narrowing.test.ts`,
  `reverse-slice-type.test.ts`, `reverse-slice-cardinality.test.ts`,
  `reverse-extension-slot.test.ts`, `merge-fhirschema.test.ts`.
- Generator/reverse/roundtrip: `test/unit/snapshot-generator.test.ts`,
  `reverse-converter.test.ts`, `test/golden/roundtrip.test.ts`.
- Integration parity, blind (cached packages): `test/integration/ig-snapshot-packages.test.ts`.

See also `docs/reverse-converter-corner-cases.md`,
`spec/sd-fs-snapshot-generation-algorithm.md`, `spec/fs-to-sd-converter-algorithm.md`.
