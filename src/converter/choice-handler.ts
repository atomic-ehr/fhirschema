import type { StructureDefinitionElement } from './types.js';

export function isChoiceElement(element: StructureDefinitionElement): boolean {
  if (element.path.endsWith('[x]')) {
    return true;
  }

  // Check if multiple types with different codes
  if (element.type && element.type.length > 1) {
    const uniqueCodes = new Set(element.type.map((t) => t.code));
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

function isChoiceTypeSlicingRoot(element: StructureDefinitionElement): boolean {
  if (!element.path.endsWith('[x]') || element.sliceName) return false;
  const discriminator = element.slicing?.discriminator;
  return (
    !!discriminator &&
    discriminator.length === 1 &&
    discriminator[0].type === 'type' &&
    discriminator[0].path.trim() === '$this'
  );
}

/**
 * Collapse type slicing on choice elements ($this type discriminator) into the
 * plain choice representation: the sliced element becomes the choice declaration
 * (accumulating every variant in `choices` and keeping the slicing metadata so
 * open/closed rules survive), and each slice becomes a regular typed variant
 * element. Children of a slice are re-parented under its variant element.
 */
export function collapseChoiceTypeSlicing(
  elements: StructureDefinitionElement[],
): StructureDefinitionElement[] {
  const result: StructureDefinitionElement[] = [];
  let i = 0;

  while (i < elements.length) {
    const element = elements[i];
    if (!isChoiceTypeSlicingRoot(element)) {
      result.push(element);
      i++;
      continue;
    }

    const rootPath = element.path;
    const basePath = rootPath.replace(/\[x\]$/, '');
    const fieldName = basePath.split('.').pop() || '';
    const { slicing, type, ...rootRest } = element;

    const choices = (type || []).map((t) => fieldName + capitalize(canonicalToName(t.code)));
    const slicedVariants = new Set<string>();
    const collapsed: StructureDefinitionElement[] = [];
    let variantPath: string | undefined;

    let j = i + 1;
    for (; j < elements.length && elements[j].path.startsWith(rootPath); j++) {
      const el = elements[j];
      if (el.path === rootPath && el.sliceName && el.type?.length === 1) {
        const typeName = capitalize(canonicalToName(el.type[0].code));
        const variantName = fieldName + typeName;
        variantPath = basePath + typeName;
        if (!choices.includes(variantName)) choices.push(variantName);
        slicedVariants.add(variantName);
        const { sliceName, ...sliceRest } = el;
        collapsed.push({ ...sliceRest, path: variantPath, choiceOf: fieldName });
      } else if (el.path.startsWith(`${rootPath}.`) && variantPath) {
        collapsed.push({ ...el, path: variantPath + el.path.slice(rootPath.length) });
      } else {
        collapsed.push(el);
        variantPath = undefined;
      }
    }

    result.push({ ...rootRest, path: basePath, choices, _choiceSlicing: slicing });

    // Explicit root types without a matching slice keep plain variant elements,
    // mirroring expandChoiceElement for unsliced choice elements.
    for (const t of type || []) {
      const typeName = capitalize(canonicalToName(t.code));
      if (slicedVariants.has(fieldName + typeName)) continue;
      const { binding, ...variantRest } = rootRest;
      result.push({ ...variantRest, path: basePath + typeName, type: [t], choiceOf: fieldName });
    }
    result.push(...collapsed);
    i = j;
  }

  return result;
}

export function expandChoiceElement(
  element: StructureDefinitionElement,
): StructureDefinitionElement[] {
  const basePath = element.path.replace(/\[x\]$/, '');
  const fieldName = basePath.split('.').pop() || '';

  if (!element.type) {
    return [];
  }

  const expanded: StructureDefinitionElement[] = [];

  // Create the parent choice element
  const choices = element.type.map((t) => fieldName + capitalize(canonicalToName(t.code)));
  const { type, binding, ...restElement } = element;
  const parentElement: StructureDefinitionElement = {
    ...restElement,
    path: basePath,
    choices: choices, // Preserve original order
  };
  expanded.push(parentElement);

  // Create typed elements
  for (const type of element.type) {
    const typeName = capitalize(canonicalToName(type.code));
    const typedElement: StructureDefinitionElement = {
      ...element,
      path: basePath + typeName,
      type: [type],
      choiceOf: fieldName,
    };
    // Remove binding if it exists, it will be handled specially
    if (element.binding) {
      delete typedElement.binding;
    }
    expanded.push(typedElement);
  }

  return expanded;
}
