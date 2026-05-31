import type { FHIRSchema, FHIRSchemaElement } from './types';

export interface FHIRSchemaMergeOptions {
  // Union `required` / `excluded` arrays across the chain instead of letting the
  // last overlay replace them. Needed for snapshot generation (a base requirement
  // must survive a derived layer that does not restate it). Off by default.
  unionArrays?: boolean;
}

type FHIRSchemaNode = Pick<FHIRSchemaElement, 'elements' | 'slicing' | 'required' | 'excluded'> &
  Partial<Pick<FHIRSchema, 'name' | 'base' | 'url'>>;

// Overlay-merge two FHIRSchema nodes: a `base` and an `overlay` that constrains it.
// This is the "smart merge" at the heart of snapshot generation — folding a
// base→leaf profile chain into one effective schema. Overlay scalar fields win;
// `elements` and `slicing.slices` merge recursively.
export const mergeFHIRSchema = (
  base?: FHIRSchemaNode,
  overlay?: FHIRSchemaNode,
  options: FHIRSchemaMergeOptions = {},
): FHIRSchemaNode | undefined => {
  if (base === undefined) return overlay;
  if (overlay === undefined) return base;

  const deepMerge = (obj1: any, obj2: any) => {
    const keys = [...new Set(Object.keys(obj1 || {}).concat(Object.keys(obj2 || {})))];

    return keys.length === 0
      ? undefined
      : keys.reduce(
          (acc, k) => ({
            ...acc,
            [k]: mergeFHIRSchema(obj1?.[k], obj2?.[k], options),
          }),
          {},
        );
  };

  const elements = deepMerge(base.elements, overlay.elements);
  const slices = deepMerge(base.slicing?.slices, overlay.slicing?.slices);

  const cleanFields = ({ url, name, base, ...rest }: FHIRSchemaNode) => rest;
  const result = Object.assign(
    cleanFields(base),
    overlay,
    elements && { elements: elements },
    overlay.slicing && { slicing: { ...overlay.slicing, slices: slices } },
  );

  // The preserveSource `fhir` sidecar is documentation: shallow-merge it key-wise so a
  // base's inherited docs (definition/comment/…) survive when the overlay restates only
  // some of them, instead of the overlay's sidecar replacing the base's wholesale.
  const baseFhir = (base as { fhir?: Record<string, unknown> }).fhir;
  const overlayFhir = (overlay as { fhir?: Record<string, unknown> }).fhir;
  if (baseFhir || overlayFhir) {
    (result as Record<string, unknown>).fhir = { ...baseFhir, ...overlayFhir };
  }

  if (options.unionArrays) {
    const unionArr = (a?: string[], b?: string[]): string[] | undefined =>
      a || b ? [...new Set([...(a || []), ...(b || [])])] : undefined;
    const required = unionArr(base.required, overlay.required);
    const excluded = unionArr(base.excluded, overlay.excluded);
    if (required) result.required = required;
    if (excluded) result.excluded = excluded;
  }

  return result;
};
