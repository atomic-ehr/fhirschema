// FHIR Pattern Value Union Type - covers all possible pattern values
export type FHIRValue =
  // Primitive types
  | string
  | boolean
  | number
  // Complex types
  | FHIRCodeableConcept
  | FHIRCoding
  | FHIRQuantity
  | FHIRReference
  | FHIRIdentifier
  | FHIRPeriod
  | FHIRRange
  | FHIRRatio
  | FHIRAttachment
  | FHIRContactPoint
  | FHIRHumanName
  | FHIRAddress
  | FHIRTiming
  | FHIRSignature
  | FHIRAnnotation
  | FHIRMoney
  | FHIRAge
  | FHIRCount
  | FHIRDistance
  | FHIRDuration;

// FHIR Complex Type Interfaces (commonly used in patterns)
export interface FHIRCodeableConcept {
  coding?: FHIRCoding[];
  text?: string;
}

export interface FHIRCoding {
  system?: string;
  version?: string;
  code?: string;
  display?: string;
  userSelected?: boolean;
}

export interface FHIRQuantity {
  value?: number;
  comparator?: '<' | '<=' | '>=' | '>' | 'ad';
  unit?: string;
  system?: string;
  code?: string;
}

export interface FHIRReference {
  reference?: string;
  type?: string;
  identifier?: FHIRIdentifier;
  display?: string;
}

export interface FHIRIdentifier {
  use?: 'usual' | 'official' | 'temp' | 'secondary' | 'old';
  type?: FHIRCodeableConcept;
  system?: string;
  value?: string;
  period?: FHIRPeriod;
  assigner?: FHIRReference;
}

export interface FHIRPeriod {
  start?: string; // dateTime
  end?: string; // dateTime
}

export interface FHIRRange {
  low?: FHIRQuantity;
  high?: FHIRQuantity;
}

export interface FHIRRatio {
  numerator?: FHIRQuantity;
  denominator?: FHIRQuantity;
}

export interface FHIRAttachment {
  contentType?: string;
  language?: string;
  data?: string; // base64Binary
  url?: string;
  size?: number;
  hash?: string; // base64Binary
  title?: string;
  creation?: string; // dateTime
  height?: number;
  width?: number;
  frames?: number;
  duration?: number;
  pages?: number;
}

export interface FHIRContactPoint {
  system?: 'phone' | 'fax' | 'email' | 'pager' | 'url' | 'sms' | 'other';
  value?: string;
  use?: 'home' | 'work' | 'temp' | 'old' | 'mobile';
  rank?: number;
  period?: FHIRPeriod;
}

export interface FHIRHumanName {
  use?: 'usual' | 'official' | 'temp' | 'nickname' | 'anonymous' | 'old' | 'maiden';
  text?: string;
  family?: string;
  given?: string[];
  prefix?: string[];
  suffix?: string[];
  period?: FHIRPeriod;
}

export interface FHIRAddress {
  use?: 'home' | 'work' | 'temp' | 'old' | 'billing';
  type?: 'postal' | 'physical' | 'both';
  text?: string;
  line?: string[];
  city?: string;
  district?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  period?: FHIRPeriod;
}

export interface FHIRTiming {
  event?: string[]; // dateTime[]
  repeat?: {
    bounds?: FHIRDuration | FHIRRange | FHIRPeriod;
    count?: number;
    countMax?: number;
    duration?: number;
    durationMax?: number;
    durationUnit?: 's' | 'min' | 'h' | 'd' | 'wk' | 'mo' | 'a';
    frequency?: number;
    frequencyMax?: number;
    period?: number;
    periodMax?: number;
    periodUnit?: 's' | 'min' | 'h' | 'd' | 'wk' | 'mo' | 'a';
    dayOfWeek?: ('mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun')[];
    timeOfDay?: string[]; // time[]
    when?: string[];
    offset?: number;
  };
  code?: FHIRCodeableConcept;
}

export interface FHIRSignature {
  type: FHIRCoding[];
  when: string; // instant
  who: FHIRReference;
  onBehalfOf?: FHIRReference;
  targetFormat?: string;
  sigFormat?: string;
  data?: string; // base64Binary
}

export interface FHIRAnnotation {
  author?: FHIRReference | string;
  time?: string; // dateTime
  text: string; // markdown
}

export interface FHIRMoney {
  value?: number;
  currency?: string;
}

// Specialized Quantity types
export interface FHIRAge extends FHIRQuantity {}
export interface FHIRCount extends FHIRQuantity {}
export interface FHIRDistance extends FHIRQuantity {}
export interface FHIRDuration extends FHIRQuantity {}

