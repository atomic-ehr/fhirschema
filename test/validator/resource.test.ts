import { describe, test, expect } from 'bun:test';
import { profilesIndex } from './fixture';
import * as sut from '../../src/validator/resource';
import * as profile from '../../src/validator/profile';
import { FHIRSchema, OperationOutcome } from '../../src/converter/types';
import usCoreBloodPreasureProfilesChain from '../data/uscore-blood-preasure-profiles-chain.json';
import multiCitizenPatientProfilesChain from '../data/multicitizen-patient-profiles-chain.json';
import goodPatternObs1 from '../data/slicing-good-pattern-obs1.json';
import slicingDicrCompositeDeep from '../data/slicing-discr-composite-deep.json';
import slicingDiscrSimple from '../data/slicing-discr-simple.json';
import goodPatternPatient1 from '../data/reslicing-good-pat1.json';

describe('Slicing discrimination', () => {
  test('Composite discriminator & deep paths', () => {
    const result = sut.slice(slicingDicrCompositeDeep.data, slicingDicrCompositeDeep.spec.slicing as sut.Slicing);
    expect(result).toEqual(slicingDicrCompositeDeep.result as any);
  });
  test('Simple pattern discriminator on Patient.identifier', () => {
    const result = sut.slice(slicingDiscrSimple.data, slicingDiscrSimple.spec.slicing as sut.Slicing);
    expect(result).toEqual(slicingDiscrSimple.result as any);
  });
});

describe('Slicing validation', () => {
  const usCoreBloodPreasure = usCoreBloodPreasureProfilesChain.profiles
    .map((canon) => profilesIndex[canon])
    .reduce((p1, p2) => profile.merge(p1, p2) as FHIRSchema);

  const multiCitizenPatient = multiCitizenPatientProfilesChain.profiles
    .map((canon) => profilesIndex[canon])
    .reduce((p1, p2) => profile.merge(p1, p2) as FHIRSchema);

  describe('good pattern discrimination', () => {
    test('US core blood preasure component', () => {
      const result = sut.validate(goodPatternObs1.resource, usCoreBloodPreasure);
      expect(result).toEqual(goodPatternObs1.result as OperationOutcome);
    });

    test('Patient with passport identifiers (reslicing)', () => {
      const result = sut.validate(goodPatternPatient1.resource, multiCitizenPatient);
      expect(result).toEqual(goodPatternPatient1.result as OperationOutcome);
    });
  });
});
