// FHIR R6 primitive set is hardcoded — StructureDefinitions for primitives are
// ignored by the translator and not consulted by the validator.
// See DESIGN.md §6.

import { FS, type FSCode } from './errors.js';

export type PrimitiveCheck = {
  ok: boolean;
  code?: FSCode;
  expected?: string;
};

// FHIR R4 regex for `date` rejects year 0000 (requires at least one non-zero digit).
const YEAR = '([0-9]([0-9]([0-9][1-9]|[1-9]0)|[1-9]00)|[1-9]000)';
const RX = {
  date: new RegExp(`^${YEAR}(-(0[1-9]|1[0-2])(-(0[1-9]|[12][0-9]|3[01]))?)?$`),
  dateTime: new RegExp(
    `^${YEAR}(-(0[1-9]|1[0-2])(-(0[1-9]|[12][0-9]|3[01])(T([01][0-9]|2[0-3]):[0-5][0-9]:([0-5][0-9]|60)(\\.[0-9]+)?(Z|[+-]((0[0-9]|1[0-3]):[0-5][0-9]|14:00)))?)?)?$`,
  ),
  time: /^([01][0-9]|2[0-3]):[0-5][0-9]:([0-5][0-9]|60)(\.[0-9]+)?$/,
  instant: new RegExp(
    `^${YEAR}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])T([01][0-9]|2[0-3]):[0-5][0-9]:([0-5][0-9]|60)(\\.[0-9]+)?(Z|[+-]((0[0-9]|1[0-3]):[0-5][0-9]|14:00))$`,
  ),
  id: /^[A-Za-z0-9\-.]{1,64}$/,
  oid: /^urn:oid:[0-2](\.(0|[1-9][0-9]*))+$/,
  uuid: /^urn:uuid:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
  code: /^[^\s]+( [^\s]+)*$/,
  // integer64: signed decimal, no leading zeros, no -0, no +.
  integer64: /^(0|-?[1-9][0-9]*)$/,
};

function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** Validate the date *part* of a FHIR date/dateTime/instant string. Assumes
 * regex has already matched, so we just need calendar checks (Feb 30 etc). */
function isValidDateComponent(literal: string): boolean {
  const dateOnly = literal.length >= 10 ? literal.slice(0, 10) : literal;
  const m = /^([0-9]{4})(?:-([0-9]{2})(?:-([0-9]{2}))?)?/.exec(dateOnly);
  if (!m) return true;
  const year = Number(m[1]);
  const month = m[2] ? Number(m[2]) : undefined;
  const day = m[3] ? Number(m[3]) : undefined;
  if (month === undefined) return true;
  if (day === undefined) return true;
  const max = month === 2 && isLeapYear(year) ? 29 : DAYS_IN_MONTH[month - 1];
  return day >= 1 && day <= max;
}

const INT64_MIN = -9223372036854775808n;
const INT64_MAX = 9223372036854775807n;

function ok(): PrimitiveCheck {
  return { ok: true };
}

function fail(code: FSCode, expected: string): PrimitiveCheck {
  return { ok: false, code, expected };
}

const INT32_MIN = -2_147_483_648;
const INT32_MAX = 2_147_483_647;

