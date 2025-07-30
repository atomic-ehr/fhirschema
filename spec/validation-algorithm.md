# FHIRSchema Validation Algorithm

## Overview

The FHIRSchema validation algorithm is designed to efficiently validate FHIR resources against one or more schemas. It uses a cooperative approach where multiple schemas can contribute to the validation of a single resource.

## High-Level Algorithm

The validation process follows these main steps:

1. **Schema Resolution**: Resolve all referenced schemas
2. **Rule Grouping**: Group validation rules by type
3. **Rule Evaluation**: Evaluate rules in the appropriate order
4. **Recursive Validation**: For complex elements, recursively validate sub-elements
5. **Error Collection**: Aggregate all validation errors

## Detailed Algorithm Steps

### 1. Initialize Validation Context

The validation context maintains:
- **schemas**: Set of schemas applying to current element
- **path**: Current location in the resource being validated
- **errors**: Collection of validation errors
- **ctx**: Global context with schema registry

### 2. Schema Resolution Phase

For each element being validated:
1. Start with explicitly provided schemas
2. Add schemas based on:
   - **resourceType**: If validating a resource, resolve schema for its type
   - **meta.profile**: Add schemas for each declared profile
   - **type**: For typed elements, resolve type schemas
   - **url**: For extensions, resolve extension definitions
3. If any schema cannot be resolved, add resolution error

### 3. Value-Level Validation

Before validating structure, validate the current value:

#### 3.1 Add Dynamic Schemas
Based on the data being validated, additional schemas may apply:
- For resources with resourceType, add that resource's schema
- For resources with meta.profile, add profile schemas
- For typed elements, add type schemas

#### 3.2 Type Validation
If schemas specify type constraints:
- Verify the value matches expected type
- For primitive types, check format validity
- For complex types, ensure value is an object

#### 3.3 Required Elements
Check all required elements from all applicable schemas:
- Element is present with non-null value, OR
- Primitive extension (_element) is present
- Missing required elements generate errors

#### 3.4 Excluded Elements  
Verify no excluded elements are present

#### 3.5 Pattern Matching
If pattern constraints exist:
- Compare value against specified pattern
- Pattern must match exactly

#### 3.6 Choice Type Validation
For choice elements:
- Ensure only one choice option is present
- Verify the chosen option is allowed

#### 3.7 Constraint Evaluation
Execute FHIRPath constraints:
- Evaluate expression against current value
- Generate error or warning based on severity

### 4. Structural Validation

For complex (object) values:

#### 4.1 Element Iteration
For each property in the data:
1. Check for element schemas
2. Handle primitive extensions
3. Validate unknown elements

#### 4.2 Element Schema Resolution
For each element:
1. Gather all schemas that define this element
2. If no schemas found and not in open-world mode, report unknown element
3. For primitive extensions (_element), use primitive schema

#### 4.3 Array Handling
Determine if element should be array:
- Check array flag in element schemas
- If expecting array but got single value, report error
- If expecting single value but got array, report error

#### 4.4 Array-Level Rules
For array elements, before validating items:
- **min/max validation**: Check cardinality constraints
- **slicing validation**: Apply slicing rules if defined

#### 4.5 Recursive Validation
- For single values: Validate with element schemas
- For arrays: Validate each item with element schemas
  - Include index in path for error reporting
  - Skip null items if primitive extension exists

### 5. Slicing Algorithm

When slicing is defined:

#### 5.1 Discriminator Evaluation
For each slice discriminator:
- Extract discriminator value from item
- Match against slice definitions

#### 5.2 Slice Assignment
- Assign items to matching slices
- Track items that don't match any slice

#### 5.3 Slice Validation
For each slice:
- Validate min/max cardinality
- Validate items against slice-specific schemas

### 6. Error Reporting

Errors include:
- **type**: Error category
- **path**: Location in resource
- **message**: Human-readable description
- **schema-path**: Location in schema that triggered error

Error types include:
- **schema/unknown**: Referenced schema not found
- **type/unknown**: Referenced type not found
- **element/unknown**: Element not defined in schema
- **type**: Value has wrong type
- **type/array**: Expected array or single value
- **min/max**: Cardinality constraint violation
- **require**: Required element missing
- **pattern**: Pattern mismatch
- **choice/excluded**: Invalid choice element
- **choices/multiple**: Multiple choice elements present

## Special Handling

### Primitive Extensions
When validating primitive values with extensions:
1. The main element validates the primitive value
2. The _element validates the extension structure
3. Null values are allowed if extension is present

### Contained Resources
Resources in the contained array are validated:
- Against Resource type schema
- Against their specific resourceType schema
- Against any declared profiles

### Bundle Entry Resources
Bundle.entry.resource elements are validated:
- As resources based on their resourceType
- Against any profiles declared in meta

### Reference Validation
References are validated:
- Type must be Reference
- If refers is specified, target must match allowed types
- Reference structure follows Reference type rules

## Performance Considerations

The algorithm optimizes performance through:
- **Early termination**: Stop validating if critical errors found
- **Schema caching**: Resolved schemas are cached
- **Batch validation**: Related rules evaluated together
- **Minimal traversal**: Each element visited only once

## Extension Points

The algorithm provides extension through:
- **Custom validators**: Type-specific validation logic
- **Rule plugins**: Additional validation rules
- **Error handlers**: Custom error formatting
- **Schema loaders**: Custom schema resolution