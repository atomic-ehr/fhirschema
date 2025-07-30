import { describe, it, expect } from 'bun:test';
import { validate, validateSchemas } from '../../src/validator';
import type { ValidationContext, FHIRSchema, ValidationResult } from '../../src/validator/types';

// Test context with schema definitions
const ctx: ValidationContext = {
  schemas: {
    "HumanName": {
      elements: {
        family: { type: "string" },
        given: { array: true, type: "string" },
        use: { type: "Coding" }
      }
    },
    "Extension": {
      elements: {
        id: { type: "code" },
        url: { type: "url" },
        valueString: { type: "string" },
        valueCode: { type: "code" }
      }
    },
    "Patient": {
      base: "Resource",
      elements: {
        name: { array: true, type: "HumanName" }
      }
    },
    "Coding": {
      elements: {
        code: { type: "string" },
        system: { type: "string" }
      }
    },
    "Resource": {
      elements: {
        resourceType: { type: "code" },
        id: { type: "string" }
      }
    },
    "boolean": { kind: "primitive-type", type: "boolean" },
    "code": { kind: "primitive-type", type: "string" },
    "url": { kind: "primitive-type", type: "string" },
    "string": { kind: "primitive-type", type: "string" }
  }
};

// Helper function to match errors
function matchErrors(data: any, expectedErrors: any[] = []): ValidationResult {
  const result = validate(ctx, [], data);
  if (expectedErrors.length === 0) {
    expect(result.errors).toEqual([]);
  } else {
    expect(result.errors).toMatchObject(expectedErrors);
  }
  return result;
}

// Helper function to match schema validation
function matchSchema(schema: FHIRSchema, data: any, expectedErrors: any[] = []): ValidationResult {
  const result = validateSchemas(ctx, new Set([schema]), data);
  if (expectedErrors.length === 0) {
    expect(result.errors).toEqual([]);
  } else {
    expect(result.errors).toMatchObject(expectedErrors);
  }
  return result;
}

