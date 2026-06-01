import { describe, expect, it } from 'bun:test';
import { generateSnapshot } from '../../src/converter/snapshot';
import type { StructureDefinition, StructureDefinitionElement } from '../../src/converter/types';

// Field-faithful isSummary/isModifier (preserveSource): `true` rides in from the
// differential; non-summary/non-modifier elements default to false; and a slice row
// inherits its non-slice sibling's flags (not a blind false).

function sd(args: {
  url: string;
  type: string;
  baseDefinition?: string;
  derivation?: string;
  elements: StructureDefinitionElement[];
}): StructureDefinition {
  return {
    resourceType: 'StructureDefinition',
    url: args.url,
    name: args.url.split('/').pop() as string,
    status: 'active',
    kind: 'resource',
    type: args.type,
    ...(args.baseDefinition ? { baseDefinition: args.baseDefinition } : {}),
    ...(args.derivation ? { derivation: args.derivation } : {}),
    differential: { element: [{ path: args.type }, ...args.elements] },
  };
}

const base = sd({
  url: 'http://example.org/Foo',
  type: 'Foo',
  derivation: 'specialization',
  elements: [
    { path: 'Foo.cat', min: 0, max: '*', type: [{ code: 'CodeableConcept' }], isSummary: true },
    { path: 'Foo.note', min: 0, max: '1', type: [{ code: 'string' }] }, // not summary
  ],
});

describe('snapshot: field-faithful isSummary/isModifier (preserveSource)', () => {
  it('carries isSummary:true, defaults others to false, and slices inherit the sibling', async () => {
    const profile = sd({
      url: 'http://example.org/FooProfile',
      type: 'Foo',
      baseDefinition: base.url,
      derivation: 'constraint',
      elements: [
        {
          path: 'Foo.cat',
          slicing: { discriminator: [{ type: 'pattern', path: '$this' }], rules: 'open' },
        },
        {
          path: 'Foo.cat',
          sliceName: 's',
          patternCodeableConcept: { coding: [{ system: 'http://x', code: 'y' }] },
        },
      ],
    });

    const snap = await generateSnapshot(profile, { resolver: { [base.url]: base }, preserveSource: true });
    const rows = snap.snapshot?.element || [];
    const cat = rows.find((e) => e.path === 'Foo.cat' && !e.sliceName) as Record<string, unknown>;
    const slice = rows.find((e) => e.path === 'Foo.cat' && e.sliceName === 's') as Record<string, unknown>;
    const note = rows.find((e) => e.path === 'Foo.note') as Record<string, unknown>;

    expect(cat.isSummary).toBe(true); // carried from the differential
    expect(slice.isSummary).toBe(true); // slice inherits the base element's flag
    expect(cat.isModifier).toBe(false); // filled
    expect(note.isSummary).toBe(false); // not a summary element → filled false
  });
});
