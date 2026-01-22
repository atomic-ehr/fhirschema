# FHIRSchema Validation Specification

This document describes the FHIRSchema validation algorithm as implemented in this project.

## Overview

The validator takes a FHIR resource and validates it against a FHIRSchema profile. The result is an `OperationOutcome` resource containing any validation issues found.

```typescript
function validate(
  resource: Resource,
  profile: FHIRSchema,
  typeProfiles: { [key: string]: FHIRSchema }
): OperationOutcome
```

## Validation Algorithm

```
VALIDATE(data, spec, location, parentSlices):
  issues = []

  1. SLICING VALIDATION
     if spec.slicing is defined:
       slices = PARTITION_BY_DISCRIMINATOR(data, spec.slicing)
       for each sliceName in spec.slicing.slices:
         sliceData = slices[sliceName]
         sliceSpec = spec.slicing.slices[sliceName]
         issues += VALIDATE_CARDINALITY(sliceData, sliceSpec)
         issues += VALIDATE(sliceData, mergedSpec, sliceLocation)

  2. ARRAY ITERATION
     if data is array:
       for each item at index i:
         issues += VALIDATE(item, spec, location[i])
       return issues

  3. FIELD VALIDATION
     specFields = keys(spec.elements)
     dataFields = keys(data) - ['resourceType']

     for each field in (dataFields ∩ specFields):
       issues += VALIDATE_CARDINALITY(data[field], spec.elements[field])
       issues += VALIDATE_FIELD_TYPE(data[field], spec.elements[field])

  4. REQUIRED FIELD CHECK
     for each field in spec.required:
       if field not in dataFields:
         issues += REQUIRED_ERROR(field)

  5. EXTRA FIELD CHECK
     for each field in (dataFields - specFields):
       issues += EXTRA_FIELD_ERROR(field)

  6. CHOICE TYPE CHECK
     for each field with choices in spec.elements:
       presentChoices = choices ∩ dataFields
       if |presentChoices| > 1:
         issues += MULTIPLE_CHOICE_ERROR(field, presentChoices)

  return issues
```

## Implemented Features

### 1. Primitive Type Validation

Validates JavaScript types against FHIR primitive types.

| FHIR Type | JavaScript Type | Additional Checks |
|-----------|-----------------|-------------------|
| `string`, `code`, `id`, `markdown`, `uri`, `url`, `canonical`, `oid`, `uuid`, `base64Binary`, `xhtml`, `date`, `dateTime`, `time`, `instant` | `string` | Regex pattern if defined |
| `decimal` | `number` | - |
| `integer` | `number` | Must be integer (`Number.isInteger`) |
| `unsignedInt` | `number` | Must be integer, >= 0 |
| `positiveInt` | `number` | Must be integer, >= 1 |
| `boolean` | `boolean` | - |

**Algorithm:**
```
VALIDATE_PRIMITIVE(value, spec):
  if spec.type in STRING_TYPES and typeof(value) != 'string':
    return TYPE_ERROR
  if spec.type in NUMBER_TYPES and typeof(value) != 'number':
    return TYPE_ERROR
  if spec.type in INTEGER_TYPES and not isInteger(value):
    return TYPE_ERROR
  if spec.type == 'unsignedInt' and value < 0:
    return RANGE_ERROR
  if spec.type == 'positiveInt' and value < 1:
    return RANGE_ERROR
  if spec.regex and not value.match(spec.regex):
    return REGEX_ERROR
  return OK
```

### 2. Cardinality Validation

Validates `min` and `max` constraints on elements.

```
VALIDATE_CARDINALITY(data, spec):
  count = isArray(data) ? data.length : (data ? 1 : 0)
  if spec.min and count < spec.min:
    return MIN_CARDINALITY_ERROR
  if spec.max and count > spec.max:
    return MAX_CARDINALITY_ERROR
  return OK
```

**Error codes:** `invariant`

### 3. Required Fields

Fields listed in `spec.required` must be present in the data.

**Error codes:** `required`

### 4. Extra Field Detection

Fields in data not defined in `spec.elements` are reported as errors.

**Error codes:** `invalid`

### 5. Choice Types (value[x])

Polymorphic elements where only one variant can be present.

