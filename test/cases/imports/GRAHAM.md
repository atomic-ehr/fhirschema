# Graham fhir-test-cases — import registry

Source: [github.com/FHIR/fhir-test-cases/validator/manifest.json](https://github.com/FHIR/fhir-test-cases/tree/master/validator)
(curated by Grahame Grieve, 970 test cases as of import).

Each test entry consists of:

- A FHIR resource file (JSON/XML)
- Optional `packages: []`, `profile`, `supporting`, `logical` config
- Per-implementation expected output (`java`, `firely-sdk-current`,
  `firely-sdk-wip`) as text messages

We map the java validator's text messages to our `fsNNN` codes. The mapping
is hand-built — the table is in [graham.yaml](../validator/graham.yaml).

**Legend**: ✅ imported · ⏳ pending · ⛔ N/A

## Imported

| name | module | version | status | notes |
|---|---|---|---|---|
| patient-good | (default) | R5 | ✅ | valid Patient with narrative |
| group-choice-good | (default) | R5 | ✅ | valid Group.characteristic.value[x] |
| group-minimal | (default) | R5 | ✅ | minimal Group |
| list-empty2 | (default) | R5 | ✅ | empty array → fs303 |
| group-choice-bad1 | (default) | R5 | ✅ | bare `value` (no [x]) → fs301+fs202 |
| list-minimal | (default) | R5 | ⛔ skip | uses non-standard `fhir_comments` JSON5 |
| bundle-good | (default) | R5 | ✅ | unblocked by inner-resource walk |
| list-contained | references | R5 | ⛔ skip | scalar `subject` where R5 mandates array; Java permissive by default. See "Java permissive defaults" below. |
| patient-lang1 | (default) | R5 | ✅ | xhtml-lang warning is out of scope; data is valid for us |
| group-minimal-tiny | general | R5 | ✅ | minimal Group |
| list-unknown-prop | general | R5 | ✅ | unknown `other` → fs201 |
| list-empty1 | (default) | R5 | ✅ | `entry: [{}]` → fs202 + fs301 |
| patient-id-bad-1 | general | R5 | ✅ | underscore in id → fs110 |
| group-choice-bad3 | (default) | R5 | ✅ | wrong type for valueBoolean → fs103 |

## Java permissive defaults — when our spec-strict behavior diverges

The HL7 Java reference validator is **permissive by default** on some JSON
shape questions, and surfaces strictness only under specific modules /
config flags. We choose **spec-strict by default**. Cases where Java's
default differs from FHIR JSON spec are skipped with reasons, not imported.

| Concern | FHIR JSON spec | Java default | Java strict trigger | Our default |
|---|---|---|---|---|
| Scalar in 0..* field (e.g. `subject: {ref}` for `0..*`) | array required | accepts scalar | `fmt` module → "must be JSON Array" | spec-strict (fs203) |
| Empty arrays (`field: []`) | not allowed | not allowed | always strict | spec-strict (fs303) |
| Unknown profile in `meta.profile` | not specified | silent | `-strict` flag | permissive (matches Java); `options.strict: true` to opt in |
| `fhir_comments` JSON5 extension | not valid FHIR JSON | accepts (filters out) | always permissive (Java treats as extension) | spec-strict (fs201 unknown-element) |

When Java permissive default would force us to either weaken our spec
compliance or rewrite a test's data, we skip with an explicit comment
referencing this section.

If/when we need to match Java's permissive defaults (e.g. for FHIR-server
compatibility), the validator can grow opt-in flags symmetric to
`options.strict` — see DESIGN §15.

## Stats by module

