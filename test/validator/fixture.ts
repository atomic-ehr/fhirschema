import { FHIRSchema } from '../../src/converter/types';
import usCoreBloodPressureProfile from '../data/hl7.fhir.us.core#8.0.0-ballot/us-core-blood-pressure.fs.json';
import usCoreVitalSignsProfile from '../data/hl7.fhir.us.core#8.0.0-ballot/us-core-vital-signs.fs.json';
import r4VitalSignsProfile from '../data/hl7.fhir.r4.core#4.0.1/vitalsigns.fs.json';
import r4ObsProfile from '../data/hl7.fhir.r4.core#4.0.1/Observation.fs.json';
import r4DomainResProfile from '../data/hl7.fhir.r4.core#4.0.1/DomainResource.fs.json';
import r4ResourceProfile from '../data/hl7.fhir.r4.core#4.0.1/Resource.fs.json';
import r4PatientProfile from '../data/hl7.fhir.r4.core#4.0.1/Patient.fs.json';
import r4IdentifierType from '../data/hl7.fhir.r4.core#4.0.1/Identifier.fs.json';
import r4CodeableConceptType from '../data/hl7.fhir.r4.core#4.0.1/CodeableConcept.fs.json';
import r4CodingType from '../data/hl7.fhir.r4.core#4.0.1/Coding.fs.json';
import r4QuantityType from '../data/hl7.fhir.r4.core#4.0.1/Quantity.fs.json';
import r4HumanNameType from '../data/hl7.fhir.r4.core#4.0.1/HumanName.fs.json';
import r4PeriodType from '../data/hl7.fhir.r4.core#4.0.1/Period.fs.json';
import r4ReferenceType from '../data/hl7.fhir.r4.core#4.0.1/Reference.fs.json';
import r4UriType from '../data/hl7.fhir.r4.core#4.0.1/uri.fs.json';
import r4CodeType from '../data/hl7.fhir.r4.core#4.0.1/code.fs.json';
import r4StringType from '../data/hl7.fhir.r4.core#4.0.1/string.fs.json';
import r4DecimalType from '../data/hl7.fhir.r4.core#4.0.1/decimal.fs.json';
import r4DateType from '../data/hl7.fhir.r4.core#4.0.1/date.fs.json';
import r4DateTimeType from '../data/hl7.fhir.r4.core#4.0.1/dateTime.fs.json';
import r4NarrativeType from '../data/hl7.fhir.r4.core#4.0.1/Narrative.fs.json';
import r4XhtmlType from '../data/hl7.fhir.r4.core#4.0.1/xhtml.fs.json';
import r4MetaType from '../data/hl7.fhir.r4.core#4.0.1/Meta.fs.json';
import r4InstantType from '../data/hl7.fhir.r4.core#4.0.1/instant.fs.json';
import r4CanonicalType from '../data/hl7.fhir.r4.core#4.0.1/canonical.fs.json';
import multiCitizenPatientProfile from '../data/MultiCitizenPatient.fs.json';

const profilesIndex: { [key in string]: FHIRSchema } = {
  'http://hl7.org/fhir/us/core/StructureDefinition/us-core-blood-pressure|8.0.0-ballot':
    usCoreBloodPressureProfile,
  'http://hl7.org/fhir/us/core/StructureDefinition/us-core-vital-signs|8.0.0-ballot':
    usCoreVitalSignsProfile,
  'http://hl7.org/fhir/StructureDefinition/vitalsigns|4.0.1': r4VitalSignsProfile,
  'http://hl7.org/fhir/StructureDefinition/Observation|4.0.1': r4ObsProfile,
  'http://hl7.org/fhir/StructureDefinition/DomainResource|4.0.1': r4DomainResProfile,
  'http://hl7.org/fhir/StructureDefinition/Resource|4.0.1': r4ResourceProfile,
  'http://hl7.org/fhir/StructureDefinition/Patient|4.0.1': r4PatientProfile,
  'http://example.org/fhir/StructureDefinition/MultiCitizenPatient|0.1.0':
    multiCitizenPatientProfile,
};

const typesIndex: { [key in string]: FHIRSchema } = {
  string: r4StringType,
  code: r4CodeType,
  uri: r4UriType,
  decimal: r4DecimalType,
  date: r4DateType,
  dateTime: r4DateTimeType,
  xhtml: r4XhtmlType,
  instant: r4InstantType,
  canonical: r4CanonicalType,
  Identifier: r4IdentifierType,
  CodeableConcept: r4CodeableConceptType,
  Coding: r4CodingType,
  Period: r4PeriodType,
  Reference: r4ReferenceType,
  Quantity: r4QuantityType,
  HumanName: r4HumanNameType,
  Narrative: r4NarrativeType,
  Meta: r4MetaType,
};

export { profilesIndex, typesIndex };
