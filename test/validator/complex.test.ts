import { describe, expect, test } from 'bun:test';
import type { OperationOutcome } from '../../src/converter/types';
import * as sut from '../../src/validator/complex';
import codingBadExtraField from '../data/coding-bad-extra-field.json';
import codingGood1 from '../data/coding-good-1.json';
import identifierGood1 from '../data/identifier-good-1.json';
import { typesIndex } from './fixture';

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
  describe('Multi level types', () => {
    test('Identifier good', () => {
      const spec = typesIndex[identifierGood1.type];
      const result = sut.validate(identifierGood1.value, spec, [], typesIndex);

      expect(result).toEqual(identifierGood1.result as OperationOutcome);
    });
  });
});
