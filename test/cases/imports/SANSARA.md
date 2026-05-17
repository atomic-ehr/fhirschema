# Sansara fhir-clj — import registry

Source: [../sansara/box/libs/fhir-clj/test/fhir/validator/core_test.clj](../../../../sansara/box/libs/fhir-clj/test/fhir/validator/core_test.clj)
(~3,400 lines, Clojure validator with `matcho` matchers, runs on real
FHIR R4/R5 packages).

This file tracks per-`deftest`/`testing` block which sansara cases we have
imported into our YAML suite, which are pending, and which we mark
**N/A** (out of scope because we don't implement the feature yet — see
[DESIGN.md §15](../../../DESIGN.md)).

**Legend**: ✅ imported · 🟡 partial · ⏳ pending · ⛔ N/A (feature gap)

| deftest | sub-test | status | where | notes |
|---|---|---|---|---|
| `constraints-test` (L42) | base constraints (L47) — root invariants | 🟡 | `constraints.yaml` | F1 translator gap closed; org-1 imported. dom-2/dom-3 need %resource/%context FHIRPath wiring — skipped with notes |
| | complex type constraints (L92) — Patient.contact pat-1 | ✅ | `constraints.yaml` | imported with HL7 fhirpath.js adapter |
| | contained-invariant-profile (L106) | ⏳ | — | uses external profile; importable once fhirpath + profile loading wired |
| | constraint on bundled resource (L116) | ⏳ | — | combo of Bundle + FHIRPath; mechanism in place |
| `recursive-schemas` (L198) | | 🟡 | `recursive-schemas.yaml` | R4 Questionnaire.item.item cases imported (3); SDC profile case pending |
| `get-by-cofx-path-test` (L321) | | ⛔ | — | internal helper, not user-facing |
| `primitives-test` (L376) | boolean (L379) | ✅ | `primitives.yaml` | |
| | integer (L385) | ✅ | `primitives.yaml` | int32 boundary cases included |
| | integer64 (L399) | ✅ | `primitives.yaml` | leading-zero / range bugs found and fixed |
| | integer64 legacy as number (L425) | ⛔ | — | legacy ctx flag, won't implement |
| | unsignedInt (L437) | ✅ | `primitives.yaml` | |
| | positiveInt (L448) | ✅ | `primitives.yaml` | |
| | decimal (L459) | ✅ | `primitives.yaml` | |
| | dateTime (L470) | ✅ | `primitives.yaml` | impossible-date check added |
| | time (L515) | ✅ | `primitives.yaml` | |
| | date (L522) | ✅ | `primitives.yaml` | |
| | instant (L530) | ✅ | `primitives.yaml` | |
| | url (L576) | ✅ | `primitives.yaml` | |
| | xhtml (L583) | ✅ | `primitives.yaml` | |
| | uri (L588) | ✅ | `primitives.yaml` | |
| | id (L595) | ✅ | `primitives.yaml` | |
| | oid (L602) | ✅ | `primitives.yaml` | |
| | uuid (L609) | ✅ | `primitives.yaml` | |
| | string (L617) | ✅ | `primitives.yaml` | |
| | binding (L625) | ⛔ | — | terminology binding (fs5xx) |
| | code (L664) | ✅ | `primitives.yaml` | |
| | base64Binary (L674) | ✅ | `primitives.yaml` | |
| | markdown (L687) | ✅ | `primitives.yaml` | |
| | canonical (L695) | ✅ | `primitives.yaml` | |
| | object/primitive data collision (L704, L709) | ✅ | `primitives.yaml` | fs204 implemented |
| `validation-c` (L714) | empty complex type (L720) | 🟡 | `real-resources.yaml` | empty `[]`, empty `{}`, empty string done. `_field: {}`, `name: [nil]`, `_given: []` need `_field` deep validation |
| | Primitive types (L767) | ✅ | `real-resources.yaml` | 7 cases imported |
| | Complex types (L829) | ⏳ | — | not yet read in detail |
| | extension (L864) | ⏳ | — | |
| | excluded keys (L892) | ⛔ | — | translator does not yet emit `excluded` from `max: 0` |
| | poly (L918) | ✅ | `real-resources.yaml` | bare `deceased` now correctly emits fs201 at [deceased] after virtual-parent fix |
| | unexpected object (L946) | ✅ | `real-resources.yaml` | |
| | Bundle resource validation (L953) | ✅ | `real-resources.yaml` | inner-resource walk implemented |
| | contained (L996) | 🟡 | `real-resources.yaml` | simplified version imported; full sansara case needs `excluded` keys |
| `slicing-validation` (L1015) | Simple slicings (L1024) | ✅ | `real-resources.yaml` | 4 cases (vitalsigns VSCat) |
| | ordered slicing (L1093) | 🟡 | `slicing-ordered.yaml` (hand-crafted) | feature implemented (fs903); sansara cases use `example-section-library` profile (not in core, needs fixture) |
| | @default slice (L1189) | 🟡 | `slicing-default.yaml` (hand-crafted) | feature implemented; sansara cases use `EVG+IVAN` profile (test fixture in their tu) |
| | excluded keys (L892) | 🟡 | `excluded.yaml` (hand-crafted) | feature implemented (translator hoists `max=0`, validator emits fs207); full sansara case uses `lipidprofile` |
| | slice with discriminator:type type (L1290) | ⏳ | — | `match: { type: "X" }` pattern |
| | slice with resolve reference + discriminator:type (L1325) | ⛔ | — | needs reference resolution |
| | resource in bundle should conform (L1437) | ⛔ | — | needs Bundle entry walk |
| | slice by type:value, path:resolve() (L1487) | ⛔ | — | needs FHIRPath `resolve()` |
| | closed slicing (L1668) | 🟡 | `slicing.yaml`, `excluded.yaml` | basic closed covered; sansara case uses `example-section-library` profile (out-of-package fixture) |
| | base open, child closed (L1702) | ⏳ | — | |
| | openAtEnd slicing (L1736) | ⛔ | — | not implemented |
| | slice without match (L1769) | ✅ | `slicing-no-match.yaml` | inline-profile equivalents imported |
| | slice is constraining (L1791, L1832) | ⏳ | — | |
| | re-slice (L1902) | ⛔ | — | reslicing not implemented |
| | @default slice reslicing (L1962) | ⛔ | — | |
| | Slices with type:profile (L2042) | ⛔ | — | needs profile-based slicing |
| `effects-test` (L2113) | check-existence effect (L2118) | ⛔ | — | sansara's internal effect system |
| | match profile effect (L2146) | ⛔ | — | same |
| | independent effects bug #6609 (L2170) | ⛔ | — | same |
| `extension-test` (L2189) | us-core-race valid slicing (L2194) | ✅ | `us-core.yaml` | |
| | us-core-race invalid sub-extension (L2210) | ✅ | `us-core.yaml` | F4 extension URL deref unlocks this |
| `multiple-slice-match-test` (L2229) | | ⛔ | — | `slice.match` as array-of-patterns (AND semantics) — translator + validator change |
| `primitive-extensions-test` (L2261) | valid extension on birthDate (L2294, L2318) | ✅ | `primitive-extensions-r4.yaml` | imported against real R4 patient-birthTime fixture |
| | invalid extension on birthDate (L2305) | ⏳ | — | needs `_field` deep validation (feature D) to emit fs801 inside extension |
| | FHIR general person sample (L2328) | ✅ | `primitive-extensions-r4.yaml` | full realistic Patient with nested _family ext |
| | extension for unknown (L2405) | ✅ | `primitive-extensions.yaml` | `_unknown: {id: 1}` → fs201 |
| | extension for non-primitive element (L2414) | ✅ | `primitive-extensions.yaml` (fs401) | |
| | _ key as primitive type (L2423, L2432) | ⏳ | — | |
| | _ extension as object when array expected (L2442) | ⏳ | — | |
| | as array / with nulls (L2479, L2488, L2497) | ⏳ | — | null placeholders in primitive arrays |
| | primitive extension with profile (L2577) | ⏳ | — | |
| `primitive-extension-on-choice-type-test` (L2593) | all 6 sub-tests (L2600-L2645) | ✅ | `primitive-extension-on-choice-type.yaml` | regression for issue #6913; fixed empty-composite false-positive for only-_field objects |
| `additional-properties-extension-test` (L2656) | all sub-tests | ⛔ | — | open-map / additionalProperties feature not in DESIGN |
| `any-extension-test` (L2766) | all sub-tests | ⛔ | — | `any` type not in DESIGN |
| `any-additional-properties-extension-test` (L2837) | | ⛔ | — | same |
| `open-schemas` (L2864) | `isOpen` flag (L2871, L2881) | ⏳ | — | "open" mode for unknown elements; not in DESIGN |
| `get-resource-schemas-test` (L2891) | | ⛔ | — | internal helper |
| `unknown-schemas-test` (L2929) | profile / without strict (L2935) | ✅ | `strict-mode.yaml` | |
| | profile / with strict (L2958) | ✅ | `strict-mode.yaml` | `options.strict: true` → fs701 |
| | extension / without strict (L2984) | ⏳ | — | extension unknown handling |
| | extension / with strict (L3003) | ⛔ | — | needs extension-URL deref + `fs1101` unknown-extension |
| `required-element` (L3029) | data-absent on primitive (L3032) | ✅ | `real-resources.yaml` | |
| | with primitive extension (L3039) | ✅ | `real-resources.yaml` | |
| | data-absent on required choice (L3052) | ✅ | `choice.yaml` (covered by `_valueString` test) | |
| `resolve-reference-constraint` (L3064) | | ⛔ | — | needs FHIRPath + reference *resolver* (sync target-type already done via fs1001 in `references.yaml`) |
| `cardinality-test` (L3109) | base case (L3109) | ✅ | `real-resources.yaml` | |
| | Min value (L3138) | ✅ | `real-resources.yaml` | |
| | Max value (L3150) | ✅ | `real-resources.yaml` | |
| `constraint-on-primitive-element` (L3168) | | ⛔ | — | needs FHIRPath |
| `schema-deque-test` (L3212) | | ⛔ | — | internal |
| `invoice-vdds-rz-test` (L3277) | | ⏳ | — | large integration scenario, low priority |
| `issue-sansara-7313` (L3306) | | ⏳ | — | regression test |

