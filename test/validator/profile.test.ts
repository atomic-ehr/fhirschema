import { describe, test, expect } from 'bun:test';
import { profilesIndex } from './fixture';
import * as sut from '../../src/validator/profile';
import { FHIRSchema, } from '../../src/converter/types';
import slicingObsComponent from '../data/slicing-obs-component.json';
import reslicingPatPassport from '../data/reslicing-patient-passport.json';
import usCoreBloodPreasureProfilesChain from '../data/uscore-blood-preasure-profiles-chain.json';
import multiCitizenPatientProfilesChain from '../data/multicitizen-patient-profiles-chain.json';

describe('Merge profiles', () => {
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
  describe('Chain of schemas', () => {
    test('us-core-blood-pressure at hl7.fhir.us.core#8.0.0-ballot', () => {
      const result = usCoreBloodPreasureProfilesChain.profiles
        .map((canon) => profilesIndex[canon])
        .reduce((p1, p2) => sut.merge(p1, p2) as FHIRSchema);
      expect(result).toEqual(usCoreBloodPreasureProfilesChain.result);
    });
    test('multicitizen-patient profile chain (custom)', () => {
      const result = multiCitizenPatientProfilesChain.profiles
        .map((canon) => profilesIndex[canon])
        .reduce((p1, p2) => sut.merge(p1, p2) as FHIRSchema);
      expect(result).toEqual(multiCitizenPatientProfilesChain.result);
    });
  });
});