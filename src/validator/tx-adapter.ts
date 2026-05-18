// Sync HTTP terminology adapter for tx.fhir.org (or any FHIR terminology
// server exposing `ValueSet/$validate-code`). Implements `TerminologyEvaluator`.
//
// Why sync: the validator is sync. We block on HTTP via `Bun.spawnSync` +
// curl (Java reference validator does the equivalent — synchronous HTTP in
// the validation hot loop). In-process cache keeps repeat queries cheap.
//
// What we check: Coding and CodeableConcept (system + code), and plain
// `code` strings WITHOUT a system. For bare codes the server tries to
// infer the CodeSystem from the ValueSet itself — this works for VSes
// composed of a single CodeSystem (the common case for required-bound
// `code` fields like Patient.gender, HumanName.use). When the server
// can't decide it returns no `result` parameter and we report 'unknown'.

import type { TerminologyEvaluator, TerminologyResult, TerminologyVerdict } from './index.js';

export interface TxAdapterOptions {
  /** Server root. Default: `https://tx.health-samurai.io/fhir`. */
  endpoint?: string;
  /**
   * Optional in-process cache. If absent, a fresh `Map`-backed one is
   * created per instance. Pass `null` to disable memoization.
   */
  cache?: TxCache | null;
  /**
   * curl request timeout in seconds. Default 10. Surface as a `--max-time`
   * flag so a hung TX server can't stall the validator forever.
   */
  timeoutSeconds?: number;
}

type TxLookupResult = {
  verdict: TerminologyVerdict;
  displayMismatch?: { provided: string; canonical: string };
};

export interface TxCache {
  get(key: string): TxLookupResult | undefined;
  set(key: string, verdict: TxLookupResult): void;
}

class MapCache implements TxCache {
  private m = new Map<string, TxLookupResult>();
  get(k: string) {
    return this.m.get(k);
  }
  set(k: string, v: TxLookupResult) {
    this.m.set(k, v);
  }
}

export class TxFhirOrgAdapter implements TerminologyEvaluator {
  private endpoint: string;
  private cache: TxCache | null;
  private timeoutSeconds: number;

  constructor(opts: TxAdapterOptions = {}) {
    this.endpoint = (opts.endpoint ?? 'https://tx.health-samurai.io/fhir').replace(/\/$/, '');
    this.cache = opts.cache === null ? null : (opts.cache ?? new MapCache());
    this.timeoutSeconds = opts.timeoutSeconds ?? 10;
  }

  validateCode(
    valueSet: string,
    value: unknown,
    ctx: { type?: string; strength: string },
  ): TerminologyResult {
    if (ctx.strength === 'example') return 'unknown';

    const codings = extractCodings(value);
    if (codings.length === 0) return 'unknown';

    // CodeableConcept semantics: any matching coding wins for membership.
    // Display mismatch is reported from the first coding that matched
    // (otherwise from the last non-matching one).
    let sawNotIn = false;
    let sawUnknown = false;
    let firstDisplayMismatch: { provided: string; canonical: string } | undefined;
    for (const c of codings) {
      const r = this.lookup(valueSet, c);
      if (r.verdict === 'in') {
        return r.displayMismatch ? { verdict: 'in', displayMismatch: r.displayMismatch } : 'in';
      }
      if (r.verdict === 'not-in') sawNotIn = true;
      if (r.verdict === 'unknown') sawUnknown = true;
      if (!firstDisplayMismatch && r.displayMismatch) firstDisplayMismatch = r.displayMismatch;
    }
    if (sawNotIn && !sawUnknown) {
      return firstDisplayMismatch
        ? { verdict: 'not-in', displayMismatch: firstDisplayMismatch }
        : 'not-in';
    }
    return 'unknown';
  }

  private lookup(
    valueSet: string,
    coding: { system?: string; code: string; display?: string },
  ): TxLookupResult {
    const key = `${valueSet}|${coding.system ?? ''}|${coding.code}|${coding.display ?? ''}`;
    const cached = this.cache?.get(key);
    if (cached) return cached;
    const r = this.callValidateCode(valueSet, coding);
    this.cache?.set(key, r);
    return r;
  }

