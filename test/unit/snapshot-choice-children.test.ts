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
const profile = sd({
  url: 'http://example.org/vital',
  type: 'Observation',
  baseDefinition: observation.url,
  derivation: 'constraint',
  elements: [
    { path: 'Observation.value[x]', min: 1, max: '1', type: [{ code: 'Quantity' }] },
    { path: 'Observation.valueQuantity.value', min: 1, max: '1', type: [{ code: 'decimal' }] },
  ],
  // Source snapshot uses [x]-style child path rows.
  snapshot: [
    { path: 'Observation' },
    { path: 'Observation.value[x]', min: 1, max: '1', type: [{ code: 'Quantity' }] },
    { path: 'Observation.value[x].value', min: 1, max: '1', type: [{ code: 'decimal' }] },
    { path: 'Observation.value[x].unit', min: 0, max: '1', type: [{ code: 'string' }] },
    { path: 'Observation.value[x].system', min: 0, max: '1', type: [{ code: 'uri' }] },
  ],
});

const resolver = {
  [element.url]: element,
  [quantity.url]: quantity,
  [observation.url]: observation,
};

describe('snapshot: choice-variant datatype children', () => {
  it('does not emit duplicate element keys', async () => {
    const snap = await generateSnapshot(profile, { resolver });
    const keys = (snap.snapshot?.element || []).map((e) => `${e.path}|${e.sliceName ?? ''}`);
    const dups = keys.filter((k, i) => keys.indexOf(k) !== i);
    expect([...new Set(dups)]).toEqual([]);
  });

  it('keeps the constrained min on the choice child (no generic duplicate overriding it)', async () => {
    const snap = await generateSnapshot(profile, { resolver });
    const rows = (snap.snapshot?.element || []).filter((e) => e.path === 'Observation.value[x].value');
    expect(rows.length).toBe(1);
    expect(rows[0].min).toBe(1);
  });
});
