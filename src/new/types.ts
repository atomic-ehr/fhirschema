import type { OperationOutcome } from '../converter/types.js';

export type DiscriminatorType = 'value' | 'pattern' | 'exists';

export type Discriminator = {
  type: DiscriminatorType;
  path: string;
};

export type SliceDef = {
  match?: unknown;
  schema?: ElementDef;
  min?: number;
  max?: number;
};

export type Slicing = {
  discriminator?: Discriminator[];
  rules?: 'open' | 'closed';
  slices: Record<string, SliceDef>;
};

export type ElementDef = {
  type?: string;
  elements?: Record<string, ElementDef>;
  array?: boolean;
  required?: boolean;
  min?: number;
  max?: number;
  slicing?: Slicing;
};

export type SchemaFragment = ElementDef & {
  base?: string;
  additionalProfiles?: string[];
  source?: string;
};

export type NewContext = Record<string, ElementDef> | undefined;
export type NewSourceSchema = unknown;
export type NewSchemaList = SchemaFragment[];
export type NewData = unknown;
export type NewTranslateOptions = unknown;
export type NewValidateOptions = unknown;

export type NewTranslationResult = unknown;
export type NewValidationResult = OperationOutcome;
