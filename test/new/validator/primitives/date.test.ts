import { describe, expect, test } from 'bun:test';
import type { OperationOutcome } from '../../../../src/converter/types';
import { errorCodes, errorRegistry } from '../../../../src/new/errors';
import { validate } from '../../../../src/new/validator';
import { OK_OUTCOME } from '../../validator/fixture';

describe('New validator draft', () => {
  describe('Primitive validation', () => {
    describe('date', () => {
      test('accepts year precision', () => {
        const result = validate(undefined, [{ type: 'date' }], '2024');

        expect(result).toEqual(OK_OUTCOME);
      });

      test('accepts year-month precision', () => {
        const result = validate(undefined, [{ type: 'date' }], '2024-03');

        expect(result).toEqual(OK_OUTCOME);
      });

      test('accepts full calendar date precision', () => {
        const result = validate(undefined, [{ type: 'date' }], '2024-03-15');

        expect(result).toEqual(OK_OUTCOME);
      });

      test('rejects non-string values', () => {
        const result = validate(undefined, [{ type: 'date' }], 20240315);

        expect(result).toEqual({
          resourceType: 'OperationOutcome',
          issue: [
            {
              severity: errorRegistry[errorCodes.typeMismatch].severity,
              code: errorRegistry[errorCodes.typeMismatch].issueCode,
              details: {
                text: errorRegistry[errorCodes.typeMismatch].message({
                  actual: 'number',
                  expected: 'string',
                }),
              },
            },
          ],
        } satisfies OperationOutcome);
      });

      test('rejects null', () => {
        const result = validate(undefined, [{ type: 'date' }], null);

        expect(result).toEqual({
          resourceType: 'OperationOutcome',
          issue: [
            {
              severity: errorRegistry[errorCodes.typeMismatch].severity,
              code: errorRegistry[errorCodes.typeMismatch].issueCode,
              details: {
                text: errorRegistry[errorCodes.typeMismatch].message({
                  actual: 'null',
                  expected: 'string',
                }),
              },
            },
          ],
        } satisfies OperationOutcome);
      });

      test('rejects invalid lexical forms', () => {
        const result = validate(undefined, [{ type: 'date' }], '15-03-2024');

        expect(result).toEqual({
          resourceType: 'OperationOutcome',
          issue: [
            {
              severity: errorRegistry[errorCodes.invalidDate].severity,
              code: errorRegistry[errorCodes.invalidDate].issueCode,
              details: {
                text: errorRegistry[errorCodes.invalidDate].message({
                  reason: 'must use FHIR date precision yyyy, yyyy-mm, or yyyy-mm-dd',
                }),
              },
            },
          ],
        } satisfies OperationOutcome);
      });

      test('rejects impossible calendar dates', () => {
        const result = validate(undefined, [{ type: 'date' }], '2024-02-30');

        expect(result).toEqual({
          resourceType: 'OperationOutcome',
          issue: [
            {
              severity: errorRegistry[errorCodes.invalidDate].severity,
              code: errorRegistry[errorCodes.invalidDate].issueCode,
              details: {
                text: errorRegistry[errorCodes.invalidDate].message({
                  reason: 'must be a real calendar date',
                }),
              },
            },
          ],
        } satisfies OperationOutcome);
      });
    });
  });
});
