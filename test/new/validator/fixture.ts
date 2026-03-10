import type { OperationOutcome } from '../../../src/converter/types';

export const OK_OUTCOME: OperationOutcome = {
  resourceType: 'OperationOutcome',
  issue: [
    {
      severity: 'information',
      code: 'informational',
      details: { text: 'Validation succeeded' },
    },
  ],
};
