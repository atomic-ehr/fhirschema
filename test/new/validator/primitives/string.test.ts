import { describe, expect, test } from 'bun:test';
import type { OperationOutcome } from '../../../../src/converter/types';
import { errorCodes, errorRegistry } from '../../../../src/new/errors';
import { validate } from '../../../../src/new/validator';
import { OK_OUTCOME } from '../../validator/fixture';

const FHIR_STRING_MAX_LENGTH = 1024 * 1024;

describe('New validator draft', () => {
  describe('Primitive validation', () => {
    describe('string', () => {
      test('accepts a non-empty string draft case', () => {
        const result = validate(undefined, [{ type: 'string' }], 'str');

        expect(result).toEqual(OK_OUTCOME);
      });

      test('accepts a string with surrounding whitespace when it has content', () => {
        const result = validate(undefined, [{ type: 'string' }], '  str  ');

        expect(result).toEqual(OK_OUTCOME);
      });

      test('rejects non-string values', () => {
        const result = validate(undefined, [{ type: 'string' }], 123);

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
      
        
          [
            {
              code: errorCodes.typeMismatch,
              path: "",
              schemaPath: "http://USCorePatient#birthDate", //content reference?
              message: "expected date got string" //validate by regexp
            },
          ];
      });

      test('rejects null', () => {
        const result = validate(undefined, [{ type: 'string' }], null);

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

      test('rejects empty strings', () => {
        const result = validate(undefined, [{ type: 'string' }], '');

        expect(result).toEqual({
          resourceType: 'OperationOutcome',
          issue: [
            {
              severity: errorRegistry[errorCodes.invalidString].severity,
              code: errorRegistry[errorCodes.invalidString].issueCode,
              details: {
                text: errorRegistry[errorCodes.invalidString].message({}),
              },
            },
          ],
        } satisfies OperationOutcome);
      });

      test('rejects whitespace-only strings', () => {
        const result = validate(undefined, [{ type: 'string' }], '   ');

        expect(result).toEqual({
          resourceType: 'OperationOutcome',
          issue: [
            {
              severity: errorRegistry[errorCodes.invalidString].severity,
              code: errorRegistry[errorCodes.invalidString].issueCode,
              details: {
                text: errorRegistry[errorCodes.invalidString].message({}),
              },
            },
          ],
        } satisfies OperationOutcome);
      });

      test('rejects tab and newline only strings', () => {
        const result = validate(undefined, [{ type: 'string' }], '\t \n');

        expect(result).toEqual({
          resourceType: 'OperationOutcome',
          issue: [
            {
              severity: errorRegistry[errorCodes.invalidString].severity,
              code: errorRegistry[errorCodes.invalidString].issueCode,
              details: {
                text: errorRegistry[errorCodes.invalidString].message({}),
              },
            },
          ],
        } satisfies OperationOutcome);
      });

      test('rejects strings longer than 1MB', () => {
        const tooLong = 'a'.repeat(FHIR_STRING_MAX_LENGTH + 1);
        const result = validate(undefined, [{ type: 'string' }], tooLong);

        expect(result).toEqual({
          resourceType: 'OperationOutcome',
          issue: [
            {
              severity: errorRegistry[errorCodes.stringTooLong].severity,
              code: errorRegistry[errorCodes.stringTooLong].issueCode,
              details: {
                text: errorRegistry[errorCodes.stringTooLong].message({
                  actualLength: FHIR_STRING_MAX_LENGTH + 1,
                  maxLength: FHIR_STRING_MAX_LENGTH,
                }),
              },
            },
          ],
        } satisfies OperationOutcome);
      });
    });
  });
});
