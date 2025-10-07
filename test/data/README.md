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