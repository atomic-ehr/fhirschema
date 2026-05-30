import type {
  FHIRSchema,
  FHIRSchemaElement,
  StructureDefinition,
  StructureDefinitionElement,
} from './types.js';

interface ReverseConversionOptions {
  status?: StructureDefinition['status'];
  emitChoiceVariants?: 'all' | 'constrained' | 'strict';
}

const TYPE_TO_SUFFIX: Record<string, string> = {
  base64Binary: 'Base64Binary',
  boolean: 'Boolean',
  canonical: 'Canonical',
  code: 'Code',
  date: 'Date',
  dateTime: 'DateTime',
  decimal: 'Decimal',
  id: 'Id',
  instant: 'Instant',
  integer: 'Integer',
  markdown: 'Markdown',
  oid: 'Oid',
  positiveInt: 'PositiveInt',
  string: 'String',
  time: 'Time',
  unsignedInt: 'UnsignedInt',
  uri: 'Uri',
  url: 'Url',
  uuid: 'Uuid',
};

const SUFFIX_TO_TYPE: Record<string, string> = {
  Base64Binary: 'base64Binary',
  Boolean: 'boolean',
  Canonical: 'canonical',
  Code: 'code',
  Date: 'date',
  DateTime: 'dateTime',
  Decimal: 'decimal',
  Id: 'id',
  Instant: 'instant',
  Integer: 'integer',
  Integer64: 'integer64',
  Markdown: 'markdown',
  Oid: 'oid',
  PositiveInt: 'positiveInt',
  String: 'string',
  Time: 'time',
  UnsignedInt: 'unsignedInt',
  Uri: 'uri',
  Url: 'url',
  Uuid: 'uuid',
  Address: 'Address',
  Age: 'Age',
  Annotation: 'Annotation',
  Attachment: 'Attachment',
  CodeableConcept: 'CodeableConcept',
  CodeableReference: 'CodeableReference',
  Coding: 'Coding',
  ContactPoint: 'ContactPoint',
  Count: 'Count',
  Distance: 'Distance',
  Duration: 'Duration',
  HumanName: 'HumanName',
  Identifier: 'Identifier',
  Money: 'Money',
  Period: 'Period',
  Quantity: 'Quantity',
  Range: 'Range',
  Ratio: 'Ratio',
  RatioRange: 'RatioRange',
  Reference: 'Reference',
  SampledData: 'SampledData',
  Signature: 'Signature',
  Timing: 'Timing',
  ContactDetail: 'ContactDetail',
  DataRequirement: 'DataRequirement',
  Expression: 'Expression',
  ParameterDefinition: 'ParameterDefinition',
  RelatedArtifact: 'RelatedArtifact',
  TriggerDefinition: 'TriggerDefinition',
  UsageContext: 'UsageContext',
  Availability: 'Availability',
  ExtendedContactDetail: 'ExtendedContactDetail',
  Dosage: 'Dosage',
  Meta: 'Meta',
};

function toFhirSuffix(typeName?: string): string | undefined {
  if (!typeName || typeName.length === 0) {
    return undefined;
  }
  return TYPE_TO_SUFFIX[typeName] || `${typeName[0].toUpperCase()}${typeName.slice(1)}`;
}

function inferPatternType(value: unknown): string | undefined {
  if (typeof value === 'string') return 'string';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'decimal';
  return undefined;
}

function fromChoiceElementName(baseName: string, choiceName: string): string {
  const suffix = choiceName.slice(baseName.length);
  if (!suffix) {
    return 'string';
  }
  return SUFFIX_TO_TYPE[suffix] || suffix;
}

function buildPatternFields(
  pattern: FHIRSchemaElement['pattern'],
): Partial<StructureDefinitionElement> {
  if (!pattern) {
    return {};
  }

  const resolvedType = pattern.type || inferPatternType(pattern.value);
  const suffix = toFhirSuffix(resolvedType);
  if (!suffix) {
    return {};
  }
  return {
    [`pattern${suffix}`]: pattern.value,
  };
}

