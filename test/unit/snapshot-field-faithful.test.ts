import { describe, expect, it } from 'bun:test';
import { generateSnapshot } from '../../src/converter/snapshot';
import type { StructureDefinition, StructureDefinitionElement } from '../../src/converter/types';

// Opt-in field-faithful snapshot: with { preserveSource: true }, inherited documentation
// (definition, comment, mapping, …) from the base chain flows into the snapshot. Default
// off — the lean snapshot is unchanged.

function sd(args: {
  url: string;
  type: string;
  kind?: string;
  baseDefinition?: string;
  derivation?: string;
  elements: StructureDefinitionElement[];
}): StructureDefinition {
  return {
    resourceType: 'StructureDefinition',
    url: args.url,
    name: args.url.split('/').pop() as string,
    status: 'active',
    kind: (args.kind as StructureDefinition['kind']) || 'resource',
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
    {
      path: 'Foo.bar',
      min: 0,
      max: '1',
      type: [{ code: 'string' }],
      short: 'the bar',
      definition: 'The bar of the Foo.',
      comment: 'Use the bar wisely.',
      mapping: [{ identity: 'v2', map: 'BAR-1' }],
    } as StructureDefinitionElement,
  ],
});

const profile = sd({
  url: 'http://example.org/FooProfile',
  type: 'Foo',
  baseDefinition: base.url,
  derivation: 'constraint',
  elements: [{ path: 'Foo.bar', mustSupport: true, type: [{ code: 'string' }] }],
});

const resolver = { [base.url]: base };
const barOf = async (preserveSource: boolean) => {
  const snap = await generateSnapshot(profile, { resolver, preserveSource });
  return (snap.snapshot?.element || []).find((e) => e.path === 'Foo.bar') as Record<string, unknown>;
};

describe('snapshot: opt-in field-faithful documentation', () => {
  it('default snapshot does NOT carry inherited definition/comment/mapping', async () => {
    const bar = await barOf(false);
    expect(bar.definition).toBeUndefined();
    expect(bar.comment).toBeUndefined();
    expect(bar.mapping).toBeUndefined();
    expect(bar.fhir).toBeUndefined();
  });

  it('preserveSource snapshot carries inherited definition/comment/mapping', async () => {
    const bar = await barOf(true);
    expect(bar.definition).toBe('The bar of the Foo.');
    expect(bar.comment).toBe('Use the bar wisely.');
    expect(bar.mapping).toEqual([{ identity: 'v2', map: 'BAR-1' }]);
    expect(bar.mustSupport).toBe(true); // the profile's own constraint still applies
    expect(bar.fhir).toBeUndefined(); // restored to top-level, no sidecar leak
  });

  it('preserveSource synthesizes a path-based id and fills isModifier:false', async () => {
    const bar = await barOf(true);
    expect(bar.id).toBe('Foo.bar');
    expect(bar.isModifier).toBe(false);
    // default leaves these off
    const lean = await barOf(false);
    expect(lean.id).toBeUndefined();
    expect(lean.isModifier).toBeUndefined();
  });
});