describe('Schema Validation Tests', () => {
  describe('Basic type validation', () => {
    it('should validate string type', () => {
      matchSchema({ type: "string" }, "string", []);
    });

    it('should fail on wrong type (number instead of string)', () => {
      matchSchema({ type: "string" }, 1, [{ type: 'type', path: [] }]);
    });

    it('should fail on wrong type (boolean instead of string)', () => {
      matchSchema({ type: "string" }, true, [{ type: 'type', path: [] }]);
    });
  });

  describe('Element validation', () => {
    it('should validate simple element', () => {
      matchSchema({ elements: { name: { type: "string" } } }, { name: "ok" }, []);
    });

    it('should fail on unknown element', () => {
      matchSchema(
        { elements: { name: { type: "string" } } },
        { unknown: "ups" },
        [{ type: 'element/unknown', path: ['unknown'] }]
      );
    });

    it('should validate nested elements', () => {
      matchSchema(
        { elements: { name: { elements: { family: { type: "string" } } } } },
        { name: { family: "family" } },
        []
      );
    });

    it('should fail on unknown nested element', () => {
      matchSchema(
        { elements: { name: { elements: { family: { type: "string" } } } } },
        { name: { unknown: "ups" } },
        [{ type: 'element/unknown', path: ['name', 'unknown'] }]
      );
    });
  });

  describe('Array validation', () => {
    it('should validate array elements', () => {
      matchSchema(
        { elements: { name: { array: true, elements: { family: { type: "string" } } } } },
        { name: [{ family: "family" }] },
        []
      );
    });

    it('should fail when array expected but object provided', () => {
      matchSchema(
        { elements: { name: { array: true, elements: { family: { type: "string" } } } } },
        { name: { family: "family" } },
        [{ 
          type: 'type/array', 
          message: 'Expected array', 
          path: ['name'], 
          value: { family: "family" },
          'schema-path': ['name', 'array']
        }]
      );
    });

    it('should fail on unknown element in array', () => {
      matchSchema(
        { elements: { name: { array: true, elements: { family: { type: "string" } } } } },
        { name: [{ family: "family", ups: "x" }] },
        [{ type: 'element/unknown', path: ['name', 0, 'ups'] }]
      );
    });

    it('should validate complex nested array elements', () => {
      matchSchema(
        { 
          elements: { 
            name: { 
              array: true, 
              elements: { 
                family: { type: "string" },
                type: { elements: { code: { type: "string" } } }
              } 
            } 
          } 
        },
        { name: [{ family: "family", type: { code: "ok" } }] },
        []
      );
    });

    it('should fail on type mismatch in nested array element', () => {
      matchSchema(
        { 
          elements: { 
            name: { 
              array: true, 
              elements: { 
                family: { type: "string" },
                type: { elements: { code: { type: "string" } } }
              } 
            } 
          } 
        },
        { name: [{ family: "family", type: { code: 1 } }] },
        [{
          type: 'type',
          message: 'Expected type string',
          value: 1,
          'schema-path': ['name', 'type', 'code', 'type', 'string', 'type'],
          path: ['name', 0, 'type', 'code']
        }]
      );
    });
  });

  describe('Type reference validation', () => {
    it('should validate referenced type', () => {
      matchSchema(
        { elements: { name: { array: true, type: "HumanName" } } },
        { name: [{ family: "f", given: ["g1", "g2"] }] },
        []
      );
    });

    it('should fail on type mismatch in referenced type', () => {
      matchSchema(
        { elements: { name: { array: true, type: "HumanName" } } },
        { name: [{ family: 1 }] },
        [{
          type: 'type',
          message: 'Expected type string',
          value: 1,
          'schema-path': ['name', 'type', 'HumanName', 'family', 'type', 'string', 'type'],
          path: ['name', 0, 'family']
        }]
      );
    });
  });

  describe('Choice validation', () => {
    it('should fail when multiple choice elements provided', () => {
      matchSchema(
        {
          choices: { value: ["valueString", "valueCode"] },
          elements: {
            label: { type: "string" },
            valueString: { type: "string", choiceOf: "value" },
            valueCode: { type: "code", choiceOf: "value" }
          }
        },
        { valueString: "a", valueCode: "c", label: "x" },
        [{
          type: 'choices/multiple',
          path: ['value'],
          message: 'Only one choice element is allowd',
          value: { valueString: "a", valueCode: "c" }
        }]
      );
    });

    it('should fail when excluded choice element provided', () => {
      matchSchema(
        {
          choices: { value: ["valueString"] },
          elements: {
            label: { type: "string" },
            valueString: { type: "string", choiceOf: "value" },
            valueCode: { type: "code", choiceOf: "value" }
          }
        },
        { valueCode: "c", label: "x" },
        [{
          type: 'choice/excluded',
          message: 'Choice element value is not allowed, only valueString',
          path: ['value'],
          'schema-path': ['choices']
        }]
      );
    });
  });

  describe('Required fields validation', () => {
    it('should validate required field present', () => {
      matchSchema(
        { required: ["name"], elements: { name: { type: "string" } } },
        { name: "john" },
        []
      );
    });

    it('should validate required field with primitive extension', () => {
      matchSchema(
        { required: ["name"], elements: { name: { type: "string" } } },
        { _name: { extension: [{ url: "ext", valueString: "ok" }] } },
        []
      );
    });

    it('should fail when required field missing', () => {
      matchSchema(
        { required: ["name"], elements: { name: { type: "string" } } },
        {},
        [{ type: 'require', path: ['name'] }]
      );
    });
  });

  describe('Cardinality validation', () => {
    it('should fail on min cardinality violation', () => {
      matchSchema(
        { elements: { name: { array: true, type: "string", min: 1, max: 2 } } },
        { name: [] },
        [{
          type: 'min',
          message: 'expected min=1 got 0',
          value: 0,
          expected: 1,
          path: ['name']
        }]
      );
    });

    it('should fail on max cardinality violation', () => {
      matchSchema(
        { elements: { name: { array: true, type: "string", min: 1, max: 2 } } },
        { name: ["a", "b", "c"] },
        [{
          type: 'max',
          message: 'expected max=2 got 3',
          value: 3,
          expected: 2,
          path: ['name']
        }]
      );
    });
  });

  describe('Pattern validation', () => {
    it('should validate pattern match', () => {
      matchSchema(
        { elements: { name: { elements: { use: { type: "string", pattern: { string: "home" } } } } } },
        { name: { use: "home" } },
        []
      );
    });

    it('should fail on pattern mismatch', () => {
      matchSchema(
        { elements: { name: { elements: { use: { type: "string", pattern: { string: "home" } } } } } },
        { name: { use: "hotel" } },
        [{
          type: 'pattern',
          expected: 'home',
          'schema-path': ['name', 'use', 'pattern'],
          got: 'hotel',
          path: ['name', 'use']
        }]
      );
    });
  });

  describe('Complex resource validation', () => {
    it('should validate Patient resource', () => {
      matchSchema(
        {
          base: "Resource",
          elements: {
            resourceType: { type: "code" },
            name: { array: true, type: "HumanName" },
            active: { type: "boolean" },
            extension: { array: true, type: "Extension" }
          }
        },
        {
          resourceType: "Patient",
          name: [
            { family: "Smith", given: ["John", "Jacob"], use: "official" },
            { family: "Smith", given: ["Johnny"], use: "nickname" }
          ],
          active: true,
          extension: [{
            url: "http://example.org/fhir/StructureDefinition/preferred-contact-method",
            valueString: "email"
          }]
        },
        []
      );
    });

    it('should validate nested extensions', () => {
      matchSchema(
        {
          elements: {
            extension: {
              array: true,
              type: "Extension",
              elements: {
                extension: { array: true, type: "Extension" }
              }
            }
          }
        },
        {
          extension: [{
            url: "http://example.org/parent",
            extension: [{
              url: "http://example.org/child",
              valueString: "nested value"
            }]
          }]
        },
        []
      );
    });
  });
});

