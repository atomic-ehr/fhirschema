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

// Identifier datatype — NOT in the legacy allowlist
const identifier = sd({
  url: 'http://hl7.org/fhir/StructureDefinition/Identifier',
  type: 'Identifier',
  kind: 'complex-type',
  baseDefinition: element.url,
  derivation: 'specialization',
  elements: [
    { path: 'Identifier.use', type: [{ code: 'code' }] },
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

describe('snapshot: inherited datatype-children expansion (beyond legacy allowlist)', () => {
  it('expands Identifier children one level when present in source snapshot', async () => {
    const profile = sd({
      url: 'http://example.org/FooProfile',
      type: 'Foo',
      baseDefinition: fooBase.url,
      derivation: 'constraint',
      elements: [{ path: 'Foo.identifier', mustSupport: true, type: [{ code: 'Identifier' }] }],
      snapshot: [
        { path: 'Foo' },
        { path: 'Foo.identifier', type: [{ code: 'Identifier' }] },
        { path: 'Foo.identifier.use', type: [{ code: 'code' }] },
        { path: 'Foo.identifier.system', type: [{ code: 'uri' }] },
        { path: 'Foo.identifier.value', type: [{ code: 'string' }] },
      ],
    });

    const snap = await generateSnapshot(profile, {
      resolver: {
        [element.url]: element,
        [identifier.url]: identifier,
        [fooBase.url]: fooBase,
      },
    });

    const paths = new Set((snap.snapshot?.element || []).map((e) => e.path));
    expect(paths.has('Foo.identifier.use')).toBe(true);
    expect(paths.has('Foo.identifier.system')).toBe(true);
    expect(paths.has('Foo.identifier.value')).toBe(true);
  });

  it('fills type onto an explicitly-constrained nested child that has no type', async () => {
    const profile = sd({
      url: 'http://example.org/FooProfile2',
      type: 'Foo',
      baseDefinition: fooBase.url,
      derivation: 'constraint',
      elements: [
        { path: 'Foo.identifier', mustSupport: true, type: [{ code: 'Identifier' }] },
        // constrained child, mustSupport only — NO type declared
        { path: 'Foo.identifier.system', mustSupport: true },
      ],
      snapshot: [
        { path: 'Foo' },
        { path: 'Foo.identifier', type: [{ code: 'Identifier' }] },
        { path: 'Foo.identifier.system', type: [{ code: 'uri' }], mustSupport: true },
      ],
    });

    const snap = await generateSnapshot(profile, {
      resolver: {
        [element.url]: element,
        [identifier.url]: identifier,
        [fooBase.url]: fooBase,
      },
    });

    const sys = (snap.snapshot?.element || []).find((e) => e.path === 'Foo.identifier.system');
    expect(sys).toBeDefined();
    expect(sys?.mustSupport).toBe(true);
    expect((sys?.type || []).map((t) => t.code)).toEqual(['uri']);
  });

  it('expands a primitive element\'s children when the source profiles them (canonical.id/.value)', async () => {
    const canonicalType = sd({
      url: 'http://hl7.org/fhir/StructureDefinition/canonical',
      type: 'canonical',
      kind: 'primitive-type',
      derivation: 'specialization',
      elements: [
        { path: 'canonical.id', type: [{ code: 'string' }] },
        { path: 'canonical.extension', min: 0, max: '*', type: [{ code: 'Extension' }] },
        { path: 'canonical.value', type: [{ code: 'string' }] },
      ],
    });
    const qrBase = sd({
      url: 'http://example.org/QR',
      type: 'QR',
      derivation: 'specialization',
      elements: [{ path: 'QR.questionnaire', type: [{ code: 'canonical' }] }],
    });
    const profile = sd({
      url: 'http://example.org/QRProfile',
      type: 'QR',
      baseDefinition: qrBase.url,
      derivation: 'constraint',
      elements: [{ path: 'QR.questionnaire', mustSupport: true, type: [{ code: 'canonical' }] }],
      snapshot: [
        { path: 'QR' },
        { path: 'QR.questionnaire', type: [{ code: 'canonical' }] },
        { path: 'QR.questionnaire.id', type: [{ code: 'string' }] },
        { path: 'QR.questionnaire.value', type: [{ code: 'string' }] },
      ],
    });

    const snap = await generateSnapshot(profile, {
      resolver: {
        [element.url]: element,
        [canonicalType.url]: canonicalType,
        [qrBase.url]: qrBase,
      },
    });

    const paths = new Set((snap.snapshot?.element || []).map((e) => e.path));
    expect(paths.has('QR.questionnaire.id')).toBe(true);
    expect(paths.has('QR.questionnaire.value')).toBe(true);
  });

  it('does NOT expand primitive-typed children (no lowercase-type value rows)', async () => {
    const profile = sd({
      url: 'http://example.org/FooProfile3',
      type: 'Foo',
      baseDefinition: fooBase.url,
      derivation: 'constraint',
      elements: [{ path: 'Foo.identifier', mustSupport: true, type: [{ code: 'Identifier' }] }],
      snapshot: [
        { path: 'Foo' },
        { path: 'Foo.identifier', type: [{ code: 'Identifier' }] },
        { path: 'Foo.identifier.value', type: [{ code: 'string' }] },
      ],
    });

    const snap = await generateSnapshot(profile, {
      resolver: {
        [element.url]: element,
        [identifier.url]: identifier,
        [fooBase.url]: fooBase,
      },
    });

    const paths = new Set((snap.snapshot?.element || []).map((e) => e.path));
    // value is a string (primitive) → its own children must NOT be expanded
    expect(paths.has('Foo.identifier.value.value')).toBe(false);
  });
});
