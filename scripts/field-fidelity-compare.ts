// EMPIRICAL field-level fidelity test.
// For US Core 8.0.0-ballot (+ R4 core + SDC deps) and R4 core itself:
//  - build resolver Map keyed by url and url|version
//  - generate snapshots, then on element keys present in BOTH official and
//    generated, compare per-field and tally MISSING / EXTRA / DIFFERENT.

import { gunzipSync } from 'zlib';
import { readFileSync } from 'fs';
import { generateSnapshot } from '../src/index';
import type { StructureDefinition, StructureDefinitionElement } from '../src/converter/types';

const PKG_DIR = '/Users/niquola/fhirschema/.cache/ig-packages';

const PACKAGES = [
  'hl7.fhir.r4.core-4.0.1',
  'hl7.fhir.uv.sdc-3.0.0',
  'hl7.fhir.us.core-8.0.0-ballot',
];

function loadPackage(name: string): any[] {
  const buf = readFileSync(`${PKG_DIR}/${name}.ndjson.gz`);
  const text = gunzipSync(buf).toString('utf8');
  const out: any[] = [];
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    try { out.push(JSON.parse(t)); } catch { /* skip */ }
  }
  return out;
}

// ---- Load all packages, build resolver ----
const allResources: any[] = [];
for (const p of PACKAGES) allResources.push(...loadPackage(p));

const resolverMap = new Map<string, StructureDefinition>();
const allSds: StructureDefinition[] = [];
for (const r of allResources) {
  if (r.resourceType !== 'StructureDefinition') continue;
  allSds.push(r);
  if (r.url) {
    if (!resolverMap.has(r.url)) resolverMap.set(r.url, r);
    if (r.version) resolverMap.set(`${r.url}|${r.version}`, r);
  }
}

function resolve(canonical: string, opts?: { version?: string }): StructureDefinition | undefined {
  if (opts?.version) {
    const v = resolverMap.get(`${canonical}|${opts.version}`);
    if (v) return v;
  }
  return resolverMap.get(canonical);
}

const elementKey = (e: StructureDefinitionElement) => `${e.path}|${e.sliceName || ''}`;

// ---------------------------------------------------------------------------
// Field comparison
// ---------------------------------------------------------------------------

// Fields we explicitly track. Everything else lands in "other".
const TRACKED_FIELDS = [
  'min', 'max', 'type', 'binding', 'constraint', 'mustSupport',
  'short', 'definition', 'comment', 'requirements', 'mapping', 'example',
  'alias', 'fixed', 'pattern', 'slicing', 'isModifier', 'isModifierReason',
  'isSummary', 'condition', 'base', 'representation', 'meaningWhenMissing',
  'orderMeaning', 'maxLength', 'contentReference', 'defaultValue', 'sliceIsConstraining',
  'label', 'code', 'extension', 'id', 'path', 'sliceName',
];

// fixed[x]/pattern[x] are polymorphic. Collapse to logical "fixed"/"pattern".
function logicalField(key: string): string {
  if (key.startsWith('fixed')) return 'fixed';
  if (key.startsWith('pattern')) return 'pattern';
  if (key.startsWith('defaultValue')) return 'defaultValue';
  if (key.startsWith('minValue')) return 'minValue';
  if (key.startsWith('maxValue')) return 'maxValue';
  if (key.startsWith('_')) return `_primitiveExt:${key}`;
  return key;
}

function collectFields(e: StructureDefinitionElement): Map<string, any> {
  const m = new Map<string, any>();
  for (const [k, v] of Object.entries(e)) {
    if (v === undefined) continue;
    const lf = logicalField(k);
    m.set(lf, v);
  }
  return m;
}

// Deep equality with stable key ordering for objects/arrays.
function canon(v: any): any {
  if (Array.isArray(v)) return v.map(canon);
  if (v && typeof v === 'object') {
    const out: Record<string, any> = {};
    for (const k of Object.keys(v).sort()) out[k] = canon(v[k]);
    return out;
  }
  return v;
}
function deepEq(a: any, b: any): boolean {
  return JSON.stringify(canon(a)) === JSON.stringify(canon(b));
}

