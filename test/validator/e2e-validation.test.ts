import { describe, expect, it } from 'bun:test';
import { translate } from '../../src/converter';
import type { FHIRSchema, OperationOutcome, StructureDefinition } from '../../src/converter/types';
import { validate } from '../../src/validator/resource';

// Minimal type schemas for testing
const typesIndex: Record<string, FHIRSchema> = {
  string: { url: 'string', name: 'string', type: 'string', kind: 'primitive-type', class: 'primitive-type' },
  integer: { url: 'integer', name: 'integer', type: 'integer', kind: 'primitive-type', class: 'primitive-type' },
  boolean: { url: 'boolean', name: 'boolean', type: 'boolean', kind: 'primitive-type', class: 'primitive-type' },
  decimal: { url: 'decimal', name: 'decimal', type: 'decimal', kind: 'primitive-type', class: 'primitive-type' },
  code: { url: 'code', name: 'code', type: 'code', kind: 'primitive-type', class: 'primitive-type' },
  uri: { url: 'uri', name: 'uri', type: 'uri', kind: 'primitive-type', class: 'primitive-type' },
  url: { url: 'url', name: 'url', type: 'url', kind: 'primitive-type', class: 'primitive-type' },
  date: { url: 'date', name: 'date', type: 'date', kind: 'primitive-type', class: 'primitive-type' },
  dateTime: { url: 'dateTime', name: 'dateTime', type: 'dateTime', kind: 'primitive-type', class: 'primitive-type' },
  unsignedInt: { url: 'unsignedInt', name: 'unsignedInt', type: 'unsignedInt', kind: 'primitive-type', class: 'primitive-type' },
  positiveInt: { url: 'positiveInt', name: 'positiveInt', type: 'positiveInt', kind: 'primitive-type', class: 'primitive-type' },
  Coding: {
    url: 'Coding',
    name: 'Coding',
    type: 'Coding',
    kind: 'complex-type',
    class: 'complex-type',
    elements: {
      system: { type: 'string' },
      code: { type: 'string' },
      display: { type: 'string' },
    },
  },
  CodeableConcept: {
    url: 'CodeableConcept',
    name: 'CodeableConcept',
    type: 'CodeableConcept',
    kind: 'complex-type',
    class: 'complex-type',
    elements: {
      coding: { type: 'Coding', array: true },
      text: { type: 'string' },
    },
  },
};

// Helper to create minimal StructureDefinition
function createSD(
  name: string,
  elements: Array<{
    path: string;
    type?: Array<{ code: string }>;
    min?: number;
    max?: string;
  }>,
): StructureDefinition {
  return {
    resourceType: 'StructureDefinition',
    url: `http://test.org/${name}`,
    name: name,
    status: 'active',
    kind: 'resource',
    type: name,
    abstract: false,
    derivation: 'specialization',
    differential: {
      element: [{ path: name }, ...elements.map((e) => ({ ...e, path: `${name}.${e.path}` }))],
    },
  } as StructureDefinition;
}

// Helper to check if result has no errors
function expectNoErrors(result: OperationOutcome) {
  expect(result.issue?.length ?? 0).toBe(0);
}

// Helper to check for specific error
function expectError(result: OperationOutcome, code: string, pathContains?: string) {
  const issues = result.issue || [];
  const matching = issues.filter((i) => {
    const codeMatch = i.code === code;
    const pathMatch = pathContains ? i.expression?.some((e) => e.includes(pathContains)) : true;
    return codeMatch && pathMatch;
  });
  expect(matching.length).toBeGreaterThan(0);
}

// Wrapper to extract outcome from ValidationOutput
function runValidate(resource: any, schema: any, types: any): OperationOutcome {
  return validate(resource, schema, types).outcome;
}

