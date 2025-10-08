import { FHIRSchema, FHIRSchemaElement, FhirSchemaSlicingDiscriminator } from './types';

const merge = (base?: FhirSchemaNode, overlay?: FhirSchemaNode): FhirSchemaNode | undefined => {
  if (base == overlay == undefined) return;
  if (base == undefined) return overlay;
  if (overlay == undefined) return base;

  const deepMerge = (obj1: any, obj2: any) => {
    const keys = [...new Set(Object
        .keys(obj1 || {})
        .concat(Object.keys(obj2 || {})))];

    return keys.length == 0 ? undefined : keys
      .reduce((acc, k) => ({
        ...acc, 
        [k]: merge(obj1?.[k], obj2?.[k])
      }), {});
  }

  const elements = deepMerge(base.elements, overlay.elements);
  const slices = deepMerge(base.slicing?.slices, overlay.slicing?.slices);

  const cleanFields = ({url, name, base, ...rest}: FhirSchemaNode) => rest;
  const result = Object.assign(
    cleanFields(base), 
    overlay, 
    elements && { elements: elements },
    overlay.slicing && { slicing: { ...overlay.slicing, slices: slices }});

  return result;
};

const validate = (resource: Resource, profile: FHIRSchema): OperationOutcome => {
  const validateInternal = (data: any, spec: ValidationSpec, fieldPath: string[] = [], slicesStack: SliceStackItem[] = []): OperationOutcomeIssue[] => {
    const dataFields = new Set(Object.keys(data || {}));
    const specFields = new Set(Object.keys(spec.elements || {}))
    const requiredFields = (spec.required || []).filter((field) => !dataFields.has(field))
    const extraFields = specFields.difference(dataFields);

    const fieldIssues = [...dataFields.intersection(specFields)]
      .flatMap((field) => {
        const dataVal = data?.[field];
        const specVal = spec.elements?.[field] as ValidationSpec;
        const issues = validateInternal(dataVal, specVal, [...fieldPath, field], slicesStack);
        return issues;
      });

    const strPath = fieldPath.join(".");

    const requiredFieldIssues = requiredFields.map((field) => {
        const fieldPath = `${strPath}.${field}`;
        return {
          severity: 'error',
          code: 'required',
          details: { text: `Field: ${fieldPath}, is required` },
          location: [fieldPath],
          expression: [fieldPath]
        } as OperationOutcomeIssue;
      });

    const extraFieldIssues = [...extraFields].map((field) => {
        const fieldPath = `${strPath}.${field}`;
        return {
          severity: 'error',
          code: 'invalid',
          details: { text: `Extra field detected: ${fieldPath}` },
          location: [fieldPath],
          expression: [fieldPath]
        };
    });

    const issues = [
      ...requiredFieldIssues,
      ...extraFieldIssues,
      ...fieldIssues
    ];

    return issues;
  }

  const issues = validateInternal(resource, profile);

  return {
    resourceType: 'OperationOutcome',
    issue: issues
  }
};

type Coding = {
  code?: string;
  display?: string;
  system?: string;
};
type CodeableConcept = {
  coding?: Coding[];
  text?: string;
};
type OperationOutcomeIssue = {
  severity: string;
  code: string;
  details?: CodeableConcept;
  diagnostics?: string;
  expression?: string[];
  id?: string;
  location?: string[];
};
type Resource = { resourceType: string };
type OperationOutcome = Resource & { 
  resourceType: 'OperationOutcome';
  issue?: OperationOutcomeIssue[] 
};
type FhirSchemaNode = Pick<FHIRSchemaElement, 'elements' | 'slicing'> & Partial<Pick<FHIRSchema, 'name' | 'base' | 'url'>>;
type FhirSchemaElements = FhirSchemaNode['elements'];
type FhirSchemaSlicing = FhirSchemaNode['slicing'];
type SliceStackItem = FHIRSchemaElement & {
  discriminator: FhirSchemaSlicingDiscriminator[];
  sliceName: string;
};
type ValidationSpec = Pick<FHIRSchemaElement, 'required' | 'elements'>;

export { merge, validate };
