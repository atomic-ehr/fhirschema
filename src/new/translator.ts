import type {
  NewContext,
  NewSourceSchema,
  NewTranslateOptions,
  NewTranslationResult,
} from './types.js';

export function translate(
  ctx: NewContext,
  sourceSchema: NewSourceSchema,
  opts?: NewTranslateOptions,
): NewTranslationResult {
  void ctx;
  void opts;

  return sourceSchema;
}
