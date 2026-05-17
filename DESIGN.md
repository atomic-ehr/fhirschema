# FHIRSchema — Canonical Design Document

Single source of truth for the FHIRSchema TypeScript project. Replaces all
prior scattered specs.

> **Status.** Active. Mutate this file when intent changes. Implementation
> (`src/`) is the runtime authority; this document is the design authority.
>
> **Audience.** Implementers writing FHIRSchema in another language; contributors
> to this repo; profile authors who need to understand validator semantics.
>
> **Companion reading.**
> - [transcripts/transcript_04-02-2026.md](transcripts/transcript_04-02-2026.md) — design conversation, decisions taken
> - [transcripts/transcript_04-03-2026.md](transcripts/transcript_04-03-2026.md) — design conversation, validator-shape discussion
> - [spec/examples/](spec/examples/) — sample FHIRSchemas used in tests
> - [src/converter/](src/converter/) — translator implementation
> - [src/validator/](src/validator/) — validator implementation

---

## 1. Overview

FHIRSchema is an algorithm-friendly intermediate representation for FHIR
validation. It is **not** an end-user authoring format and **not** a
replacement for `StructureDefinition`. It is a deliberately denormalised IR
that mirrors the shape of FHIR data, so the validator can walk schema and
resource in lock-step.

The project ships two halves:

| Phase | Input | Output | Code |
|-------|-------|--------|------|
| **Translate** | `StructureDefinition` (one) | `FHIRSchema` (one) | [src/converter/](src/converter/) |
| **Validate** | `FHIRSchema[]` + resource + resolver | `ValidationIssue[]` | [src/validator/](src/validator/) |

The split is fundamental. The translator is a **pure function**; everything
that requires knowledge of *other* schemas (inheritance, type resolution,
slice classification) is deferred to the validator.

### 1.1 Why two halves

Three reasons, all from the design conversations:

1. **Different complexity profiles.** Translation is largely algorithmic
   reshape — flatten paths, group choice variants, split slicing. Validation
   is data-driven and needs the full schema set, terminology server, reference
   resolver, etc. Mixing them produced a bloated, hard-to-port system in the
   prior Clojure implementation.
2. **Snapshot-less validation.** A FHIRSchema is intentionally a fragment of
   information; cross-schema knowledge (base type elements, profile chains,
   slice discriminators that live on parents) is resolved **at validation
   time** through the `ctx.resolve(canonical)` callback. That keeps the
   translator pure and lets the runtime decide caching, lazy fetch, JIT
   compilation, etc.
3. **Portability.** Other-language implementations can reuse the test suite
   for each half independently. A test on the translator does not need a
   validator and vice versa.

### 1.2 What FHIRSchema is *not*

- Not a competing serialization format. Producers should still publish
  `StructureDefinition`. FHIRSchema is the internal IR a validator uses.
- Not a normalised "snapshot". A schema can reference its parent, and we
  resolve that at runtime — not at translate time.
- Not strict JSON Schema. It carries FHIR-specific concepts (slicing,
  `value[x]`, primitive extensions) directly.

---

## 2. Two-phase architecture

```
                  ┌──────────────────────┐
StructureDef ─►   │  translate(sd, ctx?) │   ─► FHIRSchema (one)
                  └──────────────────────┘
                            pure
                            stateless
                            single-input

                  ┌─────────────────────────────────────┐
FHIRSchema[]  ─►  │                                     │
resource      ─►  │ validate(ctx, schemas, data, opts?) │  ─► { valid, issues[] }
ValidateCtx   ─►  │                                     │
                  └─────────────────────────────────────┘
                            single-pass over data
                            cooperative across schemas
                            snapshot-less
```

The validator walks **data**, not schema; the schema's role is to expose
applicable rules at each data node.

---

## 3. Translator: `StructureDefinition` → `FHIRSchema`

Implementation: [src/converter/index.ts](src/converter/index.ts).

### 3.1 Contract

```ts
function translate(sd: StructureDefinition, ctx?: ConversionContext): FHIRSchema
```

