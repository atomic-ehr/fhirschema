import { describe, expect, it } from 'bun:test';
import { generateSnapshot } from '../../src/converter/snapshot';
import type { StructureDefinition, StructureDefinitionElement } from '../../src/converter/types';

// Self-containment invariant: generateSnapshot derives the snapshot purely from the
// differential + resolved base chain. It must NEVER read the input SD's own snapshot.
// Proof: generating with a deliberately wrong input `snapshot` produces byte-identical
// output to generating with no input snapshot at all.

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
    kind: args.kind || 'resource',
    type: args.type,
    ...(args.baseDefinition ? { baseDefinition: args.baseDefinition } : {}),
    ...(args.derivation ? { derivation: args.derivation } : {}),
    differential: { element: [{ path: args.type }, ...args.elements] },
  };
}

const element = sd({
  url: 'http://hl7.org/fhir/StructureDefinition/Element',
  type: 'Element',
  kind: 'complex-type',
  derivation: 'specialization',
  elements: [
    { path: 'Element.id', type: [{ code: 'string' }] },
    { path: 'Element.extension', min: 0, max: '*', type: [{ code: 'Extension' }] },
  ],
});
const identifier = sd({
  url: 'http://hl7.org/fhir/StructureDefinition/Identifier',
  type: 'Identifier',
  kind: 'complex-type',
  baseDefinition: element.url,
  derivation: 'specialization',
  elements: [
    { path: 'Identifier.system', type: [{ code: 'uri' }] },
    { path: 'Identifier.value', type: [{ code: 'string' }] },
  ],
});
const fooBase = sd({
  url: 'http://example.org/Foo',
  type: 'Foo',
  derivation: 'specialization',
  elements: [{ path: 'Foo.identifier', min: 0, max: '*', type: [{ code: 'Identifier' }] }],
});
const resolver = { [element.url]: element, [identifier.url]: identifier, [fooBase.url]: fooBase };

describe('snapshot: self-containment (input snapshot is never consulted)', () => {
  it('produces identical output whether the input SD has a (wrong) snapshot or none', async () => {
    const base = sd({
      url: 'http://example.org/FooProfile',
      type: 'Foo',
      baseDefinition: fooBase.url,
      derivation: 'constraint',
      elements: [
        { path: 'Foo.identifier', mustSupport: true, type: [{ code: 'Identifier' }] },
        { path: 'Foo.identifier.system', mustSupport: true },
      ],
    });

    const withoutSnapshot = await generateSnapshot(base, { resolver });

    // A deliberately bogus input snapshot — if it were consulted, the output would change.
    const withBogusSnapshot = await generateSnapshot(
      {
        ...base,
        snapshot: {
          element: [
            { path: 'Foo' },
            { path: 'Foo.identifier' },
            { path: 'Foo.identifier.NONEXISTENT', type: [{ code: 'string' }] },
            { path: 'Foo.bogus[x]', sliceName: 'bogusString', type: [{ code: 'string' }] },
          ],
        },
      },
      { resolver },
    );

    expect(withBogusSnapshot.snapshot?.element).toEqual(withoutSnapshot.snapshot?.element);
    // sanity: the structural result really did expand the reached datatype
    const paths = new Set((withoutSnapshot.snapshot?.element || []).map((e) => e.path));
    expect(paths.has('Foo.identifier.value')).toBe(true);
    expect(paths.has('Foo.identifier.NONEXISTENT')).toBe(false);
  });
});
