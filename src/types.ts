// Core FHIRSchema Types

export interface FHIRSchemaBinding {
  strength: string;
  valueSet?: string;
  bindingName?: string;
}

export interface FHIRSchemaPattern {
  type: string;
  value: any;
  string?: string;
}

export interface FHIRSchemaConstraint {
  expression: string;
  human: string;
  severity: string;
}

export interface FHIRSchemaDiscriminator {
  type: string;
  path: string;
}

export interface FHIRSchemaSliceMatch {
  match?: any;
  schema?: FHIRSchemaElement;
  min?: number;
  max?: number;
}

export interface FHIRSchemaSlicing {
  discriminator?: FHIRSchemaDiscriminator[];
  rules?: string;
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
  kind: string;
  
  // Derivation
  derivation?: string;
  base?: string;
  abstract?: boolean;
  class: string;
  
  // Documentation
  description?: string;
  
  // Package information
  package_name?: string;
  package_version?: string;
  package_id?: string;
  package_meta?: any;
  
  // Content
  elements?: Record<string, FHIRSchemaElement>;
  required?: string[];
  excluded?: string[];
  extensions?: Record<string, FHIRSchemaElement>;
  constraint?: Record<string, FHIRSchemaConstraint>;
  
  // For primitive types
  primitiveType?: string;
  choices?: Record<string, string[]>;
}

// Validation Types

export interface ValidationContext {
  schemas: Record<string, FHIRSchema>;
}

export interface ValidationError {
  type: string;
  path: (string | number)[];
  message?: string;
  value?: any;
  expected?: any;
  got?: any;
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
  severity: string;
  human: string;
  expression: string;
  xpath?: string;
}

export interface StructureDefinitionBinding {
  strength: string;
  description?: string;
  valueSet?: string;
  extension?: Array<{
    url: string;
    valueString?: string;
  }>;
}

export interface StructureDefinitionSlicing {
  discriminator?: Array<{
    type: string;
    path: string;
  }>;
  rules?: string;
  ordered?: boolean;
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
  mapping?: any[];
  example?: any[];
  extension?: Array<{
    url: string;
    valueString?: string;
    valueCanonical?: string;
  }>;
  // Pattern[x] fields
  patternString?: string;
  patternBoolean?: boolean;
  patternInteger?: number;
  patternDecimal?: number;
  patternUri?: string;
  patternCode?: string;
  patternDate?: string;
  patternDateTime?: string;
  patternInstant?: string;
  patternCodeableConcept?: any;
  [key: string]: any; // For pattern[x] and fixed[x]
}

export interface StructureDefinition {
  resourceType: string;
  id?: string;
  url: string;
  version?: string;
  name: string;
  title?: string;
  status: string;
  date?: string;
  description?: string;
  kind: string;
  abstract?: boolean;
  type: string;
  baseDefinition?: string;
  derivation?: string;
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
  slicing?: any;
  sliceName?: string;
  slice?: any;
}

// Action types for stack processing

export type Action = 
  | { type: 'enter'; el: string }
  | { type: 'exit'; el: string }
  | { type: 'enter-slice'; sliceName: string }
  | { type: 'exit-slice'; sliceName: string; slicing?: any; slice?: any };

// Context types

export interface ConversionContext {
  package_meta?: any;
}

// Type guards

export function isFHIRSchema(obj: any): obj is FHIRSchema {
  return obj && typeof obj === 'object' && 'url' in obj && 'type' in obj;
}

export function isFHIRSchemaElement(obj: any): obj is FHIRSchemaElement {
  return obj && typeof obj === 'object' && ('type' in obj || 'elements' in obj);
}

export function isStructureDefinition(obj: any): obj is StructureDefinition {
  return obj && obj.resourceType === 'StructureDefinition';
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
  'xhtml'
] as const;

export type FHIRPrimitiveType = typeof FHIR_PRIMITIVE_TYPES[number];

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
  'Timing'
] as const;

export type FHIRComplexType = typeof FHIR_COMPLEX_TYPES[number];

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
  DISCRIMINATOR: 'discriminator'
} as const;

export type ValidationErrorType = typeof VALIDATION_ERROR_TYPES[keyof typeof VALIDATION_ERROR_TYPES];