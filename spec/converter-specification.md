# StructureDefinition to FHIRSchema Converter Specification

## Overview

The converter transforms FHIR StructureDefinitions into the simplified FHIRSchema format. This conversion process preserves all validation semantics while creating a more efficient representation.

## Input Format

### StructureDefinition
The converter accepts standard FHIR StructureDefinition resources with:
- **snapshot**: Complete view of all elements is not needed, we use differential only.
- **differential**: Changes from base definition (required)
- **metadata**: Resource identification and classification

## Output Format

### FHIRSchema
The converter produces FHIRSchema documents containing:
- Flattened element hierarchy
- Resolved type information
- Transformed constraints
- Optimized validation rules

## Conversion Rules

### Resource Header Mapping

StructureDefinition metadata maps to FHIRSchema header:

| StructureDefinition | FHIRSchema | Notes |
|---------------------|------------|-------|
| name | name | Direct mapping |
| type | type | Resource or datatype name |
| url | url | Canonical identifier |
| version | version | Version string |
| description | description | Human-readable text |
| baseDefinition | base | Parent definition URL |
| kind | kind | resource, complex-type, primitive-type, logical |
| derivation | derivation | specialization or constraint |
| abstract | abstract | For abstract types only |

### Classification

The converter determines schema class:
- **profile**: Constrained resource (kind=resource, derivation=constraint)
- **extension**: When type=Extension
- **resource**: Base resource definitions
- **type**: Data type definitions
- **logical**: Logical model definitions

### Element Processing

#### Path Flattening
Hierarchical paths are converted to flat element map:
- `Patient.name.given` → `elements.name.elements.given`
- Intermediate elements are created as needed

#### Cardinality Transformation
Min/max cardinality determines array handling:
- If max > 1 or max = "*": Set array=true
- If min = 1: Mark as required
- If min > 0 and array: Set min constraint
- If max != "*" and array: Set max constraint

#### Type Handling

##### Simple Types
Single type definitions are flattened:
- `type[0].code` → `type: "string"`

##### Reference Types
Reference targets are extracted:
- `type[0].targetProfile` → `refers: ["Patient", "Practitioner"]`
- Base profiles are converted to resource names

##### Choice Types
Elements with [x] suffix are expanded:
- `value[x]` with types [string, integer]
- Creates: `valueString` and `valueInteger`
- Parent element gets `choices: ["valueString", "valueInteger"]`

##### Extensions
Extension slices are transformed to extension map:
- URL from slice discriminator or pattern
- Constraints from slice definition
- Preserves min/max from slice

### Constraint Transformation

#### Required Elements
Elements with min=1 collected into required array at parent level

#### Patterns
Pattern[x] and fixed[x] converted to pattern object:
- Type extracted from suffix
- Value preserved as-is

#### FHIRPath Constraints
Constraint expressions transformed to constraint map:
- Key: constraint.key
- Value: {expression, human, severity}
- XPath constraints removed

#### Bindings
ValueSet bindings preserved with:
- strength: required, extensible, preferred, example
- valueSet: Canonical URL
- bindingName: From extension if present

### Slicing Transformation

Slicing definitions converted to:
- **discriminator**: Array of {type, path}
- **rules**: closed, open, openAtEnd
- **slices**: Map of slice definitions

Each slice contains:
- **match**: Discriminator values for matching
- **schema**: Constraints for slice
- **min/max**: Slice-specific cardinality

### Special Handling

#### Primitive Types
Primitive type definitions are mostly skipped, using base type information

#### Extensions on Extensions
Nested extension slices use slice name as key, not extension URL

#### Content References
Internal references converted to elementReference:
- `#Bundle.entry` → `["Bundle", "elements", "entry"]`

#### Backbone Elements
Inline complex types are expanded in place with all sub-elements

#### Modifier Elements
- isModifier → isModifier
- isModifierReason → isModifierReason

#### Summary Elements
- isSummary → isSummary

#### Must Support
- mustSupport → mustSupport

## Conversion Process

### Phase 1: Header Creation
1. Extract metadata from StructureDefinition
2. Determine schema classification
3. Create base FHIRSchema structure

### Phase 2: Differential Processing
1. Get differential elements (skip root element)
2. Process elements in order
3. Handle choice type expansion
4. Build nested structure

### Phase 3: Element Transformation
For each element:
1. Parse path into components
2. Apply element conversion rules
3. Handle special cases
4. Place in appropriate location

### Phase 4: Post-Processing
1. Collect required elements
2. Normalize data structures
3. Sort arrays for consistency
4. Validate output

## Edge Cases

### Multiple Types
When element has multiple types with same code:
- Treated as single type
- Profiles merged if different

### Reslicing
Slices of slices maintain hierarchy through path tracking

### Circular References
Content references may create cycles, handled through lazy resolution

### Missing Differential
If no differential, attempt to derive from snapshot

### Profile-Specific Bindings
Bindings on choice types resolved from parent element

## Validation

The converter should validate:
- All referenced types exist
- Slicing discriminators are valid
- Content references resolve
- No duplicate elements
- Cardinality constraints are logical

## Error Handling

Conversion errors should identify:
- Source StructureDefinition URL
- Element path causing error
- Specific conversion rule violated
- Suggestion for resolution