function buildConstraintArray(
  constraint: FHIRSchemaElement['constraint'],
): StructureDefinitionElement['constraint'] {
  if (!constraint) {
    return undefined;
  }

  const entries = Object.entries(constraint);
  if (entries.length === 0) {
    return undefined;
  }

  return entries.map(([key, value]) => ({
    key,
    expression: value.expression,
    human: value.human,
    severity: value.severity,
  }));
}

function buildBinding(
  binding: FHIRSchemaElement['binding'],
): StructureDefinitionElement['binding'] {
  if (!binding) {
    return undefined;
  }

  const result: NonNullable<StructureDefinitionElement['binding']> = {
    strength: binding.strength,
  };

  if (binding.valueSet) {
    result.valueSet = binding.valueSet;
  }

  if (binding.bindingName) {
    result.extension = [
      {
        url: 'http://hl7.org/fhir/StructureDefinition/elementdefinition-bindingName',
        valueString: binding.bindingName,
      },
    ];
  }

  return result;
}

function buildContentReference(
  elementReference: FHIRSchemaElement['elementReference'],
  rootType: string,
  rootUrl: string,
): string | undefined {
  if (!elementReference || elementReference.length < 3 || elementReference[0] !== rootUrl) {
    return undefined;
  }

  const path: string[] = [rootType];
  for (let i = 1; i < elementReference.length; i += 2) {
    if (elementReference[i] === 'elements' && typeof elementReference[i + 1] === 'string') {
      path.push(elementReference[i + 1]);
    }
  }

  if (path.length <= 1) {
    return undefined;
  }

  return `#${path.join('.')}`;
}

function applyCardinality(
  target: StructureDefinitionElement,
  source: FHIRSchemaElement,
  required: boolean,
): void {
  // Explicit suppression cardinality should be preserved even for non-array fields.
  if (source.max === 0) {
    target.min = source.min ?? 0;
    target.max = '0';
    return;
  }

  if (source.array) {
    target.min = required ? Math.max(1, source.min ?? 0) : (source.min ?? 0);
    target.max = source.max !== undefined ? String(source.max) : '*';
    return;
  }

  if (required || source.min !== undefined) {
    target.min = required ? Math.max(1, source.min ?? 0) : source.min;
    target.max = '1';
  }
}

function buildType(source: FHIRSchemaElement): StructureDefinitionElement['type'] {
  if (!source.type) {
    return undefined;
  }

  if (source.type === 'Reference') {
    const referenceType: NonNullable<StructureDefinitionElement['type']>[number] = {
      code: 'Reference',
    };
    if (source.refers && source.refers.length > 0) {
      referenceType.targetProfile = source.refers;
    }
    return [referenceType];
  }

  if (source.url) {
    return [{ code: 'Extension', profile: [source.url] }];
  }

  return [{ code: source.type }];
}

function hasMeaningfulFields(element: FHIRSchemaElement): boolean {
  const {
    type,
    array,
    min,
    max,
    refers,
    short,
    binding,
    pattern,
    constraint,
    choiceOf,
    choices,
    url,
    mustSupport,
    isModifier,
    isModifierReason,
    isSummary,
    elementReference,
    slicing,
  } = element;

  return Boolean(
    type ||
      array ||
      min !== undefined ||
      max !== undefined ||
      (refers && refers.length > 0) ||
      short ||
      binding ||
      pattern ||
      (constraint && Object.keys(constraint).length > 0) ||
      choiceOf ||
      (choices && choices.length > 0) ||
      url ||
      mustSupport !== undefined ||
      isModifier !== undefined ||
      isModifierReason ||
      isSummary !== undefined ||
      (elementReference && elementReference.length > 0) ||
      slicing,
  );
}

