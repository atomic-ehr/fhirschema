import { describe, test, expect } from 'bun:test';
import { OperationOutcome } from '../../src/converter/types';
import { typesIndex } from './fixture';
import * as sut from '../../src/validator/complex';
import codingGood1 from '../data/coding-good-1.json';
import codingBadExtraField from '../data/coding-bad-extra-field.json';

describe('Complex-type validations', () => {
  describe('Single level types', () => {
    test('Coding good', () => {
      const spec = typesIndex[codingGood1.type];
      const result = sut.validate(codingGood1.value, spec, [], typesIndex);

      expect(result).toEqual(codingGood1.result as OperationOutcome);
    });
    test('Coding extra field', () => {
      const spec = typesIndex[codingBadExtraField.type];
      const result = sut.validate(codingBadExtraField.value, spec, [], typesIndex);

      expect(result).toEqual(codingBadExtraField.result as OperationOutcome);
    });
  });
  describe('Multi level types', () => {});
});
