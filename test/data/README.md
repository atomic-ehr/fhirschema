This folder contains test data used to keep the test suite clean. Then the data is comming from an external source, efforts will be made to keep the data as close to the source as possible, describing the modifications if any. Example of external data includes fhirschema taken from aidbox instance.

## Files

*.fs.json: json formatted fhirschema

polymorphyc types has been changed from the original aidbox representation. E.g: `FhirSchemaElement.pattern` has been modified to include the polymorphic type: `FhirSchemaElement.patternCodeableConcept`.

## Package Dependencies

```
* hl7.fhir.us.core#8.0.0-ballot | US Core Implementation Guide
-> hl7.fhir.r4.core#4.0.1       | FHIR R4 package : Core
```

## Test Cases

### us-core blood pressure

```
* us-core-blood-pressure.fs.json | hl7.fhir.us.core#8.0.0-ballot
-> us-core-vital-signs.fs.json
-> vitalsigns.fs.json            | hl7.fhir.r4.core#4.0.1
-> Observation.fs.json
-> DomainResource.fs.json
-> Resource.fs.js.json
```

### slicing-obs-component

Test data for merging slicing definitions in Observation.component.

```
* slicing-obs-component.json
  - base: us-core-vital-signs profile with general component constraints
  - overlay: us-core-blood-pressure profile with systolic/diastolic slices
  - result: merged profile with both general constraints and specific slices
```

### reslicing-patient-passport

Test data for merging slicing and reslicing definitions in Patient.identifier.

```
* reslicing-patient-passport.json
  - base: Patient profile with passport identifier slice (discriminated by type)
  - overlay: Profile adding reslicing to passport slice for country-specific passports (discriminated by system)
    - usPassport: US passport with fixed system
    - spainPassport: Spanish passport with fixed system
  - result: merged profile with nested slicing hierarchy (identifier → passport → country-specific)
```