describe('Primitive Type Extensions Quirks', () => {
  it('should validate basic primitive', () => {
    matchSchema(
      { required: ["gender"], elements: { gender: { type: "string" } } },
      { gender: "male" },
      []
    );
  });

  it('should pass required check with primitive extension', () => {
    matchSchema(
      { required: ["gender"], elements: { gender: { type: "string" } } },
      { _gender: { extension: [{ url: "data-absent-reason", valueCode: "asked-unknown" }] } },
      []
    );
  });

  describe('null alignment in primitive extensions', () => {
    it('should validate aligned primitive extensions', () => {
      matchSchema(
        { elements: { code: { array: true, type: "string" } } },
        {
          code: ["au", "nz"],
          _code: [
            null,
            {
              extension: [{
                url: "http://hl7.org/fhir/StructureDefinition/display",
                valueString: "New Zealand a.k.a Kiwiland"
              }]
            }
          ]
        },
        []
      );
    });

    it('should validate with data-absent-reason', () => {
      matchSchema(
        { elements: { code: { array: true, type: "string" } } },
        {
          code: [null, "nz"],
          _code: [
            { extension: [{ url: "data-absent-reason", valueCode: "error" }] },
            {
              extension: [{
                url: "http://hl7.org/fhir/StructureDefinition/display",
                valueString: "New Zealand a.k.a Kiwiland"
              }]
            }
          ]
        },
        []
      );
    });

    it('should fail when all primitive sub-parts are nulled', () => {
      matchSchema(
        { elements: { code: { type: "string" } } },
        { code: ["au", "nz"], _code: [null, null] },
        [{}] // Expected error about shape mismatch
      );
    });

    it('should fail when both value and extension are null', () => {
      matchSchema(
        { elements: { code: { type: "string" } } },
        { code: [null, null], _code: [null, null] },
        [{
          type: 'type/array',
          message: 'Expected not array',
          path: ['code'],
          value: [null, null]
        }]
      );
    });
  });
});

describe('Primitive Types', () => {
  it('should validate string type', () => {
    matchSchema(
      { elements: { gender: { type: "string" } } },
      { gender: "male" },
      []
    );
  });

  it('should fail on basic type mismatch', () => {
    matchSchema(
      { elements: { gender: { type: "string" } } },
      { gender: 1 },
      [{
        type: 'type',
        message: 'Expected type string',
        value: 1,
        'schema-path': ['gender', 'type', 'string', 'type'],
        path: ['gender']
      }]
    );
  });

  describe('array/non-array shape mismatch', () => {
    it('should fail when non-array expected but array provided', () => {
      matchSchema(
        { elements: { gender: { type: "string" } } },
        { gender: ["male"] },
        [{
          type: 'type/array',
          message: 'Expected not array',
          path: ['gender'],
          value: ["male"]
        }]
      );
    });

    it('should fail when array expected but non-array provided', () => {
      matchSchema(
        { elements: { value: { type: "string", array: true } } },
        { value: "male" },
        [{
          type: 'type/array',
          message: 'Expected array',
          path: ['value'],
          value: "male",
          'schema-path': ['value', 'array']
        }]
      );
    });
  });

  it('should fail when object provided instead of primitive', () => {
    matchSchema(
      { elements: { gender: { type: "string" } } },
      { gender: { value: "male" } },
      [
        {
          type: 'type',
          message: 'Expected type string',
          value: { value: "male" },
          'schema-path': ['gender', 'type', 'string', 'type'],
          path: ['gender']
        },
        { type: 'element/unknown', path: ['gender', 'value'] }
      ]
    );
  });
});