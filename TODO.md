# New Validator — TODO

Status of the `src/new/*` validator on branch `simple-validator-spike`.

## Done

### Architecture
- Overlay-set of `SchemaFragment[]` as the unit of validation state
- Single `validateValue` dispatcher (array / primitive / object branches)
- Side-effect `issues` array, dotted path propagation (`Patient.name.0.given`)
- `source` field on every `SchemaFragment` propagates through `validateElements` descend (parent fragment's `source` carries into `childSchemas`)

### Primitives
- Lexical validation at every depth
- Full type coverage: `string`, `markdown`, `integer`, `unsignedInt`, `positiveInt`, `decimal`, `date`, `dateTime`, `time`, `instant`, `id`, `code`, `oid`, `uuid`
- JS-typeof-only stubs: `boolean`, `uri`, `url`, `canonical`, `base64Binary`, `xhtml`, `integer64`
- `expected` is FHIR type name at field level, JS type name at root (preserved from original behavior)

### Primitive extensions
- `field` + `_field` paired in one pass
- `_field` without `field` (metadata-only)
- `null` value with extension (boolean-with-extension)
- `value[]` / `_value[]` aligned, per-index `_value[i]` propagated
- `_field` on non-primitive field → `invalidPrimitiveExtension`

### Arrays + cardinality
- Item traversal in array branch
- Element-level `min` / `max` cardinality (`cardinalityViolation`)
- Tightest bounds picked from overlay (highest `min`, lowest `max`)

### Slicing (multi-profile)
- Each `SchemaFragment` carries its own `slicing { rules, discriminator, slices }`
- `collectSlicings` returns one entry per profile — never merges across profiles
- `extractAtPath` flattens both item and `slice.match` template through the same FHIRPath-like dotted traversal
- `classifySlice` per profile: each slicing matched in its own coordinate system
- Discriminator types: `value` (strict equality), `pattern` (`deepPartialMatch`), `exists`
- `rules: 'closed'` → `slicingUnmatched` per-profile attribution
- Ambiguous match within a single profile → `slicingAmbiguous` with the slice list
- Slice cardinality tracked per `(psIdx, sliceName)` → `sliceCardinality` errors attribute the source
- Per-item `branchSchemas` unions matched slice schemas from all profiles
- Empty discriminator → fallback to whole-item `deepPartialMatch`

### Error registry
8 lexical codes + `cardinalityViolation` + 3 slicing codes (`slicingAmbiguous`, `slicingUnmatched`, `sliceCardinality`). All slicing messages include `source` (profile attribution).

## TODO

### Slicing — extensions to current implementation
- [ ] **Reslicing** — slices within slices (e.g., `usMRN/official`, `usMRN/temp`)
- [ ] **Discriminator type `type`** — slices distinguished by FHIR type of the element
- [ ] **Discriminator type `profile`** — slices distinguished by which profile the element conforms to
- [ ] **`exists` discriminator semantics** — current behavior auto-passes when slice doesn't pin the path; needs explicit `match: { field: { exists: true|false } }` DSL or similar

### Validator core — still missing
- [ ] **Scalar → array coercion** (FHIR JSON sometimes shrinks single-element arrays to scalars)
- [ ] **Choice types `value[x]`** — field-level lookup that resolves `valueString` → `value[x]` variant, plus the "only one variant present" check
- [ ] **Profile resolution by URL** — currently `ctx: Record<TypeName, ElementDef>` is flat; need either `ctx.profiles[url]: SchemaFragment[]` (pre-resolved chain) or `resolveProfile(ctx, url)` function for `slice.profile` / `slice.refers`
- [ ] **Terminology bindings** (deferred validation hooks: required / extensible / preferred / example)
- [ ] **References** — `Reference.reference` resolution + `targetProfiles` constraints (deferred)
- [ ] **FHIRPath constraints** (`fs6xx` range in the docs spec)
- [ ] **Extensions** — `extension` / `modifierExtension` handling with URL registry
- [ ] **`fixed[x]` / `pattern[x]`** enforcement at element level (currently used only in slice classification)
- [ ] **Strict mode in nested objects** — currently `validateElements` only enforces required+unknown when the top-level schema is `type: 'elements'`; nested complex types do not propagate strict

### Primitives — full lexical
- [ ] **URI / URL / canonical** — RFC 3986 validation (currently only typeof check)
- [ ] **base64Binary** — base64 alphabet + padding check
- [ ] **xhtml** — minimal XML well-formedness
- [ ] **integer64** — value range as string (FHIR R5: large ints serialized as JSON strings)

### Error format — spec drift
- `docs/new/error-codes.md` defines a custom `ValidationIssue { code, path, schemaPath, severity, message }` with `fsNNN` codes; implementation returns `OperationOutcome` with snake_case codes. Decide:
  - [ ] Migrate to the custom `ValidationIssue` format with `fsNNN` codes
  - [ ] Or update `error-codes.md` to match current `OperationOutcome` + snake_case
  - [ ] Add `toOperationOutcome(issues)` mapper either way

### Multi-profile resolution
- [ ] **Profile chain resolution** — for `slice.profile` and base-profile pulls, need to flatten `base → profile → derived` into the overlay order
- [ ] **Profile conflict detection** — different layers declaring incompatible types (currently last-wins in `childExpectedName`)

### Tests / coverage gaps
- [ ] `test.todo` items still open:
  - `array-semantics.test.ts` — scalar→array coercion (when allowed / when disabled)
  - `context-resolution.test.ts` — failure when ctx lacks a referenced complex type
  - `object-fields.test.ts` — rejecting fields absent from the merged schema list (already covered for strict mode, this asks for a non-strict variant)
  - `primitive-extensions.test.ts:48` — binding test marker
- [ ] Slicing — reslicing scenario
- [ ] Slicing — `exists` discriminator concrete example
- [ ] Multi-profile — conflicting cardinality (e.g., US Core min=1 + AU Core min=2)

### Docs
- [ ] ADR for overlay-set architecture vs alternatives (multi-schema/old-validator)
- [ ] ADR for slicing model (match-based vs discriminator-path)
- [ ] Update `docs/new/new-validator-notes.md` with the multi-profile slicing decision
