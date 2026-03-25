import { describe, expect, test } from 'bun:test';
import { validate } from '../../../src/new/validator';
import { OK_OUTCOME } from './fixture';

describe('New validator draft', () => {
  describe('Object field validation', () => {
    test('accepts declared fields in a single schema fragment', () => {
      const result = validate(
        undefined,
        [{ elements: { name: { type: 'string', array: true } } }],
        { name: ['123'] },
      );

      expect(result).toEqual(OK_OUTCOME);
    });

    test('keeps unknown fields as a future validation case', () => {
      const result = validate(
        undefined,
        [{ elements: { name: { type: 'string', array: true } } }],
        { whoops: ['123'] },
      );

      expect(result).toEqual(OK_OUTCOME);
    });

    test('accepts merged fields coming from multiple schema fragments', () => {
      const result = validate(
        undefined,
        [
          { elements: { name: { type: 'string', array: true } } },
          { elements: { birthDate: { type: 'date' } } },
        ],
        { name: ['123'], birthDate: '01-01-1999' },
      );

      expect(result).toEqual(OK_OUTCOME);
    });

    test.todo('rejects fields that are absent from the merged schema list');
  });
});
