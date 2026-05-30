import { mkdirSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { generateSnapshot } from '../src/index';
import type { StructureDefinition, StructureDefinitionElement } from '../src/converter/types';

type PackageRef = { id: string; version: string };

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
};

type FinalReport = {
  generatedAt: string;
  target: PackageRef;
  dependencies: PackageRef[];
  totals: {
    profiles: number;
    generated: number;
    failed: number;
    exactKeySetMatches: number;
    avgPrecision: number;
    avgRecall: number;
  };
  failures: Array<{ url: string; error: string }>;
  profiles: ProfileReport[];
};

function parsePackageRef(raw: string): PackageRef {
  const parts = raw.split('@');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error(`Invalid package ref: ${raw}. Expected packageId@version`);
  }
  return { id: parts[0], version: parts[1] };
}

function parseArgs() {
  const args = Bun.argv.slice(2);
  const map = new Map<string, string>();
  for (let i = 0; i < args.length; i += 2) {
    map.set(args[i], args[i + 1]);
  }

  const targetRaw = map.get('--target');
  if (!targetRaw) throw new Error('Missing --target packageId@version');
  const depsRaw = map.get('--deps') || '';
  const tmpDir = map.get('--tmp') || '/tmp/ig-snapshot-compare';

  const target = parsePackageRef(targetRaw);
  const dependencies = depsRaw
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
    .map(parsePackageRef);

  return { target, dependencies, tmpDir };
}

function packageUrl(pkg: PackageRef): string {
  return `https://fs.get-ig.org/rs/${pkg.id}-${pkg.version}.ndjson.gz`;
}

function packageFile(tmpDir: string, pkg: PackageRef): string {
  return join(tmpDir, `${pkg.id}-${pkg.version}.ndjson.gz`);
}

async function downloadPackage(tmpDir: string, pkg: PackageRef): Promise<string> {
  const url = packageUrl(pkg);
  const filePath = packageFile(tmpDir, pkg);
  const file = Bun.file(filePath);
  if (await file.exists()) {
    return filePath;
  }

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download ${url}: ${res.status} ${res.statusText}`);
  }

  await Bun.write(filePath, new Uint8Array(await res.arrayBuffer()));
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

function byKey(elements: StructureDefinitionElement[]): Set<string> {
  return new Set(elements.map((e) => keyForElement(e)));
}

function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}

async function run() {
  const { target, dependencies, tmpDir } = parseArgs();
  mkdirSync(tmpDir, { recursive: true });

  const allPackages = [target, ...dependencies];
  const paths = await Promise.all(allPackages.map((p) => downloadPackage(tmpDir, p)));
  const resourcesByPackage = await Promise.all(paths.map((p) => loadNdjsonGz(p)));

  const allSds = resourcesByPackage.flatMap((resources) => resources.filter(isStructureDefinition));
  const targetSds = resourcesByPackage[0].filter(isStructureDefinition);

  const resolverMap = new Map<string, StructureDefinition>();
  for (const sd of allSds) {
    resolverMap.set(sd.url, sd);
    if (sd.version) resolverMap.set(`${sd.url}|${sd.version}`, sd);
  }

  const reports: ProfileReport[] = [];

  for (const sd of targetSds) {
    if (!sd.snapshot?.element || sd.snapshot.element.length === 0) {
      continue;
    }

    try {
      const generated = await generateSnapshot(sd, {
        resolver: {
          async resolve(canonical, options) {
            const direct = resolverMap.get(canonical);
            if (direct) return direct;
            if (options?.version) return resolverMap.get(`${canonical}|${options.version}`);
            return undefined;
          },
        },
      });

      const originalSet = byKey(sd.snapshot.element);
      const generatedSet = byKey(generated.snapshot?.element || []);

      const common = [...originalSet].filter((k) => generatedSet.has(k));
      const missing = [...originalSet].filter((k) => !generatedSet.has(k));
      const extra = [...generatedSet].filter((k) => !originalSet.has(k));

      const precision = generatedSet.size === 0 ? 0 : common.length / generatedSet.size;
      const recall = originalSet.size === 0 ? 0 : common.length / originalSet.size;

      reports.push({
        url: sd.url,
        version: sd.version,
        name: sd.name || sd.id || sd.url,
        generated: true,
        originalCount: originalSet.size,
        generatedCount: generatedSet.size,
        commonCount: common.length,
        missingCount: missing.length,
        extraCount: extra.length,
        keySetEqual: missing.length === 0 && extra.length === 0,
        precision: round(precision),
        recall: round(recall),
      });
    } catch (error) {
      reports.push({
        url: sd.url,
        version: sd.version,
        name: sd.name || sd.id || sd.url,
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
      });
    }
  }

  const generated = reports.filter((r) => r.generated);
  const failed = reports.filter((r) => !r.generated);
  const avgPrecision = generated.length
    ? generated.reduce((sum, r) => sum + r.precision, 0) / generated.length
    : 0;
  const avgRecall = generated.length
    ? generated.reduce((sum, r) => sum + r.recall, 0) / generated.length
    : 0;

  const finalReport: FinalReport = {
    generatedAt: new Date().toISOString(),
    target,
    dependencies,
    totals: {
      profiles: reports.length,
      generated: generated.length,
      failed: failed.length,
      exactKeySetMatches: generated.filter((r) => r.keySetEqual).length,
      avgPrecision: round(avgPrecision),
      avgRecall: round(avgRecall),
    },
    failures: failed.map((f) => ({ url: f.url, error: f.error || 'unknown error' })),
    profiles: reports,
  };

  const prefix = `${target.id}-${target.version}`;
  const jsonPath = join(tmpDir, `${prefix}-snapshot-compare.json`);
  await writeFile(jsonPath, JSON.stringify(finalReport, null, 2), 'utf8');

  console.log(`Report: ${jsonPath}`);
  console.log(JSON.stringify(finalReport.totals, null, 2));
}

await run();
