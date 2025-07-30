import { StructureDefinitionElement, StructureDefinition, FHIRSchemaElement } from './types';

const BINDING_NAME_EXT = "http://hl7.org/fhir/StructureDefinition/elementdefinition-bindingName";
const DEFAULT_TYPE_EXT = "http://hl7.org/fhir/StructureDefinition/elementdefinition-defaulttype";
const FHIR_TYPE_EXT = "http://hl7.org/fhir/StructureDefinition/structuredefinition-fhir-type";

function getExtension(extensions: any[] | undefined, url: string): any {
  if (!extensions) return undefined;
  return extensions.find(ext => ext.url === url);
}

function patternTypeNormalize(typeName: string): string {
  const typeMap: Record<string, string> = {
    "Instant": "instant",
    "Time": "time",
    "Date": "date",
    "DateTime": "dateTime",
    "Decimal": "decimal",
    "Boolean": "boolean",
    "Integer": "integer",
    "String": "string",
    "Uri": "uri",
    "Base64Binary": "base64Binary",
    "Code": "code",
    "Id": "id",
    "Oid": "oid",
    "UnsignedInt": "unsignedInt",
    "PositiveInt": "positiveInt",
    "Markdown": "markdown",
    "Url": "url",
    "Canonical": "canonical",
    "Uuid": "uuid"
  };
  return typeMap[typeName] || typeName;
}

function processPatterns(element: any): any {
  const result: any = {};
  
  for (const [key, value] of Object.entries(element)) {
    if (typeof key === 'string' && key.startsWith('pattern')) {
      const type = patternTypeNormalize(key.replace(/^pattern/, ''));
      result.pattern = { type, value };
    } else if (typeof key === 'string' && key.startsWith('fixed')) {
      const type = patternTypeNormalize(key.replace(/^fixed/, ''));
      result.pattern = { type, value };
    } else {
      result[key] = value;
    }
  }
  
  // If pattern has type but element doesn't, use pattern type
  if (result.pattern?.type && !result.type) {
    result.type = result.pattern.type;
  }
  
  return result;
}

function buildReferenceTargets(types: any[]): string[] | undefined {
  const refers: string[] = [];
  
  for (const type of types) {
    if (type.targetProfile) {
      const profiles = Array.isArray(type.targetProfile) ? type.targetProfile : [type.targetProfile];
      refers.push(...profiles);
    }
  }
  
  return refers.length > 0 ? [...new Set(refers)].sort() : undefined;
}

function preprocessElement(element: StructureDefinitionElement): StructureDefinitionElement {
  if (!element.type || element.type.length === 0) {
    return element;
  }
  
  const firstType = element.type[0];
  if (firstType.code === 'Reference') {
    const refers = buildReferenceTargets(element.type);
    return {
      ...element,
      type: [{ code: 'Reference' }],
      ...(refers && { refers })
    };
  }
  
  return element;
}

function buildElementBinding(element: any, structureDefinition: StructureDefinition): any {
  const normalizeBinding = (binding: any) => {
    const result: any = {
      strength: binding.strength,
      ...(binding.valueSet && { valueSet: binding.valueSet })
    };
    
    const bindingNameExt = getExtension(binding.extension, BINDING_NAME_EXT);
    if (bindingNameExt?.valueString) {
      result.bindingName = bindingNameExt.valueString;
    }
    
    return result;
  };
  
  // Skip binding for choice parent elements
  if (element.choices) {
    const { binding, ...rest } = element;
    return rest;
  }
  
  // For choice elements, get binding from parent declaration
  if (element.choiceOf && structureDefinition.snapshot) {
    const declPath = `${structureDefinition.id}.${element.choiceOf}[x]`;
    const decl = structureDefinition.snapshot.element.find(e => e.path === declPath);
    if (decl?.binding) {
      return { ...element, binding: normalizeBinding(decl.binding) };
    }
  }
  
  // Normal binding
  if (element.binding?.valueSet) {
    return { ...element, binding: normalizeBinding(element.binding) };
  }
  
  // Remove empty binding
  const { binding, ...rest } = element;
  return rest;
}

