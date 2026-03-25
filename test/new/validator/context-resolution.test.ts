import { describe, expect, test } from 'bun:test';
import { validate } from '../../../src/new/validator';
import { OK_OUTCOME } from './fixture';

describe('New validator draft', () => {
  describe('Context resolution', () => {
    test('accepts referenced complex types from ctx', () => {
      const ctx = {
        HumanName: { elements: { name: { type: 'string', array: true } } },
      };
      const patientSchema = { elements: { name: { type: 'HumanName' } } };

      const result = validate(ctx, [patientSchema], { name: { name: ['123'] } });

      expect(result).toEqual(OK_OUTCOME);
    });

    test.todo('fails when ctx does not contain a referenced complex type');
  });
});
