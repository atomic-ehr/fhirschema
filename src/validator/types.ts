// Re-export shared types from canonical source

export type {
  FHIRComplexType,
  FHIRPrimitiveType,
  FHIRSchema,
  FHIRSchemaElement,
  FHIRSchemaPattern,
  FHIRValue,
  ValidationContext,
  ValidationError,
  ValidationResult,
} from '../types.js';
export {
  FHIR_COMPLEX_TYPES,
  FHIR_PRIMITIVE_TYPES,
  isFHIRSchema,
  isFHIRSchemaElement,
} from '../types.js';

// Validator-specific types

export type BindingStrength = 'required' | 'extensible' | 'preferred' | 'example';

export interface TerminologyDeferred {
  type: 'terminology';
  path: string;
  code: string;
  system?: string;
  valueSet: string;
  strength: BindingStrength;
}

export interface ReferenceDeferred {
  type: 'reference';
  path: string;
  reference: string;
  targetProfiles?: string[];
}

export type Deferred = TerminologyDeferred | ReferenceDeferred;

export function isValidationError(obj: unknown): obj is import('../types.js').ValidationError {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    'type' in obj &&
    'path' in obj &&
    typeof (obj as { type: unknown }).type === 'string' &&
    Array.isArray((obj as { path: unknown }).path)
  );
}