// Type comparison helpers --------------------------------------------------
// Detect the System.* primitive-type pattern in official type arrays.
function typeUsesSystemPrimitive(type: any[]): boolean {
  if (!Array.isArray(type)) return false;
  return type.some(
    (t) => typeof t?.code === 'string' && t.code.startsWith('http://hl7.org/fhirpath/System.'),
  );
}
// Normalize a type array down to its semantic core (code list + targets + profiles),
// ignoring the System.* url and the structuredefinition-fhir-type extension.
function normType(type: any[]): any {
  if (!Array.isArray(type)) return type;
  return type.map((t) => {
    let code = t?.code;
    if (typeof code === 'string' && code.startsWith('http://hl7.org/fhirpath/System.')) {
      // map back to the FHIR primitive carried in the fhir-type extension if present
      const ext = (t.extension || []).find(
        (x: any) => x.url === 'http://hl7.org/fhir/StructureDefinition/structuredefinition-fhir-type',
      );
      code = ext?.valueUrl || ext?.valueString || code;
    }
    const o: any = { code };
    if (t?.profile) o.profile = [...t.profile].sort();
    if (t?.targetProfile) o.targetProfile = [...t.targetProfile].sort();
    if (t?.aggregation) o.aggregation = [...t.aggregation].sort();
    if (t?.versioning) o.versioning = t.versioning;
    return o;
  });
}

// ---------------------------------------------------------------------------

type Tally = {
  missing: Map<string, number>;   // field present official, absent generated
  extra: Map<string, number>;     // field present generated, absent official
  different: Map<string, number>; // both present, differ
  // diagnostic sub-categories
  typeSystemPrimitiveOnlyDiff: number;  // type differs ONLY because of System.* vs fhir-code
  typeSemanticDiff: number;             // type differs in code/profile/target
  bindingMissingDescription: number;    // binding present both, only description differs/missing
  constraintMissingXpath: number;       // constraint present both, generated lacks xpath
  constraintMissingFields: Map<string, number>; // which constraint subfields generated drops
  matchedElements: number;
  touchedMatched: number;               // matched elements the leaf differential authored
  inheritedMatched: number;             // matched elements purely inherited (untouched by leaf)
  missingTouched: Map<string, number>;  // MISSING split: leaf actually authored this row
  missingInherited: Map<string, number>;// MISSING split: row is purely inherited base metadata
  examples: Map<string, string>;        // field -> a sample diff (for the report)
};

function inc(m: Map<string, number>, k: string, by = 1) { m.set(k, (m.get(k) || 0) + by); }

function newTally(): Tally {
  return {
    missing: new Map(), extra: new Map(), different: new Map(),
    typeSystemPrimitiveOnlyDiff: 0, typeSemanticDiff: 0,
    bindingMissingDescription: 0,
    constraintMissingXpath: 0, constraintMissingFields: new Map(),
    matchedElements: 0,
    touchedMatched: 0, inheritedMatched: 0,
    missingTouched: new Map(), missingInherited: new Map(),
    examples: new Map(),
  };
}

