// FHIR Value Union Type - covers all possible FHIR values
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

// FHIR Complex Type Interfaces
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

// Mapping interface for ElementDefinition
export interface StructureDefinitionMapping {
  identity: string;
  language?: string;
  map: string;
  comment?: string;
}

// Example interface for ElementDefinition
export interface StructureDefinitionExample {
  label?: string;
  valueString?: string;
  valueBoolean?: boolean;
  valueInteger?: number;
  valueDecimal?: number;
  valueUri?: string;
  valueCode?: string;
  valueDate?: string;
  valueDateTime?: string;
  valueInstant?: string;
  valueCodeableConcept?: FHIRCodeableConcept;
  valueCoding?: FHIRCoding;
  valueQuantity?: FHIRQuantity;
  valueReference?: FHIRReference;
  valueIdentifier?: FHIRIdentifier;
  valuePeriod?: FHIRPeriod;
  valueRange?: FHIRRange;
  valueRatio?: FHIRRatio;
  valueAttachment?: FHIRAttachment;
  valueContactPoint?: FHIRContactPoint;
  valueHumanName?: FHIRHumanName;
  valueAddress?: FHIRAddress;
  valueTiming?: FHIRTiming;
  valueSignature?: FHIRSignature;
  valueAnnotation?: FHIRAnnotation;
  valueMoney?: FHIRMoney;
  // For other value[x] variants
  [key: string]: unknown;
}

// Extension interface
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
  // For other value[x] variants
  [key: string]: unknown;
}

// Slicing interface for schema elements
export interface FHIRSchemaSlicing {
  discriminator?: Array<{
    type: string;
    path: string;
  }>;
  rules?: string;
  ordered?: boolean;
  slices?: Record<
    string,
    {
      match?: FHIRValue; // Changed from any
      schema?: FHIRSchemaElement;
      min?: number;
      max?: number;
    }
  >;
}


