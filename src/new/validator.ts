import type { OperationOutcome, OperationOutcomeIssue } from '../converter/types.js';
import { errorCodes, errorRegistry } from './errors.js';
import type {
  ElementDef,
  NewContext,
  NewData,
  NewSchemaList,
  NewValidateOptions,
  NewValidationResult,
  SchemaFragment,
} from './types.js';

const FHIR_STRING_MAX_LENGTH = 1024 * 1024;
const FHIR_MIN_INT = -2147483648;
const FHIR_MAX_INT = 2147483647;

const PRIMITIVE_JS_TYPES: Record<string, string> = {
  string: 'string',
  date: 'string',
  dateTime: 'string',
  instant: 'string',
  time: 'string',
  uri: 'string',
  url: 'string',
  canonical: 'string',
  code: 'string',
  id: 'string',
  markdown: 'string',
  oid: 'string',
  uuid: 'string',
  base64Binary: 'string',
  xhtml: 'string',
  integer: 'number',
  decimal: 'number',
  unsignedInt: 'number',
  positiveInt: 'number',
  boolean: 'boolean',
};

function isPrimitive(type: string): boolean {
  return type in PRIMITIVE_JS_TYPES;
}

function typeOf(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function okOutcome(): OperationOutcome {
  return {
    resourceType: 'OperationOutcome',
    issue: [
      {
        severity: 'information',
        code: 'informational',
        details: { text: 'Validation succeeded' },
      },
    ],
  };
}

function errorOutcome(issues: OperationOutcomeIssue[]): OperationOutcome {
  return { resourceType: 'OperationOutcome', issue: issues };
}

function makeIssue(code: string, params: Record<string, unknown>): OperationOutcomeIssue {
  const def = errorRegistry[code as keyof typeof errorRegistry];
  return {
    severity: def.severity,
    code: def.issueCode,
    details: { text: (def.message as (p: never) => string)(params as never) },
  };
}

// --- Primitive validators ---

const DATE_RE = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/;

function validateString(value: unknown): OperationOutcomeIssue[] {
  const t = typeOf(value);
  if (t !== 'string') return [makeIssue(errorCodes.typeMismatch, { actual: t, expected: 'string' })];
  const s = value as string;
  if (s.trim().length === 0) return [makeIssue(errorCodes.invalidString, {})];
  if (s.length > FHIR_STRING_MAX_LENGTH)
    return [makeIssue(errorCodes.stringTooLong, { actualLength: s.length, maxLength: FHIR_STRING_MAX_LENGTH })];
  return [];
}

function validateInteger(value: unknown): OperationOutcomeIssue[] {
  const t = typeOf(value);
  if (t !== 'number') return [makeIssue(errorCodes.typeMismatch, { actual: t, expected: 'number' })];
  const n = value as number;
  if (!Number.isInteger(n))
    return [makeIssue(errorCodes.typeMismatch, { actual: 'decimal', expected: 'integer' })];
  if (n < FHIR_MIN_INT || n > FHIR_MAX_INT)
    return [makeIssue(errorCodes.integerOutOfRange, { min: FHIR_MIN_INT, max: FHIR_MAX_INT, value: n })];
  return [];
}

function validateDateValue(value: unknown): OperationOutcomeIssue[] {
  const t = typeOf(value);
  if (t !== 'string') return [makeIssue(errorCodes.typeMismatch, { actual: t, expected: 'string' })];
  const m = DATE_RE.exec(value as string);
  if (!m)
    return [makeIssue(errorCodes.invalidDate, { reason: 'must use FHIR date precision yyyy, yyyy-mm, or yyyy-mm-dd' })];
  const year = Number(m[1]);
  const month = m[2] ? Number(m[2]) : undefined;
  const day = m[3] ? Number(m[3]) : undefined;
  if (month !== undefined && (month < 1 || month > 12))
    return [makeIssue(errorCodes.invalidDate, { reason: 'must be a real calendar date' })];
  if (day !== undefined && month !== undefined) {
    const maxDay = new Date(year, month, 0).getDate();
    if (day < 1 || day > maxDay)
      return [makeIssue(errorCodes.invalidDate, { reason: 'must be a real calendar date' })];
  }
  return [];
}

function validatePrimitive(type: string, value: unknown): OperationOutcomeIssue[] {
  switch (type) {
    case 'string': return validateString(value);
    case 'integer': return validateInteger(value);
    case 'date': return validateDateValue(value);
    default: return [];
  }
}

// --- Element validation ---

function validateElements(
  ctx: NewContext,
  elements: Record<string, ElementDef>,
  data: unknown,
  strict: boolean,
): OperationOutcomeIssue[] {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return [makeIssue(errorCodes.typeMismatch, { actual: typeOf(data), expected: 'object' })];
  }

  const obj = data as Record<string, unknown>;
  const issues: OperationOutcomeIssue[] = [];
  const knownKeys = new Set<string>();

  for (const [name, def] of Object.entries(elements)) {
    knownKeys.add(name);
    const extKey = `_${name}`;
    const hasValue = name in obj;
    const hasExt = extKey in obj;

    if (hasExt) {
      knownKeys.add(extKey);
      if (def.type && isPrimitive(def.type)) {
        if (def.array && hasValue) {
          const va = obj[name];
          const ea = obj[extKey];
          if (Array.isArray(va) && Array.isArray(ea) && va.length !== ea.length) {
            issues.push(makeIssue(errorCodes.invalidPrimitiveExtension, {
              path: name, reason: 'primitive value and underscore arrays must be aligned',
            }));
          }
        }
      } else {
        issues.push(makeIssue(errorCodes.invalidPrimitiveExtension, {
          path: name, reason: 'underscore siblings are only valid for primitive fields',
        }));
      }
    }

    if (strict && def.required && !hasValue && !hasExt) {
      issues.push(makeIssue(errorCodes.requiredField, { field: name }));
    }

    if (hasValue) {
      const value = obj[name];
      if (def.array) continue;

      if (def.type) {
        if (isPrimitive(def.type)) {
          const expectedJs = PRIMITIVE_JS_TYPES[def.type];
          const actual = typeOf(value);
          if (actual !== expectedJs) {
            issues.push(makeIssue(errorCodes.typeMismatch, { path: name, actual, expected: def.type }));
          }
        } else if (ctx?.[def.type]?.elements) {
          issues.push(...validateElements(ctx, ctx[def.type].elements!, value, false));
        }
      } else if (def.elements) {
        issues.push(...validateElements(ctx, def.elements, value, false));
      }
    }
  }

  if (strict) {
    for (const key of Object.keys(obj)) {
      if (!knownKeys.has(key)) {
        issues.push(makeIssue(errorCodes.unknownField, { field: key }));
      }
    }
  }

  return issues;
}

// --- Main entry ---

export function validate(
  ctx: NewContext,
  schemaList: NewSchemaList,
  data: NewData,
  _opts?: NewValidateOptions,
): NewValidationResult {
  let mergedElements: Record<string, ElementDef> = {};
  let primitiveType: string | undefined;
  let isArray = false;
  let isStrict = false;
  let hasElements = false;

  for (const schema of schemaList as SchemaFragment[]) {
    if (schema.type === 'elements') {
      isStrict = true;
    } else if (schema.type && isPrimitive(schema.type)) {
      primitiveType = schema.type;
    }
    if (schema.array) isArray = true;
    if (schema.elements) {
      hasElements = true;
      mergedElements = { ...mergedElements, ...schema.elements };
    }
  }

  if (primitiveType) {
    if (isArray) return okOutcome();
    const issues = validatePrimitive(primitiveType, data);
    return issues.length > 0 ? errorOutcome(issues) : okOutcome();
  }

  if (hasElements) {
    const issues = validateElements(ctx, mergedElements, data, isStrict);
    return issues.length > 0 ? errorOutcome(issues) : okOutcome();
  }

  return okOutcome();
}
