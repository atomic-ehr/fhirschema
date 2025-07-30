import {
  StructureDefinition,
  StructureDefinitionElement,
  FHIRSchema,
  ConversionContext,
  PathComponent,
  Action
} from './types';
import { parsePath, enrichPath } from './path-parser';
import { calculateActions } from './action-calculator';
import { transformElement } from './element-transformer';
import { isChoiceElement, expandChoiceElement } from './choice-handler';
import { applyActions } from './stack-processor';

function buildResourceHeader(
  structureDefinition: StructureDefinition,
  context?: ConversionContext
): FHIRSchema {
  // Build header with specific field order
  const header: any = {};
  
  // Always include these fields in order
  if (structureDefinition.description) header.description = structureDefinition.description;
  if (structureDefinition.derivation) header.derivation = structureDefinition.derivation;
  header.name = structureDefinition.name;
  header.type = structureDefinition.type;
  
  // Conditionally include other fields
  if (structureDefinition.url) header.url = structureDefinition.url;
  if (structureDefinition.version) header.version = structureDefinition.version;
  header.kind = structureDefinition.kind;
  
  // Include base for all except Element itself
  if (structureDefinition.baseDefinition && structureDefinition.type !== 'Element') {
    header.base = structureDefinition.baseDefinition;
  }
  
  if (structureDefinition.abstract) header.abstract = structureDefinition.abstract;
  header.class = determineClass(structureDefinition);
  
  // Package metadata
  if (structureDefinition.package_name) header.package_name = structureDefinition.package_name;
  if (structureDefinition.package_version) header.package_version = structureDefinition.package_version;
  if (structureDefinition.package_id) header.package_id = structureDefinition.package_id;
  if (context?.package_meta) header.package_meta = context.package_meta;
  
  return header as FHIRSchema;
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

function getRootElement(structureDefinition: StructureDefinition): StructureDefinitionElement | undefined {
  const elements = structureDefinition.differential?.element || [];
  return elements.find(e => !e.path.includes('.'));
}

function getDifferential(structureDefinition: StructureDefinition): StructureDefinitionElement[] {
  const elements = structureDefinition.differential?.element || [];
  // Filter out root element (doesn't contain '.')
  return elements.filter(e => e.path.includes('.'));
}

function normalizeSchema(schema: any, visited = new WeakSet()): any {
  if (Array.isArray(schema)) {
    // Sort arrays of strings/primitives
    if (schema.length > 0 && typeof schema[0] !== 'object') {
      return schema.sort();
    }
    // Keep object arrays as-is (they have index order)
    return schema.map(item => normalizeSchema(item, visited));
  }
  
  if (schema && typeof schema === 'object') {
    // Check for circular reference
    if (visited.has(schema)) {
      return '[Circular Reference]';
    }
    visited.add(schema);
    
    const normalized: any = {};
    const keys = Object.keys(schema).sort();
    
    for (const key of keys) {
      normalized[key] = normalizeSchema(schema[key], visited);
    }
    
    return normalized;
  }
  
  return schema;
}

export function translate(
  structureDefinition: StructureDefinition,
  context?: ConversionContext
): FHIRSchema {
  // Handle primitive types - they don't have differential elements
  if (structureDefinition.kind === 'primitive-type') {
    return normalizeSchema(buildResourceHeader(structureDefinition, context));
  }
  
  const header = buildResourceHeader(structureDefinition, context);
  const elements = getDifferential(structureDefinition);
  
  // Note: Root element constraints are not included in the output
  
  // Initialize stack with header
  let stack: any[] = [header];
  let prevPath: PathComponent[] = [];
  let elementQueue = [...elements];
  let index = 0;
  
  while (elementQueue.length > 0) {
    const element = elementQueue.shift()!;
    
    // Handle choice elements
    if (isChoiceElement(element)) {
      const expanded = expandChoiceElement(element);
      elementQueue.unshift(...expanded);
      continue;
    }
    
    // Parse and enrich path
    const parsedPath = parsePath(element);
    const enrichedPath = enrichPath(prevPath, parsedPath);
    
    // Calculate actions
    const actions = calculateActions(prevPath, enrichedPath);
    
    // Transform element
    const transformedElement = transformElement(element, structureDefinition);
    const elementWithIndex = { ...transformedElement, index: index++ };
    
    // Apply actions
    stack = applyActions(stack, actions, elementWithIndex);
    
    prevPath = enrichedPath;
  }
  
  // Final cleanup - process remaining exits back to root
  const finalActions = calculateActions(prevPath, []);
  stack = applyActions(stack, finalActions, { index });
  
  // Should have exactly one element on stack - the completed schema
  if (stack.length !== 1) {
    throw new Error(`Invalid stack state: expected 1 element, got ${stack.length}`);
  }
  
  return normalizeSchema(stack[0]);
}

// Export all modules for testing
export { parsePath, enrichPath, getCommonPath } from './path-parser';
export { calculateActions } from './action-calculator';
export { transformElement } from './element-transformer';
export { isChoiceElement, expandChoiceElement } from './choice-handler';
export { applyActions } from './stack-processor';