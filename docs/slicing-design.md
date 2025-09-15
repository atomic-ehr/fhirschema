# FHIRSchema Slicing

FHIRschema key design ideas:

* split slicing into different subgroups:
  * slicing of choice elements
  * slicing of extensions
  * slicing of element collections
* unify and simplify descriminators definitions
* for reslicing, search descriminators on fly in **SchemaSet**


## Extension Slicing

* Extension always sliced by url
* Extensions need to be resolved to extension definitions

```ts
{
    name: 'us-core-patient',
    base: 'http://fhir.core/StructureDefinition/Patient',
    extensions: {
        'http://hl7.org/fhir/us/core/StructureDefinition/us-core-race': {
            url: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-race',
            array: true,
        }
    }
    elements: {
        identifier: {
            array: true,
            slicing: {
                discriminator: [{ type: 'pattern', path: 'system' }],
                rules: 'open',
                slices: {
                    'http://hl7.org/fhir/sid/us-ssn': {
                        array: true,
                        match: { system: 'http://hl7.org/fhir/sid/us-ssn' }
                    }
                }
            }
        },
        multipleBirth: {
            choices: ['boolean']
        }
    }
}
```