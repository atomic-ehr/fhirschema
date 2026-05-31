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

const quantity = sd({
  url: 'http://hl7.org/fhir/StructureDefinition/Quantity',
  type: 'Quantity',
  kind: 'complex-type',
  baseDefinition: element.url,
  derivation: 'specialization',
  elements: [
    { path: 'Quantity.value', type: [{ code: 'decimal' }] },
    { path: 'Quantity.unit', type: [{ code: 'string' }] },
    { path: 'Quantity.system', type: [{ code: 'uri' }] },
  ],
});

const observation = sd({
  url: 'http://hl7.org/fhir/StructureDefinition/Observation',
  type: 'Observation',
  derivation: 'specialization',
  elements: [
    { path: 'Observation.value[x]', min: 0, max: '1', type: [{ code: 'Quantity' }, { code: 'string' }] },
  ],
});

// Profile narrows value[x] to Quantity and requires the Quantity.value child.
// The differential uses TYPED style (valueQuantity.value); the snapshot must come
// out in canonical [x]-style. NO input snapshot (blind generation).
const profile = sd({
  url: 'http://example.org/vital',
  type: 'Observation',
  baseDefinition: observation.url,
  derivation: 'constraint',
  elements: [
    { path: 'Observation.value[x]', min: 1, max: '1', type: [{ code: 'Quantity' }] },
    { path: 'Observation.valueQuantity.value', min: 1, max: '1', type: [{ code: 'decimal' }] },
  ],
});

const resolver = {
  [element.url]: element,
  [quantity.url]: quantity,
  [observation.url]: observation,
};

describe('snapshot: choice-variant datatype children (self-contained)', () => {
  it('does not emit duplicate element keys', async () => {
    const snap = await generateSnapshot(profile, { resolver });
    const keys = (snap.snapshot?.element || []).map((e) => `${e.path}|${e.sliceName ?? ''}`);
    const dups = keys.filter((k, i) => keys.indexOf(k) !== i);
    expect([...new Set(dups)]).toEqual([]);
  });

  it('normalizes choice paths to [x]-style and expands the narrowed type fully (blind)', async () => {
    const snap = await generateSnapshot(profile, { resolver });
    const paths = new Set((snap.snapshot?.element || []).map((e) => e.path));

    // Narrowed Quantity expands fully under [x]-style paths.
    expect(paths.has('Observation.value[x].value')).toBe(true);
    expect(paths.has('Observation.value[x].unit')).toBe(true);
    expect(paths.has('Observation.value[x].system')).toBe(true);
    // No typed valueQuantity rows leak into the snapshot.
    expect(paths.has('Observation.valueQuantity')).toBe(false);
    expect(paths.has('Observation.valueQuantity.value')).toBe(false);
  });

  it('keeps the constrained min on the choice child (no generic duplicate overriding it)', async () => {
    const snap = await generateSnapshot(profile, { resolver });
    const rows = (snap.snapshot?.element || []).filter((e) => e.path === 'Observation.value[x].value');
    expect(rows.length).toBe(1);
    expect(rows[0].min).toBe(1);
  });
});