## Roll-up

- Fully imported: 40+ sub-tests
- Partially imported: 5 deftests (`validation-c/empty`, `validation-c/poly`, `primitive-extensions-test`, `unknown-schemas-test`, `recursive-schemas`)
- Pending (importable, just not done): ~14 sub-tests
- N/A (require unimplemented features): 25 sub-tests

## Importable next without feature work

1. **`primitive-extensions-test/invalid valueString in patient-birthTime` (L2305)** — needs feature D (`_field` deep validation) to emit fs801 inside extension.
2. **Slicing edge cases**: `slice is constraining` (L1791/1832), `base open / child closed` (L1702), `closed slicing` (L1668) — last requires `example-section-library` fixture.
3. **`open-schemas/isOpen` flag** — only if we decide to support open-mode.

## Blocked by feature gaps

| Sub-tests | Required feature |
|---|---|
| `constraints-test`, `constraint-on-primitive-element`, `resolve-reference-constraint` | FHIRPath engine (`fs601`) |
| `validation-c/Bundle`, `validation-c/contained`, `slicing-validation/resource in bundle` | Inner-resource walk (re-enter `validate()` per contained/entry) |
| `slicing-validation/ordered`, `openAtEnd`, `re-slice`, `@default` | Slicing enhancements |
| `slicing-validation/slice with resolve reference`, `slice by type:value, path:resolve()` | Reference resolution + FHIRPath |
| `extension-test/invalid us-core-race` | Extension URL dereferencing |
| `validation-c/excluded keys` | Translator: `max: 0` → `excluded` |
| `validation-c/empty complex type` (full coverage) | `_field` deep validation |
| `additional-properties-extension-test`, `any-*-test`, `open-schemas` | Open-schema mode / `any` type — out of scope per DESIGN |
| `effects-test` | Sansara-specific effect system — out of scope |
