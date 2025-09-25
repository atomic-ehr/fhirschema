import type {
  FHIRSchemaElement,
  StructureDefinition,
  StructureDefinitionElement,
  StructureDefinitionExtension,
} from './types.js';

const BINDING_NAME_EXT = 'http://hl7.org/fhir/StructureDefinition/elementdefinition-bindingName';
const DEFAULT_TYPE_EXT = 'http://hl7.org/fhir/StructureDefinition/elementdefinition-defaulttype';
const FHIR_TYPE_EXT = 'http://hl7.org/fhir/StructureDefinition/structuredefinition-fhir-type';

// Helper types for internal processing
interface ProcessingElement extends Record<string, unknown> {
  type?:
    | string
    | Array<{
        code: string;
        profile?: string[];
        targetProfile?: string[];
        extension?: StructureDefinitionExtension[];
      }>;
  binding?: {
    strength: string;
    valueSet?: string;
    extension?: StructureDefinitionExtension[];
  };
  constraint?: Record<string, { expression: string; human: string; severity: string }>;
  extension?: StructureDefinitionExtension[];
  min?: number;
  max?: string | number; // Can be string or number during processing
  contentReference?: string;
  choiceOf?: string;
  choices?: string[];
  refers?: string[];
  url?: string;
  array?: boolean;
  _required?: boolean;
  pattern?: {
    type: string;
    value: unknown;
  };
  defaultType?: string;
}

interface NormalizedBinding {
  strength: string;
  valueSet?: string;
  bindingName?: string;
}

function getExtension(
  extensions: StructureDefinitionExtension[] | undefined,
  url: string,
): StructureDefinitionExtension | undefined {
  if (!extensions) return undefined;
  return extensions.find((ext) => ext.url === url);
}

function patternTypeNormalize(typeName: string): string {
  const typeMap: Record<string, string> = {
    Instant: 'instant',
    Time: 'time',
    Date: 'date',
    DateTime: 'dateTime',
    Decimal: 'decimal',
    Boolean: 'boolean',
    Integer: 'integer',
    String: 'string',
    Uri: 'uri',
    Base64Binary: 'base64Binary',
    Code: 'code',
    Id: 'id',
    Oid: 'oid',
    UnsignedInt: 'unsignedInt',
    PositiveInt: 'positiveInt',
    Markdown: 'markdown',
    Url: 'url',
    Canonical: 'canonical',
    Uuid: 'uuid',
  };
  return typeMap[typeName] || typeName;
}

