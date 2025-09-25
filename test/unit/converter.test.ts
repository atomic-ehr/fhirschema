import { describe, expect, it } from 'bun:test';
import { calculateActions, getCommonPath, parsePath, translate } from '../../src/converter';
import type { StructureDefinition, StructureDefinitionElement } from '../../src/converter/types';

// Helper function to create a minimal StructureDefinition for testing
function createTestStructureDefinition(
  elements: Partial<StructureDefinitionElement>[],
): StructureDefinition {
  return {
    resourceType: 'StructureDefinition',
    url: 'http://test.org/StructureDefinition/Test',
    name: 'Test',
    status: 'active',
    kind: 'resource',
    type: 'Test',
    differential: {
      element: elements.map((el) => ({
        path: el.path || 'Test',
        ...el,
      })) as StructureDefinitionElement[],
    },
  };
}

describe('Converter Algorithm Tests', () => {
  describe('parsePath', () => {
    it('should parse simple paths', () => {
      expect(parsePath({ path: 'R.a' } as StructureDefinitionElement)).toEqual([{ el: 'a' }]);
      expect(parsePath({ path: 'R.a.b' } as StructureDefinitionElement)).toEqual([
        { el: 'a' },
        { el: 'b' },
      ]);
    });
  });

  describe('calculateActions', () => {
    it('should calculate basic actions', () => {
      expect(
        calculateActions(
          parsePath({ path: 'R.a' } as StructureDefinitionElement),
          parsePath({ path: 'R.b' } as StructureDefinitionElement),
        ),
      ).toEqual([
        { type: 'exit', el: 'a' },
        { type: 'enter', el: 'b' },
      ]);

      expect(
        calculateActions(
          parsePath({ path: 'R.a' } as StructureDefinitionElement),
          parsePath({ path: 'R.b.c' } as StructureDefinitionElement),
        ),
      ).toEqual([
        { type: 'exit', el: 'a' },
        { type: 'enter', el: 'b' },
        { type: 'enter', el: 'c' },
      ]);

      expect(
        calculateActions(parsePath({ path: 'R.a.b.c' } as StructureDefinitionElement), []),
      ).toEqual([
        { type: 'exit', el: 'c' },
        { type: 'exit', el: 'b' },
        { type: 'exit', el: 'a' },
      ]);
    });

    it('should handle slices', () => {
      const path1 = parsePath({ path: 'R.a', sliceName: 's1' } as StructureDefinitionElement);
      path1.push({ el: 'b' });

      expect(calculateActions([], path1)).toEqual([
        { type: 'enter', el: 'a' },
        { type: 'enter-slice', sliceName: 's1' },
        { type: 'enter', el: 'b' },
      ]);

      const path2 = parsePath({ path: 'R.a', sliceName: 's1' } as StructureDefinitionElement);
      path2.push({ el: 'b' });
      const path3 = parsePath({ path: 'R.a', sliceName: 's2' } as StructureDefinitionElement);

      expect(calculateActions(path2, path3)).toEqual([
        { type: 'exit', el: 'b' },
        { type: 'exit-slice', sliceName: 's1', slice: {} },
        { type: 'enter-slice', sliceName: 's2' },
      ]);

      expect(calculateActions(path2, [])).toEqual([
        { type: 'exit', el: 'b' },
        { type: 'exit-slice', sliceName: 's1', slice: {} },
        { type: 'exit', el: 'a' },
      ]);
    });
  });

  describe('getCommonPath', () => {
    it('should find common path with slices', () => {
      const path1 = parsePath({ path: 'R.a.c', sliceName: 's1' } as StructureDefinitionElement);
      path1.push({ el: 'b' });

      const path2 = parsePath({ path: 'R.a.c', sliceName: 's2' } as StructureDefinitionElement);

      expect(getCommonPath(path1, path2)).toEqual([{ el: 'a' }, { el: 'c' }]);
    });
  });

  describe('translate', () => {
    it('should handle nested elements', () => {
      const els: Partial<StructureDefinitionElement>[] = [
        { path: 'R', short: 'a' },
        { path: 'R.a', short: 'a' },
        { path: 'R.b', short: 'b' },
        { path: 'R.c', short: 'c' },
        { path: 'R.c.d', short: 'c.d' },
        { path: 'R.c.d.f', short: 'c.d.f' },
        { path: 'R.c.d.i', short: 'c.d.i' },
        { path: 'R.x', short: 'x' },
        { path: 'R.x', slicing: { discriminator: [{ type: 'pattern', path: 'a' }] } },
        { path: 'R.x', sliceName: 's1' },
        { path: 'R.x.a', short: 'x.s1.a', patternString: 's1' },
        { path: 'R.x.b', short: 'x.s1.b' },
        { path: 'R.x', sliceName: 's2' },
        { path: 'R.x.a', short: 'x.s2.a', patternString: 's2' },
        { path: 'R.x.b', short: 'x.s2.b' },
      ];

      const result = translate(createTestStructureDefinition(els));

      expect(result.elements).toBeDefined();
      expect(result.elements?.a).toMatchObject({ short: 'a' });
      expect(result.elements?.b).toMatchObject({ short: 'b' });
      expect(result.elements?.c).toMatchObject({
        short: 'c',
        elements: {
          d: {
            short: 'c.d',
            elements: {
              f: { short: 'c.d.f' },
              i: { short: 'c.d.i' },
            },
          },
        },
      });

      expect(result.elements?.x.slicing).toBeDefined();
      expect(result.elements?.x.slicing?.slices?.s1).toBeDefined();
      expect(result.elements?.x.slicing?.slices?.s1.match).toEqual({ a: 's1' });
      expect(result.elements?.x.slicing?.slices?.s2.match).toEqual({ a: 's2' });
    });

    it('should handle cardinality and required elements', () => {
      const result1 = translate(createTestStructureDefinition([{ path: 'A.x', min: 1, max: '*' }]));

      expect(result1.required).toEqual(['x']);
      expect(result1.elements?.x).toMatchObject({
        array: true,
        min: 1,
      });

      const result2 = translate(
        createTestStructureDefinition([{ path: 'A.x', min: 1, max: '10' }]),
      );

      expect(result2.required).toEqual(['x']);
      expect(result2.elements?.x).toMatchObject({
        array: true,
        min: 1,
        max: 10,
      });
    });

    it('should handle types', () => {
      const result = translate(
        createTestStructureDefinition([{ path: 'A.x', type: [{ code: 'string' }] }]),
      );

      expect(result.elements?.x).toMatchObject({ type: 'string' });
    });

    it('should handle nested slices', () => {
      const els: Partial<StructureDefinitionElement>[] = [
        { path: 'R.x', short: 'x', slicing: { discriminator: [{ type: 'pattern', path: 'a' }] } },
        { path: 'R.x', sliceName: 's1' },
        { path: 'R.x.a', short: 'x.s1.a', patternString: 's1' },
        {
          path: 'R.x.b',
          short: 'x.s1.b',
          slicing: { discriminator: [{ type: 'pattern', path: 'f.ff' }] },
        },
        { path: 'R.x.b', sliceName: 'z1' },
        { path: 'R.x.b.f', short: 'x.s1.b.z1.f' },
        { path: 'R.x.b.f.ff', short: 'x.s1.b.z1.ff', patternCoding: { code: 'z1' } },
        { path: 'R.x.b', sliceName: 'z2' },
        { path: 'R.x.b.f', short: 'x.s1.b.z2.f' },
        { path: 'R.x.b.f.ff', short: 'x.s1.b.z2.ff', patternCoding: { code: 'z2' } },
        { path: 'R.x', sliceName: 's2' },
        { path: 'R.x.a', short: 'x.s2.a', patternString: 's2' },
        { path: 'R.x.b', short: 'x.s2.b' },
        { path: 'R.z', short: 'z' },
      ];

      const result = translate(createTestStructureDefinition(els));

      expect(result.elements?.z).toMatchObject({ short: 'z' });
      expect(result.elements?.x.slicing?.slices?.s1.schema?.elements?.b.slicing).toBeDefined();
      expect(
        result.elements?.x.slicing?.slices?.s1.schema?.elements?.b.slicing?.slices?.z1.match,
      ).toEqual({
        f: { ff: { code: 'z1' } },
      });
    });

    it('should handle choice types', () => {
      const els: Partial<StructureDefinitionElement>[] = [
        {
          path: 'R.value[x]',
          type: [{ code: 'string' }, { code: 'Quantity' }],
        },
        { path: 'R.valueQuantity.unit', short: 'unit' },
      ];

      const result = translate(createTestStructureDefinition(els));

      expect(result.elements?.value).toMatchObject({
        choices: ['valueString', 'valueQuantity'],
      });
      expect(result.elements?.valueString).toMatchObject({
        type: 'string',
        choiceOf: 'value',
      });
      expect(result.elements?.valueQuantity).toMatchObject({
        type: 'Quantity',
        choiceOf: 'value',
        elements: { unit: { short: 'unit' } },
      });
    });

    it('should handle choice types without [x] suffix', () => {
      const els: Partial<StructureDefinitionElement>[] = [
        {
          path: 'R.value',
          type: [{ code: 'string' }, { code: 'Quantity' }],
        },
        { path: 'R.valueQuantity.unit', short: 'unit' },
      ];

      const result = translate(createTestStructureDefinition(els));

      expect(result.elements?.value).toMatchObject({
        choices: ['valueString', 'valueQuantity'],
      });
    });

    it('should handle required choice types', () => {
      const els: Partial<StructureDefinitionElement>[] = [
        {
          path: 'R.value[x]',
          type: [{ code: 'string' }, { code: 'Quantity' }],
          min: 1,
          max: '1',
        },
        { path: 'R.valueQuantity.unit', short: 'unit' },
      ];

      const result = translate(createTestStructureDefinition(els));

      expect(result.required).toEqual(['value']);
      expect(result.elements?.value).toMatchObject({
        choices: ['valueString', 'valueQuantity'],
      });
    });

    it('should handle pattern slicing', () => {
      const result = translate(
        createTestStructureDefinition([
          {
            path: 'R.category',
            slicing: { discriminator: [{ type: 'pattern', path: '$this' }], rules: 'open' },
            min: 1,
            max: '10',
            mustSupport: true,
          },
          {
            path: 'R.category',
            sliceName: 'LaboratorySlice',
            min: 2,
            max: '3',
            patternCodeableConcept: { coding: [{ system: 'CodeSystem', code: 'LAB' }] },
            mustSupport: true,
          },
          {
            path: 'R.category',
            sliceName: 'Radiologylice',
            min: 4,
            max: '5',
            patternCodeableConcept: { coding: [{ system: 'CodeSystem', code: 'RAD' }] },
            mustSupport: true,
          },
        ]),
      );

      expect(result.required).toEqual(['category']);
      expect(result.elements?.category.mustSupport).toBe(true);
      expect(result.elements?.category.min).toBe(1);
      expect(result.elements?.category.max).toBe(10);

      const labSlice = result.elements?.category.slicing?.slices?.LaboratorySlice;
      expect(labSlice?.min).toBe(2);
      expect(labSlice?.max).toBe(3);
      expect(labSlice?.match).toEqual({ coding: [{ system: 'CodeSystem', code: 'LAB' }] });
    });

    it('should handle extension slices', () => {
      const result = translate(
        createTestStructureDefinition([
          { path: 'Patient', mustSupport: false },
          { path: 'Patient.name', mustSupport: true },
          {
            sliceName: 'race',
            path: 'Patient.extension',
            min: 1,
            max: '1',
            type: [
              {
                code: 'Extension',
                profile: ['http://hl7.org/fhir/us/core/StructureDefinition/us-core-race'],
              },
            ],
          },
          {
            sliceName: 'ethnicity',
            path: 'Patient.extension',
            min: 0,
            max: '1',
            type: [
              {
                code: 'Extension',
                profile: ['http://hl7.org/fhir/us/core/StructureDefinition/us-core-ethnicity'],
              },
            ],
          },
          {
            sliceName: 'tribal',
            path: 'Patient.extension',
            min: 0,
            max: '8',
            type: [
              {
                code: 'Extension',
                profile: [
                  'http://hl7.org/fhir/us/core/StructureDefinition/us-core-tribal-affiliation',
                ],
              },
            ],
          },
          {
            sliceName: 'birthsex',
            path: 'Patient.extension',
            min: 0,
            max: '1',
            short: 'Birth Sex Extension',
            type: [
              {
                code: 'Extension',
                profile: ['http://hl7.org/fhir/us/core/StructureDefinition/us-core-birthsex'],
              },
            ],
          },
        ]),
      );

      expect(result.extensions).toBeDefined();
      expect(result.extensions?.race).toMatchObject({
        url: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-race',
        min: 1,
        max: 1,
      });
      expect(result.extensions?.ethnicity).toMatchObject({
        url: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-ethnicity',
        max: 1,
      });
      expect(result.extensions?.tribal).toMatchObject({
        url: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-tribal-affiliation',
        max: 8,
      });
      expect(result.extensions?.birthsex).toMatchObject({
        url: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-birthsex',
        max: 1,
        short: 'Birth Sex Extension',
      });
      expect(result.elements?.name?.mustSupport).toBe(true);
    });

    it('should handle reference types with multiple targets', () => {
      const result = translate(
        createTestStructureDefinition([
          {
            path: 'CareTeam.member',
            type: [
              {
                code: 'Reference',
                targetProfile: ['http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient'],
              },
              {
                code: 'Reference',
                targetProfile: ['http://hl7.org/fhir/StructureDefinition/Practitioner'],
              },
              {
                code: 'Reference',
                targetProfile: ['http://hl7.org/fhir/StructureDefinition/RelatedPerson'],
              },
              { code: 'Reference' },
            ],
          },
        ]),
      );

      expect(result.elements?.member).toMatchObject({
        type: 'Reference',
        refers: [
          'http://hl7.org/fhir/StructureDefinition/Practitioner',
          'http://hl7.org/fhir/StructureDefinition/RelatedPerson',
          'http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient',
        ],
      });
    });

    it('should handle reference without targets', () => {
      const result = translate(
        createTestStructureDefinition([
          {
            path: 'CareTeam.member',
            type: [{ code: 'Reference' }],
          },
        ]),
      );

      expect(result.elements?.member).toMatchObject({
        type: 'Reference',
      });
    });

    it('should handle binding extensions', () => {
      const result = translate(
        createTestStructureDefinition([
          {
            path: 'Patient.gender',
            type: [{ code: 'code' }],
            binding: {
              extension: [
                {
                  url: 'http://hl7.org/fhir/StructureDefinition/elementdefinition-bindingName',
                  valueString: 'AdministrativeGender',
                },
                {
                  url: 'http://hl7.org/fhir/StructureDefinition/elementdefinition-isCommonBinding',
                  valueBoolean: true,
                },
              ],
              strength: 'required',
              description: 'The gender of a person used for administrative purposes.',
              valueSet: 'http://hl7.org/fhir/ValueSet/administrative-gender|6.0.0-ballot2',
            },
          },
        ]),
      );

      expect(result.elements?.gender).toMatchObject({
        type: 'code',
        binding: {
          strength: 'required',
          valueSet: 'http://hl7.org/fhir/ValueSet/administrative-gender|6.0.0-ballot2',
          bindingName: 'AdministrativeGender',
        },
      });
    });

    it('should handle nested context elements', () => {
      const result = translate(
        createTestStructureDefinition([
          { path: 'DocumentReference' },
          {
            path: 'DocumentReference.context.related',
            type: [
              {
                code: 'Reference',
                targetProfile: [
                  'http://hl7.org/fhir/uv/genomics-reporting/StructureDefinition/genomics-report',
                ],
              },
            ],
          },
        ]),
      );

      expect(result.elements?.context).toBeDefined();
      expect(result.elements?.context.elements?.related).toMatchObject({
        type: 'Reference',
        refers: ['http://hl7.org/fhir/uv/genomics-reporting/StructureDefinition/genomics-report'],
      });
    });
  });

  describe('Blood Pressure Profile', () => {
    it('should translate US Core Blood Pressure profile', () => {
      const profile: StructureDefinition = {
        resourceType: 'StructureDefinition',
        url: 'http://hl7.org/fhir/StructureDefinition/Profile',
        baseDefinition: 'http://hl7.org/fhir/StructureDefinition/Observation',
        kind: 'resource',
        derivation: 'specialization',
        name: 'USCoreBloodPressureProfile',
        type: 'Observation',
        status: 'active',
        differential: {
          element: [
            { id: 'Observation', path: 'Observation', short: 'US Core Blood Pressure Profile' },
            {
              id: 'Observation.code',
              path: 'Observation.code',
              short: 'Blood Pressure',
              type: [{ code: 'CodeableConcept' }],
              patternCodeableConcept: { coding: [{ system: 'http://loinc.org', code: '85354-9' }] },
              mustSupport: true,
            },
            {
              id: 'Observation.component',
              path: 'Observation.component',
              slicing: {
                discriminator: [{ type: 'pattern', path: 'code' }],
                ordered: false,
                rules: 'open',
              },
              short: 'Component observations',
              min: 2,
              max: '*',
              mustSupport: true,
            },
            {
              id: 'Observation.component:systolic',
              path: 'Observation.component',
              sliceName: 'systolic',
              short: 'Systolic Blood Pressure',
              min: 1,
              max: '1',
              mustSupport: true,
            },
            {
              id: 'Observation.component:systolic.code',
              path: 'Observation.component.code',
              short: 'Systolic Blood Pressure Code',
              min: 1,
              max: '1',
              patternCodeableConcept: { coding: [{ system: 'http://loinc.org', code: '8480-6' }] },
              mustSupport: true,
            },
            {
              id: 'Observation.component:systolic.valueQuantity',
              path: 'Observation.component.valueQuantity',
              short: 'Vital Sign Component Value',
              type: [{ code: 'Quantity' }],
              mustSupport: true,
            },
            {
              id: 'Observation.component:systolic.valueQuantity.value',
              path: 'Observation.component.valueQuantity.value',
              min: 1,
              max: '1',
              type: [{ code: 'decimal' }],
              mustSupport: true,
            },
            {
              id: 'Observation.component:systolic.valueQuantity.unit',
              path: 'Observation.component.valueQuantity.unit',
              min: 1,
              max: '1',
              type: [{ code: 'string' }],
              mustSupport: true,
            },
            {
              id: 'Observation.component:systolic.valueQuantity.system',
              path: 'Observation.component.valueQuantity.system',
              min: 1,
              max: '1',
              type: [{ code: 'uri' }],
              fixedUri: 'http://unitsofmeasure.org',
              mustSupport: true,
            },
            {
              id: 'Observation.component:systolic.valueQuantity.code',
              path: 'Observation.component.valueQuantity.code',
              min: 1,
              max: '1',
              type: [{ code: 'code' }],
              fixedCode: 'mm[Hg]',
              mustSupport: true,
            },
            {
              id: 'Observation.component:diastolic',
              path: 'Observation.component',
              sliceName: 'diastolic',
              short: 'Diastolic Blood Pressure',
              min: 1,
              max: '1',
              mustSupport: true,
            },
            {
              id: 'Observation.component:diastolic.code',
              path: 'Observation.component.code',
              short: 'Diastolic Blood Pressure Code',
              min: 1,
              max: '1',
              patternCodeableConcept: { coding: [{ system: 'http://loinc.org', code: '8462-4' }] },
              mustSupport: true,
            },
            {
              id: 'Observation.component:diastolic.valueQuantity',
              path: 'Observation.component.valueQuantity',
              short: 'Vital Sign Component Value',
              type: [{ code: 'Quantity' }],
              mustSupport: true,
            },
            {
              id: 'Observation.component:diastolic.valueQuantity.value',
              path: 'Observation.component.valueQuantity.value',
              min: 1,
              max: '1',
              type: [{ code: 'decimal' }],
              mustSupport: true,
            },
            {
              id: 'Observation.component:diastolic.valueQuantity.unit',
              path: 'Observation.component.valueQuantity.unit',
              min: 1,
              max: '1',
              type: [{ code: 'string' }],
              mustSupport: true,
            },
            {
              id: 'Observation.component:diastolic.valueQuantity.system',
              path: 'Observation.component.valueQuantity.system',
              min: 1,
              max: '1',
              type: [{ code: 'uri' }],
              fixedUri: 'http://unitsofmeasure.org',
              mustSupport: true,
            },
            {
              id: 'Observation.component:diastolic.valueQuantity.code',
              path: 'Observation.component.valueQuantity.code',
              min: 1,
              max: '1',
              type: [{ code: 'code' }],
              fixedCode: 'mm[Hg]',
              mustSupport: true,
            },
          ],
        },
      };

      const result = translate(profile);

      expect(result.elements?.code).toBeDefined();
      expect(result.elements?.code.pattern).toEqual({
        type: 'CodeableConcept',
        value: { coding: [{ system: 'http://loinc.org', code: '85354-9' }] },
      });

      expect(result.elements?.component.slicing).toBeDefined();
      expect(result.elements?.component.slicing?.slices?.systolic).toBeDefined();
      expect(result.elements?.component.slicing?.slices?.diastolic).toBeDefined();
    });
  });
});
