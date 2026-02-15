import { describe, expect, it } from 'bun:test';
import { mkdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { generateSnapshot } from '../../src/index';
import type { StructureDefinition, StructureDefinitionElement } from '../../src/converter/types';

type PackageRef = { id: string; version: string };

type CompareTotals = {
  profiles: number;
  generated: number;
  failed: number;
  exactKeySetMatches: number;
  avgPrecision: number;
  avgRecall: number;
};

const CACHE_DIR = '.cache/ig-packages'; // gitignored by existing .gitignore rule

function packageUrl(pkg: PackageRef): string {
  return `https://fs.get-ig.org/rs/${pkg.id}-${pkg.version}.ndjson.gz`;
}

function packagePath(pkg: PackageRef): string {
  return `${CACHE_DIR}/${pkg.id}-${pkg.version}.ndjson.gz`;
}

async function ensurePackage(pkg: PackageRef): Promise<string> {
  mkdirSync(CACHE_DIR, { recursive: true });
  const path = packagePath(pkg);
  const file = Bun.file(path);
  if (await file.exists()) return path;

  const res = await fetch(packageUrl(pkg));
  if (!res.ok) {
    throw new Error(`Failed to download ${packageUrl(pkg)}: ${res.status} ${res.statusText}`);
  }
  await Bun.write(path, new Uint8Array(await res.arrayBuffer()));
  return path;
}

async function loadNdjsonGz(path: string): Promise<unknown[]> {
  const bytes = await Bun.file(path).bytes();
  const text = gunzipSync(bytes).toString('utf8');
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function isStructureDefinition(resource: unknown): resource is StructureDefinition {
  if (!resource || typeof resource !== 'object') return false;
  const r = resource as Record<string, unknown>;
  return r.resourceType === 'StructureDefinition' && typeof r.url === 'string';
}

function keyOf(el: StructureDefinitionElement): string {
  return `${el.path}|${el.sliceName ?? ''}`;
}

function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}

async function compareSnapshots(target: PackageRef, dependencies: PackageRef[] = []): Promise<CompareTotals> {
  const allRefs = [target, ...dependencies];
  const paths = await Promise.all(allRefs.map((ref) => ensurePackage(ref)));
  const packageResources = await Promise.all(paths.map((p) => loadNdjsonGz(p)));

  const allSds = packageResources.flatMap((rows) => rows.filter(isStructureDefinition));
  const targetSds = packageResources[0].filter(isStructureDefinition);

  // Keep first hit to preserve dependency precedence order.
  const resolver = new Map<string, StructureDefinition>();
  for (const sd of allSds) {
    if (!resolver.has(sd.url)) resolver.set(sd.url, sd);
    if (sd.version && !resolver.has(`${sd.url}|${sd.version}`)) {
      resolver.set(`${sd.url}|${sd.version}`, sd);
    }
  }

  let generated = 0;
  let failed = 0;
  let exactKeySetMatches = 0;
  let precisionSum = 0;
  let recallSum = 0;

  const comparable = targetSds.filter((sd) => sd.snapshot?.element && sd.snapshot.element.length > 0);

  for (const sd of comparable) {
    try {
      const generatedSd = await generateSnapshot(sd, {
        resolver: {
          resolve: async (canonical, options) => {
            const direct = resolver.get(canonical);
            if (direct) return direct;
            if (options?.version) return resolver.get(`${canonical}|${options.version}`);
            return undefined;
          },
        },
      });

      generated += 1;
      const originalSet = new Set((sd.snapshot?.element || []).map((el) => keyOf(el)));
      const generatedSet = new Set((generatedSd.snapshot?.element || []).map((el) => keyOf(el)));

      const common = [...originalSet].filter((k) => generatedSet.has(k));
      const missing = [...originalSet].filter((k) => !generatedSet.has(k));
      const extra = [...generatedSet].filter((k) => !originalSet.has(k));

      if (missing.length === 0 && extra.length === 0) {
        exactKeySetMatches += 1;
      }

      const precision = generatedSet.size === 0 ? 0 : common.length / generatedSet.size;
      const recall = originalSet.size === 0 ? 0 : common.length / originalSet.size;
      precisionSum += precision;
      recallSum += recall;
    } catch {
      failed += 1;
    }
  }

  return {
    profiles: comparable.length,
    generated,
    failed,
    exactKeySetMatches,
    avgPrecision: round(generated === 0 ? 0 : precisionSum / generated),
    avgRecall: round(generated === 0 ? 0 : recallSum / generated),
  };
}

describe('IG snapshot parity against package snapshots (cached from get-ig)', () => {
  it('FHIR R4 Core differential-based baseline', async () => {
    const totals = await compareSnapshots({ id: 'hl7.fhir.r4.core', version: '4.0.1' });

    expect(totals.generated + totals.failed).toBe(totals.profiles);
    expect(totals.failed).toBeLessThanOrEqual(4);
    expect(totals.generated).toBeGreaterThanOrEqual(649);
    expect(totals.exactKeySetMatches).toBeGreaterThanOrEqual(428);
    expect(totals.avgPrecision).toBeGreaterThanOrEqual(0.998);
    expect(totals.avgRecall).toBeGreaterThanOrEqual(0.93);
  });

  it('US Core differential-based snapshot parity', async () => {
    const totals = await compareSnapshots(
      { id: 'hl7.fhir.us.core', version: '8.0.0-ballot' },
      [
        { id: 'hl7.fhir.r4.core', version: '4.0.1' },
        { id: 'hl7.fhir.uv.sdc', version: '3.0.0' },
      ],
    );

    expect(totals.generated + totals.failed).toBe(totals.profiles);
    expect(totals.failed).toBe(0);
    expect(totals.generated).toBe(totals.profiles);
    expect(totals.exactKeySetMatches).toBeGreaterThanOrEqual(10);
    expect(totals.avgPrecision).toBeGreaterThanOrEqual(0.98);
    expect(totals.avgRecall).toBeGreaterThanOrEqual(0.81);
  });

  it('DaVinci HRex differential-based compatibility run', async () => {
    const totals = await compareSnapshots(
      { id: 'hl7.fhir.us.davinci-hrex', version: '1.1.0' },
      [
        { id: 'hl7.fhir.r4.core', version: '4.0.1' },
        { id: 'hl7.fhir.us.core', version: '8.0.0-ballot' },
        { id: 'hl7.fhir.uv.sdc', version: '3.0.0' },
        { id: 'hl7.fhir.r5.core', version: '5.0.0' },
      ],
    );

    expect(totals.generated + totals.failed).toBe(totals.profiles);
    expect(totals.failed).toBe(0);
    expect(totals.generated).toBe(totals.profiles);
    expect(totals.exactKeySetMatches).toBeGreaterThanOrEqual(4);
    expect(totals.avgPrecision).toBeGreaterThanOrEqual(0.84);
    expect(totals.avgRecall).toBeGreaterThanOrEqual(0.71);
  });
});