export interface StructureDefinitionElement {
  id?: string;
  path: string;
  sliceName?: string;
  slicing?: {
    discriminator?: Array<{
      type: string;
      path: string;
    }>;
    rules?: string;
    ordered?: boolean;
  };
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
  type?: Array<{
    code: string;
    profile?: string[];
    targetProfile?: string[];
    extension?: Array<{
      url: string;
      valueUrl?: string;
    }>;
  }>;
  constraint?: Array<{
    key: string;
    requirements?: string;
    severity: string;
    human: string;
    expression: string;
    xpath?: string;
  }>;
  mustSupport?: boolean;
  isModifier?: boolean;
  isModifierReason?: string;
  isSummary?: boolean;
  binding?: {
    strength: string;
    description?: string;
    valueSet?: string;
    extension?: Array<{
      url: string;
      valueString?: string;
    }>;
  };
  mapping?: any[];
  example?: any[];
  extension?: Array<{
    url: string;
    valueString?: string;
    valueCanonical?: string;
  }>;
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

type FhirOpenTypeSufix =
  // https://hl7.org/fhir/datatypes.html#open
  // Primitive Types
  | 'Base64Binary'
  | 'Boolean'
  | 'Canonical'
  | 'Code'
  | 'Date'
  | 'DateTime'
  | 'Decimal'
  | 'Id'
  | 'Instant'
  | 'Integer'
  | 'Integer64'
  | 'Markdown'
  | 'Oid'
  | 'PositiveInt'
  | 'String'
  | 'Time'
  | 'UnsignedInt'
  | 'Uri'
  | 'Url'
  | 'Uuid'
  // Datatypes
  | 'Address'
  | 'Age'
  | 'Annotation'
  | 'Attachment'
  | 'CodeableConcept'
  | 'CodeableReference'
  | 'Coding'
  | 'ContactPoint'
  | 'Count'
  | 'Distance'
  | 'Duration'
  | 'HumanName'
  | 'Identifier'
  | 'Money'
  | 'Period'
  | 'Quantity'
  | 'Range'
  | 'Ratio'
  | 'RatioRange'
  | 'Reference'
  | 'SampledData'
  | 'Signature'
  | 'Timing'
  // MetaDataTypes
  | 'ContactDetail'
  | 'DataRequirement'
  | 'Expression'
  | 'ParameterDefinition'
  | 'RelatedArtifact'
  | 'TriggerDefinition'
  | 'UsageContext'
  | 'Availability'
  | 'ExtendedContactDetail'
  // Special Types
  | 'Dosage'
  | 'Meta';

export type FhirSchemaSlicingDiscriminator = { type: string; path: string };

export type FhirSchemaSlicing = {
  discriminator?: FhirSchemaSlicingDiscriminator[];
  rules?: string;
  ordered?: boolean;
  slices?: { [key in string]: FHIRSchemaElement };
};

export type FHIRSchemaElement = {
  type?: string;
  array?: boolean;
  min?: number;
  max?: number;
  refers?: string[];
  short?: string;
  binding?: {
    strength: string;
    valueSet?: string;
    bindingName?: string;
  };
  pattern?: {
    type: string;
    value: FHIRValue; // Changed from any to FHIRValue
  };
  constraint?: Record<
    string,
    {
      expression: string;
      human: string;
      severity: string;
    }
  >;
  elements?: Record<string, FHIRSchemaElement>;
  choiceOf?: string;
  choices?: string[];
  url?: string;
  mustSupport?: boolean;
  isModifier?: boolean;
  isModifierReason?: string;
  isSummary?: boolean;
  elementReference?: string[];
  slicing?: FhirSchemaSlicing;
  extensions?: Record<string, FHIRSchemaElement>;
  required?: string[];
  excluded?: string[];
  _required?: boolean; // Internal flag
  index?: number; // For tracking element order
} & {
  //defaultValue[x] (https://hl7.org/fhir/elementdefinition-definitions.html#ElementDefinition.defaultValue_x_)
  [key in `defaultValue${FhirOpenTypeSufix}`]?: unknown;
} & {
  //fixed[x] (https://hl7.org/fhir/elementdefinition-definitions.html#ElementDefinition.fixed_x_)
  [key in `fixed${FhirOpenTypeSufix}`]?: unknown;
} & {
  //pattern[x] (https://hl7.org/fhir/elementdefinition-definitions.html#ElementDefinition.pattern_x_)
  [key in `pattern${FhirOpenTypeSufix}`]?: unknown;
};

export interface PackageMeta {
  package: string;
  version: string;
}

export interface FHIRSchema {
  url: string;
  version?: string;
  name: string;
  type: string;
  kind: string;
  derivation?: string;
  base?: string;
  abstract?: boolean;
  class: string;
  description?: string;
  package_name?: string;
  package_version?: string;
  package_id?: string;
  package_meta?: PackageMeta;
  elements?: { [key in string]: FHIRSchemaElement };
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
}

export interface PathComponent {
  el: string;
  slicing?: any;
  sliceName?: string;
  slice?: any;
}

export type Action =
  | { type: 'enter'; el: string }
  | { type: 'exit'; el: string }
  | { type: 'enter-slice'; sliceName: string }
  | { type: 'exit-slice'; sliceName: string; slicing?: any; slice?: any };

export interface ConversionContext {
  package_meta?: any;
}

// FHIR types

export type Coding = {
  code?: string;
  display?: string;
  system?: string;
};

export type CodeableConcept = {
  coding?: Coding[];
  text?: string;
};

export type OperationOutcomeIssue = {
  severity: string;
  code: string;
  details?: CodeableConcept;
  diagnostics?: string;
  expression?: string[];
  id?: string;
  location?: string[];
};

export type Resource = { resourceType: string };

export type OperationOutcome = Resource & {
  resourceType: 'OperationOutcome';
  issue?: OperationOutcomeIssue[];
};
