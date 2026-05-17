// Data-driven translator suite. Loads every test/cases/translator/*.yaml and
// runs each test case against translate(). Style modeled on HL7 fhirpath.js.
//
// Case file shape:
//   suite: Human description
//   defaults:
//     sd: { ...merged into every test's sd... }
//   tests:
//     - desc: ...
//       sd: { ...partial StructureDefinition... }
//       expected: { ...subset of FHIRSchema... }
//       # or:
//       sdFile: ./path/to/x.sd.json
//       expectedFile: ./path/to/x.fs.json
//       exact: true            # full deep-equality after sort, instead of subset
//       throws: 'message frag' # expect translate() to throw
//       only: true             # focus
//       skip: true             # skip

import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { translate } from '../src/converter/index.js';
import type { StructureDefinition } from '../src/converter/types.js';
import {
  deepMerge,
  loadSuites,
  subsetMatch,
  type TranslatorCase,
  type TranslatorSuite,
} from './test-helpers.js';

const CASES_DIR = join(import.meta.dir, 'cases', 'translator');
const files = loadSuites<TranslatorSuite>(CASES_DIR);

function sortDeep(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortDeep);
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v as Record<string, unknown>).sort()) {
      out[k] = sortDeep((v as Record<string, unknown>)[k]);
    }
    return out;
  }
  return v;
}

function loadInline(t: TranslatorCase & { sdFile?: string; expectedFile?: string }, suiteFile: string) {
  const dir = dirname(suiteFile);
  const sd = t.sdFile
    ? (JSON.parse(readFileSync(join(dir, t.sdFile), 'utf8')) as Record<string, unknown>)
    : t.sd;
  const expected = t.expectedFile
    ? (JSON.parse(readFileSync(join(dir, t.expectedFile), 'utf8')) as Record<string, unknown>)
    : t.expected;
  return { sd, expected };
}

for (const file of files) {
  const { suite, defaults, tests } = file.suite;
  const focused = tests.some((t) => t.only);
  const suiteLabel = `${relative(import.meta.dir, file.path)} — ${suite}`;

  describe(suiteLabel, () => {
    for (const t of tests as Array<TranslatorCase & { sdFile?: string; expectedFile?: string; exact?: boolean }>) {
      if (t.skip) {
        it.skip(t.desc, () => {});
        continue;
      }
      if (focused && !t.only) continue;

      it(t.desc, () => {
        const { sd: sdPart, expected } = loadInline(t, file.path);
        const sd = (
          defaults?.sd
            ? deepMerge(defaults.sd, sdPart ?? {})
            : (sdPart ?? {})
        ) as StructureDefinition;

        if (t.throws !== undefined) {
          expect(() => translate(sd)).toThrow(t.throws);
          return;
        }

        const result = translate(sd) as unknown as Record<string, unknown>;

        if (!expected) {
          throw new Error(`case "${t.desc}" missing expected (or expectedFile)`);
        }

        if (t.exact) {
          expect(sortDeep(result)).toEqual(sortDeep(expected) as object);
        } else {
          const mismatch = subsetMatch(expected, result);
          if (mismatch) {
            throw new Error(
              `${mismatch}\nExpected (subset): ${JSON.stringify(expected, null, 2)}\nGot: ${JSON.stringify(result, null, 2)}`,
            );
          }
        }
      });
    }
  });
}
