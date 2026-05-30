# Snapshot: resliced value[x] loses datatype children

## Symptom
Profiles that reslice `value[x]` to different types under different parent slices
lose the datatype children of all-but-the-first type. Seen in:
- CDex `CDexTaskAttachmentRequest`: `Task.input.value[x].value` missing (the
  `canonical` slice's primitive `.value`).
- mCODE `GenomicVariant`: `component.value[x].comparator/unit/system/code` missing
  (the `Quantity` slice's children).

## Root cause (verified by tracing the reverse output)
The reverse converter already emits one `value[x]` row per parent slice — e.g.
`Task.input.value[x]` typed CodeableConcept, then another typed `canonical`,
`url`, … — all with the **same path and no sliceName** (the value[x] doesn't carry
its parent slice's name; FHIR distinguishes them by `element.id`/position).

`expandInheritedTypeElements` dedups by `processedAnchors` keyed on
`elementKey = path|sliceName`. All these rows share the key
`Task.input.value[x]|`, so only the **first** is expanded — its type's datatype
children appear; the others' (canonical's `.value`, Quantity's `.comparator`…) are
skipped.

## Fix
Include the element's **type signature** in the per-anchor processing key, so each
distinctly-typed `value[x]` row is expanded. The child-level `indexByKey` already
dedups the resulting children (so `value[x].id`/`.extension` aren't duplicated, and
each datatype's unique children are added once), and source-gating keeps precision.

Low blast radius: only elements that share `path|sliceName` but differ in type
(exactly the resliced-choice case) change behaviour. Same-key same-type rows still
dedup as before — so vital-signs-style profiles and US Core are unaffected.

## TDD
- Unit test (synthetic): base resource with `component.value[x]` choice; profile
  slices `component` into two slices, one constraining value[x] to CodeableConcept,
  the other to Quantity; source snapshot has both `value[x].coding` (CC) and
  `value[x].comparator` (Quantity). Expect BOTH expanded. (Red before fix.)
- Verify no regression: US Core 67/67 exact, full suite green, and re-measure
  CDex / mCODE.
