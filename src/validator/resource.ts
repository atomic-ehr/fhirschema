import type {
  FHIRSchema,
  FHIRSchemaElement,
  OperationOutcome,
  OperationOutcomeIssue,
  Resource,
} from '../converter/types';
import * as cardinality from './cardinality';
import * as complex from './complex';
import * as fp from './fieldPath';
import * as primitive from './primitive';

// simple support for simple fhirpath
// https://hl7.org/fhir/fhirpath.html#simple
const FHIR_PATH_SIMPLE_REGEX = /^\s*(?<fn>[A-Za-z][A-Za-z0-9]*)\s*\(\s*(?<params>[^()]*)\s*\)\s*$/;

// https://hl7.org/fhir/elementdefinition-definitions.html#ElementDefinition.pattern_x_
// When pattern[x] is used to constrain a complex object, it means
// that each property in the pattern must be present in the complex
// object, and its value must recursively match
const matchPattern = (value: any, pattern: any): boolean => {
  const isObject = typeof pattern === 'object';
  const isArray = Array.isArray(pattern);
  if (!isObject && !isArray) return value === pattern;
  if (value === undefined) return false;
  if (isArray)
    return pattern.every((patternItem) =>
      value.some((valueItem: any) => matchPattern(valueItem, patternItem)),
    );
  return Object.keys(pattern).reduce(
    (acc, curr) => acc && matchPattern(value[curr], pattern[curr]),
    true,
  );
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
    case 'value': {
      const fixedKey = chooseFieldKey(spec, 'fixed');
      const patternKey = chooseFieldKey(spec, 'pattern');
      if (fixedKey) {
        const elemVal = (spec as any)[fixedKey];
        return itemValues.some((v: any) => v === elemVal);
      }
      if (patternKey) {
        const elemVal = (spec as any)[patternKey];
        return itemValues.some((v: any) => matchPattern(v, elemVal));
      }
      throw new Error('Not supported value');
    }
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
        if (curr.type === 'fn') throw new Error(`Function: ${curr.fn}, not supported yet`);
        const child = acc?.elem?.elements?.[curr.value] as FHIRSchemaElement;
        return { elem: child, path: [...acc.path, curr.value] };
      },
      { elem: sliceSpec, path: [] as string[] },
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
                .filter((v) => v !== undefined),
            [item] as any[],
          );
          return matches(itemValues, elem, type);
        });
      };

      return { sliceName, test };
    })
    .concat([defaultSliceFn]);
  // partition data into defined slices by testing items
  const result = data.reduce(
    (acc, curr) => {
      const sliceName = sliceFns.filter(({ test }) => test(curr))[0].sliceName;
      return { ...acc, [sliceName]: (acc[sliceName] || []).concat([curr]) };
    },
    {} as Slices<T>,
  );

  return result;
};

const validate = (
  resource: Resource,
  profile: FHIRSchema,
  typeProfiles: { [key in string]: FHIRSchema },
): OperationOutcome => {
  const validate = (
    data: any,
    spec: ValidationSpec,
    location: fp.FieldPathComponent[] = [],
    parentSlices?: Slices<any>,
  ): OperationOutcomeIssue[] => {
    const { elements, slicing, ...moreSpec } = spec;
    // iterate slicing
    const slicesIssues = ((slicing) => {
      if (slicing === undefined) return [];
      // TODO: ensure data is array
      const slices = slice(data, slicing as Slicing);
      const result = Object.keys(slicing.slices || {}).flatMap((sliceName) => {
        const dataSlice = slices[sliceName];
        const sliceSpec = slicing.slices?.[sliceName]!;
        if (sliceSpec === undefined) return [];
        // Merge parent elements with slice elements (slices refine, not replace)
        const mergedSpec = { ...sliceSpec, elements: { ...elements, ...sliceSpec.elements } };
        const pathItem: fp.FieldPathComponent = {
          name: sliceName,
          type: parentSlices === undefined ? 'slice' : 'reslice',
        };
        const sliceLoc = [...location, pathItem];
        const cardinalityIssues = cardinality.validate(dataSlice, sliceSpec, sliceLoc).issue || [];
        const sliceIssues = validate(dataSlice, mergedSpec, sliceLoc, slices);
        return [...cardinalityIssues, ...sliceIssues];
      });
      return result;
    })(slicing);

    // iterate array
    if (Array.isArray(data)) {
      const itemSpec = { elements, ...moreSpec };
      const itemIssues = data.flatMap((item, idx) => {
        const pathIndex: fp.FieldPathComponent = { type: 'index', name: `${idx}` };
        return validate(item, itemSpec, [...location, pathIndex], parentSlices);
      });
      return [...slicesIssues, ...itemIssues];
    }
    // iterate fields
    const specFields = new Set(Object.keys(spec.elements || {}));
    const dataFields = new Set(
      spec.elements && Object.keys(data || {}).filter((field) => field !== 'resourceType'),
    );
    // iterate fields
    const fields = [...dataFields.intersection(specFields)];
    const fieldIssues = fields.flatMap((field) => {
      const fieldLoc = [...location, { type: 'field', name: field } as fp.FieldPathComponent];
      const fieldVal = data?.[field];
      const elemSpec = spec.elements?.[field]!;

      const cardinalityIssues = cardinality.validate(fieldVal, elemSpec, fieldLoc).issue || [];

      const itemIssues = (() => {
        if (!elemSpec.type || elemSpec.type === 'BackboneElement') {
          return validate(fieldVal, elemSpec, fieldLoc, parentSlices);
        }
        // https://hl7.org/fhir/valueset-structure-definition-kind.html
        const elemSchema = typeProfiles[elemSpec.type!];
        switch (elemSchema.kind) {
          case 'primitive-type':
            return primitive.validate(fieldVal, elemSchema, fieldLoc).issue || [];
          case 'complex-type':
            return complex.validate(fieldVal, elemSchema, fieldLoc, typeProfiles).issue || [];
          case 'resource':
            return validate(fieldVal, elemSchema, fieldLoc, parentSlices);
          default:
            throw new Error(`Not supported kind: ${elemSchema.kind}`);
        }
      })();

      return [...cardinalityIssues, ...itemIssues];
    });
    // required fields
    const requiredFields = new Set(spec.required);
    const missingFieldIssues = [...requiredFields.difference(dataFields)].map((field) => {
      const fieldLoc = [...location, { type: 'field', name: field } as fp.FieldPathComponent];
      return {
        severity: 'error',
        code: 'required',
        details: { text: `Field: ${fp.stringify(fieldLoc)}, is required` },
        expression: [fp.stringify(fieldLoc, { asFhirPath: true })],
      } as OperationOutcomeIssue;
    });
    // extra fields (not in the schema)
    const extraFields = dataFields.difference(specFields);
    const extraFieldIssues = [...extraFields].map((field) => {
      const pathComponents = [...location, { type: 'field', name: field } as fp.FieldPathComponent];
      return {
        severity: 'error',
        code: 'invalid',
        details: { text: `Extra field detected: ${fp.stringify(pathComponents)}` },
        expression: [fp.stringify(pathComponents, { asFhirPath: true })],
      } as OperationOutcomeIssue;
    });

    return [...fieldIssues, ...missingFieldIssues, ...extraFieldIssues, ...slicesIssues];
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

export { slice, validate, type Slicing, type Slices };