| Module | Total | Plain* | Importable today (rough estimate) |
|---|---:|---:|---|
| profile | 203 | 8 | needs a specific profile loaded per case |
| general | 119 | 102 | best candidates for next import |
| questionnaire | 108 | 14 | needs Questionnaire / QuestionnaireResponse model |
| tx | 85 | 62 | needs terminology server (fs5xx) |
| extensions | 54 | 47 | needs full extension validation |
| bundle | 49 | 35 | needs Bundle entry inner-resource walk |
| references | 47 | 44 | needs reference resolver (fs1001/fs1002) |
| matchetype | 47 | 44 | needs FHIRPath-based type matching |
| (default) | 34 | 28 | best candidates (5 already imported) |
| xhtml | 31 | 22 | needs XHTML parser |
| sd | 27 | 23 | StructureDefinition meta-validation |
| fmt | 23 | 22 | format-specific (XML, etc.) |
| cdshooks | 20 | 0 | needs CDS Hooks logical model |
| xver | 17 | 16 | cross-version conversion |
| shc | 16 | 8 | Smart Health Cards |
| measure | 15 | 3 | Measure model |
| package-versioning | 12 | 0 | package-loading semantics |
| security | 8 | 8 | security checks |
| json5 | 8 | 8 | JSON5 / fhir_comments extensions |
| dsig | 8 | 8 | digital signatures |
| invariants | 7 | 4 | FHIRPath invariants (fs601) |
| api | 7 | 5 | API conformance |
| cda | 6 | 1 | CDA logical model |
| logical | 6 | 0 | logical models |
| tx-advanced | 5 | 4 | terminology advanced |
| v2 | 4 | 0 | HL7 v2 |
| versions | 2 | 2 | version handling |
| scoring | 1 | 0 | |
| base | 1 | 1 | |

\* "Plain" = no `packages` / `profile` / `supporting` / `logical` config —
the minimum-setup cases.

## Importable now (no new infrastructure)

Filter: `module ∈ {(default), general, sd, bundle (good only), references (syntactic only), xhtml (basic)}`.
Pick cases with simple expected outputs (errorCount ≤ 4, no FHIRPath, no
binding lookup).

Concrete candidates by name pattern:

- `*-good`: should validate as `valid: true` — many
- `bundle-good`, `bundle-bad-*` (syntactic): with R5 fixtures
- `xhtml-correct*` / `xhtml-wrongns*`: need XHTML namespace check
- `primitive-good-ws`, `primitive-bad-*`: primitives
- `list-*`: basic resource shape
- `patient-*`: basic Patient checks (lang variants)

We've imported 6 cases; another ~20-30 R5 simple cases are reachable
without code changes.

## Blocked by feature gaps

| Module | Required feature |
|---|---|
| invariants, profile (most) | FHIRPath constraint engine |
| tx, tx-advanced | Terminology server (`fs5xx`) |
| references | Reference resolver (`fs10xx`) |
| bundle (bad), profile (with bundles) | Inner-resource walk per Bundle entry |
| xhtml | XHTML parser |
| cdshooks, cda, logical, v2 | Custom logical-model support |
| shc | Smart Health Cards JWT/signature |
| dsig | Digital signature validation |
| json5 | JSON5 / fhir_comments tolerance |
| matchetype | FHIRPath-based "matchetype" feature |
| xver | Cross-version conversion |

## Roll-up

- Imported: 5 (+ 1 skip)
- Importable today, not yet imported: ~250 (rough; mostly `*-good` and simple syntactic checks across modules without packages)
- Need feature work: ~700

## Format-mapping table

For future imports, the java validator's text messages map roughly to:

| java text | our code |
|---|---|
| `Unrecognized property 'X'` | `fs201` unknown-element |
| `minimum required = N, but only found M` | `fs301` required (if M=0) / `fs303` too-few |
| `Array cannot be empty` | `fs303` |
| `Object must have some content` | `fs202` expected-object (non-empty) |
| `must be a boolean` / `must be a number` | `fs101`/`fs102`/`fs103` |
| `is too short` / `Invalid date` etc. | `fs104..fs123` invalid-{primitive} |
| `Slice 'X' is not matched` | `fs901` slice-not-matched |
| `cardinality of slice X is N..M but observed K` | `fs902` slice-cardinality |
| `Profile X not found` | `fs701` profile-not-found |
| `Pattern not satisfied` | `fs205` pattern-mismatch |

This table is a guideline — sansara has been the primary source of cases
because its `matcho` format is machine-readable, while Graham's text
output requires hand-mapping per case.
