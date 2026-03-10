import type { OperationOutcomeIssue } from '../converter/types.js';

export const errorCodes = {
  typeMismatch: 'type_mismatch',
  invalidString: 'invalid_string',
} as const;

export type NewErrorCode = (typeof errorCodes)[keyof typeof errorCodes];

type TypeMismatchParams = {
  actual: string;
  expected: string;
  path?: string;
};

type InvalidStringParams = {
  path?: string;
};

export const errorRegistry = {
  [errorCodes.typeMismatch]: {
    issueCode: 'invalid' as OperationOutcomeIssue['code'],
    severity: 'error' as OperationOutcomeIssue['severity'],
    message: ({ actual, expected, path }: TypeMismatchParams) =>
      path === undefined
        ? `[${errorCodes.typeMismatch}] Type mismatch: expected: ${expected}, actual: ${actual}`
        : `[${errorCodes.typeMismatch}] Type mismatch for field: ${path}, expected: ${expected}, actual: ${actual}`,
  },
  [errorCodes.invalidString]: {
    issueCode: 'invalid' as OperationOutcomeIssue['code'],
    severity: 'error' as OperationOutcomeIssue['severity'],
    message: ({ path }: InvalidStringParams) =>
      path === undefined
        ? `[${errorCodes.invalidString}] Invalid string value: must not be empty or whitespace-only`
        : `[${errorCodes.invalidString}] Invalid string value for field: ${path}: must not be empty or whitespace-only`,
  },
} as const;
