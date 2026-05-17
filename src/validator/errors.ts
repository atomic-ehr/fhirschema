// FHIRSchema validator error-code registry.
// Codes are stable identifiers; tests assert on `code` + `path`, never on `message`.
// Full registry and ranges: see DESIGN.md §13.

export const FS = {
  // fs1xx — primitive (JSON type)
  EXPECTED_STRING: 'fs101',
  EXPECTED_NUMBER: 'fs102',
  EXPECTED_BOOLEAN: 'fs103',

  // fs1xx — primitive (literal)
  INVALID_BASE64: 'fs104',
  INVALID_CANONICAL: 'fs105',
  INVALID_CODE: 'fs106',
  INVALID_DATE: 'fs107',
  INVALID_DATETIME: 'fs108',
  INVALID_DECIMAL: 'fs109',
  INVALID_ID: 'fs110',
  INVALID_INSTANT: 'fs111',
  INVALID_INTEGER: 'fs112',
  INVALID_INTEGER64: 'fs113',
  INVALID_MARKDOWN: 'fs114',
  INVALID_OID: 'fs115',
  INVALID_POSITIVE_INT: 'fs116',
  INVALID_STRING: 'fs117',
  INVALID_TIME: 'fs118',
  INVALID_UNSIGNED_INT: 'fs119',
  INVALID_URI: 'fs120',
  INVALID_URL: 'fs121',
  INVALID_UUID: 'fs122',
  INVALID_XHTML: 'fs123',

  // fs2xx — structure
  UNKNOWN_ELEMENT: 'fs201',
  EXPECTED_OBJECT: 'fs202',
  EXPECTED_ARRAY: 'fs203',
  EXPECTED_PRIMITIVE: 'fs204',
  PATTERN_MISMATCH: 'fs205',
  FIXED_MISMATCH: 'fs206',

  // fs3xx — cardinality
  REQUIRED: 'fs301',
  TOO_MANY: 'fs302',
  TOO_FEW: 'fs303',

  // fs4xx — primitive extensions
  INVALID_PRIMITIVE_EXTENSION: 'fs401',
  MISALIGNED_ARRAYS: 'fs402',

  // fs7xx — profiles / schema refs
  PROFILE_NOT_FOUND: 'fs701',

  // fs8xx — choice types (value[x])
  INVALID_CHOICE_TYPE: 'fs801',
  MULTIPLE_CHOICE_VALUES: 'fs802',

  // fs9xx — slicing
  SLICE_NOT_MATCHED: 'fs901',
  SLICE_CARDINALITY: 'fs902',

  // fs10xx — references
  INVALID_REFERENCE_TYPE: 'fs1001',
} as const;

export type FSCode = (typeof FS)[keyof typeof FS];
