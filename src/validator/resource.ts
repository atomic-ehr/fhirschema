import {
  FHIRSchema,
  FHIRSchemaElement,
  OperationOutcome,
  OperationOutcomeIssue,
  Resource,
} from '../converter/types';
import * as fp from './fieldPath';
import * as primitive from './primitive';
import * as complex from './complex';

// simple support for simple fhirpath
// https://hl7.org/fhir/fhirpath.html#simple
const FHIR_PATH_SIMPLE_REGEX = /^\s*(?<fn>[A-Za-z][A-Za-z0-9]*)\s*\(\s*(?<params>[^()]*)\s*\)\s*$/;

// https://hl7.org/fhir/elementdefinition-definitions.html#ElementDefinition.pattern_x_
// When pattern[x] is used to constrain a complex object, it means
// that each property in the pattern must be present in the complex
// object, and its value must recursively match
const matchPattern = (a: any, b: any): boolean => {
  const isObject = typeof b === 'object';
  const isArray = Array.isArray(b);
  if (!isObject && !isArray) {
    return a == b;
  } else if (a == undefined) {
    return false;
  } else if (isArray) {
    return b.every((bItem) => a.some((aItem: any) => matchPattern(aItem, bItem)));
  } else {
    return Object.keys(b).reduce(
      (acc, curr) => acc && matchPattern(a[curr], b[curr]),
      true as boolean
    ) as boolean;
  }
};

// simple support for simple fhirpath
// https://hl7.org/fhir/fhirpath.html#simple
const parseFhirpath = (path: string): PathToken[] => {
  return path.split('.').map((value) => {
    const match = value.match(FHIR_PATH_SIMPLE_REGEX);
    const type = match ? 'fn' : 'field';
    return { type: type, value: value, ...match?.groups };
  });
};

const matches = <T>(itemValues: T[], spec: FHIRSchemaElement, type: SlicingDiscriminatorType) => {
  const chooseFieldKey = <T extends object>(obj: T, prefix: string): string =>
    Object.keys(obj).filter((k) => k.startsWith(prefix))[0];
  // https://hl7.org/fhir/codesystem-discriminator-type.html
  switch (type) {
    // https://hl7.org/fhir/codesystem-discriminator-type.html#discriminator-type-pattern
    // his has the same meaning as 'value' and is deprecated
    case 'pattern':
    // https://hl7.org/fhir/codesystem-discriminator-type.html#discriminator-type-value
    // The slices have different values in the nominated element, as determined by the
    // applicable fixed value, pattern, or required ValueSet binding.
    case 'value':
      const fixedKey = chooseFieldKey(spec, 'fixed');
      const patternKey = chooseFieldKey(spec, 'pattern');
      if (fixedKey) {
        const elemVal = (spec as any)[fixedKey];
        return itemValues.some((v: any) => v == elemVal);
      } else if (patternKey) {
        const elemVal = (spec as any)[patternKey];
        return itemValues.some((v: any) => matchPattern(v, elemVal));
      } else throw new Error('Not supported value');
    // TODO: add support for: exists, type, profile, position
  }
};

const slice = <T extends object>(data: T[], spec: Slicing): Slices<T> => {
  // resolve children element by discriminator path
  // https://hl7.org/fhir/elementdefinition-definitions.html#ElementDefinition.slicing.discriminator
  // Designates which child elements are used to discriminate between
  // the slices when processing an instance.
  const elemByPath = (sliceSpec: FHIRSchemaElement, path: string) => {
    return parseFhirpath(path).reduce(
      (acc, curr) => {
        if (curr.type == 'fn') throw new Error(`Function: ${curr.fn}, not supported yet`);
        const child = acc?.elem?.['elements']?.[curr.value] as FHIRSchemaElement;
        return { elem: child, path: [...acc.path, curr.value] };
      },
      { elem: sliceSpec, path: [] as string[] }
    );
  };
  const defaultSliceFn = { sliceName: '@default', test: (_item: T) => true };
  const sliceFns = Object.entries(spec.slices)
    .map(([sliceName, sliceSpec]) => {
      const discrElems = (spec.discriminator || []).map(({ type, path }) => ({
        type,
        ...elemByPath(sliceSpec, path),
      }));
      const test = (item: T) => {
        return discrElems.every(({ type, elem, path }) => {
          const itemValues = path.reduce(
            (acc, curr) =>
              acc
                .flatMap((x) => {
                  const val = x[curr];
                  return Array.isArray(val) ? val : [val];
                })
                .filter((v) => v != undefined),
            [item] as any[]
          );
          return matches(itemValues, elem, type);
        });
      };

      return { sliceName, test };
    })
    .concat([defaultSliceFn]);
  // partition data into defined slices by testing items
  const result = data.reduce((acc, curr) => {
    const sliceName = sliceFns.filter(({ test }) => test(curr))[0].sliceName;
    return { ...acc, [sliceName]: (acc[sliceName] || []).concat([curr]) };
  }, {} as Slices<T>);

  return result;
};

