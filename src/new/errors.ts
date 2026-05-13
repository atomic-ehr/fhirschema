import type { OperationOutcomeIssue } from '../converter/types.js';

export const errorCodes = {
  typeMismatch: 'type_mismatch', //to codes like FS001
  invalidString: 'invalid_string',
  stringTooLong: 'string_too_long',
  invalidDate: 'invalid_date',
  integerOutOfRange: 'integer_out_of_range',
  invalidPrimitiveExtension: 'invalid_primitive_extension',
  requiredField: 'required_field',
  unknownField: 'unknown_field',
  cardinalityViolation: 'cardinality_violation',
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

type StringTooLongParams = {
  actualLength: number;
  maxLength: number;
  path?: string;
};

type InvalidDateParams = {
  path?: string;
  reason: string;
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

type RequiredFieldParams = {
  field: string;
  path?: string;
};

type UnknownFieldParams = {
  field: string;
  path?: string;
};

type CardinalityViolationParams = {
  actual: number;
  bound: 'min' | 'max';
  expected: number;
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
  [errorCodes.stringTooLong]: {
    issueCode: 'invalid' as OperationOutcomeIssue['code'],
    severity: 'error' as OperationOutcomeIssue['severity'],
    message: ({ actualLength, maxLength, path }: StringTooLongParams) =>
      path === undefined
        ? `[${errorCodes.stringTooLong}] String exceeds maximum length: max ${maxLength}, actual ${actualLength}`
        : `[${errorCodes.stringTooLong}] String exceeds maximum length for field: ${path}: max ${maxLength}, actual ${actualLength}`,
  },
  [errorCodes.invalidDate]: {
    issueCode: 'invalid' as OperationOutcomeIssue['code'],
    severity: 'error' as OperationOutcomeIssue['severity'],
    message: ({ path, reason }: InvalidDateParams) =>
      path === undefined
        ? `[${errorCodes.invalidDate}] Invalid date value: ${reason}`
        : `[${errorCodes.invalidDate}] Invalid date value for field: ${path}: ${reason}`,
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
  [errorCodes.requiredField]: {
    issueCode: 'required' as OperationOutcomeIssue['code'],
    severity: 'error' as OperationOutcomeIssue['severity'],
    message: ({ field, path }: RequiredFieldParams) =>
      path === undefined
        ? `[${errorCodes.requiredField}] Required field missing: ${field}`
        : `[${errorCodes.requiredField}] Required field missing: ${path}.${field}`,
  },
  [errorCodes.unknownField]: {
    issueCode: 'structure' as OperationOutcomeIssue['code'],
    severity: 'error' as OperationOutcomeIssue['severity'],
    message: ({ field, path }: UnknownFieldParams) =>
      path === undefined
        ? `[${errorCodes.unknownField}] Unknown field: ${field}`
        : `[${errorCodes.unknownField}] Unknown field: ${path}.${field}`,
  },
  [errorCodes.cardinalityViolation]: {
    issueCode: 'invariant' as OperationOutcomeIssue['code'],
    severity: 'error' as OperationOutcomeIssue['severity'],
    message: ({ actual, bound, expected, path }: CardinalityViolationParams) =>
      path === undefined
        ? `[${errorCodes.cardinalityViolation}] Array length violates ${bound}=${expected}, actual: ${actual}`
        : `[${errorCodes.cardinalityViolation}] Array length violates ${bound}=${expected} for field: ${path}, actual: ${actual}`,
  },
} as const;
