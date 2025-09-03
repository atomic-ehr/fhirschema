import { describe, it, expect } from "bun:test";
import { AtomicContext, validateSchema,  FHIRSchemaErrorCode } from "../../src/validator/validator";
import type { FHIRSchema } from "../../src/validator/validator";

const schemas: Record<string, FHIRSchema> = {
  "Simple": {
    elements: {
      a: { type: "integer" },
      b: { type: "integer" },
      c: { elements: { d: { type: "integer" } } },
    },
  },
  "WithArray": {
    elements: {
      a: { type: "integer", isArray: true },
      b: { type: "integer" },
    },
  },
  "Base": {
    elements: {
      id: { type: "string" },
    },
  },
  "Child": {
    base: "Base",
    elements: {
      name: { type: "string" },
    },
  },
  "ChoiceTypes": {
    elements: {
      value: { choices: ["valueString", "valueInteger"] },
      valueString: { choiceOf: "value" },
      valueInteger: { choiceOf: "value" },
    },
  },
  "SchemaA": {
    elements: {
      a: { type: "integer" },
    },
  },
  "SchemaB": {
    base: "SchemaA",
    elements: {
      b: { type: "string" },
    },
  },
};

let ctx: AtomicContext = {
  resolveSchema: resolveSchema,
};

function resolveSchema(ctx: AtomicContext, url: string) {
  // console.log(`Resolve schema: ${url}`);
  return schemas[url];
}

describe("validator", () => {
  it("test basic navigation", () => {
    let res0 = validateSchema(ctx, {
      schemaUrls: [],
      resource: { resourceType: "Simple", a: 1, b: 2},
    });
    expect(res0.errors).toEqual([]);

    let res1 = validateSchema(ctx, {
      schemaUrls: ["Simple"],
      resource: { a: 1, b: 2},
    });
    expect(res1.errors).toEqual([]);

    let res2 = validateSchema(ctx, {
      schemaUrls: [],
      resource: { resourceType: "Simple", ups: 'ups' },
    });
    expect(res2.errors).toMatchObject([ { code: FHIRSchemaErrorCode.UnknownElement, path: 'Simple.ups' } ]);

    let res3 = validateSchema(ctx, {
      schemaUrls: [],
      resource: { resourceType: "Ups" },
    });
    expect(res3.errors).toMatchObject([ { code: FHIRSchemaErrorCode.UnknownSchema, path: 'Ups.resourceType' } ]);
  });

  it("test array", () => {
    let res0 = validateSchema(ctx, {
      schemaUrls: [],
      resource: { resourceType: "WithArray", a: [1, 2, 3] },
    });
    expect(res0.errors).toEqual([]);

    let res1 = validateSchema(ctx, {
      schemaUrls: [],
      resource: { resourceType: "WithArray", a: 1 },
    });
    expect(res1.errors).toMatchObject([{code: FHIRSchemaErrorCode.ExpectedArray, path: 'WithArray.a'}]);

    let res2 = validateSchema(ctx, {
      schemaUrls: [],
      resource: { resourceType: "WithArray", b: [1, 2, 3] },
    });
    expect(res2.errors).toMatchObject([{code: FHIRSchemaErrorCode.UnexpectedArray, path: 'WithArray.b'}]);
  });

  it("test nested elements", () => {
    let res0 = validateSchema(ctx, {
      schemaUrls: [],
      resource: { resourceType: "Simple", a: 1, b: 2, c: { ups: 3 } },
    });
    expect(res0.errors).toMatchObject([ { code: FHIRSchemaErrorCode.UnknownElement, path: 'Simple.c.ups' } ]);

    let res1 = validateSchema(ctx, {
      schemaUrls: ["Simple"],
      resource: { a: 1, b: 2, c: { d: 3 } },
    });

    expect(res1.errors).toEqual([]);
  });

  it("test inheritance", () => {
    let res0 = validateSchema(ctx, {
      schemaUrls: [],
      resource: { resourceType: "Child", id: "1", name: "John" },
    });
    expect(res0.errors).toEqual([]);
  });

  it("multiple schemas", () => {
    let res0 = validateSchema(ctx, {
      schemaUrls: ["SchemaA", "SchemaB"],
      resource: { a: 1, b: "string" },
    });
    expect(res0.errors).toEqual([]);

    let res1 = validateSchema(ctx, {
      schemaUrls: ["SchemaA", "SchemaB"],
      resource: { ups: "Ups" },
    });
    expect(res1.errors).toMatchObject([{code: FHIRSchemaErrorCode.UnknownElement, path: '.ups'}]);
  });

});
