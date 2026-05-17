// Data-driven validator suite. Loads every test/cases/validator/*.yaml and
// runs each test case against validate(). Mirrors the translator runner.
//
// Case file shape:
//   suite: Human description
//   defaults:
//     registry: [ ...FHIRSchemas auto-registered for every test... ]
//   tests:
//     - desc: ...
//       schemas: [ ...InputSchema[]... ]    # passed as 2nd arg to validate()
//       registry: [ ...extra schemas for ctx.resolve... ]
//       data: ...resource...
//       valid: true                         # shortcut for issues: []
//       issues:
//         - { code: fsNNN, path: [...] }    # subset match on each issue field;
//                                           # actual must contain a matching one
//                                           # AND no extra issues are tolerated
//       only: true                          # focus
//       skip: true                          # skip

import { describe, expect, it } from 'bun:test';
import { join } from 'node:path';
import { relative } from 'node:path';
// @ts-ignore — fhirpath ships JS + .d.ts; default-import works fine
import fhirpath from 'fhirpath';
import type { FHIRSchema } from '../src/converter/types.js';
import {
  validate,
  type FhirpathEvaluator,
  type ValidateContext,
  type ValidationIssue,
} from '../src/validator/index.js';

const fhirpathAdapter: FhirpathEvaluator = {
  evaluate: (expr, root) => fhirpath.evaluate(root, expr) as unknown[],
};
import {
  buildResolverMap,
  loadPackageFixtures,
  loadSuites,
  subsetMatch,
  type ValidatorCase,
  type ValidatorSuite,
} from './test-helpers.js';

const CASES_DIR = join(import.meta.dir, 'cases', 'validator');
const files = loadSuites<ValidatorSuite>(CASES_DIR);

/** Build a ctx.resolve from a list of schemas + optional base map. */
function makeCtx(schemas: FHIRSchema[], base?: Map<string, FHIRSchema>): ValidateContext {
  const overlay = buildResolverMap(schemas);
  return {
    resolve: (ref) => overlay.get(ref) ?? base?.get(ref),
  };
}

/** Normalize a case-level `path` (string or array) to an array. */
function normPath(p: unknown): (string | number)[] | undefined {
  if (p === undefined) return undefined;
  if (Array.isArray(p)) return p as (string | number)[];
  if (typeof p === 'string') return p.split('.').filter(Boolean);
  return undefined;
}

function matchIssue(expected: ValidatorCase['issues'][number], actual: ValidationIssue): boolean {
  if (expected.code !== actual.code) return false;
  const ep = normPath(expected.path);
  if (ep !== undefined) {
    if (JSON.stringify(ep) !== JSON.stringify(actual.path)) return false;
  }
  // expected/got are optional and use subset semantics
  for (const k of ['expected', 'got'] as const) {
    if (expected[k] !== undefined) {
      const m = subsetMatch(expected[k], actual[k]);
      if (m) return false;
    }
  }
  return true;
}

// Lazy per-package map cache.
const pkgMaps = new Map<string, Map<string, FHIRSchema>>();
function getPackageMap(id: string): Map<string, FHIRSchema> {
  let m = pkgMaps.get(id);
  if (!m) {
    m = buildResolverMap(loadPackageFixtures(id));
    pkgMaps.set(id, m);
  }
  return m;
}

/** Merge several package maps (later overrides earlier on key collision). */
function mergeMaps(maps: Map<string, FHIRSchema>[]): Map<string, FHIRSchema> {
  const out = new Map<string, FHIRSchema>();
  for (const m of maps) for (const [k, v] of m) out.set(k, v);
  return out;
}

for (const file of files) {
  const { suite, defaults, tests } = file.suite;
  const focused = tests.some((t) => t.only);
  const label = `${relative(import.meta.dir, file.path)} — ${suite}`;

  const pkgIds = [
    ...(defaults?.useR4 ? ['hl7.fhir.r4.core'] : []),
    ...(defaults?.usePackages ?? []),
  ];
  const baseMap = pkgIds.length ? mergeMaps(pkgIds.map(getPackageMap)) : undefined;

  describe(label, () => {
    for (const t of tests) {
      if (t.skip) {
        it.skip(t.desc, () => {});
        continue;
      }
      if (focused && !t.only) continue;

      it(t.desc, () => {
        const registry = [
          ...((defaults?.registry as FHIRSchema[] | undefined) ?? []),
          ...((t.registry as FHIRSchema[] | undefined) ?? []),
        ];
        const ctx = makeCtx(registry, baseMap);
        const suiteOpts =
          (defaults as { useFhirpath?: boolean } | undefined)?.useFhirpath === true
            ? { fhirpath: fhirpathAdapter }
            : {};
        const opts = { ...suiteOpts, ...(t.options ?? {}) };
        const result = validate(ctx, t.schemas as FHIRSchema[], t.data, opts);

        // valid: true → expect no issues at all.
        const expectedIssues = t.valid === true ? [] : (t.issues ?? []);

        // 1) Every expected issue must have a matching actual issue.
        for (const ex of expectedIssues) {
          const found = result.issues.some((a) => matchIssue(ex, a));
          if (!found) {
            throw new Error(
              `Missing expected issue ${JSON.stringify(ex)}\nGot: ${JSON.stringify(result.issues, null, 2)}`,
            );
          }
        }

        // 2) No surprise issues either. Each actual issue must correspond to
        //    one expected entry (by matchIssue). Catches over-firing.
        const used = new Set<number>();
        for (const a of result.issues) {
          const idx = expectedIssues.findIndex((ex, i) => !used.has(i) && matchIssue(ex, a));
          if (idx < 0) {
            throw new Error(
              `Surprise issue ${JSON.stringify(a)}\nExpected: ${JSON.stringify(expectedIssues, null, 2)}`,
            );
          }
          used.add(idx);
        }

        // Sanity check: bun:test expects at least one expect()
        expect(result.issues.length).toBe(expectedIssues.length);
      });
    }
  });
}
