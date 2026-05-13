import { describe, expect, test } from 'bun:test';
import { validate } from '../../../src/new/validator';
import { OK_OUTCOME } from './fixture';

describe('New validator draft', () => {
  describe('Array semantics', () => {
    test('passes scalar input at root and validates array items', () => {
      expect(validate(undefined, [{ type: 'string', array: true }], '')).toEqual(OK_OUTCOME);
      expect(validate(undefined, [{ type: 'string', array: true }], [])).toEqual(OK_OUTCOME);
      expect(validate(undefined, [{ type: 'string', array: true }], ['123'])).toEqual(
        OK_OUTCOME,
      );
    });

    test('reports invalid items inside arrays', () => {
      const result = validate(undefined, [{ type: 'string', array: true }], ['ok', '']);
      const issues = result.issue ?? [];
      expect(issues).toHaveLength(1);
      expect(issues[0]?.details?.text).toContain('1');
    });

    test('rejects non-array input where array is required at a field', () => {
      const result = validate(
        undefined,
        [{ elements: { tags: { type: 'string', array: true } } }],
        { tags: 'not-an-array' },
      );
      const issues = result.issue ?? [];
      expect(issues).toHaveLength(1);
      expect(issues[0]?.details?.text).toContain('expected: array');
    });

    test.todo('normalizes scalar input into a single-item array when allowed');
    test.todo('rejects non-array input when scalar coercion is disabled');
  });
});
