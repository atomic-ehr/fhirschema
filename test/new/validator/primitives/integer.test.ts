import { describe, expect, test } from 'bun:test';
import type { OperationOutcome } from '../../../../src/converter/types';
import { errorCodes, errorRegistry } from '../../../../src/new/errors';
import { validate } from '../../../../src/new/validator';
import { OK_OUTCOME } from '../../validator/fixture';

const FHIR_MIN_INT = -2147483648;
const FHIR_MAX_INT = 2147483647;

describe('New validator draft', () => {
  describe('Primitive validation', () => {
    describe('integer', () => {
      test('accepts zero and signed 32-bit boundary values', () => {
        expect(validate(undefined, [{ type: 'integer' }], 0)).toEqual(OK_OUTCOME);
        expect(validate(undefined, [{ type: 'integer' }], FHIR_MAX_INT)).toEqual(OK_OUTCOME);
        expect(validate(undefined, [{ type: 'integer' }], FHIR_MIN_INT)).toEqual(OK_OUTCOME);
      });

      test('rejects non-number values', () => {
        const result = validate(undefined, [{ type: 'integer'}], '2');

        expect(result).toEqual({
          resourceType: 'OperationOutcome',
          issue: [
            {
              severity: errorRegistry[errorCodes.typeMismatch].severity,
              code: errorRegistry[errorCodes.typeMismatch].issueCode,
              details: {
                text: errorRegistry[errorCodes.typeMismatch].message({
                  actual: 'string',
                  expected: 'number',
                }),
              },
            },
          ],
        } satisfies OperationOutcome);
      });

      test('rejects null', () => {
        const result = validate(undefined, [{ type: 'integer' }], null);

        expect(result).toEqual({
          resourceType: 'OperationOutcome',
          issue: [
            {
              severity: errorRegistry[errorCodes.typeMismatch].severity,
              code: errorRegistry[errorCodes.typeMismatch].issueCode,
              details: {
                text: errorRegistry[errorCodes.typeMismatch].message({
                  actual: 'null',
                  expected: 'number',
                }),
              },
            },
          ],
        } satisfies OperationOutcome);
      });

      test('rejects fractional numbers', () => {
        const result = validate(undefined, [{ type: 'integer' }], 1.5);

        expect(result).toEqual({
          resourceType: 'OperationOutcome',
          issue: [
            {
              severity: errorRegistry[errorCodes.typeMismatch].severity,
              code: errorRegistry[errorCodes.typeMismatch].issueCode,
              details: {
                text: errorRegistry[errorCodes.typeMismatch].message({
                  actual: 'decimal',
                  expected: 'integer',
                }),
              },
            },
          ],
        } satisfies OperationOutcome);
      });

      test('rejects values above the upper 32-bit bound', () => {
        const result = validate(undefined, [{ type: 'integer' }], FHIR_MAX_INT + 1);

        expect(result).toEqual({
          resourceType: 'OperationOutcome',
          issue: [
            {
              severity: errorRegistry[errorCodes.integerOutOfRange].severity,
              code: errorRegistry[errorCodes.integerOutOfRange].issueCode,
              details: {
                text: errorRegistry[errorCodes.integerOutOfRange].message({
                  max: FHIR_MAX_INT,
                  min: FHIR_MIN_INT,
                  value: FHIR_MAX_INT + 1,
                }),
              },
            },
          ],
        } satisfies OperationOutcome);
      });

      test('rejects values below the lower 32-bit bound', () => {
        const result = validate(undefined, [{ type: 'integer' }], FHIR_MIN_INT - 1);

        expect(result).toEqual({
          resourceType: 'OperationOutcome',
          issue: [
            {
              severity: errorRegistry[errorCodes.integerOutOfRange].severity,
              code: errorRegistry[errorCodes.integerOutOfRange].issueCode,
              details: {
                text: errorRegistry[errorCodes.integerOutOfRange].message({
                  max: FHIR_MAX_INT,
                  min: FHIR_MIN_INT,
                  value: FHIR_MIN_INT - 1,
                }),
              },
            },
          ],
        } satisfies OperationOutcome);
      });
    });
  });
});
