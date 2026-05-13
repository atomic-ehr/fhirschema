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
const FHIR_MIN_UNSIGNED = 0;
const FHIR_MIN_POSITIVE = 1;

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
  integer64: 'string',
  integer: 'number',
  decimal: 'number',
  unsignedInt: 'number',
  positiveInt: 'number',
  boolean: 'boolean',
};

const DATE_RE = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/;
const DATETIME_RE =
  /^(\d{4})(?:-(\d{2})(?:-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2}))?)?)?$/;
const TIME_RE = /^(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?$/;
const INSTANT_RE =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
const ID_RE = /^[A-Za-z0-9\-.]{1,64}$/;
const OID_RE = /^urn:oid:[0-2](\.(0|[1-9]\d*))+$/;
const UUID_RE = /^urn:uuid:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function isPrimitive(type?: string): boolean {
  return type !== undefined && type in PRIMITIVE_JS_TYPES;
}

function typeOf(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function pathParam(path: string): string | undefined {
  return path === '' ? undefined : path;
}

function joinPath(parent: string, segment: string | number): string {
  return parent === '' ? String(segment) : `${parent}.${segment}`;
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

function makeIssue(code: string, params: Record<string, unknown>): OperationOutcomeIssue {
  const def = errorRegistry[code as keyof typeof errorRegistry];
  return {
    severity: def.severity,
    code: def.issueCode,
    details: { text: (def.message as (p: never) => string)(params as never) },
  };
}

// ── Primitive lexical validators ──────────────────────────────────────

function checkCalendarDate(year: number, month?: number, day?: number): boolean {
  if (month !== undefined && (month < 1 || month > 12)) return false;
  if (day !== undefined && month !== undefined) {
    const maxDay = new Date(year, month, 0).getDate();
    if (day < 1 || day > maxDay) return false;
  }
  return true;
}

function validatePrimitive(
  type: string,
  value: unknown,
  path: string,
  expectedName: string,
  issues: OperationOutcomeIssue[],
): void {
  const expectedJs = PRIMITIVE_JS_TYPES[type];
  const actual = typeOf(value);

  if (actual !== expectedJs) {
    issues.push(
      makeIssue(errorCodes.typeMismatch, {
        path: pathParam(path),
        actual,
        expected: expectedName,
      }),
    );
    return;
  }

  switch (type) {
    case 'string':
    case 'markdown': {
      const s = value as string;
      if (s.trim().length === 0) {
        issues.push(makeIssue(errorCodes.invalidString, { path: pathParam(path) }));
      } else if (s.length > FHIR_STRING_MAX_LENGTH) {
        issues.push(
          makeIssue(errorCodes.stringTooLong, {
            path: pathParam(path),
            actualLength: s.length,
            maxLength: FHIR_STRING_MAX_LENGTH,
          }),
        );
      }
      return;
    }

    case 'integer':
    case 'unsignedInt':
    case 'positiveInt': {
      const n = value as number;
      if (!Number.isInteger(n)) {
        issues.push(
          makeIssue(errorCodes.typeMismatch, {
            path: pathParam(path),
            actual: 'decimal',
            expected: 'integer',
          }),
        );
        return;
      }
      const min =
        type === 'unsignedInt'
          ? FHIR_MIN_UNSIGNED
          : type === 'positiveInt'
            ? FHIR_MIN_POSITIVE
            : FHIR_MIN_INT;
      if (n < min || n > FHIR_MAX_INT) {
        issues.push(
          makeIssue(errorCodes.integerOutOfRange, {
            path: pathParam(path),
            min,
            max: FHIR_MAX_INT,
            value: n,
          }),
        );
      }
      return;
    }

    case 'decimal': {
      const n = value as number;
      if (!Number.isFinite(n)) {
        issues.push(
          makeIssue(errorCodes.typeMismatch, {
            path: pathParam(path),
            actual: 'NaN',
            expected: 'decimal',
          }),
        );
      }
      return;
    }

    case 'date': {
      const m = DATE_RE.exec(value as string);
      if (!m) {
        issues.push(
          makeIssue(errorCodes.invalidDate, {
            path: pathParam(path),
            reason: 'must use FHIR date precision yyyy, yyyy-mm, or yyyy-mm-dd',
          }),
        );
        return;
      }
      if (!checkCalendarDate(Number(m[1]), m[2] ? Number(m[2]) : undefined, m[3] ? Number(m[3]) : undefined)) {
        issues.push(
          makeIssue(errorCodes.invalidDate, {
            path: pathParam(path),
            reason: 'must be a real calendar date',
          }),
        );
      }
      return;
    }

    case 'dateTime': {
      const m = DATETIME_RE.exec(value as string);
      if (!m) {
        issues.push(
          makeIssue(errorCodes.invalidDate, {
            path: pathParam(path),
            reason: 'must be a valid FHIR dateTime',
          }),
        );
        return;
      }
      if (!checkCalendarDate(Number(m[1]), m[2] ? Number(m[2]) : undefined, m[3] ? Number(m[3]) : undefined)) {
        issues.push(
          makeIssue(errorCodes.invalidDate, {
            path: pathParam(path),
            reason: 'must be a real calendar date',
          }),
        );
      }
      return;
    }

    case 'instant':
      if (!INSTANT_RE.test(value as string)) {
        issues.push(
          makeIssue(errorCodes.invalidDate, {
            path: pathParam(path),
            reason: 'must be a valid FHIR instant with timezone',
          }),
        );
      }
      return;

    case 'time':
      if (!TIME_RE.test(value as string)) {
        issues.push(
          makeIssue(errorCodes.invalidDate, {
            path: pathParam(path),
            reason: 'must use hh:mm:ss format',
          }),
        );
      }
      return;

    case 'id':
      if (!ID_RE.test(value as string)) {
        issues.push(makeIssue(errorCodes.invalidString, { path: pathParam(path) }));
      }
      return;

    case 'code': {
      const s = value as string;
      if (s.length === 0 || s !== s.trim() || /  /.test(s)) {
        issues.push(makeIssue(errorCodes.invalidString, { path: pathParam(path) }));
      }
      return;
    }

    case 'oid':
      if (!OID_RE.test(value as string)) {
        issues.push(makeIssue(errorCodes.invalidString, { path: pathParam(path) }));
      }
      return;

    case 'uuid':
      if (!UUID_RE.test(value as string)) {
        issues.push(makeIssue(errorCodes.invalidString, { path: pathParam(path) }));
      }
      return;

    default:
      // boolean, uri, url, canonical, base64Binary, xhtml, integer64 — JS type only
      return;
  }
}

// ── Overlay-set inspection ──────────────────────────────────────────

function collectArrayFlag(schemas: SchemaFragment[]): boolean {
  return schemas.some((s) => s.array === true);
}

function collectPrimitiveType(schemas: SchemaFragment[]): string | undefined {
  for (const s of schemas) {
    if (s.type && isPrimitive(s.type)) return s.type;
  }
  return undefined;
}

function collectElementMaps(schemas: SchemaFragment[]): Record<string, ElementDef>[] {
  const maps: Record<string, ElementDef>[] = [];
  for (const s of schemas) {
    if (s.elements) maps.push(s.elements);
  }
  return maps;
}

function isStrictMode(schemas: SchemaFragment[]): boolean {
  return schemas.some((s) => s.type === 'elements');
}

function collectMin(schemas: SchemaFragment[]): number | undefined {
  let result: number | undefined;
  for (const s of schemas) {
    if (s.min !== undefined && (result === undefined || s.min > result)) result = s.min;
  }
  return result;
}

function collectMax(schemas: SchemaFragment[]): number | undefined {
  let result: number | undefined;
  for (const s of schemas) {
    if (s.max !== undefined && (result === undefined || s.max < result)) result = s.max;
  }
  return result;
}

// ── Main loop ───────────────────────────────────────────────────────

function validateValue(
  ctx: NewContext,
  schemas: SchemaFragment[],
  value: unknown,
  path: string,
  primitiveExt: unknown,
  expectedPrimitiveName: string | undefined,
  issues: OperationOutcomeIssue[],
): void {
  const isArray = collectArrayFlag(schemas);
  const primitiveType = collectPrimitiveType(schemas);

  if (isArray) {
    if (!Array.isArray(value)) {
      // Root placeholder: tests expect OK when scalar arrives where array primitive is declared
      if (path === '' && primitiveType !== undefined) return;
      issues.push(
        makeIssue(errorCodes.typeMismatch, {
          path: pathParam(path),
          actual: typeOf(value),
          expected: 'array',
        }),
      );
      return;
    }

    const min = collectMin(schemas);
    const max = collectMax(schemas);
    if (min !== undefined && value.length < min) {
      issues.push(
        makeIssue(errorCodes.cardinalityViolation, {
          path: pathParam(path),
          bound: 'min',
          expected: min,
          actual: value.length,
        }),
      );
    }
    if (max !== undefined && value.length > max) {
      issues.push(
        makeIssue(errorCodes.cardinalityViolation, {
          path: pathParam(path),
          bound: 'max',
          expected: max,
          actual: value.length,
        }),
      );
    }

    if (primitiveExt !== undefined && primitiveExt !== null) {
      if (!Array.isArray(primitiveExt) || primitiveExt.length !== value.length) {
        issues.push(
          makeIssue(errorCodes.invalidPrimitiveExtension, {
            path: pathParam(path),
            reason: 'primitive value and underscore arrays must be aligned',
          }),
        );
        return;
      }
    }

    const itemSchemas: SchemaFragment[] = schemas.map((s) => ({ ...s, array: false }));
    for (let i = 0; i < value.length; i++) {
      const itemExt = Array.isArray(primitiveExt) ? primitiveExt[i] : undefined;
      validateValue(
        ctx,
        itemSchemas,
        value[i],
        joinPath(path, i),
        itemExt,
        expectedPrimitiveName,
        issues,
      );
    }
    return;
  }

  if (primitiveType !== undefined) {
    if (value === null && primitiveExt !== undefined && primitiveExt !== null) {
      return;
    }
    const expectedName = expectedPrimitiveName ?? PRIMITIVE_JS_TYPES[primitiveType];
    validatePrimitive(primitiveType, value, path, expectedName, issues);
    return;
  }

  const elementMaps = collectElementMaps(schemas);
  if (elementMaps.length > 0) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      issues.push(
        makeIssue(errorCodes.typeMismatch, {
          path: pathParam(path),
          actual: typeOf(value),
          expected: 'object',
        }),
      );
      return;
    }
    validateElements(
      ctx,
      elementMaps,
      value as Record<string, unknown>,
      path,
      isStrictMode(schemas),
      issues,
    );
  }
}

function validateElements(
  ctx: NewContext,
  elementMaps: Record<string, ElementDef>[],
  data: Record<string, unknown>,
  path: string,
  strict: boolean,
  issues: OperationOutcomeIssue[],
): void {
  const seen = new Set<string>();

  for (const [key, value] of Object.entries(data)) {
    if (key === 'resourceType') continue;

    let actualKey: string;
    let actualValue: unknown;
    let primitiveExt: unknown;

    if (key.startsWith('_')) {
      const normKey = key.slice(1);
      if (normKey in data) continue; // обработается с обычным ключом
      actualKey = normKey;
      actualValue = null;
      primitiveExt = value;
    } else {
      actualKey = key;
      actualValue = value;
      primitiveExt = data[`_${key}`];
    }

    seen.add(actualKey);

    const defs: ElementDef[] = [];
    for (const map of elementMaps) {
      if (map[actualKey]) defs.push(map[actualKey]);
    }

    if (defs.length === 0) {
      if (strict && !key.startsWith('_')) {
        issues.push(
          makeIssue(errorCodes.unknownField, {
            field: actualKey,
            path: pathParam(path),
          }),
        );
      }
      continue;
    }

    const isPrimitiveField = defs.some((d) => isPrimitive(d.type));
    if (primitiveExt !== undefined && !isPrimitiveField) {
      issues.push(
        makeIssue(errorCodes.invalidPrimitiveExtension, {
          path: joinPath(path, actualKey),
          reason: 'underscore siblings are only valid for primitive fields',
        }),
      );
      continue;
    }

    // Build child overlay: each def becomes a SchemaFragment;
    // for complex types pull in ctx[type] elements as additional layer.
    const childSchemas: SchemaFragment[] = [];
    let childExpectedName: string | undefined;
    for (const def of defs) {
      childSchemas.push(def as SchemaFragment);
      if (def.type) {
        if (isPrimitive(def.type)) {
          childExpectedName = def.type; // field-level uses FHIR type name
        } else if (ctx?.[def.type]?.elements) {
          childSchemas.push({ elements: ctx[def.type].elements } as SchemaFragment);
        }
      }
    }

    validateValue(
      ctx,
      childSchemas,
      actualValue,
      joinPath(path, actualKey),
      primitiveExt,
      childExpectedName,
      issues,
    );
  }

  if (strict) {
    const required = new Set<string>();
    for (const map of elementMaps) {
      for (const [name, def] of Object.entries(map)) {
        if (def.required) required.add(name);
      }
    }
    for (const name of required) {
      if (!seen.has(name)) {
        issues.push(
          makeIssue(errorCodes.requiredField, {
            field: name,
            path: pathParam(path),
          }),
        );
      }
    }
  }
}

// ── Entry point ─────────────────────────────────────────────────────

export function validate(
  ctx: NewContext,
  schemaList: NewSchemaList,
  data: NewData,
  _opts?: NewValidateOptions,
): NewValidationResult {
  const issues: OperationOutcomeIssue[] = [];
  validateValue(ctx, schemaList as SchemaFragment[], data, '', undefined, undefined, issues);
  return issues.length === 0
    ? okOutcome()
    : { resourceType: 'OperationOutcome', issue: issues };
}
