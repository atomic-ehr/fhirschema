// Re-export shared types from canonical source
export type {
  FHIRAddress,
  FHIRAge,
  FHIRAnnotation,
  FHIRAttachment,
  FHIRCodeableConcept,
  FHIRCoding,
  FHIRContactPoint,
  FHIRCount,
  FHIRDistance,
  FHIRDuration,
  FHIRHumanName,
  FHIRIdentifier,
  FHIRMoney,
  FHIRPeriod,
  FHIRQuantity,
  FHIRRange,
  FHIRRatio,
  FHIRReference,
  FHIRSchema,
  FHIRSchemaBinding,
  FHIRSchemaConstraint,
  FHIRSchemaDiscriminator,
  FHIRSchemaElement,
  FHIRSchemaPattern,
  FHIRSchemaSliceMatch,
  FHIRSchemaSlicing,
  FHIRSignature,
  FHIRTiming,
  FHIRValue,
  PackageMeta,
} from '../types.js';

// Converter-specific types

export interface StructureDefinitionMapping {
  identity: string;
  language?: string;
  map: string;
  comment?: string;
}

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
  // For other value[x] variants
  [key: string]: unknown;
}

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
      valueBoolean?: boolean;
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
  status: 'draft' | 'active' | 'retired' | 'unknown';
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

// FHIR resource types

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
