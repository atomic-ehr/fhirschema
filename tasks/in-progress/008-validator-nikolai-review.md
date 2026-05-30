# Validator — satisfy Nikolai's code-review remarks (WG FHIR Schema, 2026-05-28)

Source: `/tmp/schema.md` (meeting transcript + notes). Goal: address every remark
Nikolai made during the `validate()` / `walkObject()` walkthrough.

Status legend: ☐ todo · ◐ partial · ☑ done · ⊘ n/a

## Correctness bugs (clean, TDD first)

- ☑ **B1. Non-object at root silently passes.** Dropped the `!atRoot` guard in
  `walkObject` — a non-object now always emits `fs202` and exits. Tests added in
  `structure.yaml` (array/scalar at root).
- ☑ **B2. Empty-object check.** Added `fs208 UNEXPECTED_EMPTY_OBJECT` /
  `fs209 UNEXPECTED_EMPTY_ARRAY`. Empty-object check is now plain
  `Object.keys(obj).length === 0` (a lone `resourceType` no longer counts as empty);
  empty arrays emit fs209 instead of fs303. Updated affected Graham/aidbox cases +
  DESIGN.md §13 registry.

## Naming / structure

- ☐ **N1. `overlays` → `schemaSet`.** The carried-set name says nothing; rename the
  `Overlay` type + all `overlays` params/locals to a говорящее `schemaSet` / `SchemaNode`.
- ☑ **N2. Merge the two schema-collection blocks in `validate()`** into one
  `collectSchemaSet(ctx, schemas, data, strict, issues)` helper. Pure refactor.

## Architecture (serious — 2-3 review cycles each)

- ☐ **A1. Three-level context: `systemContext` / `validateContext` / `opts`.**
  `systemContext` = immutable across runs (resolve, schema catalog, loaded IGs,
  default settings, understood modifier-extensions). `validateContext` = mutable per
  call (schemaSet, issues, resource, root resource, current resource/data type, path).
  `opts` = per-call options. All functions take these 3. Drop explicit `strict`,
  `issues`, `path`. `addIssue(ctx, …)` pulls issues from ctx (logging hook).
- ☐ **A2. Inner-resource resolution.** (a) extract a named helper
  `innerResourceResolution` that runs BEFORE the object walk; (b) gate on "the field's
  type is-a `Resource`" (inheritance), not the `atRoot` flag — an element literally
  named `resourceType` must not be mishandled; (c) on recursion, INHERIT the schemaSet
  (don't reset to `[]`) — needed for Bundle slices; (d) consider collecting all inner
  resources in one pass.
- ☐ **A3. Corner-case dispatcher.** Pull Bundle (fullUrl, integrity) + Extension out of
  the main flow into two dispatchers: by `currentResourceType` (Bundle) and by
  `currentDataType` (Extension). Keep `walkObject` generic.
- ☐ **A4. Extension / modifierExtension semantics.**
  - normal extension: opportunistic resolve — validate content if definition available,
    else WARNING (not error). Same for extension-in-extension (no special case).
  - modifierExtension: NOT "resolve by URL" (resolving ≠ understanding). Instead
    `systemContext` carries a list of understood modifier-extension URLs; a flag
    (default OFF) makes an unknown one error "modifier extension not understood".

## Already done / n/a

- ☑ **B3 (dup `expandTypeOverlays`).** Only one call remains (≈428). Resolved.
- ⊘ **FHIRPath via interface.** `options.fhirpath: FHIRPathEvaluator` is already an
  abstraction (not a hard dep on fhirpath.js). Wiring the atomic-ehr FHIRPath impl is a
  packaging decision outside this repo.
