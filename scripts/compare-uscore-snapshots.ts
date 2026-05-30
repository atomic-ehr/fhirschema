import { mkdirSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { generateSnapshot } from '../src/index';
import type { StructureDefinition, StructureDefinitionElement } from '../src/converter/types';

const TMP_DIR = '/tmp/uscore-snapshot-compare';
const US_CORE = { id: 'hl7.fhir.us.core', version: '8.0.0-ballot' };
const R4_CORE = { id: 'hl7.fhir.r4.core', version: '4.0.1' };
const SDC_CORE = { id: 'hl7.fhir.uv.sdc', version: '3.0.0' };

type PackageRef = { id: string; version: string };

type ElementDiff = {
  key: string;
  issues: string[];
};

type ProfileReport = {
  url: string;
  version?: string;
  name: string;
  generated: boolean;
  error?: string;
  originalCount: number;
  generatedCount: number;
  commonCount: number;
  missingCount: number;
  extraCount: number;
  keySetEqual: boolean;
  precision: number;
  recall: number;
  elementMismatches: number;
  sampleMissing: string[];
  sampleExtra: string[];
  sampleElementDiffs: ElementDiff[];
};

type FinalReport = {
  generatedAt: string;
  packages: {
    usCore: PackageRef;
    r4Core: PackageRef;
    sdc: PackageRef;
  };
  totals: {
    profiles: number;
    generated: number;
    failed: number;
    exactKeySetMatches: number;
    avgPrecision: number;
    avgRecall: number;
    avgElementMismatchPerProfile: number;
  };
  worksWell: string[];
  doesNotWorkYet: string[];
  topMissingHeavy: Array<{ url: string; missing: number; original: number }>;
  topExtraHeavy: Array<{ url: string; extra: number; generated: number }>;
  failures: Array<{ url: string; error: string }>;
  profiles: ProfileReport[];
};

function packageUrl(pkg: PackageRef): string {
  return `https://fs.get-ig.org/rs/${pkg.id}-${pkg.version}.ndjson.gz`;
}

function packageFile(pkg: PackageRef): string {
  return join(TMP_DIR, `${pkg.id}-${pkg.version}.ndjson.gz`);
}

async function downloadPackage(pkg: PackageRef): Promise<string> {
  const url = packageUrl(pkg);
  const filePath = packageFile(pkg);
  const file = Bun.file(filePath);
  if (await file.exists()) {
    return filePath;
  }

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download ${url}: ${res.status} ${res.statusText}`);
  }

  const bytes = new Uint8Array(await res.arrayBuffer());
  await Bun.write(filePath, bytes);
  return filePath;
}

async function loadNdjsonGz(path: string): Promise<unknown[]> {
  const bytes = await Bun.file(path).bytes();
  const text = gunzipSync(bytes).toString('utf8');
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line));
}

function isStructureDefinition(resource: unknown): resource is StructureDefinition {
  if (!resource || typeof resource !== 'object') return false;
  const r = resource as Record<string, unknown>;
  return r.resourceType === 'StructureDefinition' && typeof r.url === 'string';
}

function keyForElement(el: StructureDefinitionElement): string {
  return `${el.path}|${el.sliceName ?? ''}`;
}

function typeCodes(el: StructureDefinitionElement): string[] {
  return (el.type || []).map((t) => t.code).sort();
}

function compareElement(
  original: StructureDefinitionElement,
  generated: StructureDefinitionElement,
): string[] {
  const issues: string[] = [];

  if ((original.min ?? 0) !== (generated.min ?? 0)) {
    issues.push(`min original=${original.min ?? 0} generated=${generated.min ?? 0}`);
  }

  if ((original.max ?? '1') !== (generated.max ?? '1')) {
    issues.push(`max original=${original.max ?? '1'} generated=${generated.max ?? '1'}`);
  }

  const oTypes = typeCodes(original);
  const gTypes = typeCodes(generated);
  if (oTypes.join(',') !== gTypes.join(',')) {
    issues.push(`type original=[${oTypes.join(',')}] generated=[${gTypes.join(',')}]`);
  }

  return issues;
}

function byKey(elements: StructureDefinitionElement[]): Map<string, StructureDefinitionElement> {
  const map = new Map<string, StructureDefinitionElement>();
  for (const el of elements) {
    map.set(keyForElement(el), el);
  }
  return map;
}

function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}

async function run(): Promise<void> {
  mkdirSync(TMP_DIR, { recursive: true });

  const [usPath, r4Path, sdcPath] = await Promise.all([
    downloadPackage(US_CORE),
    downloadPackage(R4_CORE),
    downloadPackage(SDC_CORE),
  ]);
  const [usResources, r4Resources, sdcResources] = await Promise.all([
    loadNdjsonGz(usPath),
    loadNdjsonGz(r4Path),
    loadNdjsonGz(sdcPath),
  ]);

  const usSds = usResources.filter(isStructureDefinition);
  const r4Sds = r4Resources.filter(isStructureDefinition);
  const sdcSds = sdcResources.filter(isStructureDefinition);

  const resolverMap = new Map<string, StructureDefinition>();

  for (const sd of [...r4Sds, ...sdcSds, ...usSds]) {
    resolverMap.set(sd.url, sd);
    if (sd.version) {
      resolverMap.set(`${sd.url}|${sd.version}`, sd);
    }
  }

  const reports: ProfileReport[] = [];

  for (const sd of usSds) {
    const profileName = sd.name || sd.id || sd.url;

    if (!sd.snapshot?.element || sd.snapshot.element.length === 0) {
      reports.push({
        url: sd.url,
        version: sd.version,
        name: profileName,
        generated: false,
        error: 'Original snapshot is missing',
        originalCount: 0,
        generatedCount: 0,
        commonCount: 0,
        missingCount: 0,
        extraCount: 0,
        keySetEqual: false,
        precision: 0,
        recall: 0,
        elementMismatches: 0,
        sampleMissing: [],
        sampleExtra: [],
        sampleElementDiffs: [],
      });
      continue;
    }

    try {
      const generated = await generateSnapshot(sd, {
        resolver: {
          resolve: async (canonical, options) => {
            const direct = resolverMap.get(canonical);
            if (direct) return direct;
            if (options?.version) return resolverMap.get(`${canonical}|${options.version}`);
            return undefined;
          },
        },
      });

      const originalElements = sd.snapshot.element;
      const generatedElements = generated.snapshot?.element || [];

      const originalMap = byKey(originalElements);
      const generatedMap = byKey(generatedElements);

      const originalKeys = new Set(originalMap.keys());
      const generatedKeys = new Set(generatedMap.keys());

      const common = [...originalKeys].filter((k) => generatedKeys.has(k));
      const missing = [...originalKeys].filter((k) => !generatedKeys.has(k));
      const extra = [...generatedKeys].filter((k) => !originalKeys.has(k));

      const diffs: ElementDiff[] = [];
      for (const key of common) {
        const o = originalMap.get(key);
        const g = generatedMap.get(key);
        if (!o || !g) continue;
        const issues = compareElement(o, g);
        if (issues.length > 0) {
          diffs.push({ key, issues });
        }
      }

      const precision = generatedKeys.size === 0 ? 0 : common.length / generatedKeys.size;
      const recall = originalKeys.size === 0 ? 0 : common.length / originalKeys.size;

      reports.push({
        url: sd.url,
        version: sd.version,
        name: profileName,
        generated: true,
        originalCount: originalKeys.size,
        generatedCount: generatedKeys.size,
        commonCount: common.length,
        missingCount: missing.length,
        extraCount: extra.length,
        keySetEqual: missing.length === 0 && extra.length === 0,
        precision: round(precision),
        recall: round(recall),
        elementMismatches: diffs.length,
        sampleMissing: missing.slice(0, 10),
        sampleExtra: extra.slice(0, 10),
        sampleElementDiffs: diffs.slice(0, 10),
      });
    } catch (error) {
      reports.push({
        url: sd.url,
        version: sd.version,
        name: profileName,
        generated: false,
        error: error instanceof Error ? error.message : String(error),
        originalCount: sd.snapshot.element.length,
        generatedCount: 0,
        commonCount: 0,
        missingCount: sd.snapshot.element.length,
        extraCount: 0,
        keySetEqual: false,
        precision: 0,
        recall: 0,
        elementMismatches: 0,
        sampleMissing: [],
        sampleExtra: [],
        sampleElementDiffs: [],
      });
    }
  }

  const generated = reports.filter((r) => r.generated);
  const failures = reports.filter((r) => !r.generated);

  const avgPrecision =
    generated.length === 0 ? 0 : generated.reduce((sum, r) => sum + r.precision, 0) / generated.length;
  const avgRecall =
    generated.length === 0 ? 0 : generated.reduce((sum, r) => sum + r.recall, 0) / generated.length;
  const avgElementMismatchPerProfile =
    generated.length === 0
      ? 0
      : generated.reduce((sum, r) => sum + r.elementMismatches, 0) / generated.length;

  const exactKeySetMatches = generated.filter((r) => r.keySetEqual).length;

  const worksWell = generated
    .filter((r) => r.keySetEqual && r.elementMismatches <= 3)
    .map((r) => `${r.name} (${r.url})`)
    .slice(0, 20);

  const doesNotWorkYet = reports
    .filter((r) => !r.generated || r.recall < 0.9 || r.precision < 0.9 || r.elementMismatches > 20)
    .map((r) => `${r.name} (${r.url})${r.error ? `: ${r.error}` : ''}`)
    .slice(0, 20);

  const topMissingHeavy = generated
    .map((r) => ({ url: r.url, missing: r.missingCount, original: r.originalCount }))
    .sort((a, b) => b.missing - a.missing)
    .slice(0, 10);

  const topExtraHeavy = generated
    .map((r) => ({ url: r.url, extra: r.extraCount, generated: r.generatedCount }))
    .sort((a, b) => b.extra - a.extra)
    .slice(0, 10);

  const report: FinalReport = {
    generatedAt: new Date().toISOString(),
    packages: {
      usCore: US_CORE,
      r4Core: R4_CORE,
      sdc: SDC_CORE,
    },
    totals: {
      profiles: reports.length,
      generated: generated.length,
      failed: failures.length,
      exactKeySetMatches,
      avgPrecision: round(avgPrecision),
      avgRecall: round(avgRecall),
      avgElementMismatchPerProfile: round(avgElementMismatchPerProfile),
    },
    worksWell,
    doesNotWorkYet,
    topMissingHeavy,
    topExtraHeavy,
    failures: failures.map((f) => ({ url: f.url, error: f.error || 'unknown error' })),
    profiles: reports,
  };

  const jsonPath = join(TMP_DIR, 'snapshot-compare-report.json');
  const mdPath = join(TMP_DIR, 'snapshot-compare-report.md');

  await writeFile(jsonPath, JSON.stringify(report, null, 2), 'utf8');

  const md = [
    '# US Core Snapshot Comparison Report',
    '',
    `Generated at: ${report.generatedAt}`,
    '',
    '## Totals',
    '',
    `- Profiles: ${report.totals.profiles}`,
    `- Generated: ${report.totals.generated}`,
    `- Failed: ${report.totals.failed}`,
    `- Exact key-set matches: ${report.totals.exactKeySetMatches}`,
    `- Avg precision: ${report.totals.avgPrecision}`,
    `- Avg recall: ${report.totals.avgRecall}`,
    `- Avg element mismatch/profile: ${report.totals.avgElementMismatchPerProfile}`,
    '',
    '## Works Well (sample)',
    ...report.worksWell.map((x) => `- ${x}`),
    '',
    '## Does Not Work Yet (sample)',
    ...report.doesNotWorkYet.map((x) => `- ${x}`),
    '',
    '## Top Missing Heavy',
    ...report.topMissingHeavy.map((x) => `- ${x.url}: missing=${x.missing}/${x.original}`),
    '',
    '## Top Extra Heavy',
    ...report.topExtraHeavy.map((x) => `- ${x.url}: extra=${x.extra}/${x.generated}`),
    '',
    '## Failures',
    ...report.failures.map((x) => `- ${x.url}: ${x.error}`),
    '',
    `JSON report: ${jsonPath}`,
  ].join('\n');

  await writeFile(mdPath, md, 'utf8');

  console.log(`Report written:\n- ${jsonPath}\n- ${mdPath}`);
  console.log(
    JSON.stringify(
      {
        totals: report.totals,
        topMissingHeavy: report.topMissingHeavy.slice(0, 3),
        topExtraHeavy: report.topExtraHeavy.slice(0, 3),
      },
      null,
      2,
    ),
  );
}

await run();
