// Export converter functionality
export { translate } from './converter/index.js';

// Export validator functionality
export { validateSchema } from './validator/index.js';

// Export all types
export * from './types.js';

// Re-export specific converter types that might be useful
export type {
  StructureDefinition,
  StructureDefinitionElement,
  ConversionContext,
  Action,
  PathComponent
} from './converter/types.js';

// Re-export validator types
export type {
  ValidationContext,
  ValidationError,
  ValidationResult
} from './validator/types.js';