function compareElement(
  official: StructureDefinitionElement,
  generated: StructureDefinitionElement,
  t: Tally,
  exampleProfile: string,
  leafTouched: boolean,
) {
  t.matchedElements++;
  if (leafTouched) t.touchedMatched++; else t.inheritedMatched++;
  const of = collectFields(official);
  const gf = collectFields(generated);
  const keys = new Set<string>([...of.keys(), ...gf.keys()]);

  for (const k of keys) {
    const hasO = of.has(k);
    const hasG = gf.has(k);

    if (hasO && !hasG) {
      inc(t.missing, k);
      if (leafTouched) inc(t.missingTouched, k); else inc(t.missingInherited, k);
      if (!t.examples.has(`missing:${k}`)) {
        t.examples.set(`missing:${k}`, `${exampleProfile} @ ${elementKey(official)}: official=${JSON.stringify(of.get(k)).slice(0, 120)}`);
      }
      continue;
    }
    if (!hasO && hasG) {
      inc(t.extra, k);
      if (!t.examples.has(`extra:${k}`)) {
        t.examples.set(`extra:${k}`, `${exampleProfile} @ ${elementKey(generated)}: generated=${JSON.stringify(gf.get(k)).slice(0, 120)}`);
      }
      continue;
    }

    // both present — compare
    const ov = of.get(k);
    const gv = gf.get(k);

    if (k === 'type') {
      const normEq = deepEq(normType(ov), normType(gv));
      if (deepEq(ov, gv)) continue; // identical even raw
      if (normEq) {
        // Differs only by System.* primitive encoding (or fhir-type extension placement)
        if (typeUsesSystemPrimitive(ov) && !typeUsesSystemPrimitive(gv)) {
          t.typeSystemPrimitiveOnlyDiff++;
          inc(t.different, 'type');
          if (!t.examples.has('different:type')) {
            t.examples.set('different:type', `${exampleProfile} @ ${elementKey(official)}: official type code=${JSON.stringify(ov.map((x:any)=>x.code))} vs generated=${JSON.stringify(gv.map((x:any)=>x.code))}`);
          }
        } else {
          // some other cosmetic (e.g. extension ordering) — still count as diff but mark cosmetic
          t.typeSystemPrimitiveOnlyDiff++;
          inc(t.different, 'type');
        }
      } else {
        t.typeSemanticDiff++;
        inc(t.different, 'type');
        if (!t.examples.has('different:type:semantic')) {
          t.examples.set('different:type:semantic', `${exampleProfile} @ ${elementKey(official)}: official=${JSON.stringify(normType(ov)).slice(0,160)} vs generated=${JSON.stringify(normType(gv)).slice(0,160)}`);
        }
      }
      continue;
    }

    if (deepEq(ov, gv)) continue;

    inc(t.different, k);
    if (!t.examples.has(`different:${k}`)) {
      t.examples.set(`different:${k}`, `${exampleProfile} @ ${elementKey(official)}: official=${JSON.stringify(ov).slice(0, 140)} vs generated=${JSON.stringify(gv).slice(0, 140)}`);
    }

    // sub-diagnostics
    if (k === 'binding') {
      const oDesc = (ov as any)?.description;
      const gDesc = (gv as any)?.description;
      const oNoDesc = { ...(ov as any) }; delete oNoDesc.description;
      const gNoDesc = { ...(gv as any) }; delete gNoDesc.description;
      if (deepEq(oNoDesc, gNoDesc) && oDesc !== gDesc) t.bindingMissingDescription++;
    }
    if (k === 'constraint') {
      // constraint is an array; check whether generated drops xpath / other subfields
      const oArr = Array.isArray(ov) ? ov : [];
      const gArr = Array.isArray(gv) ? gv : [];
      const gByKey = new Map(gArr.map((c: any) => [c.key, c]));
      for (const oc of oArr) {
        const gc = gByKey.get(oc.key);
        if (!gc) continue;
        for (const sub of Object.keys(oc)) {
          if (gc[sub] === undefined && oc[sub] !== undefined) {
            inc(t.constraintMissingFields, sub);
            if (sub === 'xpath') t.constraintMissingXpath++;
          }
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------

async function run() {
  // Which profiles to measure: every SD in US Core + SDC + R4 core that has a
  // snapshot and a differential. We treat US Core/SDC as the "profiles" set and
  // also sample R4 core base-resource profiles.
  const targets = allSds.filter(
    (sd) => sd.snapshot?.element?.length && sd.differential?.element?.length,
  );

  const groups: Record<string, Tally> = {
    'US Core + SDC + R4(all matched)': newTally(),
  };
  // Also a per-source split.
  const bySource: Record<string, Tally> = {};
  const sourceOf = (url: string): string => {
    if (url.includes('/us/core/')) return 'us-core';
    if (url.includes('/uv/sdc/')) return 'sdc';
    if (url.startsWith('http://hl7.org/fhir/StructureDefinition/')) return 'r4-core';
    return 'other';
  };

  let okProfiles = 0, failProfiles = 0;
  let totalOfficialEls = 0, totalGenEls = 0, totalMatchedKeys = 0;
  const failures: string[] = [];

  for (const sd of targets) {
    let gen: StructureDefinition;
    try {
      gen = await generateSnapshot(sd, { resolver: { resolve } });
    } catch (e: any) {
      failProfiles++;
      failures.push(`${sd.url}: ${e.message}`);
      continue;
    }
    okProfiles++;

    const officialEls = sd.snapshot!.element;
    const genEls = gen.snapshot!.element;
    totalOfficialEls += officialEls.length;
    totalGenEls += genEls.length;

    const oByKey = new Map<string, StructureDefinitionElement>();
    for (const e of officialEls) if (!oByKey.has(elementKey(e))) oByKey.set(elementKey(e), e);
    const gByKey = new Map<string, StructureDefinitionElement>();
    for (const e of genEls) if (!gByKey.has(elementKey(e))) gByKey.set(elementKey(e), e);

    const src = sourceOf(sd.url);
    if (!bySource[src]) bySource[src] = newTally();

    // A "leaf-touched" key is one authored in THIS profile's own differential.
    const leafKeys = new Set<string>(
      (sd.differential?.element || []).map((e) => elementKey(e)),
    );

    for (const [key, oel] of oByKey) {
      const gel = gByKey.get(key);
      if (!gel) continue; // not a matched key — out of scope for field comparison
      totalMatchedKeys++;
      const touched = leafKeys.has(key);
      compareElement(oel, gel, groups['US Core + SDC + R4(all matched)'], sd.url, touched);
      compareElement(oel, gel, bySource[src], sd.url, touched);
    }
  }

  // ---- Report ----
  const lines: string[] = [];
  lines.push('=== FIELD-LEVEL FIDELITY (matched element keys only) ===');
  lines.push(`Packages: ${PACKAGES.join(', ')}`);
  lines.push(`Profiles measured (snapshot+differential): ${targets.length}  ok=${okProfiles} failed=${failProfiles}`);
  lines.push(`Official elements total: ${totalOfficialEls}  Generated elements total: ${totalGenEls}`);
  lines.push(`Matched element keys (in BOTH): ${totalMatchedKeys}`);
  lines.push('');

  function dumpTally(name: string, t: Tally) {
    lines.push(`---- ${name} ----  matchedElements=${t.matchedElements} (leaf-touched=${t.touchedMatched}, purely-inherited=${t.inheritedMatched})`);
    const sortMap = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1]);
    lines.push('MISSING on our side (field present in official, absent generated):');
    for (const [k, n] of sortMap(t.missing)) {
      const pct = ((n / t.matchedElements) * 100).toFixed(1);
      const onTouched = t.missingTouched.get(k) || 0;
      const onInherited = t.missingInherited.get(k) || 0;
      const tpct = t.touchedMatched ? ((onTouched / t.touchedMatched) * 100).toFixed(1) : '0.0';
      lines.push(`  ${k}: ${n} (${pct}% of matched els) [on leaf-touched=${onTouched} (${tpct}% of touched), on inherited=${onInherited}]`);
    }
    lines.push('EXTRA on our side (field generated, absent official):');
    for (const [k, n] of sortMap(t.extra)) {
      const pct = ((n / t.matchedElements) * 100).toFixed(1);
      lines.push(`  ${k}: ${n} (${pct}%)`);
    }
    lines.push('DIFFERENT (both present, values differ):');
    for (const [k, n] of sortMap(t.different)) {
      const pct = ((n / t.matchedElements) * 100).toFixed(1);
      lines.push(`  ${k}: ${n} (${pct}%)`);
    }
    lines.push(`  [type diag] System-primitive-only diffs: ${t.typeSystemPrimitiveOnlyDiff}, semantic type diffs: ${t.typeSemanticDiff}`);
    lines.push(`  [binding diag] diffs that are only binding.description: ${t.bindingMissingDescription}`);
    lines.push(`  [constraint diag] generated drops xpath: ${t.constraintMissingXpath}; dropped subfields: ${JSON.stringify([...t.constraintMissingFields.entries()].sort((a,b)=>b[1]-a[1]))}`);
    lines.push('');
  }

  dumpTally('ALL (US Core + SDC + R4 core)', groups['US Core + SDC + R4(all matched)']);
  for (const [src, t] of Object.entries(bySource).sort()) dumpTally(`SOURCE=${src}`, t);

  lines.push('=== EXAMPLES (one per category, ALL group) ===');
  const allEx = groups['US Core + SDC + R4(all matched)'].examples;
  for (const [k, v] of [...allEx.entries()].sort()) lines.push(`  [${k}] ${v}`);
  lines.push('');

  if (failures.length) {
    lines.push('=== FAILED PROFILES ===');
    for (const f of failures.slice(0, 40)) lines.push('  ' + f);
  }

  const report = lines.join('\n');
  console.log(report);
  await Bun.write('/tmp/field-fidelity-report.txt', report);

  // structured JSON for downstream
  const toObj = (t: Tally) => ({
    matchedElements: t.matchedElements,
    touchedMatched: t.touchedMatched,
    inheritedMatched: t.inheritedMatched,
    missingTouched: Object.fromEntries(t.missingTouched),
    missingInherited: Object.fromEntries(t.missingInherited),
    missing: Object.fromEntries(t.missing),
    extra: Object.fromEntries(t.extra),
    different: Object.fromEntries(t.different),
    typeSystemPrimitiveOnlyDiff: t.typeSystemPrimitiveOnlyDiff,
    typeSemanticDiff: t.typeSemanticDiff,
    bindingMissingDescription: t.bindingMissingDescription,
    constraintMissingXpath: t.constraintMissingXpath,
    constraintMissingFields: Object.fromEntries(t.constraintMissingFields),
    examples: Object.fromEntries(t.examples),
  });
  await Bun.write('/tmp/field-fidelity-report.json', JSON.stringify({
    packages: PACKAGES,
    profilesMeasured: targets.length, okProfiles, failProfiles,
    totalOfficialEls, totalGenEls, totalMatchedKeys,
    all: toObj(groups['US Core + SDC + R4(all matched)']),
    bySource: Object.fromEntries(Object.entries(bySource).map(([k, v]) => [k, toObj(v)])),
    failures,
  }, null, 2));
}

run();