**Schema structure:**
```json
{
  "elements": {
    "value": { "choices": ["valueString", "valueInteger"] },
    "valueString": { "type": "string", "choiceOf": "value" },
    "valueInteger": { "type": "integer", "choiceOf": "value" }
  }
}
```

**Validation:**
- Exactly one choice variant may be present
- Multiple variants present → error
- If `min: 1` on base element, at least one variant must be present

**Error codes:** `invalid` (multiple choices), `required` (missing required choice)

### 6. Complex Type Validation

Complex types (e.g., `Coding`, `CodeableConcept`, `HumanName`) are validated recursively using their schema from `typeProfiles`.

```
VALIDATE_COMPLEX(data, spec, typeProfiles):
  schema = typeProfiles[spec.type]
  return VALIDATE(data, schema)
```

### 7. BackboneElement Validation

Inline nested structures without separate type definitions. Validated using the nested `elements` from the parent schema.

### 8. Slicing Validation

Partitions array elements into named slices based on discriminators.

**Supported discriminator types:**
- `value` - Match by fixed value or pattern
- `pattern` - Same as `value` (deprecated)

**Algorithm:**
```
PARTITION_BY_DISCRIMINATOR(data, slicing):
  slices = {}
  for each item in data:
    for each slice in slicing.slices:
      if MATCHES_DISCRIMINATOR(item, slice):
        slices[slice.name].push(item)
        break
    else:
      slices['@default'].push(item)
  return slices

MATCHES_DISCRIMINATOR(item, sliceSpec):
  for each discriminator in slicing.discriminator:
    elemValue = item[discriminator.path]
    if discriminator.type == 'value' or 'pattern':
      if sliceSpec has fixedXxx:
        return elemValue == sliceSpec.fixedXxx
      if sliceSpec has patternXxx:
        return MATCH_PATTERN(elemValue, sliceSpec.patternXxx)
  return false
```

**Pattern matching:**
```
MATCH_PATTERN(value, pattern):
  if pattern is primitive:
    return value == pattern
  if pattern is array:
    return every pattern item matches some value item
  if pattern is object:
    return every pattern key exists in value with matching value
```

---

## Deferred Validations

To keep the core validation **pure** (no I/O, no external service calls), terminology binding and reference validation are returned as "deferred" objects. The caller can then batch these lookups and resolve them externally.

### Design Rationale

1. **Purity** - Core validation remains synchronous and side-effect free
2. **Batching** - Caller can batch multiple terminology/reference lookups
3. **Flexibility** - Different terminology servers or caching strategies can be used
4. **Testability** - Easy to test validation logic without mocking services

### Deferred Types

```typescript
type Deferred = TerminologyDeferred | ReferenceDeferred;

interface TerminologyDeferred {
  type: 'terminology';
  path: string;              // FHIRPath to element
  code: string;              // The code value to validate
  system?: string;           // Code system URI (if known)
  valueSet: string;          // ValueSet URL to validate against
  strength: 'required' | 'extensible' | 'preferred' | 'example';
}

interface ReferenceDeferred {
  type: 'reference';
  path: string;              // FHIRPath to element
  reference: string;         // Reference value (e.g., "Patient/123")
  targetProfiles?: string[]; // Allowed target profile URLs
}
```

### Updated Output Format

```typescript
interface ValidationResult {
  outcome: OperationOutcome;    // Immediate validation errors
  deferred: Deferred[];         // Validations requiring external lookup
}
```

### Algorithm

```
VALIDATE(data, spec, ...):
  issues = []
  deferred = []

  // ... existing validation steps ...

  // Terminology binding check
  if spec.binding:
    deferred.push({
      type: 'terminology',
      path: location,
      code: data,
      system: data.system,          // for Coding
      valueSet: spec.binding.valueSet,
      strength: spec.binding.strength
    })

  // Reference target check
  if spec.type == 'Reference' and spec.targetProfile:
    deferred.push({
      type: 'reference',
      path: location,
      reference: data.reference,
      targetProfiles: spec.targetProfile
    })

  return { issues, deferred }
```

### Resolution Example

