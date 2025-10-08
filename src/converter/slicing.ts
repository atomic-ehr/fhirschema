import { FHIRSchema, FHIRSchemaElement } from './types';

const merge = (base?: FhirSchemaNode, overlay?: FhirSchemaNode): FhirSchemaNode | undefined => {
  if (base == overlay == undefined) return;
  if (base == undefined) return overlay;
  if (overlay == undefined) return base;

  const keys = [...new Set(Object
    .keys(base.elements || {})
    .concat(Object.keys(overlay.elements || {})))];
  
  const elements = keys.length == 0 ? undefined : keys
    .reduce((acc, k) => ({
      ...acc, 
      [k]: merge(base.elements?.[k], overlay.elements?.[k])
    }), {});

  const cleanFields = ({url, name, base, ...rest}: FhirSchemaNode) => rest;
  const result = Object.assign(cleanFields(base), overlay, {elements: elements});

  return result;
};

type FhirSchemaNode = Pick<FHIRSchemaElement, 'elements' | 'slicing'> & Partial<Pick<FHIRSchema, 'name' | 'base' | 'url'>>;
type FhirSchemaElements = FhirSchemaNode['elements'];
type FhirSchemaSlicing = FhirSchemaNode['slicing'];

export { merge };
