import type { FHIRSchema, FHIRSchemaElement } from '../converter/types.js';
import { FS, type FSCode } from './errors.js';
import { checkPrimitive, isPrimitiveType, PRIMITIVES } from './primitives.js';

export { FS } from './errors.js';

// ─── public surface ────────────────────────────────────────────────────────

export type SchemaRef = string;

export interface ValidateContext {
  resolve: (ref: SchemaRef) => FHIRSchema | undefined;
}

export interface ValidateOptions {
  /**
   * If true, unresolved `data.resourceType` and `data.meta.profile[]`
   * entries emit `fs701` profile-not-found. Default `false` — matches
   * reference validators' permissive default; unknown profiles silently
   * fall back to validating against whatever else is in the SchemaSet.
   */
  strict?: boolean;
  /**
   * Pluggable FHIRPath evaluator for `constraint.expression` evaluation.
   * If absent, all FHIRPath constraints are silently skipped (DESIGN §12
   * deferred-validation pattern). Callers wire a real implementation
   * (HL7 fhirpath.js, atomic-ehr/fhirpath, or a custom adapter).
   */
  fhirpath?: FhirpathEvaluator;
  /**
   * Pluggable terminology validator for `binding.valueSet` checks. If
   * absent, all bindings are silently skipped. The callback is sync; for
   * real terminology servers wrap an in-memory cache or batch via a
   * future deferred-mode API.
   */
  terminology?: TerminologyEvaluator;
  /**
   * Pluggable reference resolver. Returns 'resolved' if target exists,
   * 'unresolved' to emit `fs1002` (warning), 'unknown' to skip silently.
   * Fragment (`#x`) and URN refs are not passed to the resolver.
   */
  referenceResolver?: ReferenceResolver;
}

export type ReferenceVerdict = 'resolved' | 'unresolved' | 'unknown';

export interface ReferenceResolver {
  resolve(reference: string, ctx: { from: (string | number)[] }): ReferenceVerdict;
}

/**
 * Verdict from a terminology check.
 * - `'in'` — code/coding is in the value set, no issue
 * - `'not-in'` — not in the set, emit fs50x by strength
 * - `'unknown'` — engine can't decide (e.g. value set not loaded); silent
 */
export type TerminologyVerdict = 'in' | 'not-in' | 'unknown';

export interface TerminologyEvaluator {
  /**
   * @param valueSet  canonical URL of the bound value set
   * @param value     the FHIR primitive value or composite (Coding / CodeableConcept)
   * @param ctx       binding context: type ('code', 'Coding', 'CodeableConcept') and strength
   */
  validateCode(
    valueSet: string,
    value: unknown,
    ctx: { type?: string; strength: string },
  ): TerminologyVerdict;
}

/**
 * Minimal interface for a pluggable FHIRPath engine. `evaluate` returns the
 * FHIRPath result collection (an array). Constraint satisfaction is judged
 * truthy when the array is non-empty AND its first element is not `false`.
 */
export interface FhirpathEvaluator {
  evaluate(expression: string, root: unknown, context?: Record<string, unknown>): unknown[];
}

export type IssueSeverity = 'error' | 'warning' | 'information';

