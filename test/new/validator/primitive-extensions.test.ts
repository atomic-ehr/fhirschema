import { describe, expect, test } from 'bun:test';
import type { OperationOutcome } from '../../../src/converter/types';
import { errorCodes, errorRegistry } from '../../../src/new/errors';
import { validate } from '../../../src/new/validator';
import { OK_OUTCOME } from './fixture';

const DATA_ABSENT_REASON_URL =
  'http://hl7.org/fhir/StructureDefinition/data-absent-reason';

describe('New validator draft', () => {
  describe('Primitive extensions', () => {
    test('accepts a primitive value with a matching underscore sibling', () => {
      const result = validate(
        undefined,
        [{ elements: { birthDate: { type: 'date' } } }],
        {
          birthDate: '2024-03-15',
          _birthDate: {
            extension: [
              {
                url: DATA_ABSENT_REASON_URL,
                valueCode: 'unknown',
              },
            ],
          },
        },
      );

      expect(result).toEqual(OK_OUTCOME);
    });

    test('accepts a primitive underscore sibling without a primitive value', () => {
      const result = validate(
        undefined,
        [{ elements: { birthDate: { type: 'date', required: true} } }],
        {
          _birthDate: {
            extension: [
              {
                url: DATA_ABSENT_REASON_URL,
                valueCode: 'unknown',
              },
            ],
          },
        },
      );

      //todo binding test

      expect(result).toEqual(OK_OUTCOME);
    });

    test('accepts aligned repeating primitive arrays with null placeholders', () => {
      const result = validate(
        undefined,
        [{ elements: { alias: { type: 'string', array: true } } }],
        {
          alias: [null, 'Alice'],
          _alias: [
            {
              extension: [
                {
                  url: DATA_ABSENT_REASON_URL,
                  valueCode: 'masked',
                },
              ],
            },
            null, // необзяательно
          ],
        },
      );

      expect(result).toEqual(OK_OUTCOME);
    });

    test('rejects misaligned repeating primitive extension arrays', () => {
      const result = validate(
        undefined,
        [{ elements: { alias: { type: 'string', array: true } } }],
        {
          alias: ['Alice'],
          _alias: [
            {
              extension: [
                {
                  url: DATA_ABSENT_REASON_URL,
                  valueCode: 'masked',
                },
              ],
            },
            null,
          ],
        },
      );

      expect(result).toEqual({
        resourceType: 'OperationOutcome',
        issue: [
          {
            severity: errorRegistry[errorCodes.invalidPrimitiveExtension].severity,
            code: errorRegistry[errorCodes.invalidPrimitiveExtension].issueCode,
            details: {
              text: errorRegistry[errorCodes.invalidPrimitiveExtension].message({
                path: 'alias',
                reason: 'primitive value and underscore arrays must be aligned',
              }),
            },
          },
        ],
      } satisfies OperationOutcome);
    });

    test('rejects underscore siblings for non-primitive fields', () => {
      const result = validate(
        undefined,
        [{ elements: { address: { elements: { city: { type: 'string' } } } } }],
        {
          _address: {
            extension: [
              {
                url: DATA_ABSENT_REASON_URL,
                valueCode: 'masked',
              },
            ],
          },
        },
      );

      expect(result).toEqual({
        resourceType: 'OperationOutcome',
        issue: [
          {
            severity: errorRegistry[errorCodes.invalidPrimitiveExtension].severity,
            code: errorRegistry[errorCodes.invalidPrimitiveExtension].issueCode,
            details: {
              text: errorRegistry[errorCodes.invalidPrimitiveExtension].message({
                path: 'address',
                reason: 'underscore siblings are only valid for primitive fields',
              }),
            },
          },
        ],
      } satisfies OperationOutcome);
    });
  });
});
