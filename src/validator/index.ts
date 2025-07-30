import type { ValidationContext, FHIRSchema, ValidationResult, ValidationError } from './types';

export function validate(
  ctx: ValidationContext, 
  path: (string | number)[], 
  data: any
): ValidationResult {
  // TODO: Implement validation logic
  return {
    errors: [],
    valid: true
  };
}

export function validateSchemas(
  ctx: ValidationContext,
  schemas: Set<FHIRSchema>,
  data: any
): ValidationResult {
  // TODO: Implement schema validation logic
  const errors: ValidationError[] = [];
  
  // For now, just validate against the first schema
  const schema = schemas.values().next().value;
  if (!schema) {
    return { errors: [], valid: true };
  }
  
  // Set current data for context
  currentData = data;
  
  // Basic implementation for tests
  const result = validateSchema(ctx, schema, data, []);
  
  return {
    errors: result.errors,
    valid: result.errors.length === 0
  };
}

function validateSchema(
  ctx: ValidationContext,
  schema: FHIRSchema,
  data: any,
  path: (string | number)[]
): { errors: ValidationError[] } {
  const errors: ValidationError[] = [];
  
  // Get merged elements if this schema has both type and elements
  let mergedElements = schema.elements || {};
  if (schema.type && schema.elements) {
    const typeSchema = ctx.schemas[schema.type];
    if (typeSchema && typeSchema.kind !== 'primitive-type' && typeSchema.elements) {
      // Merge type elements with schema elements (schema elements override)
      mergedElements = { ...typeSchema.elements, ...schema.elements };
    }
  }
  
  // Type validation
  if (schema.type) {
    const typeErrors: ValidationError[] = [];
    const isValid = validateType(ctx, schema.type, data, path, schema, typeErrors);
    
    if (!isValid) {
      // If it's a referenced type, use the errors from nested validation
      if (typeErrors.length > 0) {
        errors.push(...typeErrors);
      } else {
        // Otherwise, create a generic type error
        errors.push({
          type: 'type',
          path,
          message: `Expected type ${schema.type}`,
          value: data,
          'schema-path': [...path.filter(p => typeof p === 'string'), 'type', schema.type, 'type']
        });
      }
    }
  }
  
  // Elements validation
  const hasElements = mergedElements && Object.keys(mergedElements).length > 0;
  if (hasElements && typeof data === 'object' && data !== null && !Array.isArray(data)) {
    // Check for unknown elements
    for (const key in data) {
      if (!mergedElements[key] && !key.startsWith('_')) {
        errors.push({
          type: 'element/unknown',
          path: [...path, key]
        });
      }
    }
    
    // Validate known elements
    for (const [key, elementSchema] of Object.entries(mergedElements)) {
      if (data[key] !== undefined) {
        const elementResult = validateElement(ctx, elementSchema, data[key], [...path, key]);
        errors.push(...elementResult.errors);
      }
    }
  } else if (hasElements && typeof data === 'object' && data !== null && Array.isArray(data)) {
    // When schema expects elements but data is array, it's a type error
    errors.push({
      type: 'type/array',
      message: 'Expected not array',
      path,
      value: data
    });
  } else if (schema.type && typeof data === 'object' && data !== null && !Array.isArray(data)) {
    // If we have a primitive type but got an object, also check for unknown elements
    const primitiveTypes = ['string', 'code', 'url', 'boolean', 'number', 'integer'];
    if (primitiveTypes.includes(schema.type)) {
      for (const key in data) {
        errors.push({
          type: 'element/unknown',
          path: [...path, key]
        });
      }
    }
  }
  
  // Required fields validation
  if (schema.required) {
    for (const required of schema.required) {
      if (data[required] === undefined && data[`_${required}`] === undefined) {
        errors.push({
          type: 'require',
          path: [...path, required]
        });
      }
    }
  }
  
  // Choices validation
  if (schema.choices) {
    for (const [choiceName, choices] of Object.entries(schema.choices)) {
      const presentChoices = choices.filter(choice => data[choice] !== undefined);
      
      if (presentChoices.length > 1) {
        const choiceValues: any = {};
        presentChoices.forEach(choice => {
          choiceValues[choice] = data[choice];
        });
        
        errors.push({
          type: 'choices/multiple',
          path: [...path, choiceName],
          message: 'Only one choice element is allowd',
          value: choiceValues
        });
      }
      
      // Also check for excluded choices
      if (schema.elements) {
        for (const key in data) {
          const elementSchema = schema.elements[key];
          if (elementSchema?.choiceOf === choiceName && !choices.includes(key)) {
            errors.push({
              type: 'choice/excluded',
              message: `Choice element ${choiceName} is not allowed, only ${choices.join(', ')}`,
              path: [...path, choiceName],
              'schema-path': ['choices']
            });
          }
        }
      }
    }
  }
  
  return { errors };
}