export interface ValidationIssue {
  code: FSCode;
  /** Default 'error' when emitted without explicit severity. */
  severity?: IssueSeverity;
  path: (string | number)[];
  schema?: string;
  message?: string;
  expected?: unknown;
  got?: unknown;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

// Input schema may carry `base` (canonical) or `additionalProfiles` to combine.
export type InputSchema = FHIRSchema & { additionalProfiles?: string[] };

// Internal `options` extension: the resource currently being walked (set
// when we enter a resource) and the outermost resource (set once, preserved
// through inner-resource walks). Used to populate %resource / %rootResource
// FHIRPath env vars. Not exposed in `ValidateOptions`.
type InternalOptions = ValidateOptions & {
  _resource?: unknown;
  _rootResource?: unknown;
};

// ─── overlay model ─────────────────────────────────────────────────────────

// At each scope we carry a set of "overlays": one per schema currently active.
// At root: each overlay is a whole FHIRSchema. Below root: each overlay is a
// FHIRSchemaElement (the child def from the parent's `elements`).
type Overlay = {
  // The element/schema rules in effect at this scope.
  el: FHIRSchemaElement;
  // Which input schema this overlay traces back to (for issue.schema).
  source?: string;
};

// ─── entry point ───────────────────────────────────────────────────────────

export function validate(
  ctx: ValidateContext,
  schemas: InputSchema[],
  data: unknown,
  options?: ValidateOptions,
): ValidationResult {
  const issues: ValidationIssue[] = [];
  const strict = options?.strict === true;

  // Expand input list: each schema brings its inheritance chain + additional profiles.
  const overlays: Overlay[] = [];
  for (const s of schemas) {
    collectChain(ctx, s, s.url, overlays, issues, new Set());
    for (const ap of s.additionalProfiles ?? []) {
      const resolved = ctx.resolve(ap);
      if (!resolved) {
        issues.push({
          code: FS.PROFILE_NOT_FOUND,
          path: [],
          schema: s.url,
          expected: ap,
        });
        continue;
      }
      collectChain(ctx, resolved, resolved.url, overlays, issues, new Set());
    }
  }

  // Data-driven schema discovery (FHIR resource validation):
  //   1. `data.resourceType` → resolve the base resource schema.
  //   2. `data.meta.profile[]` → resolve each declared profile.
  // Each adds its inheritance chain to the SchemaSet.
  if (data !== null && typeof data === 'object' && !Array.isArray(data)) {
    const obj = data as { resourceType?: unknown; meta?: { profile?: unknown } };

    if (typeof obj.resourceType === 'string') {
      const rt = ctx.resolve(obj.resourceType);
      if (rt) {
        collectChain(ctx, rt, rt.url, overlays, issues, new Set());
      } else if (strict) {
        issues.push({
          code: FS.PROFILE_NOT_FOUND,
          path: [],
          expected: obj.resourceType,
        });
      }
    }

    const profiles = obj.meta?.profile;
    if (Array.isArray(profiles)) {
      for (const canonical of profiles) {
        if (typeof canonical !== 'string') continue;
        const p = ctx.resolve(canonical);
        if (!p) {
          if (strict) {
            issues.push({
              code: FS.PROFILE_NOT_FOUND,
              path: ['meta', 'profile'],
              expected: canonical,
            });
          }
          continue;
        }
        collectChain(ctx, p, p.url, overlays, issues, new Set());
      }
    }
  }

  if (overlays.length > 0) {
    // Stash the resource being walked (becomes %resource / %context) and
    // preserve the outermost (%rootResource) across inner-resource walks.
    const inner = options as InternalOptions | undefined;
    const optsForWalk: InternalOptions = {
      ...(options ?? {}),
      _resource: data,
      _rootResource: inner?._rootResource ?? data,
    };
    walkObject(ctx, overlays, data, [], issues, true, optsForWalk);
  }

  // Normalize severity: default 'error' if not set by emit site.
  for (const i of issues) {
    if (i.severity === undefined) i.severity = 'error';
  }

  return { valid: issues.every((i) => i.severity !== 'error'), issues };
}

// ─── overlay collection ────────────────────────────────────────────────────

function collectChain(
  ctx: ValidateContext,
  schema: FHIRSchema,
  source: string | undefined,
  out: Overlay[],
  issues: ValidationIssue[],
  visited: Set<string>,
): void {
  const key = schema.url ?? schema.name ?? '';
  if (key && visited.has(key)) return;
  if (key) visited.add(key);

  if (schema.base) {
    const parent = ctx.resolve(schema.base);
    if (!parent) {
      issues.push({
        code: FS.PROFILE_NOT_FOUND,
        path: [],
        schema: source,
        expected: schema.base,
      });
    } else {
      collectChain(ctx, parent, source, out, issues, visited);
    }
  }

  // A FHIRSchema's top-level `elements`/`required` act as an element-def at root.
  out.push({
    el: {
      elements: schema.elements,
      required: schema.required,
      excluded: schema.excluded,
      extensions: schema.extensions,
      constraint: schema.constraint,
    } as FHIRSchemaElement,
    source,
  });
}

// ─── core walker ───────────────────────────────────────────────────────────

function walk(
  ctx: ValidateContext,
  overlays: Overlay[],
  value: unknown,
  path: (string | number)[],
  issues: ValidationIssue[],
  options?: ValidateOptions,
): void {
  if (overlays.length === 0) return;

  // Resolve `elementReference`: an element-def may point to another schema's
  // element via `[schemaUrl, ...path]`. The reference is fully substituted —
  // cyclic refs work because resolution happens fresh on each walk-in.
  overlays = overlays.map((o) => resolveElementReference(ctx, o));

  const declaredArray = overlays.some((o) => o.el.array === true);

  if (Array.isArray(value)) {
    if (!declaredArray) {
      issues.push({ code: FS.EXPECTED_ARRAY, path, expected: 'scalar', got: 'array' });
      return;
    }
    // FHIR rule: empty arrays are not allowed in JSON. If a collection is
    // empty the field must be omitted. (sansara: type "empty-value")
    if (value.length === 0) {
      issues.push({ code: FS.TOO_FEW, path, expected: 'non-empty array', got: 0 });
      return;
    }
    checkArrayCardinality(overlays, value, path, issues);
    walkArrayItems(ctx, overlays, value, path, issues, options);
    return;
  }

  if (declaredArray) {
    issues.push({ code: FS.EXPECTED_ARRAY, path, expected: 'array', got: jsTypeOf(value) });
    return;
  }

  // pattern[X] check (deep-partial) and fixed[X] check (strict equality).
  // Both run before the primitive/object branches so type checks still emit
  // their own issues independently.
  checkPatterns(overlays, value, path, issues);
  checkFixed(overlays, value, path, issues);

  // Terminology bindings (fs5xx). Pluggable; skipped if no engine wired.
  if (options?.terminology) {
    checkBindings(overlays, value, path, issues, options.terminology);
  }

  // primitive / null / object
  const type = pickType(overlays);

  if (type && isPrimitiveType(type)) {
    if (value === null) return; // primitive extension placeholder
    if (typeof value === 'object') {
      // object/array where a primitive value was expected
      issues.push({ code: FS.EXPECTED_PRIMITIVE, path, expected: type, got: jsTypeOf(value) });
      return;
    }
    const check = checkPrimitive(type, value);
    if (!check.ok && check.code) {
      issues.push({
        code: check.code,
        path,
        expected: check.expected ?? type,
        got: jsTypeOf(value),
      });
    }
    return;
  }

  if (value === null) return;
  if (typeof value !== 'object') {
    // primitive value where complex type was expected
    issues.push({
      code: FS.EXPECTED_OBJECT,
      path,
      expected: type ?? 'object',
      got: jsTypeOf(value),
    });
    return;
  }

  walkObject(ctx, overlays, value as Record<string, unknown>, path, issues, false, options);
}

function walkObject(
  ctx: ValidateContext,
  overlays: Overlay[],
  data: unknown,
  path: (string | number)[],
  issues: ValidationIssue[],
  atRoot: boolean,
  options?: ValidateOptions,
): void {
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    if (!atRoot) {
      issues.push({ code: FS.EXPECTED_OBJECT, path, expected: 'object', got: jsTypeOf(data) });
    }
    return;
  }
  const obj = data as Record<string, unknown>;

