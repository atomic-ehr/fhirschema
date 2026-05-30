import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { toStructureDefinition, translate } from '../../src/converter';

function sortObjectDeep(obj: unknown): unknown {
  if (Array.isArray(obj)) {
    const normalized = obj.map((item) => sortObjectDeep(item));
    if (normalized.every((item) => typeof item === 'string')) {
      return [...(normalized as string[])].sort();
    }
    return normalized;
  }

  if (obj && typeof obj === 'object') {
    const sorted: Record<string, unknown> = {};
    Object.keys(obj as Record<string, unknown>)
      .sort()
      .forEach((key) => {
        if (key !== 'index') {
          sorted[key] = sortObjectDeep((obj as Record<string, unknown>)[key]);
        }
      });
    return sorted;
  }

  return obj;
}

function loadJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf-8'));
}

describe('Roundtrip Golden Tests', () => {
  const fixtures = ['string', 'boolean', 'unsignedInt', 'address'];

  fixtures.forEach((name) => {
    it(`preserves schema semantics for ${name}`, () => {
      const inputPath = join(__dirname, 'inputs', `${name}.sd.json`);
      const input = loadJson(inputPath);

      const fs1 = translate(input as Parameters<typeof translate>[0]);
      const sd2 = toStructureDefinition(fs1);
      const fs2 = translate(sd2);

      expect(sortObjectDeep(fs2)).toEqual(sortObjectDeep(fs1));
    });
  });
});
