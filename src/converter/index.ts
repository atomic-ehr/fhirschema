import { calculateActions } from './action-calculator.js';
import { expandChoiceElement, isChoiceElement } from './choice-handler.js';
import { transformElement } from './element-transformer.js';
import { enrichPath, parsePath } from './path-parser.js';
import { applyActions } from './stack-processor.js';
import type {
  ConversionContext,
  FHIRSchema,
  PathComponent,
  StructureDefinition,
  StructureDefinitionElement,
} from './types.js';

// Type for the resource header being built
interface ResourceHeader extends Record<string, unknown> {
  name: string;
  type: string;
  url?: string;
  version?: string;
  description?: string;
  package_name?: string;
  package_version?: string;
  package_id?: string;
  kind: string;
  derivation?: string;
  base?: string;
  abstract?: boolean;
  class: string;
  package_meta?: Record<string, unknown>;
}

function buildResourceHeader(
  structureDefinition: StructureDefinition,
  context?: ConversionContext,
): ResourceHeader {
  // Build header following Clojure's select-keys order
  // From Clojure: (select-keys structure-definition [:name :type :url :version :description :package_name :package_version :package_id :kind :derivation])
  const header: ResourceHeader = {
    name: structureDefinition.name,
    type: structureDefinition.type,
    kind: structureDefinition.kind,
    class: determineClass(structureDefinition), // Will be set below
  };

  if (structureDefinition.url) header.url = structureDefinition.url;
  if (structureDefinition.version) header.version = structureDefinition.version;
  if (structureDefinition.description) header.description = structureDefinition.description;
  if (structureDefinition.package_name) header.package_name = structureDefinition.package_name;
  if (structureDefinition.package_version)
    header.package_version = structureDefinition.package_version;
  if (structureDefinition.package_id) header.package_id = structureDefinition.package_id;
  if (structureDefinition.derivation) header.derivation = structureDefinition.derivation;

  // Then add base if present (and not Element itself)
  if (structureDefinition.baseDefinition && structureDefinition.type !== 'Element') {
    header.base = structureDefinition.baseDefinition;
  }

  // Then abstract if true
  if (structureDefinition.abstract) header.abstract = structureDefinition.abstract;

  // Set class (computed field)
  header.class = determineClass(structureDefinition);

  // Package metadata
  if (context?.package_meta) header.package_meta = context.package_meta;

  return header;
}

function determineClass(structureDefinition: StructureDefinition): string {
  if (structureDefinition.kind === 'resource' && structureDefinition.derivation === 'constraint') {
    return 'profile';
  }
  if (structureDefinition.type === 'Extension') {
    return 'extension';
  }
  return structureDefinition.kind || 'unknown';
}

function _getRootElement(
  structureDefinition: StructureDefinition,
): StructureDefinitionElement | undefined {
  const elements = structureDefinition.differential?.element || [];
  return elements.find((e) => !e.path.includes('.'));
}

function getDifferential(structureDefinition: StructureDefinition): StructureDefinitionElement[] {
  const elements = structureDefinition.differential?.element || [];
  // Filter out root element (doesn't contain '.')
  return elements.filter((e) => e.path.includes('.'));
}

// Type for elements that can be sorted by index
interface IndexableElement extends Record<string, unknown> {
  index?: number;
  elements?: Record<string, IndexableElement>;
}

function sortElementsByIndex(
  elements: Record<string, IndexableElement>,
): Record<string, IndexableElement> {
  // Get all entries and sort by index
  const entries = Object.entries(elements);
  const sorted = entries.sort((a, b) => {
    const indexA = a[1].index ?? Number.POSITIVE_INFINITY;
    const indexB = b[1].index ?? Number.POSITIVE_INFINITY;
    return indexA - indexB;
  });

  // Rebuild object in sorted order
  const result: Record<string, IndexableElement> = {};
  for (const [key, value] of sorted) {
    // Recursively sort nested elements
    if (value.elements) {
      result[key] = {
        ...value,
        elements: sortElementsByIndex(value.elements),
      };
    } else {
      result[key] = value;
    }
  }

  return result;
}

