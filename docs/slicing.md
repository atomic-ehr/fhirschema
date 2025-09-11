# FHIR Slicing in fhirschema

This document describes how FHIR slicing is represented in fhirschema and the intended validation semantics. It aligns with the converter output and types in `src/types.ts` and the slicing behavior exercised by unit tests.

## Overview

FHIR slicing partitions an array element into named slices based on discriminators (e.g., value/pattern at some path, item type, or profile). Each slice can add constraints and its own cardinality, while the parent element retains overall array cardinality and shared rules.

## Schema Representation

On any array element, slicing is represented on the element itself:

- `elements.<name>.slicing`:
  - `discriminator`: array of `{ type, path }` (value | pattern | type | profile)
  - `rules`: `closed | open | openAtEnd`
  - `ordered`: boolean (whether slice order matters)
  - `slices`: map of slice name → slice descriptor

Each slice descriptor contains:

- `match`: normalized discriminator fingerprint used to assign items to this slice
- `schema`: element schema overlay for items of this slice (merged with parent element schema)
- `min` / `max`: slice-specific cardinality for item counts (independent of the parent array’s `min`/`max`)

Example (pattern slicing by a child field):

```jsonc
{
  "elements": {
    "x": {
      "array": true,
      "slicing": {
        "discriminator": [{ "type": "pattern", "path": "a" }],
        "rules": "open",
        "ordered": false,
        "slices": {
          "s1": { "match": { "a": "s1" }, "schema": { /* slice constraints */ } },
          "s2": { "match": { "a": "s2" }, "schema": { /* slice constraints */ } }
        }
      }
    }
  }
}
```

Example (nested reslicing):

```jsonc
{
  "elements": {
    "x": {
      "array": true,
      "slicing": { "discriminator": [{ "type": "pattern", "path": "a" }], "slices": { "s1": {
        "schema": {
          "elements": {
            "b": {
              "slicing": {
                "discriminator": [{ "type": "pattern", "path": "f.ff" }],
                "slices": {
                  "z1": { "match": { "f": { "ff": { "code": "z1" } } } },
                  "z2": { "match": { "f": { "ff": { "code": "z2" } } } }
                }
              }
            }
          }
        }
      }}}
    }
  }
}
```

Example (extension slicing by URL):

```jsonc
{
  "elements": {
    "extension": {
      "array": true,
      "slicing": {
        "discriminator": [{ "type": "value", "path": "url" }],
        "rules": "open",
        "slices": {
          "race": { "match": { "url": "http://hl7.org/fhir/us/core/StructureDefinition/us-core-race" }, "min": 1, "max": 1 },
          "ethnicity": { "match": { "url": "http://hl7.org/fhir/us/core/StructureDefinition/us-core-ethnicity" }, "max": 1 }
        }
      },
      // Convenience sugar for consumers; derived from slicing
      "extensions": {
        "race": { "url": "http://hl7.org/fhir/us/core/StructureDefinition/us-core-race", "min": 1, "max": 1 },
        "ethnicity": { "url": "http://hl7.org/fhir/us/core/StructureDefinition/us-core-ethnicity", "max": 1 }
      }
    }
  }
}
```

## Matching Semantics

- Discriminator types supported:
  - `pattern`: compare a nested value at `path` to the slice’s `match` value
  - `value`: same as pattern for most scalar cases (path points to a single property)
  - `type`: assign based on item’s type name (e.g., `'Quantity'`); represented as `match: { type: "Quantity" }`
  - `profile`: assign based on declared profiles; represented as `match: { profile: ["canonical-URL"] }`
- `$this` path means the entire item is matched against the slice’s `pattern` payload
- Arrays in `match` imply “contains” semantics: item’s value must contain a sub-value that deep-equals the corresponding array entry
- Scalars and objects use deep-equality for comparison

## Validation Semantics

1. Parent array validation:
   - Enforce parent element `min`/`max` cardinality on total item count
2. Slice classification:
   - For each array item, compute discriminator fingerprint(s) and compare to each slice’s `match`
   - If multiple slices match → discriminator ambiguity error
   - If none match:
     - `rules: closed` → error (unmatched item)
     - `rules: open | openAtEnd` → allowed
   - If `ordered: true`, slice order must follow `slicesOrder` (see below) or, if absent, the declaration order
3. Slice cardinality:
   - Count items assigned to each slice and enforce slice `min`/`max`
4. Item validation:
   - Effective schema = shallow-merge of parent element schema and `slice.schema` (slice overrides)
   - Validate items with the effective schema as if it were a normal element

## Type Notes & Refinements

The current types in `src/types.ts` include:

- `FHIRSchemaSlicing` with `discriminator`, `rules`, `ordered`, `slices`
- Each slice holds `{ match?, schema?, min?, max? }`

Suggested refinements (backward compatible):

- `slicesOrder?: string[]` on `FHIRSchemaSlicing` to make ordering explicit when `ordered === true`
- Consider introducing a typed union for `match` for authoring clarity, while retaining normalized object internally:
  - `$this` match: `{ $this: any }`
  - Value/pattern match at path: `{ path: string, value: any }`
  - Type/profile matches: `{ type: string }`, `{ profile: string[] }`

## Reslicing

Reslicing (slicing inside a slice) is represented by placing a `slicing` block within `slice.schema.elements[...]` at the appropriate path. Slice hierarchy is preserved by the nested structure and validated recursively.

## Converter & Sugar for Extensions

The converter normalizes discriminators into `slices.*.match` objects and, for the `extension` element specifically, provides an `extensions` convenience map derived from `slicing` (see `src/converter/stack-processor.ts`). This keeps extension lookups ergonomic while preserving full slicing detail.

## Rationale

- Declarative and close to StructureDefinition semantics
- Efficient validation: classify items once, then validate with an effective schema
- Works for pattern/value, type/profile, and `$this` discriminators
- Supports reslicing and ordered slices without complicating the base model

## Open Questions

- How strict should `url`/`code`/`system` comparisons be (case sensitivity, canonical normalization)?
- Should `openAtEnd` enforce that unmatched items must appear after matched slices?
- Do we need a first-class representation for “slice excludes” beyond `rules: closed`?

**Status**: Converter support is implemented; validator slice classification and cardinality checks are planned per this spec.
