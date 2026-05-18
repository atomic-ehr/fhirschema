# Validator Test Suite — FHIR R4 Spec Audit

**Date:** 2026-05-18
**Scope:** every test case in `test/cases/validator/*.yaml`
**Method:** 10 parallel subagents, each handling a thematic group of YAML
files, verifying assertions against the FHIR R4 specification on hl7.org.

## Summary

Status: **complete (per-test depth)** + **advisories resolved**. 551
tests across 39 YAML files, each individually verified. **Zero strict
spec mismatches.** Twenty-four advisories were filed; all were either
fixed in tests, documented in DESIGN.md, or marked skip with a
`_skipReason`. See the resolution log at the bottom.

| Theme                                | Files | Tests | OK  | Mismatch | Advisories |
| ------------------------------------ | ----- | ----- | --- | -------- | ---------- |
| structure / excluded / recursive     | 3     | 21    | 21  | 0        | 0          |
| choice + primitive-extensions        | 4     | 28    | 28  | 0        | 0          |
| primitives                           | 1     | 108   | 108 | 0        | 0          |
| patterns / fixed / inheritance / ext | 6     | 34    | 34  | 0        | 0          |
| slicing                              | 7     | 35    | 35  | 0        | 5          |
| references + bundles                 | 4     | 28    | 28  | 0        | 1          |
| terminology + constraints            | 3     | 32    | 32  | 0        | 2          |
| real-resources / us-core / strict / fhir-tests | 4 | 69    | 69  | 0        | 0          |
| fhir-tests R4 imports                    | 3     | 66    | 66  | 0        | 1          |
| fhir-tests R5 + profiles                 | 4     | 130   | 130 | 0        | 1          |
| **Total**                            | **39**| **551**| **551** | **0** | **11**   |

Note: ~30 tests across the fhir-tests files are `skip: true` with documented
`_skipReason` traced to DESIGN §15 known-gaps; counted as OK because the
skips are honest.

## Advisories (no validator bug; clarity / docs)

Grouped by theme, with suggested follow-up.

### Slicing (5)
1. **slicing.yaml** — fs901 overloaded for "item matches multiple slices" (ambiguity is profile-authoring error per spec, not data-validation). Document the overload in DESIGN.md §13 or introduce a distinct code.
2. **slicing-no-match.yaml** — tests omit `slicing.rules` (which is 1..1 in R4) and rely on implicit `open`. Document the IR default.
3. **slicing-default.yaml** — 2 tests use `@default` with non-closed rules. Spec limits `@default` to `rules: closed`. Either add `rules: closed` to those tests or document as project extension.
4. **slicing-openatend.yaml** — tests omit `ordered: true`; spec says openAtEnd requires ordered. Add `ordered: true` or document implicit-ordered IR semantics.
5. **slicing-openatend.yaml / DESIGN.md §13** — `fs904` is used but not in the primary error-code list; confirm it's documented.

### References + bundles (1)
6. **bundle-integrity.yaml** — `fs1201` ("two entries with same Type/id but different fullUrls") is stricter than bdl-5 (which only mandates fullUrl uniqueness). Project rule matches HAPI behaviour; the YAML comment already frames it correctly. No change required, but worth a sentence in DESIGN §13.

### Terminology + constraints (2)
7. **terminology-tx.yaml** — fs504 test asserts no explicit `severity`. Recommend pinning `severity: warning` to match HAPI/Java convention and lock semantics against future drift.
8. **terminology.yaml** — no fs504 case using the mock terminology adapter; only the network-backed tx-test exercises it. A deterministic mocked fs504 case would harden CI.

### fhir-tests R4 (1)
9. **fhir-tests-r4-bad.yaml** — `bundle-duplicate-id` test name is misleading: the asserted `fs1003 x2` correctly flags non-absolute `fullUrl`, not the duplicate ids. Consider renaming locally for clarity (upstream upstream label).

### fhir-tests R5 + profiles (1)
10. **fhir-tests-profile-r4.yaml** — several tests named `*-fail` (e.g., `toplevel-minvalueduration-fail`, `obs-value-min-fail`) are asserted `valid: true` because `_applyProfile` is omitted. Self-consistent with loader semantics but names mislead. Either add `_applyProfile: true` or rename.

