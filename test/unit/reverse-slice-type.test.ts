import { describe, expect, it } from 'bun:test';
import { toStructureDefinition } from '../../src/converter/reverse';
import type { FHIRSchema } from '../../src/converter/types';

const typeCodes = (el: { type?: Array<{ code: string }> }) => (el.type || []).map((t) => t.code);

describe('reverse converter: slice elements inherit type from the sliced element', () => {
  it('BackboneElement slice (Observation.component) inherits BackboneElement', () => {
    const schema: FHIRSchema = {
      url: 'http://example.org/bp',
      name: 'bp',
      type: 'Observation',
      kind: 'resource',
      derivation: 'constraint',
      class: 'profile',
      elements: {
        component: {
          type: 'BackboneElement',
          array: true,
          slicing: {
            discriminator: [{ type: 'pattern', path: 'code' }],
            rules: 'open',
            slices: {
              // biome-ignore lint/suspicious/noExplicitAny: test fixture
              systolic: { min: 1, max: 1, elements: {} } as any,
            },
          },
        },
      },
    };

    const sd = toStructureDefinition(schema);
    const els = sd.differential?.element || [];
    const sliceEl = els.find((e) => e.path === 'Observation.component' && e.sliceName === 'systolic');
    expect(sliceEl).toBeDefined();
    expect(typeCodes(sliceEl as { type?: Array<{ code: string }> })).toEqual(['BackboneElement']);
  });

  it('CodeableConcept slice (Observation.category) inherits CodeableConcept', () => {
    const schema: FHIRSchema = {
      url: 'http://example.org/obs',
      name: 'obs',
      type: 'Observation',
      kind: 'resource',
      derivation: 'constraint',
      class: 'profile',
      elements: {
        category: {
          type: 'CodeableConcept',
          array: true,
          slicing: {
            discriminator: [{ type: 'pattern', path: 'coding' }],
            rules: 'open',
            slices: {
              // biome-ignore lint/suspicious/noExplicitAny: test fixture
              'us-core': { min: 1, max: 1, elements: {} } as any,
            },
          },
        },
      },
    };

    const sd = toStructureDefinition(schema);
    const sliceEl = (sd.differential?.element || []).find(
      (e) => e.path === 'Observation.category' && e.sliceName === 'us-core',
    );
    expect(typeCodes(sliceEl as { type?: Array<{ code: string }> })).toEqual(['CodeableConcept']);
  });

  it('does not override a type already present on the slice schema', () => {
    const schema: FHIRSchema = {
      url: 'http://example.org/obs2',
      name: 'obs2',
      type: 'Observation',
      kind: 'resource',
      derivation: 'constraint',
      class: 'profile',
      elements: {
        value: {
          type: 'Quantity',
          slicing: {
            rules: 'open',
            slices: {
              // biome-ignore lint/suspicious/noExplicitAny: test fixture
              q: { type: 'Range', min: 0, max: 1, elements: {} } as any,
            },
          },
        },
      },
    };

    const sd = toStructureDefinition(schema);
    const sliceEl = (sd.differential?.element || []).find(
      (e) => e.path === 'Observation.value' && e.sliceName === 'q',
    );
    expect(typeCodes(sliceEl as { type?: Array<{ code: string }> })).toEqual(['Range']);
  });
});
