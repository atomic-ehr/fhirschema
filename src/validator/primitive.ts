import { FHIRSchema, OperationOutcome, OperationOutcomeIssue } from '../converter/types';
import * as fp from './fieldPath';

const SPEC_TO_NATIVE_TYPES: { [key in string]: string } = {
  decimal: 'number',
  boolean: 'boolean',
  integer: 'number',
  string: 'string',
};

const validate = (
  data: any,
  spec: FHIRSchema,
  location: fp.FieldPathComponent[]
): OperationOutcome => {
  if (Array.isArray(data)) {
    const issues = data.flatMap((item, idx) => {
      const pathIndex: fp.FieldPathComponent = { type: 'index', name: `${idx}` };
      return validate(item, spec, [...location, pathIndex]).issue || [];
    });
    return { resourceType: 'OperationOutcome', issue: issues };
  }

  const valueType = typeof data;

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
    if (!data.match(spec.regex))
      return [
        {
          severity: 'error',
          code: 'invalid',
          details: {
            text: `Field: ${fp.stringify(
              location
            )}, contains invalid value: ${data}, doesn't match regex: '${spec.regex}'`,
          },
          expression: [fp.stringify(location, { asFhirPath: true })],
        } as OperationOutcomeIssue,
      ];
  })();

  return {
    resourceType: 'OperationOutcome',
    issue: [...(typeIssues || []), ...(regexIssues || [])],
  };
};

export { validate };
