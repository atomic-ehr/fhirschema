import { describe, expect, test } from 'bun:test';
import { validate } from '../../../src/new/validator';
import { OK_OUTCOME } from './fixture';

describe('New validator draft', () => {
  describe('Array semantics', () => {
    test('keeps current placeholder behavior for scalar and array inputs', () => {
      expect(validate(undefined, [{ type: 'string', array: true }], '')).toEqual(OK_OUTCOME);
      expect(validate(undefined, [{ type: 'string', array: true }], [''])).toEqual(OK_OUTCOME);
      expect(validate(undefined, [{ type: 'string', array: true }], [])).toEqual(OK_OUTCOME);
      expect(validate(undefined, [{ type: 'string', array: true }], ['123'])).toEqual(
        OK_OUTCOME,
      );
    });

    test.todo('normalizes scalar input into a single-item array when allowed');
    test.todo('rejects non-array input when scalar coercion is disabled');
  });
});
