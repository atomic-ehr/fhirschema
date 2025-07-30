import { StructureDefinitionElement } from './types';

export function isChoiceElement(element: StructureDefinitionElement): boolean {
  if (element.path.endsWith('[x]')) {
    return true;
  }
  
  // Check if multiple types with different codes
  if (element.type && element.type.length > 1) {
    const uniqueCodes = new Set(element.type.map(t => t.code));
    return uniqueCodes.size > 1;
  }
  
  return false;
}

function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function canonicalToName(url: string): string {
  const parts = url.split('/');
  return parts[parts.length - 1];
}

export function expandChoiceElement(element: StructureDefinitionElement): StructureDefinitionElement[] {
  const basePath = element.path.replace(/\[x\]$/, '');
  const fieldName = basePath.split('.').pop() || '';
  
  if (!element.type) {
    return [];
  }
  
  const expanded: StructureDefinitionElement[] = [];
  
  // Create the parent choice element
  const choices = element.type.map(t => fieldName + capitalize(canonicalToName(t.code)));
  const { type, binding, ...restElement } = element;
  const parentElement: StructureDefinitionElement = {
    ...restElement,
    path: basePath,
    choices: choices.sort() // Sort choices for consistent output
  };
  expanded.push(parentElement);
  
  // Create typed elements
  for (const type of element.type) {
    const typeName = capitalize(canonicalToName(type.code));
    const typedElement: StructureDefinitionElement = {
      ...element,
      path: basePath + typeName,
      type: [type],
      choiceOf: fieldName
    };
    // Remove binding if it exists, it will be handled specially
    if (element.binding) {
      delete typedElement.binding;
    }
    expanded.push(typedElement);
  }
  
  return expanded;
}