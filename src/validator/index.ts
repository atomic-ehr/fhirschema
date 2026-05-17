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
}

export interface ValidationIssue {
  code: FSCode;
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

  if (overlays.length === 0) {
    // No schemas — nothing to check. Return clean.
    return { valid: true, issues };
  }

  walkObject(ctx, overlays, data, [], issues, true, options);

  return { valid: issues.length === 0, issues };
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
): void {
  if (overlays.length === 0) return;

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
    walkArrayItems(ctx, overlays, value, path, issues);
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

  walkObject(ctx, overlays, value as Record<string, unknown>, path, issues, false);
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

  // Expand overlays through `type` references: e.g. element typed `HumanName`
  // pulls in HumanName's elements as additional overlays at this scope.
  const expanded = expandTypeOverlays(ctx, overlays, path, issues);

  // Reference target type check (fs1001). Operates on overlays before
  // expansion — `refers` lives on the parent element-def, not on
  // Reference's own elements.
  checkReferenceTarget(overlays, obj, path, issues);

  // Empty composite check (only at non-root). Continue afterwards — a
  // required-key check on an empty object still wants to report what's
  // missing, matching Graham java validator's output ("Object must have
  // some content" + "minimum required = 1, but only found 0").
  const meaningfulKeys = Object.keys(obj).filter(
    (k) => k !== 'resourceType' && !(k.startsWith('_') && k.length > 1),
  );
  if (meaningfulKeys.length === 0 && !atRoot) {
    issues.push({ code: FS.EXPECTED_OBJECT, path, expected: 'non-empty-object' });
  }

  // Choice groups (value[x]): map parent → intersection of allowed variants.
  // Profile narrowing intersects; base widening is not allowed.
  const choiceGroups = collectChoiceGroups(expanded);

  // Required keys union across overlays.
  // A choice parent (key in `choiceGroups`) is satisfied by ANY variant.
  const required = new Set<string>();
  for (const o of expanded) {
    for (const r of o.el.required ?? []) required.add(r);
  }
  for (const r of required) {
    const allowed = choiceGroups.get(r);
    if (allowed !== undefined) {
      const present = allowed.some((v) => v in obj || `_${v}` in obj);
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

    const isShadow = key.startsWith('_') && key.length > 1;
    const baseKey = isShadow ? key.slice(1) : key;

    const childOverlays = findChildOverlays(expanded, baseKey);

    if (childOverlays.length === 0) {
      issues.push({ code: FS.UNKNOWN_ELEMENT, path: [...path, key], got: key });
      continue;
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
      // Treat `_field` payload as Element (id + extension); leave deep check for later.
      continue;
    }

    walk(ctx, childOverlays, obj[key], [...path, key], issues);
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
};
type Slicing = {
  rules?: string;
  ordered?: boolean;
  slices?: Record<string, SliceDef>;
};

/**
 * Merge slicing blocks across overlays on the same array element.
 * - `slices`: union (last write wins on same slice name; profile typically
 *   adds new slices on top of the base).
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
    for (const [name, def] of Object.entries(s.slices ?? {})) {
      (merged.slices as Record<string, SliceDef>)[name] = def;
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

/** Return slice names whose `match` pattern is satisfied by the item. */
function classifyItem(item: unknown, slicing: Slicing): string[] {
  const out: string[] = [];
  for (const [name, def] of Object.entries(slicing.slices ?? {})) {
    const effective = effectiveMatch(def);
    if (effective === undefined) continue;
    if (matchPattern(effective, item)) out.push(name);
  }
  return out;
}

/**
 * The slice's effective discriminator pattern. Falls back to
 * `{url: schema.url}` for the common FHIR extension-slicing convention
 * where the translator leaves `match: {}` because the URL lives in the
 * slice's element schema.
 */
function effectiveMatch(def: SliceDef): unknown | undefined {
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
  return undefined;
}

function walkArrayItems(
  ctx: ValidateContext,
  overlays: Overlay[],
  arr: unknown[],
  path: (string | number)[],
  issues: ValidationIssue[],
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
      walk(ctx, itemOverlays, arr[i], [...path, i], issues);
    }
    return;
  }

  const counts = new Map<string, number>();
  for (const name of Object.keys(slicing.slices ?? {})) counts.set(name, 0);

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
      walk(ctx, itemOverlays, item, [...path, i], issues);
      continue;
    }

    if (matched.length === 0) {
      if (slicing.rules === 'closed') {
        issues.push({
          code: FS.SLICE_NOT_MATCHED,
          path: [...path, i],
          expected: Object.keys(slicing.slices ?? {}),
        });
      }
      // open / openAtEnd: validate against base element only
      walk(ctx, itemOverlays, item, [...path, i], issues);
      continue;
    }

    // Exactly one slice — validate item with slice schema overlay on top.
    const name = matched[0] as string;
    counts.set(name, (counts.get(name) ?? 0) + 1);
    const slice = (slicing.slices as Record<string, SliceDef>)[name];
    const overlayed: Overlay[] = slice.schema
      ? [...itemOverlays, { el: slice.schema as FHIRSchemaElement, source: undefined }]
      : itemOverlays;
    walk(ctx, overlayed, item, [...path, i], issues);
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
): void {
  const refers = collectRefers(overlays);
  if (!refers) return;
  const ref = obj.reference;
  if (typeof ref !== 'string') return;
  const targetType = parseReferenceType(ref);
  if (!targetType) return;
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
