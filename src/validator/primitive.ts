import { FHIRSchema, OperationOutcome, OperationOutcomeIssue } from '../converter/types';
import * as fp from './fieldPath';

const SPEC_TO_NATIVE_TYPES: { [key in string]: string } = {
  decimal: 'number',
  boolean: 'boolean',
  integer: 'number',
  string: 'string',
};

const validate = (
  value: any,
  spec: FHIRSchema,
  location: fp.FieldPathComponent[]
): OperationOutcome => {
  const valueType = typeof value;

  const typeIssues = (() => {
    const nativeType = SPEC_TO_NATIVE_TYPES[spec.type];
    if (nativeType && valueType != nativeType)
      return [
        {
          severity: 'error',
          code: 'invalid',
          details: {
            text: `Type mismatch for field: ${fp.stringify(
              location
            )}, expected: ${nativeType}, actual: ${valueType}`,
          },
          expression: [fp.stringify(location, { asFhirPath: true })],
        } as OperationOutcomeIssue,
      ];
  })();

  const regexIssues = (() => {
    if (valueType != 'string' || !spec.regex) return;
    if (!value.match(spec.regex))
      return [
        {
          severity: 'error',
          code: 'invalid',
          details: {
            text: `Regex violation for field: ${fp.stringify(location)}, regex: '${
              spec.regex
            }', value: ${value}`,
          },
          expression: [fp.stringify(location, { asFhirPath: true })],
        } as OperationOutcomeIssue,
      ];
  })();

  const issues: OperationOutcomeIssue[] = [...(typeIssues || []), ...(regexIssues || [])];

  return {
    resourceType: 'OperationOutcome',
    issue: issues,
  };
};

export { validate };
