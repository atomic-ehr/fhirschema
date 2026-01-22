import type { FHIRSchema, OperationOutcome, OperationOutcomeIssue } from '../converter/types';
import * as fp from './fieldPath';

// FHIR primitive types that map to JavaScript 'string'
const STRING_TYPES = new Set([
  'string',
  'code',
  'id',
  'markdown',
  'uri',
  'url',
  'canonical',
  'oid',
  'uuid',
  'base64Binary',
  'xhtml',
  'date',
  'dateTime',
  'time',
  'instant',
]);

// FHIR primitive types that map to JavaScript 'number'
const NUMBER_TYPES = new Set(['decimal', 'unsignedInt', 'positiveInt']);

// FHIR primitive types that must be integers (no decimal point)
const INTEGER_TYPES = new Set(['integer', 'unsignedInt', 'positiveInt']);

const validate = (
  data: unknown,
  spec: FHIRSchema,
  location: fp.FieldPathComponent[],
): OperationOutcome => {
  if (Array.isArray(data)) {
    const issues = data.flatMap((item, idx) => {
      const pathIndex: fp.FieldPathComponent = { type: 'index', name: `${idx}` };
      return validate(item, spec, [...location, pathIndex]).issue || [];
    });
    return { resourceType: 'OperationOutcome', issue: issues };
  }

  const valueType = typeof data;
  const specType = spec.type ?? '';
  const issues: OperationOutcomeIssue[] = [];

  // Type validation
  if (STRING_TYPES.has(specType)) {
    if (valueType !== 'string') {
      issues.push({
        severity: 'error',
        code: 'invalid',
        details: {
          text: `Type mismatch for field: ${fp.stringify(location)}, expected: string, actual: ${valueType}`,
        },
        expression: [fp.stringify(location, { asFhirPath: true })],
      });
    }
  } else if (NUMBER_TYPES.has(specType) || INTEGER_TYPES.has(specType)) {
    if (valueType !== 'number') {
      issues.push({
        severity: 'error',
        code: 'invalid',
        details: {
          text: `Type mismatch for field: ${fp.stringify(location)}, expected: number, actual: ${valueType}`,
        },
        expression: [fp.stringify(location, { asFhirPath: true })],
      });
    } else if (INTEGER_TYPES.has(specType) && !Number.isInteger(data)) {
      issues.push({
        severity: 'error',
        code: 'invalid',
        details: {
          text: `Type mismatch for field: ${fp.stringify(location)}, expected: integer, actual: decimal`,
        },
        expression: [fp.stringify(location, { asFhirPath: true })],
      });
    }
  } else if (specType === 'boolean') {
    if (valueType !== 'boolean') {
      issues.push({
        severity: 'error',
        code: 'invalid',
        details: {
          text: `Type mismatch for field: ${fp.stringify(location)}, expected: boolean, actual: ${valueType}`,
        },
        expression: [fp.stringify(location, { asFhirPath: true })],
      });
    }
  }

  // Additional constraints for specific types
  if (issues.length === 0 && valueType === 'number') {
    if (specType === 'unsignedInt' && (data as number) < 0) {
      issues.push({
        severity: 'error',
        code: 'invalid',
        details: {
          text: `Value for field: ${fp.stringify(location)} must be >= 0, got: ${data}`,
        },
        expression: [fp.stringify(location, { asFhirPath: true })],
      });
    } else if (specType === 'positiveInt' && (data as number) < 1) {
      issues.push({
        severity: 'error',
        code: 'invalid',
        details: {
          text: `Value for field: ${fp.stringify(location)} must be >= 1, got: ${data}`,
        },
        expression: [fp.stringify(location, { asFhirPath: true })],
      });
    }
  }

  // Regex validation (if schema provides regex pattern)
  if (issues.length === 0 && valueType === 'string' && spec.regex) {
    if (!(data as string).match(spec.regex)) {
      issues.push({
        severity: 'error',
        code: 'invalid',
        details: {
          text: `Field: ${fp.stringify(location)}, contains invalid value: ${data}, doesn't match regex: '${spec.regex}'`,
        },
        expression: [fp.stringify(location, { asFhirPath: true })],
      });
    }
  }

  return { resourceType: 'OperationOutcome', issue: issues };
};

export { validate };