describe('E2E Validation: StructureDefinition → FHIRSchema → Validation', () => {
  describe('Primitive Type Validation', () => {
    it('validates string type - valid', () => {
      const sd = createSD('TestString', [{ path: 'value', type: [{ code: 'string' }] }]);
      const schema = translate(sd);
      const result = runValidate({ resourceType: 'TestString', value: 'hello' }, schema, typesIndex);
      expectNoErrors(result);
    });

    it('validates string type - invalid (number)', () => {
      const sd = createSD('TestString', [{ path: 'value', type: [{ code: 'string' }] }]);
      const schema = translate(sd);
      const result = runValidate({ resourceType: 'TestString', value: 123 }, schema, typesIndex);
      expectError(result, 'invalid', 'value');
    });

    it('validates integer type - valid', () => {
      const sd = createSD('TestInteger', [{ path: 'count', type: [{ code: 'integer' }] }]);
      const schema = translate(sd);
      const result = runValidate({ resourceType: 'TestInteger', count: 42 }, schema, typesIndex);
      expectNoErrors(result);
    });

    it('validates integer type - invalid (string)', () => {
      const sd = createSD('TestInteger', [{ path: 'count', type: [{ code: 'integer' }] }]);
      const schema = translate(sd);
      const result = runValidate({ resourceType: 'TestInteger', count: '42' }, schema, typesIndex);
      expectError(result, 'invalid', 'count');
    });

    it('validates boolean type - valid true', () => {
      const sd = createSD('TestBoolean', [{ path: 'active', type: [{ code: 'boolean' }] }]);
      const schema = translate(sd);
      const result = runValidate({ resourceType: 'TestBoolean', active: true }, schema, typesIndex);
      expectNoErrors(result);
    });

    it('validates boolean type - valid false', () => {
      const sd = createSD('TestBoolean', [{ path: 'active', type: [{ code: 'boolean' }] }]);
      const schema = translate(sd);
      const result = runValidate({ resourceType: 'TestBoolean', active: false }, schema, typesIndex);
      expectNoErrors(result);
    });

    it('validates boolean type - invalid (string)', () => {
      const sd = createSD('TestBoolean', [{ path: 'active', type: [{ code: 'boolean' }] }]);
      const schema = translate(sd);
      const result = runValidate({ resourceType: 'TestBoolean', active: 'true' }, schema, typesIndex);
      expectError(result, 'invalid', 'active');
    });

    it('validates decimal type - valid', () => {
      const sd = createSD('TestDecimal', [{ path: 'amount', type: [{ code: 'decimal' }] }]);
      const schema = translate(sd);
      const result = runValidate({ resourceType: 'TestDecimal', amount: 3.14 }, schema, typesIndex);
      expectNoErrors(result);
    });

    it('validates decimal type - invalid (string)', () => {
      const sd = createSD('TestDecimal', [{ path: 'amount', type: [{ code: 'decimal' }] }]);
      const schema = translate(sd);
      const result = runValidate({ resourceType: 'TestDecimal', amount: '3.14' }, schema, typesIndex);
      expectError(result, 'invalid', 'amount');
    });

    it('validates integer type - invalid (float)', () => {
      const sd = createSD('TestInteger', [{ path: 'count', type: [{ code: 'integer' }] }]);
      const schema = translate(sd);
      const result = runValidate({ resourceType: 'TestInteger', count: 3.14 }, schema, typesIndex);
      expectError(result, 'invalid', 'count');
    });

    it('validates code type - valid', () => {
      const sd = createSD('TestCode', [{ path: 'status', type: [{ code: 'code' }] }]);
      const schema = translate(sd);
      const result = runValidate({ resourceType: 'TestCode', status: 'active' }, schema, typesIndex);
      expectNoErrors(result);
    });

    it('validates code type - invalid (number)', () => {
      const sd = createSD('TestCode', [{ path: 'status', type: [{ code: 'code' }] }]);
      const schema = translate(sd);
      const result = runValidate({ resourceType: 'TestCode', status: 123 }, schema, typesIndex);
      expectError(result, 'invalid', 'status');
    });

    it('validates uri type - valid', () => {
      const sd = createSD('TestUri', [{ path: 'system', type: [{ code: 'uri' }] }]);
      const schema = translate(sd);
      const result = runValidate({ resourceType: 'TestUri', system: 'http://example.org' }, schema, typesIndex);
      expectNoErrors(result);
    });

    it('validates uri type - invalid (number)', () => {
      const sd = createSD('TestUri', [{ path: 'system', type: [{ code: 'uri' }] }]);
      const schema = translate(sd);
      const result = runValidate({ resourceType: 'TestUri', system: 12345 }, schema, typesIndex);
      expectError(result, 'invalid', 'system');
    });

    it('validates date type - valid', () => {
      const sd = createSD('TestDate', [{ path: 'birthDate', type: [{ code: 'date' }] }]);
      const schema = translate(sd);
      const result = runValidate({ resourceType: 'TestDate', birthDate: '1990-01-15' }, schema, typesIndex);
      expectNoErrors(result);
    });

    it('validates date type - invalid (number)', () => {
      const sd = createSD('TestDate', [{ path: 'birthDate', type: [{ code: 'date' }] }]);
      const schema = translate(sd);
      const result = runValidate({ resourceType: 'TestDate', birthDate: 19900115 }, schema, typesIndex);
      expectError(result, 'invalid', 'birthDate');
    });

    it('validates unsignedInt - valid', () => {
      const sd = createSD('TestUnsigned', [{ path: 'count', type: [{ code: 'unsignedInt' }] }]);
      const schema = translate(sd);
      const result = runValidate({ resourceType: 'TestUnsigned', count: 0 }, schema, typesIndex);
      expectNoErrors(result);
    });

    it('validates unsignedInt - invalid (negative)', () => {
      const sd = createSD('TestUnsigned', [{ path: 'count', type: [{ code: 'unsignedInt' }] }]);
      const schema = translate(sd);
      const result = runValidate({ resourceType: 'TestUnsigned', count: -1 }, schema, typesIndex);
      expectError(result, 'invalid', 'count');
    });

    it('validates positiveInt - valid', () => {
      const sd = createSD('TestPositive', [{ path: 'rank', type: [{ code: 'positiveInt' }] }]);
      const schema = translate(sd);
      const result = runValidate({ resourceType: 'TestPositive', rank: 1 }, schema, typesIndex);
      expectNoErrors(result);
    });

    it('validates positiveInt - invalid (zero)', () => {
      const sd = createSD('TestPositive', [{ path: 'rank', type: [{ code: 'positiveInt' }] }]);
      const schema = translate(sd);
      const result = runValidate({ resourceType: 'TestPositive', rank: 0 }, schema, typesIndex);
      expectError(result, 'invalid', 'rank');
    });
  });

  describe('Required Fields', () => {
    it('missing required field - error', () => {
      const sd = createSD('TestRequired', [{ path: 'name', type: [{ code: 'string' }], min: 1 }]);
      const schema = translate(sd);
      const result = runValidate({ resourceType: 'TestRequired' }, schema, typesIndex);
      expectError(result, 'required', 'name');
    });

    it('present required field - success', () => {
      const sd = createSD('TestRequired', [{ path: 'name', type: [{ code: 'string' }], min: 1 }]);
      const schema = translate(sd);
      const result = runValidate({ resourceType: 'TestRequired', name: 'John' }, schema, typesIndex);
      expectNoErrors(result);
    });
  });

  describe('Cardinality', () => {
    it('min violation (0 items when min=2) - error', () => {
      const sd = createSD('TestCardinality', [
        { path: 'items', type: [{ code: 'string' }], min: 2, max: '*' },
      ]);
      const schema = translate(sd);
      const result = runValidate({ resourceType: 'TestCardinality', items: [] }, schema, typesIndex);
      expectError(result, 'invariant');
    });

    it('max violation (3 items when max=2) - error', () => {
      const sd = createSD('TestCardinality', [
        { path: 'items', type: [{ code: 'string' }], min: 0, max: '2' },
      ]);
      const schema = translate(sd);
      const result = runValidate(
        { resourceType: 'TestCardinality', items: ['a', 'b', 'c'] },
        schema,
        typesIndex,
      );
      expectError(result, 'invariant');
    });

    it('valid cardinality - success', () => {
      const sd = createSD('TestCardinality', [
        { path: 'items', type: [{ code: 'string' }], min: 1, max: '3' },
      ]);
      const schema = translate(sd);
      const result = runValidate(
        { resourceType: 'TestCardinality', items: ['a', 'b'] },
        schema,
        typesIndex,
      );
      expectNoErrors(result);
    });
  });

  describe('Unknown Elements', () => {
    it('extra element not in schema - error', () => {
      const sd = createSD('TestKnown', [{ path: 'known', type: [{ code: 'string' }] }]);
      const schema = translate(sd);
      const result = runValidate(
        { resourceType: 'TestKnown', known: 'value', unknown: 'extra' },
        schema,
        typesIndex,
      );
      expectError(result, 'invalid', 'unknown');
    });

    it('nested unknown element - error', () => {
      const sd = createSD('TestNested', [
        { path: 'outer', type: [{ code: 'BackboneElement' }] },
        { path: 'outer.inner', type: [{ code: 'string' }] },
      ]);
      const schema = translate(sd);
      const result = runValidate(
        { resourceType: 'TestNested', outer: { inner: 'value', unknown: 'extra' } },
        schema,
        typesIndex,
      );
      expectError(result, 'invalid', 'unknown');
    });
  });

  describe('Choice Types (value[x])', () => {
    it('valid choice element (valueString) - success', () => {
      const sd = createSD('TestChoice', [
        { path: 'value[x]', type: [{ code: 'string' }, { code: 'integer' }] },
      ]);
      const schema = translate(sd);
      const result = runValidate(
        { resourceType: 'TestChoice', valueString: 'hello' },
        schema,
        typesIndex,
      );
      expectNoErrors(result);
    });

    it('valid choice element (valueInteger) - success', () => {
      const sd = createSD('TestChoice', [
        { path: 'value[x]', type: [{ code: 'string' }, { code: 'integer' }] },
      ]);
      const schema = translate(sd);
      const result = runValidate({ resourceType: 'TestChoice', valueInteger: 42 }, schema, typesIndex);
      expectNoErrors(result);
    });

    it('invalid choice type value - error', () => {
      const sd = createSD('TestChoice', [
        { path: 'value[x]', type: [{ code: 'string' }, { code: 'integer' }] },
      ]);
      const schema = translate(sd);
      const result = runValidate({ resourceType: 'TestChoice', valueString: 123 }, schema, typesIndex);
      expectError(result, 'invalid');
    });

    it('unknown choice type - error', () => {
      const sd = createSD('TestChoice', [
        { path: 'value[x]', type: [{ code: 'string' }, { code: 'integer' }] },
      ]);
      const schema = translate(sd);
      const result = runValidate(
        { resourceType: 'TestChoice', valueBoolean: true },
        schema,
        typesIndex,
      );
      expectError(result, 'invalid');
    });

    it('valid choice with boolean type', () => {
      const sd = createSD('TestChoiceBool', [
        { path: 'value[x]', type: [{ code: 'string' }, { code: 'boolean' }] },
      ]);
      const schema = translate(sd);
      const result = runValidate(
        { resourceType: 'TestChoiceBool', valueBoolean: false },
        schema,
        typesIndex,
      );
      expectNoErrors(result);
    });

    it('valid choice with decimal type', () => {
      const sd = createSD('TestChoiceDecimal', [
        { path: 'amount[x]', type: [{ code: 'decimal' }, { code: 'integer' }] },
      ]);
      const schema = translate(sd);
      const result = runValidate(
        { resourceType: 'TestChoiceDecimal', amountDecimal: 3.14159 },
        schema,
        typesIndex,
      );
      expectNoErrors(result);
    });

    it('valid choice with code type', () => {
      const sd = createSD('TestChoiceCode', [
        { path: 'status[x]', type: [{ code: 'code' }, { code: 'string' }] },
      ]);
      const schema = translate(sd);
      const result = runValidate(
        { resourceType: 'TestChoiceCode', statusCode: 'active' },
        schema,
        typesIndex,
      );
      expectNoErrors(result);
    });

    it('valid choice with dateTime type', () => {
      const sd = createSD('TestChoiceDateTime', [
        { path: 'effective[x]', type: [{ code: 'dateTime' }, { code: 'string' }] },
      ]);
      const schema = translate(sd);
      const result = runValidate(
        { resourceType: 'TestChoiceDateTime', effectiveDateTime: '2024-03-15T10:30:00Z' },
        schema,
        typesIndex,
      );
      expectNoErrors(result);
    });

    it('valid choice with complex type (Coding)', () => {
      const sd = createSD('TestChoiceCoding', [
        { path: 'value[x]', type: [{ code: 'string' }, { code: 'Coding' }] },
      ]);
      const schema = translate(sd);
      const result = runValidate(
        {
          resourceType: 'TestChoiceCoding',
          valueCoding: { system: 'http://example.org', code: 'test' },
        },
        schema,
        typesIndex,
      );
      expectNoErrors(result);
    });

    it('valid choice with complex type (CodeableConcept)', () => {
      const sd = createSD('TestChoiceCC', [
        { path: 'value[x]', type: [{ code: 'string' }, { code: 'CodeableConcept' }] },
      ]);
      const schema = translate(sd);
      const result = runValidate(
        {
          resourceType: 'TestChoiceCC',
          valueCodeableConcept: {
            coding: [{ system: 'http://example.org', code: 'test' }],
            text: 'Test value',
          },
        },
        schema,
        typesIndex,
      );
      expectNoErrors(result);
    });

    it('choice with invalid complex type content - error', () => {
      const sd = createSD('TestChoiceCodingInvalid', [
        { path: 'value[x]', type: [{ code: 'string' }, { code: 'Coding' }] },
      ]);
      const schema = translate(sd);
      const result = runValidate(
        {
          resourceType: 'TestChoiceCodingInvalid',
          valueCoding: { system: 123, code: 'test' }, // system should be string
        },
        schema,
        typesIndex,
      );
      expectError(result, 'invalid', 'system');
    });

    it('multiple choices with same base name - different fields', () => {
      const sd = createSD('TestMultiChoice', [
        { path: 'onset[x]', type: [{ code: 'dateTime' }, { code: 'string' }] },
        { path: 'abatement[x]', type: [{ code: 'dateTime' }, { code: 'boolean' }] },
      ]);
      const schema = translate(sd);
      const result = runValidate(
        {
          resourceType: 'TestMultiChoice',
          onsetDateTime: '2024-01-01T00:00:00Z',
          abatementBoolean: true,
        },
        schema,
        typesIndex,
      );
      expectNoErrors(result);
    });

    it('choice in BackboneElement', () => {
      const sd = createSD('TestNestedChoice', [
        { path: 'component', type: [{ code: 'BackboneElement' }] },
        { path: 'component.value[x]', type: [{ code: 'string' }, { code: 'integer' }] },
      ]);
      const schema = translate(sd);
      const result = runValidate(
        {
          resourceType: 'TestNestedChoice',
          component: { valueString: 'nested choice' },
        },
        schema,
        typesIndex,
      );
      expectNoErrors(result);
    });

    it('choice in BackboneElement - invalid type', () => {
      const sd = createSD('TestNestedChoiceInvalid', [
        { path: 'component', type: [{ code: 'BackboneElement' }] },
        { path: 'component.value[x]', type: [{ code: 'string' }, { code: 'integer' }] },
      ]);
      const schema = translate(sd);
      const result = runValidate(
        {
          resourceType: 'TestNestedChoiceInvalid',
          component: { valueString: 999 }, // should be string
        },
        schema,
        typesIndex,
      );
      expectError(result, 'invalid', 'valueString');
    });

    it('choice in array of BackboneElement', () => {
      const sd = createSD('TestArrayChoice', [
        { path: 'items', type: [{ code: 'BackboneElement' }], max: '*' },
        { path: 'items.value[x]', type: [{ code: 'string' }, { code: 'integer' }] },
      ]);
      const schema = translate(sd);
      const result = runValidate(
        {
          resourceType: 'TestArrayChoice',
          items: [
            { valueString: 'first' },
            { valueInteger: 42 },
            { valueString: 'third' },
          ],
        },
        schema,
        typesIndex,
      );
      expectNoErrors(result);
    });

    it('choice with many types (realistic Observation.value[x])', () => {
      const sd = createSD('TestObsValue', [
        {
          path: 'value[x]',
          type: [
            { code: 'string' },
            { code: 'integer' },
            { code: 'boolean' },
            { code: 'CodeableConcept' },
          ],
        },
      ]);
      const schema = translate(sd);

      // Test each valid type
      const resultString = runValidate(
        { resourceType: 'TestObsValue', valueString: 'text value' },
        schema,
        typesIndex,
      );
      expectNoErrors(resultString);

      const resultInteger = runValidate(
        { resourceType: 'TestObsValue', valueInteger: 100 },
        schema,
        typesIndex,
      );
      expectNoErrors(resultInteger);

      const resultBoolean = runValidate(
        { resourceType: 'TestObsValue', valueBoolean: true },
        schema,
        typesIndex,
      );
      expectNoErrors(resultBoolean);

      const resultCC = runValidate(
        {
          resourceType: 'TestObsValue',
          valueCodeableConcept: { text: 'coded value' },
        },
        schema,
        typesIndex,
      );
      expectNoErrors(resultCC);
    });

    it('choice element absent when not required - success', () => {
      const sd = createSD('TestOptionalChoice', [
        { path: 'value[x]', type: [{ code: 'string' }, { code: 'integer' }], min: 0 },
        { path: 'name', type: [{ code: 'string' }] },
      ]);
      const schema = translate(sd);
      const result = runValidate(
        { resourceType: 'TestOptionalChoice', name: 'test' },
        schema,
        typesIndex,
      );
      expectNoErrors(result);
    });

    it('choice with uri type', () => {
      const sd = createSD('TestChoiceUri', [
        { path: 'reference[x]', type: [{ code: 'uri' }, { code: 'string' }] },
      ]);
      const schema = translate(sd);
      const result = runValidate(
        { resourceType: 'TestChoiceUri', referenceUri: 'http://example.org/Patient/123' },
        schema,
        typesIndex,
      );
      expectNoErrors(result);
    });

    it('required choice missing - error', () => {
      const sd = createSD('TestRequiredChoice', [
        { path: 'value[x]', type: [{ code: 'string' }, { code: 'integer' }], min: 1 },
      ]);
      const schema = translate(sd);
      const result = runValidate({ resourceType: 'TestRequiredChoice' }, schema, typesIndex);
      // Reports "value" (the base choice name) as required
      expectError(result, 'required', 'value');
    });

    it('multiple choice values present - error', () => {
      const sd = createSD('TestMultipleChoices', [
        { path: 'value[x]', type: [{ code: 'string' }, { code: 'integer' }] },
      ]);
      const schema = translate(sd);
      const result = runValidate(
        { resourceType: 'TestMultipleChoices', valueString: 'hello', valueInteger: 42 },
        schema,
        typesIndex,
      );
      // Only one value[x] variant is allowed at a time
      expectError(result, 'invalid', 'value');
    });
  });

  describe('Nested/Complex Types', () => {
    it('BackboneElement with nested elements - success', () => {
      const sd = createSD('TestBackbone', [
        { path: 'contact', type: [{ code: 'BackboneElement' }] },
        { path: 'contact.name', type: [{ code: 'string' }] },
        { path: 'contact.phone', type: [{ code: 'string' }] },
      ]);
      const schema = translate(sd);
      const result = runValidate(
        { resourceType: 'TestBackbone', contact: { name: 'John', phone: '555-1234' } },
        schema,
        typesIndex,
      );
      expectNoErrors(result);
    });

    it('multi-level nesting - success', () => {
      const sd = createSD('TestDeepNest', [
        { path: 'level1', type: [{ code: 'BackboneElement' }] },
        { path: 'level1.level2', type: [{ code: 'BackboneElement' }] },
        { path: 'level1.level2.value', type: [{ code: 'string' }] },
      ]);
      const schema = translate(sd);
      const result = runValidate(
        { resourceType: 'TestDeepNest', level1: { level2: { value: 'deep' } } },
        schema,
        typesIndex,
      );
      expectNoErrors(result);
    });

    it('array of complex elements - success', () => {
      const sd = createSD('TestArrayComplex', [
        { path: 'items', type: [{ code: 'BackboneElement' }], max: '*' },
        { path: 'items.id', type: [{ code: 'integer' }] },
        { path: 'items.name', type: [{ code: 'string' }] },
      ]);
      const schema = translate(sd);
      const result = runValidate(
        {
          resourceType: 'TestArrayComplex',
          items: [
            { id: 1, name: 'first' },
            { id: 2, name: 'second' },
          ],
        },
        schema,
        typesIndex,
      );
      expectNoErrors(result);
    });

    it('array of complex elements with type error', () => {
      const sd = createSD('TestArrayComplex', [
        { path: 'items', type: [{ code: 'BackboneElement' }], max: '*' },
        { path: 'items.id', type: [{ code: 'integer' }] },
        { path: 'items.name', type: [{ code: 'string' }] },
      ]);
      const schema = translate(sd);
      const result = runValidate(
        {
          resourceType: 'TestArrayComplex',
          items: [
            { id: 1, name: 'first' },
            { id: 'not-int', name: 'second' },
          ],
        },
        schema,
        typesIndex,
      );
      expectError(result, 'invalid', 'id');
    });
  });

  describe('Complex Type References', () => {
    it('validates Coding type - success', () => {
      const sd = createSD('TestCoding', [{ path: 'code', type: [{ code: 'Coding' }] }]);
      const schema = translate(sd);
      const result = runValidate(
        {
          resourceType: 'TestCoding',
          code: { system: 'http://example.org', code: 'test', display: 'Test' },
        },
        schema,
        typesIndex,
      );
      expectNoErrors(result);
    });

    it('validates CodeableConcept type - success', () => {
      const sd = createSD('TestCC', [{ path: 'category', type: [{ code: 'CodeableConcept' }] }]);
      const schema = translate(sd);
      const result = runValidate(
        {
          resourceType: 'TestCC',
          category: {
            coding: [{ system: 'http://example.org', code: 'cat1' }],
            text: 'Category 1',
          },
        },
        schema,
        typesIndex,
      );
      expectNoErrors(result);
    });
  });

  describe('Edge Cases', () => {
    it('empty resource with no required fields - success', () => {
      const sd = createSD('TestEmpty', [{ path: 'optional', type: [{ code: 'string' }], min: 0 }]);
      const schema = translate(sd);
      const result = runValidate({ resourceType: 'TestEmpty' }, schema, typesIndex);
      expectNoErrors(result);
    });

    it('empty array - success', () => {
      const sd = createSD('TestEmptyArray', [
        { path: 'items', type: [{ code: 'string' }], min: 0, max: '*' },
      ]);
      const schema = translate(sd);
      const result = runValidate({ resourceType: 'TestEmptyArray', items: [] }, schema, typesIndex);
      expectNoErrors(result);
    });
  });

  describe('Deferred Validations', () => {
    it('collects terminology binding for code element', () => {
      const schema: FHIRSchema = {
        url: 'TestBinding',
        name: 'TestBinding',
        kind: 'resource',
        type: 'TestBinding',
        elements: {
          status: {
            type: 'code',
            binding: {
              strength: 'required',
              valueSet: 'http://example.org/ValueSet/status',
            },
          },
        },
      };
      const result = validate(
        { resourceType: 'TestBinding', status: 'active' },
        schema,
        typesIndex,
      );
      expectNoErrors(result.outcome);
      expect(result.deferred.length).toBe(1);
      expect(result.deferred[0]).toEqual({
        type: 'terminology',
        path: 'status',
        code: 'active',
        valueSet: 'http://example.org/ValueSet/status',
        strength: 'required',
      });
    });

    it('collects terminology binding for Coding element', () => {
      const schema: FHIRSchema = {
        url: 'TestCodingBinding',
        name: 'TestCodingBinding',
        kind: 'resource',
        type: 'TestCodingBinding',
        elements: {
          category: {
            type: 'Coding',
            binding: {
              strength: 'extensible',
              valueSet: 'http://example.org/ValueSet/category',
            },
          },
        },
      };
      const result = validate(
        {
          resourceType: 'TestCodingBinding',
          category: { system: 'http://example.org', code: 'cat1' },
        },
        schema,
        typesIndex,
      );
      expectNoErrors(result.outcome);
      expect(result.deferred.length).toBe(1);
      expect(result.deferred[0]).toEqual({
        type: 'terminology',
        path: 'category',
        code: 'cat1',
        system: 'http://example.org',
        valueSet: 'http://example.org/ValueSet/category',
        strength: 'extensible',
      });
    });

    it('skips example binding strength', () => {
      const schema: FHIRSchema = {
        url: 'TestExampleBinding',
        name: 'TestExampleBinding',
        kind: 'resource',
        type: 'TestExampleBinding',
        elements: {
          status: {
            type: 'code',
            binding: {
              strength: 'example',
              valueSet: 'http://example.org/ValueSet/status',
            },
          },
        },
      };
      const result = validate(
        { resourceType: 'TestExampleBinding', status: 'active' },
        schema,
        typesIndex,
      );
      expectNoErrors(result.outcome);
      expect(result.deferred.length).toBe(0);
    });

    it('collects reference validation', () => {
      const extendedTypes = {
        ...typesIndex,
        Reference: {
          url: 'Reference',
          name: 'Reference',
          type: 'Reference',
          kind: 'complex-type',
          class: 'complex-type',
          elements: {
            reference: { type: 'string' },
            type: { type: 'uri' },
            display: { type: 'string' },
          },
        },
      };
      const schema: FHIRSchema = {
        url: 'TestReference',
        name: 'TestReference',
        kind: 'resource',
        type: 'TestReference',
        elements: {
          subject: {
            type: 'Reference',
            refers: ['http://hl7.org/fhir/StructureDefinition/Patient'],
          },
        },
      };
      const result = validate(
        {
          resourceType: 'TestReference',
          subject: { reference: 'Patient/123' },
        },
        schema,
        extendedTypes,
      );
      expectNoErrors(result.outcome);
      expect(result.deferred.length).toBe(1);
      expect(result.deferred[0]).toEqual({
        type: 'reference',
        path: 'subject',
        reference: 'Patient/123',
        targetProfiles: ['http://hl7.org/fhir/StructureDefinition/Patient'],
      });
    });

    it('collects multiple deferred validations', () => {
      const extendedTypes = {
        ...typesIndex,
        Reference: {
          url: 'Reference',
          name: 'Reference',
          type: 'Reference',
          kind: 'complex-type',
          class: 'complex-type',
          elements: {
            reference: { type: 'string' },
            display: { type: 'string' },
          },
        },
      };
      const schema: FHIRSchema = {
        url: 'TestMultiDeferred',
        name: 'TestMultiDeferred',
        kind: 'resource',
        type: 'TestMultiDeferred',
        elements: {
          status: {
            type: 'code',
            binding: {
              strength: 'required',
              valueSet: 'http://example.org/ValueSet/status',
            },
          },
          category: {
            type: 'code',
            binding: {
              strength: 'preferred',
              valueSet: 'http://example.org/ValueSet/category',
            },
          },
          subject: {
            type: 'Reference',
            refers: ['http://hl7.org/fhir/StructureDefinition/Patient'],
          },
        },
      };
      const result = validate(
        {
          resourceType: 'TestMultiDeferred',
          status: 'active',
          category: 'lab',
          subject: { reference: 'Patient/123' },
        },
        schema,
        extendedTypes,
      );
      expectNoErrors(result.outcome);
      expect(result.deferred.length).toBe(3);

      const termDeferred = result.deferred.filter((d) => d.type === 'terminology');
      const refDeferred = result.deferred.filter((d) => d.type === 'reference');
      expect(termDeferred.length).toBe(2);
      expect(refDeferred.length).toBe(1);
    });

    it('collects deferred for array elements', () => {
      const schema: FHIRSchema = {
        url: 'TestArrayBinding',
        name: 'TestArrayBinding',
        kind: 'resource',
        type: 'TestArrayBinding',
        elements: {
          codes: {
            type: 'code',
            max: 10,
            binding: {
              strength: 'required',
              valueSet: 'http://example.org/ValueSet/codes',
            },
          },
        },
      };
      const result = validate(
        { resourceType: 'TestArrayBinding', codes: ['code1', 'code2', 'code3'] },
        schema,
        typesIndex,
      );
      expectNoErrors(result.outcome);
      expect(result.deferred.length).toBe(3);
      expect(result.deferred[0].path).toBe('codes[0]');
      expect(result.deferred[1].path).toBe('codes[1]');
      expect(result.deferred[2].path).toBe('codes[2]');
    });
  });
});
