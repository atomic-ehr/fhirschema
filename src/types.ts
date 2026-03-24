export interface PackageMeta {
  name: string;
  version: string;
}

export type BindingStrength = 'required' | 'extensible' | 'preferred' | 'example';
export type ConstraintSeverity = 'error' | 'warning';
export type SlicingRules = 'open' | 'closed' | 'openAtEnd';
export type DiscriminatorType = 'value' | 'exists' | 'pattern' | 'type' | 'profile' | 'position';
export type SchemaKind = 'resource' | 'primitive-type' | 'complex-type' | 'logical';
export type SchemaDerivation = 'specialization' | 'constraint';
export type SchemaClass = 'resource' | 'profile' | 'extension' | 'type' | 'logical';
export type PublicationStatus = 'active' | 'draft' | 'retired' | 'unknown';

// Core FHIRSchema Types

export interface FHIRSchemaBinding {
  strength: BindingStrength;
  valueSet?: string;
  bindingName?: string;
}

// FHIR Pattern Value Union Type - covers all possible pattern[x] and fixed[x] values
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

// FHIR Complex Type Interfaces (commonly used in patterns/fixed values)
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

export interface FHIRSchemaPattern {
  type: string;
  value: FHIRValue;
  string?: string;
}

export interface FHIRSchemaConstraint {
  expression: string;
  human: string;
  severity: ConstraintSeverity;
}

export interface FHIRSchemaDiscriminator {
  type: DiscriminatorType;
  path: string;
}

export interface FHIRSchemaSliceMatch extends FHIRSchemaElement {
  match?: FHIRValue;
  schema?: FHIRSchemaElement;
}

export interface FHIRSchemaSlicing {
  discriminator?: FHIRSchemaDiscriminator[];
  rules?: SlicingRules;
  ordered?: boolean;
  slices?: Record<string, FHIRSchemaSliceMatch>;
}

export interface FHIRSchemaElement {
  // Type information
  type?: string;
  array?: boolean;

  // Cardinality
  min?: number;
  max?: number;

  // References
  refers?: string[];
  elementReference?: string[];

  // Documentation
  short?: string;

  // Binding
  binding?: FHIRSchemaBinding;

  // Pattern/Fixed values
  pattern?: FHIRSchemaPattern;
  fixed?: FHIRSchemaPattern;

  // Constraints
  constraint?: Record<string, FHIRSchemaConstraint>;

  // Nested elements
  elements?: Record<string, FHIRSchemaElement>;

  // Choice type handling
  choiceOf?: string;
  choices?: string[];

  // Extension URL
  url?: string;

  // Modifiers
  mustSupport?: boolean;
  isModifier?: boolean;
  isModifierReason?: string;
  isSummary?: boolean;

  // Slicing
  slicing?: FHIRSchemaSlicing;

  // Extensions
  extensions?: Record<string, FHIRSchemaElement>;

  // Required/excluded elements
  required?: string[];
  excluded?: string[];

  // Internal flags
  _required?: boolean;
  index?: number;
}

export interface FHIRSchema {
  // Identification
  url: string;
  version?: string;
  name: string;

  // Structure type
  type: string;
  kind: SchemaKind;

  // Derivation
  derivation?: SchemaDerivation;
  base?: string;
  abstract?: boolean;
  class: SchemaClass;

  // Documentation
  description?: string;

  // Package information
  package_name?: string;
  package_version?: string;
  package_id?: string;
  package_meta?: PackageMeta; // Changed from any

  // Content
  elements?: Record<string, FHIRSchemaElement>;
  required?: string[];
  excluded?: string[];
  extensions?: Record<string, FHIRSchemaElement>;
  constraint?: Record<string, FHIRSchemaConstraint>;

  // For primitive types
  primitiveType?: string;
  regex?: string;
}

// Validation Types

export interface ValidationContext {
  schemas: Record<string, FHIRSchema>;
}

