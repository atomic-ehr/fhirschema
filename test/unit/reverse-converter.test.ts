import { describe, expect, it } from 'bun:test';
import { toStructureDefinition, translate } from '../../src/converter';
import type { FHIRSchema } from '../../src/converter/types';

function sortObjectDeep(obj: unknown): unknown {
  if (Array.isArray(obj)) {
    const normalized = obj.map((item) => sortObjectDeep(item));
    if (normalized.every((item) => typeof item === 'string')) {
      return [...(normalized as string[])].sort();
    }
    return normalized;
  }

  if (obj && typeof obj === 'object') {
    const sorted: Record<string, unknown> = {};
    Object.keys(obj as Record<string, unknown>)
      .sort()
      .forEach((key) => {
        if (key !== 'index') {
          sorted[key] = sortObjectDeep((obj as Record<string, unknown>)[key]);
        }
      });
    return sorted;
  }

  return obj;
}

describe('FHIRSchema -> StructureDefinition Converter', () => {
  it('maps schema header fields', () => {
    const schema: FHIRSchema = {
      name: 'Patient',
      type: 'Patient',
      url: 'http://hl7.org/fhir/StructureDefinition/Patient',
      version: '4.0.1',
      description: 'Patient resource',
      kind: 'resource',
      class: 'resource',
      derivation: 'specialization',
      base: 'http://hl7.org/fhir/StructureDefinition/DomainResource',
      abstract: false,
    };

    const sd = toStructureDefinition(schema);

    expect(sd.resourceType).toBe('StructureDefinition');
    expect(sd.name).toBe('Patient');
    expect(sd.type).toBe('Patient');
    expect(sd.url).toBe('http://hl7.org/fhir/StructureDefinition/Patient');
    expect(sd.version).toBe('4.0.1');
    expect(sd.baseDefinition).toBe('http://hl7.org/fhir/StructureDefinition/DomainResource');
    expect(sd.status).toBe('active');
    expect(sd.differential?.element[0]).toEqual({ path: 'Patient', min: 0, max: '*' });
  });

  it('maps nested elements, required fields, arrays and references', () => {
    const schema: FHIRSchema = {
      name: 'Patient',
      type: 'Patient',
      url: 'http://hl7.org/fhir/StructureDefinition/Patient',
      kind: 'resource',
      class: 'resource',
      required: ['identifier'],
      elements: {
        identifier: {
          type: 'Identifier',
          array: true,
          min: 1,
          elements: {
            system: { type: 'uri' },
            value: { type: 'string' },
          },
        },
        managingOrganization: {
          type: 'Reference',
          refers: ['http://hl7.org/fhir/StructureDefinition/Organization'],
        },
      },
    };

    const sd = toStructureDefinition(schema);
    const elements = sd.differential?.element || [];

    expect(elements).toContainEqual(
      expect.objectContaining({
        path: 'Patient.identifier',
        min: 1,
        max: '*',
        type: [{ code: 'Identifier' }],
      }),
    );

    expect(elements).toContainEqual(
      expect.objectContaining({
        path: 'Patient.managingOrganization',
        type: [
          {
            code: 'Reference',
            targetProfile: ['http://hl7.org/fhir/StructureDefinition/Organization'],
          },
        ],
      }),
    );

    expect(elements).toContainEqual(
      expect.objectContaining({
        path: 'Patient.identifier.value',
        type: [{ code: 'string' }],
      }),
    );
  });

  it('maps choice fields into [x] element and preserves nested typed children', () => {
    const schema: FHIRSchema = {
      name: 'Observation',
      type: 'Observation',
      url: 'http://hl7.org/fhir/StructureDefinition/Observation',
      kind: 'resource',
      class: 'resource',
      elements: {
        value: {
          choices: ['valueString', 'valueQuantity'],
          min: 1,
          required: ['value'],
        },
        valueString: {
          type: 'string',
          choiceOf: 'value',
        },
        valueQuantity: {
          type: 'Quantity',
          choiceOf: 'value',
          elements: {
            unit: { type: 'string' },
          },
        },
      },
      required: ['value'],
    };

    const sd = toStructureDefinition(schema);
    const elements = sd.differential?.element || [];

    expect(elements).toContainEqual(
      expect.objectContaining({
        path: 'Observation.value[x]',
        min: 1,
        max: '1',
        type: [{ code: 'string' }, { code: 'Quantity' }],
      }),
    );

    expect(elements).toContainEqual(
      expect.objectContaining({
        path: 'Observation.valueQuantity.unit',
        type: [{ code: 'string' }],
      }),
    );
  });

  it('roundtrips representable schema shape', () => {
    const source: FHIRSchema = {
      name: 'SimpleObservation',
      type: 'Observation',
      url: 'http://example.org/fhir/StructureDefinition/SimpleObservation',
      kind: 'resource',
      class: 'profile',
      derivation: 'constraint',
      base: 'http://hl7.org/fhir/StructureDefinition/Observation',
      required: ['status', 'code'],
      elements: {
        status: {
          type: 'code',
          binding: {
            strength: 'required',
            valueSet: 'http://hl7.org/fhir/ValueSet/observation-status',
          },
        },
        code: {
          type: 'CodeableConcept',
        },
        subject: {
          type: 'Reference',
          refers: ['http://hl7.org/fhir/StructureDefinition/Patient'],
        },
        valueString: {
          type: 'string',
          short: 'Text value',
        },
      },
    };

    const sd = toStructureDefinition(source);
    const roundtrip = translate(sd);

    expect(sortObjectDeep(roundtrip)).toEqual(sortObjectDeep(source));
  });

  it('does not crash when pattern exists without explicit type', () => {
    const schema: FHIRSchema = {
      name: 'LabLike',
      type: 'Observation',
      url: 'http://example.org/fhir/StructureDefinition/LabLike',
      kind: 'resource',
      class: 'profile',
      elements: {
        valueString: {
          type: 'string',
          // Regression for real-world merge output where pattern.type can be absent
          pattern: { value: 'fixed-text' } as unknown as FHIRSchema['elements'][string]['pattern'],
        },
      },
    };

    const sd = toStructureDefinition(schema);
    const valueEl = sd.differential?.element.find((e) => e.path === 'Observation.valueString');
    expect(valueEl).toBeDefined();
    expect(valueEl?.patternString).toBe('fixed-text');
  });

  it('does not emit choice variants when value[x] is suppressed (max=0)', () => {
    const schema: FHIRSchema = {
      name: 'SuppressedChoiceExtensionLike',
      type: 'Extension',
      url: 'http://example.org/fhir/StructureDefinition/SuppressedChoiceExtensionLike',
      kind: 'complex-type',
      class: 'extension',
      elements: {
        value: {
          choices: ['valueString', 'valueCodeableConcept'],
          max: 0,
        },
        valueString: {
          type: 'string',
          choiceOf: 'value',
        },
        valueCodeableConcept: {
          type: 'CodeableConcept',
          choiceOf: 'value',
        },
      },
    };

    const sd = toStructureDefinition(schema);
    const keys = (sd.differential?.element || []).map((e) => e.path);
    expect(keys).toContain('Extension.value[x]');
    expect(keys).not.toContain('Extension.valueString');
    expect(keys).not.toContain('Extension.valueCodeableConcept');

    const valueX = sd.differential?.element.find((e) => e.path === 'Extension.value[x]');
    expect(valueX?.max).toBe('0');
  });

});
