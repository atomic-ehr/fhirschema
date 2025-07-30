# FHIRSchema Examples

This directory contains example FHIRSchema documents demonstrating various features and use cases.

## Basic Examples

### 1. [patient-base.json](./patient-base.json)
Base Patient resource schema showing:
- Basic element definitions
- Choice types (deceased[x], multipleBirth[x])
- Complex nested elements (contact, communication)
- Reference types with target restrictions
- Required elements in nested structures
- Constraints using FHIRPath expressions

### 2. [primitive-string.json](./primitive-string.json)
Primitive type schema demonstrating:
- Primitive type structure
- System type references
- Base constraints

### 3. [complex-address.json](./complex-address.json)
Complex datatype schema showing:
- Reusable type definition
- Multiple string elements
- Period type reference
- Modifier elements

## Profile Examples

### 4. [us-core-patient.json](./us-core-patient.json)
US Core Patient profile demonstrating:
- Profile derivation from base resource
- Extension slicing
- Identifier slicing with discriminators
- Must support flags
- Additional constraints
- Required element additions
- Extensions map for simplified extension access

### 5. [extension-definition.json](./extension-definition.json)
Extension definition showing:
- Complex extension with sub-extensions
- Extension slicing
- Required sub-extension elements
- Value type restrictions
- Binding to specific value sets

## Advanced Examples

### 6. [bundle-with-slicing.json](./bundle-with-slicing.json)
Bundle resource demonstrating:
- Element references (circular references)
- Complex nested structures
- Conditional constraints
- Resource type handling

### 7. [observation-with-slicing.json](./observation-with-slicing.json)
Blood pressure profile showing:
- Component slicing with pattern discriminators
- Required slices with cardinality
- Pattern matching for codes
- Quantity constraints
- Nested must support elements

## Key Features Demonstrated

### Element Types
- Primitive types: string, boolean, code, date, dateTime, instant, integer, decimal, uri
- Complex types: Address, HumanName, Identifier, CodeableConcept, Reference, Period
- Resource references with target restrictions

### Slicing
- Extension slicing by URL
- Identifier slicing by system pattern
- Component slicing by code pattern
- Cardinality constraints on slices

### Constraints
- FHIRPath expressions
- Pattern matching
- Required elements
- Cardinality (min/max)
- Value restrictions

### Special Features
- Choice types with [x] notation
- Element references for circular definitions
- Must support flags
- Modifier elements
- Summary elements
- Extensions map for profile extensions