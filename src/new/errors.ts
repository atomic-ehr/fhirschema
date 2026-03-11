import type { OperationOutcomeIssue } from '../converter/types.js';

export const errorCodes = {
  typeMismatch: 'type_mismatch',
  invalidString: 'invalid_string',
  integerOutOfRange: 'integer_out_of_range',
  invalidPrimitiveExtension: 'invalid_primitive_extension',
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

type IntegerOutOfRangeParams = {
  max: number;
  min: number;
  path?: string;
  value: number;
};

type InvalidPrimitiveExtensionParams = {
  path?: string;
  reason: string;
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
  [errorCodes.integerOutOfRange]: {
    issueCode: 'invalid' as OperationOutcomeIssue['code'],
    severity: 'error' as OperationOutcomeIssue['severity'],
    message: ({ max, min, path, value }: IntegerOutOfRangeParams) =>
      path === undefined
        ? `[${errorCodes.integerOutOfRange}] Integer value out of range: expected ${min}..${max}, actual: ${value}`
        : `[${errorCodes.integerOutOfRange}] Integer value out of range for field: ${path}: expected ${min}..${max}, actual: ${value}`,
  },
  [errorCodes.invalidPrimitiveExtension]: {
    issueCode: 'invalid' as OperationOutcomeIssue['code'],
    severity: 'error' as OperationOutcomeIssue['severity'],
    message: ({ path, reason }: InvalidPrimitiveExtensionParams) =>
      path === undefined
        ? `[${errorCodes.invalidPrimitiveExtension}] Invalid primitive extension: ${reason}`
        : `[${errorCodes.invalidPrimitiveExtension}] Invalid primitive extension for field: ${path}: ${reason}`,
  },
} as const;
