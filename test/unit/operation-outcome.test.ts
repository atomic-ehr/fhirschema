import { describe, expect, it } from 'bun:test';
import { FS_CODE_SYSTEM, toOperationOutcome } from '../../src/validator/operation-outcome';
import type { ValidationIssue } from '../../src/validator/index';

describe('toOperationOutcome', () => {
  it('maps an issue: severity, fs-family issue-type, fsNNN in details, FHIRPath expression', () => {
    const issues: ValidationIssue[] = [
      { code: 'fs110', severity: 'error', path: ['Patient', 'identifier', 0, 'value'], message: 'bad id' },
    ];
    const oo = toOperationOutcome(issues);
    expect(oo.resourceType).toBe('OperationOutcome');
    const i = oo.issue?.[0];
    expect(i?.severity).toBe('error');
    expect(i?.code).toBe('value'); // fs1xx -> value
    expect(i?.details?.coding?.[0]).toEqual({ system: FS_CODE_SYSTEM, code: 'fs110' });
    expect(i?.details?.text).toBe('bad id');
    expect(i?.diagnostics).toBe('bad id');
    expect(i?.expression).toEqual(['Patient.identifier[0].value']);
    expect(i?.location).toEqual(['Patient.identifier[0].value']);
  });

  it('maps fs-code families to FHIR issue-types', () => {
    const cases: Array<[ValidationIssue['code'], string]> = [
      ['fs301', 'required'], // cardinality
      ['fs203', 'structure'], // shape
      ['fs501', 'code-invalid'], // terminology
      ['fs601', 'invariant'], // constraint
      ['fs701', 'not-found'], // profile ref
      ['fs1002', 'invalid'], // references
      ['fs1201', 'business-rule'], // bundle integrity
    ];
    for (const [code, expected] of cases) {
      const oo = toOperationOutcome([{ code, path: [], severity: 'error' }]);
      expect(oo.issue?.[0].code).toBe(expected);
    }
  });

  it('defaults severity to error when omitted', () => {
    const oo = toOperationOutcome([{ code: 'fs201', path: ['x'] }]);
    expect(oo.issue?.[0].severity).toBe('error');
  });

  it('accepts a ValidationResult and emits a success issue when clean', () => {
    const oo = toOperationOutcome({ valid: true, issues: [] });
    expect(oo.issue).toHaveLength(1);
    expect(oo.issue?.[0]).toMatchObject({ severity: 'information', code: 'informational' });
  });

  it('omits the success issue when includeSuccess is false', () => {
    const oo = toOperationOutcome({ valid: true, issues: [] }, { includeSuccess: false });
    expect(oo.issue).toEqual([]);
  });
});
