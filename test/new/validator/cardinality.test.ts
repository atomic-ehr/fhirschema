import { describe, expect, test } from 'bun:test';
import { errorCodes, errorRegistry } from '../../../src/new/errors';
import { validate } from '../../../src/new/validator';
import { OK_OUTCOME } from './fixture';

describe('New validator draft', () => {
  describe('Cardinality', () => {
    test('accepts array length within min/max bounds', () => {
      const result = validate(
        undefined,
        [{ elements: { tags: { type: 'string', array: true, min: 1, max: 3 } } }],
        { tags: ['a', 'b'] },
      );
      expect(result).toEqual(OK_OUTCOME);
    });

    test('reports array length below min', () => {
      const result = validate(
        undefined,
        [{ elements: { tags: { type: 'string', array: true, min: 2 } } }],
        { tags: ['a'] },
      );
      const issues = result.issue ?? [];
      expect(issues).toHaveLength(1);
      expect(issues[0]?.code).toBe(
        errorRegistry[errorCodes.cardinalityViolation].issueCode,
      );
      expect(issues[0]?.details?.text).toContain('min=2');
      expect(issues[0]?.details?.text).toContain('tags');
    });

    test('reports array length above max', () => {
      const result = validate(
        undefined,
        [{ elements: { tags: { type: 'string', array: true, max: 2 } } }],
        { tags: ['a', 'b', 'c'] },
      );
      const issues = result.issue ?? [];
      expect(issues).toHaveLength(1);
      expect(issues[0]?.details?.text).toContain('max=2');
    });

    test('picks tightest bounds from overlay (highest min, lowest max)', () => {
      const result = validate(
        undefined,
        [
          { elements: { tags: { type: 'string', array: true, min: 1, max: 10 } } },
          { elements: { tags: { type: 'string', array: true, min: 3, max: 5 } } },
        ],
        { tags: ['a', 'b'] },
      );
      const issues = result.issue ?? [];
      expect(issues).toHaveLength(1);
      expect(issues[0]?.details?.text).toContain('min=3');
    });
  });
});
