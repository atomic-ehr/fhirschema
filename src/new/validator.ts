import type { OperationOutcome } from '../converter/types.js';
import type {
  NewContext,
  NewData,
  NewSchemaList,
  NewValidateOptions,
  NewValidationResult,
} from './types.js';

function notImplementedOutcome(): OperationOutcome {
  return {
    resourceType: 'OperationOutcome',
    issue: [
      {
        severity: 'error',
        code: 'not-supported',
        details: {
          text: 'New validator is not implemented yet',
        },
      },
    ],
  };
}

export function validate(
  ctx: NewContext,
  schemaList: NewSchemaList,
  data: NewData,
  opts?: NewValidateOptions,
): NewValidationResult {
  void ctx;
  void schemaList;
  void data;
  void opts;

  return notImplementedOutcome();
}
