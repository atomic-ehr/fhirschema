import type { FHIRSchema, OperationOutcome, OperationOutcomeIssue } from '../converter/types';
import * as cardinality from './cardinality';
import * as fp from './fieldPath';
import * as primitive from './primitive';

const validate = (
  data: any,
  spec: FHIRSchema,
  location: fp.FieldPathComponent[],
  typeProfiles: { [key in string]: FHIRSchema },
): OperationOutcome => {
  if (Array.isArray(data)) {
    const itemIssues = data.flatMap((item, idx) => {
      const pathIndex: fp.FieldPathComponent = { type: 'index', name: `${idx}` };
      return validate(item, spec, [...location, pathIndex], typeProfiles).issue || [];
    });
    return { resourceType: 'OperationOutcome', issue: itemIssues };
  }

  const specFields = new Set(Object.keys(spec.elements || {}));
  const requiredFields = new Set(spec.required);
  const dataFields = new Set(
    spec.elements && Object.keys(data || {}).filter((field) => field !== 'resourceType'),
  );
  const extraFields = dataFields.difference(specFields);
  // iterate fields
  const fields = [...dataFields.intersection(specFields)];
  const fieldIssues = fields.flatMap((field) => {
    const fieldLoc = [...location, { type: 'field', name: field } as fp.FieldPathComponent];
    const fieldVal = data?.[field];
    const elemSpec = spec.elements?.[field];

    if (!elemSpec) throw new Error('Element specification not found');

    const cardinalityIssues = cardinality.validate(fieldVal, elemSpec, location).issue || [];

    const itemIssues = (() => {
      const elemSchema = typeProfiles[elemSpec.type ?? ''];

      if (elemSchema === undefined) {
        return [
          {
            severity: 'error',
            code: 'not-supported',
            details: {
              text: `Element type not supported: ${elemSpec.type}, for field: ${fp.stringify(
                fieldLoc,
              )}`,
            },
          } as OperationOutcomeIssue,
        ];
      }

      // https://hl7.org/fhir/valueset-structure-definition-kind.html
      switch (elemSchema.kind) {
        case 'primitive-type':
          return primitive.validate(fieldVal, elemSchema, fieldLoc).issue || [];
        case 'complex-type':
          return validate(fieldVal, elemSchema, fieldLoc, typeProfiles).issue || [];
        default:
          throw new Error(`Not supported kind: ${elemSchema.kind}`);
      }
    })();

    return [...cardinalityIssues, ...itemIssues];
  });
  // required fields
  const missingFieldIssues = [...requiredFields.difference(dataFields)].map((field) => {
    const fieldLoc = [...location, { type: 'field', name: field } as fp.FieldPathComponent];
    return {
      severity: 'error',
      code: 'required',
      details: { text: `Field: ${fp.stringify(fieldLoc)}, is required` },
      expression: [fp.stringify(fieldLoc.filter(({ type }) => 'field' === type))],
    } as OperationOutcomeIssue;
  });
  // extra fields (not in the schema)
  const extraFieldIssues = [...extraFields].map((field) => {
    const pathComponents = [...location, { type: 'field', name: field } as fp.FieldPathComponent];
    return {
      severity: 'error',
      code: 'invalid',
      details: { text: `Extra field detected: ${fp.stringify(pathComponents)}` },
      expression: [fp.stringify(pathComponents.filter(({ type }) => 'field' === type))],
    } as OperationOutcomeIssue;
  });

  const issues = [...missingFieldIssues, ...extraFieldIssues, ...fieldIssues];

  return { resourceType: 'OperationOutcome', issue: issues };
};

export { validate };
