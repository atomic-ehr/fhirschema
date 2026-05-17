# CLAUDE.md

Project conventions for AI contributors. Be concise; comment only when
non-obvious *why*.

This is a TypeScript implementation of **FHIRSchema** (translator + validator)
running on Bun.

## Where the knowledge lives

* **`DESIGN.md` — canonical design document.** Single source of truth for
  architecture, IR, validator semantics, error codes, and design decisions.
  Read it before touching the code. If your change shifts the design,
  update DESIGN.md in the same PR.
* `transcripts/` — recorded design conversations. Background only; DESIGN.md
  is the synthesised current truth. Do not cite transcripts in code or
  user-facing docs.
* `spec/examples/` — example FHIRSchema JSON used by tests.
* `tasks/` — lightweight task workflow.
  * `tasks/todo/<NNN-name>.md` → `tasks/in-progress/<NNN-name>.md` →
    `tasks/done/<NNN-name>.md` (with a short note about what shipped).

## Coding

* Runtime is Bun. Run files with `bun run <file.ts>`, tests with
  `bun test`, typecheck with `bunx tsc --noEmit`.
* When you create or modify a TypeScript file, run `bunx tsc --noEmit` and
  fix errors before declaring done.
* Use `import type` for type-only imports.
* Tests use `bun:test`: `import { describe, it, expect } from 'bun:test'`.
  Test files live at `test/<area>/<name>.test.ts`.
* Debug/utility scripts go in `scripts/` (create if needed); run with
  `bun run scripts/<file.ts>`.
* No comments that restate what the code does. Comments are for non-obvious
  *why* — a hidden invariant, a workaround, a subtle ordering constraint.

## Architectural changes

* The translator is **stateless** (no I/O, no caches, no other-schema
  peeking) and the validator is **snapshot-less** (resolves inheritance at
  runtime via `ctx.resolve`). These two properties are load-bearing; if a
  proposed change would violate either, stop and discuss.
* Error codes follow the `fsNNN` scheme defined in DESIGN.md §13. Codes are
  stable identifiers; tests assert on `code` + `path`, never on messages.
