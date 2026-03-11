# New Validator Notes

Working notes for the draft `src/new/*` validator. This file intentionally separates:
- FHIR-derived rules
- local design decisions
- still-open questions

## FHIR-derived rules

### Null handling for primitives

Context:
The draft validator has root-level primitive tests such as `validate(undefined, [{ type: "string" }], data)`.

Current rule:
- Reject `null` for root and ordinary primitive values with a type mismatch.
- Handle `null` placeholders inside repeating primitive arrays separately later.

Reason:
- In FHIR JSON, primitive values are represented by their JSON scalar types, not `null`.
- Missing primitive values are represented by omission, or by the parallel `_element` form when extensions/id exist.
- Repeating primitive arrays with `null` placeholders are a separate JSON-representation concern, not a primitive-type rule by itself.

### Primitive extensions in JSON

Context:
FHIR JSON represents primitive `id`/`extension` metadata in a sibling property prefixed with `_`, for example `birthDate` and `_birthDate`.

Current rule:
- Plan support for:
  - `field` + `_field` together for primitive values with extensions/id
  - `_field` without `field` when the primitive has no value but does have metadata
  - repeating primitive arrays with aligned `_field` arrays and `null` placeholders
- Keep validation rules for malformed alignment and non-primitive underscore siblings as separate follow-up cases.

Reason:
- This is required by the FHIR JSON representation for primitive extensions, not an optional convenience feature.
- It is distinct from ordinary primitive lexical validation and deserves separate tests.

## Design decisions

### Successful validation outcome shape

Context:
The draft validator currently uses `OperationOutcome` as the external result format.

Decision:
- Always return `OperationOutcome` with one issue:
  - `severity: "information"`
  - `code: "informational"`
  - `details.text: "Validation succeeded"`

Reason:
- `OperationOutcome.issue` is required and not naturally modeled as an empty array.
- `severity: "success"` is not available in FHIR R4.
- `information` works for both R4 and R6.

### Runtime behavior before implementation

Context:
The semantic test suite already describes intended validation behavior, but the new validator is still a stub.

Decision:
- Return `OperationOutcome` with:
  - `severity: "error"`
  - `code: "not-supported"`
  - `details.text: "New validator is not implemented yet"`

Reason:
- It is explicit at runtime.
- It preserves the external `OperationOutcome` contract.
- The semantic tests can stay red instead of being hidden behind `todo`.

## Open questions

### Root primitive error path

Context:
`validate(undefined, [{ type: "string" }], 123)` validates a primitive at the root, not a named field.

Question:
Should the produced `OperationOutcome.issue` contain an `expression` / logical path?

Current choice:
- Omit `expression` and avoid inventing a fake field name like `"value"`.

Alternative options:
- Use a dedicated root marker such as `"$"`.
- Use a human-only marker such as `"<root>"`.

Reason:
- The input shape does not provide a field name.
- A fabricated path hides an unresolved contract question instead of documenting it.