const validate = (
  resource: Resource,
  profile: FHIRSchema,
  typeProfiles: { [key in string]: FHIRSchema }
): OperationOutcome => {
  const validate = (
    data: any,
    spec: ValidationSpec,
    fieldPath: fp.FieldPathComponent[] = [],
    parentSlices?: Slices<any>
  ): OperationOutcomeIssue[] => {
    const { elements, slicing, ...moreSpec } = spec;
    if (elements == undefined && slicing == undefined) return []; //TODO: implement type validation
    // iterate slicing
    const slicesIssues = ((slicing) => {
      if (slicing == undefined) return [];
      // TODO: ensure data is array
      const slices = slice(data, slicing as Slicing);
      const result = Object.entries(slices).flatMap(([sliceName, dataSlice]) => {
        const sliceSpec = slicing.slices?.[sliceName]!;
        if (sliceSpec == undefined) return [];
        // Merge parent elements with slice elements (slices refine, not replace)
        const mergedSpec = { ...sliceSpec, elements: { ...elements, ...sliceSpec.elements } };
        const fieldPathItem: fp.FieldPathComponent = {
          name: sliceName,
          type: parentSlices == undefined ? 'slice' : 'reslice',
        };
        const result = validate(dataSlice, mergedSpec, [...fieldPath, fieldPathItem], slices);
        return result;
      });
      return result;
    })(slicing);
    // validate array items
    if (Array.isArray(data)) {
      const itemSpec = { elements, ...moreSpec };
      const itemIssues = data.flatMap((item) => validate(item, itemSpec, fieldPath, parentSlices));
      return [...slicesIssues, ...itemIssues];
    }
    const specFields = new Set(Object.keys(spec.elements || {}));
    const requiredFields = new Set(spec.required);
    const dataFields = new Set(
      spec.elements && Object.keys(data || {}).filter((field) => field != 'resourceType')
    );
    const extraFields = dataFields.difference(specFields);
    // iterate fields
    const fields = [...dataFields.intersection(specFields)];
    const fieldIssues = fields.flatMap((field) => {
      const fieldLoc = [...fieldPath, { type: 'field', name: field } as fp.FieldPathComponent];
      const sourceVal = data?.[field];
      const elemSpec = spec.elements?.[field]!;

      const elemSchema = typeProfiles[elemSpec.type!];
      if (elemSchema == undefined) {
        return validate(sourceVal, elemSpec, fieldLoc, parentSlices);
      }

      // https://hl7.org/fhir/valueset-structure-definition-kind.html
      switch (elemSchema.kind) {
        case 'primitive-type':
          return primitive.validate(sourceVal, elemSchema, fieldLoc).issue || [];
        case 'complex-type':
          return complex.validate(sourceVal, elemSchema, fieldLoc, typeProfiles).issue || [];
        case 'resource':
          return validate(sourceVal, elemSchema, fieldLoc, parentSlices);
        default:
          throw new Error(`Not supported kind: ${elemSchema.kind}`);
      }
      // TODO: what about element constraints?
    });
    // required fields
    const missingFieldIssues = [...requiredFields.difference(dataFields)].map((field) => {
      const fieldLoc = [...fieldPath, { type: 'field', name: field } as fp.FieldPathComponent];
      return {
        severity: 'error',
        code: 'required',
        details: { text: `Field: ${fp.stringify(fieldLoc)}, is required` },
        expression: [fp.stringify(fieldLoc.filter(({ type }) => 'field' == type))],
      } as OperationOutcomeIssue;
    });
    // extra fields (not in the schema)
    const extraFieldIssues = [...extraFields].map((field) => {
      const pathComponents = [
        ...fieldPath,
        { type: 'field', name: field } as fp.FieldPathComponent,
      ];
      return {
        severity: 'error',
        code: 'invalid',
        details: { text: `Extra field detected: ${fp.stringify(pathComponents)}` },
        expression: [fp.stringify(pathComponents.filter(({ type }) => 'field' == type))],
      } as OperationOutcomeIssue;
    });

    const issues = [...fieldIssues, ...missingFieldIssues, ...extraFieldIssues, ...slicesIssues];

    return issues;
  };

  const issues = validate(resource, profile);

  return {
    resourceType: 'OperationOutcome',
    issue: issues,
  };
};

type ValidationSpec = Partial<FHIRSchema> & Partial<FHIRSchemaElement>;
type SlicingDiscriminatorType = 'value' | 'exists' | 'pattern' | 'type' | 'profile' | 'position';
type Slicing = {
  discriminator: { path: string; type: SlicingDiscriminatorType }[];
  slices: { [key in string]: FHIRSchemaElement };
};
type Slices<T> = { [key in string]: T[] };
type PathToken = {
  type: 'field' | 'fn';
  value: string;
  fn?: string;
  params?: string;
};

export { slice, validate, Slicing, Slices };
