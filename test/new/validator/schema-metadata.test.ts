import { describe, expect, test } from 'bun:test';
import { validate } from '../../../src/new/validator';
import { OK_OUTCOME } from './fixture';

describe('New validator draft', () => {
  describe('Schema metadata', () => {
    test('accepts a schema list with base profile references', () => {
      const result = validate(
        undefined,
        [
          {
            additionalProfiles: ['http://canonical2.com', 'http://canonical3.com'],
            base: 'http://canonical.com',
          },
        ],
        {},
      );

      expect(result).toEqual(OK_OUTCOME);
    });
  });
});