function processPatterns(element: ProcessingElement): ProcessingElement {
  const result: ProcessingElement = {};

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

function buildReferenceTargets(
  types: Array<{ targetProfile?: string | string[] }>,
): string[] | undefined {
  const refers: string[] = [];

  for (const type of types) {
    if (type.targetProfile) {
      const profiles = Array.isArray(type.targetProfile)
        ? type.targetProfile
        : [type.targetProfile];
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
      ...(refers && { refers }),
    };
  }

  return element;
}

function buildElementBinding(
  element: ProcessingElement,
  structureDefinition: StructureDefinition,
): ProcessingElement {
  const normalizeBinding = (
    binding: NonNullable<ProcessingElement['binding']>,
  ): NormalizedBinding => {
    const result: NormalizedBinding = {
      strength: binding.strength,
      ...(binding.valueSet && { valueSet: binding.valueSet }),
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
    const decl = structureDefinition.snapshot.element.find((e) => e.path === declPath);
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

function buildElementConstraints(element: ProcessingElement): ProcessingElement {
  // Handle case where constraint is already a Record (from previous processing)
  if (element.constraint && !Array.isArray(element.constraint)) {
    return element;
  }

  // Handle array constraint case
  const constraintArray = element.constraint as
    | Array<{ key: string; expression: string; human: string; severity: string }>
    | undefined;
  if (!constraintArray || constraintArray.length === 0) {
    return element;
  }

  const constraints: Record<string, { expression: string; human: string; severity: string }> = {};
  for (const constraint of constraintArray) {
    constraints[constraint.key] = {
      expression: constraint.expression,
      human: constraint.human,
      severity: constraint.severity,
    };
  }

  return { ...element, constraint: constraints };
}

function buildElementType(
  element: ProcessingElement,
  structureDefinition: StructureDefinition,
): ProcessingElement {
  if (!element.type || (Array.isArray(element.type) && element.type.length === 0)) {
    return element;
  }

  // Handle array type (from StructureDefinitionElement)
  if (Array.isArray(element.type)) {
    const firstType = element.type[0];

    // Check for type in extension
    const typeFromExt = firstType.extension?.[0];
    if (
      typeFromExt?.url === FHIR_TYPE_EXT &&
      typeFromExt.valueUrl &&
      typeof typeFromExt.valueUrl === 'string'
    ) {
      return { ...element, type: typeFromExt.valueUrl };
    }

    // Normal type
    const typeCode = firstType.code;
    const result: ProcessingElement = { ...element, type: typeCode };

    // Add defaultType for logical models
    if (structureDefinition.kind === 'logical') {
      const defaultTypeExt = getExtension(element.extension, DEFAULT_TYPE_EXT);
      if (defaultTypeExt?.valueCanonical) {
        result.defaultType = defaultTypeExt.valueCanonical;
      }
    }

    return result;
  }

  return element;
}

function buildElementExtension(element: ProcessingElement): ProcessingElement {
  // Handle array type case
  if (Array.isArray(element.type)) {
    const firstType = element.type[0];
    if (firstType.code !== 'Extension') {
      return element;
    }

    const extUrl = firstType.profile?.[0];
    if (!extUrl) {
      return element;
    }

    const result: ProcessingElement = {
      ...element,
      url: extUrl,
    };

    if (element.min) {
      result.min = element.min;
    }
    if (element.max && element.max !== '*') {
      const maxStr = typeof element.max === 'string' ? element.max : String(element.max);
      result.max = Number.parseInt(maxStr, 10);
    }

    return result;
  }

  if (element.type !== 'Extension') {
    return element;
  }
  return element;
}

function buildElementCardinality(element: ProcessingElement): ProcessingElement {
  if (element.url) {
    // Extension element, cardinality already handled
    return element;
  }

  const maxValue = typeof element.max === 'string' ? element.max : String(element.max || '');

  const isArray =
    maxValue === '*' ||
    (element.min && element.min >= 2) ||
    (maxValue && maxValue !== '*' && Number.parseInt(maxValue, 10) >= 2);

  const isRequired = element.min === 1;

  const result: ProcessingElement = { ...element };
  delete result.min;
  delete result.max;

  if (isArray) {
    result.array = true;
    if (typeof element.min === 'number' && element.min > 0) {
      result.min = element.min;
    }
    if (maxValue && maxValue !== '*') {
      result.max = Number.parseInt(maxValue, 10);
    }
  }

  if (isRequired) {
    result._required = true;
  }

  return result;
}

function contentReferenceToElementReference(
  ref: string,
  structureDefinition: StructureDefinition,
): string[] {
  // Remove the # prefix and split
  const pathParts = ref.substring(1).split('.');
  const result = [structureDefinition.url];

  for (const part of pathParts.slice(1)) {
    result.push('elements', part);
  }

  return result;
}

function buildElementContentReference(
  element: ProcessingElement,
  structureDefinition: StructureDefinition,
): ProcessingElement {
  if (!element.contentReference) {
    return element;
  }

  const { contentReference, ...rest } = element;
  return {
    ...rest,
    elementReference: contentReferenceToElementReference(contentReference, structureDefinition),
  };
}

function clearElement(element: StructureDefinitionElement): ProcessingElement {
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
    ...rest
  } = element;

  return rest as ProcessingElement;
}

export function isArrayElement(element: StructureDefinitionElement): boolean {
  return (
    element.max === '*' ||
    (element.min !== undefined && element.min >= 2) ||
    (element.max !== undefined && element.max !== '*' && Number.parseInt(element.max, 10) >= 2)
  );
}

export function isRequiredElement(element: StructureDefinitionElement): boolean {
  return element.min === 1;
}

export function transformElement(
  element: StructureDefinitionElement,
  structureDefinition: StructureDefinition,
): FHIRSchemaElement {
  let transformed: ProcessingElement = preprocessElement(element) as ProcessingElement;
  transformed = clearElement(transformed as StructureDefinitionElement);
  transformed = buildElementBinding(transformed, structureDefinition);
  transformed = buildElementConstraints(transformed);
  transformed = buildElementContentReference(transformed, structureDefinition);
  transformed = buildElementExtension(transformed);
  transformed = buildElementCardinality(transformed);
  transformed = buildElementType(transformed, structureDefinition);
  transformed = processPatterns(transformed);

  return transformed as FHIRSchemaElement;
}