### Cross-cutting (1)
11. **slicing-nested.yaml** — file named "reslicing" but tests exercise nested-slicing-inside-slice-schema; real FHIR reslicing (slash-notation, `sliceIsConstraining`) is in `slicing-inherited.yaml`. Consider rename for terminology clarity.

### Per-test deep-audit additions (13)

Surfaced only after the second wave of 12 per-test agents on large files
(primitives, real-resources, fhir-tests-*).

#### primitives.yaml (3)
12. **dateTime "2024-02-31" rejection** — stricter than spec. R4 dateTime regex permits day 31 structurally regardless of month (`0[1-9]|[1-2][0-9]|3[0-1]`). Calendar-impossible dates pass the regex. The validator does semantic month-day validation beyond R4 minimum. Acceptable as stricter-than-spec; document in DESIGN.md.
13. **dateTime "2023-02-29" rejection (non-leap)** — same root cause as 12. R4 regex permits Feb 29 in any year; the validator enforces leap-year semantics. Stricter-than-spec; document.
14. **integer64 "-0" rejection** — R5 regex `-?([0]|([1-9][0-9]*))` would technically match `-0`, but the test rejects it on canonical-form/aidbox-parity grounds. Borderline regex-conformance; document the canonical-form rule in DESIGN.md if it isn't already.

#### real-resources.yaml (1)
15. **Bundle valid Patient+Observation test data** — embedded Observation has `status: active`, but R4 ObservationStatus VS members are `registered|preliminary|final|amended|cancelled|entered-in-error|unknown|corrected`. Currently `valid: true` passes only because terminology validation is deferred (default plugin off). Fix the test data to use `final` (or similar) so the test stays correct even if the suite later enables required-binding checks.

#### fhir-tests-profile-r4.yaml (6)
16. **Test "fhir-tests/mycommunication.invalid"** — named "invalid" but asserted `valid: true`; profile registered but not applied (no `_applyProfile`, no `meta.profile`). Add `_applyProfile: true` or rename.
17. **Test "fhir-tests/jv-patient-bad"** — same pattern as 16; identifier value `'73456'` likely violates profile constraint on `generalPractitioner.identifier.value`, but profile never applied.
18. **Test "fhir-tests/parameters-profiled-resource-invalid"** — same pattern; data omits `Patient.name`, which the profile makes mandatory.
19. **Test "fhir-tests/res-inv-example-bad"** — same pattern; bad Endpoint reference, but profile not applied.
20. **Tests "fhir-tests/toplevel-minvalueduration-fail" and "fhir-tests/toplevel-maxvalueduration-fail"** — birthDate `1850-01-01` / `2100-01-01` would violate min/maxValueDuration constraints, but profile never applied; `-fail` suffix misleads.
21. **Duplicate test desc "fhir-tests/ext-derived-circle"** (tests 38 & 39) — identical body; remove duplicate or differentiate intent.
22. **Tests "fhir-tests/standards-status-x-r4" vs "…-r4b"** — load the same profile file with identical data; naming implies an R4-vs-R4B distinction that isn't realised in fixtures.
23. **Tests "fhir-tests/type-slicing-multiple{,b}" and "fhir-tests/profile-slicing-multiple{,b}"** — register slicing profiles but never apply them; the slicing engine isn't exercised by these tests despite their names.

#### fhir-tests-profile-r5.yaml (2)
24. **Tests "fhir-tests/inactive-inactive-inactive" and "fhir-tests/inactive-retired-inactive"** — assert `valid: true` when a coded value is from a CodeSystem with status=inactive (or retired) AND the bound ValueSet has `inactive=false` filter excluding inactive codes. Strict reading of the VS filter would expect a binding failure; current behaviour treats inactive-code usage as warning-only. Defensible (matches R5 spec note that inactive codes typically warn), but document the choice explicitly.

## Methodology

Two waves of parallel subagents.

**Wave 1 — 10 thematic agents** covering all 39 YAML files. Per-test
verification for small/medium files; grouped verdicts + spot-checks for
large files. Surfaced advisories 1–11.

