import { TxFhirOrgAdapter } from '../src/validator/tx-adapter.js';

const tx = new TxFhirOrgAdapter();

function check(label: string, vs: string, value: unknown) {
  const v = tx.validateCode(vs, value, { strength: 'required' });
  console.log(label, '→', v);
}

check('Coding{system, code=male} / admin-gender', 'http://hl7.org/fhir/ValueSet/administrative-gender', {
  system: 'http://hl7.org/fhir/administrative-gender',
  code: 'male',
});
check('Coding{system, code=xxx} / admin-gender', 'http://hl7.org/fhir/ValueSet/administrative-gender', {
  system: 'http://hl7.org/fhir/administrative-gender',
  code: 'xxx',
});
check('CodeableConcept{coding:[m,x]} / admin-gender', 'http://hl7.org/fhir/ValueSet/administrative-gender', {
  coding: [
    { system: 'http://hl7.org/fhir/administrative-gender', code: 'male' },
    { system: 'http://hl7.org/fhir/administrative-gender', code: 'xxx' },
  ],
});
check('CodeableConcept{coding:[x,x]} / admin-gender', 'http://hl7.org/fhir/ValueSet/administrative-gender', {
  coding: [
    { system: 'http://hl7.org/fhir/administrative-gender', code: 'xxx' },
    { system: 'http://hl7.org/fhir/administrative-gender', code: 'yyy' },
  ],
});
check('nonexistent VS', 'http://example.com/no-such-vs', {
  system: 'http://hl7.org/fhir/administrative-gender',
  code: 'male',
});
check('plain string (skipped, no system)', 'http://hl7.org/fhir/ValueSet/administrative-gender', 'male');