  // Inner-resource walk: a nested object carrying its own `resourceType`
  // (Bundle.entry.resource, Patient.contained[], Parameters.parameter.resource)
  // gets re-validated as if it were the root — its own schema + meta.profile.
  // The outer overlays do not constrain inner resources.
  if (!atRoot && typeof obj.resourceType === 'string') {
    const innerSchema = ctx.resolve(obj.resourceType);
    if (innerSchema) {
      const sub = validate(ctx, [], obj, options);
      for (const i of sub.issues) {
        issues.push({ ...i, path: [...path, ...i.path] });
      }
      return;
    }
  }

  // Bundle.entry.fullUrl must be an absolute URL (or `urn:uuid:`/`urn:oid:`).
  // FHIR Validator enforces this since ~2023 — previously unenforced.
  // `fullUrl` is unique to Bundle.entry in the FHIR base spec, so its
  // presence as a string at any non-root scope is a sufficient marker.
  if (!atRoot && typeof obj.fullUrl === 'string') {
    const url = obj.fullUrl;
    if (!url.startsWith('urn:') && !/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(url)) {
      issues.push({
        code: FS.FULLURL_NOT_ABSOLUTE,
        path: [...path, 'fullUrl'],
        got: url,
      });
    }
  }

  // Expand overlays through `type` references: e.g. element typed `HumanName`
  // pulls in HumanName's elements as additional overlays at this scope.
  let expanded = expandTypeOverlays(ctx, overlays, path, issues);

  // Extension URL dereferencing: when the current scope is an Extension
  // (any overlay says type=Extension) AND data carries an absolute-URL
  // `url`, pull the extension definition by URL and apply as additional
  // overlay. This makes us-core-race etc. validate sub-extensions
  // internally. Short bare URLs (sub-extension names like "species") are
  // NOT resolved — they collide with the resolver's `name` index and
  // would deref to unrelated canonicals (e.g. "test" → openEHR-test).
  if (
    typeof obj.url === 'string' &&
    obj.url.includes('://') &&
    expanded.some((o) => (o.el as { type?: string }).type === 'Extension')
  ) {
    const extSchema = ctx.resolve(obj.url);
    if (extSchema) {
      const chain: Overlay[] = [];
      collectChain(ctx, extSchema, extSchema.url, chain, issues, new Set());
      expanded = [...expanded, ...chain];
    }
  }

  // Reference target type check (fs1001) + resolver (fs1002). Operates on
  // overlays before expansion — `refers` lives on the parent element-def,
  // not on Reference's own elements.
  checkReferenceTarget(overlays, obj, path, issues, options?.referenceResolver);

  // FHIRPath constraints (fs601). Skipped if no evaluator wired.
  if (options?.fhirpath) {
    const internal = options as InternalOptions;
    checkConstraints(expanded, obj, path, issues, options.fhirpath, {
      resource: internal._resource,
      rootResource: internal._rootResource,
    });
  }

  // Empty composite check (only at non-root). Continue afterwards — a
  // required-key check on an empty object still wants to report what's
  // missing, matching Graham java validator's output ("Object must have
  // some content" + "minimum required = 1, but only found 0").
  // `_field` shadows count as content: an Element with only `_x.extension`
  // (no value) is a valid representation per the primitive-extension rules.
  const meaningfulKeys = Object.keys(obj).filter((k) => k !== 'resourceType');
  if (meaningfulKeys.length === 0 && !atRoot) {
    issues.push({ code: FS.EXPECTED_OBJECT, path, expected: 'non-empty-object' });
  }

  // Choice groups (value[x]): map parent → intersection of allowed variants.
  // Profile narrowing intersects; base widening is not allowed.
  const choiceGroups = collectChoiceGroups(expanded);

  // Excluded keys union across overlays — any overlay forbidding the key
  // makes it forbidden globally.
  const excluded = new Set<string>();
  for (const o of expanded) {
    for (const e of o.el.excluded ?? []) excluded.add(e);
  }

  // Required keys union across overlays.
  // A choice parent (key in `choiceGroups`) is satisfied by ANY variant.
  const required = new Set<string>();
  for (const o of expanded) {
    for (const r of o.el.required ?? []) required.add(r);
  }
  for (const r of required) {
    if (choiceGroups.has(r)) {
      // For a required choice parent, ANY declared variant present
      // satisfies the slot — even a narrowed-away one. Variant-not-allowed
      // is handled by checkChoiceGroups (fs801); we don't double-fire.
      const allVariants = collectAllChoiceVariants(expanded, r);
      const present = allVariants.some((v) => v in obj || `_${v}` in obj);
      if (!present) {
        issues.push({ code: FS.REQUIRED, path: [...path, r], expected: r });
      }
      continue;
    }
    if (!(r in obj) && !(`_${r}` in obj)) {
      issues.push({ code: FS.REQUIRED, path: [...path, r], expected: r });
    }
  }

  // Choice enforcement: at most one variant present (per parent), narrowed
  // choices respected.
  checkChoiceGroups(expanded, choiceGroups, obj, path, issues);

