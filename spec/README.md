# FHIRSchema Specifications

This directory contains the comprehensive specifications for FHIRSchema and its converter.

## Overview

FHIRSchema is an algorithm-based approach to implement FHIR validation that provides a simpler, more efficient alternative to traditional StructureDefinition-based validation.

## Contents

1. **[FHIRSchema Specification](./fhirschema-specification.md)**
   - Core schema structure and fields
   - Rule types and their purposes
   - Schema composition and referencing

2. **[Validation Algorithm](./validation-algorithm.md)**
   - Step-by-step validation process
   - Rule evaluation strategies
   - Error handling and reporting

3. **[Converter Specification](./converter-specification.md)**
   - Conversion from StructureDefinition to FHIRSchema
   - Mapping rules and transformations
   - Special cases and edge conditions

4. **[Converter Algorithm](./converter-algorithm.md)**
   - Detailed algorithmic approach
   - Path processing and action calculation
   - Stack-based transformation process

## Key Concepts

### Schema Types
- **Resource Schemas**: Define structure for FHIR resources
- **Type Schemas**: Define reusable data types
- **Profile Schemas**: Constrain base resources or types

### Rule Categories
- **Special Rules**: Hard-coded algorithmic behaviors
- **Collection Rules**: Applied to arrays/collections
- **Value Rules**: Applied to individual values

### Validation Modes
- **Strict Mode**: Reports all unknown elements as errors
- **Open-World Mode**: Allows unknown elements without errors