function hasVariantSpecificFields(element: FHIRSchemaElement, allowShortSignal: boolean): boolean {
  if (element.elements && Object.keys(element.elements).length > 0) return true;
  if (element.slicing) return true;
  if (element.array) return true;
  if (element.min !== undefined) return true;
  if (element.max !== undefined) return true;
  if (element.refers && element.refers.length > 0) return true;
  if (element.binding) return true;
  if (element.pattern) return true;
  if (element.constraint) {
    const meaningfulConstraintKeys = Object.keys(element.constraint).filter(
      (key) => key !== 'ele-1' && key !== 'ext-1',
    );
    if (meaningfulConstraintKeys.length > 0) return true;
  }
  if (element.url) return true;
  if (element.mustSupport === true) return true;
  if (element.isModifier === true) return true;
  if (element.isModifierReason) return true;
  if (element.isSummary === true) return true;
  if (element.elementReference && element.elementReference.length > 0) return true;
  if (allowShortSignal && element.short && element.short !== 'Value of extension') return true;

  // If there are any passthrough fields beyond housekeeping/type markers, keep variant.
  for (const key of Object.keys(element as Record<string, unknown>)) {
    if (
      key !== 'type' &&
      key !== 'choiceOf' &&
      key !== 'index' &&
      key !== 'base' &&
      key !== 'short' &&
      key !== 'mustSupport' &&
      key !== 'isModifier' &&
      key !== 'isSummary' &&
      key !== 'constraint'
    ) {
      return true;
    }
  }

  return false;
}

function buildBaseElement(
  path: string,
  source: FHIRSchemaElement,
  required: boolean,
  rootType: string,
  rootUrl: string,
): StructureDefinitionElement {
  const element: StructureDefinitionElement = {
    path,
  };

  applyCardinality(element, source, required);

  const type = buildType(source);
  if (type) {
    element.type = type;
  }

  if (source.short) {
    element.short = source.short;
  }

  if (source.binding) {
    const binding = buildBinding(source.binding);
    if (binding) {
      element.binding = binding;
    }
  }

  if (source.constraint) {
    const constraints = buildConstraintArray(source.constraint);
    if (constraints) {
      element.constraint = constraints;
    }
  }

  if (source.mustSupport !== undefined) {
    element.mustSupport = source.mustSupport;
  }

  if (source.isModifier !== undefined) {
    element.isModifier = source.isModifier;
  }

  if (source.isModifierReason) {
    element.isModifierReason = source.isModifierReason;
  }

  if (source.isSummary !== undefined) {
    element.isSummary = source.isSummary;
  }

  if (source.elementReference) {
    const contentReference = buildContentReference(source.elementReference, rootType, rootUrl);
    if (contentReference) {
      element.contentReference = contentReference;
    }
  }

  Object.assign(element, buildPatternFields(source.pattern));

  // Preserve already-normalized fixed/default/pattern fields as-is.
  for (const [key, value] of Object.entries(source)) {
    if (/^(fixed|defaultValue|pattern)[A-Z]/.test(key)) {
      (element as Record<string, unknown>)[key] = value;
    }
  }

  // Preserve unknown passthrough fields that are neither structural nor derived.
  const structuralKeys = new Set([
    'type',
    'array',
    'min',
    'max',
    'refers',
    'short',
    'binding',
    'pattern',
    'constraint',
    'elements',
    'choiceOf',
    'choices',
    'url',
    'mustSupport',
    'isModifier',
    'isModifierReason',
    'isSummary',
    'elementReference',
    'slicing',
    'extensions',
    'required',
    'excluded',
    '_required',
    'index',
  ]);

  for (const [key, value] of Object.entries(source)) {
    if (structuralKeys.has(key)) {
      continue;
    }
    if (/^(fixed|defaultValue|pattern)[A-Z]/.test(key)) {
      continue;
    }
    if ((element as Record<string, unknown>)[key] === undefined) {
      (element as Record<string, unknown>)[key] = value;
    }
  }

  return element;
}

