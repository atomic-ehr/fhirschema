// Sync HTTP terminology adapter for tx.fhir.org (or any FHIR terminology
// server exposing `ValueSet/$validate-code`). Implements `TerminologyEvaluator`.
//
// Why sync: the validator is sync. We block on HTTP via `Bun.spawnSync` +
// curl (Java reference validator does the equivalent — synchronous HTTP in
// the validation hot loop). In-process cache keeps repeat queries cheap.
//
// What we check: only values that carry both `system` and `code` — Coding
// and CodeableConcept. Plain `code` strings on primitive `code`-typed
// fields are NOT sent: the server can't validate a bare code without a
// system, and we don't have the binding's CodeSystem in hand. Those return
// 'unknown' (silent — same as no engine wired).

import type { TerminologyEvaluator, TerminologyVerdict } from './index.js';

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

export interface TxCache {
  get(key: string): TerminologyVerdict | undefined;
  set(key: string, verdict: TerminologyVerdict): void;
}

class MapCache implements TxCache {
  private m = new Map<string, TerminologyVerdict>();
  get(k: string) {
    return this.m.get(k);
  }
  set(k: string, v: TerminologyVerdict) {
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
  ): TerminologyVerdict {
    if (ctx.strength === 'example') return 'unknown';

    const codings = extractCodings(value).filter((c) => c.system !== undefined);
    if (codings.length === 0) return 'unknown';

    // CodeableConcept semantics: any matching coding wins.
    let sawNotIn = false;
    let sawUnknown = false;
    for (const c of codings) {
      const verdict = this.lookup(valueSet, c as { system: string; code: string });
      if (verdict === 'in') return 'in';
      if (verdict === 'not-in') sawNotIn = true;
      if (verdict === 'unknown') sawUnknown = true;
    }
    if (sawNotIn && !sawUnknown) return 'not-in';
    return 'unknown';
  }

  private lookup(
    valueSet: string,
    coding: { system: string; code: string },
  ): TerminologyVerdict {
    const key = `${valueSet}|${coding.system}|${coding.code}`;
    const cached = this.cache?.get(key);
    if (cached !== undefined) return cached;
    const verdict = this.callValidateCode(valueSet, coding);
    this.cache?.set(key, verdict);
    return verdict;
  }

  private callValidateCode(
    valueSet: string,
    coding: { system: string; code: string },
  ): TerminologyVerdict {
    const body = JSON.stringify({
      resourceType: 'Parameters',
      parameter: [
        { name: 'url', valueUri: valueSet },
        { name: 'system', valueUri: coding.system },
        { name: 'code', valueCode: coding.code },
      ],
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
    if (result.exitCode !== 0) return 'unknown';
    const out = result.stdout.toString().trim();
    if (!out) return 'unknown';
    let parsed: { parameter?: { name: string; valueBoolean?: boolean }[] };
    try {
      parsed = JSON.parse(out);
    } catch {
      return 'unknown';
    }
    const r = parsed.parameter?.find((p) => p.name === 'result');
    if (r?.valueBoolean === true) return 'in';
    if (r?.valueBoolean === false) return 'not-in';
    return 'unknown';
  }
}

function extractCodings(value: unknown): Array<{ system?: string; code: string }> {
  if (typeof value === 'string') return [{ code: value }];
  if (value === null || typeof value !== 'object') return [];
  const obj = value as Record<string, unknown>;
  // Coding: `{system, code, display}`
  if (typeof obj.code === 'string') {
    const system = typeof obj.system === 'string' ? obj.system : undefined;
    return [{ system, code: obj.code }];
  }
  // CodeableConcept: `{coding: [Coding, ...], text}`
  if (Array.isArray(obj.coding)) {
    const out: Array<{ system?: string; code: string }> = [];
    for (const c of obj.coding) {
      if (c && typeof c === 'object') {
        const inner = c as { system?: unknown; code?: unknown };
        if (typeof inner.code === 'string') {
          out.push({
            system: typeof inner.system === 'string' ? inner.system : undefined,
            code: inner.code,
          });
        }
      }
    }
    return out;
  }
  return [];
}
