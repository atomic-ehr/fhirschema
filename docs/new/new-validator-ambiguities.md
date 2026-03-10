# New Validator Ambiguities

Short log of unresolved contract details for the draft `src/new/*` validator.

## Root primitive error path

Context:
`validate(undefined, [{ type: "string" }], 123)` validates a primitive at the root, not a named field.

Ambiguity:
Should the produced `OperationOutcome.issue` contain an `expression` / logical path?

Options:
- Omit `expression` for root primitive validation errors.
- Use a dedicated root marker such as `"$"`.
- Use a human-only marker such as `"<root>"`.

Current choice:
- Omit `expression` and avoid inventing a fake field name like `"value"`.

Reason:
- The input shape does not provide a field name.
- A fabricated path hides an unresolved contract question instead of documenting it.

## Successful validation outcome shape

Context:
The draft validator currently uses `OperationOutcome` as the external result format.

Ambiguity:
How should successful validation be represented in a way that works for both FHIR R4 and R6?

Options:
- Return `OperationOutcome` with `issue: []`.
- Return no `OperationOutcome` on success and only emit it on failures.
- Always return `OperationOutcome` with one non-error issue.
- Use `severity: "success"` for successful validation.

Current choice:
- Always return `OperationOutcome` with one issue:
  - `severity: "information"`
  - `code: "informational"`
  - `details.text: "Validation succeeded"`

Reason:
- `OperationOutcome.issue` is required and not naturally modeled as an empty array.
- `severity: "success"` is not available in FHIR R4.
- `information` works for both R4 and R6.

## Runtime behavior before implementation

Context:
The semantic test suite already describes intended validation behavior, but the new validator is still a stub.

Ambiguity:
Should the stub pretend success, throw, or return a structured temporary failure?

Options:
- Return a fake successful `OperationOutcome`.
- Throw a `Not implemented` exception.
- Return `OperationOutcome` with a temporary implementation-status error.

Current choice:
- Return `OperationOutcome` with:
  - `severity: "error"`
  - `code: "not-supported"`
  - `details.text: "New validator is not implemented yet"`

Reason:
- It is explicit at runtime.
- It preserves the external `OperationOutcome` contract.
- The semantic tests can stay red instead of being hidden behind `todo`.

## Null handling for primitives

Context:
The draft validator has root-level primitive tests such as `validate(undefined, [{ type: "string" }], data)`.

Ambiguity:
Should `null` be accepted for primitive values?

Options:
- Accept `null` as an empty primitive value.
- Reject `null` for root and ordinary primitive fields.
- Treat `null` differently for root values and arrays.

Current choice:
- Reject `null` for root and ordinary primitive values with a type mismatch.
- Handle `null` placeholders inside repeating primitive arrays separately later.

Reason:
- In FHIR JSON, primitive values are represented by their JSON scalar types, not `null`.
- Missing primitive values are represented by omission, or by the parallel `_element` form when extensions/id exist.
- Repeating primitive arrays with `null` placeholders are a separate JSON-representation concern, not a primitive-type rule by itself.
