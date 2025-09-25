import type { Action, FHIRSchemaSlicing, FHIRValue } from './types.js';

// Type for stack elements and general processing objects
type ProcessingObject = Record<string, unknown>;

// Use the existing FHIR types instead of creating conflicting ones
type SlicingConfig = FHIRSchemaSlicing;

// Type for slice node structure - make it compatible with FHIRSchemaSlicing
interface SliceNode {
  match?: FHIRValue;
  schema?: ProcessingObject;
  min?: number;
  max?: number;
}

// Type for slice information in actions
interface SliceInfo {
  min?: number;
  max?: number;
}

// Type for pattern information
interface PatternInfo {
  value?: FHIRValue;
}

function popAndUpdate(
  stack: ProcessingObject[],
  updateFn: (parent: ProcessingObject, child: ProcessingObject) => ProcessingObject,
): ProcessingObject[] {
  const child = stack[stack.length - 1];
  const newStack = stack.slice(0, -1);
  const parent = newStack[newStack.length - 1];
  const updatedParent = updateFn(parent, child);

  return [...newStack.slice(0, -1), updatedParent];
}

function buildMatchForSlice(slicing: SlicingConfig, sliceSchema: ProcessingObject): FHIRValue {
  if (!slicing.discriminator) {
    return {};
  }

  const match: Record<string, unknown> = {};

  for (const discriminator of slicing.discriminator) {
    if (!discriminator.type || !['pattern', 'value', undefined].includes(discriminator.type)) {
      continue;
    }

    const path = discriminator.path.trim();

    if (path === '$this') {
      // Merge pattern value from slice schema
      const pattern = sliceSchema.pattern as PatternInfo | undefined;
      if (pattern?.value) {
        if (
          typeof pattern.value === 'object' &&
          pattern.value !== null &&
          !Array.isArray(pattern.value)
        ) {
          Object.assign(match, pattern.value);
        } else {
          // For primitive values, we'd need to handle differently based on context
          // This is a simplified approach
          Object.assign(match, { value: pattern.value });
        }
      }
    } else {
      // Build path to pattern in nested elements
      const pathParts = path.split('.').filter((p: string) => p.trim() !== '');

      // Look for pattern fields in slice schema
      const patternKeys = Object.keys(sliceSchema).filter((k) => k.startsWith('pattern'));
      for (const patternKey of patternKeys) {
        const fieldName = patternKey.replace('pattern', '').toLowerCase();
        if (pathParts.length === 1 && pathParts[0] === fieldName) {
          match[fieldName] = sliceSchema[patternKey];
        }
      }

      // Also check nested elements
      const currentPath: string[] = ['elements'];

      for (const part of pathParts) {
        currentPath.push(part);
        if (pathParts.indexOf(part) < pathParts.length - 1) {
          currentPath.push('elements');
        }
      }

      currentPath.push('pattern');

      // Get value from slice schema
      let value: unknown = sliceSchema;
      for (const segment of currentPath) {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          value = (value as Record<string, unknown>)[segment];
        } else {
          value = undefined;
          break;
        }
      }

      if (value && typeof value === 'object' && 'value' in value) {
        const patternValue = (value as { value?: unknown }).value;
        if (patternValue !== undefined) {
          // Set value in match object
          let matchTarget: Record<string, unknown> = match;
          for (let i = 0; i < pathParts.length - 1; i++) {
            const part = pathParts[i];
            if (!matchTarget[part] || typeof matchTarget[part] !== 'object') {
              matchTarget[part] = {};
            }
            matchTarget = matchTarget[part] as Record<string, unknown>;
          }
          matchTarget[pathParts[pathParts.length - 1]] = patternValue;
        }
      }
    }
  }

  return match as FHIRValue;
}

function buildSliceNode(
  sliceSchema: ProcessingObject,
  match: FHIRValue,
  slice?: SliceInfo,
): SliceNode {
  const node: SliceNode = {
    match,
    schema: sliceSchema,
  };

  if (slice?.min !== undefined && slice.min !== 0) {
    node.min = slice.min;
  }

  if (slice?.max !== undefined) {
    node.max = slice.max;
  }

  return node;
}