function addElementTree(
  elements: StructureDefinitionElement[],
  elementMap: Record<string, FHIRSchemaElement>,
  parentPath: string,
  rootType: string,
  rootUrl: string,
  required: string[] | undefined,
  options: ReverseConversionOptions,
): void {
  const requiredSet = new Set(required || []);

  for (const [name, child] of Object.entries(elementMap)) {
    if (child.choiceOf) {
      continue;
    }

    const elementPath = `${parentPath}.${name}`;
    const isRequired = requiredSet.has(name);

    if (child.choices && child.choices.length > 0) {
      const choiceElement = buildBaseElement(
        `${parentPath}.${name}[x]`,
        child,
        isRequired,
        rootType,
        rootUrl,
      );
      choiceElement.type = child.choices.map((choiceName) => ({
        code: fromChoiceElementName(name, choiceName),
      }));
      elements.push(choiceElement);

      const choiceDisabled = choiceElement.max === '0';
      if (choiceDisabled) {
        // Snapshot encodes suppressed value[x] by max=0 on parent.
        // Do not emit expanded variants in this case.
        continue;
      }

      for (const choiceName of child.choices) {
        const choiceVariant = elementMap[choiceName];
        if (!choiceVariant) {
          continue;
        }

        const emitMode = options.emitChoiceVariants ?? 'all';
        const shouldEmitVariant =
          emitMode === 'strict'
            ? Boolean(choiceVariant.elements && Object.keys(choiceVariant.elements).length > 0)
            : hasVariantSpecificFields(choiceVariant, emitMode === 'all');

        if (shouldEmitVariant) {
          const variantElement = buildBaseElement(
            `${parentPath}.${choiceName}`,
            choiceVariant,
            false,
            rootType,
            rootUrl,
          );
          variantElement.type = buildType(choiceVariant) || variantElement.type;
          elements.push(variantElement);
        }

        if (choiceVariant.elements) {
          addElementTree(
            elements,
            choiceVariant.elements,
            `${parentPath}.${choiceName}`,
            rootType,
            rootUrl,
            choiceVariant.required,
            options,
          );
        }
      }

      continue;
    }

    if (hasMeaningfulFields(child) || child.elements || child.slicing) {
      const element = buildBaseElement(elementPath, child, isRequired, rootType, rootUrl);

      if (child.slicing) {
        element.slicing = {
          discriminator: child.slicing.discriminator,
          ordered: child.slicing.ordered,
          rules: child.slicing.rules,
        };
      }

      elements.push(element);

      if (child.slicing?.slices) {
        for (const [sliceName, sliceValue] of Object.entries(child.slicing.slices)) {
          const sliceNode = sliceValue as FHIRSchemaElement & {
            schema?: FHIRSchemaElement;
            min?: number;
            max?: number;
            match?: unknown;
          };

          const schema = sliceNode.schema || sliceNode;
          const sliceElement = buildBaseElement(elementPath, schema, false, rootType, rootUrl);
          sliceElement.sliceName = sliceName;

          if (sliceNode.min !== undefined) {
            sliceElement.min = sliceNode.min;
          }
          if (sliceNode.max !== undefined) {
            sliceElement.max = String(sliceNode.max);
          }

          if (sliceNode.match !== undefined) {
            const matchPattern = sliceNode.match as Record<string, unknown>;
            if (Object.prototype.hasOwnProperty.call(matchPattern, 'url')) {
              sliceElement.patternUri = matchPattern.url as string;
            }
          }

          elements.push(sliceElement);

          if (schema.elements) {
            addElementTree(
              elements,
              schema.elements,
              elementPath,
              rootType,
              rootUrl,
              schema.required,
              options,
            );
          }
        }
      }
    }

    if (child.elements) {
      addElementTree(
        elements,
        child.elements,
        elementPath,
        rootType,
        rootUrl,
        child.required,
        options,
      );
    }
  }
}

export function toStructureDefinition(
  schema: FHIRSchema,
  options?: ReverseConversionOptions,
): StructureDefinition {
  const status = options?.status ?? 'active';
  const rootMax = schema.type === 'Extension' ? '1' : '*';
  const differential: StructureDefinitionElement[] = [{ path: schema.type, min: 0, max: rootMax }];

  if (schema.elements) {
    addElementTree(
      differential,
      schema.elements,
      schema.type,
      schema.type,
      schema.url,
      schema.required,
      options || {},
    );
  }

  return {
    resourceType: 'StructureDefinition',
    url: schema.url,
    version: schema.version,
    name: schema.name,
    description: schema.description,
    status,
    kind: schema.kind,
    abstract: schema.abstract,
    type: schema.type,
    baseDefinition: schema.base,
    derivation: schema.derivation,
    package_name: schema.package_name,
    package_version: schema.package_version,
    package_id: schema.package_id,
    differential: {
      element: differential,
    },
  };
}
