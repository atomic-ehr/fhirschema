// Export converter functionality
export { translate } from './converter/index.js';
export { toStructureDefinition } from './converter/reverse.js';
export { generateSnapshot } from './converter/snapshot.js';
export type { SnapshotGenerationOptions, StructureDefinitionResolver } from './converter/snapshot.js';
// Re-export specific converter types that might be useful
export type {
  Action,
  ConversionContext,
  PathComponent,
  StructureDefinition,
  StructureDefinitionElement,
  FHIRSchema,
  OperationOutcome,
  OperationOutcomeIssue,
  Resource,
} from './converter/types.js';

// Export all types
export * from './types.js';

// Export validator functionality
export { validate, slice } from './validator/resource.js';
export type { Slicing, Slices, ValidationOutput } from './validator/resource.js';

// Re-export validator types (for FHIRSchema element types)
export type {
  FHIRSchemaElement,
  FHIRSchemaPattern,
  FHIRValue,
  ValidationContext,
  ValidationError,
  ValidationResult,
  Deferred,
  TerminologyDeferred,
  ReferenceDeferred,
  BindingStrength,
} from './validator/types.js';
