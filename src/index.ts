// SD -> FHIRSchema translator (stateless)
export { translate } from './converter/index.js';
export type {
  Action,
  ConversionContext,
  PathComponent,
  StructureDefinition,
  StructureDefinitionElement,
  FHIRSchema,
  FHIRSchemaElement,
  OperationOutcome,
  OperationOutcomeIssue,
  Resource,
} from './converter/types.js';

export * from './types.js';

// Validator (single-pass, data-driven, snapshot-less)
export { validate } from './validator/index.js';
export type {
  ValidateContext,
  ValidateOptions,
  ValidationIssue,
  ValidationResult,
} from './validator/index.js';
