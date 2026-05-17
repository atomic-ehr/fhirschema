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
  EXCLUDED_ELEMENT: 'fs207',

  // fs3xx — cardinality
  REQUIRED: 'fs301',
  TOO_MANY: 'fs302',
  TOO_FEW: 'fs303',

  // fs4xx — primitive extensions
  INVALID_PRIMITIVE_EXTENSION: 'fs401',
  MISALIGNED_ARRAYS: 'fs402',

  // fs5xx — terminology bindings
  INVALID_CODE_FOR_BINDING: 'fs501',
  CODE_NOT_IN_PREFERRED: 'fs502',
  CODE_NOT_IN_EXTENSIBLE: 'fs503',

  // fs6xx — constraints
  INVARIANT_VIOLATED: 'fs601',

  // fs7xx — profiles / schema refs
  PROFILE_NOT_FOUND: 'fs701',

  // fs8xx — choice types (value[x])
  INVALID_CHOICE_TYPE: 'fs801',
  MULTIPLE_CHOICE_VALUES: 'fs802',

  // fs9xx — slicing
  SLICE_NOT_MATCHED: 'fs901',
  SLICE_CARDINALITY: 'fs902',
  SLICE_OUT_OF_ORDER: 'fs903',
  UNMATCHED_NOT_AT_END: 'fs904',

  // fs5xx — terminology (continued)
  INVALID_DISPLAY: 'fs504',

  // fs10xx — references
  INVALID_REFERENCE_TYPE: 'fs1001',
  UNRESOLVED_REFERENCE: 'fs1002',
  FULLURL_NOT_ABSOLUTE: 'fs1003',
  BUNDLE_REFERENCE_AMBIGUOUS: 'fs1004',
  BUNDLE_REFERENCE_FULLURL_MISMATCH: 'fs1005',

  // fs12xx — Bundle integrity
  BUNDLE_DUPLICATE_ID: 'fs1201',
  BUNDLE_TYPE_STRUCTURE: 'fs1202',

  // fs11xx — extensions
  UNKNOWN_EXTENSION: 'fs1101',
  MODIFIER_EXTENSION_NOT_UNDERSTOOD: 'fs1102',
} as const;

export type FSCode = (typeof FS)[keyof typeof FS];
