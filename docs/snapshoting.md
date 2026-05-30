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

> Conversion rule (see `CLAUDE.md`): `StructureDefinition → FHIRSchema` always uses
> `differential.element` as the source of truth. `snapshot.element`, when present on
> the input, is used **only** as an oracle for which datatype children to expand and
> for choice-path style — never as conversion input.

## Pipeline

Implemented in `src/converter/snapshot.ts`:

1. **`buildBaseChain`** — walk `baseDefinition` from leaf to root, plus any profiles
   referenced by `structuredefinition-implements` extensions. Returns base→leaf order.
   Each link must have a `differential.element` (`ensureDifferential`).
2. **`translate`** (`src/converter/index.ts`) — each SD differential → FHIRSchema.
3. **`mergeSchemas`** — fold the chain with `merge` (`src/validator/profile.ts`) in
   base→leaf order. Snapshot mode passes `{ unionArrays: true }` so `required` /
   `excluded` are **unioned** across the chain (a base requirement must survive a
   derived layer that doesn't restate it). The validator uses the same `merge` without
   that flag, keeping its established overlay semantics.
4. **`toStructureDefinition`** (`src/converter/reverse.ts`) — merged FHIRSchema → SD
   differential-style element list (the reverse converter).
5. **`rewriteChoicePathsToSourceStyle`** — rewrite typed choice paths
   (`valueQuantity.*`) to the source's `[x]` style (`value[x].*`). Done *before*
   expansion so a constrained variant child already occupies its key.
6. **`expandInheritedTypeElements`** — expand each element's type one level into its
   datatype children (e.g. `identifier` → `identifier.system`, `.value`, …), gated by
   presence in the source path set. Complex types expand by default; primitive types
   expand only the specific children the source pins (e.g. `canonical.value`). When a
   constrained child already exists, only its missing `type` is filled in.
7. **`rehydrateChoiceSliceMarkers`** — restore `value[x]:variant` slice marker rows.
8. **`dedupeElements`** — collapse any duplicate `(path, sliceName)` rows (choice
   narrowing can produce a base `value[x]` row and a rewritten variant row at the same
   key). Duplicate element ids are invalid FHIR, so this is an output invariant.

## Parity against official distribution snapshots

The IG packages ship official snapshots, so we generate ours and diff element key-sets
(`path|sliceName`). Measured against cached packages
(`scripts/compare-uscore-snapshots.ts`, `test/integration/ig-snapshot-packages.test.ts`):

| package | profiles | exact key-set | precision | recall |
| --- | --- | --- | --- | --- |
| hl7.fhir.us.core 8.0.0-ballot | 67 | **67** | 1.000 | 1.000 |
| hl7.fhir.us.davinci-cdex 2.1.0 | 8 | 6 | 1.000 | 0.995 |
| hl7.fhir.us.davinci-hrex 1.1.0 | 14 | 12 | 0.926 | 0.929 |
| hl7.fhir.r4.core 4.0.1 | 649 | 626 | 1.000 | 0.992 |
| hl7.fhir.r4b.core 4.3.0 | 645 | 622 | 1.000 | 0.992 |
| hl7.fhir.r5.core 5.0.0 | 295 | 261 | 0.997 | 0.982 |
| hl7.fhir.r6.core 6.0.0-ballot | 229 | 197 | 0.997 | 0.976 |

- **precision** = generated keys also in official / generated keys (no invented rows).
- **recall** = generated keys also in official / official keys (no missing rows).

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

### 2. Array → scalar narrowing

When a derived profile narrows an inherited `0..*` element to `0..1`, FHIRSchema's
sparse cardinality cannot distinguish "constrained to 1" from "unconstrained scalar"
(a max=1 constraint translates to *no* `array`/`max` field). The merged element can
therefore keep `array: true`, yielding `0..*` instead of `0..1`. Recording `max` on
scalars would diverge from the canonical FHIRSchema format and the golden output, so
this is left as a representation limitation. Seen on a handful of profiles
(`Coverage.payor`, `CareTeam.participant.role`, `DocumentReference.context.encounter`).

### 3. Extension-definition internals

Simple vs complex extension shaping is not yet reconstructed:
`Extension.extension` (`0..0` for simple, `0..*` for complex), `Extension.value[x]`
(`1..1` for simple, `0..0` for complex), and the extension root element's cardinality.

### 4. `contentReference` recursion

Recursive backbone elements reached via `contentReference` (FHIRSchema
`elementReference`) are not expanded past the reference, e.g.
`Parameters.parameter.part.part` (CDex `CDexParametersSubmitAttachment`).

### 5. `value[x]` choice type-list edge cases

A few vital-signs-style profiles disagree on the exact multi-type list emitted on a
`value[x]` / `component.value[x]` element.

## Tests

- Unit (targeted, one root cause each):
  `test/unit/snapshot-datatype-expansion.test.ts`,
  `snapshot-choice-children.test.ts`,
  `reverse-slice-type.test.ts`, `reverse-slice-cardinality.test.ts`,
  `reverse-extension-slot.test.ts`, `merge-required-union.test.ts`.
- Generator/reverse/roundtrip: `test/unit/snapshot-generator.test.ts`,
  `reverse-converter.test.ts`, `test/golden/roundtrip.test.ts`.
- Integration parity (cached packages): `test/integration/ig-snapshot-packages.test.ts`.

See also `docs/reverse-converter-corner-cases.md`,
`spec/sd-fs-snapshot-generation-algorithm.md`, `spec/fs-to-sd-converter-algorithm.md`.
