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

- ☑ **N1. `overlays` → `schemaSet`.** Renamed the whole concept consistently: type
  `Overlay → SchemaNode`, `overlays → schemaSet`, and every derived form
  (`childOverlays → childSchemas`, `resolvedOverlays → resolvedSchemas`,
  `expandTypeOverlays → expandTypeSchemas`, `addSchemaOverlays → addSchemas`,
  `findChildOverlays → findChildSchemas`, `ELEMENT_OVERLAY → ELEMENT_SCHEMA`) + comments.
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
- ☑ **A3. Corner-case dispatcher.** `walkObject` is now generic; Bundle (integrity +
  per-entry fullUrl) and Extension (URL deref) live in `handleBundle`/`handleExtension`,
  dispatched via `RESOURCE_HANDLERS` (keyed by `ctx.currentResourceType`) and
  `DATATYPE_HANDLERS` (keyed by overlay data types). Behavior-preserving (green).
- ☑ **A4. Extension / modifierExtension semantics.**
  - normal extension: `handleExtension` now emits `fs1101` WARNING (not error,
    content left unvalidated) when an absolute-URL extension can't be resolved;
    bare sub-extension names are excluded. extension-in-extension flows the same way.
  - modifierExtension: no longer "resolve by URL". Gated on
    `ctx.settings.errorOnUnknownModifierExtension` (default OFF) against the
    declarative `ctx.settings.understoodModifierExtensions` list. Test harness gained
    `settings` (system context) support. Tests: `modifier-extension.yaml`.

## Already done / n/a

- ☑ **B3 (dup `expandTypeOverlays`).** Only one call remains (≈428). Resolved.
- ⊘ **FHIRPath via interface.** `options.fhirpath: FHIRPathEvaluator` is already an
  abstraction (not a hard dep on fhirpath.js). Wiring the atomic-ehr FHIRPath impl is a
  packaging decision outside this repo.
