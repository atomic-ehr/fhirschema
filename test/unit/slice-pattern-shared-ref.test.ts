import { describe, expect, it } from 'bun:test';
import { translate } from '../../src/converter/index';
import type { StructureDefinition } from '../../src/converter/types';

// A slice discriminated by `$this` pattern shares its pattern-value object with the
// generated `match`. normalizeSchema's cycle guard must treat that as a shared (DAG)
// reference, NOT a cycle — otherwise the slice's pattern is corrupted into the literal
// string '[Circular Reference]' and the discriminator value is lost.
// (Audit: 27 slices, e.g. us-core-observation-lab Observation.category:us-core.)

const profile: StructureDefinition = {
  resourceType: 'StructureDefinition',
  url: 'http://example.org/ObsLab',
  name: 'ObsLab',
  status: 'active',
  kind: 'resource',
  type: 'Observation',
  derivation: 'constraint',
  baseDefinition: 'http://hl7.org/fhir/StructureDefinition/Observation',
  differential: {
    element: [
      { path: 'Observation' },
      {
        path: 'Observation.category',
        slicing: { discriminator: [{ type: 'pattern', path: '$this' }], rules: 'open' },
        min: 1,
      },
      {
        path: 'Observation.category',
        sliceName: 'us-core',
        patternCodeableConcept: {
          coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'laboratory' }],
        },
      },
    ],
  },
};

describe('forward: a $this-pattern slice keeps its pattern (shared ref is not a cycle)', () => {
  it('preserves the slice schema pattern object', () => {
    const fs = translate(profile);
    const slice = (fs.elements?.category as any)?.slicing?.slices?.['us-core'];

    expect(slice).toBeDefined();
    expect(slice.schema.pattern).not.toBe('[Circular Reference]');
    expect(slice.schema.pattern).toEqual({
      type: 'CodeableConcept',
      value: {
        coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'laboratory' }],
      },
    });
  });

  it('still carries the discriminator value into the slice match', () => {
    const fs = translate(profile);
    const slice = (fs.elements?.category as any)?.slicing?.slices?.['us-core'];
    expect(slice.match).toEqual({
      coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'laboratory' }],
    });
  });
});
