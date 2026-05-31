import { describe, expect, it } from 'bun:test';
import { generateSnapshot } from '../../src/converter/snapshot';
import type { StructureDefinition, StructureDefinitionElement } from '../../src/converter/types';

// Self-contained snapshot generation: datatype children are expanded by resolving
// the datatype's StructureDefinition through the resolver — NOT by peeking at an
// input `snapshot`. Every SD here is hand-written and the profile under test
// carries NO `snapshot` (blind generation).
//
// FHIR expansion rule (verified against real R4/US-Core snapshots):
//   * an inherited datatype element is expanded ONLY when the profile "reaches
//     into" it — i.e. some merged element is a strict descendant of it;
//   * when it does, the type's FULL one-level child set is materialized (not just
//     the constrained child);
//   * an untouched complex child stays a leaf (no further expansion).

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

const period = sd({
  url: 'http://hl7.org/fhir/StructureDefinition/Period',
  type: 'Period',
  kind: 'complex-type',
  baseDefinition: element.url,
  derivation: 'specialization',
  elements: [
    { path: 'Period.start', type: [{ code: 'dateTime' }] },
    { path: 'Period.end', type: [{ code: 'dateTime' }] },
  ],
});

const identifier = sd({
  url: 'http://hl7.org/fhir/StructureDefinition/Identifier',
  type: 'Identifier',
  kind: 'complex-type',
  baseDefinition: element.url,
  derivation: 'specialization',
  elements: [
    { path: 'Identifier.use', type: [{ code: 'code' }] },
    { path: 'Identifier.type', type: [{ code: 'CodeableConcept' }] },
    { path: 'Identifier.system', type: [{ code: 'uri' }] },
    { path: 'Identifier.value', type: [{ code: 'string' }] },
    { path: 'Identifier.period', type: [{ code: 'Period' }] },
  ],
});

const fooBase = sd({
  url: 'http://example.org/Foo',
  type: 'Foo',
  derivation: 'specialization',
  elements: [{ path: 'Foo.identifier', min: 0, max: '*', type: [{ code: 'Identifier' }] }],
});

const resolver = {
  [element.url]: element,
  [period.url]: period,
  [identifier.url]: identifier,
  [fooBase.url]: fooBase,
};

const profile = (elements: StructureDefinitionElement[]): StructureDefinition =>
  sd({
    url: `http://example.org/FooProfile-${elements.length}-${elements.map((e) => e.path).join(',')}`,
    type: 'Foo',
    baseDefinition: fooBase.url,
    derivation: 'constraint',
    elements,
  });

const pathsOf = async (p: StructureDefinition) => {
  const snap = await generateSnapshot(p, { resolver });
  return new Set((snap.snapshot?.element || []).map((e) => e.path));
};

describe('snapshot (self-contained): datatype expansion via resolver, no input snapshot', () => {
  it('touching one child materializes the type\'s FULL one-level child set (blind)', async () => {
    // Profile reaches into identifier (constrains .system) → full Identifier set.
    const paths = await pathsOf(
      profile([
        { path: 'Foo.identifier', mustSupport: true, type: [{ code: 'Identifier' }] },
        { path: 'Foo.identifier.system', mustSupport: true },
      ]),
    );

    for (const child of ['id', 'extension', 'use', 'type', 'system', 'value', 'period']) {
      expect(paths.has(`Foo.identifier.${child}`)).toBe(true);
    }
  });

  it('an UNTOUCHED inherited datatype element is not expanded (blind)', async () => {
    // Only mustSupport on identifier, no descendant constraint → no children.
    const paths = await pathsOf(
      profile([{ path: 'Foo.identifier', mustSupport: true, type: [{ code: 'Identifier' }] }]),
    );

    expect(paths.has('Foo.identifier')).toBe(true);
    expect(paths.has('Foo.identifier.use')).toBe(false);
    expect(paths.has('Foo.identifier.system')).toBe(false);
  });

  it('an untouched complex CHILD stays a leaf (period not expanded) (blind)', async () => {
    const paths = await pathsOf(
      profile([
        { path: 'Foo.identifier', mustSupport: true, type: [{ code: 'Identifier' }] },
        { path: 'Foo.identifier.system', mustSupport: true },
      ]),
    );

    expect(paths.has('Foo.identifier.period')).toBe(true); // present (one level)
    expect(paths.has('Foo.identifier.period.start')).toBe(false); // not reached into
  });

  it('reaching deep expands the full set at EACH touched level (blind)', async () => {
    // Constrain identifier.period.start → identifier expands fully AND period expands fully.
    const paths = await pathsOf(
      profile([
        { path: 'Foo.identifier', mustSupport: true, type: [{ code: 'Identifier' }] },
        { path: 'Foo.identifier.period.start', mustSupport: true },
      ]),
    );

    expect(paths.has('Foo.identifier.use')).toBe(true); // full set at identifier
    expect(paths.has('Foo.identifier.period.start')).toBe(true);
    expect(paths.has('Foo.identifier.period.end')).toBe(true); // full set at period
    // value is a primitive leaf, untouched → no grandchildren
    expect(paths.has('Foo.identifier.value.value')).toBe(false);
  });
});
