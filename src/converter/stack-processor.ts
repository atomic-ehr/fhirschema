import { Action, FHIRSchemaElement } from './types';

function popAndUpdate(stack: any[], updateFn: (parent: any, child: any) => any): any[] {
  const child = stack[stack.length - 1];
  const newStack = stack.slice(0, -1);
  const parent = newStack[newStack.length - 1];
  const updatedParent = updateFn(parent, child);
  
  return [...newStack.slice(0, -1), updatedParent];
}

function buildMatchForSlice(slicing: any, sliceSchema: any): any {
  if (!slicing.discriminator) {
    return {};
  }
  
  const match: any = {};
  
  for (const discriminator of slicing.discriminator) {
    if (!discriminator.type || !['pattern', 'value', undefined].includes(discriminator.type)) {
      continue;
    }
    
    const path = discriminator.path.trim();
    
    if (path === '$this') {
      // Merge pattern value from slice schema
      if (sliceSchema.pattern?.value) {
        Object.assign(match, sliceSchema.pattern.value);
      }
    } else {
      // Build path to pattern in nested elements
      const pathParts = path.split('.').filter((p: string) => p);
      
      // Look for pattern fields in slice schema
      const patternKeys = Object.keys(sliceSchema).filter(k => k.startsWith('pattern'));
      for (const patternKey of patternKeys) {
        const fieldName = patternKey.replace('pattern', '').toLowerCase();
        if (pathParts.length === 1 && pathParts[0] === fieldName) {
          match[fieldName] = sliceSchema[patternKey];
        }
      }
      
      // Also check nested elements
      let currentPath = ['elements'];
      
      for (const part of pathParts) {
        currentPath.push(part);
        if (pathParts.indexOf(part) < pathParts.length - 1) {
          currentPath.push('elements');
        }
      }
      
      currentPath.push('pattern');
      
      // Get value from slice schema
      let value = sliceSchema;
      for (const segment of currentPath) {
        value = value?.[segment];
      }
      
      if (value?.value !== undefined) {
        // Set value in match object
        let matchTarget = match;
        for (let i = 0; i < pathParts.length - 1; i++) {
          if (!matchTarget[pathParts[i]]) {
            matchTarget[pathParts[i]] = {};
          }
          matchTarget = matchTarget[pathParts[i]];
        }
        matchTarget[pathParts[pathParts.length - 1]] = value.value;
      }
    }
  }
  
  return match;
}

function buildSliceNode(sliceSchema: any, match: any, slice: any): any {
  const node: any = {
    match,
    schema: sliceSchema
  };
  
  if (slice?.min !== undefined && slice.min !== 0) {
    node.min = slice.min;
  }
  
  if (slice?.max !== undefined) {
    node.max = slice.max;
  }
  
  return node;
}

function buildSlice(action: any, parent: any, sliceSchema: any): any {
  const slicingInfo = parent.slicing || action.slicing || {};
  const match = buildMatchForSlice(slicingInfo, sliceSchema);
  const sliceNode = buildSliceNode(sliceSchema, match, action.slice);
  
  if (!parent.slicing) {
    parent.slicing = {};
  }
  
  if (action.slicing) {
    parent.slicing = { ...parent.slicing, ...action.slicing };
  }
  
  if (!parent.slicing.slices) {
    parent.slicing.slices = {};
  }
  
  parent.slicing.slices[action.sliceName] = sliceNode;
  
  return parent;
}

function slicingToExtensions(slicingElement: any): any {
  if (!slicingElement.slicing?.slices) {
    return {};
  }
  
  const extensions: any = {};
  
  for (const [sliceName, slice] of Object.entries(slicingElement.slicing.slices)) {
    const { match, schema, ...sliceProps } = slice as any;
    // Clean up schema properties
    const { slicing, elements, type, min, ...cleanSchema } = schema || {};
    
    const extension: any = {};
    if (match?.url) {
      extension.url = match.url;
    }
    
    // Add slice properties (min, max) - skip min if 0
    if (sliceProps.min !== undefined && sliceProps.min !== 0) {
      extension.min = sliceProps.min;
    }
    if (sliceProps.max !== undefined) {
      extension.max = sliceProps.max;
    }
    
    // Add clean schema properties
    Object.assign(extension, cleanSchema);
    
    // Add min from schema if not 0 and not already added from sliceProps
    if (min !== undefined && min !== 0 && extension.min === undefined) {
      extension.min = min;
    }
    
    extensions[sliceName] = extension;
  }
  
  return extensions;
}

function addElement(elementName: string, parent: any, child: any): any {
  const updated = { ...parent };
  
  // Special handling for extension elements
  if (elementName === 'extension') {
    updated.extensions = slicingToExtensions(child);
  }
  
  // Initialize elements if needed
  if (!updated.elements) {
    updated.elements = {};
  }
  
  // Determine actual element name (handle choiceOf)
  const actualElementName = child.choiceOf || elementName;
  
  // Remove internal _required flag before adding
  const { _required, ...cleanChild } = child;
  updated.elements[elementName] = cleanChild;
  
  // Add to required array if needed
  if (_required) {
    if (!updated.required) {
      updated.required = [];
    }
    if (!updated.required.includes(actualElementName)) {
      updated.required.push(actualElementName);
    }
  }
  
  return updated;
}

export function applyActions(
  stack: any[],
  actions: Action[],
  value: any
): any[] {
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
          addElement(action.el, parent, child)
        );
        break;
        
      case 'exit-slice':
        currentStack = popAndUpdate(currentStack, (parent, child) => 
          buildSlice(action, parent, child)
        );
        break;
    }
  }
  
  return currentStack;
}