import { describe, test, expect } from 'bun:test';
import * as sut from '../../src/converter/slicing';
import slicingObsComponent from '../data/slicing-obs-component.json';
import reslicingPatPassport from '../data/reslicing-patient-passport.json';

describe('Slicing merge', () => {
  describe('Observation.component at us-core vital-signs', () => {
    test('Can merge slicing data into base definition', () => {
      const result = sut.merge(slicingObsComponent.base, slicingObsComponent.overlay);

      expect(result).toEqual(slicingObsComponent.result);
    });
  });
  describe('Patient.identifier (synthetic example)', () => {
    test('Can merge reslicing data into base definition', () => {
      const result = sut.merge(reslicingPatPassport.base, reslicingPatPassport.overlay);

      expect(result).toEqual(reslicingPatPassport.result);
    });
  });
});