export interface ValidationError {
  type: ValidationErrorType;
  path: (string | number)[];
  message?: string;
  value?: unknown; // Changed from any
  expected?: unknown; // Changed from any
  got?: unknown; // Changed from any
  'schema-path'?: (string | number)[];
}

export interface ValidationResult {
  errors: ValidationError[];
  valid: boolean;
}

// Converter Types

export interface StructureDefinitionType {
  code: string;
  profile?: string[];
  targetProfile?: string[];
  extension?: Array<{
    url: string;
    valueUrl?: string;
  }>;
}

export interface StructureDefinitionConstraint {
  key: string;
  requirements?: string;
  severity: ConstraintSeverity;
  human: string;
  expression: string;
  xpath?: string;
}

export interface StructureDefinitionBinding {
  strength: BindingStrength;
  description?: string;
  valueSet?: string;
  extension?: Array<{
    url: string;
    valueString?: string;
  }>;
}

export interface StructureDefinitionSlicing {
  discriminator?: Array<{
    type: DiscriminatorType;
    path: string;
  }>;
  rules?: SlicingRules;
  ordered?: boolean;
}

// Extension type for StructureDefinitionElement
export interface StructureDefinitionExtension {
  url: string;
  valueString?: string;
  valueCanonical?: string;
  valueBoolean?: boolean;
  valueInteger?: number;
  valueDecimal?: number;
  valueUri?: string;
  valueCode?: string;
  valueDate?: string;
  valueDateTime?: string;
  valueInstant?: string;
  // Can have other value[x] types as needed
  [key: string]: unknown;
}

// Example type for ElementDefinition
export interface StructureDefinitionExample {
  label?: string;
  value?: FHIRValue;
  [key: string]: unknown; // For value[x] variants
}

// Mapping type for ElementDefinition
export interface StructureDefinitionMapping {
  identity: string;
  language?: string;
  map: string;
  comment?: string;
}

export interface StructureDefinitionElement {
  id?: string;
  path: string;
  sliceName?: string;
  slicing?: StructureDefinitionSlicing;
  short?: string;
  definition?: string;
  comment?: string;
  requirements?: string;
  alias?: string[];
  min?: number;
  max?: string;
  base?: {
    path: string;
    min: number;
    max: string;
  };
  contentReference?: string;
  type?: StructureDefinitionType[];
  constraint?: StructureDefinitionConstraint[];
  mustSupport?: boolean;
  isModifier?: boolean;
  isModifierReason?: string;
  isSummary?: boolean;
  binding?: StructureDefinitionBinding;
  mapping?: StructureDefinitionMapping[]; // Changed from any[]
  example?: StructureDefinitionExample[]; // Changed from any[]
  extension?: StructureDefinitionExtension[]; // More specific typing

  // Pattern[x] fields - using FHIRValue union type
  patternString?: string;
  patternBoolean?: boolean;
  patternInteger?: number;
  patternDecimal?: number;
  patternUri?: string;
  patternCode?: string;
  patternDate?: string;
  patternDateTime?: string;
  patternInstant?: string;
  patternCodeableConcept?: FHIRCodeableConcept;
  patternCoding?: FHIRCoding;
  patternQuantity?: FHIRQuantity;
  patternReference?: FHIRReference;
  patternIdentifier?: FHIRIdentifier;
  patternPeriod?: FHIRPeriod;
  patternRange?: FHIRRange;
  patternRatio?: FHIRRatio;
  patternAttachment?: FHIRAttachment;
  patternContactPoint?: FHIRContactPoint;
  patternHumanName?: FHIRHumanName;
  patternAddress?: FHIRAddress;
  patternTiming?: FHIRTiming;
  patternSignature?: FHIRSignature;
  patternAnnotation?: FHIRAnnotation;
  patternMoney?: FHIRMoney;
  patternAge?: FHIRAge;
  patternCount?: FHIRCount;
  patternDistance?: FHIRDistance;
  patternDuration?: FHIRDuration;