  // Iterate over data keys (data-driven traversal).
  for (const key of Object.keys(obj)) {
    if (atRoot && key === 'resourceType') continue;
    // Non-standard JSON5 metadata field emitted by some FHIR producers
    // (e.g. Graham's test suite). Silently tolerated like Java validator.
    if (key === 'fhir_comments') continue;

    const isShadow = key.startsWith('_') && key.length > 1;
    const baseKey = isShadow ? key.slice(1) : key;

    // Excluded keys: emit fs207 but otherwise stop (don't descend further).
    if (excluded.has(baseKey)) {
      issues.push({ code: FS.EXCLUDED_ELEMENT, path: [...path, key], got: key });
      continue;
    }

    const childOverlays = findChildOverlays(expanded, baseKey);

    if (childOverlays.length === 0) {
      issues.push({ code: FS.UNKNOWN_ELEMENT, path: [...path, key], got: key });
      continue;
    }

    // modifierExtension MU rule: every entry's `url` MUST resolve. If not,
    // emit fs1102 error (consumer cannot safely interpret the resource).
    if (baseKey === 'modifierExtension' && Array.isArray(obj[key])) {
      const items = obj[key] as unknown[];
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const url = (it as { url?: unknown } | null)?.url;
        if (typeof url !== 'string') continue;
        if (!ctx.resolve(url)) {
          issues.push({
            code: FS.MODIFIER_EXTENSION_NOT_UNDERSTOOD,
            severity: 'error',
            path: [...path, key, i],
            expected: url,
          });
        }
      }
    }

    if (isShadow) {
      // `_field` is only valid for primitive-typed fields.
      const type = pickType(childOverlays);
      if (!type || !isPrimitiveType(type)) {
        issues.push({
          code: FS.INVALID_PRIMITIVE_EXTENSION,
          path: [...path, key],
          expected: 'primitive field',
          got: type,
        });
        continue;
      }
      // Deep `_field` validation: payload shape (object for scalar primitive,
      // array<object|null> for array primitive) plus walking into Element
      // (id + extension[]). Extension's own elements are resolved via the
      // standard expandTypeOverlays path.
      const isArrayPrimitive = childOverlays.some((o) => o.el.array === true);
      validateShadowPayload(
        ctx,
        obj[key],
        [...path, key],
        issues,
        isArrayPrimitive,
        options,
      );
      continue;
    }

    walk(ctx, childOverlays, obj[key], [...path, key], issues, options);
  }
}

// Inline overlay describing the Element complex type: `{id?, extension?[]}`.
// Used to walk `_field` payloads so primitive-extension extensions get full
// validation (URL deref, choice intersection, required-key checks).
//
// Only emitted when Extension is resolvable. If not (e.g. inline-schema
// tests with no R4 loaded), we fall back to a shape-only check upstream.
const ELEMENT_OVERLAY: Overlay = {
  el: {
    elements: {
      id: { type: 'id' },
      extension: { type: 'Extension', array: true },
    },
  } as FHIRSchemaElement,
  source: undefined,
};

function validateShadowPayload(
  ctx: ValidateContext,
  payload: unknown,
  path: (string | number)[],
  issues: ValidationIssue[],
  isArrayPrimitive: boolean,
  options?: ValidateOptions,
): void {
  // Walking into the Element shape requires the Extension type to be
  // resolvable in ctx (R4 loaded). Otherwise shape-check only.
  const deep = ctx.resolve('Extension') !== undefined;

  if (isArrayPrimitive) {
    if (!Array.isArray(payload)) {
      issues.push({
        code: FS.INVALID_PRIMITIVE_EXTENSION,
        path,
        expected: 'array of Element|null',
        got: jsTypeOf(payload),
      });
      return;
    }
    for (let i = 0; i < payload.length; i++) {
      const item = payload[i];
      if (item === null) continue;
      if (typeof item !== 'object' || Array.isArray(item)) {
        issues.push({
          code: FS.INVALID_PRIMITIVE_EXTENSION,
          path: [...path, i],
          expected: 'Element object or null',
          got: jsTypeOf(item),
        });
        continue;
      }
      if (deep) {
        walkObject(ctx, [ELEMENT_OVERLAY], item, [...path, i], issues, false, options);
      }
    }
    return;
  }
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    issues.push({
      code: FS.INVALID_PRIMITIVE_EXTENSION,
      path,
      expected: 'Element object',
      got: jsTypeOf(payload),
    });
    return;
  }
  if (deep) {
    walkObject(ctx, [ELEMENT_OVERLAY], payload, path, issues, false, options);
  }
}

// ─── overlay helpers ───────────────────────────────────────────────────────

function pickType(overlays: Overlay[]): string | undefined {
  for (const o of overlays) {
    if (o.el.type) return o.el.type;
  }
  return undefined;
}

function findChildOverlays(overlays: Overlay[], key: string): Overlay[] {
  const out: Overlay[] = [];
  for (const o of overlays) {
    const child = o.el.elements?.[key];
    if (!child) continue;
    // Skip virtual choice parents (e.g. `deceased`, `value`): they exist in
    // the IR only to organize `value[x]` variants, but the literal key is
    // not a valid FHIR JSON field. Variants like `deceasedBoolean` carry
    // `choiceOf` and are real; the virtual parent has `choices` instead.
    if (Array.isArray(child.choices)) continue;
    out.push({ el: child, source: o.source });
  }
  return out;
}

function resolveElementReference(ctx: ValidateContext, o: Overlay): Overlay {
  const ref = (o.el as { elementReference?: string[] }).elementReference;
  if (!ref || ref.length === 0) return o;
  const [schemaUrl, ...segments] = ref;
  if (!schemaUrl) return o;
  const schema = ctx.resolve(schemaUrl);
  if (!schema) return o;
  let cursor: unknown = schema;
  for (const seg of segments) {
    if (cursor !== null && typeof cursor === 'object' && seg in (cursor as Record<string, unknown>)) {
      cursor = (cursor as Record<string, unknown>)[seg];
    } else {
      return o;
    }
  }
  if (!cursor || typeof cursor !== 'object') return o;
  return { el: cursor as FHIRSchemaElement, source: o.source };
}

