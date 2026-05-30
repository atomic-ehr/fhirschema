import { describe, expect, it } from 'bun:test';
import { toStructureDefinition } from '../../src/converter/to-structure-definition';
import type { FHIRSchema } from '../../src/converter/types';

function sliceSchema(slices: Record<string, unknown>): FHIRSchema {
  return {
    url: 'http://example.org/p',
    name: 'p',
    type: 'DocumentReference',
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
          // biome-ignore lint/suspicious/noExplicitAny: test fixture
          slices: slices as any,
        },
      },
    },
  };
}

describe('reverse converter: slice cardinality', () => {
  it('defaults to min=0/max=* when slice omits cardinality and parent is an array', () => {
    const sd = toStructureDefinition(sliceSchema({ adi: { match: {}, schema: { mustSupport: true } } }));
    const slice = (sd.differential?.element || []).find(
      (e) => e.path === 'DocumentReference.category' && e.sliceName === 'adi',
    );
    expect(slice?.min).toBe(0);
    expect(slice?.max).toBe('*');
  });

  it('uses explicit slice cardinality when present', () => {
    const sd = toStructureDefinition(sliceSchema({ adi: { min: 1, max: 1, schema: { mustSupport: true } } }));
    const slice = (sd.differential?.element || []).find(
      (e) => e.path === 'DocumentReference.category' && e.sliceName === 'adi',
    );
    expect(slice?.min).toBe(1);
    expect(slice?.max).toBe('1');
  });
});