  private callValidateCode(
    valueSet: string,
    coding: { system?: string; code: string; display?: string },
  ): TxLookupResult {
    const params: Array<{
      name: string;
      valueUri?: string;
      valueCode?: string;
      valueString?: string;
      valueBoolean?: boolean;
    }> = [
      { name: 'url', valueUri: valueSet },
      { name: 'code', valueCode: coding.code },
    ];
    if (coding.system) {
      params.splice(1, 0, { name: 'system', valueUri: coding.system });
    } else {
      // Tell the server to infer the system from the ValueSet itself.
      // Works for single-CodeSystem VSes (the common case for required
      // `code`-typed fields). For multi-system VSes the server returns
      // no usable verdict → 'unknown'.
      params.push({ name: 'inferSystem', valueBoolean: true });
    }
    // Include display so the server can verify it against the CodeSystem.
    if (coding.display) {
      params.push({ name: 'display', valueString: coding.display });
    }
    const body = JSON.stringify({
      resourceType: 'Parameters',
      parameter: params,
    });
    const url = `${this.endpoint}/ValueSet/$validate-code`;
    const result = Bun.spawnSync({
      cmd: [
        'curl',
        '-sS',
        '--max-time',
        String(this.timeoutSeconds),
        '-X',
        'POST',
        '-H',
        'Content-Type: application/fhir+json',
        '-H',
        'Accept: application/fhir+json',
        '-d',
        body,
        url,
      ],
      stdout: 'pipe',
      stderr: 'pipe',
    });
    if (result.exitCode !== 0) return { verdict: 'unknown' };
    const out = result.stdout.toString().trim();
    if (!out) return { verdict: 'unknown' };
    type Param = {
      name: string;
      valueBoolean?: boolean;
      valueString?: string;
      resource?: {
        resourceType?: string;
        issue?: Array<{
          severity?: string;
          details?: {
            coding?: Array<{ system?: string; code?: string }>;
            text?: string;
          };
        }>;
      };
    };
    let parsed: { parameter?: Param[] };
    try {
      parsed = JSON.parse(out);
    } catch {
      return { verdict: 'unknown' };
    }
    const result_param = parsed.parameter?.find((p) => p.name === 'result');
    const display_param = parsed.parameter?.find((p) => p.name === 'display');
    const issues_param = parsed.parameter?.find((p) => p.name === 'issues');

    // Detect display-only mismatch: server reports an issue whose detail
    // coding.code is `invalid-display` from tx-issue-type. In that case
    // the code IS in the value set; only the display is wrong.
    let isDisplayOnly = false;
    const ooIssues = issues_param?.resource?.issue ?? [];
    if (ooIssues.length > 0) {
      isDisplayOnly = ooIssues.every((i) =>
        (i.details?.coding ?? []).some(
          (c) => c.code === 'invalid-display' && c.system?.endsWith('/tx-issue-type'),
        ),
      );
    }
    const canonicalDisplay = display_param?.valueString;
    const displayMismatch =
      coding.display && canonicalDisplay && coding.display !== canonicalDisplay
        ? { provided: coding.display, canonical: canonicalDisplay }
        : undefined;

    if (result_param?.valueBoolean === true) {
      return displayMismatch ? { verdict: 'in', displayMismatch } : { verdict: 'in' };
    }
    if (result_param?.valueBoolean === false) {
      // Display-only mismatch: code IS in VS, only display wrong.
      if (isDisplayOnly && displayMismatch) {
        return { verdict: 'in', displayMismatch };
      }
      return displayMismatch ? { verdict: 'not-in', displayMismatch } : { verdict: 'not-in' };
    }
    return { verdict: 'unknown' };
  }
}

function extractCodings(
  value: unknown,
): Array<{ system?: string; code: string; display?: string }> {
  if (typeof value === 'string') return [{ code: value }];
  if (value === null || typeof value !== 'object') return [];
  const obj = value as Record<string, unknown>;
  // Coding: `{system, code, display}`
  if (typeof obj.code === 'string') {
    const system = typeof obj.system === 'string' ? obj.system : undefined;
    const display = typeof obj.display === 'string' ? obj.display : undefined;
    return [{ system, code: obj.code, display }];
  }
  // CodeableConcept: `{coding: [Coding, ...], text}`
  if (Array.isArray(obj.coding)) {
    const out: Array<{ system?: string; code: string; display?: string }> = [];
    for (const c of obj.coding) {
      if (c && typeof c === 'object') {
        const inner = c as { system?: unknown; code?: unknown; display?: unknown };
        if (typeof inner.code === 'string') {
          out.push({
            system: typeof inner.system === 'string' ? inner.system : undefined,
            code: inner.code,
            display: typeof inner.display === 'string' ? inner.display : undefined,
          });
        }
      }
    }
    return out;
  }
  return [];
}
