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
    .entries(spec.slicing.slices)
    .map(([sliceName, sliceSpec]) => {
      const discrElems = (spec.slicing.discriminator || [])
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
  const validateInternal = (data: any, spec: ValidationSpec, fieldPath: string[] = [], slicing?: Slicing1): OperationOutcomeIssue[] => {
    if (spec.elements == undefined && spec.slicing == undefined)
      return []; //TODO: implement type validation
    // iterate slicing
    const slicingIssues = Object
      .entries(spec.slicing?.slices || {})
      .flatMap(([name, slice]) => {
        const slicing: Slicing1 = { 
          sliceName: name, 
          discriminator: spec.slicing?.discriminator,
          atDefault: data
        };
        const issues = validateInternal(data, slice, fieldPath, slicing);
        return issues;
      });
    // validate array items
    if (Array.isArray(data)) {
      return data.flatMap((item) => validateInternal(item, spec, fieldPath, slicing));
    }
    //
    const specFields = new Set(Object.keys(spec.elements || {}))
    const requiredFields = new Set(spec.required);
    const dataFields = new Set(spec.elements && Object
      .keys(data || {})
      .filter((field) => field != 'resourceType'));
    const extraFields = dataFields.difference(specFields);// TODO: extra fields may be included in type schema
    const strPath = fieldPath.join(".");
    // iterate fields
    const fields = [...dataFields.intersection(specFields)];
    const fieldIssues = fields
      .flatMap((field) => { 
        const sourceVal = data?.[field];
        const specVal = spec.elements?.[field] as ValidationSpec;
        const issues = validateInternal(sourceVal, specVal, [...fieldPath, field], slicing);
        return issues;
      });
    // validation checks
    // required fields
    const missingFieldIssues = [...requiredFields.difference(dataFields)].map((field) => {
        const fieldPath = `${strPath}.${field}`;
        return {
          severity: 'error',
          code: 'required',
          details: { text: `Field: ${fieldPath}, is required` },
          location: [fieldPath],
          expression: [fieldPath]
        } as OperationOutcomeIssue;
      });
    // extra fields (not in the schema)
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
    // match: fixed[x] (https://hl7.org/fhir/elementdefinition-definitions.html#ElementDefinition.fixed_x_)
    const [fixedField] = Object.keys(spec).filter((k) => k.startsWith('fixed'))
    if (fixedField != undefined) {
      const a = 1;
    }

    const issues = [
      ...missingFieldIssues,
      ...extraFieldIssues,
      ...fieldIssues,
      ...slicingIssues
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
type FhirSchemaElements = FhirSchemaNode['elements'];
type FhirSchemaSlicing = FhirSchemaNode['slicing'];
type Slicing1 = {
  discriminator?: FhirSchemaSlicingDiscriminator[];
  sliceName: string;
  atDefault?: any
};
type ValidationSpec = Partial<FHIRSchema> & Partial<FHIRSchemaElement>;
type Slicing = { 
  slicing: { 
    discriminator: { 
      path: string; 
      type: 'value' | 'exists' | 'pattern' | 'type' | 'profile' | 'position'; 
    }[]; 
    slices: { [key in string]: FHIRSchemaElement}; 
  }; 
};
type Slices<T> = { [key in string]: T[]};
type PathToken = {
  type: 'field' | 'fn',
  value: string,
  fn?: string,
  params?: string
}

export { merge, slice, validate, Slicing, Slices };

