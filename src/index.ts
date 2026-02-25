// Export all shared types

// Export converter functionality
export { translate } from './converter/index.js';
export type {
  Action,
  ConversionContext,
  OperationOutcome,
  OperationOutcomeIssue,
  PathComponent,
  Resource,
  StructureDefinition,
  StructureDefinitionElement,
} from './converter/types.js';
export * from './types.js';
export type { Slices, Slicing, ValidationOutput } from './validator/resource.js';
// Export validator functionality
export { slice, validate } from './validator/resource.js';
export type {
  BindingStrength,
  Deferred,
  ReferenceDeferred,
  TerminologyDeferred,
} from './validator/types.js';
