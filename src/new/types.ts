import type { OperationOutcome } from '../converter/types.js';

export type ElementDef = {
  type?: string;
  elements?: Record<string, ElementDef>;
  array?: boolean;
  required?: boolean;
};

export type SchemaFragment = ElementDef & {
  base?: string;
  additionalProfiles?: string[];
};

export type NewContext = Record<string, ElementDef> | undefined;
export type NewSourceSchema = unknown;
export type NewSchemaList = SchemaFragment[];
export type NewData = unknown;
export type NewTranslateOptions = unknown;
export type NewValidateOptions = unknown;

export type NewTranslationResult = unknown;
export type NewValidationResult = OperationOutcome;
