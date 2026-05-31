import { describe, expect, it } from 'bun:test';
import { translate } from '../../src/converter/index';
import { toStructureDefinition } from '../../src/converter/to-structure-definition';
import type { StructureDefinition } from '../../src/converter/types';

// targetProfile is meaningful not just on Reference but also on canonical (and
// CodeableReference). The forward only collected it for Reference, so a canonical's
// target profiles were dropped. Both directions must carry them via `refers`.

const profile: StructureDefinition = {
  resourceType: 'StructureDefinition',
  url: 'http://example.org/CP',
  name: 'CP',
  status: 'active',
  kind: 'resource',
  type: 'CarePlan',
  derivation: 'constraint',
  baseDefinition: 'http://hl7.org/fhir/StructureDefinition/CarePlan',
  differential: {
    element: [
      { path: 'CarePlan' },
      {
        path: 'CarePlan.instantiatesCanonical',
        type: [
          {
            code: 'canonical',
            targetProfile: [
              'http://hl7.org/fhir/StructureDefinition/PlanDefinition',
              'http://hl7.org/fhir/StructureDefinition/Questionnaire',
            ],
          },
        ],
      },
    ],
  },
};

describe('canonical/CodeableReference targetProfile round-trips via refers', () => {
  it('forward captures canonical targetProfile into refers', () => {
    const fs = translate(profile);
    expect((fs.elements?.instantiatesCanonical as Record<string, unknown>)?.refers).toEqual([
      'http://hl7.org/fhir/StructureDefinition/PlanDefinition',
      'http://hl7.org/fhir/StructureDefinition/Questionnaire',
    ]);
  });

  it('reverse re-emits canonical targetProfile', () => {
    const sd = toStructureDefinition(translate(profile), { status: 'active' });
    const ic = sd.differential?.element.find((e) => e.path === 'CarePlan.instantiatesCanonical');
    expect(ic?.type).toEqual([
      {
        code: 'canonical',
        targetProfile: [
          'http://hl7.org/fhir/StructureDefinition/PlanDefinition',
          'http://hl7.org/fhir/StructureDefinition/Questionnaire',
        ],
      },
    ]);
  });
});