function expandTypeOverlays(
  ctx: ValidateContext,
  overlays: Overlay[],
  path: (string | number)[],
  issues: ValidationIssue[],
): Overlay[] {
  const out: Overlay[] = [...overlays];
  for (const o of overlays) {
    const type = o.el.type;
    if (!type || isPrimitiveType(type) || PRIMITIVES.has(type)) continue;
    // Resolve named complex type into its element-def.
    const sch = ctx.resolve(type);
    if (!sch) {
      issues.push({
        code: FS.PROFILE_NOT_FOUND,
        path,
        schema: o.source,
        expected: type,
      });
      continue;
    }
    // Walk the type's chain too.
    const chain: Overlay[] = [];
    collectChain(ctx, sch, o.source, chain, issues, new Set());
    out.push(...chain);
  }
  return out;
}

/**
 * Find `value[x]` choice groups across overlays. Returns parent-name → list
 * of allowed variant names (intersection — a profile narrows but never widens).
 * Empty intersection still emits a group; a present variant will then fail
 * fs801.
 */
/** Union of variants for one choice parent across overlays. */
function collectAllChoiceVariants(overlays: Overlay[], parent: string): string[] {
  const out = new Set<string>();
  for (const o of overlays) {
    for (const [n, el] of Object.entries(o.el.elements ?? {})) {
      if (el.choiceOf === parent) out.add(n);
    }
    const pEl = o.el.elements?.[parent];
    if (Array.isArray(pEl?.choices)) {
      for (const v of pEl.choices) out.add(v);
    }
  }
  return [...out];
}

function collectChoiceGroups(overlays: Overlay[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const o of overlays) {
    for (const [name, el] of Object.entries(o.el.elements ?? {})) {
      if (Array.isArray(el.choices)) {
        const cur = out.get(name);
        if (cur === undefined) {
          out.set(name, [...el.choices]);
        } else {
          out.set(name, cur.filter((v) => (el.choices as string[]).includes(v)));
        }
      }
    }
  }
  return out;
}

function checkChoiceGroups(
  overlays: Overlay[],
  groups: Map<string, string[]>,
  obj: Record<string, unknown>,
  path: (string | number)[],
  issues: ValidationIssue[],
): void {
  for (const [parent, allowed] of groups) {
    // All known variant names for this parent: anything declared `choiceOf: parent`
    // anywhere, plus the union of all `choices` lists across overlays.
    const allVariants = new Set<string>();
    for (const o of overlays) {
      for (const [n, el] of Object.entries(o.el.elements ?? {})) {
        if (el.choiceOf === parent) allVariants.add(n);
      }
      const pEl = o.el.elements?.[parent];
      if (Array.isArray(pEl?.choices)) {
        for (const v of pEl.choices) allVariants.add(v);
      }
    }

    const present = [...allVariants].filter((v) => v in obj || `_${v}` in obj);

    // Variants present but narrowed away by some overlay's choices list.
    for (const v of present) {
      if (!allowed.includes(v)) {
        issues.push({
          code: FS.INVALID_CHOICE_TYPE,
          path: [...path, v],
          expected: allowed,
          got: v,
        });
      }
    }

    // Multiple allowed variants simultaneously present.
    const allowedPresent = present.filter((v) => allowed.includes(v));
    if (allowedPresent.length > 1) {
      issues.push({
        code: FS.MULTIPLE_CHOICE_VALUES,
        path,
        expected: parent,
        got: allowedPresent,
      });
    }
  }
}

// ─── slicing ─────────────────────────────────────────────────────────────

// Local copy of the slicing block shape from src/types.ts. We avoid importing
// the broader type to keep this file self-contained against schema-shape drift.
type SliceDef = {
  match?: unknown;
  schema?: FHIRSchemaElement;
  min?: number;
  max?: number;
  /**
   * FHIR `sliceIsConstraining`: when set on a slice in a child profile,
   * signals that it constrains the SAME slice in the parent (i.e. shares
   * the slice name) rather than introducing a new one. Effect at merge
   * time: shallow-merge child fields onto the parent slice instead of
   * replacing the whole def.
   */
  sliceIsConstraining?: boolean;
};
type Slicing = {
  rules?: string;
  ordered?: boolean;
  slices?: Record<string, SliceDef>;
};

/**
 * Merge slicing blocks across overlays on the same array element.
 * - `slices`: union (last write wins on same slice name; profile typically
 *   adds new slices on top of the base). When the child slice has
 *   `sliceIsConstraining: true`, shallow-merge its fields onto the
 *   parent's slice instead of replacing — letting the child tighten an
 *   existing slice (e.g. add `max: 0`) while preserving the parent's
 *   match pattern and other fields.
 * - `rules`: take the tightest (closed > openAtEnd > open).
 * - `ordered`: any overlay claiming `true`.
 * Returns undefined if no overlay declared slicing.
 */
function mergeSlicing(overlays: Overlay[]): Slicing | undefined {
  let merged: Slicing | undefined;
  const tightness: Record<string, number> = { open: 0, openAtEnd: 1, closed: 2 };
  for (const o of overlays) {
    const s = (o.el as unknown as { slicing?: Slicing }).slicing;
    if (!s) continue;
    if (!merged) merged = { slices: {} };
    const target = merged.slices as Record<string, SliceDef>;
    for (const [name, def] of Object.entries(s.slices ?? {})) {
      const existing = target[name];
      if (existing && def.sliceIsConstraining === true) {
        target[name] = { ...existing, ...def };
      } else {
        target[name] = def;
      }
    }
    if (s.rules !== undefined) {
      if (
        merged.rules === undefined ||
        (tightness[s.rules] ?? 0) > (tightness[merged.rules] ?? 0)
      ) {
        merged.rules = s.rules;
      }
    }
    if (s.ordered === true) merged.ordered = true;
  }
  return merged;
}

