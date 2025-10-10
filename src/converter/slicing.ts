import { FHIRSchema, FHIRSchemaElement, FhirSchemaSlicingDiscriminator, OperationOutcome, OperationOutcomeIssue, Resource } from './types';

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

const slice = <T extends object>(data: T[], spec: Slicing): Slices<T>  => {
  // resolve children element by discriminator path
  // https://hl7.org/fhir/elementdefinition-definitions.html#ElementDefinition.slicing.discriminator
  // Designates which child elements are used to discriminate between 
  // the slices when processing an instance.
  const elemByPath = (sliceSpec: FHIRSchemaElement, path: string) => {
    const pathTokens = path.split('.').map((value) => {
      // simple support for simple fhirpath
      // https://hl7.org/fhir/fhirpath.html#simple
      const match = value.match(/^\s*(?<fn>[A-Za-z][A-Za-z0-9]*)\s*\(\s*(?<params>[^()]*)\s*\)\s*$/);
      const token: PathToken = {
        type: match ? 'fn' : 'field',
        value: value,
        ...(match?.groups)
      };

      return token;
    });

    const elem = pathTokens.reduce((acc, curr) => {
      if (curr.type == 'fn')
        throw new Error(`Function: ${curr.fn}, not supported yet`);
      const child = acc?.elem?.['elements']?.[curr.value] as FHIRSchemaElement;
      return {elem: child, path: [...acc.path, curr.value]};
    }, {elem: sliceSpec, path: [] as string[]});

    return elem;
  }
  // https://hl7.org/fhir/elementdefinition-definitions.html#ElementDefinition.pattern_x_
  // When pattern[x] is used to constrain a complex object, it means 
  // that each property in the pattern must be present in the complex 
  // object, and its value must recursively match
  const matches = (a: any, b: any): boolean => {
    const isObject = typeof b === "object"
    const isArray = Array.isArray(b)
    if (!isObject && !isArray) {
      return a == b
    } else if (a == undefined) {
      return false
    } else if (isArray) {
      return b.every((bItem) => a.some((aItem: any) => matches(aItem, bItem)))
    } else {
      return Object.keys(b).reduce(
        (acc, curr) => acc && matches(a[curr], b[curr]),
        true as boolean,
      ) as boolean
    }
  }

  const chooseFieldKey = <T extends object>(obj: T, prefix: string):string => 
    Object.keys(obj).filter((k) => k.startsWith(prefix))[0]

  const sliceFns = Object
    .entries(spec.slices)
    .map(([sliceName, sliceSpec]) => {
      const discrElems = (spec.discriminator || [])
        .map(({type, path}) => ({ type, ...elemByPath(sliceSpec, path) }));

      return {
        sliceName,
        test: (item: T) => {
          return discrElems.every(({type, elem, path}) => {
            const itemValues = path.reduce((acc, curr) => {
              const result = acc
                .flatMap((x) => {
                  const val = x[curr];
                  return Array.isArray(val) ? val : [val];
                })
                .filter((v) => v != undefined);
              return result;
            }, [item] as any[])
            switch (type) {
              // https://hl7.org/fhir/codesystem-discriminator-type.html#discriminator-type-value
              // The slices have different values in the nominated element, as determined by the 
              // applicable fixed value, pattern, or required ValueSet binding.
              case 'value':
              case 'pattern':
                const fixedKey = chooseFieldKey(elem, 'fixed');
                const patternKey = chooseFieldKey(elem, 'pattern');
                if (fixedKey) {
                  const elemVal = (elem as any)[fixedKey];
                  return itemValues.some((v: any) => v == elemVal);
                } else if (patternKey) {
                  const elemVal = (elem as any)[patternKey];
                  return itemValues.some((v: any) => matches(v, elemVal));
                } else throw new Error('Not supported value');
              // TODO: add support for: exists, type, profile, position
            }
          });
        }
      }
    })
    .concat([{
      sliceName: '@default',
      test: (_item: T) => true
    }]);
  // partition data into defined slices by testing items
  const result = data.reduce((acc, curr) => {
    const sliceName = sliceFns.filter(({test}) => test(curr))[0].sliceName;
    return {...acc, [sliceName]: (acc[sliceName] || []).concat([curr])};
  }, {} as Slices<T>);

  return result;
}

