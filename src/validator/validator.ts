export enum FHIRSchemaErrorCode {
  UnknownElement = "FS001",
  UnknownSchema = "FS002",
  ExpectedArray = "FS003",
  UnexpectedArray = "FS004",
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

export interface FHIRSchema {
  base?: string;
  type?: string;
  isArray?: boolean;
  elements?: Record<string, FHIRschemaElement>;
  choices?: Record<string, string[]>;
}

export interface ValidationContext {
  path: string;
  schemaSet: Set<FHIRSchema>;
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
    schemaSet: new Set(),
    errors: [],
    ctx: ctx,
  };
  return vctx;
}

function isObject(data: any): boolean {
  return typeof data === "object" && data !== null && !Array.isArray(data);
}

function validateValueRules(vctx: ValidationContext, data: any) {}

function addSchema(vctx: ValidationContext, url: string) {
  let sch = vctx.ctx.resolveSchema(vctx.ctx, url);
  if (sch) {
    vctx.schemaSet.add(sch);
    if (sch.base !== undefined) {
      addSchema(vctx, sch.base);
    }
  } else {
    vctx.errors.push({
      code: FHIRSchemaErrorCode.UnknownSchema,
      message: `Schema ${url} not found`,
      path: vctx.path,
    });
  }
}
function addSchemas(vctx: ValidationContext, data: any) {}

function getElementSchemas(
  vctx: ValidationContext,
  key: string,
): Set<FHIRSchema> | false {
  let schemas: Set<FHIRSchema> | false = false;
  for (const s of vctx.schemaSet) {
    let elSch = s.elements && s.elements[key];
    if (elSch) {
      if (!schemas) {
        schemas = new Set();
      }
      schemas.add(elSch);
    }
  }
  return schemas;
}

function addError(vctx: ValidationContext, key: string, code: string) {
  vctx.errors.push({
    code: code,
    path: `${vctx.path}.${key}`,
  } as ValidationError);
}


function isElementArray(vctx: ValidationContext) {
  for (const sch of vctx.schemaSet) {
    if (sch.isArray) {
      return true;
    }
    return false
  }
}


function validateElement(vctx: ValidationContext, data: any) {
 if(isElementArray(vctx)) {
  if(Array.isArray(data)) {
    for (let i = 0; i++; i < data.length) {
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
    validateInternal(vctx, data);
  }
 }
}

function validateInternal(vctx: ValidationContext, data: any) {
  addSchemas(vctx, data);
  validateValueRules(vctx, data);
  if (isObject(data)) {
    for (const [key, value] of Object.entries(data)) {
      if (key == "resourceType") continue;
      let elSchemas = getElementSchemas(vctx, key);
      if (elSchemas) {
        // save the current schema set and path
        let prevSchemas = vctx.schemaSet;
        let prevPath = vctx.path;
        vctx.path = `${vctx.path}.${key}`;
        vctx.schemaSet = elSchemas;
        validateElement(vctx, value);
        // restore the previous schema set and path
        vctx.schemaSet = prevSchemas;
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
    addSchema(vctx, s);
  }
  if (opts.resource?.resourceType !== undefined) {
    let prevPath = vctx.path;
    vctx.path = `${vctx.path}.resourceType`;
    addSchema(vctx, opts.resource?.resourceType);
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