/**
 * Return slice names whose `match` pattern is satisfied by the item.
 * The `@default` slice is excluded — it's a fallback, not a match-by-pattern.
 */
function classifyItem(item: unknown, slicing: Slicing): string[] {
  const out: string[] = [];
  for (const [name, def] of Object.entries(slicing.slices ?? {})) {
    if (name === '@default') continue;
    const effective = effectiveMatch(def, name);
    if (effective === undefined) continue;
    if (matchPattern(effective, item)) out.push(name);
  }
  return out;
}

/**
 * The slice's effective discriminator pattern, with two FHIR-extension
 * conventions baked in:
 *
 * 1. If translator left `match: {}` empty because the URL lives in the
 *    slice's element schema, use `{url: schema.url}`.
 * 2. For sub-extensions inside a composite Extension, slice schemas often
 *    have no `url` (it'd be redundant — sub-extension URLs are short
 *    names). In that case, the slice name conventionally equals the
 *    sub-extension's `url` value, so fall back to `{url: <sliceName>}`.
 */
function effectiveMatch(def: SliceDef, sliceName?: string): unknown | undefined {
  if (def.match !== undefined) {
    const isEmptyObj =
      def.match !== null &&
      typeof def.match === 'object' &&
      !Array.isArray(def.match) &&
      Object.keys(def.match as Record<string, unknown>).length === 0;
    if (!isEmptyObj) return def.match;
  }
  const url = (def.schema as { url?: unknown } | undefined)?.url;
  if (typeof url === 'string') return { url };
  if (sliceName) return { url: sliceName };
  return undefined;
}

function walkArrayItems(
  ctx: ValidateContext,
  overlays: Overlay[],
  arr: unknown[],
  path: (string | number)[],
  issues: ValidationIssue[],
  options?: ValidateOptions,
): void {
  // Item-level overlays: strip `array` and the slicing block (slicing applies
  // at the array level, not per item).
  const itemOverlays = overlays.map((o) => ({
    ...o,
    el: stripArrayAndSlicing(o.el),
  }));

  const slicing = mergeSlicing(overlays);

  if (!slicing) {
    for (let i = 0; i < arr.length; i++) {
      walk(ctx, itemOverlays, arr[i], [...path, i], issues, options);
    }
    return;
  }

  const counts = new Map<string, number>();
  const sliceOrder = Object.keys(slicing.slices ?? {});
  for (const name of sliceOrder) counts.set(name, 0);
  let maxIdx = -1; // highest slice-declaration index seen so far (for ordered)
  let sawUnmatched = false; // for openAtEnd: matched-after-unmatched → fs904
  const defaultSlice = (slicing.slices as Record<string, SliceDef> | undefined)?.['@default'];

  for (let i = 0; i < arr.length; i++) {
    const item = arr[i];
    const matched = classifyItem(item, slicing);

    if (matched.length > 1) {
      issues.push({
        code: FS.SLICE_NOT_MATCHED,
        path: [...path, i],
        expected: 'one matching slice',
        got: matched,
      });
      walk(ctx, itemOverlays, item, [...path, i], issues, options);
      continue;
    }

    if (matched.length === 0) {
      // `@default` slice (if present) is the fallback overlay for items
      // that match no other slice. Its presence also suppresses the
      // closed-rule fs901 error.
      if (defaultSlice) {
        counts.set('@default', (counts.get('@default') ?? 0) + 1);
        const overlayed: Overlay[] = defaultSlice.schema
          ? [
              ...itemOverlays,
              {
                el: stripArrayAndSlicing(defaultSlice.schema as FHIRSchemaElement),
                source: undefined,
              },
            ]
          : itemOverlays;
        walk(ctx, overlayed, item, [...path, i], issues, options);
        continue;
      }
      if (slicing.rules === 'closed') {
        issues.push({
          code: FS.SLICE_NOT_MATCHED,
          path: [...path, i],
          expected: Object.keys(slicing.slices ?? {}),
        });
      }
      // open / openAtEnd without @default: validate against base element only.
      sawUnmatched = true;
      walk(ctx, itemOverlays, item, [...path, i], issues, options);
      continue;
    }

    // Exactly one slice — validate item with slice schema overlay on top.
    const name = matched[0] as string;
    counts.set(name, (counts.get(name) ?? 0) + 1);
    const slice = (slicing.slices as Record<string, SliceDef>)[name];

    // openAtEnd: a matched item appearing AFTER any unmatched one → fs904.
    if (slicing.rules === 'openAtEnd' && sawUnmatched) {
      issues.push({
        code: FS.UNMATCHED_NOT_AT_END,
        path: [...path, i],
        expected: 'matched items before unmatched',
      });
    }

    // Ordered slicing (fs903): slice index must be non-decreasing across
    // matched items. Slices A,B,C declared in that order → data may run
    // [A, A, B, C] but not [B, A].
    if (slicing.ordered === true) {
      const idx = sliceOrder.indexOf(name);
      if (idx < maxIdx) {
        issues.push({
          code: FS.SLICE_OUT_OF_ORDER,
          path: [...path, i],
          expected: { sliceOrder, after: sliceOrder[maxIdx] },
          got: name,
        });
      } else {
        maxIdx = idx;
      }
    }

    const overlayed: Overlay[] = slice.schema
      ? [
          ...itemOverlays,
          {
            el: stripArrayAndSlicing(slice.schema as FHIRSchemaElement),
            source: undefined,
          },
        ]
      : itemOverlays;
    walk(ctx, overlayed, item, [...path, i], issues, options);
  }

  // Per-slice cardinality
  for (const [name, slice] of Object.entries(slicing.slices ?? {})) {
    const count = counts.get(name) ?? 0;
    if (typeof slice.min === 'number' && count < slice.min) {
      issues.push({
        code: FS.SLICE_CARDINALITY,
        path,
        expected: { slice: name, min: slice.min },
        got: count,
      });
    }
    if (typeof slice.max === 'number' && count > slice.max) {
      issues.push({
        code: FS.SLICE_CARDINALITY,
        path,
        expected: { slice: name, max: slice.max },
        got: count,
      });
    }
  }
}

