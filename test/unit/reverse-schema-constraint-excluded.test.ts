import { describe, expect, it } from 'bun:test';
import { translate } from '../../src/converter/index';
import { toStructureDefinition } from '../../src/converter/to-structure-definition';
import type { StructureDefinition, StructureDefinitionElement } from '../../src/converter/types';

// The forward converter hoists root-element invariants into FHIRSchema.constraint and
// max=0 prohibitions into a parent's excluded[]. The reverse must re-emit both — a
// root constraint on the root differential row, and each excluded name as a max=0 row —
// otherwise resource-level invariants and field prohibitions silently disappear.

const profile: StructureDefinition = {
  resourceType: 'StructureDefinition',
  url: 'http://example.org/Obs',
  name: 'Obs',
  status: 'active',
  kind: 'resource',
  type: 'Observation',
  derivation: 'constraint',
  baseDefinition: 'http://hl7.org/fhir/StructureDefinition/Observation',
  differential: {
    element: [
      {
        path: 'Observation',
        constraint: [
          { key: 'obs-x', severity: 'error', human: 'must have code', expression: 'code.exists()' },
        ],
      },
      { path: 'Observation.note', max: '0' }, // top-level prohibition
      { path: 'Observation.referenceRange.low', max: '0' }, // nested prohibition
    ],
  },
};

const find = (els: StructureDefinitionElement[] | undefined, path: string) =>
  (els || []).find((e) => e.path === path);

describe('reverse: schema-level constraint and excluded are re-emitted', () => {
  it('re-emits the root constraint on the root differential element', () => {
    const sd = toStructureDefinition(translate(profile), { status: 'active' });
    const root = find(sd.differential?.element, 'Observation');
    expect(root?.constraint).toEqual([
      { key: 'obs-x', severity: 'error', human: 'must have code', expression: 'code.exists()' },
    ]);
  });

  it('re-emits a top-level excluded element as max=0', () => {
    const sd = toStructureDefinition(translate(profile), { status: 'active' });
    const note = find(sd.differential?.element, 'Observation.note');
    expect(note).toBeDefined();
    expect(note?.max).toBe('0');
  });

  it('re-emits a nested excluded element as max=0', () => {
    const sd = toStructureDefinition(translate(profile), { status: 'active' });
    const low = find(sd.differential?.element, 'Observation.referenceRange.low');
    expect(low).toBeDefined();
    expect(low?.max).toBe('0');
  });
});