const validate = (resource: Resource, profile: FHIRSchema): OperationOutcome => {
  const validateInternal = (data: any, spec: ValidationSpec, fieldPath: FieldPathComponent[] = [], parentSlices?: Slices<any>): OperationOutcomeIssue[] => {
    const { elements, slicing, ...moreSpec } = spec; 
    if (elements == undefined && slicing == undefined)
      return []; //TODO: implement type validation
    // iterate slicing
    const slicesIssues = ((slicing) => {
      if (slicing == undefined) 
        return [];
      // TODO: ensure data is array
      const slices = slice(data, slicing as Slicing);
      const result = Object.entries(slices)
        .flatMap(([sliceName, dataSlice]) => {
          const sliceSpec = slicing.slices?.[sliceName]!;
          if (sliceSpec == undefined) return [];
          // Merge parent elements with slice elements (slices refine, not replace)
          const mergedSpec = { ...sliceSpec, elements: {...elements, ...sliceSpec.elements} };
          const fieldPathItem: FieldPathComponent = { name: sliceName, type: parentSlices == undefined ? 'slice' : 'reslice' };
          const result = validateInternal(dataSlice, mergedSpec, [...fieldPath, fieldPathItem], slices);
          return result;
        });
      return result;
    })(slicing);
    // validate array items
    if (Array.isArray(data)) {
      const itemSpec = {elements, ...moreSpec}
      const itemIssues = data.flatMap((item) => validateInternal(item, itemSpec, fieldPath, parentSlices));
      return [...slicesIssues, ...itemIssues];
    }
    //
    const strFieldPath = (fieldPath: FieldPathComponent[]): string => {
      const separators: {[key in FieldPathComponent['type']]: string} = { 
        'field': '.', 
        'slice': ':', 
        'reslice': '/' 
      };

      const result = fieldPath.reduce((acc, {type, name}, idx) => {
        return `${acc}${(idx == 0 ? '' : separators[type])}${name}`;
      }, '');

      return result;
    };
    const specFields = new Set(Object.keys(spec.elements || {}))
    const requiredFields = new Set(spec.required);
    const dataFields = new Set(spec.elements && Object
      .keys(data || {})
      .filter((field) => field != 'resourceType'));
    const extraFields = dataFields.difference(specFields);// TODO: extra fields may be included in type schema
    // iterate fields
    const fields = [...dataFields.intersection(specFields)];
    const fieldIssues = fields
      .flatMap((field) => { 
        const sourceVal = data?.[field];
        const specVal = spec.elements?.[field] as ValidationSpec;
        const fieldPathItem: FieldPathComponent = { type: 'field', name: field };
        const issues = specVal == undefined ? [] : 
          validateInternal(sourceVal, specVal, [...fieldPath, fieldPathItem], parentSlices);
        return issues;
      });
    // validation checks
    // required fields
    const missingFieldIssues = [...requiredFields.difference(dataFields)].map((field) => {
        const pathComponents = [...fieldPath, { type: 'field', name: field } as FieldPathComponent];
        return {
          severity: 'error',
          code: 'required',
          details: { text: `Field: ${strFieldPath(pathComponents)}, is required` },
          expression: [strFieldPath(pathComponents.filter(({type}) => 'field' == type))]
        } as OperationOutcomeIssue;
      });
    // extra fields (not in the schema)
    const extraFieldIssues = [...extraFields].map((field) => {
        const pathComponents = [...fieldPath, { type: 'field', name: field } as FieldPathComponent];
        return {
          severity: 'error',
          code: 'invalid',
          details: { text: `Extra field detected: ${strFieldPath(pathComponents)}` },
          expression: [strFieldPath(pathComponents.filter(({type}) => 'field' == type))]
        } as OperationOutcomeIssue;
    });

    const issues = [
      ...missingFieldIssues,
      ...extraFieldIssues,
      ...fieldIssues,
      ...slicesIssues
    ];

    return issues;
  }

  const issues = validateInternal(resource, profile);

  return {
    resourceType: 'OperationOutcome',
    issue: issues
  }
};

type FhirSchemaNode = Pick<FHIRSchemaElement, 'elements' | 'slicing'> & Partial<Pick<FHIRSchema, 'name' | 'base' | 'url'>>;
type ValidationSpec = Partial<FHIRSchema> & Partial<FHIRSchemaElement>;
type Slicing = { 
  discriminator: { 
    path: string; 
    type: 'value' | 'exists' | 'pattern' | 'type' | 'profile' | 'position'; 
  }[]; 
  slices: { [key in string]: FHIRSchemaElement}; 
};
type Slices<T> = { [key in string]: T[]};
type PathToken = {
  type: 'field' | 'fn',
  value: string,
  fn?: string,
  params?: string
}
type FieldPathComponent = {
  type: 'field' | 'slice' | 'reslice';
  name: string
}

export { merge, slice, validate, Slicing, Slices };

