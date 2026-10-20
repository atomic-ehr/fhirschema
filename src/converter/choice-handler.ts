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

const FIXED_OR_PATTERN_KEY = /^(fixed|pattern)[A-Z]/;

function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function canonicalToName(url: string): string {
  const parts = url.split('/');
  return parts[parts.length - 1];
}

function isTypeThisSlicing(slicing: StructureDefinitionElement['slicing']): boolean {
  const discriminator = slicing?.discriminator;
  return (
    !!discriminator &&
    discriminator.length === 1 &&
    discriminator[0].type === 'type' &&
    discriminator[0].path.trim() === '$this'
  );
}

/**
 * Where a run of choice type slicing starts: `root` for the choice element itself
 * (slicing declared by $this type, or left implied before its type slices), `slice`
 * for a type slice whose root the differential omits — FHIR implies type/$this
 * open slicing on choice elements, so neither form has to declare it.
 */
function choiceTypeSlicingStart(
  elements: StructureDefinitionElement[],
  i: number,
): 'root' | 'slice' | undefined {
  const element = elements[i];
  if (!element.path.endsWith('[x]')) return undefined;
  if (element.sliceName) return element.type?.length === 1 ? 'slice' : undefined;
  if (element.slicing) return isTypeThisSlicing(element.slicing) ? 'root' : undefined;
  const next = elements[i + 1];
  return next?.path === element.path && next.sliceName ? 'root' : undefined;
}

/**
 * Collapse type slicing on choice elements ($this type discriminator, declared or
 * implied) into the plain choice representation: the sliced element becomes the
 * choice declaration (keeping declared slicing metadata so open/closed rules
 * survive), and each slice becomes a regular typed variant element. Children of
 * a slice are re-parented under its variant element. A differential that omits
 * the root yields only the variants.
 *
 * `choices` is derived only from the explicit ElementDefinition.type ceiling —
 * never from slice names. Slices constrain types the element already allows, so
 * for a typed root the slice set adds nothing, and for an untyped root under
 * open rules the slices are additive documentation: emitting them as `choices`
 * would misstate the allowed set (the inherited ceiling stays in effect).
 */
export function collapseChoiceTypeSlicing(
  elements: StructureDefinitionElement[],
): StructureDefinitionElement[] {
  const result: StructureDefinitionElement[] = [];
  let i = 0;

  while (i < elements.length) {
    const element = elements[i];
    const start = choiceTypeSlicingStart(elements, i);
    if (!start) {
      result.push(element);
      i++;
      continue;
    }

    const rootPath = element.path;
    const basePath = rootPath.replace(/\[x\]$/, '');
    const fieldName = basePath.split('.').pop() || '';
    const { slicing, type, ...rootRest } =
      start === 'root' ? element : ({} as StructureDefinitionElement);

    const choices = (type || []).map((t) => fieldName + capitalize(canonicalToName(t.code)));
    const slicedVariants = new Set<string>();
    const collapsed: StructureDefinitionElement[] = [];
    let variantPath: string | undefined;

    let j = start === 'root' ? i + 1 : i;
    for (; j < elements.length && elements[j].path.startsWith(rootPath); j++) {
      const el = elements[j];
      if (el.path === rootPath && el.sliceName && el.type?.length === 1) {
        const typeName = capitalize(canonicalToName(el.type[0].code));
        variantPath = basePath + typeName;
        slicedVariants.add(fieldName + typeName);
        const { sliceName, ...sliceRest } = el;
        collapsed.push({ ...sliceRest, path: variantPath, choiceOf: fieldName });
      } else if (el.path.startsWith(`${rootPath}.`) && variantPath) {
        collapsed.push({ ...el, path: variantPath + el.path.slice(rootPath.length) });
      } else {
        collapsed.push(el);
        variantPath = undefined;
      }
    }

    if (start === 'root') {
      result.push({
        ...rootRest,
        path: basePath,
        ...(choices.length > 0 ? { choices } : {}),
        _choiceSlicing: slicing,
      });
    }

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
  // A fixed[x]/pattern[x] value is typed, so it constrains the variants, not the declaration
  const declarationRest = Object.fromEntries(
    Object.entries(restElement).filter(([key]) => !FIXED_OR_PATTERN_KEY.test(key)),
  );
  const parentElement: StructureDefinitionElement = {
    ...declarationRest,
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