export function checkPrimitive(type: string, value: unknown): PrimitiveCheck {
  switch (type) {
    case 'boolean':
      if (typeof value !== 'boolean') return fail(FS.EXPECTED_BOOLEAN, 'boolean');
      return ok();

    case 'integer':
      if (typeof value !== 'number') return fail(FS.EXPECTED_NUMBER, 'integer');
      if (!Number.isInteger(value) || value < INT32_MIN || value > INT32_MAX)
        return fail(FS.INVALID_INTEGER, 'integer');
      return ok();

    case 'integer64': {
      if (typeof value !== 'string') return fail(FS.EXPECTED_STRING, 'integer64');
      if (!RX.integer64.test(value)) return fail(FS.INVALID_INTEGER64, 'integer64');
      try {
        const n = BigInt(value);
        if (n < INT64_MIN || n > INT64_MAX) return fail(FS.INVALID_INTEGER64, 'integer64');
      } catch {
        return fail(FS.INVALID_INTEGER64, 'integer64');
      }
      return ok();
    }

    case 'positiveInt':
      if (typeof value !== 'number') return fail(FS.EXPECTED_NUMBER, 'positiveInt');
      if (!Number.isInteger(value)) return fail(FS.INVALID_INTEGER, 'integer');
      if (value <= 0) return fail(FS.INVALID_POSITIVE_INT, '>0');
      return ok();

    case 'unsignedInt':
      if (typeof value !== 'number') return fail(FS.EXPECTED_NUMBER, 'unsignedInt');
      if (!Number.isInteger(value)) return fail(FS.INVALID_INTEGER, 'integer');
      if (value < 0) return fail(FS.INVALID_UNSIGNED_INT, '>=0');
      return ok();

    case 'decimal':
      if (typeof value !== 'number') return fail(FS.EXPECTED_NUMBER, 'decimal');
      if (!Number.isFinite(value)) return fail(FS.INVALID_DECIMAL, 'decimal');
      return ok();

    case 'string':
      if (typeof value !== 'string') return fail(FS.EXPECTED_STRING, 'string');
      if (value.length === 0) return fail(FS.INVALID_STRING, 'non-empty');
      return ok();

    case 'markdown':
      if (typeof value !== 'string') return fail(FS.EXPECTED_STRING, 'markdown');
      if (value.length === 0) return fail(FS.INVALID_MARKDOWN, 'non-empty');
      return ok();

    case 'uri':
      if (typeof value !== 'string') return fail(FS.EXPECTED_STRING, 'uri');
      if (value.length === 0) return fail(FS.INVALID_URI, 'non-empty');
      return ok();

    case 'url':
      if (typeof value !== 'string') return fail(FS.EXPECTED_STRING, 'url');
      if (value.length === 0) return fail(FS.INVALID_URL, 'non-empty');
      return ok();

    case 'canonical':
      if (typeof value !== 'string') return fail(FS.EXPECTED_STRING, 'canonical');
      if (value.length === 0) return fail(FS.INVALID_CANONICAL, 'non-empty');
      return ok();

    case 'base64Binary':
      if (typeof value !== 'string') return fail(FS.EXPECTED_STRING, 'base64Binary');
      if (value.length === 0) return fail(FS.INVALID_BASE64, 'non-empty');
      return ok();

    case 'xhtml':
      if (typeof value !== 'string') return fail(FS.EXPECTED_STRING, 'xhtml');
      if (value.length === 0) return fail(FS.INVALID_XHTML, 'non-empty');
      return ok();

    case 'code':
      if (typeof value !== 'string') return fail(FS.EXPECTED_STRING, 'code');
      if (!RX.code.test(value)) return fail(FS.INVALID_CODE, 'code');
      return ok();

    case 'id':
      if (typeof value !== 'string') return fail(FS.EXPECTED_STRING, 'id');
      if (!RX.id.test(value)) return fail(FS.INVALID_ID, 'id');
      return ok();

    case 'date':
      if (typeof value !== 'string') return fail(FS.EXPECTED_STRING, 'date');
      if (!RX.date.test(value) || !isValidDateComponent(value))
        return fail(FS.INVALID_DATE, 'date');
      return ok();

    case 'dateTime':
      if (typeof value !== 'string') return fail(FS.EXPECTED_STRING, 'dateTime');
      if (!RX.dateTime.test(value) || !isValidDateComponent(value))
        return fail(FS.INVALID_DATETIME, 'dateTime');
      return ok();

    case 'time':
      if (typeof value !== 'string') return fail(FS.EXPECTED_STRING, 'time');
      if (!RX.time.test(value)) return fail(FS.INVALID_TIME, 'time');
      return ok();

    case 'instant':
      if (typeof value !== 'string') return fail(FS.EXPECTED_STRING, 'instant');
      if (!RX.instant.test(value) || !isValidDateComponent(value))
        return fail(FS.INVALID_INSTANT, 'instant');
      return ok();

    case 'oid':
      if (typeof value !== 'string') return fail(FS.EXPECTED_STRING, 'oid');
      if (!RX.oid.test(value)) return fail(FS.INVALID_OID, 'oid');
      return ok();

    case 'uuid':
      if (typeof value !== 'string') return fail(FS.EXPECTED_STRING, 'uuid');
      if (!RX.uuid.test(value)) return fail(FS.INVALID_UUID, 'uuid');
      return ok();

    default:
      return ok();
  }
}

export const PRIMITIVES = new Set<string>([
  'boolean',
  'integer',
  'integer64',
  'positiveInt',
  'unsignedInt',
  'decimal',
  'string',
  'markdown',
  'uri',
  'url',
  'canonical',
  'base64Binary',
  'xhtml',
  'code',
  'id',
  'date',
  'dateTime',
  'time',
  'instant',
  'oid',
  'uuid',
]);

export function isPrimitiveType(type: string | undefined): boolean {
  return type !== undefined && PRIMITIVES.has(type);
}
