// Caller-side adapter: validator ValidationIssue[] -> FHIR OperationOutcome,
// for FHIR-facing APIs ($validate-style responses). See DESIGN.md §15.

import type { OperationOutcome, OperationOutcomeIssue } from '../converter/types.js';
import type { ValidationIssue, ValidationResult } from './index.js';

/** Canonical system under which the stable `fsNNN` code is reported. */
export const FS_CODE_SYSTEM = 'https://fhirschema.org/issue-code';

export interface OperationOutcomeOptions {
  /**
   * When there are no issues, emit a single `information`/`informational` issue
   * (FHIR-idiomatic "all OK" OperationOutcome). Default true.
   */
  includeSuccess?: boolean;
}

// fsNNN family (hundreds digit) -> FHIR issue-type code (required binding).
// Coarse but principled; the exact `fsNNN` is preserved in `details.coding`.
const ISSUE_TYPE_BY_FAMILY: Record<number, string> = {
  1: 'value', // fs1xx  primitives (bad JSON type / literal)
  2: 'structure', // fs2xx  shape (unknown/excluded element, expected object/array)
  3: 'required', // fs3xx  cardinality
  4: 'structure', // fs4xx  primitive extensions
  5: 'code-invalid', // fs5xx  terminology bindings
  6: 'invariant', // fs6xx  constraints
  7: 'not-found', // fs7xx  profile / schema ref
  8: 'structure', // fs8xx  choice types
  9: 'structure', // fs9xx  slicing
  10: 'invalid', // fs10xx references
  11: 'structure', // fs11xx extensions
  12: 'business-rule', // fs12xx Bundle integrity
};

function issueTypeFor(code: string): string {
  const n = Number(code.replace(/^fs/, ''));
  if (!Number.isFinite(n)) return 'invalid';
  return ISSUE_TYPE_BY_FAMILY[Math.floor(n / 100)] ?? 'invalid';
}

/** Render a validator path as a FHIRPath-style expression (`name`, `name[0].child`). */
function pathExpression(path: (string | number)[]): string {
  return path.reduce<string>((acc, seg) => {
    if (typeof seg === 'number') return `${acc}[${seg}]`;
    return acc ? `${acc}.${seg}` : seg;
  }, '');
}

function toIssue(issue: ValidationIssue): OperationOutcomeIssue {
  const expr = pathExpression(issue.path);
  const out: OperationOutcomeIssue = {
    severity: issue.severity ?? 'error',
    code: issueTypeFor(issue.code),
    details: {
      coding: [{ system: FS_CODE_SYSTEM, code: issue.code }],
      ...(issue.message ? { text: issue.message } : {}),
    },
  };
  if (issue.message) out.diagnostics = issue.message;
  if (expr) {
    out.expression = [expr];
    out.location = [expr];
  }
  return out;
}

/**
 * Convert a `ValidationResult` (or a bare `ValidationIssue[]`) into a FHIR
 * `OperationOutcome`. `fsNNN` codes are preserved in each issue's
 * `details.coding`; the FHIR `issue.code` is a coarse issue-type mapping.
 */
export function toOperationOutcome(
  input: ValidationResult | ValidationIssue[],
  options: OperationOutcomeOptions = {},
): OperationOutcome {
  const issues = Array.isArray(input) ? input : input.issues;
  const ooIssues = issues.map(toIssue);

  if (ooIssues.length === 0 && options.includeSuccess !== false) {
    ooIssues.push({
      severity: 'information',
      code: 'informational',
      details: { text: 'All OK' },
    });
  }

  return { resourceType: 'OperationOutcome', issue: ooIssues };
}
