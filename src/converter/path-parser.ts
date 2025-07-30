import { StructureDefinitionElement, PathComponent } from './types';

export function parsePath(element: StructureDefinitionElement): PathComponent[] {
  const pathParts = element.path.split('.');
  // Skip the first part (resource type)
  const relevantParts = pathParts.slice(1);
  
  const path = relevantParts.map(part => ({ el: part } as PathComponent));
  
  if (path.length === 0) {
    return [];
  }
  
  // Add slicing/sliceName info to the last component
  const lastIndex = path.length - 1;
  const pathItem: any = {};
  
  if (element.slicing) {
    pathItem.slicing = {
      ...element.slicing
    };
    if (element.min !== undefined) {
      pathItem.slicing.min = element.min;
    }
    if (element.max && element.max !== '*') {
      pathItem.slicing.max = parseInt(element.max);
    }
  }
  
  if (element.sliceName) {
    pathItem.slice = {};
    if (element.min !== undefined) {
      pathItem.slice.min = element.min;
    }
    if (element.max && element.max !== '*') {
      pathItem.slice.max = parseInt(element.max);
    }
    pathItem.sliceName = element.sliceName;
  }
  
  path[lastIndex] = { ...path[lastIndex], ...pathItem };
  
  return path;
}

export function getCommonPath(path1: PathComponent[], path2: PathComponent[]): PathComponent[] {
  const common: PathComponent[] = [];
  const minLength = Math.min(path1.length, path2.length);
  
  for (let i = 0; i < minLength; i++) {
    if (path1[i].el === path2[i].el) {
      // Only keep the element name in common path, not slice info
      common.push({ el: path1[i].el });
    } else {
      break;
    }
  }
  
  return common;
}

export function enrichPath(prevPath: PathComponent[], newPath: PathComponent[]): PathComponent[] {
  const enriched: PathComponent[] = [];
  
  for (let i = 0; i < newPath.length; i++) {
    if (i < prevPath.length && prevPath[i].el === newPath[i].el) {
      // Merge slicing info from previous path, but prefer new slice name
      enriched.push({
        ...prevPath[i],
        ...newPath[i],
        // Only preserve slicing if not present in new path
        ...(prevPath[i].slicing && !newPath[i].slicing && { slicing: prevPath[i].slicing })
      });
    } else {
      enriched.push(newPath[i]);
    }
  }
  
  return enriched;
}