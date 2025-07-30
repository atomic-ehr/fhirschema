# CLAUDE.md

When you are generating code prefer to be concise and to the point.
Make comments only if needed.

This is a design project for a new unit library in typescript.
Please be concise and to the point.
* ./spec is official spec of FHIRPath
* ./adr is a folder for Architecture Decision Records. (read ./adr/README.md for more details)
* ./concepts is a wiki like knowledge base for the project.
* ./tasks is a folder for task management (read ./tasks/README.md for more details)
   Task file name convention is [00<X>-<task-name>].md
   When creating new tasks, create them in ./tasks/todo/<filename>.md
   When working on tasks move files to ./tasks/in-progress/<filename>.md
   When task finished move files to ./tasks/done/<filename>.md and write what was done in this file.
* ./test is a folder for tests - tests should be named as ./test/<filename>.test.ts by convention.
* ./scripts - for debug and utils you can write typescript scripts in this directory and run them with `bun run <filename.ts>`

## Architecture Decisions

* Before making significant architectural changes, check existing ADRs in ./adr
* Create new ADRs for important design decisions using ./adr/template.md
* Document alternatives considered and rationale for choices

## Coding

* While importing files, remember about import type for types.
* Use `bun run <filename.ts>` to run files
* When you create or update typescript file, run `bun tsc --noEmit` to check for errors and fix them.
* Create tests for new functionality. Put test file as ./test/<filename>.test.ts by convention.
* Use `import {describe, it, expect} from 'bun:test'` and `bun run test` to run tests.


## Tasks

When working on tasks move files to ./tasks/in-progress/<filename>.md
When task finished move files to ./tasks/done/<filename>.md and write what was done in this file.





