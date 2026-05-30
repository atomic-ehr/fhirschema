import { describe, expect, it } from 'bun:test';
import { toStructureDefinition } from '../../src/converter/reverse';
import type { FHIRSchema } from '../../src/converter/types';

const ASSERTED = 'http://hl7.org/fhir/StructureDefinition/condition-assertedDate';

// FHIRSchema folds a single added extension onto elements.extension (carrying its url
// + a slicing entry). The snapshot must split that into a generic 0..* base slot plus
// a named slice — the base must never inherit the specific extension's url/max.
function schemaWithExtension(): FHIRSchema {
  return {
    url: 'http://example.org/cond',
    name: 'cond',
    type: 'Condition',
    kind: 'resource',
    derivation: 'constraint',
    class: 'profile',
    elements: {
      extension: {
        type: 'Extension',
        max: 1,
        mustSupport: true,
        url: ASSERTED,
        slicing: {
          rules: 'open',
          // biome-ignore lint/suspicious/noExplicitAny: test fixture
          slices: { assertedDate: { max: 1, schema: { type: 'Extension', url: ASSERTED } } } as any,
        },
      },
    },
  };
}

describe('reverse converter: resource extension slot', () => {
  it('emits a generic 0..* Extension base slot (no url, max=*)', () => {
    const sd = toStructureDefinition(schemaWithExtension());
    const base = (sd.differential?.element || []).find(
      (e) => e.path === 'Condition.extension' && !e.sliceName,
    );
    expect(base).toBeDefined();
    expect(base?.min).toBe(0);
    expect(base?.max).toBe('*');
    expect((base?.type || []).map((t) => t.code)).toEqual(['Extension']);
    // base slot must not carry the specific profile
    expect(base?.type?.[0].profile).toBeUndefined();
  });

  it('keeps the specific extension as a named slice with its profile', () => {
    const sd = toStructureDefinition(schemaWithExtension());
    const slice = (sd.differential?.element || []).find(
      (e) => e.path === 'Condition.extension' && e.sliceName === 'assertedDate',
    );
    expect(slice).toBeDefined();
    expect(slice?.type?.[0].code).toBe('Extension');
    expect(slice?.type?.[0].profile).toEqual([ASSERTED]);
  });
});
