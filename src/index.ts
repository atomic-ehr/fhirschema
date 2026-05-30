// SD -> FHIRSchema translator (stateless)
export { translate } from './converter/index.js';
// FHIRSchema -> SD reverse converter + differential-based snapshot generation
export { toStructureDefinition } from './converter/reverse.js';
export { generateSnapshot } from './converter/snapshot.js';
export type { SnapshotGenerationOptions, StructureDefinitionResolver } from './converter/snapshot.js';
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
  // FHIR datatype interfaces (canonical source — was duplicated in src/types.ts)
  FHIRValue,
  FHIRCodeableConcept,
  FHIRCoding,
  FHIRQuantity,
  FHIRReference,
  FHIRIdentifier,
  FHIRPeriod,
  FHIRRange,
  FHIRRatio,
  FHIRAttachment,
  FHIRContactPoint,
  FHIRHumanName,
  FHIRAddress,
  FHIRTiming,
  FHIRSignature,
  FHIRAnnotation,
  FHIRMoney,
  FHIRAge,
  FHIRCount,
  FHIRDistance,
  FHIRDuration,
} from './converter/types.js';

// Validator (single-pass, data-driven, snapshot-less)
export { validate } from './validator/index.js';
export type {
  ValidateContext,
  ValidateOptions,
  ValidationIssue,
  ValidationResult,
} from './validator/index.js';

// FHIR OperationOutcome adapter for ValidationIssue[] (FHIR-facing APIs)
export { toOperationOutcome, FS_CODE_SYSTEM } from './validator/operation-outcome.js';
export type { OperationOutcomeOptions } from './validator/operation-outcome.js';
