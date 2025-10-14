import { describe, test, expect } from 'bun:test';
import type { OperationOutcome } from '../../src/converter/types';
import { typesIndex } from './fixture';
import * as sut from '../../src/validator/primitive';

describe('Primitive validations', () => {
  describe('Type checks', () => {
    test('string good', () => {
      const spec = typesIndex['string'];
      const result = sut.validate('foo', spec, [{ type: 'field', name: 'value' }]);

      expect(result).toEqual({ resourceType: 'OperationOutcome', issue: [] } as OperationOutcome);
    });

    test('string bad type', () => {
      const spec = typesIndex['string'];
      const result = sut.validate(123, spec, [{ type: 'field', name: 'value' }]);

      expect(result).toEqual({
        resourceType: 'OperationOutcome',
        issue: [
          {
            severity: 'error',
            code: 'invalid',
            details: { text: 'Type mismatch for field: value, expected: string, actual: number' },
            expression: ['value'],
          },
        ],
      } as OperationOutcome);
    });

    test('decimal good', () => {
      const spec = typesIndex['decimal'];
      const result = sut.validate(3.14, spec, [{ type: 'field', name: 'value' }]);

      expect(result).toEqual({ resourceType: 'OperationOutcome', issue: [] } as OperationOutcome);
    });

    test('decimal bad type', () => {
      const spec = typesIndex['decimal'];
      const result = sut.validate('not a number', spec, [{ type: 'field', name: 'value' }]);

      expect(result).toEqual({
        resourceType: 'OperationOutcome',
        issue: [
          {
            severity: 'error',
            code: 'invalid',
            details: { text: 'Type mismatch for field: value, expected: number, actual: string' },
            expression: ['value'],
          },
          {
            severity: 'error',
            code: 'invalid',
            details: {
              text: "Field: value, contains invalid value: not a number, doesn't match regex: '-?(0|[1-9][0-9]*)(\\.[0-9]+)?([eE][+-]?[0-9]+)?'",
            },
            expression: ['value'],
          },
        ],
      } as OperationOutcome);
    });
  });

  describe('Regex checks', () => {
    test('string bad regex', () => {
      const spec = typesIndex['string'];
      const result = sut.validate('', spec, [{ type: 'field', name: 'value' }]);

      expect(result).toEqual({
        resourceType: 'OperationOutcome',
        issue: [
          {
            severity: 'error',
            code: 'invalid',
            details: {
              text: "Field: value, contains invalid value: , doesn't match regex: '[ \\r\\n\\t\\S]+'",
            },
            expression: ['value'],
          },
        ],
      } as OperationOutcome);
    });

    test('code good', () => {
      const spec = typesIndex['code'];
      const result = sut.validate('active', spec, [{ type: 'field', name: 'value' }]);

      expect(result).toEqual({ resourceType: 'OperationOutcome', issue: [] } as OperationOutcome);
    });

    test('code bad regex', () => {
      const spec = typesIndex['code'];
      const result = sut.validate('   ', spec, [{ type: 'field', name: 'value' }]);

      expect(result).toEqual({
        resourceType: 'OperationOutcome',
        issue: [
          {
            severity: 'error',
            code: 'invalid',
            details: {
              text: "Field: value, contains invalid value:    , doesn't match regex: '[^\\s]+(\\s[^\\s]+)*'",
            },
            expression: ['value'],
          },
        ],
      } as OperationOutcome);
    });

    test('uri good', () => {
      const spec = typesIndex['uri'];
      const result = sut.validate('http://example.com/fhir', spec, [
        { type: 'field', name: 'value' },
      ]);

      expect(result).toEqual({ resourceType: 'OperationOutcome', issue: [] } as OperationOutcome);
    });

    test('date good', () => {
      const spec = typesIndex['date'];
      const result = sut.validate('2024-03-15', spec, [{ type: 'field', name: 'value' }]);

      expect(result).toEqual({ resourceType: 'OperationOutcome', issue: [] } as OperationOutcome);
    });

    test('date bad regex', () => {
      const spec = typesIndex['date'];
      const result = sut.validate('not-a-date', spec, [{ type: 'field', name: 'value' }]);

      expect(result).toEqual({
        resourceType: 'OperationOutcome',
        issue: [
          {
            severity: 'error',
            code: 'invalid',
            details: {
              text: "Field: value, contains invalid value: not-a-date, doesn't match regex: '([0-9]([0-9]([0-9][1-9]|[1-9]0)|[1-9]00)|[1-9]000)(-(0[1-9]|1[0-2])(-(0[1-9]|[1-2][0-9]|3[0-1]))?)?'",
            },
            expression: ['value'],
          },
        ],
      } as OperationOutcome);
    });

    test('dateTime good', () => {
      const spec = typesIndex['dateTime'];
      const result = sut.validate('2024-03-15T14:30:00Z', spec, [{ type: 'field', name: 'value' }]);

      expect(result).toEqual({ resourceType: 'OperationOutcome', issue: [] } as OperationOutcome);
    });

    test('dateTime bad regex', () => {
      const spec = typesIndex['dateTime'];
      const result = sut.validate('not-a-datetime', spec, [{ type: 'field', name: 'value' }]);

      expect(result).toEqual({
        resourceType: 'OperationOutcome',
        issue: [
          {
            severity: 'error',
            code: 'invalid',
            details: {
              text: "Field: value, contains invalid value: not-a-datetime, doesn't match regex: '([0-9]([0-9]([0-9][1-9]|[1-9]0)|[1-9]00)|[1-9]000)(-(0[1-9]|1[0-2])(-(0[1-9]|[1-2][0-9]|3[0-1])(T([01][0-9]|2[0-3]):[0-5][0-9]:([0-5][0-9]|60)(\\.[0-9]+)?(Z|(\\+|-)((0[0-9]|1[0-3]):[0-5][0-9]|14:00)))?)?)?'",
            },
            expression: ['value'],
          },
        ],
      } as OperationOutcome);
    });

    test('instant good', () => {
      const spec = typesIndex['instant'];
      const result = sut.validate('2024-03-15T14:30:00.000Z', spec, [
        { type: 'field', name: 'value' },
      ]);

      expect(result).toEqual({ resourceType: 'OperationOutcome', issue: [] } as OperationOutcome);
    });

    test('instant bad regex', () => {
      const spec = typesIndex['instant'];
      const result = sut.validate('2024-03-15', spec, [{ type: 'field', name: 'value' }]);

      expect(result).toEqual({
        resourceType: 'OperationOutcome',
        issue: [
          {
            severity: 'error',
            code: 'invalid',
            details: {
              text: "Field: value, contains invalid value: 2024-03-15, doesn't match regex: '([0-9]([0-9]([0-9][1-9]|[1-9]0)|[1-9]00)|[1-9]000)-(0[1-9]|1[0-2])-(0[1-9]|[1-2][0-9]|3[0-1])T([01][0-9]|2[0-3]):[0-5][0-9]:([0-5][0-9]|60)(\\.[0-9]+)?(Z|(\\+|-)((0[0-9]|1[0-3]):[0-5][0-9]|14:00))'",
            },
            expression: ['value'],
          },
        ],
      } as OperationOutcome);
    });

    test('canonical good', () => {
      const spec = typesIndex['canonical'];
      const result = sut.validate('http://hl7.org/fhir/StructureDefinition/Patient', spec, [
        { type: 'field', name: 'value' },
      ]);

      expect(result).toEqual({ resourceType: 'OperationOutcome', issue: [] } as OperationOutcome);
    });
  });
});
