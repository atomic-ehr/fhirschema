# StructureDefinition to FHIRSchema Converter Algorithm

## Overview

The converter uses a stack-based algorithm to transform the flat list of differential elements into the nested FHIRSchema structure. This approach efficiently handles the complex path relationships and slicing definitions found in StructureDefinitions.

## Core Algorithm Components

### 1. Path Processing

The algorithm processes element paths to understand structure:

#### Path Parsing
Each element path is split into components:
- `Patient.contact.name` → `["contact", "name"]`
- Skip the resource type prefix
- Each component becomes a navigation point

#### Path Enrichment
Paths are enriched with context from previous paths:
- Slicing information is inherited
- Array indicators are preserved
- Slice names are propagated

### 2. Action Calculation

The algorithm calculates enter/exit actions by comparing paths:

#### Common Path Detection
Find the longest common prefix between two paths:
- Previous: `["contact", "name", "given"]`
- Current: `["contact", "telecom"]`
- Common: `["contact"]`

#### Exit Actions
Generate exits from previous path back to common path:
- Exit from "given"
- Exit from "name"
- Stop at "contact" (common ancestor)

#### Enter Actions
Generate enters from common path to current path:
- Enter into "telecom"

#### Slice Handling
Special actions for entering/exiting slices:
- exit-slice: When leaving a sliced element
- enter-slice: When entering a new slice

### 3. Stack-Based Processing

The algorithm maintains a value stack:

#### Stack Structure
- Bottom: Root schema being built
- Middle: Intermediate elements
- Top: Current element being processed

#### Stack Operations

##### ENTER Action
1. Push current value onto stack
2. Value becomes context for children
3. Empty object pushed if more enters follow

##### EXIT Action
1. Pop value from stack
2. Process the popped value
3. Add to parent element's structure

##### ENTER-SLICE Action
1. Push slice definition onto stack
2. Track slice context

##### EXIT-SLICE Action
1. Pop slice definition
2. Build slice structure
3. Add to parent's slicing configuration

### 4. Element Processing Flow

For each element in differential:

#### Step 1: Path Analysis
1. Parse element path into components
2. Enrich with previous path context
3. Identify if element is choice type

#### Step 2: Choice Type Expansion
If element has [x] suffix:
1. Extract choice options from types
2. Create expanded elements for each type
3. Queue expanded elements for processing
4. Skip original element

#### Step 3: Action Generation
1. Compare current path with previous
2. Calculate exit actions
3. Calculate enter actions
4. Combine into action sequence

#### Step 4: Element Transformation
1. Convert element to FHIRSchema format
2. Apply conversion rules
3. Attach to current stack position

#### Step 5: Action Execution
1. Process each action in sequence
2. Maintain stack state
3. Build nested structure

### 5. Detailed Action Processing

#### Processing EXIT Actions

When exiting an element:
1. **Pop** completed element from stack
2. **Determine** parent element from stack
3. **Add** to parent's elements map
4. **Update** parent's required array if needed

#### Processing EXIT-SLICE Actions

When exiting a slice:
1. **Pop** slice definition from stack
2. **Build** slice match criteria from discriminator
3. **Create** slice entry with schema and constraints
4. **Add** to parent's slicing.slices map

#### Building Match Criteria

For discriminator-based matching:
1. **Extract** discriminator paths
2. **Resolve** pattern values from schema
3. **Build** match object with path-value pairs
4. **Handle** $this discriminator specially

### 6. Special Case Handling

#### Extension Slicing
When element is "extension" with slicing:
1. Transform slices to extension map
2. Use extension URL as key
3. Preserve slice constraints

#### Primitive Extensions
Shadow properties (_element) handled by:
1. Checking for primitive base type
2. Creating extension structure
3. Allowing standard validation

#### Content References
Circular references resolved by:
1. Converting to element path
2. Creating elementReference
3. Allowing lazy resolution

#### Backbone Elements
Inline complex types handled by:
1. Treating as nested structure
2. Processing all child elements
3. No special type registration

### 7. Post-Processing

After all elements processed:

#### Final Exit
1. Process remaining exits to root
2. Ensure single element on stack
3. Extract completed schema

#### Normalization
1. Sort arrays for consistency
2. Convert sets to arrays
3. Ensure stable output

## Algorithm Pseudocode

```
FUNCTION convertToFHIRSchema(structureDefinition):
    schema = createHeader(structureDefinition)
    stack = [schema]
    previousPath = []
    
    FOR each element IN structureDefinition.differential.element:
        IF isChoiceType(element):
            expandedElements = expandChoiceType(element)
            INSERT expandedElements INTO remaining elements
            CONTINUE
        
        currentPath = parsePath(element)
        enrichedPath = enrichPath(previousPath, currentPath)
        actions = calculateActions(previousPath, enrichedPath)
        
        transformedElement = transformElement(element)
        
        FOR each action IN actions:
            CASE action.type:
                WHEN "enter":
                    stack.push(nextValue)
                WHEN "exit":
                    completed = stack.pop()
                    parent = stack.top()
                    addElementToParent(parent, completed, action.element)
                WHEN "enter-slice":
                    stack.push(sliceContext)
                WHEN "exit-slice":
                    sliceData = stack.pop()
                    parent = stack.top()
                    buildSlice(parent, sliceData, action)
        
        previousPath = enrichedPath
    
    finalActions = calculateActions(previousPath, [])
    processActions(stack, finalActions)
    
    RETURN stack[0]
```

## Performance Optimizations

### Path Caching
- Cache parsed paths
- Reuse common path calculations
- Minimize string operations

### Batch Processing
- Group related elements
- Process siblings together
- Reduce stack operations

### Early Termination
- Skip processing for primitive types
- Bypass empty differentials
- Avoid unnecessary transformations

## Error Recovery

### Malformed Paths
- Validate path structure
- Provide meaningful errors
- Continue processing remaining elements

### Stack Inconsistencies
- Verify stack depth
- Ensure balanced enter/exit
- Reset on critical errors

### Type Resolution Failures
- Track unresolved types
- Provide diagnostic information
- Use fallback type if available