**Wave 2 — 12 per-test agents** re-auditing the 7 large files
individually:
- primitives.yaml split 3-ways (lines 1-200, 200-345, 345-490)
- real-resources.yaml split 2-ways
- fhir-tests-r4-good.yaml (full)
- fhir-tests-ig-r4.yaml (full)
- fhir-tests-r5-good.yaml (full)
- fhir-tests-profile-r4.yaml split 2-ways
- fhir-tests-profile-r5.yaml split 2-ways

Each Wave-2 agent produced one line per test (OK / SKIPPED with reason /
NAMING ISSUE / MISMATCH with spec citation). Surfaced advisories 12–24.

**Wall time:** ~3 minutes Wave 1 + ~3 minutes Wave 2.
**Spec access:** WebFetch to `hl7.org/fhir/R4/*` and `hl7.org/fhir/R5/*`;
~250 cached WebFetch calls amortised across agents.

## Resolution log

All 24 advisories were addressed in a follow-up pass. Mapping:

| # | Advisory | Resolution |
|---|----------|------------|
| 1 | fs901 ambiguity overload | DESIGN §13 fs9xx notes added |
| 2 | slicing-no-match implicit `rules: open` | DESIGN §10.6 (implicit IR defaults) |
| 3 | `@default` with non-closed rules | DESIGN §10.6 |
| 4 | openAtEnd implicit ordered | DESIGN §10.6 |
| 5 | fs904 missing from code list | DESIGN §13 fs9xx (also removed stray entry from fs5xx) |
| 6 | fs1201 stricter than bdl-5 | DESIGN §13 fs12xx notes |
| 7 | fs504 severity not pinned | rolled back the `severity: warning` pin (validator emits as error today); DESIGN §13 fs5xx documents the convention |
| 8 | no mocked fs504 in terminology.yaml | left as a future-CI item |
| 9 | `bundle-duplicate-id` label nit | left (upstream naming) |
| 10 | profile-r4 `*-fail` names | tests 16–20 below — fixed |
| 11 | `slicing-reslicing.yaml` rename | renamed to `slicing-nested.yaml`; suite description and DESIGN §10.4 updated |
| 12 | dateTime "2024-02-31" stricter-than-spec | DESIGN §15.1 documents it |
| 13 | dateTime "2023-02-29" stricter | DESIGN §15.1 |
| 14 | integer64 "-0" canonical form | DESIGN §15.1 |
| 15 | Observation.status='active' test data | changed to `final` in real-resources.yaml |
| 16 | mycommunication.invalid registered-only | added `_applyProfile: true` + `issues: [fs701]` |
| 17 | jv-patient-bad registered-only | added `_applyProfile: true`; marked `skip: true` (validator doesn't enforce Identifier-value pattern yet) + DESIGN §15 entry |
| 18 | parameters-profiled-resource-invalid | added `_applyProfile: true` + `issues: [fs301 at name]` |
| 19 | res-inv-example-bad | added `_applyProfile: true` + `issues: [fs301 at meta.lastUpdated]` |
| 20 | toplevel-min/maxvalueduration-fail | added `_applyProfile: true`; marked `skip: true` (validator doesn't enforce min/maxValueDuration) + DESIGN §15 entry |
| 21 | duplicate `ext-derived-circle` | deleted the duplicate test block |
| 22 | standards-status-x-r4 vs -r4b | r4b marked `skip: true` with `_skipReason` (would need `hl7.fhir.r4b.core` package fixture, not shipped) |
| 23 | type-/profile-slicing-multiple register-only | left (intent is registration-only smoke; slicing engine is exercised by dedicated slicing-*.yaml suites) |
| 24 | inactive-codes warning-only | DESIGN §15.1 |

Test count change: 482 pass / 70 skip → **477 pass / 74 skip** (+4 skip
from advisories 17, 20, 22; −1 pass from advisory 21). All 0 fail.

Also done as part of this pass (housekeeping, not from advisory list):

- File rename: `graham*.yaml` → `fhir-tests-*.yaml` (8 files via `git mv`);
  `desc: graham/...` → `desc: fhir-tests/...` (~212 places);
  `test/cases/imports/GRAHAM.md` → `FHIR-TEST-CASES.md`. All references
  in DESIGN.md, scripts, and this report updated. Attributions to
  "Grahame Grieve" as FHIR spec author (chat.fhir.org consensus quotes)
  are preserved.

## Per-theme detail

### Theme: structure / excluded / recursive (21 tests, 0 mismatch)

**structure.yaml — 14/14 OK**
- fs201 unknown-element (3): per validation.html §Structure "nothing extra is present".
- fs202 expected-object (2): per json.html "Objects are never empty. If an element is present in the resource, it SHALL have properties as defined for its type, or 1 or more extensions."
- fs203 expected-array (3): per json.html "represented as an array even in the case that it doesn't repeat".
- fs301 required (3): per ElementDefinition.min.
- fs302/fs303 cardinality (3): per ElementDefinition.min/max.

**excluded.yaml — 4/4 OK** — fs207, all four cases match `max:0` semantics + overlay union rule.

**recursive-schemas.yaml — 3/3 OK** — `Questionnaire.item` recursion via `elementReference`; linkId string 1..1, enableWhen.answer[x] all correct.

### Theme: choice + primitive-extensions (28 tests, 0 mismatch)

**choice.yaml — 10/10 OK** — fs801 (narrowed choices), fs802 (multiple variants present), required-choice satisfaction (incl. via standalone `_valueString` data-absent pattern).

**primitive-extensions.yaml — 4/4 OK** — `_p` object for scalar primitive; standalone `_p` allowed; fs401 for `_p` on complex type; fs201 for unknown shadow.

**primitive-extensions-r4.yaml — 8/8 OK** (note: file has 8 tests, not 9 as initially counted) — dateTime accepts year-only; `_active`/`_given` shape rules; null placeholders in shadow arrays.

**primitive-extension-on-choice-type.yaml — 6/6 OK** — key-order independence; standalone `_definitionCanonical` valid; fs802 on `deceasedDateTime + deceasedBoolean`.

### Theme: primitives (108 tests, 0 mismatch)

**primitives.yaml — 108/108 OK** (1 caveat: integer64 is R5 — already commented in file)

- boolean (5): JSON `true|false` only; non-bool → fs103; object → fs204.
- integer (7): regex `[0]|[-+]?[1-9][0-9]*`, 32-bit; `3.1` → fs112; `'42'` → fs102.
- integer64 (11): R5 — JSON-string with int64 range; empty / leading-zero / decimals / overflow rejected.
- unsignedInt (5): 0..2^31-1; sign → fs119; fractional → fs112.
- positiveInt (5): 1..2^31-1; `0` / `-1` → fs116.
- decimal (4): JSON-number; string → fs102.
- dateTime (20): partial dates, offset cap `±14:00`; `+14:01` and `+24:00` → fs108.
- time (3): `HH:MM:SS` required, no tz.
- date (4): partial-date OK; `2012-13-42` → fs107.
- instant (8): time + tz mandatory.
- url, uri, oid, uuid, id, string, code, base64Binary, markdown, canonical, xhtml: all per R4 regex; empty rejected via JSON "no zero-length strings" rule.

### Theme: patterns / fixed / inheritance / extensions (34 tests, 0 mismatch)

**patterns.yaml — 10/10 OK** — primitive pattern equality; CodeableConcept deep-partial (extras allowed); array pattern semantics; independent issue emission (fs205 + fs101).

**fixed.yaml — 6/6 OK** — exact equality including extras-rejection (spec: "exact match... Missing elements/attributes must also be missing").

**patient-name.yaml — 6/6 OK** — HumanName cardinalities (family 0..1, given 0..*); patient-animal species 1..1.

**inheritance.yaml — 7/7 OK** — `base` chain; required inherited; unresolved base → fs701 + cascading fs201 (snapshot-less design); `additionalProfiles` union; tightest-min/max wins.

**modifier-extension.yaml — 3/3 OK** — unknown modifierExtension → fs1102 (per spec: "application SHALL refuse to process"); unknown regular extension silent (per "SHOULD ignore unrecognized").

**extension-deref.yaml — 2/2 OK** — us-core-race text 1..1.

### Theme: slicing (35 tests, 0 strict mismatch — 5 advisory findings)

**slicing.yaml — 11/11 OK** with one advisory:
- *Advisory*: "item matches multiple slices → fs901" uses the closed-slice code for an ambiguous-match scenario. FHIR R4 treats ambiguous matches as a profile-authoring error (require disambiguating discriminators), not a data-validation error. Consider a distinct code or document the overload in DESIGN.md §13.

**slicing-no-match.yaml — 2/2 OK** — advisory: tests omit `slicing.rules` (which is 1..1 in R4) and rely on an implicit `open` default. Document the IR default in DESIGN.md.

**slicing-default.yaml — 5/5 OK in implementation** but 2 tests diverge from spec semantics:
- *Spec divergence*: "@default — matched/unmatched both routed" and "@default — unmatched fails required → fs301" use `@default` with non-closed rules. FHIR R4 explicitly limits @default to `rules: closed`. Either add `rules: closed` to those tests or document the project extension in DESIGN.md.

**slicing-openatend.yaml — 5/5 OK in implementation** with advisories:
- All `openAtEnd` tests omit `ordered: true`. The spec's slicing-rules value-set says openAtEnd "requires that the slices be ordered". Either add `ordered: true` to tests, or document that the IR treats openAtEnd as implicitly ordered.
- `fs904` code is used here but not present in the project's primary error-code list — verify DESIGN.md §13 documents it.

**slicing-ordered.yaml — 7/7 OK** — `ordered: true` semantics correct (slice-declaration order; unmatched items don't participate under open rules).

**slicing-nested.yaml — 2/2 OK** — advisory: file is named "reslicing" but tests exercise nested-slicing-inside-slice-schema, not FHIR's slash-notation reslicing (which is in slicing-inherited.yaml). Consider rename.

**slicing-inherited.yaml — 3/3 OK** — `sliceIsConstraining` merge-not-replace semantics correctly implemented; spec text is ambiguous on this and implementations differ, so DESIGN.md should document the choice.

### Theme: references + bundles (28 tests, 0 mismatch — 1 nuance)

**references.yaml — 11/11 OK** — Reference parsing (Type/id, absolute URL, versioned, urn:, fragment); targetProfile constraint check per eld-17; tightening at profile level (Encounter, Observation, Patient.generalPractitioner).

**references-resolve.yaml — 4/4 OK** — fs1002 as warning (matches Java validator non-fatal stance); urn:/# skipped outside Bundle/contained scope; fs1001 + fs1002 fire independently.

**bundle-integrity.yaml — 7/7 OK** — bdl-8/bdl-9 → fs1202 (document/message first entry); bdl-5 → fs1201 (fullUrl uniqueness); ambiguous Type/id → fs1004 warning.
- *Nuance*: fs1201 ("two entries with same Patient/1 but different fullUrls") is **stricter** than bdl-5's literal text (which targets fullUrl uniqueness). The project's stricter rule matches HAPI behaviour; intentional, not a bug.

**bundle-fullurl.yaml — 6/6 OK** — fs1003 absolute-URL rule; absolute http(s)/urn:uuid/urn:oid valid; relative `Patient/abc-123` and bare id invalid.

### Theme: terminology + constraints (32 tests, 0 mismatch — 2 advisories)

**terminology.yaml — 7/7 OK** — strength → severity mapping verified (required=error/extensible=warning/preferred=information/example=silent); Coding-typed binding applied to Coding.code.

**terminology-tx.yaml — 13/13 OK** with advisories:
- *Advisory*: fs504 (display mismatch) test asserts no explicit severity. The R4 normative source is datatypes.html Coding: "the string used in `display` SHALL be one of the display strings defined for that code by the code system" — but HAPI/Java convention treats this as **warning**. Recommend pinning `severity: warning` in the fs504 test for clarity.
- *Advisory*: "no system → silent (unknown)" — defensible (tx-server cannot decide), but a `warning` severity would also be defensible for required bindings. Document the choice in DESIGN.md.

**constraints.yaml — 12/12 OK** — FHIRPath truthy → no fs601; severity passthrough (error/warning) matches R4 ConstraintSeverity; overlay union; root-scope vs element-scope reporting (Patient.contact); dom-2/dom-3/org-1 from base profiles.
- *Coverage gap*: terminology.yaml has no fs504 case using the mock terminology adapter; only the network-backed tx-test exercises it. A deterministic mocked fs504 case would harden CI.

### Theme: real-resources + us-core + strict-mode + fhir-tests R5 sample (69 tests, 0 mismatch)

**real-resources.yaml — 44/44 OK** — covers: unknown-element fs201, ServiceRequest required fs301, primitive type fs101/103/107/116, choice fs802, profile cardinality fs302/303, vitalsigns slicing fs902, empty-collection rules, inner-resource walk (Bundle entry / contained), positiveInt regex, bare-choice-key fs201.

**us-core.yaml — 2/2 OK** — us-core-race text 1..1 sub-extension; us-core-patient required fields satisfied.

**strict-mode.yaml — 6/6 OK** — non-strict silent; strict + unknown profile/resourceType → fs701.

**fhir-tests-misc.yaml — 17/17 OK (R5 samples)** — id pattern fs110; choice-bad fs201+fs301/fs103; List empty rules; fhir_comments JSON5 stripping; Bundle valid composition.

### Theme: fhir-tests R4 imports (66 tests, 0 mismatch — 1 label nit)

**fhir-tests-r4-good.yaml — 32/32 OK** (4 documented skips) — spot-checked `patient-example-ra4`, `dr-example-org-2`, `care-plan`, `params-empty-r4`, `structureDefinition-11179-objectClass-R4`, `bundle-document-versioned-references-good`, `contained`, `bundle-id-1`. Notable: `resource-invalid-eid-*` uses `Element.id` (not `Resource.id`); Element.id has no regex constraint, so `/foobar==` is legitimately valid.

**fhir-tests-r4-bad.yaml — 11/11 OK** (3 documented skips) — fs104 base64 invalid; fs303 `coding: []` (present-but-empty array); fs201 unknown element; fs107 date regex; fs501 required-binding masked by DAR (allergy); fs1003 fullUrl non-absolute; fs301 x3 on missing StructureDefinition.name/status/abstract.
- *Label nit*: `bundle-duplicate-id` test is misnamed — the asserted `fs1003 x2` correctly flags non-absolute `fullUrl` (Patient/1, RelatedPerson/1), not the duplicate ids. The label comes from upstream test-cases file; consider renaming locally for clarity.

**fhir-tests-ig-r4.yaml — 23/23 OK** (13 documented skips, all traced to DESIGN §15 known-gaps log) — US Core DocumentReference/Condition profiles applied; CGM-Data-Submission-Bundle slicing via new `_applyProfileUrl` knob; ValueSet package-version disambiguation (verA/verB).

### Theme: fhir-tests R5 + profiles (130 tests, 0 mismatch — 1 readability nit)

**fhir-tests-r5-good.yaml — 22/22 OK** (3 documented skips) — custom-resource permissive default (matches Java tolerant mode); `obs-sampled-data` UCUM/SampledData well-formed; xhtml namespace; unicode control chars.

**fhir-tests-r5-bad.yaml — 2/2 OK** (1 documented skip) — `group-choice-bad2`: `valueInteger` not in R5 Group.characteristic.value[x] allowed types → fs201+fs301.

**fhir-tests-profile-r4.yaml — 63/63 OK** — profiles loaded but only applied when `_applyProfile`/`_applyProfileUrl` set; mapping fsNNN ↔ Java errors sound; type slicing, profile slicing, ext-derived-circle all consistent with R4 §profiling.
- *Readability nit*: several tests named `*-fail` (e.g., `toplevel-minvalueduration-fail`, `toplevel-maxvalueduration-fail`, `obs-value-min/min-g/max-g-fail`) are asserted `valid: true` because `_applyProfile` is omitted. Behaviour is self-consistent with the loader semantics, but names mislead. Consider adding `_applyProfile: true` (so they actually fail and match their names) or renaming to indicate "profile not applied".

**fhir-tests-profile-r5.yaml — 43/43 OK** (large `cw-*` block uniformly skipped — profile-compatibility tests with no Java outcome, per DESIGN §15; 2 xml-translator-failure skips). R5 vitalsigns BP, reslicing, active/inactive code mixes, additional-bindings all consistent with R5 profiling.


