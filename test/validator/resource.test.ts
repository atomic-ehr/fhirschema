import { describe, expect, test } from 'bun:test';
import type { FHIRSchema, OperationOutcome } from '../../src/converter/types';
import * as profile from '../../src/validator/profile';
import * as sut from '../../src/validator/resource';
import cardinalityBadBpNoDiastolic from '../data/cardinality-bad-bp-no-diastolic.json';
import cardinalityBadEmptyIdentifiers from '../data/cardinality-bad-empty-identifiers.json';
import cardinalityBadMaxContacts from '../data/cardinality-bad-max-contacts.json';
import cardinalityBadMaxPhotos from '../data/cardinality-bad-max-photos.json';
import cardinalityBadMinContacts from '../data/cardinality-bad-min-contacts.json';
import cardinalityBadMinIdentifiers from '../data/cardinality-bad-min-identifiers.json';
import cardinalityGoodPatient from '../data/cardinality-good-patient.json';
import multiCitizenPatientProfilesChain from '../data/multicitizen-patient-profiles-chain.json';
import goodPatternPatient1 from '../data/reslicing-good-pat1.json';
import slicingDicrCompositeDeep from '../data/slicing-discr-composite-deep.json';
import slicingDiscrSimple from '../data/slicing-discr-simple.json';
import goodPatternObs1 from '../data/slicing-good-pattern-obs1.json';
import usCoreBloodPreasureProfilesChain from '../data/uscore-blood-preasure-profiles-chain.json';
import { profilesIndex, typesIndex } from './fixture';

describe('Slicing discrimination', () => {
  test('Composite discriminator & deep paths', () => {
    const result = sut.slice(
      slicingDicrCompositeDeep.data,
      slicingDicrCompositeDeep.spec.slicing as sut.Slicing,
    );
    expect(result).toEqual(slicingDicrCompositeDeep.result as any);
  });
  test('Simple pattern discriminator on Patient.identifier', () => {
    const result = sut.slice(
      slicingDiscrSimple.data,
      slicingDiscrSimple.spec.slicing as sut.Slicing,
    );
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
      const result = sut.validate(goodPatternObs1.resource, usCoreBloodPreasure, typesIndex);
      expect(result).toEqual(goodPatternObs1.result as OperationOutcome);
    });

    test('Patient with passport identifiers (reslicing)', () => {
      const result = sut.validate(goodPatternPatient1.resource, multiCitizenPatient, typesIndex);
      expect(result).toEqual(goodPatternPatient1.result as OperationOutcome);
    });
  });
});

describe('Cardinality validation', () => {
  test('min violation - identifier (1 provided, 2 required)', () => {
    const patientWithCardinalityConstraints = cardinalityBadMinIdentifiers.profiles
      .map((canon) => profilesIndex[canon])
      .reduce((p1, p2) => profile.merge(p1, p2) as FHIRSchema);
    const result = sut.validate(
      cardinalityBadMinIdentifiers.resource,
      patientWithCardinalityConstraints,
      typesIndex,
    );
    expect(result).toEqual(cardinalityBadMinIdentifiers.result as OperationOutcome);
  });

  test('min violation - identifier (empty array, 2 required)', () => {
    const mergedProfiles = cardinalityBadEmptyIdentifiers.profiles
      .map((canon) => profilesIndex[canon])
      .reduce((p1, p2) => profile.merge(p1, p2) as FHIRSchema);
    const result = sut.validate(
      cardinalityBadEmptyIdentifiers.resource,
      mergedProfiles,
      typesIndex,
    );
    expect(result).toEqual(cardinalityBadEmptyIdentifiers.result as OperationOutcome);
  });

  test('max violation - photo (2 provided, 1 allowed)', () => {
    const mergedProfiles = cardinalityBadMaxPhotos.profiles
      .map((canon) => profilesIndex[canon])
      .reduce((p1, p2) => profile.merge(p1, p2) as FHIRSchema);
    const result = sut.validate(cardinalityBadMaxPhotos.resource, mergedProfiles, typesIndex);
    expect(result).toEqual(cardinalityBadMaxPhotos.result as OperationOutcome);
  });

  test('min violation - contact (empty array, 1 required)', () => {
    const mergedProfiles = cardinalityBadMinContacts.profiles
      .map((canon) => profilesIndex[canon])
      .reduce((p1, p2) => profile.merge(p1, p2) as FHIRSchema);
    const result = sut.validate(cardinalityBadMinContacts.resource, mergedProfiles, typesIndex);
    expect(result).toEqual(cardinalityBadMinContacts.result as OperationOutcome);
  });

  test('max violation - contact (4 provided, 3 allowed)', () => {
    const mergedProfiles = cardinalityBadMaxContacts.profiles
      .map((canon) => profilesIndex[canon])
      .reduce((p1, p2) => profile.merge(p1, p2) as FHIRSchema);
    const result = sut.validate(cardinalityBadMaxContacts.resource, mergedProfiles, typesIndex);
    expect(result).toEqual(cardinalityBadMaxContacts.result as OperationOutcome);
  });

  test('valid cardinality - all constraints satisfied', () => {
    const mergedProfiles = cardinalityGoodPatient.profiles
      .map((canon) => profilesIndex[canon])
      .reduce((p1, p2) => profile.merge(p1, p2) as FHIRSchema);
    const result = sut.validate(cardinalityGoodPatient.resource, mergedProfiles, typesIndex);
    expect(result).toEqual(cardinalityGoodPatient.result as OperationOutcome);
  });

  test('min violation - blood pressure without diastolic component (slice)', () => {
    const mergedProfiles = cardinalityBadBpNoDiastolic.profiles
      .map((canon) => profilesIndex[canon])
      .reduce((p1, p2) => profile.merge(p1, p2) as FHIRSchema);
    const result = sut.validate(cardinalityBadBpNoDiastolic.resource, mergedProfiles, typesIndex);
    expect(result).toEqual(cardinalityBadBpNoDiastolic.result as OperationOutcome);
  });
});
