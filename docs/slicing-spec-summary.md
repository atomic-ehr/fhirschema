# Slicing Specification (Implementation)

This document describes how slicing works in the FHIRSchema validator and how to author sliced elements in schema JSON. It focuses on the concrete behavior implemented in the validator, with minimal theory.

## Where Slicing Lives

- Slicing is defined on array elements under `elements.<name>.slicing`.
- The element’s array-ness comes from the base schema (`array: true` or legacy `isArray: true`). You don’t need to repeat it in overlays that add slicing.

Example (Observation.component):

```json
{
  "elements": {
    "component": {
      "slicing": {
        "discriminator": [{ "type": "pattern", "path": "code" }],
        "rules": "open",
        "ordered": false,
        "slices": {
          "systolic": {
            "min": 1,
            "max": 1,
            "match": {
              "code": { "coding": [{ "system": "http://loinc.org", "code": "8480-6" }] }
            },
            "schema": {
              "elements": {
                "code": {
                  "pattern": {
                    "type": "CodeableConcept",
                    "value": { "coding": [{ "system": "http://loinc.org", "code": "8480-6" }] }
                  }
                },
                "valueQuantity": { "type": "Quantity" }
              },
              "required": ["code", "valueQuantity"]
            }
          },
          "diastolic": {
            "min": 1,
            "max": 1,
            "match": {
              "code": { "coding": [{ "system": "http://loinc.org", "code": "8462-4" }] }
            },
            "schema": { "required": ["code", "valueQuantity"] }
          }
        }
      }
    }
  }
}
```

## Authoring Model

- `slicing.discriminator`: Carried for documentation; not used by the current classifier. Keep it consistent with your `match` patterns.
- `slicing.rules`:
  - `open` (default): items that don’t match any slice are validated against the base (unsliced) element schema.
  - `closed`: items must match one of the defined slices; otherwise validation fails.
- `slicing.ordered`: Present for parity with FHIR, but ordering constraints are not enforced by the current validator.
- `slicing.slices.<name>`:
  - `min`/`max`: cardinality for occurrences of that slice within the array.
  - `match`: deep-partial pattern used to route an array item into this slice.
  - `schema`: overlay applied on top of the base element schema when validating items of this slice (can add `type`, `elements`, `required`, `pattern`, etc.).

## Matching Semantics (deep-partial)

Slice selection uses deep partial matching of the whole array item against the slice’s `match` object:

- Object: all keys in `match` must deep-match on the item.
- Array: every element in the `match` array must be matched by at least one element in the target array (subset check, order-insensitive).
- Primitive: strict equality.

Notes:
- If an item matches multiple slices → error (ambiguous slice).
- If an item matches no slices:
  - With `rules: closed` → error.
  - With `rules: open` → item is validated by the base schema (no slice overlay).

## Validation Algorithm (per array element)

1) Merge slicing across overlays for the element (`slices`, `rules`, `ordered`).
2) For each array item:
   - Classify by testing `match` of each slice using deep-partial matching.
   - If matched, overlay the slice `schema` on top of the base element schema and validate the item.
   - If unmatched and `rules=open`, validate against the base element schema.
   - Record occurrence counts per slice.
3) After all items:
   - Enforce each slice’s `min`/`max` using the recorded counts.

Implementation details:
- Discriminators (`type`, `path`) are not used by the classifier; `match` is the source of truth.
- Ordering is not enforced even if `ordered=true`.

## Examples from repo

1) Observation component sliced by LOINC code (systolic/diastolic)
- Source: `spec/examples/observation-with-slicing.json:46`
- Classify by matching `code.coding` entries; validate slice-specific schema (e.g., `valueQuantity`).

2) Patient identifier sliced by system (SSN)
- Source: `spec/examples/us-core-patient.json:58`
- `elements.identifier.slicing.rules = "open"` allows other identifiers; `ssn` slice enforces `system` pattern via the slice overlay:

```json
"identifier": {
  "slicing": {
    "discriminator": [{ "type": "pattern", "path": "system" }],
    "rules": "open",
    "slices": {
      "ssn": {
        "min": 0,
        "max": 1,
        "match": { "system": "http://hl7.org/fhir/sid/us-ssn" },
        "schema": {
          "type": "Identifier",
          "elements": {
            "system": {
              "pattern": { "type": "uri", "value": "http://hl7.org/fhir/sid/us-ssn" }
            }
          }
        }
      }
    }
  }
}
```

3) Extension slicing by URL (US Core Race)
- Source: `spec/examples/extension-definition.json:12`
- Discriminator uses `url` value; `match` routes items by `url`, slice schema constrains `value[x]`:

```json
"extension": {
  "slicing": {
    "discriminator": [{ "type": "value", "path": "url" }],
    "rules": "open",
    "slices": {
      "ombCategory": {
        "min": 0,
        "max": 5,
        "match": { "url": "ombCategory" },
        "schema": {
          "elements": {
            "url": { "pattern": { "type": "uri", "value": "ombCategory" } },
            "valueCoding": { "type": "Coding" }
          },
          "required": ["url", "valueCoding"]
        }
      },
      "text": {
        "min": 1,
        "max": 1,
        "match": { "url": "text" },
        "schema": { "required": ["url", "valueString"] }
      }
    }
  }
}
```

## Closed slicing example (minimal)

```json
{
  "elements": {
    "category": {
      "slicing": {
        "rules": "closed",
        "slices": {
          "foo": { "match": { "coding": [{ "code": "foo" }] }, "min": 1 },
          "bar": { "match": { "coding": [{ "code": "bar" }] }, "max": 1 }
        }
      }
    }
  }
}
```

- Any `category` item not matching `foo` or `bar` is invalid (closed).
- Counts across all items must satisfy each slice’s `min`/`max`.

## Practical tips

- Prefer small `match` objects that uniquely identify the slice but do not over-constrain (the slice `schema` handles constraint specifics).
- Ensure `match` patterns don’t overlap across slices; overlapping matches cause “ambiguous slice” errors.
- When `rules=open`, keep the base element schema permissive enough for non-sliced items you expect to allow.
- For extension slicing, route by `url` in `match` and constrain the `url` again via slice `schema.pattern` for defense in depth.

---

Reference files in this repo:
- `spec/examples/observation-with-slicing.json`
- `spec/examples/us-core-patient.json`
- `spec/examples/extension-definition.json`
- Background: `spec/profiling.md` (FHIR slicing overview)
