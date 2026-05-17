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
  type ReferenceResolver,
  type TerminologyEvaluator,
  type ValidateContext,
  type ValidationIssue,
} from '../src/validator/index.js';
import { TxFhirOrgAdapter } from '../src/validator/tx-adapter.js';

const fhirpathAdapter: FhirpathEvaluator = {
  evaluate: (expr, root, env) =>
    // HL7 fhirpath.js: 3rd arg is env vars; keys WITHOUT the `%` prefix.
    fhirpath.evaluate(root, expr, env ?? {}) as unknown[],
};

const TEST_VALUESETS: Record<string, Set<string>> = {
  'urn:vs:colors': new Set(['red', 'green', 'blue']),
};

// Shared instance — re-used across all tx-tests so the in-process cache
// hits between cases.
const txAdapter = new TxFhirOrgAdapter();

const terminologyAdapter: TerminologyEvaluator = {
  validateCode: (valueSet, value) => {
    const vs = TEST_VALUESETS[valueSet];
    if (!vs) return 'unknown';
    let code: unknown;
    if (typeof value === 'string') code = value;
    else if (value && typeof value === 'object') {
      const v = value as Record<string, unknown>;
      code = v.code; // Coding.code or CodeableConcept.coding[0].code (simplified)
    }
    if (typeof code !== 'string') return 'unknown';
    return vs.has(code) ? 'in' : 'not-in';
  },
};

const TEST_RESOURCES = new Set(['Patient/1', 'Patient/2', 'Organization/org1']);

const referenceResolverAdapter: ReferenceResolver = {
  resolve: (reference) => {
    // Strip absolute URL prefix if present
    const local = /([A-Z][A-Za-z]+\/[^/]+)$/.exec(reference)?.[1] ?? reference;
    return TEST_RESOURCES.has(local) ? 'resolved' : 'unresolved';
  },
};
import {
  buildResolverMap,
  loadPackageFixtures,
  loadProfileSchema,
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

function matchIssue(
  expected: { code: string; severity?: string; path?: unknown; expected?: unknown; got?: unknown },
  actual: ValidationIssue,
): boolean {
  if (expected.code !== actual.code) return false;
  if (expected.severity !== undefined && expected.severity !== actual.severity) return false;
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
        // `_loadProfile: ["validator/some-profile.json", ...]` — read each
        // SD from fhir-test-cases, translate on the fly, register in ctx.
        const profileLoaded: FHIRSchema[] = [];
        const lp = (t as { _loadProfile?: unknown })._loadProfile;
        if (Array.isArray(lp)) {
          for (const p of lp) {
            if (typeof p === 'string') profileLoaded.push(loadProfileSchema(p));
          }
        } else if (typeof lp === 'string') {
          profileLoaded.push(loadProfileSchema(lp));
        }
        const registry = [
          ...((defaults?.registry as FHIRSchema[] | undefined) ?? []),
          ...((t.registry as FHIRSchema[] | undefined) ?? []),
          ...profileLoaded,
        ];
        // Per-test `_usePackages` overrides suite defaults — used by
        // Graham IG-package cases that need version-specific fixture dirs.
        const tup = (t as { _usePackages?: unknown })._usePackages;
        let effectiveBase = baseMap;
        if (Array.isArray(tup) && tup.length > 0) {
          const r4 = defaults?.useR4 ? ['hl7.fhir.r4.core'] : [];
          const ids = [...r4, ...tup.filter((x): x is string => typeof x === 'string')];
          effectiveBase = mergeMaps(ids.map(getPackageMap));
        }
        const ctx = makeCtx(registry, effectiveBase);
        const suiteOpts: Record<string, unknown> = {};
        const d = defaults as
          | {
              useFhirpath?: boolean;
              useTerminology?: boolean;
              useTxServer?: boolean;
              useReferenceResolver?: boolean;
            }
          | undefined;
        if (d?.useFhirpath === true) suiteOpts.fhirpath = fhirpathAdapter;
        if (d?.useTerminology === true) suiteOpts.terminology = terminologyAdapter;
        if (d?.useTxServer === true) suiteOpts.terminology = txAdapter;
        if (d?.useReferenceResolver === true)
          suiteOpts.referenceResolver = referenceResolverAdapter;
        const opts = { ...suiteOpts, ...(t.options ?? {}) };
        const result = validate(ctx, t.schemas as FHIRSchema[], t.data, opts);

        // By default, tests assert only on ERROR-severity issues. Warnings
        // and information surface in result but are invisible to the
        // expected/surprise diff. To assert on a warning, declare the
        // expected entry with explicit `severity: warning`.
        const expectedIssues = t.valid === true ? [] : (t.issues ?? []);
        const expectErrorOnly = expectedIssues.every(
          (ex) => ex.severity === undefined || ex.severity === 'error',
        );
        const actualIssues = expectErrorOnly
          ? result.issues.filter((i) => i.severity === 'error')
          : result.issues;

        // 1) Every expected issue must have a matching actual issue.
        for (const ex of expectedIssues) {
          const found = actualIssues.some((a) => matchIssue(ex, a));
          if (!found) {
            throw new Error(
              `Missing expected issue ${JSON.stringify(ex)}\nGot: ${JSON.stringify(actualIssues, null, 2)}`,
            );
          }
        }

        // 2) No surprise issues. Each actual must correspond to one
        //    expected entry. Catches over-firing.
        const used = new Set<number>();
        for (const a of actualIssues) {
          const idx = expectedIssues.findIndex((ex, i) => !used.has(i) && matchIssue(ex, a));
          if (idx < 0) {
            throw new Error(
              `Surprise issue ${JSON.stringify(a)}\nExpected: ${JSON.stringify(expectedIssues, null, 2)}`,
            );
          }
          used.add(idx);
        }

        // Sanity check: bun:test expects at least one expect()
        expect(actualIssues.length).toBe(expectedIssues.length);
      });
    }
  });
}
