import type { FHIRSchema, FHIRSchemaElement } from '../types';

const merge = (base?: FhirSchemaNode, overlay?: FhirSchemaNode): FhirSchemaNode | undefined => {
  if ((base === overlay) === undefined) return;
  if (base === undefined) return overlay;
  if (overlay === undefined) return base;

  const deepMerge = (
    obj1: Record<string, unknown> | undefined,
    obj2: Record<string, unknown> | undefined,
  ) => {
    const keys = [...new Set(Object.keys(obj1 || {}).concat(Object.keys(obj2 || {})))];
    if (keys.length === 0) return undefined;
    const result: Record<string, unknown> = {};
    for (const k of keys) {
      result[k] = merge(obj1?.[k] as FhirSchemaNode, obj2?.[k] as FhirSchemaNode);
    }
    return result;
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

  return result;
};

type FhirSchemaNode = Pick<FHIRSchemaElement, 'elements' | 'slicing'> &
  Partial<Pick<FHIRSchema, 'name' | 'base' | 'url'>>;

export { merge };
