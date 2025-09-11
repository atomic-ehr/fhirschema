export enum FHIRSchemaErrorCode {
  UnknownElement = "FS001",
  UnknownSchema = "FS002",
  ExpectedArray = "FS003",
  UnexpectedArray = "FS004",
  UnknownKeyword = "FS005",
  WrongType = "FS006",
}

export interface AtomicContext {
  resolveSchema(ctx: AtomicContext, url: string): FHIRSchema;
}

export interface ValidationOptions {
  schemaUrls: string[];
  resource: any;
}

export interface ValidationError {
  code?: string;
  message?: string;
  schemaPath?: string;
  path?: string;
}

export interface FHIRschemaElement {
  type?: string;
  isArray?: boolean;
  elements?: Record<string, FHIRschemaElement>;
  choices?: string[];
  choiceOf?: string;
}

export interface FHIRSchemaBase {
  base?: string;
  type?: string;
  isArray?: boolean;
  elements?: Record<string, FHIRschemaElement>;
  choices?: Record<string, string[]>;
}

export type FHIRSchema = FHIRSchemaBase | FHIRschemaElement;

export interface ValidationContext {
  schemas: Record<string, FHIRSchema>;
  path: string;
  errors: ValidationError[];
  ctx: AtomicContext;
}

export interface ValidationResult {
  errors: ValidationError[];
}

export interface SchemaResolver {
  resolve(url: string): FHIRSchema;
}

function createContext(
  ctx: AtomicContext,
  opts: ValidationOptions,
): ValidationContext {
  let vctx: ValidationContext = {
    path: opts?.resource?.resourceType,
    schemas: {},
    errors: [],
    ctx: ctx,
  };
  return vctx;
}

function isObject(data: any): boolean {
  return typeof data === "object" && data !== null && !Array.isArray(data);
}

const TYPE_VALIDATORS: Record<string, (vctx: ValidationContext, rules: any[], data: any) => void> = {
  'string': (vctx: ValidationContext, _rules: any[], data: any) => {
    if (typeof data !== 'string') {
      vctx.errors.push({
        code: FHIRSchemaErrorCode.WrongType,
        message: 'Expected string',
        path: vctx.path,
      });
    }
  },
  'integer': (vctx: ValidationContext, _rules: any[], data: any) => {
    if (!(typeof data === 'number' && Number.isInteger(data))) {
      vctx.errors.push({
        code: FHIRSchemaErrorCode.WrongType,
        message: 'Expected integer',
        path: vctx.path,
      });
    }
  },
  'boolean': (vctx: ValidationContext, _rules: any[], data: any) => {
    if (typeof data !== 'boolean') {
      vctx.errors.push({
        code: FHIRSchemaErrorCode.WrongType,
        message: 'Expected boolean',
        path: vctx.path,
      });
    }
  },
  'number': (vctx: ValidationContext, _rules: any[], data: any) => {
    if (typeof data !== 'number' || Number.isNaN(data)) {
      vctx.errors.push({
        code: FHIRSchemaErrorCode.WrongType,
        message: 'Expected number',
        path: vctx.path,
      });
    }
  },
  'code': (vctx: ValidationContext, _rules: any[], data: any) => {
    if (typeof data !== 'string') {
      vctx.errors.push({
        code: FHIRSchemaErrorCode.WrongType,
        message: 'Expected code (string)',
        path: vctx.path,
      });
    }
  },
  'url': (vctx: ValidationContext, _rules: any[], data: any) => {
    if (typeof data !== 'string') {
      vctx.errors.push({
        code: FHIRSchemaErrorCode.WrongType,
        message: 'Expected url (string)',
        path: vctx.path,
      });
    }
  },
}


function validateType(vctx: ValidationContext, rules: string[],  data: any): void {
  let validator = TYPE_VALIDATORS[rules[0]];
  if(validator) {
    validator(vctx, rules, data);
  }
}

const VALIDATORS: Record<string, (vctx: ValidationContext, rules: any[], data: any) => void> = {
  'type': validateType,
} 

function validateValueRules(vctx: ValidationContext, data: any) {
  let rules: Record<string, any[]> = {};
  let schemas: Record<string, FHIRSchema> = {};
  for (const sch of Object.values(vctx.schemas)) {
    for(const [key, value] of Object.entries(sch)) {
      if(key !== "elements" && key !== "choiceOf" && key !== "choices" && key !== "base" && key !== "isArray") {
        rules[key] ||= [];
        schemas[key] ||= {} as FHIRSchema;
        rules[key].push(value);
        schemas[key] = sch;
      }
    }
  }
  for(const [ruleName, item] of Object.entries(rules)) {
    let validator = VALIDATORS[ruleName];
    if(validator) {
      validator(vctx, item, data);
    } else {
      vctx.errors.push({
        code: FHIRSchemaErrorCode.UnknownKeyword,
        message: `Validator ${ruleName} not found`,
        path: vctx.path,
      });
    }
  }
}