- **Stateless.** No I/O, no caches, no peeking at other schemas. The optional
  `ctx` only carries package metadata (`{ package_meta }`) that gets copied
  through to the output header. Verified in [src/converter/index.ts:176-241](src/converter/index.ts#L176-L241).
- **Single-input.** Consumes one `StructureDefinition`. Inheritance from
  `baseDefinition` is **not** resolved here — it becomes `FHIRSchema.base`
  and is dereferenced by the validator.
- **Differential-only.** Reads `sd.differential.element`; `sd.snapshot` is
  ignored. If the input has no differential, the translator produces an
  empty schema body (header only).

### 3.2 Header mapping

`StructureDefinition` metadata maps to `FHIRSchema` header verbatim:

| StructureDefinition | FHIRSchema | Notes |
|---------------------|------------|-------|
| `name` | `name` | |
| `type` | `type` | |
| `url` | `url` | canonical identifier |
| `version` | `version` | |
| `description` | `description` | |
| `baseDefinition` | `base` | unless `type === 'Element'` (Element is the implicit root) |
| `kind` | `kind` | `resource` \| `complex-type` \| `primitive-type` \| `logical` |
| `derivation` | `derivation` | `specialization` \| `constraint` |
| `abstract` | `abstract` | only if true |
| package fields | passthrough | |

The output also gets a computed `class`:

- `profile` — when `kind === 'resource' && derivation === 'constraint'`
- `extension` — when `type === 'Extension'`
- otherwise — `kind` itself

### 3.3 Algorithm

The translator uses a stack-based walk of the differential element list. For
each element it (a) parses the dotted path into components, (b) compares it
to the previous element's path to emit `enter`/`exit`/`enter-slice`/`exit-slice`
actions, (c) transforms the element body into FHIRSchema fields, and
(d) applies the actions against a value stack whose bottom is the root
schema. After the loop a final "exit to root" closes any open scopes.

The four supporting modules:

- [path-parser.ts](src/converter/path-parser.ts) — parse element paths into
  `PathComponent[]`, enriched with slicing context inherited from previous
  paths
- [action-calculator.ts](src/converter/action-calculator.ts) — diff two paths
  to produce enter/exit actions
- [element-transformer.ts](src/converter/element-transformer.ts) — convert
  one `StructureDefinitionElement` to a `FHIRSchemaElement` body
- [stack-processor.ts](src/converter/stack-processor.ts) — apply actions to
  the stack, build nested structure, attach slices

Pseudocode:

```
function translate(sd):
  schema = header(sd)
  if sd.kind == "primitive-type": return schema   # see §3.5
  stack = [schema]
  prevPath = []
  for element in sd.differential.element where element.path includes "." :
    if isChoice(element):
      queue expanded variants; continue
    path = enrich(prevPath, parse(element.path))
    actions = diff(prevPath, path)
    stack = apply(stack, actions, transform(element))
    prevPath = path
  stack = apply(stack, diff(prevPath, []), {})
  assert stack.length == 1
  return normalize(stack[0])
```

### 3.4 Element-body mapping

| ElementDefinition | FHIRSchemaElement | Notes |
|-------------------|--------------------|-------|
| `type[0].code` | `type` | first-type fast path; multi-type → choice expansion (§3.6) |
| `min === 1` | parent's `required[]` adds name | required is hoisted to parent (JSON-schema style) |
| `max === '*'` or `max > 1` | `array: true` | scalar otherwise |
| `min > 0 && array` | `min: N` | array-cardinality |
| `max !== '*' && array` | `max: N` | array-cardinality |
| `type[0].targetProfile` | `refers: [canonical, ...]` | Reference targets |
| `pattern[X]` / `fixed[X]` | `pattern: { type: 'X', value }` | type prefix dropped |
| `binding` | `binding: { strength, valueSet, bindingName? }` | |
| `constraint[]` | `constraint: { [key]: {expression, human, severity} }` | xpath dropped |
| `contentReference: "#X.y"` | `elementReference: ["X","elements","y"]` | |
| `mustSupport`, `isModifier`, `isSummary` | passthrough | |

### 3.5 Primitives

`StructureDefinition`s with `kind: "primitive-type"` are translated to a
**header-only** schema (no elements, no body). FHIR primitive semantics are
**hard-coded** in the validator (§5). Rationale from the design conversations:

- The set of FHIR primitives is closed (the spec controls it).
- Their lexical rules are simple and faster as hand-written checks than as
  generic regex-driven schema rules.
- FHIR's own regex definitions are inconsistent across versions and often
  wrong; we deliberately do not honour them.

The translator may **warn** if it encounters a `kind: primitive-type` SD for
a primitive that is not in our hardcoded set (it is then unknown to the
validator). User-defined primitives are not supported.

### 3.6 Choice elements (`value[x]`)

When an element ends in `[x]` (FHIR polymorphic field), the translator:

1. Expands it into one element per type, suffix lowercase-capitalised:
   `value[x]` with types `[string, integer]` → `valueString`, `valueInteger`.
2. Adds a parent **virtual** element `value` carrying `choices: ["valueString","valueInteger"]`.
3. Each variant element carries `choiceOf: "value"`.

The validator (§9) enforces that at most one variant is present and that the
variant key is in `choices`.

### 3.7 Slicing

Slicing on an array element is normalised into a structured `slicing` block
on that element. See §10.

### 3.8 Extensions

A slice on the `extension` element keyed by URL is *additionally* materialised
as a convenience map `extensions: { [url]: FHIRSchemaElement }` on the parent.
The full slicing block is preserved for completeness; validators may choose
the cheaper `extensions` lookup. See §10.2.

### 3.9 Content references

`contentReference: "#Bundle.entry"` becomes `elementReference: ["Bundle","elements","entry"]`.
The validator resolves at validation time.

### 3.10 What the translator does NOT do

- ❌ Resolve `baseDefinition` (kept as `base`).
- ❌ Resolve type references (kept as `type` string).
- ❌ Build a snapshot.
- ❌ Validate the FHIRPath in `constraint[].expression`.
- ❌ Validate `valueSet` URLs in `binding`.
- ❌ Honour primitive-type `StructureDefinition`s.
- ❌ Detect cycles or contradictions across multiple SDs.

These are all validator-time concerns (or out of scope entirely).

---

## 4. FHIRSchema (the IR)

This section is descriptive. Authoritative TypeScript shape: [src/types.ts](src/types.ts)
and [src/converter/types.ts](src/converter/types.ts).

### 4.1 Top-level

```ts
interface FHIRSchema {
  // identification
  url: string
  version?: string
  name: string
  type: string

  // kind / classification
  kind: 'resource' | 'complex-type' | 'primitive-type' | 'logical'
  derivation?: 'specialization' | 'constraint'
  base?: string                   // canonical of parent schema
  abstract?: boolean
  class: 'resource' | 'complex-type' | 'primitive-type'
       | 'logical' | 'profile' | 'extension'

  // body
  elements?: Record<string, FHIRSchemaElement>
  required?: string[]
  excluded?: string[]
  extensions?: Record<string, FHIRSchemaElement>  // url-keyed sugar
  constraint?: Record<string, Constraint>

  // package metadata (translator passthrough)
  description?: string
  package_name?: string
  package_version?: string
  package_id?: string
  package_meta?: PackageMeta
}
```

The shape mirrors how the validator iterates over data: an object node has
named children under `elements`, a required set listed at the parent level,
constraints at the parent level too.

### 4.2 Element

```ts
interface FHIRSchemaElement {
  // type
  type?: string                   // FHIR type name; resolved at runtime
  array?: boolean

  // cardinality
  min?: number
  max?: number

  // nesting
  elements?: Record<string, FHIRSchemaElement>
  required?: string[]
  excluded?: string[]
  extensions?: Record<string, FHIRSchemaElement>

  // references
  refers?: string[]               // canonical URLs for Reference targets
  elementReference?: string[]     // navigation path to another element def

  // polymorphism
  choiceOf?: string               // 'value' for valueString
  choices?: string[]              // ['valueString','valueInteger']

  // patterns and bindings
  pattern?: { type: string; value: unknown }
  binding?: { strength: 'required'|'extensible'|'preferred'|'example'
              valueSet?: string; bindingName?: string }

  // constraints
  constraint?: Record<string, { expression: string; human: string;
                                severity: 'error'|'warning' }>

  // slicing (on array elements)
  slicing?: Slicing

  // extension definition fields
  url?: string                    // for extension definitions

  // FHIR flags
  mustSupport?: boolean
  isModifier?: boolean
  isModifierReason?: string
  isSummary?: boolean
}
```

### 4.3 Slicing block

```ts
interface Slicing {
  discriminator?: { type: 'value'|'pattern'|'type'|'profile'|'exists'
                    path: string }[]
  rules?: 'open' | 'closed' | 'openAtEnd'
  ordered?: boolean
  slices: Record<string, {
    match?: unknown               // deep-partial pattern (or { type }, { profile })
    schema?: FHIRSchemaElement    // overlay applied to items in this slice
    min?: number
    max?: number
  }>
}
```

Match semantics in §10.

### 4.4 Why this shape (vs alternatives)

- **Shape isomorphic to data.** A FHIR JSON resource is an object with named
  keys; a FHIRSchema's `elements` is a map by the same keys. The validator
  walks them together with no shape transform.
- **`required` hoisted to parent.** Same trick JSON Schema uses. The decision
  about whether a key is required belongs to the **container** scope, not to
  each element rule. Mirroring data shape requires this hoist.
- **`array` is a leaf flag.** Arrays multiply rules but don't reshape the
  scope — array-cardinality rules live on the element itself, item-rules on
  the element after stripping `array`.
- **`pattern.value` carries its own `type`.** Necessary because the original
  `pattern[X]` carries type in the key suffix; once we drop the suffix we have
  to record the type explicitly.

---

## 5. Validator: data-driven, single-pass

Implementation: [src/validator/index.ts](src/validator/index.ts).

### 5.1 Contract

```ts
function validate(
  ctx: ValidateContext,
  schemas: InputSchema[],
  data: unknown,
  options?: ValidateOptions,
): ValidationResult
```

`ValidateContext`:

```ts
interface ValidateContext {
  resolve(ref: string): FHIRSchema | undefined
}
```

`InputSchema` is `FHIRSchema & { additionalProfiles?: string[] }`. A caller
provides one or more schemas; each may declare `base` (single canonical
parent) and/or `additionalProfiles` (extra schemas merged in, modelling the
FHIR `additionalProfile` extension).

`ValidateOptions`:

```ts
interface ValidateOptions {
  strict?: boolean   // default false
}
```

- `strict: false` (default) — unresolved `data.resourceType` or
  `data.meta.profile[]` entries fall back silently to whatever is in the
  SchemaSet. Matches reference validators' permissive default.
- `strict: true` — both emit `fs701` profile-not-found. Use in pipelines
  that demand declared profiles to be loaded.
- `fhirpath?: FhirpathEvaluator` — pluggable FHIRPath engine for
  `constraint.expression` evaluation. If absent, all constraints are
  silently skipped (deferred-validation pattern). Wire HL7 fhirpath.js
  via a 1-line adapter:
  ```ts
  import fhirpath from 'fhirpath';
  validate(ctx, schemas, data, {
    fhirpath: { evaluate: (expr, root) => fhirpath.evaluate(root, expr) }
  });
  ```
- `terminology?: TerminologyEvaluator` — pluggable value-set check.
  Returns `'in' | 'not-in' | 'unknown'`. fs50x emitted per binding
  strength (required→fs501 error; extensible→fs503 warning; preferred→
  fs502 warning; example→never).
- `referenceResolver?: ReferenceResolver` — pluggable Reference target
  existence check. Returns `'resolved' | 'unresolved' | 'unknown'`.
  fs1002 (warning) on `unresolved`. Fragment (`#x`) and `urn:` refs are
  not passed to the resolver.

`ValidationResult`:

```ts
interface ValidationResult {
  valid: boolean                  // == issues.every(severity!='error')
  issues: ValidationIssue[]
}
interface ValidationIssue {
  code: string                    // 'fs101' etc, see §13
  severity: 'error' | 'warning' | 'information'
  path: (string | number)[]       // data path
  schemaPath?: (string | number)[] // path inside the schema that fired
  schema?: string                 // source canonical URL
  message?: string                // human-readable, not machine-parsed
  expected?: unknown
  got?: unknown
}
```

### 5.2 Cooperative validation (SchemaSet)

At every data node the validator carries a **set of overlays** — one per
schema currently in scope. An element is "known" if **any** overlay in the
set describes it. Required, min/max etc. are unions/intersections across
overlays (§5.4). This is core: we never validate against a single schema,
always against a set.

This is what makes inheritance, profiles, and `additionalProfiles` cooperate
without requiring snapshot construction.

### 5.3 Walk

```
walk(value, overlays, path):
  if value is array:
    if no overlay says array=true:        emit fs203 (expected scalar)
    enforce array cardinality (fs302/303)
    itemOverlays = strip array on each overlay
    for i, item in value: walk(item, itemOverlays, path + i)
    return

  if any overlay says array=true and value is scalar/object:
                                          emit fs203 (expected array)
    return

  type = first overlay-declared type
  if type is FHIR primitive:              validatePrimitive(value, type)
  elif value is object:                   walkObject(value, overlays, path)
  else if type is complex:                emit fs202 (expected object)

walkObject(obj, overlays, path):
  # bring in element-defs from the type that each overlay points to
  expanded = overlays + resolveTypes(overlays via ctx)

  required = ⋃ overlay.required across `expanded`
  for r in required:
    if r not in obj and "_" + r not in obj:    emit fs301

  for key in obj:
    if key starts with "_":              handle primitive extension (§7)
    childOverlays = [o.elements[key] for o in expanded if defined]
    if childOverlays empty:               emit fs201 (unknown element)
    else: walk(obj[key], childOverlays, path + key)
```

### 5.4 "Tightest" semantics across overlays

When multiple overlays describe the same scope:

| Field | Combiner | Why |
|-------|----------|-----|
| `required` | union | any overlay can demand a field |
| `excluded` | union | any overlay can forbid a field |
| `min` (cardinality) | maximum | the strictest minimum wins |
| `max` (cardinality) | minimum | the strictest maximum wins |
| `type` | first declared | type can be narrowed but not widened; we accept any declaration |
| `pattern` | all must match | every overlay's pattern must hold |
| `binding` | strongest strength wins | required > extensible > preferred > example |

If the union/intersection is *empty* (e.g. `min: 5` ∩ `max: 3`) the schema
itself is contradictory — we still report data violations against both
bounds; spotting the contradiction at schema-validation time is out of scope.

### 5.5 Iterate over data, not schema

The walk is keyed by data keys. If a profile declares `Patient.contact.name`
as required but the resource omits `contact` entirely, we will *not* descend
into `name` — instead we emit `fs301` at `Patient.contact`. This is by
design: an empty resource validates against a 200-element profile in O(1).

### 5.6 Pseudo-contract: `validate` returns

```
issues = []
overlays = []
for s in schemas:
  walkBaseChain(s, ctx, overlays)
  for ap in s.additionalProfiles ?? []:
    walkBaseChain(ctx.resolve(ap), ctx, overlays)

if overlays empty: return { valid: true, issues: [] }

walkObject(data, overlays, [])

return { valid: issues.every(i => i.severity != 'error'), issues }
```

`walkBaseChain` recursively follows `schema.base` via `ctx.resolve`, pushing
each ancestor's body into the overlay list. Unresolved bases emit `fs701`.

---

## 6. Primitives

FHIR R6 primitive set is **hardcoded**. The translator silently drops
`kind: primitive-type` `StructureDefinition`s; the validator never consults
them.

The primitive tree, as the validator sees it:

```
JSON boolean
  └── boolean

JSON number
  ├── integer (int32: -2147483648..2147483647)
  │   ├── unsignedInt (>= 0)
  │   └── positiveInt (> 0)
  └── decimal

JSON string
  ├── string                    (non-empty, non-whitespace)
  │   └── markdown              (same as string)
  ├── code                      (no leading/trailing whitespace; single-space separators)
  ├── id                        ([A-Za-z0-9-.]{1,64})
  ├── uri                       (RFC 3986)
  │   ├── url                   (absolute)
  │   ├── canonical             (uri + optional |version)
  │   ├── oid                   (urn:oid:...)
  │   └── uuid                  (urn:uuid:...)
  ├── base64Binary
  ├── date                      (yyyy / yyyy-mm / yyyy-mm-dd)
  ├── dateTime                  (date + optional time + optional tz)
  ├── instant                   (full dateTime + required tz)
  ├── time                      (hh:mm:ss, no tz)
  ├── integer64                 (64-bit int serialised as STRING)
  └── xhtml                     (XHTML narrative)
```

### 6.1 No-empty rule

FHIR forbids empty primitives. The validator enforces three flavours of this
rule **inline**, replacing the equivalent FHIR FHIRPath invariants that the
translator strips:

- empty strings (`""`) → `fs117`
- empty objects (no meaningful keys) → `fs202` with `expected: 'non-empty-object'`
- empty arrays (`[]`) → `fs303` if `min > 0`, otherwise allowed only as
  "field omitted" which idiomatic FHIR producers should avoid

The translator should drop `constraint`s on `Element`/`BackboneElement` that
encode this same rule (e.g. `ele-1`) to avoid double-firing. See §14.

### 6.2 Two-level validation

1. JSON type check (`fs101..103`) — wrong JSON type for the declared FHIR
   primitive
2. Literal check (`fs104..123`) — wrong format for the JSON value

We always emit the most specific code; if JSON type is wrong we never run
the literal check.

### 6.3 Why not honour the FHIR primitive `StructureDefinition`s

From the design conversation:

> "FHIR-defined regexes are inconsistent across versions and frankly often
> wrong. Their `system` types vs primitive types are not equivalent. Their
> constraint expressions on every primitive are not perf-friendly to
> interpret via FHIRPath. So we own the primitive semantics."

User-defined primitives (profiles that declare `kind: primitive-type` for a
new code) are **not** supported. This is a design boundary.

---

## 7. Primitive extensions (`_field`)

In FHIR JSON, primitive metadata (id, extensions) lives in a sibling field
prefixed with `_`. The validator pairs `field` and `_field` in one pass:

| Form | Meaning |
|------|---------|
| `birthDate: "1970-01-01"` | primitive value only |
| `birthDate: "1970-01-01"`, `_birthDate: { extension: [...] }` | value + metadata |
| `_birthDate: { extension: [...] }` (no `birthDate`) | metadata only, value omitted |
| `name: ["John", null]`, `_name: [null, {extension:[...]}]` | array form: `_name[i]` aligned with `name[i]`; nulls are placeholders |

Rules:

- `_field` is only valid when `field`'s declared type is primitive
  (otherwise `fs401`).
- In array form `_field` and `field` must have equal length; misalignment
  is `fs402`.
- The validator descends into `_field`'s contents (id, extension) under the
  same element rules — the `_field` payload is an `Element` (id + extension).

---

## 8. Arrays and cardinality

A field with `array: true` in any overlay is an array field. The shape rule
is strict (FHIR JSON does not single-collapse arrays):

- `array: true`, value is scalar → `fs203` (expected array)
- `array: false` (or omitted), value is array → `fs203` (expected scalar)

Cardinality lives on the element. After the array/scalar check:

- `arr.length < tightest_min` → `fs303`
- `arr.length > tightest_max` → `fs302`

Each item is then validated as if it had `array: false` (we strip `array`
in the overlay before recursing).

---

## 9. Polymorphic elements (`value[x]`)

Choice elements are encoded as N sibling concrete elements + one virtual
parent carrying `choices: [...]`. The validator enforces:

- At most one of the `choices` keys may be present (`fs802`).
- The present key must be in `choices` (otherwise `fs201` — unknown element
  — fires naturally because no overlay describes that key).
- If the parent has `min: 1`, exactly one must be present (`fs301`).
- The **literal** virtual parent key (e.g. `value`, `deceased`) is **not a
  valid FHIR JSON field** — only the concrete variants are. Data that
  contains the literal key (`{deceased: ...}`) emits `fs201` at the
  literal-key path. Implementation: `findChildOverlays` skips overlay
  element-defs whose `choices` array is set, so the virtual parent is
  invisible to data-key resolution (it remains visible to the choice-group
  collector — see §9.1, §9.2).

### 9.1 Constraining choices in profiles

A profile that narrows `value[x]` from 10 types to 2:

```jsonc
{
  "elements": {
    "value": { "choices": ["valueString","valueInteger"] }
  }
}
```

is enforced by the **intersection** of `choices` across overlays: a variant
key is allowed only if every overlay that declares `choices` includes it.
This is the only place the validator intersects sets (everywhere else we
union); the rationale is that a profile can only **narrow** polymorphic
options. A present variant that fails the intersection emits `fs801`
invalid-choice-type.

### 9.2 Required choice satisfaction

If the virtual parent (e.g. `value`) is in `required[]`, it is satisfied by
the presence of **any** variant key (`valueString`, `_valueString` for
extension-only, etc.). A bare `required: ['value']` test against the
literal `value` key would always fail — there's no `value` field in FHIR
JSON, only its concrete variants.

### 9.3 Profiles constraining a specific variant

Profiles can attach element rules directly to a concrete variant:

```jsonc
{ "elements": { "valueQuantity": { "type": "Quantity", "elements": { ... } } } }
```

This is just normal validation of that element name; nothing choice-specific.

---

## 10. Slicing

Three kinds, all using the same machinery but with different motivating
cases:

| Kind | Where | Discriminator (typically) |
|------|-------|---------------------------|
| **Collection slicing** | array of items with shared shape | a child field's value/pattern |
| **Extension slicing** | `extension[]` array | `url` |
| **Choice slicing** | `value[x]` (already split — rare) | item `type` |

Slicing **partitions** an array by routing each item into a named slice via
the slice's `match` pattern, then enforces per-slice cardinality and
applies the slice's `schema` as an overlay for items in that slice.

### 10.1 Matching

Slice `match` is a **deep-partial pattern**:

- **Object** — every key in `match` must deep-match in the item.
- **Array** — every element in `match` must be matched (deep-equal) by at
  least one element of the item's array. Order-insensitive subset check.
- **Primitive** — strict equality.

Special `match` shapes:

- `{ $this: <value> }` — match the whole item against the value.
- `{ type: "Quantity" }` — match by FHIR type name (for choice slicing).
- `{ profile: ["canonical-URL", ...] }` — match by `meta.profile` declaration.

The `discriminator` array in `slicing` is **documentation** of intent; the
classifier uses `match` exclusively. Discriminators may inform tooling
(profile editors) but are not consulted by the validator.

### 10.2 Extension slicing sugar

The translator also writes a flat `extensions` map keyed by URL for the
`extension` element specifically:

```jsonc
{
  "elements": {
    "extension": {
      "array": true,
      "slicing": { /* full slicing block */ },
      "extensions": {                          // sugar derived from slicing
        "http://.../us-core-race": { "url": "...", "max": 1 },
        "http://.../us-core-ethnicity": { "url": "...", "max": 1 }
      }
    }
  }
}
```

The validator can take either path — both must agree.

### 10.3 `@default` slice (fallback overlay)

A slice named `@default` is a catch-all overlay for items that didn't match
any other slice. It has no `match` pattern of its own — selection is by
exhaustion. Behavior:

- Items matching no other slice are validated against the base element
  schema **plus** `@default.schema` (if defined). Internal constraint
  violations fire normally (fs301, fs101, etc.).
- The `@default` slice suppresses `fs901` even when `rules: closed`:
  unmatched items are routed to `@default` instead of erroring.
- `@default` is **not** counted toward other slices' cardinality. Its own
  `min`/`max` (if specified) apply normally via `fs902`.

### 10.4 Algorithm

For each array element with `slicing`:

```
1. Merge slicing across overlays (slices map, rules, ordered).
2. For each item at index i:
     a. Test the item against each slice's match (excluding @default).
     b. >1 match → fs901 (ambiguous slice).
     c. 0 matches:
          if @default present → validate with (base ⊕ @default.schema);
                                increment @default counter
          else rules: closed  → fs901 (unmatched item) + validate base
          else rules: open    → validate against the base element schema only
          else rules: openAtEnd → as `open`, plus position check (TODO)
     d. 1 match: validate item with (base element schema) ⊕ (slice schema).
        Increment slice's counter.
        If ordered=true: slice index must be >= max index seen → else fs903.
3. After all items: for each slice, if count < min or count > max → fs902.
```

### 10.4 Reslicing

A slice's `schema.elements[...]` may itself contain a `slicing` block. The
algorithm is recursive — slice classification on the inner array uses the
same matching rules. No special data structure needed; nested `slicing`
falls out naturally.

### 10.5 Inheritance of slicing

A profile can introduce new slices on an inherited element. The slice map
is **unioned** across overlays: a slice defined in the parent and a new
slice defined in the child both apply. A slice with the same name as a
parent slice **overrides** it (last-write-wins on the slice schema; min/max
take the tightest bound as in §5.4).

---

## 11. Inheritance and the SchemaSet

A FHIRSchema has at most one `base` (canonical of its parent) and optionally
`additionalProfiles` (set of canonicals merged in for validation purposes).
The validator at the start:

1. For each input schema, walks `base` recursively, accumulating overlays.
2. For each `additionalProfiles[i]`, resolves and walks similarly.
3. All overlays form the root SchemaSet.

At each descent into `elements[<key>]`, the SchemaSet for the child is the
collection of `elements[<key>]` defs from each parent overlay, plus — if the
child has a complex `type` — the resolved type's overlays (recursively).

```
HumanName overlay  ─┐
                    ├─► validating Patient.name
US Patient overlay ─┤
Patient overlay    ─┘
```

Unresolved `base`/`type` produce `fs701` / unresolved-type and validation
continues without that overlay.

### 11.1 No snapshot, ever

We do **not** materialise a merged effective schema. Two reasons:

- **Memory.** A profile chain × N concrete resources blows up if each
  resource type carries its own snapshot.
- **Lazy resolution.** Some references (`additionalProfiles`, type
  references) are most cheaply resolved on the first relevant data node.

A future implementation may JIT-compile a merged form per (schema-set, data
shape) pair — that's an optimisation, not part of the design contract.

### 11.2 `meta.profile` driven resolution

Two data-driven hooks at `validate()` entry:

1. **`data.resourceType`** — if the value is a string, the validator calls
   `ctx.resolve(resourceType)` and pushes the result (with its `base` chain)
   onto the SchemaSet. This lets callers validate `{resourceType: 'Patient', ...}`
   without explicitly passing the Patient FHIRSchema.
2. **`data.meta.profile[]`** — each canonical is resolved and added the same
   way. Unresolvable canonicals emit `fs701` at path `[meta, profile]`.

If neither resolves and no schemas were passed in `schemas[]`, the validator
returns `{ valid: true, issues: [] }` silently — matching the
`without-strict-mode` behavior of the reference validators (sansara
`unknown-schemas-test`). The `options.strict: true` flag (see §5.1) flips
both unresolved-`resourceType` and unresolved-`meta.profile` into hard
`fs701` errors.

### 11.3 Inner-resource walk

A nested object that carries its own `resourceType` (Bundle.entry.resource,
Patient.contained[], Parameters.parameter.resource, ...) is re-validated
**as if it were the root**: a fresh `validate(ctx, [], item)` is invoked
recursively from `walkObject`, and the resulting issues are path-prefixed
with the outer path. The outer schema's overlays do **not** apply to the
inner resource — a contained DiagnosticReport is validated against
DiagnosticReport, not against Patient.contained's element-def.

Idempotent across nesting depth (contained inside contained, Bundle in
Bundle). Fall-through: if `ctx.resolve(resourceType)` returns nothing, the
outer walk continues normally — unknown resource types don't trigger a
sub-walk (matches sansara's non-strict default).

---

## 12. References and terminology (deferred)

The pure validator does **not** make I/O calls. It surfaces work that
requires external lookups:

```ts
interface Deferred {
  type: 'terminology' | 'reference'
  path: (string | number)[]
  // type === 'terminology':
  code?: string; system?: string; valueSet?: string
  strength?: 'required'|'extensible'|'preferred'|'example'
  // type === 'reference':
  reference?: string; targetProfiles?: string[]
}
```

The caller batches and resolves these against a terminology service /
reference resolver, then merges results back. This separation is from the
prior implementation and remains in the design, though deferred plumbing is
not yet wired into the current validator (§15).

---

## 13. Error code registry

Validator returns `ValidationIssue[]`; empty array means success.

```ts
interface ValidationIssue {
  code: string          // e.g. "fs101"
  severity: 'error' | 'warning' | 'information'
  path: (string|number)[]
  schemaPath?: (string|number)[]
  schema?: string
  message?: string
  expected?: unknown
  got?: unknown
}
```

Codes follow `fsNNN`, grouped by range:

| Range  | Category               | Description                                    |
|--------|------------------------|------------------------------------------------|
| fs1xx  | Primitive              | JSON type checks and literal validation        |
| fs2xx  | Structure              | JSON shape: expected object/array/scalar       |
| fs3xx  | Cardinality            | min/max element count                          |
| fs4xx  | Primitive extensions   | `_field` semantics, array alignment            |
| fs5xx  | Terminology            | ValueSet bindings, code validation             |
| fs6xx  | Constraints            | FHIRPath invariants                            |
| fs7xx  | Profiles               | Inheritance, profile resolution                |
| fs8xx  | Choice types           | Polymorphic `value[x]` elements                |
| fs9xx  | Slicing                | Discriminator matching, slice cardinality      |
| fs10xx | References             | Reference type, resolution (deferred)          |
| fs11xx | Extensions             | Unknown / modifier extensions                  |

### fs1xx — Primitive

JSON type checks:

| Code  | Name              | Severity | Description |
|-------|-------------------|----------|-------------|
| fs101 | expected-string   | error    | Expected JSON string, got number or boolean |
| fs102 | expected-number   | error    | Expected JSON number, got string or boolean |
| fs103 | expected-boolean  | error    | Expected JSON boolean, got string or number |

Literal validation (JSON type correct, value invalid):

| Code  | Name                 | Description |
|-------|----------------------|-------------|
| fs104 | invalid-base64       | Invalid base64 encoding |
| fs105 | invalid-canonical    | Invalid canonical URL |
| fs106 | invalid-code         | Code with leading/trailing/inner-multi whitespace, or empty |
| fs107 | invalid-date         | Does not match `yyyy[-mm[-dd]]` or impossible calendar date |
| fs108 | invalid-datetime     | Invalid dateTime literal |
| fs109 | invalid-decimal      | Invalid decimal literal |
| fs110 | invalid-id           | Does not match `[A-Za-z0-9\-.]{1,64}` |
| fs111 | invalid-instant      | Invalid instant (must include timezone) |
| fs112 | invalid-integer      | Not a whole number or outside int32 |
| fs113 | invalid-integer64    | Invalid 64-bit integer string |
| fs114 | invalid-markdown     | Empty / whitespace-only |
| fs115 | invalid-oid          | Does not match `urn:oid:...` |
| fs116 | invalid-positive-int | Integer not > 0 |
| fs117 | invalid-string       | Empty / whitespace-only |
| fs118 | invalid-time         | Invalid `hh:mm:ss`, no tz |
| fs119 | invalid-unsigned-int | Integer not >= 0 |
| fs120 | invalid-uri          | Invalid URI |
| fs121 | invalid-url          | Invalid URL (must be absolute) |
| fs122 | invalid-uuid         | Does not match `urn:uuid:...` |
| fs123 | invalid-xhtml        | Invalid XHTML narrative |

### fs2xx — Structure

| Code  | Name              | Description |
|-------|-------------------|-------------|
| fs201 | unknown-element   | Field not declared in any overlay |
| fs202 | expected-object   | Expected `{}`, got scalar or array |
| fs203 | expected-array    | Expected `[]`, got object or scalar (or reverse: expected scalar got array) |
| fs204 | expected-primitive| Expected JSON primitive, got object or array |
| fs205 | pattern-mismatch  | `pattern[X]` value not satisfied (deep-partial match) |
| fs206 | fixed-mismatch    | `fixed[X]` value not satisfied (exact equality) |
| fs207 | excluded-element  | Field prohibited by `excluded[]` (from `max: "0"` in profile) is present in data |

### fs3xx — Cardinality

| Code  | Name      | Description |
|-------|-----------|-------------|
| fs301 | required  | Required element missing |
| fs302 | too-many  | Array length > max |
| fs303 | too-few   | Array length < min |

### fs4xx — Primitive extensions

| Code  | Name                        | Description |
|-------|-----------------------------|-------------|
| fs401 | invalid-primitive-extension | `_field` on a non-primitive element |
| fs402 | misaligned-arrays           | `_field[]` length != `field[]` length |

### fs5xx — Terminology

| Code  | Name                     | Severity | Description |
|-------|--------------------------|----------|-------------|
| fs501 | invalid-code-for-binding | error    | Code not in required value set |
| fs502 | code-not-in-preferred    | warning  | Code not in preferred value set |
| fs503 | code-not-in-extensible   | warning  | Code not in extensible value set |
| fs904 | unmatched-not-at-end     | error    | `rules: openAtEnd` violated: matched item appears after an unmatched one |

### fs6xx — Constraints

| Code  | Name               | Severity      | Description |
|-------|--------------------|---------------|-------------|
| fs601 | invariant-violated | error/warning | FHIRPath constraint false (severity from definition) |

### fs7xx — Profiles

| Code  | Name              | Description |
|-------|-------------------|-------------|
| fs701 | profile-not-found | Referenced profile/base URL not resolvable |
| fs702 | profile-violation | Data does not conform to declared profile |

### fs8xx — Choice types

| Code  | Name                   | Description |
|-------|------------------------|-------------|
| fs801 | invalid-choice-type    | Type not in allowed list for `value[x]` |
| fs802 | multiple-choice-values | More than one variant present |

### fs9xx — Slicing

| Code  | Name              | Description |
|-------|-------------------|-------------|
| fs901 | slice-not-matched | Item matched zero (closed) or multiple slices |
| fs902 | slice-cardinality | Per-slice min/max violated |
| fs903 | slice-out-of-order | `slicing.ordered: true` violated — item appears before its declared slice |

### fs10xx — References (deferred)

| Code   | Name                   | Severity | Description                                                       |
|--------|------------------------|----------|-------------------------------------------------------------------|
| fs1001 | invalid-reference-type | error    | Reference targets a disallowed resource type                      |
| fs1002 | unresolved-reference   | warning  | Reference target could not be resolved                            |
| fs1003 | fullurl-not-absolute   | error    | `Bundle.entry.fullUrl` is not an absolute URL or `urn:` reference |

### fs11xx — Extensions

| Code   | Name                              | Severity | Description |
|--------|-----------------------------------|----------|-------------|
| fs1101 | unknown-extension                 | warning  | Extension URL not recognised |
| fs1102 | modifier-extension-not-understood | error    | `modifierExtension` must be understood |

### 13.1 Stability rules

- Codes are **stable identifiers**. Once assigned, never renamed or
  repurposed. Adding new codes within an existing range is allowed.
- Messages may change (wording, i18n). **Tests assert on `code` + `path`**,
  never on `message`.
- This format is the validator's own; a trivial mapper to
  `OperationOutcome.issue` may be provided separately. We deliberately do
  not adopt `OperationOutcome.issue.code` (~30 coarse codes, too vague for
  programmatic use).

---

## 14. Design principles & decisions

A consolidated list of the load-bearing decisions, collected from the
transcripts and the prior design notes. Each is a hard rule for the
implementation.

1. **Translator is stateless.** No I/O, no caches, no peeking at other
   schemas. Inheritance, type resolution, snapshot are validator-time
   concerns.
2. **Validator is snapshot-less.** Inheritance and type resolution happen
   at validation time via `ctx.resolve(canonical)`. A JIT compiler may
   produce a merged form for hot paths; the merged form is not part of the
   data contract.
3. **Iterate over data, not schema.** An empty resource validates in O(1)
   regardless of schema size. Required-checks live at parent scope, so they
   still fire when their containing object is present.
4. **Schema shape mirrors data shape.** A schema for an object is an object
   whose `elements` map mirrors the resource's keys. No implicit shape
   transformation at validation time.
5. **Cooperative validation against a SchemaSet.** We always validate
   against a set of overlays, never a single schema. A key is known if any
   overlay describes it; `required` unions; `min/max` tighten.
6. **Primitives are FHIR R6, hardcoded.** Translator drops primitive
   `StructureDefinition`s; user-defined primitives are not supported. We do
   not honour FHIR's primitive `regex` (often broken or inconsistent across
   versions).
7. **FHIR's "no empty values" rule is baked into the validator.** Empty
   strings (`""`), empty objects, and empty arrays with `min>0` all error.
   Translator strips the equivalent FHIRPath constraints (e.g. `ele-1`).
8. **Primitive extensions paired in one pass.** `field` and `_field` are
   matched up while walking; `_field` on non-primitive errors as `fs401`.
9. **No XML.** The IR and validator are JSON-shaped. FHIR's XML side leaks
   schizophrenia (everything-is-an-array, attribute vs element) we refuse
   to inherit. XML producers must convert to JSON first.
10. **Error codes, not messages.** Codes are stable identifiers. Tests
    assert on `code` + `path`. Messages are human-readable, never parsed.
11. **Slicing uses `match`, not `discriminator`, for classification.**
    `discriminator` documents intent for tooling; `match` is the source of
    truth used by the classifier. The translator normalises both into
    `match`.
12. **Three flavours of slicing, one mechanism.** Collection, extension,
    and choice slicing share the partition-by-match algorithm. Special
    cases live in the *match-pattern shapes* (`{type:...}`, `{profile:...}`),
    not in the engine.
13. **Bunless: Bun is the runtime and test runner.** Tests use
    `bun:test`, files run with `bun run`. TypeScript is checked with
    `bunx tsc --noEmit`.
14. **No dependencies in core.** Translator + validator have no runtime
    deps beyond the FHIR types. Terminology, reference, FHIRPath are
    pluggable.
15. **Two test suites.** Translator tests (golden + unit) and validator
    tests (semantic, one rule at a time) are independent and reusable for
    other-language implementations.
16. **Unit > integration.** Validator tests are hand-written micro-cases
    (one schema, one resource, one or two assertions). Big real-world
    profiles are reserved for integration smoke tests later, not the core
    suite.

---

## 15. Out of scope / known gaps

Not yet implemented in [src/validator/index.ts](src/validator/index.ts), in
priority order:

- **Slicing — extensions sugar.** Core slicing flavors all work
  (open/closed/openAtEnd, ordered, @default, reslicing, deep-partial
  match, per-slice cardinality, slice schema overlays). The
  `extensions: { [url]: ... }` convenience map (sibling to `slicing`) is
  still TODO — validator currently uses the full `slicing` block for
  extension URL routing.
- **Constraint context variables.** Pluggable FHIRPath engine doesn't yet
  receive `%resource`, `%context` env. Some real-world R4 invariants (dom-3,
  dom-4) reference them and may fire spuriously at root scope; affected
  sansara cases are `skip: true` with explicit notes in
  test/cases/validator/constraints.yaml.
- **OperationOutcome adapter.** Caller-side adapter from `ValidationIssue[]`
  to `OperationOutcome` for FHIR-facing APIs.
- **Permissive JSON shape (Java parity).** The HL7 Java reference
  validator is permissive by default on certain JSON-shape questions
  (e.g. accepts a scalar where a `0..*` element requires an array; turns
  it into "must be JSON Array" only under the `fmt` module). We chose
  **spec-strict by default** (`fs203` expected-array fires
  unconditionally). If/when we need parity with Java's permissive default
  — e.g. for FHIR-server compatibility against real-world clients that
  emit scalars — the validator can grow an opt-in flag
  `options.permissiveArrayShape: true` (symmetric to `options.strict`).
  Until then, Graham tests that depend on Java's permissive scalar
  acceptance are skipped with explicit notes
  (see [test/cases/imports/GRAHAM.md](test/cases/imports/GRAHAM.md) →
  "Java permissive defaults").

- **Extension-only primitive with required binding.** A primitive field
  with `binding.strength: required` cannot be satisfied by `_field`
  alone (data-absent-reason pattern) — the code MUST be present. Per
  chat.fhir.org consensus: Grahame Grieve ("not if there's a required
  binding"), Elliot Silver ("for a code-type element with a required
  binding, no"), Lloyd McKenzie. This is a **static schema check** in
  `walkObject`'s shadow-handling branch: when a `_field` is encountered
  with no corresponding value, we look up the field's binding and emit
  `fs501` if strength is `required` (no terminology engine required —
  the rule is purely about value presence). Sansara takes the
  permissive interpretation here (extension-only satisfies because its
  binding check is value-driven); we diverge for spec compliance. See
  `test/cases/validator/real-resources.yaml` ("ServiceRequest with
  primitive extension on status/intent") and `graham-r4-bad.yaml`
  (allergy `_category`).

The current implementation also uses placeholder error codes
(`FS-001..FS-041`) instead of the canonical `fsNNN` scheme. Bringing the
implementation in line with §13 is tracked as a code task, not a design
task.

---

## 16. Test-case import strategy

The two test suites (translator and validator) are data-driven YAML files
under `test/cases/`. We deliberately keep starter cases small and curated;
larger pre-existing test corpora are imported **per feature** as the
implementation gains the surface to pass them.

### 16.0 Import registries

Two registries track per-case import progress against each source:

- **[test/cases/imports/SANSARA.md](test/cases/imports/SANSARA.md)** — every
  `deftest` / `testing` block in sansara's fhir-clj validator suite, marked
  imported / pending / N/A (with reason).
- **[test/cases/imports/GRAHAM.md](test/cases/imports/GRAHAM.md)** — Graham
  Grieve's fhir-test-cases manifest, broken down by module + the
  importable-today subset + a java-message → `fsNNN` mapping table.

Update these when importing.

### 16.1 External sources

- **sansara/fhir-clj validator tests**
  ([../sansara/box/libs/fhir-clj/test/fhir/validator/core_test.clj](../sansara/box/libs/fhir-clj/test/fhir/validator/core_test.clj),
  ~3,400 lines). Internal Atomic-EHR reference validator written in Clojure.
  Uses `matcho` matchers against full FHIR R4/R5 package contexts. Each test
  case is rewritten by hand into the YAML format here when the relevant
  feature lands. Their error shape `{:type "constraint-error" :schema-id
  "DomainResource" :context {:id "dom-2"}}` maps to our
  `{ code: 'fs601', schema: 'DomainResource', message: 'dom-2' }`.

- **FHIR/fhir-test-cases (Grahame Grieve, official)**
  ([github.com/FHIR/fhir-test-cases/tree/master/validator](https://github.com/FHIR/fhir-test-cases/tree/master/validator)).
  Cross-implementation conformance suite. Format: `manifest.json` + per-test
  JSON/XML resources + per-implementation expected outputs in `java/`,
  `firely-sdk-*/`. We do not consume the manifest directly. When importing,
  pick a test, rewrite as a YAML case, map FHIR severity/issue-type to our
  `fsNNN`.

- **sansara FHIRSchema fragments**
  ([../sansara/box/libs/fhir-clj/resources/fhir-schemas-samples/](../sansara/box/libs/fhir-clj/resources/fhir-schemas-samples/)).
  Hand-written small FHIRSchema profiles (patient with constraint,
  us-core-patient extension, slicing variants). Reusable as fixtures for
  inheritance and slicing tests.

### 16.2 Feature gate

A case can be imported once the validator can actually produce the
expected outcome:

| Feature in import case | Required local capability | Status |
|------------------------|----------------------------|--------|
| Plain primitive checks | done | imported from sansara `primitives-test` |
| Structure / cardinality | done | hand-seeded |
| Inheritance / SchemaSet | done | hand-seeded |
| Primitive extensions | done | hand-seeded |
| Real-resource validation (R4 fixtures + meta.profile) | done | sansara `required-element` partly imported |
| Pattern matching (`pattern[X]`, fs205, deep-partial) | done | hand-seeded |
| Fixed value matching (`fixed[X]`, fs206, exact equality) | done | hand-seeded |
| Choice types `value[x]` (fs801, fs802) | done | hand-seeded + sansara `validation-c/poly` |
| Slicing (collection, fs901, fs902) | done | hand-seeded + sansara `slicing-validation/Simple slicings` + `extension-test` |
| Cardinality on profiles | done | sansara `cardinality-test` |
| Empty arrays / empty composites (FHIR no-empty rule) | done | sansara `validation-c/empty complex type` |
| US Core profile validation | done (both valid + invalid sub-extension after F4) | sansara `extension-test` |
| Graham fhir-test-cases (HL7 R5 curated) | done | 5 hand-picked cases (patient-good, group-choice-good, group-minimal, list-empty2, group-choice-bad1) |
| Inner-resource walk (Bundle.entry, Patient.contained) | done | sansara `validation-c/Bundle` + `contained` (simplified) |
| Strict mode (`options.strict: true`) | done | sansara `unknown-schemas-test/profile` (both strict + non-strict) |
| Reference target sync check (fs1001) | done | hand-crafted (Graham references module uses external `java/*` files) |
| Resource `id` strict validation | done | Graham `patient-id-bad-*`, `resource-invalid-id-*` (no code changes needed) |
| Excluded keys (`max: 0` → `excluded[]`, fs207) | done | hand-crafted; translator hoists `max="0"` to parent's `excluded[]` |
| Ordered slicing (fs903) | done | hand-crafted; sansara `slicing-validation/ordered slicing` needs profile fixtures |
| `@default` slice (fallback overlay for unmatched items) | done | hand-crafted; sansara `slicing-validation/@default slice` needs profile fixtures |
| FHIRPath constraints (fs601) — pluggable engine | done | hand-crafted (7) + sansara `Patient.contact pat-1` + `Organization org-1` |
| Top-level root constraints (translator gap) | done | unlocks R4 invariants on root (dom-*, org-*, etc.) |
| Issue severity (`'error' \| 'warning' \| 'information'`) | done | constraints carry their declared severity; runner asserts only errors by default |
| Terminology bindings (fs501/502/503) — pluggable | done | hand-crafted (7) |
| Reference resolution (fs1002) — pluggable | done | hand-crafted (4); fragment/urn skipped |
| Extension URL dereferencing (deep validation) | done | sansara us-core-race invalid sub-extension now passes |
| Reslicing (slicing inside slice.schema) | done | recursive walk handles it; hand-crafted (2) |
| openAtEnd slicing (fs904) | done | hand-crafted (5) |
| modifierExtension MU rule (fs1102) | done | hand-crafted (3) |
| Choice types | not yet | §9 |
| Slicing | not yet | §10 |
| `pattern[X]` / `fixed[X]` matching | not yet | §15 |
| FHIRPath constraints | not yet | §15 |
| Terminology bindings | not yet | §12 |
| Reference target check | not yet | §12 |

When adding a new validator capability:

1. Implement the capability.
2. Look up sansara/fhir-clj tests that exercise it; pick the smallest 3-5.
3. Rewrite as YAML cases under `test/cases/validator/<topic>.yaml`.
4. Land both in the same PR.

### 16.2a FHIR package fixtures

A subset of imported tests references real FHIR R4 resources (`Patient`,
`Observation`, etc.). To support these without committing megabytes of JSON,
the build pipeline downloads and translates `hl7.fhir.r4.core` on demand:

- Script: [scripts/prepare-fixtures.ts](scripts/prepare-fixtures.ts).
- Auto-run on `bun test` via the `pretest` hook. Idempotent — skips if
  `test/fixtures/hl7.fhir.r4.core/` is populated.
- Output goes to `test/fixtures/<pkgId>/<schemaId>.fs.json` (gitignored).
- Tests load via `loadPackageFixtures('hl7.fhir.r4.core')` from
  [test/test-helpers.ts](test/test-helpers.ts).
- Refresh: `rm -rf test/fixtures && bun run prepare-fixtures`.

Current PACKAGES list ([scripts/prepare-fixtures.ts](scripts/prepare-fixtures.ts)):
- `hl7.fhir.r4.core@4.0.1` — 638 schemas (used by most sansara imports)
- `hl7.fhir.us.core@5.0.1` — 51 schemas (used by sansara `extension-test`)
- `hl7.fhir.r5.core@5.0.0` — 286 schemas (used by Graham R5 fhir-test-cases samples)

Each test suite file selects which packages it needs via `defaults.usePackages: ['hl7.fhir.r4.core', ...]` or the legacy shortcut `defaults.useR4: true`.

### 16.3 Why not mass-import as `skip: true`

Tempting (visible scale of work) but rejected: a tree of skipped cases is
silent noise, drifts out of sync with the live implementation, and creates
the illusion of coverage. Keep skipped cases zero — let the import strategy
above govern incremental growth.

## 17. References

- Design conversations (canonical source of intent):
  - [docs/new/transcript_04-02-2026.md](docs/new/transcript_04-02-2026.md)
  - [docs/new/transcript_04-03-2026.md](docs/new/transcript_04-03-2026.md)
- Implementation:
  - Translator entry point — [src/converter/index.ts](src/converter/index.ts)
  - Translator helpers — [src/converter/](src/converter/)
  - Validator entry point — [src/validator/index.ts](src/validator/index.ts)
  - Validator primitives — [src/validator/primitives.ts](src/validator/primitives.ts)
  - Type definitions — [src/types.ts](src/types.ts), [src/converter/types.ts](src/converter/types.ts)
- Examples — [spec/examples/](spec/examples/)
- FHIR upstream:
  - FHIR R6 profiling overview — <https://build.fhir.org/profiling.html>
  - FHIR R6 ElementDefinition — <https://build.fhir.org/elementdefinition.html>
  - FHIR R6 StructureDefinition — <https://build.fhir.org/structuredefinition.html>
