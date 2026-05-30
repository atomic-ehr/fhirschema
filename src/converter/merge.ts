import type { FHIRSchema, FHIRSchemaElement } from './types';

export interface FhirSchemaMergeOptions {
  // Union `required` / `excluded` arrays across the chain instead of letting the
  // last overlay replace them. Needed for snapshot generation (a base requirement
  // must survive a derived layer that does not restate it). Off by default.
  unionArrays?: boolean;
}

type FhirSchemaNode = Pick<FHIRSchemaElement, 'elements' | 'slicing' | 'required' | 'excluded'> &
  Partial<Pick<FHIRSchema, 'name' | 'base' | 'url'>>;

// Overlay-merge two FHIRSchema nodes: a `base` and an `overlay` that constrains it.
// This is the "smart merge" at the heart of snapshot generation — folding a
// base→leaf profile chain into one effective schema. Overlay scalar fields win;
// `elements` and `slicing.slices` merge recursively.
export const mergeFhirSchema = (
  base?: FhirSchemaNode,
  overlay?: FhirSchemaNode,
  options: FhirSchemaMergeOptions = {},
): FhirSchemaNode | undefined => {
  if (base === undefined) return overlay;
  if (overlay === undefined) return base;

  const deepMerge = (obj1: any, obj2: any) => {
    const keys = [...new Set(Object.keys(obj1 || {}).concat(Object.keys(obj2 || {})))];

    return keys.length === 0
      ? undefined
      : keys.reduce(
          (acc, k) => ({
            ...acc,
            [k]: mergeFhirSchema(obj1?.[k], obj2?.[k], options),
          }),
          {},
        );
  };

  const elements = deepMerge(base.elements, overlay.elements);
  const slices = deepMerge(base.slicing?.slices, overlay.slicing?.slices);

  const cleanFields = ({ url, name, base, ...rest }: FhirSchemaNode) => rest;
  const result = Object.assign(
    cleanFields(base),
    overlay,
    elements && { elements: elements },
    overlay.slicing && { slicing: { ...overlay.slicing, slices: slices } },
  );

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
