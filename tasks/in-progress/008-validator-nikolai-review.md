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

- ☑ **A1. Three-level context.** Internal functions now thread one `Ctx` session
  bundling the system half (`resolve`, `settings`) + mutable session state (`issues`,
  `resource`, `rootResource`) + `opts`. Dropped the explicit `issues`/`options`
  params and the `InternalOptions._resource` hack; `addIssue(ctx, …)` is the single
  emit point/log hook; `strict` reads from `ctx.opts`. (`path` + schemaSet kept as
  scope-local params — Nikolai's "можно убрать" was optional and they're per-scope.)
  Public `validate(ctx, …)` signature unchanged. Behavior-preserving (530 green).
- ☑ **A2. Inner-resource resolution.** Extracted `tryInnerResource()` (runs before the
  object walk). Gated on `isResourceType(pickType(overlays))` — the element's type
  is-a Resource — not the `atRoot` flag, so a field literally named `resourceType` on a
  non-resource type stays an ordinary element. The inner walk inherits the outer
  overlays (so a Bundle/profile constraint on the resource slot applies) plus the inner
  resource's own chain. Tests: `inner-resource.yaml`. (One-pass collection (d) deferred —
  current per-scope resolution is correct; one-pass is an optimization.)
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