```typescript
// 1. Run pure validation
const { outcome, deferred } = validate(resource, schema, types);

// 2. Batch resolve deferred validations
const terminologyChecks = deferred.filter(d => d.type === 'terminology');
const referenceChecks = deferred.filter(d => d.type === 'reference');

// 3. Call external services (can be batched)
const termResults = await terminologyService.validateCodes(terminologyChecks);
const refResults = await referenceResolver.validateReferences(referenceChecks);

// 4. Merge results into final OperationOutcome
const finalOutcome = mergeResults(outcome, termResults, refResults);
```

### Terminology Binding Strengths

| Strength | Behavior |
|----------|----------|
| `required` | Code MUST be from ValueSet → error if not found |
| `extensible` | Code SHOULD be from ValueSet → warning if not found, unless from different system |
| `preferred` | Code recommended from ValueSet → informational if not found |
| `example` | No validation, examples only → no deferred created |

### Reference Validation

When `refers` (target profiles) is specified on a Reference element:

1. Extract reference value from the data
2. Create deferred validation with reference and target profiles
3. External resolver validates against allowed profiles

### Implementation Status

| Feature | Status |
|---------|--------|
| Terminology bindings (code) | ✅ Deferred |
| Terminology bindings (Coding) | ✅ Deferred |
| Terminology bindings (CodeableConcept) | ✅ Deferred |
| Reference target validation | ✅ Deferred |
| Array element paths | ✅ With indices (`field[0]`) |

---

## Not Implemented Features

### Slicing Discriminator Types

The following discriminator types are not yet supported:

| Type | Description | Status |
|------|-------------|--------|
| `exists` | Slice by presence/absence of element | ❌ Not implemented |
| `type` | Slice by type of polymorphic element | ❌ Not implemented |
| `profile` | Slice by conformance to a profile | ❌ Not implemented |
| `position` | Slice by XML element order | ❌ Not implemented |

### Slicing Rules

| Rule | Description | Status |
|------|-------------|--------|
| `open` | Unmatched items allowed | ✅ Default behavior |
| `closed` | Unmatched items not allowed | ❌ Not implemented |
| `openAtEnd` | Unmatched items must come after defined slices | ❌ Not implemented |

### Element Constraints

| Feature | Description | Status |
|---------|-------------|--------|
| `fixedXxx` | Element must equal exact value | ❌ Not implemented (only in slicing) |
| `patternXxx` | Element must match pattern | ❌ Not implemented (only in slicing) |
| `maxLength` | Maximum string length | ❌ Not implemented |
| `minValue` / `maxValue` | Numeric/date range | ❌ Not implemented |

### FHIRPath Constraints

| Feature | Description | Status |
|---------|-------------|--------|
| `constraint` | FHIRPath invariant expressions | ❌ Not implemented |

### Extensions

| Feature | Description | Status |
|---------|-------------|--------|
| Extension validation | Validate extension structure | ❌ Not implemented |
| `modifierExtension` | Special handling for modifier extensions | ❌ Not implemented |
| Primitive extensions (`_field`) | Extensions on primitive values | ❌ Not implemented |

### Other

| Feature | Description | Status |
|---------|-------------|--------|
| Contained resources | Validate contained resources | ❌ Not implemented |
| Profile inheritance | Merge base profile constraints | ❌ Not implemented |
| `mustSupport` | Track must-support elements | ❌ Not implemented |
| `isModifier` | Special handling for modifier elements | ❌ Not implemented |

---

## Error Codes

The validator uses FHIR-standard `OperationOutcome.issue.code` values:

| Code | Usage |
|------|-------|
| `invalid` | Type mismatch, regex failure, extra field, multiple choice values |
| `required` | Missing required field |
| `invariant` | Cardinality violation |
| `not-supported` | Unknown element type in schema |

## Output Format

```typescript
interface OperationOutcome {
  resourceType: 'OperationOutcome';
  issue: OperationOutcomeIssue[];
}

interface OperationOutcomeIssue {
  severity: 'error' | 'warning' | 'information';
  code: string;
  details: { text: string };
  expression: string[];  // FHIRPath to element
}
```

## File Structure

```
src/validator/
├── resource.ts      # Main validation entry point, slicing
├── primitive.ts     # Primitive type validation
├── complex.ts       # Complex type validation
├── cardinality.ts   # Min/max cardinality checks
└── fieldPath.ts     # Path formatting utilities
```
