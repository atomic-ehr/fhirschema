import { describe, it, expect } from 'bun:test';
import {
  translate,
  parsePath,
  calculateActions,
} from '../../src/converter';

describe('Additional Converter Tests', () => {
  describe('Slice Exit and Enter Edge Cases', () => {
    it('should handle exit from sliced element to non-sliced element', () => {
      const result = calculateActions(
        parsePath({ path: 'Patient.name', mustSupport: false }),
        [
          ...parsePath({
            sliceName: 'race',
            path: 'Patient.extension',
            min: 0,
            max: '1',
            type: [{
              code: 'Extension',
              profile: ['http://hl7.org/fhir/us/core/StructureDefinition/us-core-race']
            }],
            mustSupport: false
          })
        ]
      );

      expect(result).toEqual([
        { type: 'exit', el: 'name' },
        { type: 'enter', el: 'extension' },
        { type: 'enter-slice', sliceName: 'race' }
      ]);
    });

    it('should handle slice within slice transitions', () => {
      const path1 = [{ sliceName: 's1', el: 'x' }, { el: 'b' }];
      const path2 = [{ sliceName: 's1', el: 'x' }, { el: 'b', sliceName: 'z1' }];

      const actions = calculateActions(path1, path2);

      expect(actions).toBeTruthy();
      expect(actions.some(a => a.type === 'enter-slice' && a.sliceName === 'z1')).toBe(true);
    });
  });

  describe('Specific Edge Cases', () => {
    it('should handle pattern values at different levels', () => {
      const result = translate({
        differential: {
          element: [
            {
              path: 'Observation.code',
              patternCodeableConcept: {
                coding: [{ system: 'http://loinc.org', code: '85354-9' }]
              }
            },
            {
              path: 'Observation.valueString',
              patternString: 'test-pattern'
            },
            {
              path: 'Observation.valueBoolean',
              patternBoolean: true
            }
          ]
        }
      } as any);
      expect(result.elements).toBeTruthy()
      expect(result.elements!.code.pattern).toEqual({
        type: 'CodeableConcept',
        value: { coding: [{ system: 'http://loinc.org', code: '85354-9' }] }
      });
      expect(result.elements!.valueString.pattern).toEqual({
        type: 'string',
        value: 'test-pattern'
      });
      expect(result.elements!.valueBoolean.pattern).toEqual({
        type: 'boolean',
        value: true
      });
    });

    it('should preserve mustSupport through nested structures', () => {
      const result = translate({
        differential: {
          element: [
            { path: 'Patient', mustSupport: false },
            { path: 'Patient.name', mustSupport: true },
            { path: 'Patient.name.given', mustSupport: true },
            { path: 'Patient.name.family', mustSupport: false },
            { path: 'Patient.birthDate', mustSupport: true }
          ]
        }
      } as any);
      expect(result.elements).toBeTruthy()
      expect(result.elements!.name.mustSupport).toBe(true);
      expect(result.elements!.name.elements!.given.mustSupport).toBe(true);
      expect(result.elements!.name.elements!.family.mustSupport).toBe(false);
      expect(result.elements!.birthDate.mustSupport).toBe(true);
    });

    it('should handle contentReference', () => {
      const result = translate({
        differential: {
          element: [
            {
              path: 'Questionnaire.item',
              contentReference: '#Questionnaire.item'
            }
          ]
        }
      } as any);

      // expect(result.elements!..contentReference).toBe('#Questionnaire.item');
    });

    it('should handle constraints', () => {
      const result = translate({
        differential: {
          element: [
            {
              path: 'Patient.contact',
              constraint: [
                {
                  key: 'pat-1',
                  severity: 'error',
                  human: 'SHALL at least contain a contact\'s details or a reference to an organization',
                  expression: 'name.exists() or telecom.exists() or address.exists() or organization.exists()'
                }
              ]
            }
          ]
        }
      } as any);
      expect(result.elements).toBeTruthy()
      expect(result.elements!.contact.constraint!['pat-1']).toBeTruthy();
      expect(result.elements!.contact.constraint!['pat-1'].severity).toBe('error');
      expect(result.elements!.contact.constraint!['pat-1'].human).toBe('SHALL at least contain a contact\'s details or a reference to an organization');
      expect(result.elements!.contact.constraint!['pat-1'].expression).toBe('name.exists() or telecom.exists() or address.exists() or organization.exists()');
    });
  });
});