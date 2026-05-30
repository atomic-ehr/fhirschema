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
    kind: args.kind || 'complex-type',
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
  derivation: 'specialization',
  elements: [
    { path: 'Element.id', type: [{ code: 'string' }] },
    { path: 'Element.extension', min: 0, max: '*', type: [{ code: 'Extension' }] },
  ],
});
const coding = sd({
  url: 'http://hl7.org/fhir/StructureDefinition/Coding',
  type: 'Coding',
  baseDefinition: element.url,
  derivation: 'specialization',
  elements: [
    { path: 'Coding.system', type: [{ code: 'uri' }] },
    { path: 'Coding.code', type: [{ code: 'code' }] },
  ],
});
const codeableConcept = sd({
  url: 'http://hl7.org/fhir/StructureDefinition/CodeableConcept',
  type: 'CodeableConcept',
  baseDefinition: element.url,
  derivation: 'specialization',
  elements: [
    { path: 'CodeableConcept.coding', min: 0, max: '*', type: [{ code: 'Coding' }] },
    { path: 'CodeableConcept.text', type: [{ code: 'string' }] },
  ],
});
const quantity = sd({
  url: 'http://hl7.org/fhir/StructureDefinition/Quantity',
  type: 'Quantity',
  baseDefinition: element.url,
  derivation: 'specialization',
  elements: [
    { path: 'Quantity.value', type: [{ code: 'decimal' }] },
    { path: 'Quantity.comparator', type: [{ code: 'code' }] },
    { path: 'Quantity.unit', type: [{ code: 'string' }] },
  ],
});
const obs = sd({
  url: 'http://example.org/Obs',
  type: 'Observation',
  kind: 'resource',
  derivation: 'specialization',
  elements: [
    { path: 'Observation.component', min: 0, max: '*', type: [{ code: 'BackboneElement' }] },
    { path: 'Observation.component.code', type: [{ code: 'CodeableConcept' }] },
    {
      path: 'Observation.component.value[x]',
      type: [{ code: 'CodeableConcept' }, { code: 'Quantity' }],
    },
  ],
});

const resolver = {
  [element.url]: element,
  [coding.url]: coding,
  [codeableConcept.url]: codeableConcept,
  [quantity.url]: quantity,
  [obs.url]: obs,
};

describe('snapshot: resliced value[x] expands each slice type’s datatype children', () => {
  it('expands both CodeableConcept and Quantity children when value[x] is resliced per type', async () => {
    const profile = sd({
      url: 'http://example.org/ObsProfile',
      type: 'Observation',
      kind: 'resource',
      baseDefinition: obs.url,
      derivation: 'constraint',
      elements: [
        {
          path: 'Observation.component',
          slicing: { discriminator: [{ type: 'pattern', path: 'code' }], rules: 'open' },
        },
        { path: 'Observation.component', sliceName: 'cc' },
        { path: 'Observation.component.value[x]', type: [{ code: 'CodeableConcept' }] },
        { path: 'Observation.component', sliceName: 'qty' },
        { path: 'Observation.component.value[x]', type: [{ code: 'Quantity' }] },
      ],
      // Source oracle: both the CC child and the Quantity child are present.
      snapshot: [
        { path: 'Observation' },
        { path: 'Observation.component', type: [{ code: 'BackboneElement' }] },
        { path: 'Observation.component', sliceName: 'cc', type: [{ code: 'BackboneElement' }] },
        { path: 'Observation.component.value[x]', type: [{ code: 'CodeableConcept' }] },
        { path: 'Observation.component.value[x].coding', type: [{ code: 'Coding' }] },
        { path: 'Observation.component', sliceName: 'qty', type: [{ code: 'BackboneElement' }] },
        { path: 'Observation.component.value[x]', type: [{ code: 'Quantity' }] },
        { path: 'Observation.component.value[x].comparator', type: [{ code: 'code' }] },
      ],
    });

    const snap = await generateSnapshot(profile, { resolver });
    const paths = new Set((snap.snapshot?.element || []).map((e) => e.path));

    expect(paths.has('Observation.component.value[x].coding')).toBe(true); // CC slice
    expect(paths.has('Observation.component.value[x].comparator')).toBe(true); // Quantity slice
  });
});
