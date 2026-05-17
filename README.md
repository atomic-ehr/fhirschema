# FHIRSchema

TypeScript implementation of the FHIRSchema translator and validator.

**Design authority:** [DESIGN.md](DESIGN.md) — single canonical document covering
architecture, IR shape, validator algorithm, error codes, and design decisions.

## What it does

Two pure halves:

- **Translator** — `StructureDefinition` → `FHIRSchema` (stateless, single-input)
- **Validator** — `FHIRSchema[]` + resource + resolver → `ValidationIssue[]`
  (single-pass, data-driven, snapshot-less)

## Install

```bash
npm install @atomic-ehr/fhirschema
```

## Usage

### Translate a StructureDefinition

```ts
import { translate } from '@atomic-ehr/fhirschema';

const fhirSchema = translate(structureDefinition);
```

The translator is a pure function — no I/O, no caches, no other-schema
peeking. See [DESIGN.md §3](DESIGN.md#3-translator-structuredefinition--fhirschema).

### Validate a resource

```ts
import { validate } from '@atomic-ehr/fhirschema';

const ctx = {
  resolve: (canonical) => schemaCache[canonical],   // your registry
};

const result = validate(ctx, [patientProfile], resource);
if (!result.valid) {
  for (const issue of result.issues) {
    console.log(issue.code, issue.path.join('.'), issue.message);
  }
}
```

The validator iterates over **data**, not schema; inheritance and type
references resolve at runtime via `ctx.resolve`. See [DESIGN.md §5](DESIGN.md#5-validator-data-driven-single-pass).

## Development

Runtime is [Bun](https://bun.sh).

```bash
bun test                # run all tests
bunx tsc --noEmit       # typecheck
bun run build           # build dist/
```

## Layout

```text
DESIGN.md             ← canonical design document (read this first)
README.md             ← this file
CLAUDE.md             ← project conventions for AI contributors
src/
  converter/          ← SD → FHIRSchema translator
  validator/          ← FHIRSchema validator
  types.ts            ← shared TypeScript types
test/
  unit/               ← translator unit tests
  golden/             ← translator golden tests
  validator/          ← validator tests
spec/examples/        ← sample schemas used in tests
transcripts/          ← design-conversation transcripts (background)
tasks/                ← task-tracking workflow
```

## Contributing

Read [DESIGN.md](DESIGN.md) before proposing changes. Implementation must
match the design; if a change requires a design shift, update DESIGN.md in
the same PR.