function addSchemaToSet(vctx: ValidationContext, schemas: Record<string, FHIRSchema>, url: string) {
  if(schemas[url]) { return; }
  let sch = vctx.ctx.resolveSchema(vctx.ctx, url);
  if (sch && schemas) {
    schemas[url] = sch;
    let base = (sch as FHIRSchemaBase).base;
    if (base !== undefined) {
      addSchemaToSet(vctx, schemas, base);
    }
  } else {
    vctx.errors.push({
      code: FHIRSchemaErrorCode.UnknownSchema,
      message: `Schema ${url} not found`,
      path: vctx.path,
    });
  }
}


// TODO: i'm not sure about this map
const PRIMITIVE_TYPES = {
  "string": true,
  "integer": true,
  "boolean": true,
  "number": true,
  "code": true,
  "url": true,
};

function getElementSchemas(
  vctx: ValidationContext,
  key: string,
): Record<string, FHIRSchema> | false {
  let schemas: Record<string, FHIRSchema> | false = false;
  for (const [schemaPath, s] of Object.entries(vctx.schemas)) {
    let elSch = s.elements && s.elements[key];
    if (elSch) {
      if (!schemas) {
        schemas = {} as Record<string, FHIRSchema>;
      }
      schemas[`${schemaPath}.${key}`] = elSch;
      if ( elSch.type !== undefined && !PRIMITIVE_TYPES[elSch.type as keyof typeof PRIMITIVE_TYPES]) {
        addSchemaToSet(vctx, schemas, elSch.type);
      }
    }
  }
  return schemas;
}

function isElementArray(vctx: ValidationContext) {
  for (const sch of Object.values(vctx.schemas)) {
    if (sch.isArray) {
      return true;
    }
  }
  return false;
}


function validateElement(vctx: ValidationContext, data: any, primitiveExtension: any) {
 if(isElementArray(vctx)) {
  if(Array.isArray(data)) {
    for (let i = 0; i < data.length; i++) {
      let item = data[i]
      let prevPath = vctx.path;
      vctx.path = `${vctx.path}.${i}`;
      validateInternal(vctx, item);
      vctx.path = prevPath;
    }
  } else {
    vctx.errors.push({
      code: FHIRSchemaErrorCode.ExpectedArray,
      message: 'Expected array',
      path: vctx.path
    })
  }
 } else {
  if(Array.isArray(data)) {
    vctx.errors.push({
      code: FHIRSchemaErrorCode.UnexpectedArray,
      message: 'Unexpected array',
      path: vctx.path
    })
  } else {
    if (data === null && primitiveExtension) {
      return;
    }
    validateInternal(vctx, data);
  }
 }
}

function validateInternal(vctx: ValidationContext, data: any) {
  validateValueRules(vctx, data);
  if (isObject(data)) {
    for (let [key, value] of Object.entries(data)) {
      let primitiveExtension = null;
      if (key == "resourceType") continue;
      if(key.startsWith("_")) {
        let normKey = key.substring(1);
        // will be handled by next with normal element key
        if(data[normKey] !== undefined) {
          continue;
        } else {
          key = normKey;
          primitiveExtension = value;
          value = null;
        }
      } else {
        primitiveExtension = data[`_${key}`] || null;
      }
      let elSchemas = getElementSchemas(vctx, key);
      if (elSchemas) {
        // save the current schema set and path
        let prevSchemas = vctx.schemas;
        let prevPath = vctx.path;
        vctx.path = `${vctx.path}.${key}`;
        vctx.schemas = elSchemas;
        validateElement(vctx, value, primitiveExtension);
        // restore the previous schema set and path
        vctx.schemas = prevSchemas;
        vctx.path = prevPath;
      } else {
        vctx.errors.push({
          code: FHIRSchemaErrorCode.UnknownElement,
          message: `Element ${key} is unknown`,
          path: `${vctx.path}.${key}`,
        });
      }
    }
  }
}

export function validateSchema(ctx: AtomicContext, opts: ValidationOptions) {
  let vctx = createContext(ctx, opts);
  for (const s of opts.schemaUrls) {
    addSchemaToSet(vctx, vctx.schemas, s);
  }
  if (opts.resource?.resourceType !== undefined) {
    let prevPath = vctx.path;
    vctx.path = `${vctx.path}.resourceType`;
    addSchemaToSet(vctx, vctx.schemas, opts.resource?.resourceType);
    vctx.path = prevPath;
  } else {
    vctx.path = "";
  }
  validateInternal(vctx, opts.resource);
  let vres: ValidationResult = {
    errors: vctx.errors,
  };
  return vres;
}