  // Fixed[x] fields - using the same types as pattern[x]
  fixedString?: string;
  fixedBoolean?: boolean;
  fixedInteger?: number;
  fixedDecimal?: number;
  fixedUri?: string;
  fixedCode?: string;
  fixedDate?: string;
  fixedDateTime?: string;
  fixedInstant?: string;
  fixedCodeableConcept?: FHIRCodeableConcept;
  fixedCoding?: FHIRCoding;
  fixedQuantity?: FHIRQuantity;
  fixedReference?: FHIRReference;
  fixedIdentifier?: FHIRIdentifier;
  fixedPeriod?: FHIRPeriod;
  fixedRange?: FHIRRange;
  fixedRatio?: FHIRRatio;
  fixedAttachment?: FHIRAttachment;
  fixedContactPoint?: FHIRContactPoint;
  fixedHumanName?: FHIRHumanName;
  fixedAddress?: FHIRAddress;
  fixedTiming?: FHIRTiming;
  fixedSignature?: FHIRSignature;
  fixedAnnotation?: FHIRAnnotation;
  fixedMoney?: FHIRMoney;
  fixedAge?: FHIRAge;
  fixedCount?: FHIRCount;
  fixedDistance?: FHIRDistance;
  fixedDuration?: FHIRDuration;

  // For additional pattern[x] and fixed[x] variants not explicitly defined
  [key: string]: unknown;
}

export interface StructureDefinition {
  resourceType: 'StructureDefinition';
  id?: string;
  url: string;
  version?: string;
  name: string;
  title?: string;
  status: PublicationStatus;
  date?: string;
  description?: string;
  kind: SchemaKind;
  abstract?: boolean;
  type: string;
  baseDefinition?: string;
  derivation?: SchemaDerivation;
  package_name?: string;
  package_version?: string;
  package_id?: string;
  snapshot?: {
    element: StructureDefinitionElement[];
  };
  differential?: {
    element: StructureDefinitionElement[];
  };
}

// Path parsing types

export interface PathComponent {
  el: string;
  slicing?: FHIRSchemaSlicing; // Changed from any
  sliceName?: string;
  slice?: FHIRSchemaSliceMatch; // Changed from any
}

// Action types for stack processing

export type Action =
  | { type: 'enter'; el: string }
  | { type: 'exit'; el: string }
  | { type: 'enter-slice'; sliceName: string }
  | {
      type: 'exit-slice';
      sliceName: string;
      slicing?: FHIRSchemaSlicing;
      slice?: FHIRSchemaSliceMatch;
    };

// Context types

export interface ConversionContext {
  package_meta?: Record<string, unknown>; // Changed from any
}

// Type guards

export function isFHIRSchema(obj: unknown): obj is FHIRSchema {
  return obj !== null && typeof obj === 'object' && 'url' in obj && 'type' in obj;
}

export function isFHIRSchemaElement(obj: unknown): obj is FHIRSchemaElement {
  return obj !== null && typeof obj === 'object' && ('type' in obj || 'elements' in obj);
}

export function isStructureDefinition(obj: unknown): obj is StructureDefinition {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    'resourceType' in obj &&
    (obj as { resourceType: unknown }).resourceType === 'StructureDefinition'
  );
}

// Constants

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

export const VALIDATION_ERROR_TYPES = {
  REQUIRED: 'required',
  TYPE: 'type',
  CARDINALITY: 'cardinality',
  PATTERN: 'pattern',
  CONSTRAINT: 'constraint',
  REFERENCE: 'reference',
  UNKNOWN_ELEMENT: 'unknown-element',
  INVALID_CHOICE: 'invalid-choice',
  SLICE_CARDINALITY: 'slice-cardinality',
  DISCRIMINATOR: 'discriminator',
} as const;

export type ValidationErrorType =
  (typeof VALIDATION_ERROR_TYPES)[keyof typeof VALIDATION_ERROR_TYPES];
