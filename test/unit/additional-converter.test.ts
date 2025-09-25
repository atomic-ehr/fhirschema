import { describe, expect, it } from 'bun:test';
import { calculateActions, parsePath, translate } from '../../src/converter';
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

describe('Additional Converter Tests', () => {
  describe('Slice Exit and Enter Edge Cases', () => {
    it('should handle exit from sliced element to non-sliced element', () => {
      const path1 = parsePath({
        path: 'Patient.name',
        mustSupport: false,
      } as StructureDefinitionElement);
      const path2 = parsePath({
        sliceName: 'race',
        path: 'Patient.extension',
        min: 0,
        max: '1',
        type: [
          {
            code: 'Extension',
            profile: ['http://hl7.org/fhir/us/core/StructureDefinition/us-core-race'],
          },
        ],
        mustSupport: false,
      } as StructureDefinitionElement);

      const result = calculateActions(path1, path2);

      expect(result).toEqual([
        { type: 'exit', el: 'name' },
        { type: 'enter', el: 'extension' },
        { type: 'enter-slice', sliceName: 'race' },
      ]);
    });

    it('should handle slice within slice transitions', () => {
      const path1 = [{ sliceName: 's1', el: 'x' }, { el: 'b' }];
      const path2 = [
        { sliceName: 's1', el: 'x' },
        { el: 'b', sliceName: 'z1' },
      ];

      const actions = calculateActions(path1, path2);

      expect(actions).toBeTruthy();
      expect(
        actions.some((a) => a.type === 'enter-slice' && 'sliceName' in a && a.sliceName === 'z1'),
      ).toBe(true);
    });
  });

  describe('Specific Edge Cases', () => {
    it('should handle pattern values at different levels', () => {
      const result = translate(
        createTestStructureDefinition([
          {
            path: 'Observation.code',
            patternCodeableConcept: {
              coding: [{ system: 'http://loinc.org', code: '85354-9' }],
            },
          },
          {
            path: 'Observation.valueString',
            patternString: 'test-pattern',
          },
          {
            path: 'Observation.valueBoolean',
            patternBoolean: true,
          },
        ]),
      );

      expect(result.elements).toBeTruthy();
      expect(result.elements?.code.pattern).toEqual({
        type: 'CodeableConcept',
        value: { coding: [{ system: 'http://loinc.org', code: '85354-9' }] },
      });
      expect(result.elements?.valueString.pattern).toEqual({
        type: 'string',
        value: 'test-pattern',
      });
      expect(result.elements?.valueBoolean.pattern).toEqual({
        type: 'boolean',
        value: true,
      });
    });

    it('should preserve mustSupport through nested structures', () => {
      const result = translate(
        createTestStructureDefinition([
          { path: 'Patient', mustSupport: false },
          { path: 'Patient.name', mustSupport: true },
          { path: 'Patient.name.given', mustSupport: true },
          { path: 'Patient.name.family', mustSupport: false },
          { path: 'Patient.birthDate', mustSupport: true },
        ]),
      );

      expect(result.elements).toBeTruthy();
      expect(result.elements?.name?.mustSupport).toBe(true);
      expect(result.elements?.name?.elements?.given?.mustSupport).toBe(true);
      expect(result.elements?.name?.elements?.family?.mustSupport).toBe(false);
      expect(result.elements?.birthDate?.mustSupport).toBe(true);
    });

    describe('should handle contentReference', () => {
      const result = translate(
        createTestStructureDefinition([
          {
            path: 'Questionnaire.item',
            contentReference: '#Questionnaire.item',
          },
        ]),
      );

      it.todo('FIXME', () => {
        expect(result.elements?.item?.elementReference).toBeDefined();
      });
    });

    it('should handle constraints', () => {
      const result = translate(
        createTestStructureDefinition([
          {
            path: 'Patient.contact',
            constraint: [
              {
                key: 'pat-1',
                severity: 'error',
                human:
                  "SHALL at least contain a contact's details or a reference to an organization",
                expression:
                  'name.exists() or telecom.exists() or address.exists() or organization.exists()',
              },
            ],
          },
        ]),
      );

      expect(result.elements).toBeTruthy();
      expect(result.elements?.contact?.constraint?.['pat-1']).toBeTruthy();
      expect(result.elements?.contact?.constraint?.['pat-1']?.severity).toBe('error');
      expect(result.elements?.contact?.constraint?.['pat-1']?.human).toBe(
        "SHALL at least contain a contact's details or a reference to an organization",
      );
      expect(result.elements?.contact?.constraint?.['pat-1']?.expression).toBe(
        'name.exists() or telecom.exists() or address.exists() or organization.exists()',
      );
    });
  });
});
