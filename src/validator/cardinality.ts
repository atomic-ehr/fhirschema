import type {
  FHIRSchemaElement,
  OperationOutcome,
  OperationOutcomeIssue,
} from '../converter/types';
import * as fp from './fieldPath';

const validate = (
  data: any,
  spec: FHIRSchemaElement,
  location: fp.FieldPathComponent[],
): OperationOutcome => {
  if (!Array.isArray(data)) {
    const arrayData = [data].filter((item) => item);
    return validate(arrayData, spec, location);
  }

  if (spec.min && data.length < spec.min) {
    const issues: OperationOutcomeIssue[] = [
      {
        severity: 'error',
        code: 'invariant',
        details: {
          text: `Cardinality violation: ${fp.stringify(location)}, expected min: ${
            spec.min
          }, actual: ${data.length}`,
        },
        expression: [fp.stringify(location, { asFhirPath: true })],
      },
    ];

    return { resourceType: 'OperationOutcome', issue: issues };
  }

  if (spec.max && data.length > spec.max) {
    const issues: OperationOutcomeIssue[] = [
      {
        severity: 'error',
        code: 'invariant',
        details: {
          text: `Cardinality violation: ${fp.stringify(location)}, expected max: ${
            spec.max
          }, actual: ${data.length}`,
        },
        expression: [fp.stringify(location, { asFhirPath: true })],
      } as OperationOutcomeIssue,
    ];
    return { resourceType: 'OperationOutcome', issue: issues };
  }

  return { resourceType: 'OperationOutcome', issue: [] };
};

export { validate };
