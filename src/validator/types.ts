export interface FHIRSchemaElement {
  type?: string;
  array?: boolean;
  min?: number;
  max?: number;
  elements?: Record<string, FHIRSchemaElement>;
  choiceOf?: string;
  pattern?: {
    type?: string;
    string?: string;
    value?: any;
  };
  // Add other properties as needed
}

export interface FHIRSchema {
  kind?: string;
  base?: string;
  type?: string;
  elements?: Record<string, FHIRSchemaElement>;
  required?: string[];
  choices?: Record<string, string[]>;
  // Primitive type properties
  primitiveType?: string;
}

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