// Updated Pattern interface
export interface FHIRSchemaPattern {
  type?: string;
  string?: string;
  value?: FHIRValue; // Changed from any to FHIRValue union type
}

export interface FHIRSchemaElement {
  type?: string;
  array?: boolean;
  min?: number;
  max?: number;
  elements?: Record<string, FHIRSchemaElement>;
  choiceOf?: string;
  pattern?: FHIRSchemaPattern; // Using the improved pattern interface

  // Additional properties that are commonly used in FHIR schema elements
  refers?: string[];
  elementReference?: string[];
  short?: string;
  binding?: {
    strength: string;
    valueSet?: string;
    bindingName?: string;
  };
  constraint?: Record<
    string,
    {
      expression: string;
      human: string;
      severity: string;
    }
  >;
  choices?: string[];
  url?: string;
  mustSupport?: boolean;
  isModifier?: boolean;
  isModifierReason?: string;
  isSummary?: boolean;
  slicing?: {
    discriminator?: Array<{
      type: string;
      path: string;
    }>;
    rules?: string;
    ordered?: boolean;
    slices?: Record<
      string,
      {
        match?: FHIRValue;
        schema?: FHIRSchemaElement;
        min?: number;
        max?: number;
      }
    >;
  };
  extensions?: Record<string, FHIRSchemaElement>;
  required?: string[];
  excluded?: string[];
  _required?: boolean;
  index?: number;
}

export interface FHIRSchema {
  // Identification
  url?: string;
  version?: string;
  name?: string;

  // Structure type
  kind?: string;
  base?: string;
  type?: string;
  derivation?: string;
  abstract?: boolean;
  class?: string;

  // Documentation
  description?: string;

  // Package information
  package_name?: string;
  package_version?: string;
  package_id?: string;
  package_meta?: Record<string, unknown>; // Changed from any

  // Content
  elements?: Record<string, FHIRSchemaElement>;
  required?: string[];
  excluded?: string[];
  extensions?: Record<string, FHIRSchemaElement>;
  constraint?: Record<
    string,
    {
      expression: string;
      human: string;
      severity: string;
    }
  >;
  choices?: Record<string, string[]>;

  // For primitive types
  primitiveType?: string;
}

export interface ValidationContext {
  schemas: Record<string, FHIRSchema>;
}

export interface ValidationError {
  type: string;
  path: (string | number)[];
  message?: string;
  value?: unknown; // Changed from any to unknown - more type-safe
  expected?: unknown; // Changed from any to unknown
  got?: unknown; // Changed from any to unknown
  'schema-path'?: (string | number)[];
}

export interface ValidationResult {
  errors: ValidationError[];
  valid: boolean;
}

// Additional utility types
export const FHIR_PRIMITIVE_TYPES = [
  'boolean',
  'integer',
  'string',
  'decimal',
  'uri',
  'url',
  'canonical',
  'base64Binary',
  'instant',
  'date',
  'dateTime',
  'time',
  'code',
  'oid',
  'id',
  'markdown',
  'unsignedInt',
  'positiveInt',
  'uuid',
  'xhtml',
] as const;

export type FHIRPrimitiveType = (typeof FHIR_PRIMITIVE_TYPES)[number];

export const FHIR_COMPLEX_TYPES = [
  'Address',
  'Age',
  'Annotation',
  'Attachment',
  'CodeableConcept',
  'Coding',
  'ContactPoint',
  'Count',
  'Distance',
  'Duration',
  'HumanName',
  'Identifier',
  'Money',
  'Period',
  'Quantity',
  'Range',
  'Ratio',
  'Reference',
  'SampledData',
  'Signature',
  'Timing',
] as const;

export type FHIRComplexType = (typeof FHIR_COMPLEX_TYPES)[number];

// Type guards for runtime type checking
export function isFHIRSchema(obj: unknown): obj is FHIRSchema {
  return (
    obj !== null && typeof obj === 'object' && ('url' in obj || 'type' in obj || 'kind' in obj)
  );
}

export function isFHIRSchemaElement(obj: unknown): obj is FHIRSchemaElement {
  return obj !== null && typeof obj === 'object' && ('type' in obj || 'elements' in obj);
}

export function isValidationError(obj: unknown): obj is ValidationError {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    'type' in obj &&
    'path' in obj &&
    typeof (obj as ValidationError).type === 'string' &&
    Array.isArray((obj as ValidationError).path)
  );
}
