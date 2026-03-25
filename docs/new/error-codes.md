# FHIRSchema Validator Error Codes

Validator returns `ValidationIssue[]`. Empty array means success.

```typescript
type ValidationIssue = {
  code: string            // e.g. "fs101"
  severity: "error" | "warning" | "information"
  path: string            // FHIRPath-like: "Patient.birthDate", "" for root
  schemaPath?: string     // "http://.../StructureDefinition/Patient#birthDate"
  message: string         // human-readable, not machine-parsed
}
```

## Error Code Ranges

Codes follow the pattern `fsNNN` with ranges grouped by category, inspired by TypeScript/Rust compiler diagnostics.

| Range   | Category              | Description                                      |
|---------|-----------------------|--------------------------------------------------|
| fs1xx   | Primitive             | JSON type checks and literal validation          |
| fs2xx   | Structure             | JSON shape: expected object/array/scalar         |
| fs3xx   | Cardinality           | min/max element count                            |
| fs4xx   | Primitive extensions   | `_field` semantics, array alignment              |
| fs5xx   | Terminology           | Value set bindings, code validation              |
| fs6xx   | Constraints           | FHIRPath invariants                              |
| fs7xx   | Profiles              | Inheritance, profile resolution                  |
| fs8xx   | Choice types          | Polymorphic `value[x]` elements                  |
| fs9xx   | Slicing               | Discriminator matching, slice cardinality        |
| fs10xx  | References            | Reference type, resolution (deferred)            |
| fs11xx  | Extensions            | Unknown/modifier extensions                      |

## Code Registry

### fs1xx — Primitive

FHIR primitive types inherit from three JSON types:

```
JSON boolean
  └── boolean

JSON number
  ├── integer (int32: -2147483648..2147483647)
  │   ├── unsignedInt (>= 0)
  │   └── positiveInt (> 0)
  └── decimal

JSON string
  ├── string
  │   └── markdown
  ├── code
  ├── id ([A-Za-z0-9\-.]{1,64})
  ├── uri (RFC 3986)
  │   ├── url (absolute)
  │   ├── canonical (uri + optional |version)
  │   ├── oid (urn:oid:...)
  │   └── uuid (urn:uuid:...)
  ├── base64Binary
  ├── date (yyyy / yyyy-mm / yyyy-mm-dd)
  ├── dateTime (date + optional time + optional tz)
  ├── instant (full dateTime + required tz)
  ├── time (hh:mm:ss, no tz)
  ├── integer64 (64-bit int as string!)
  └── xhtml
```

Validation has two levels: first check JSON type (fs101–fs103), then validate the literal (fs104+).

**JSON type checks:**

| Code  | Name              | Severity | Description                                                  |
|-------|-------------------|----------|--------------------------------------------------------------|
| fs101 | expected-string   | error    | Expected JSON string, got number or boolean                  |
| fs102 | expected-number   | error    | Expected JSON number, got string or boolean                  |
| fs103 | expected-boolean  | error    | Expected JSON boolean, got string or number                  |

**Literal validation** (JSON type is correct, but value is invalid):

| Code  | Name                 | Severity | Description                                                           |
|-------|----------------------|----------|-----------------------------------------------------------------------|
| fs104 | invalid-base64       | error    | Invalid base64 encoding (RFC 4648)                                    |
| fs105 | invalid-canonical    | error    | Invalid canonical URL (uri with optional `\|version`)                 |
| fs106 | invalid-code         | error    | Code contains leading/trailing whitespace, inner non-single-space, or is empty |
| fs107 | invalid-date         | error    | Does not match `yyyy`, `yyyy-mm`, or `yyyy-mm-dd`, or impossible calendar date |
| fs108 | invalid-datetime     | error    | Invalid dateTime literal or impossible date component                 |
| fs109 | invalid-decimal      | error    | Invalid decimal literal                                               |
| fs110 | invalid-id           | error    | Does not match `[A-Za-z0-9\-.]{1,64}`                                |
| fs111 | invalid-instant      | error    | Invalid instant literal (must include timezone)                       |
| fs112 | invalid-integer      | error    | Not a whole number or outside signed 32-bit range                     |
| fs113 | invalid-integer64    | error    | Invalid 64-bit integer string                                        |
| fs114 | invalid-markdown     | error    | String is empty or whitespace-only (same rules as string)             |
| fs115 | invalid-oid          | error    | Does not match `urn:oid:` pattern                                     |
| fs116 | invalid-positive-int | error    | Integer is not > 0                                                    |
| fs117 | invalid-string       | error    | String is empty or whitespace-only                                    |
| fs118 | invalid-time         | error    | Invalid time literal (`hh:mm:ss`, no timezone)                        |
| fs119 | invalid-unsigned-int | error    | Integer is not >= 0                                                   |
| fs120 | invalid-uri          | error    | Invalid URI (RFC 3986)                                                |
| fs121 | invalid-url          | error    | Invalid URL (must be absolute)                                        |
| fs122 | invalid-uuid         | error    | Does not match `urn:uuid:` pattern                                    |
| fs123 | invalid-xhtml        | error    | Invalid XHTML narrative content                                       |

