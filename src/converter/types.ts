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

export interface FHIRSchemaElement {
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
    value: any;
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
        match?: any;
        schema?: FHIRSchemaElement;
        min?: number;
        max?: number;
      }
    >;
  };
  extensions?: Record<string, FHIRSchemaElement>;
  required?: string[];
  excluded?: string[];
  _required?: boolean; // Internal flag
  index?: number; // For tracking element order
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
  package_meta?: any;
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