function buildElementConstraints(element: any): any {
  if (!element.constraint || element.constraint.length === 0) {
    return element;
  }
  
  const constraints: Record<string, any> = {};
  for (const constraint of element.constraint) {
    constraints[constraint.key] = {
      expression: constraint.expression,
      human: constraint.human,
      severity: constraint.severity
    };
  }
  
  return { ...element, constraint: constraints };
}

function buildElementType(element: any, structureDefinition: StructureDefinition): any {
  if (!element.type || element.type.length === 0) {
    return element;
  }
  
  // Check for type in extension
  const typeFromExt = element.type[0]?.extension?.[0];
  if (typeFromExt?.url === FHIR_TYPE_EXT && typeFromExt.valueUrl) {
    return { ...element, type: typeFromExt.valueUrl };
  }
  
  // Normal type
  const typeCode = element.type[0].code;
  const result = { ...element, type: typeCode };
  
  // Add defaultType for logical models
  if (structureDefinition.kind === 'logical') {
    const defaultTypeExt = getExtension(element.extension, DEFAULT_TYPE_EXT);
    if (defaultTypeExt?.valueCanonical) {
      result.defaultType = defaultTypeExt.valueCanonical;
    }
  }
  
  return result;
}

function buildElementExtension(element: any): any {
  const type = element.type?.[0]?.code;
  if (type !== 'Extension') {
    return element;
  }
  
  const extUrl = element.type[0]?.profile?.[0];
  if (!extUrl) {
    return element;
  }
  
  return {
    ...element,
    url: extUrl,
    ...(element.min && { min: element.min }),
    ...(element.max && element.max !== '*' && { max: parseInt(element.max) })
  };
}

function buildElementCardinality(element: any): any {
  if (element.url) {
    // Extension element, cardinality already handled
    return element;
  }
  
  const isArray = element.max === '*' || 
    (element.min && element.min >= 2) || 
    (element.max && parseInt(element.max) >= 2);
  
  const isRequired = element.min === 1;
  
  let result: any = { ...element };
  delete result.min;
  delete result.max;
  
  if (isArray) {
    result.array = true;
    if (element.min && element.min > 0) {
      result.min = element.min;
    }
    if (element.max && element.max !== '*') {
      result.max = parseInt(element.max);
    }
  }
  
  if (isRequired) {
    result._required = true;
  }
  
  return result;
}

function contentReferenceToElementReference(ref: string, structureDefinition: StructureDefinition): string[] {
  // Remove the # prefix and split
  const pathParts = ref.substring(1).split('.');
  const result = [structureDefinition.url];
  
  for (const part of pathParts.slice(1)) {
    result.push('elements', part);
  }
  
  return result;
}

function buildElementContentReference(element: any, structureDefinition: StructureDefinition): any {
  if (!element.contentReference) {
    return element;
  }
  
  const { contentReference, ...rest } = element;
  return {
    ...rest,
    elementReference: contentReferenceToElementReference(contentReference, structureDefinition)
  };
}

function clearElement(element: any): any {
  const {
    path,
    slicing,
    sliceName,
    id,
    mapping,
    example,
    alias,
    condition,
    comment,
    definition,
    requirements,
    extension,
    index,
    ...rest
  } = element;
  
  return rest;
}

export function isArrayElement(element: StructureDefinitionElement): boolean {
  return element.max === '*' || 
    (element.min !== undefined && element.min >= 2) || 
    (element.max !== undefined && element.max !== '*' && parseInt(element.max) >= 2);
}

export function isRequiredElement(element: StructureDefinitionElement): boolean {
  return element.min === 1;
}

export function transformElement(
  element: StructureDefinitionElement, 
  structureDefinition: StructureDefinition
): FHIRSchemaElement {
  let transformed: any = preprocessElement(element);
  transformed = clearElement(transformed);
  transformed = buildElementBinding(transformed, structureDefinition);
  transformed = buildElementConstraints(transformed);
  transformed = buildElementContentReference(transformed, structureDefinition);
  transformed = buildElementExtension(transformed);
  transformed = buildElementCardinality(transformed);
  transformed = buildElementType(transformed, structureDefinition);
  transformed = processPatterns(transformed);
  
  return transformed as FHIRSchemaElement;
}