function validateElement(
  ctx: ValidationContext,
  elementSchema: any,
  data: any,
  path: (string | number)[]
): { errors: ValidationError[] } {
  const errors: ValidationError[] = [];
  
  // Array validation
  if (elementSchema.array && !Array.isArray(data)) {
    errors.push({
      type: 'type/array',
      message: 'Expected array',
      path,
      value: data,
      'schema-path': [...path, 'array']
    });
    return { errors };
  }
  
  if (!elementSchema.array && Array.isArray(data)) {
    errors.push({
      type: 'type/array',
      message: 'Expected not array',
      path,
      value: data
    });
    return { errors };
  }
  
  // Handle array elements
  if (elementSchema.array && Array.isArray(data)) {
    // Cardinality validation
    if (elementSchema.min !== undefined && data.length < elementSchema.min) {
      errors.push({
        type: 'min',
        message: `expected min=${elementSchema.min} got ${data.length}`,
        value: data.length,
        expected: elementSchema.min,
        path
      });
    }
    
    if (elementSchema.max !== undefined && data.length > elementSchema.max) {
      errors.push({
        type: 'max',
        message: `expected max=${elementSchema.max} got ${data.length}`,
        value: data.length,
        expected: elementSchema.max,
        path
      });
    }
    
    // Validate each array element
    data.forEach((item, index) => {
      const result = validateElement(ctx, { ...elementSchema, array: false }, item, [...path, index]);
      errors.push(...result.errors);
    });
  } else {
    // Non-array validation
    const result = validateSchema(ctx, elementSchema, data, path);
    errors.push(...result.errors);
    
    // Pattern validation
    if (elementSchema.pattern?.string && typeof data === 'string') {
      if (data !== elementSchema.pattern.string) {
        errors.push({
          type: 'pattern',
          expected: elementSchema.pattern.string,
          'schema-path': [...path, 'pattern'],
          got: data,
          path
        });
      }
    }
  }
  
  return { errors };
}

function validateType(
  ctx: ValidationContext,
  type: string,
  data: any,
  path: (string | number)[],
  parentSchema: any,
  errors: ValidationError[] = []
): boolean {
  // Handle null values with primitive extensions
  if (data === null) {
    // For array elements, check if there's a corresponding primitive extension
    if (path.length >= 2 && typeof path[path.length - 1] === 'number') {
      const index = path[path.length - 1] as number;
      const fieldName = path[path.length - 2];
      const parent = getParentData(path);
      
      if (parent && typeof fieldName === 'string' && parent[`_${fieldName}`]) {
        const primitiveExt = parent[`_${fieldName}`];
        if (Array.isArray(primitiveExt) && primitiveExt[index]) {
          return true; // Allow null if primitive extension exists at same index
        }
      }
    } else {
      // Non-array case
      const elementName = path[path.length - 1];
      if (typeof elementName === 'string') {
        const parent = getParentData(path);
        if (parent && parent[`_${elementName}`]) {
          return true; // Allow null if primitive extension exists
        }
      }
    }
    return false;
  }
  
  // Primitive type validation first
  switch (type) {
    case 'string':
    case 'code':
    case 'url':
      return typeof data === 'string';
    case 'boolean':
      return typeof data === 'boolean';
    case 'number':
    case 'integer':
      return typeof data === 'number';
  }
  
  // Check if it's a referenced type
  const typeSchema = ctx.schemas[type];
  if (typeSchema && typeSchema.kind !== 'primitive-type') {
    // If parent schema has elements, don't validate type's elements
    // They will be validated by the merged elements
    if (parentSchema.elements) {
      // Just validate the type without elements
      const typeSchemaWithoutElements = { ...typeSchema, elements: undefined };
      const result = validateSchema(ctx, typeSchemaWithoutElements, data, path);
      result.errors.forEach(error => {
        const newError = { ...error };
        if (newError['schema-path']) {
          // Build correct schema path for nested type references
          const elementPath = path.filter(p => typeof p === 'string');
          const parentElement = elementPath[elementPath.length - 1];
          
          // Check if the error schema-path already starts with the parent element
          // This happens when validating inside a referenced type
          if (newError['schema-path'][0] === parentElement) {
            // Remove the duplicate parent element
            newError['schema-path'] = [...elementPath.slice(0, -1), parentElement, 'type', type, ...newError['schema-path'].slice(1)];
          } else {
            newError['schema-path'] = [...elementPath.slice(0, -1), parentElement, 'type', type, ...newError['schema-path']];
          }
        }
        errors.push(newError);
      });
      return result.errors.length === 0;
    } else {
      const result = validateSchema(ctx, typeSchema, data, path);
      result.errors.forEach(error => {
        const newError = { ...error };
        if (newError['schema-path']) {
          // Build correct schema path for nested type references
          const elementPath = path.filter(p => typeof p === 'string');
          const parentElement = elementPath[elementPath.length - 1];
          
          // Check if the error schema-path already starts with the parent element
          // This happens when validating inside a referenced type
          if (newError['schema-path'][0] === parentElement) {
            // Remove the duplicate parent element
            newError['schema-path'] = [...elementPath.slice(0, -1), parentElement, 'type', type, ...newError['schema-path'].slice(1)];
          } else {
            newError['schema-path'] = [...elementPath.slice(0, -1), parentElement, 'type', type, ...newError['schema-path']];
          }
        }
        errors.push(newError);
      });
      return result.errors.length === 0;
    }
  }
  
  return true; // Unknown types pass for now
}

let currentData: any = null;

function getParentData(path: (string | number)[]): any {
  if (!currentData) return null;
  
  // Handle array elements - need to go up two levels
  if (path.length >= 2 && typeof path[path.length - 1] === 'number') {
    let parent = currentData;
    for (let i = 0; i < path.length - 2; i++) {
      parent = parent?.[path[i]];
    }
    return parent;
  }
  
  let parent = currentData;
  for (let i = 0; i < path.length - 1; i++) {
    parent = parent?.[path[i]];
  }
  return parent;
}

export type { ValidationContext, FHIRSchema, ValidationResult, ValidationError } from './types';