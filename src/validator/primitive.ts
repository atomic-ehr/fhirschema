import { FHIRSchema, OperationOutcome } from '../converter/types';
import * as fp from './fieldPath';

const validate = (
  value: any,
  spec: FHIRSchema,
  location: fp.FieldPathComponent[]
): OperationOutcome => {
  return {
    resourceType: 'OperationOutcome',
    issue: [],
  };
};

export { validate };