function buildSlice(
  action: Action & { type: 'exit-slice' },
  parent: ProcessingObject,
  sliceSchema: ProcessingObject,
): ProcessingObject {
  const existingSlicing = parent.slicing as SlicingConfig | undefined;
  const slicingInfo: SlicingConfig =
    existingSlicing || (action.slicing as SlicingConfig) || ({} as SlicingConfig);
  const match = buildMatchForSlice(slicingInfo, sliceSchema);
  const sliceNode = buildSliceNode(sliceSchema, match, action.slice as SliceInfo | undefined);

  const updatedParent = { ...parent };

  if (!updatedParent.slicing) {
    updatedParent.slicing = {} as SlicingConfig;
  }

  const currentSlicing = updatedParent.slicing as SlicingConfig;

  if (action.slicing) {
    updatedParent.slicing = { ...currentSlicing, ...(action.slicing as SlicingConfig) };
  }

  const finalSlicing = updatedParent.slicing as SlicingConfig;
  if (!finalSlicing.slices) {
    finalSlicing.slices = {};
  }

  if (finalSlicing.slices) {
    finalSlicing.slices[action.sliceName] = sliceNode;
  }

  return updatedParent;
}

function slicingToExtensions(slicingElement: ProcessingObject): Record<string, ProcessingObject> {
  const slicing = slicingElement.slicing as SlicingConfig | undefined;
  if (!slicing?.slices) {
    return {};
  }

  const extensions: Record<string, ProcessingObject> = {};

  for (const [sliceName, slice] of Object.entries(slicing.slices)) {
    const { match, schema, min: sliceMin, max: sliceMax } = slice;

    if (!schema) continue;

    // Clean up schema properties
    const { slicing: nestedSlicing, elements, type, min: schemaMin, ...cleanSchema } = schema;

    const extension: ProcessingObject = {};

    if (match && typeof match === 'object' && 'url' in match) {
      extension.url = match.url;
    }

    // Add slice properties (min, max) - skip min if 0
    if (sliceMin !== undefined && sliceMin !== 0) {
      extension.min = sliceMin;
    }
    if (sliceMax !== undefined) {
      extension.max = sliceMax;
    }

    // Add clean schema properties
    Object.assign(extension, cleanSchema);

    // Add min from schema if not 0 and not already added from sliceProps
    if (schemaMin !== undefined && schemaMin !== 0 && extension.min === undefined) {
      extension.min = schemaMin;
    }

    extensions[sliceName] = extension;
  }

  return extensions;
}

function addElement(
  elementName: string,
  parent: ProcessingObject,
  child: ProcessingObject,
): ProcessingObject {
  const updated = { ...parent };

  // Special handling for extension elements
  if (elementName === 'extension') {
    updated.extensions = slicingToExtensions(child);
  }

  // Initialize elements if needed
  if (!updated.elements) {
    updated.elements = {};
  }

  const elements = updated.elements as Record<string, ProcessingObject>;

  // Determine actual element name (handle choiceOf)
  const choiceOf = child.choiceOf as string | undefined;
  const actualElementName = choiceOf || elementName;

  // Remove internal _required flag before adding
  const { _required, ...cleanChild } = child;
  elements[elementName] = cleanChild;

  // Add to required array if needed
  if (_required) {
    if (!updated.required) {
      updated.required = [];
    }
    const required = updated.required as string[];
    if (!required.includes(actualElementName)) {
      required.push(actualElementName);
    }
  }

  return updated;
}

export function applyActions(
  stack: ProcessingObject[],
  actions: Action[],
  value: ProcessingObject,
): ProcessingObject[] {
  let currentStack = [...stack];

  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    const nextAction = actions[i + 1];

    // If next action is enter, use empty object instead of value
    const valueToUse = nextAction?.type === 'enter' ? {} : value;

    switch (action.type) {
      case 'enter':
        currentStack.push(valueToUse);
        break;

      case 'enter-slice':
        currentStack.push(valueToUse);
        break;

      case 'exit':
        currentStack = popAndUpdate(currentStack, (parent, child) =>
          addElement(action.el, parent, child),
        );
        break;

      case 'exit-slice':
        currentStack = popAndUpdate(currentStack, (parent, child) =>
          buildSlice(action as Action & { type: 'exit-slice' }, parent, child),
        );
        break;
    }
  }

  return currentStack;
}
