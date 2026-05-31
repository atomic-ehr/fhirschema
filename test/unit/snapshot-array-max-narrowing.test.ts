import { describe, expect, it } from 'bun:test';
import { generateSnapshot } from '../../src/converter/snapshot';
import type { StructureDefinition, StructureDefinitionElement } from '../../src/converter/types';

function sd(args: {
  url: string;
  type: string;
  kind?: string;
  baseDefinition?: string;
  derivation?: string;
  elements: StructureDefinitionElement[];
  snapshot?: StructureDefinitionElement[];
}): StructureDefinition {
  return {
    resourceType: 'StructureDefinition',
    url: args.url,
    name: args.url.split('/').pop() as string,
    status: 'active',
    kind: args.kind || 'resource',
    type: args.type,
    ...(args.baseDefinition ? { baseDefinition: args.baseDefinition } : {}),
    ...(args.derivation ? { derivation: args.derivation } : {}),
    differential: { element: [{ path: args.type }, ...args.elements] },
    ...(args.snapshot ? { snapshot: { element: args.snapshot } } : {}),
  };
}

// Base declares `bar` as a 0..* array. A profile tightens it to max=1. The
// element stays an ARRAY (array-ness is hereditary, never flips to scalar) —
// it's "an array with max 1" → 0..1, NOT 0..* and NOT a scalar.
const base = sd({
  url: 'http://example.org/Foo',
  type: 'Foo',
  derivation: 'specialization',
  elements: [{ path: 'Foo.bar', min: 0, max: '*', type: [{ code: 'string' }] }],
});

describe('snapshot: profile narrowing an array max to 1 keeps max=1 (array with max 1)', () => {
  it('0..* tightened to max=1 yields 1..1, not 0..*', async () => {
    const profile = sd({
      url: 'http://example.org/FooProfile',
      type: 'Foo',
      baseDefinition: base.url,
      derivation: 'constraint',
      elements: [{ path: 'Foo.bar', min: 1, max: '1', type: [{ code: 'string' }] }],
      snapshot: [
        { path: 'Foo' },
        { path: 'Foo.bar', min: 1, max: '1', type: [{ code: 'string' }] },
      ],
    });

    const snap = await generateSnapshot(profile, { resolver: { [base.url]: base } });
    const bar = (snap.snapshot?.element || []).find((e) => e.path === 'Foo.bar');
    expect(bar).toBeDefined();
    expect(bar?.max).toBe('1');
    expect(bar?.min).toBe(1);
  });

  it('0..* tightened to max=1 with min 0 yields 0..1', async () => {
    const profile = sd({
      url: 'http://example.org/FooProfile2',
      type: 'Foo',
      baseDefinition: base.url,
      derivation: 'constraint',
      elements: [{ path: 'Foo.bar', max: '1', type: [{ code: 'string' }] }],
      snapshot: [
        { path: 'Foo' },
        { path: 'Foo.bar', min: 0, max: '1', type: [{ code: 'string' }] },
      ],
    });

    const snap = await generateSnapshot(profile, { resolver: { [base.url]: base } });
    const bar = (snap.snapshot?.element || []).find((e) => e.path === 'Foo.bar');
    expect(bar?.max).toBe('1');
  });

  // A lone slice row (max=1) on an inherited array must constrain only the
  // slice — the base sliced element stays an array (0..*). The slice's `max`
  // must not leak onto the parent element node. Reproduces the US Core lab
  // shape: the slicing is defined on an ancestor; the leaf differential carries
  // ONLY the `bar:s 1..1` slice row (no base `bar` row to reset the parent).
  it('a lone slice row tightened to max=1 keeps the base sliced element at 0..*', async () => {
    const mid = sd({
      url: 'http://example.org/FooMid',
      type: 'Foo',
      baseDefinition: base.url,
      derivation: 'constraint',
      elements: [
        { path: 'Foo.bar', slicing: { discriminator: [{ type: 'pattern', path: '$this' }], rules: 'open' } },
        { path: 'Foo.bar', sliceName: 's' },
      ],
    });
    const leaf = sd({
      url: 'http://example.org/FooLeaf',
      type: 'Foo',
      baseDefinition: mid.url,
      derivation: 'constraint',
      // ONLY the lone slice row — the array + slicing come from ancestors.
      elements: [{ path: 'Foo.bar', sliceName: 's', min: 1, max: '1', type: [{ code: 'string' }] }],
      snapshot: [
        { path: 'Foo' },
        { path: 'Foo.bar', min: 0, max: '*', type: [{ code: 'string' }] },
        { path: 'Foo.bar', sliceName: 's', min: 1, max: '1', type: [{ code: 'string' }] },
      ],
    });

    const snap = await generateSnapshot(leaf, {
      resolver: { [base.url]: base, [mid.url]: mid },
    });
    const rows = (snap.snapshot?.element || []).filter((e) => e.path === 'Foo.bar');
    const baseRow = rows.find((e) => !e.sliceName);
    const sliceRow = rows.find((e) => e.sliceName === 's');
    expect(baseRow?.max).toBe('*'); // base array unchanged (not narrowed to 1)
    expect(sliceRow?.max).toBe('1'); // slice constrained
  });
});
