import { describe, test, expect } from 'bun:test';
import { OperationOutcome } from '../../src/converter/types';
import { typesIndex } from './fixture';
import * as sut from '../../src/validator/complex';
import codingGood1 from '../data/coding-good-1.json';

describe('Complex-type validations', () => {
  describe('Single level types', () => {
    test('US core blood preasure component', () => {
      const spec = typesIndex[codingGood1.type];
      const result = sut.validate(codingGood1.value, spec, [], typesIndex);

      expect(result).toEqual(codingGood1.result as OperationOutcome);
    });
  });
  describe('Multi level types', () => {});
});
