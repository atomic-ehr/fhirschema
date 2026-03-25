import { describe, expect, test } from 'bun:test';
import type { OperationOutcome } from '../../../src/converter/types';
import { errorCodes, errorRegistry } from '../../../src/new/errors';
import { validate } from '../../../src/new/validator';
import { OK_OUTCOME } from './fixture';

describe('New validator draft', () => {
  describe('Element validation', () => {
    const nameSchema = [
      {
        type: 'elements',
        elements: {
          name: { type: 'string', required: true },
        },
      },
    ];

    test('accepts object with required string field', () => {
      const result = validate(undefined, nameSchema, { name: 'John' });

      expect(result).toEqual(OK_OUTCOME);
    });

    test('rejects missing required field', () => {
      const result = validate(undefined, nameSchema, {});

      expect(result).toEqual({
        resourceType: 'OperationOutcome',
        issue: [
          {
            severity: errorRegistry[errorCodes.requiredField].severity,
            code: errorRegistry[errorCodes.requiredField].issueCode,
            details: {
              text: errorRegistry[errorCodes.requiredField].message({
                field: 'name',
              }),
            },
          },
        ],
      } satisfies OperationOutcome);
    });

    test('rejects wrong type in field', () => {
      const result = validate(undefined, nameSchema, { name: 123 });

      expect(result).toEqual({
        resourceType: 'OperationOutcome',
        issue: [
          {
            severity: errorRegistry[errorCodes.typeMismatch].severity,
            code: errorRegistry[errorCodes.typeMismatch].issueCode,
            details: {
              text: errorRegistry[errorCodes.typeMismatch].message({
                path: 'name',
                actual: 'number',
                expected: 'string',
              }),
            },
          },
        ],
      } satisfies OperationOutcome);
    });

    test('rejects null in required field', () => {
      const result = validate(undefined, nameSchema, { name: null });

      expect(result).toEqual({
        resourceType: 'OperationOutcome',
        issue: [
          {
            severity: errorRegistry[errorCodes.typeMismatch].severity,
            code: errorRegistry[errorCodes.typeMismatch].issueCode,
            details: {
              text: errorRegistry[errorCodes.typeMismatch].message({
                path: 'name',
                actual: 'null',
                expected: 'string',
              }),
            },
          },
        ],
      } satisfies OperationOutcome);
    });

    test('rejects non-object data', () => {
      const result = validate(undefined, nameSchema, 'not an object');

      expect(result).toEqual({
        resourceType: 'OperationOutcome',
        issue: [
          {
            severity: errorRegistry[errorCodes.typeMismatch].severity,
            code: errorRegistry[errorCodes.typeMismatch].issueCode,
            details: {
              text: errorRegistry[errorCodes.typeMismatch].message({
                actual: 'string',
                expected: 'object',
              }),
            },
          },
        ],
      } satisfies OperationOutcome);
    });

    test('rejects unknown fields', () => {
      const result = validate(undefined, nameSchema, { name: 'John', age: 30 });

      expect(result).toEqual({
        resourceType: 'OperationOutcome',
        issue: [
          {
            severity: errorRegistry[errorCodes.unknownField].severity,
            code: errorRegistry[errorCodes.unknownField].issueCode,
            details: {
              text: errorRegistry[errorCodes.unknownField].message({
                field: 'age',
              }),
            },
          },
        ],
      } satisfies OperationOutcome);
    });

    test('accepts optional field when absent', () => {
      const schema = [
        {
          type: 'elements',
          elements: {
            name: { type: 'string', required: true },
            nickname: { type: 'string' },
          },
        },
      ];

      const result = validate(undefined, schema, { name: 'John' });

      expect(result).toEqual(OK_OUTCOME);
    });

    test('accepts optional field when present', () => {
      const schema = [
        {
          type: 'elements',
          elements: {
            name: { type: 'string', required: true },
            nickname: { type: 'string' },
          },
        },
      ];

      const result = validate(undefined, schema, { name: 'John', nickname: 'JD' });

      expect(result).toEqual(OK_OUTCOME);
    });

    test('validates multiple fields and collects all errors', () => {
      const schema = [
        {
          type: 'elements',
          elements: {
            name: { type: 'string', required: true },
            age: { type: 'integer', required: true },
          },
        },
      ];

      const result = validate(undefined, schema, { name: 123, age: 'old' });

      expect(result).toEqual({
        resourceType: 'OperationOutcome',
        issue: [
          {
            severity: errorRegistry[errorCodes.typeMismatch].severity,
            code: errorRegistry[errorCodes.typeMismatch].issueCode,
            details: {
              text: errorRegistry[errorCodes.typeMismatch].message({
                path: 'name',
                actual: 'number',
                expected: 'string',
              }),
            },
          },
          {
            severity: errorRegistry[errorCodes.typeMismatch].severity,
            code: errorRegistry[errorCodes.typeMismatch].issueCode,
            details: {
              text: errorRegistry[errorCodes.typeMismatch].message({
                path: 'age',
                actual: 'string',
                expected: 'integer',
              }),
            },
          },
        ],
      } satisfies OperationOutcome);
    });

    test('accepts empty object when no fields are required', () => {
      const schema = [
        {
          type: 'elements',
          elements: {
            name: { type: 'string' },
            nickname: { type: 'string' },
          },
        },
      ];

      const result = validate(undefined, schema, {});

      expect(result).toEqual(OK_OUTCOME);
    });
  });
});