function stripArrayAndSlicing(el: FHIRSchemaElement): FHIRSchemaElement {
  if (!el.array && !(el as unknown as { slicing?: unknown }).slicing) return el;
  const { array: _a, ...rest } = el;
  delete (rest as { slicing?: unknown }).slicing;
  return rest as FHIRSchemaElement;
}

// ─── pattern ─────────────────────────────────────────────────────────────

// ─── constraints (FHIRPath) ──────────────────────────────────────────────

/**
 * Evaluate `constraint` expressions via the pluggable FHIRPath engine.
 * One issue per failed constraint per overlay (union semantics — every
 * overlay's constraints apply).
 */
/**
 * Constraint keys we DO NOT evaluate. These are FHIR baseline rules that
 * encode JSON-shape requirements already enforced syntactically by our
 * validator (e.g. fs202 empty composite). Evaluating them here causes
 * double-firing and depends on model-aware FHIRPath features (`children()`
 * etc.) that our minimal adapter does not provide. See DESIGN §6.1, §14.
 */
const DROPPED_CONSTRAINTS = new Set<string>([
  'ele-1', // "All FHIR elements must have a @value or children"
  'ext-1', // "Must have either extensions or value[x], not both"
]);

function checkConstraints(
  overlays: Overlay[],
  obj: Record<string, unknown>,
  path: (string | number)[],
  issues: ValidationIssue[],
  engine: FhirpathEvaluator,
  env: { resource?: unknown; rootResource?: unknown } = {},
): void {
  for (const o of overlays) {
    const constraints = (o.el as { constraint?: Record<string, ConstraintDef> }).constraint;
    if (!constraints) continue;
    for (const [key, c] of Object.entries(constraints)) {
      if (DROPPED_CONSTRAINTS.has(key)) continue;
      if (!c?.expression) continue;
      let result: unknown[];
      try {
        // FHIR FHIRPath env vars: %resource (containing resource),
        // %rootResource (outermost — e.g. Bundle for Bundle.entry), %context
        // (current node being validated). Constraints like dom-3 reference
        // %resource explicitly.
        result = engine.evaluate(c.expression, obj, {
          resource: env.resource ?? obj,
          rootResource: env.rootResource ?? env.resource ?? obj,
          context: obj,
        });
      } catch {
        // Engine threw — treat as failing constraint to surface the issue.
        result = [];
      }
      if (!isFhirpathTruthy(result)) {
        const sev: IssueSeverity =
          c.severity === 'warning' || c.severity === 'information'
            ? c.severity
            : 'error';
        issues.push({
          code: FS.INVARIANT_VIOLATED,
          severity: sev,
          path,
          schema: o.source,
          expected: key,
          message: c.human,
        });
      }
    }
  }
}

type ConstraintDef = { expression?: string; human?: string; severity?: string };

/** FHIRPath truthy: non-empty collection whose first element is not `false`. */
function isFhirpathTruthy(result: unknown[]): boolean {
  if (!Array.isArray(result) || result.length === 0) return false;
  return result[0] !== false;
}

// ─── references ──────────────────────────────────────────────────────────

/**
 * Syntactic check of `Reference.reference` against the parent element's
 * `refers: [canonical, ...]` constraint. Emits `fs1001` if the resource type
 * parsed from the string is not in the allowed list. Skips fragment (`#x`)
 * and URN references — their target type is opaque without resolution.
 *
 * Deferred follow-up (DESIGN §12): `fs1002` unresolved-reference would
 * require actually fetching the target. Out of scope for the pure validator.
 */
function checkReferenceTarget(
  overlays: Overlay[],
  obj: Record<string, unknown>,
  path: (string | number)[],
  issues: ValidationIssue[],
  resolver?: ReferenceResolver,
): void {
  const ref = obj.reference;
  if (typeof ref !== 'string') return;

  // fs1001 — target type vs refers[]
  const refers = collectRefers(overlays);
  const targetType = parseReferenceType(ref);
  if (refers && targetType) {
    const allowed = refers.map(canonicalTail);
    if (!allowed.includes(targetType)) {
      issues.push({
        code: FS.INVALID_REFERENCE_TYPE,
        path: [...path, 'reference'],
        expected: allowed,
        got: targetType,
      });
    }
  }

  // fs1002 — resolver-side existence check. Fragment / URN skipped.
  if (resolver && !ref.startsWith('#') && !ref.startsWith('urn:')) {
    const verdict = resolver.resolve(ref, { from: [...path, 'reference'] });
    if (verdict === 'unresolved') {
      issues.push({
        code: FS.UNRESOLVED_REFERENCE,
        severity: 'warning',
        path: [...path, 'reference'],
        got: ref,
      });
    }
  }
}

function collectRefers(overlays: Overlay[]): string[] | undefined {
  const out = new Set<string>();
  for (const o of overlays) {
    for (const r of o.el.refers ?? []) out.add(r);
  }
  return out.size ? [...out] : undefined;
}