### fs2xx — Structure

JSON shape validation: object vs array vs scalar.

| Code  | Name              | Severity | Description                                                  |
|-------|-------------------|----------|--------------------------------------------------------------|
| fs201 | unknown-element   | error    | Field not declared in any schema in the chain                |
| fs202 | expected-object   | error    | Expected JSON object `{}`, got scalar or array               |
| fs203 | expected-array    | error    | Expected JSON array `[]`, got object or scalar               |
| fs204 | expected-primitive| error    | Expected JSON primitive, got object or array                 |

### fs3xx — Cardinality

Element count constraints (min/max).

| Code  | Name              | Severity | Description                                                  |
|-------|-------------------|----------|--------------------------------------------------------------|
| fs301 | required          | error    | Required element (min >= 1) is missing                       |
| fs302 | too-many          | error    | Array length exceeds max cardinality                         |
| fs303 | too-few           | error    | Array length below min cardinality                           |

### fs4xx — Primitive Extensions

| Code  | Name                         | Severity | Description                                         |
|-------|------------------------------|----------|-----------------------------------------------------|
| fs401 | invalid-primitive-extension  | error    | `_field` present for a non-primitive element         |
| fs402 | misaligned-arrays            | error    | `_field[]` length does not match `field[]` length    |

### fs5xx — Terminology

| Code  | Name                      | Severity | Description                                          |
|-------|---------------------------|----------|------------------------------------------------------|
| fs501 | invalid-code-for-binding  | error    | Code not in required value set                       |
| fs502 | code-not-in-preferred     | warning  | Code not in preferred value set                      |
| fs503 | code-not-in-extensible    | warning  | Code not in extensible value set                     |

### fs6xx — Constraints

| Code  | Name                | Severity       | Description                                        |
|-------|---------------------|----------------|----------------------------------------------------|
| fs601 | invariant-violated  | error/warning  | FHIRPath constraint evaluated to false (severity from constraint definition) |

### fs7xx — Profiles

| Code  | Name                | Severity | Description                                          |
|-------|---------------------|----------|------------------------------------------------------|
| fs701 | profile-not-found   | error    | Referenced profile URL not found in context          |
| fs702 | profile-violation   | error    | Data does not conform to declared profile            |

### fs8xx — Choice Types

| Code  | Name                  | Severity | Description                                        |
|-------|-----------------------|----------|----------------------------------------------------|
| fs801 | invalid-choice-type   | error    | Type not in allowed list for `value[x]`            |
| fs802 | multiple-choice-values| error    | More than one choice type variant present          |

### fs9xx — Slicing

| Code  | Name                | Severity | Description                                          |
|-------|---------------------|----------|------------------------------------------------------|
| fs901 | slice-not-matched   | error    | Element does not match any defined slice (closed)    |
| fs902 | slice-cardinality   | error    | Slice min/max cardinality violated                   |

### fs10xx — References (deferred)

| Code   | Name                   | Severity | Description                                       |
|--------|------------------------|----------|---------------------------------------------------|
| fs1001 | invalid-reference-type | error    | Reference targets a disallowed resource type      |
| fs1002 | unresolved-reference   | warning  | Reference target could not be resolved            |

### fs11xx — Extensions

| Code   | Name                             | Severity | Description                                    |
|--------|----------------------------------|----------|------------------------------------------------|
| fs1101 | unknown-extension                | warning  | Extension URL not recognized                   |
| fs1102 | modifier-extension-not-understood| error    | modifierExtension must be understood by consumer|

## Design Decisions

- **Own format, not OperationOutcome.** OperationOutcome `issue-type` has ~30 coarse codes (e.g. `invalid`, `structure`, `required`) — too vague for programmatic use. A trivial mapper `toOperationOutcome(issues)` can be provided separately.
- **Codes are stable identifiers.** Messages may change (wording, i18n), codes never change once assigned.
- **Message is a human-readable string.** Details like "expected integer, got string" live in the message, not in structured fields. This follows TypeScript and Rust compiler precedent.
- **Ranges are expandable.** New codes are added within existing ranges. If a range fills up, the next hundred is used.
- **Tests should assert on `code` and `path`, not on `message`.**
