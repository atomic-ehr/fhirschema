import { describe, expect, it } from 'bun:test';
import { generateSnapshot } from '../../src/converter/snapshot';
import type { StructureDefinition, StructureDefinitionElement } from '../../src/converter/types';

// Field-faithful `base` derivation (preserveSource). FHIR's base = where the element was
// first defined: a chain element's base is the rootmost chain link's path+cardinality;
// a datatype/common child's base is the TYPE-relative path (Identifier.system, Element.id),
// NOT the element path. base.min/max is the cardinality in that base definition (the
// ORIGINAL — unaffected by a profile narrowing the element).

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

const element = sd({
  url: 'http://hl7.org/fhir/StructureDefinition/Element',
  type: 'Element',
  kind: 'complex-type',
  derivation: 'specialization',
  elements: [
    { path: 'Element.id', min: 0, max: '1', type: [{ code: 'string' }] },
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
    { path: 'Identifier.system', min: 0, max: '1', type: [{ code: 'uri' }] },
    { path: 'Identifier.value', min: 0, max: '1', type: [{ code: 'string' }] },
  ],
});
const fooBase = sd({
  url: 'http://example.org/Foo',
  type: 'Foo',
  derivation: 'specialization',
  elements: [{ path: 'Foo.bar', min: 0, max: '*', type: [{ code: 'Identifier' }] }],
});

const resolver = { [element.url]: element, [identifier.url]: identifier, [fooBase.url]: fooBase };

describe('snapshot: field-faithful base derivation (preserveSource)', () => {
  it('derives correct base for chain elements, datatype children, and common children', async () => {
    const profile = sd({
      url: 'http://example.org/FooProfile',
      type: 'Foo',
      baseDefinition: fooBase.url,
      derivation: 'constraint',
      // narrow bar to 1..1 AND reach into a child so Identifier expands
      elements: [
        { path: 'Foo.bar', min: 1, max: '1', type: [{ code: 'Identifier' }] },
        { path: 'Foo.bar.system', mustSupport: true },
      ],
    });

    const snap = await generateSnapshot(profile, { resolver, preserveSource: true });
    const byPath = (p: string) =>
      (snap.snapshot?.element || []).find((e) => e.path === p) as Record<string, unknown>;

    // chain element: original 0..* (NOT the profile's narrowed 1..1)
    expect(byPath('Foo.bar').base).toEqual({ path: 'Foo.bar', min: 0, max: '*' });
    // datatype child: type-relative base path
    expect(byPath('Foo.bar.system').base).toEqual({ path: 'Identifier.system', min: 0, max: '1' });
    // common child from Element
    expect(byPath('Foo.bar.id').base).toEqual({ path: 'Element.id', min: 0, max: '1' });
  });

  it('default snapshot has no base', async () => {
    const profile = sd({
      url: 'http://example.org/FooProfile2',
      type: 'Foo',
      baseDefinition: fooBase.url,
      derivation: 'constraint',
      elements: [{ path: 'Foo.bar', mustSupport: true, type: [{ code: 'Identifier' }] }],
    });
    const snap = await generateSnapshot(profile, { resolver });
    const bar = (snap.snapshot?.element || []).find((e) => e.path === 'Foo.bar') as Record<
      string,
      unknown
    >;
    expect(bar.base).toBeUndefined();
  });
});