function normalizeSchema(schema: unknown, visited = new WeakSet<object>()): unknown {
  if (Array.isArray(schema)) {
    // Don't sort arrays - preserve their original order
    return schema.map((item) => normalizeSchema(item, visited));
  }

  if (schema && typeof schema === 'object') {
    // Check for circular reference
    if (visited.has(schema)) {
      return '[Circular Reference]';
    }
    visited.add(schema);

    const normalized: Record<string, unknown> = {};
    // Preserve original key order instead of sorting
    const keys = Object.keys(schema);

    for (const key of keys) {
      const value = (schema as Record<string, unknown>)[key];
      if (key === 'elements' && value && typeof value === 'object' && !Array.isArray(value)) {
        // Sort elements by index
        const normalizedValue = normalizeSchema(value, visited);
        if (
          normalizedValue &&
          typeof normalizedValue === 'object' &&
          !Array.isArray(normalizedValue)
        ) {
          normalized[key] = sortElementsByIndex(
            normalizedValue as Record<string, IndexableElement>,
          );
        } else {
          normalized[key] = normalizedValue;
        }
      } else if (key === 'required' && Array.isArray(value)) {
        // Sort required array (Clojure uses sets which get sorted when converted)
        const stringArray = value.filter((item): item is string => typeof item === 'string');
        normalized[key] = [...stringArray].sort();
      } else {
        normalized[key] = normalizeSchema(value, visited);
      }
    }

    return normalized;
  }

  return schema;
}

export function translate(
  structureDefinition: StructureDefinition,
  context?: ConversionContext,
): FHIRSchema {
  // Handle primitive types - they don't have differential elements
  if (structureDefinition.kind === 'primitive-type') {
    const header = buildResourceHeader(structureDefinition, context);
    const normalized = normalizeSchema(header);
    return normalized as FHIRSchema;
  }

  const header = buildResourceHeader(structureDefinition, context);
  const elements = getDifferential(structureDefinition);

  // Note: Root element constraints are not included in the output

  // Initialize stack with header
  let stack: Record<string, unknown>[] = [header];
  let prevPath: PathComponent[] = [];
  const elementQueue = [...elements];
  let index = 0;

  while (elementQueue.length > 0) {
    const element = elementQueue.shift();
    if (element === undefined) {
      continue;
    }

    // Handle choice elements
    if (isChoiceElement(element)) {
      const expanded = expandChoiceElement(element);
      elementQueue.unshift(...expanded);
      index++; // Increment index for the original choice element
      continue;
    }

    // Parse and enrich path
    const parsedPath = parsePath(element);
    const enrichedPath = enrichPath(prevPath, parsedPath);

    // Calculate actions
    const actions = calculateActions(prevPath, enrichedPath);

    // Transform element
    const transformedElement = transformElement(element, structureDefinition);
    const elementWithIndex: Record<string, unknown> = { ...transformedElement, index: index++ };

    // Apply actions
    stack = applyActions(stack, actions, elementWithIndex);

    prevPath = enrichedPath;
  }

  // Final cleanup - process remaining exits back to root
  const finalActions = calculateActions(prevPath, []);
  const finalElement: Record<string, unknown> = { index };
  stack = applyActions(stack, finalActions, finalElement);

  // Should have exactly one element on stack - the completed schema
  if (stack.length !== 1) {
    throw new Error(`Invalid stack state: expected 1 element, got ${stack.length}`);
  }

  const normalized = normalizeSchema(stack[0]);
  return normalized as FHIRSchema;
}

export { calculateActions } from './action-calculator.js';
export { expandChoiceElement, isChoiceElement } from './choice-handler.js';
export { transformElement } from './element-transformer.js';
// Export all modules for testing
export { enrichPath, getCommonPath, parsePath } from './path-parser.js';
export { applyActions } from './stack-processor.js';
