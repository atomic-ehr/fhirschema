export enum FHIRSchemaErrorCode {
  UnknownElement = "FS001",
  UnknownSchema = "FS002",
  ExpectedArray = "FS003",
  UnexpectedArray = "FS004",
  UnknownKeyword = "FS005",
  WrongType = "FS006",
  SlicingUnmatched = "FS007",
  SlicingAmbiguous = "FS008",
  SliceCardinality = "FS009",
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

// Use shared FHIR types to avoid duplication
import type { FHIRSchemaElement, FHIRSchema } from "../types";

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


function matchesPrimitiveType(t: string, data: any): boolean {
  switch (t) {
    case 'string':
      return typeof data === 'string';
    case 'integer':
      return typeof data === 'number' && Number.isInteger(data);
    case 'boolean':
      return typeof data === 'boolean';
    case 'number':
      return typeof data === 'number' && !Number.isNaN(data);
    case 'code':
    case 'url':
      return typeof data === 'string';
    default:
      return false;
  }
}

function validateType(vctx: ValidationContext, rules: string[],  data: any): void {
  // Collect allowed primitive types from all overlays
  const allowed = (rules || []).filter((t) => typeof t === 'string');
  const primitiveAllowed = allowed.filter((t) => PRIMITIVE_TYPES.has(t));
  const hasNonPrimitive = allowed.some((t) => !PRIMITIVE_TYPES.has(t));

  // If there are non-primitive alternatives, defer to structural validation
  if (hasNonPrimitive) return;

  if (primitiveAllowed.length === 0) return;

  // Pass if any allowed primitive type matches
  if (primitiveAllowed.some((t) => matchesPrimitiveType(t, data))) return;

  // Otherwise, report a single WrongType with a concise expectation
  vctx.errors.push({
    code: FHIRSchemaErrorCode.WrongType,
    message: `Expected one of: ${primitiveAllowed.join(', ')}`,
    path: vctx.path,
  });
}

const VALIDATORS: Record<string, (vctx: ValidationContext, rules: any[], data: any) => void> = {
  'type': validateType,
} 

function validateValueRules(vctx: ValidationContext, data: any) {
  let rules: Record<string, any[]> = {};
  let schemas: Record<string, FHIRSchema> = {};
  for (const sch of Object.values(vctx.schemas)) {
    for(const [key, value] of Object.entries(sch)) {
      if(key !== "elements" && key !== "choiceOf" && key !== "choices" && key !== "base" && key !== "isArray" && key !== "slicing") {
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
    // In shared types, base is a top-level field on FHIRSchema
    let base = (sch as any).base as string | undefined;
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


// Primitive types are derived from available TYPE_VALIDATORS to avoid drift
const PRIMITIVE_TYPES: Set<string> = new Set(Object.keys(TYPE_VALIDATORS));

function getElementSchemas(
  vctx: ValidationContext,
  key: string,
): Record<string, FHIRSchema> | false {
  let schemas: Record<string, FHIRSchema> | false = false;
  for (const [schemaPath, s] of Object.entries(vctx.schemas)) {
    let elSch = (s as any).elements && (s as any).elements[key] as FHIRSchemaElement | undefined;
    if (elSch) {
      if (!schemas) {
        schemas = {} as Record<string, FHIRSchema>;
      }
      schemas[`${schemaPath}.${key}`] = elSch;
      if ( elSch.type !== undefined && !PRIMITIVE_TYPES.has(elSch.type)) {
        addSchemaToSet(vctx, schemas, elSch.type);
      }
    }
  }
  return schemas;
}

function isElementArray(vctx: ValidationContext) {
  for (const sch of Object.values(vctx.schemas)) {
    // Support both legacy 'isArray' and shared 'array' flags
    if ((sch as any).isArray || (sch as any).array) {
      return true;
    }
  }
  return false;
}

function mergeSlicing(vctx: ValidationContext): FHIRSchemaElement['slicing'] | undefined {
  let merged: FHIRSchemaElement['slicing'] | undefined = undefined;
  for (const sch of Object.values(vctx.schemas)) {
    const el = sch as FHIRSchemaElement;
    if (el.slicing) {
      if (!merged) {
        merged = { discriminator: (el.slicing as any).discriminator, rules: (el.slicing as any).rules as any, ordered: (el.slicing as any).ordered, slices: {} } as any;
      }
      if ((el.slicing as any).slices) {
        (merged as any).slices ||= {};
        for (const [name, slice] of Object.entries((el.slicing as any).slices)) {
          merged.slices![name] = {
            ...(merged.slices![name] || {}),
            ...slice,
          } as any;
        }
      }
    }
  }
  return merged;
}

function deepPartialMatch(value: any, pattern: any): boolean {
  if (pattern === undefined) return true;
  if (Array.isArray(pattern)) {
    if (!Array.isArray(value)) return false;
    return pattern.every((p) => value.some((v) => deepPartialMatch(v, p)));
  }
  if (isObject(pattern)) {
    if (!isObject(value)) return false;
    for (const [k, v] of Object.entries(pattern)) {
      if (!deepPartialMatch((value as any)[k], v)) return false;
    }
    return true;
  }
  return value === pattern;
}

function classifySlice(slicing: NonNullable<FHIRSchemaElement['slicing']>, item: any): { slice?: string; error?: 'unmatched' | 'ambiguous' } {
  const matches: string[] = [];
  const slices = (slicing as any).slices || {};
  for (const [name, slice] of Object.entries(slices)) {
    const m = (slice as any).match;
    if (m === undefined || (isObject(m) && Object.keys(m).length === 0)) {
      matches.push(name);
      continue;
    }
    if (deepPartialMatch(item, m)) {
      matches.push(name);
    }
  }
  if (matches.length === 0) {
    return { error: 'unmatched' };
  }
  if (matches.length > 1) {
    return { error: 'ambiguous' };
  }
  return { slice: matches[0] };
}

function overlaySchema(base: FHIRSchemaElement, overlay?: FHIRSchemaElement): FHIRSchemaElement {
  if (!overlay) return base;
  const merged: FHIRSchemaElement = { ...base, ...overlay } as any;
  if (base.elements || overlay.elements) {
    merged.elements = { ...(base.elements || {}), ...(overlay.elements || {}) };
  }
  return merged;
}

function buildItemSchemasForSlice(vctx: ValidationContext, sliceSchema?: FHIRSchemaElement): Record<string, FHIRSchema> {
  const out: Record<string, FHIRSchema> = {};
  for (const [k, sch] of Object.entries(vctx.schemas)) {
    const el = sch as FHIRSchemaElement;
    const merged = overlaySchema(el, sliceSchema);
    out[k] = merged as FHIRSchema;
  }
  return out;
}


function validateElement(vctx: ValidationContext, data: any, primitiveExtension: any) {
 if(isElementArray(vctx)) {
  if(Array.isArray(data)) {
    const slicing = mergeSlicing(vctx);
    const sliceCounts: Record<string, number> = {};
    for (let i = 0; i < data.length; i++) {
      let item = data[i]
      let prevPath = vctx.path;
      vctx.path = `${vctx.path}.${i}`;
      if (slicing && slicing.slices && Object.keys((slicing as any).slices).length > 0) {
        const cls = classifySlice(slicing, item);
        if (cls.error === 'ambiguous') {
          vctx.errors.push({
            code: FHIRSchemaErrorCode.SlicingAmbiguous,
            message: 'Item matches multiple slices',
            path: vctx.path,
          });
        } else if (cls.error === 'unmatched') {
          const rules = (slicing as any).rules || 'open';
          if (rules === 'closed') {
            vctx.errors.push({
              code: FHIRSchemaErrorCode.SlicingUnmatched,
              message: 'Item does not match any slice and slicing is closed',
              path: vctx.path,
            });
          } else {
            validateInternal(vctx, item);
          }
        } else if (cls.slice) {
          sliceCounts[cls.slice] = (sliceCounts[cls.slice] || 0) + 1;
          const prevSchemas = vctx.schemas;
          const itemSchemas = buildItemSchemasForSlice(vctx, ((slicing as any).slices as any)[cls.slice]?.schema as FHIRSchemaElement);
          vctx.schemas = itemSchemas;
          validateInternal(vctx, item);
          vctx.schemas = prevSchemas;
        }
      } else {
        // No slicing configured
        validateInternal(vctx, item);
      }
      vctx.path = prevPath;
    }
    if (slicing && (slicing as any).slices) {
      for (const [name, slice] of Object.entries((slicing as any).slices)) {
        const count = (sliceCounts as any)[name] || 0;
        if ((slice as any).min !== undefined && count < (slice as any).min) {
          vctx.errors.push({
            code: FHIRSchemaErrorCode.SliceCardinality,
            message: `Slice ${name}: expected min=${(slice as any).min} got ${count}`,
            path: vctx.path,
          });
        }
        if ((slice as any).max !== undefined && count > (slice as any).max) {
          vctx.errors.push({
            code: FHIRSchemaErrorCode.SliceCardinality,
            message: `Slice ${name}: expected max=${(slice as any).max} got ${count}`,
            path: vctx.path,
          });
        }
      }
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
        primitiveExtension = (data as any)[`_${key}`] || null;
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

