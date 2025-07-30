# FHIRSchema

[![CI](https://github.com/fhir-schema/fhirschema-ts/actions/workflows/ci.yml/badge.svg)](https://github.com/fhir-schema/fhirschema-ts/actions/workflows/ci.yml)
[![Type Check](https://github.com/fhir-schema/fhirschema-ts/actions/workflows/typecheck.yml/badge.svg)](https://github.com/fhir-schema/fhirschema-ts/actions/workflows/typecheck.yml)

TypeScript implementation of FHIRSchema converter and validator.

## Overview

This project provides:
- **Converter**: Transforms FHIR StructureDefinitions into FHIRSchema format
- **Validator**: Validates FHIR resources against FHIRSchema definitions

## Installation

```bash
npm install @atomic-ehr/fhirschema
```

Or install the latest canary version:

```bash
npm install @atomic-ehr/fhirschema@canary
```

## Usage

### Converting StructureDefinition to FHIRSchema

```typescript
import { translate } from '@atomic-ehr/fhirschema';

const structureDefinition = {
  resourceType: 'StructureDefinition',
  name: 'Patient',
  // ... rest of the StructureDefinition
};

const fhirSchema = translate(structureDefinition);
```

### Validating FHIR Resources

```typescript
import { validate } from '@atomic-ehr/fhirschema';

const resource = {
  resourceType: 'Patient',
  // ... patient data
};

const schema = { /* FHIRSchema */ };
const context = { schemas: { Patient: schema } };

const result = validate(context, schema, resource);
if (result.valid) {
  console.log('Resource is valid');
} else {
  console.log('Validation errors:', result.errors);
}
```

## Development

### Running Tests

```bash
bun test
```

### Type Checking

```bash
bun run typecheck
```

### Building

```bash
bun run build
```

## Project Structure

```
├── src/
│   ├── converter/     # StructureDefinition to FHIRSchema converter
│   ├── validator/     # FHIRSchema validator
│   └── types.ts       # Shared TypeScript types
├── test/
│   ├── unit/          # Unit tests
│   └── golden/        # Golden tests with expected outputs
├── spec/              # Specifications and documentation
├── adr/               # Architecture Decision Records
└── tasks/             # Task management
```

## Development

This project uses:
- **Bun** as the runtime and test runner
- **TypeScript** for type safety
- **GitHub Actions** for CI/CD

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

[License information to be added]