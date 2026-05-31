import { describe, expect, it } from 'bun:test';
import { generateSnapshot } from '../../src/converter/snapshot';
import type { StructureDefinition, StructureDefinitionElement } from '../../src/converter/types';

// A simple extension (carries a value[x], no sub-extensions) constrains
// Extension.extension to 0..0. The forward hoists that into excluded[], but the base
// Extension's `extension 0..*` survives the merge — the reverse must emit 0..0 (the
// prohibition), not the generic 0..* slot. (Audit: 460 cases, e.g. 11179-objectClass.)

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
    kind: (args.kind as StructureDefinition['kind']) || 'complex-type',
    type: args.type,
    ...(args.baseDefinition ? { baseDefinition: args.baseDefinition } : {}),
    ...(args.derivation ? { derivation: args.derivation } : {}),
    differential: { element: [{ path: args.type }, ...args.elements] },
  };
}

const element = sd({
  url: 'http://hl7.org/fhir/StructureDefinition/Element',
  type: 'Element',
  derivation: 'specialization',
  elements: [
    { path: 'Element.id', type: [{ code: 'string' }] },
    { path: 'Element.extension', min: 0, max: '*', type: [{ code: 'Extension' }] },
  ],
});
const extension = sd({
  url: 'http://hl7.org/fhir/StructureDefinition/Extension',
  type: 'Extension',
  baseDefinition: element.url,
  derivation: 'specialization',
  elements: [
    { path: 'Extension.extension', min: 0, max: '*', type: [{ code: 'Extension' }] },
    { path: 'Extension.url', type: [{ code: 'uri' }] },
    { path: 'Extension.value[x]', min: 0, max: '1', type: [{ code: 'string' }, { code: 'code' }] },
  ],
});

describe('snapshot: simple extension forbids sub-extensions (Extension.extension 0..0)', () => {
  it('emits Extension.extension 0..0 when the profile excludes it', async () => {
    const profile = sd({
      url: 'http://example.org/MyExt',
      type: 'Extension',
      baseDefinition: extension.url,
      derivation: 'constraint',
      elements: [
        { path: 'Extension.extension', max: '0' },
        { path: 'Extension.value[x]', min: 1, max: '1', type: [{ code: 'code' }] },
      ],
    });

    const snap = await generateSnapshot(profile, {
      resolver: { [element.url]: element, [extension.url]: extension },
    });
    const rows = (snap.snapshot?.element || []).filter((e) => e.path === 'Extension.extension');

    expect(rows.length).toBe(1);
    expect(rows[0].max).toBe('0');
  });
});