const REF_TYPE_RX = /(?:^|\/)([A-Z][A-Za-z]+)\/[^/]+(?:\/_history\/.+)?$/;

function parseReferenceType(ref: string): string | undefined {
  if (ref.startsWith('#')) return undefined;
  if (ref.startsWith('urn:')) return undefined;
  return REF_TYPE_RX.exec(ref)?.[1];
}

function canonicalTail(canonical: string): string {
  return canonical.split('/').pop() ?? canonical;
}

// ─── pattern ─────────────────────────────────────────────────────────────

// ─── terminology bindings ────────────────────────────────────────────────

function checkBindings(
  overlays: Overlay[],
  value: unknown,
  path: (string | number)[],
  issues: ValidationIssue[],
  engine: TerminologyEvaluator,
): void {
  for (const o of overlays) {
    const b = (o.el as { binding?: { strength?: string; valueSet?: string } }).binding;
    if (!b?.valueSet || !b.strength) continue;
    if (b.strength === 'example') continue; // examples never validated
    const type = (o.el as { type?: string }).type;
    const verdict = engine.validateCode(b.valueSet, value, {
      type,
      strength: b.strength,
    });
    if (verdict !== 'not-in') continue; // 'in' and 'unknown' don't fire
    if (b.strength === 'required') {
      issues.push({
        code: FS.INVALID_CODE_FOR_BINDING,
        severity: 'error',
        path,
        schema: o.source,
        expected: b.valueSet,
        got: value,
      });
    } else if (b.strength === 'extensible') {
      issues.push({
        code: FS.CODE_NOT_IN_EXTENSIBLE,
        severity: 'warning',
        path,
        schema: o.source,
        expected: b.valueSet,
        got: value,
      });
    } else if (b.strength === 'preferred') {
      issues.push({
        code: FS.CODE_NOT_IN_PREFERRED,
        severity: 'information',
        path,
        schema: o.source,
        expected: b.valueSet,
        got: value,
      });
    }
  }
}

// ─── fixed[X] strict equality ─────────────────────────────────────────────

function checkFixed(
  overlays: Overlay[],
  value: unknown,
  path: (string | number)[],
  issues: ValidationIssue[],
): void {
  for (const o of overlays) {
    const f = (o.el as { fixed?: { type: string; value: unknown } }).fixed;
    if (!f) continue;
    if (!deepEqual(f.value, value)) {
      issues.push({
        code: FS.FIXED_MISMATCH,
        path,
        schema: o.source,
        expected: f.value,
        got: value,
      });
    }
  }
}

/** Strict structural equality (FHIR `fixed[X]` semantics). */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false;
    return true;
  }
  if (a !== null && typeof a === 'object' && b !== null && typeof b === 'object') {
    const ao = a as Record<string, unknown>;
    const bo = b as Record<string, unknown>;
    const aKeys = Object.keys(ao);
    const bKeys = Object.keys(bo);
    if (aKeys.length !== bKeys.length) return false;
    for (const k of aKeys) if (!deepEqual(ao[k], bo[k])) return false;
    return true;
  }
  return false;
}

// ─── pattern ─────────────────────────────────────────────────────────────

function checkPatterns(
  overlays: Overlay[],
  value: unknown,
  path: (string | number)[],
  issues: ValidationIssue[],
): void {
  for (const o of overlays) {
    const p = o.el.pattern;
    if (!p) continue;
    if (!matchPattern(p.value, value)) {
      issues.push({
        code: FS.PATTERN_MISMATCH,
        path,
        schema: o.source,
        expected: p.value,
        got: value,
      });
    }
  }
}

/**
 * Deep-partial match used by `pattern[X]` (and reused for slice classification).
 * - Object: every key in pattern must deep-match in value; extras in value allowed.
 * - Array: every pattern item must be matched by some value item (subset, order-insensitive).
 * - Primitive: strict equality.
 *
 * Cross-cardinality leniency: if pattern is an object/primitive but value is
 * an array, we check whether *any* item in the array matches the pattern.
 * This mirrors FHIRPath's implicit "any item" semantics on array fields and
 * is what slicing discriminators expect (e.g. `coding.code` against a
 * `coding[]` array).
 */
function matchPattern(pattern: unknown, value: unknown): boolean {
  if (Array.isArray(pattern)) {
    if (!Array.isArray(value)) return false;
    return pattern.every((p) => value.some((v) => matchPattern(p, v)));
  }
  // Non-array pattern vs array value → "any item matches"
  if (!Array.isArray(pattern) && Array.isArray(value)) {
    return value.some((v) => matchPattern(pattern, v));
  }
  if (pattern !== null && typeof pattern === 'object') {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
    const po = pattern as Record<string, unknown>;
    const vo = value as Record<string, unknown>;
    for (const k of Object.keys(po)) {
      if (!matchPattern(po[k], vo[k])) return false;
    }
    return true;
  }
  return pattern === value;
}

function checkArrayCardinality(
  overlays: Overlay[],
  arr: unknown[],
  path: (string | number)[],
  issues: ValidationIssue[],
): void {
  // Take the tightest bounds across overlays.
  let min = 0;
  let max = Number.POSITIVE_INFINITY;
  for (const o of overlays) {
    if (typeof o.el.min === 'number' && o.el.min > min) min = o.el.min;
    if (typeof o.el.max === 'number' && o.el.max < max) max = o.el.max;
  }
  if (arr.length < min) {
    issues.push({ code: FS.TOO_FEW, path, expected: min, got: arr.length });
  }
  if (arr.length > max) {
    issues.push({ code: FS.TOO_MANY, path, expected: max, got: arr.length });
  }
}

function jsTypeOf(v: unknown): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v;
}
