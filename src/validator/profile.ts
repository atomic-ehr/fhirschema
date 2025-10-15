import type { FHIRSchema, FHIRSchemaElement } from '../converter/types';

const merge = (base?: FhirSchemaNode, overlay?: FhirSchemaNode): FhirSchemaNode | undefined => {
  if ((base === overlay) === undefined) return;
  if (base === undefined) return overlay;
  if (overlay === undefined) return base;

  const deepMerge = (obj1: any, obj2: any) => {
    const keys = [...new Set(Object.keys(obj1 || {}).concat(Object.keys(obj2 || {})))];

    return keys.length === 0
      ? undefined
      : keys.reduce(
          (acc, k) => ({
            ...acc,
            [k]: merge(obj1?.[k], obj2?.[k]),
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

  return result;
};

type FhirSchemaNode = Pick<FHIRSchemaElement, 'elements' | 'slicing'> &
  Partial<Pick<FHIRSchema, 'name' | 'base' | 'url'>>;

export { merge };
