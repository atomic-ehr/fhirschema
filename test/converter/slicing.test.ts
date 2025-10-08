import { describe, test, expect } from 'bun:test';
import * as sut from '../../src/converter/slicing';
import { FHIRSchema } from '../../src/converter/types';
import usCoreBloodPressureProfile from '../data/hl7.fhir.us.core#8.0.0-ballot/us-core-blood-pressure.fs.json';
import usCoreVitalSignsProfile from '../data/hl7.fhir.us.core#8.0.0-ballot/us-core-vital-signs.fs.json';
import r4VitalSignsProfile from '../data/hl7.fhir.r4.core#4.0.1/vitalsigns.fs.json';
import r4ObsProfile from '../data/hl7.fhir.r4.core#4.0.1/Observation.fs.json';
import r4DomainResProfile from '../data/hl7.fhir.r4.core#4.0.1/DomainResource.fs.json';
import r4ResourceProfile from '../data/hl7.fhir.r4.core#4.0.1/Resource.fs.json';
import slicingObsComponent from '../data/slicing-obs-component.json';
import reslicingPatPassport from '../data/reslicing-patient-passport.json';
import usCoreBloodPreasureProfilesChain from '../data/uscore-blood-preasure-profiles-chain.json';

const profilesIndex: {[key in string]: FHIRSchema} = {
  'http://hl7.org/fhir/us/core/StructureDefinition/us-core-blood-pressure|8.0.0-ballot':
    usCoreBloodPressureProfile,
  'http://hl7.org/fhir/us/core/StructureDefinition/us-core-vital-signs|8.0.0-ballot':
    usCoreVitalSignsProfile,
  'http://hl7.org/fhir/StructureDefinition/vitalsigns|4.0.1': r4VitalSignsProfile,
  'http://hl7.org/fhir/StructureDefinition/Observation|4.0.1': r4ObsProfile,
  'http://hl7.org/fhir/StructureDefinition/DomainResource|4.0.1': r4DomainResProfile,
  'http://hl7.org/fhir/StructureDefinition/Resource|4.0.1': r4ResourceProfile,
};

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
  describe('Chain of schemas', () => {
    test('us-core-blood-pressure at hl7.fhir.us.core#8.0.0-ballot', () => {
      const result = usCoreBloodPreasureProfilesChain.profiles
        .map((canon) => profilesIndex[canon])
        .reduce((p1, p2) => sut.merge(p1, p2) as FHIRSchema);

      expect(result).toEqual(usCoreBloodPreasureProfilesChain.result);
    });
  });
});
