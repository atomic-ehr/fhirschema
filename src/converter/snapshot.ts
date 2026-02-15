import { merge } from '../validator/profile.js';
import { toStructureDefinition } from './reverse.js';
import { translate } from './index.js';
import type { FHIRSchema, StructureDefinition, StructureDefinitionElement } from './types.js';

type MaybePromise<T> = T | Promise<T>;

export interface ResolveInput {
  canonical: string;
  version?: string;
  resourceType?: string;
}

export interface ResolverObject {
  resolve: (
    canonical: string,
    options?: {
      version?: string;
      resourceType?: string;
    },
  ) => MaybePromise<unknown>;
}

export type StructureDefinitionResolver =
  | ((input: ResolveInput) => MaybePromise<StructureDefinition | undefined>)
  | ((canonical: string) => MaybePromise<StructureDefinition | undefined>)
  | ResolverObject
  | Record<string, StructureDefinition>;

export interface SnapshotGenerationOptions {
  resolver: StructureDefinitionResolver;
  maxDepth?: number;
}

function splitCanonicalVersion(value: string): { canonical: string; version?: string } {
  const [canonical, version] = value.split('|');
  return { canonical, ...(version ? { version } : {}) };
}

function isStructureDefinition(resource: unknown): resource is StructureDefinition {
  if (!resource || typeof resource !== 'object') {
    return false;
  }

  const candidate = resource as Record<string, unknown>;
  return (
    candidate.resourceType === 'StructureDefinition' &&
    typeof candidate.url === 'string' &&
    typeof candidate.type === 'string'
  );
}

async function resolveByCanonical(
  resolver: StructureDefinitionResolver,
  canonicalWithVersion: string,
): Promise<StructureDefinition | undefined> {
  const { canonical, version } = splitCanonicalVersion(canonicalWithVersion);

  if (typeof resolver === 'function') {
    // Polymorphic function form: either resolve(input) or resolve(canonical)
    const asInput = (await (resolver as (input: ResolveInput) => MaybePromise<unknown>)({
      canonical,
      version,
      resourceType: 'StructureDefinition',
    })) as unknown;

    if (isStructureDefinition(asInput) || asInput === undefined) {
      return asInput;
    }

    const asCanonical = (await (resolver as (value: string) => MaybePromise<unknown>)(
      canonicalWithVersion,
    )) as unknown;
    return isStructureDefinition(asCanonical) ? asCanonical : undefined;
  }

  if ('resolve' in resolver && typeof resolver.resolve === 'function') {
    const resolved = await resolver.resolve(canonical, {
      version,
      resourceType: 'StructureDefinition',
    });
    return isStructureDefinition(resolved) ? resolved : undefined;
  }

  // Map fallback supports exact key and canonical-only key.
  const mapResolver = resolver as Record<string, StructureDefinition>;
  const direct = mapResolver[canonicalWithVersion] || mapResolver[canonical];
  return direct;
}

function ensureDifferential(sd: StructureDefinition): StructureDefinition {
  if (sd.differential?.element && sd.differential.element.length > 0) {
    return sd;
  }

  throw new Error(`StructureDefinition ${sd.url || sd.name} has no differential.element`);
}

async function buildBaseChain(
  leaf: StructureDefinition,
  resolver: StructureDefinitionResolver,
  maxDepth: number,
): Promise<StructureDefinition[]> {
  const chain: StructureDefinition[] = [];
  const visited = new Set<string>();

  let current: StructureDefinition | undefined = leaf;
  let depth = 0;

  while (current) {
    if (depth > maxDepth) {
      throw new Error(
        `Base chain depth exceeded maxDepth=${maxDepth} while resolving ${leaf.url || leaf.name}`,
      );
    }

    const key = current.url || current.name;
    if (visited.has(key)) {
      throw new Error(`Circular baseDefinition chain detected at ${key}`);
    }

    visited.add(key);
    chain.unshift(ensureDifferential(current));

    const baseCanonical = current.baseDefinition;
    if (!baseCanonical) {
      break;
    }

    const next = await resolveByCanonical(resolver, baseCanonical);
    if (!next) {
      throw new Error(`Unable to resolve baseDefinition: ${baseCanonical}`);
    }

    current = next;
    depth += 1;
  }

  return chain;
}

function mergeSchemas(baseToLeafSchemas: FHIRSchema[]): FHIRSchema {
  if (baseToLeafSchemas.length === 0) {
    throw new Error('Cannot merge empty schema chain');
  }

  return baseToLeafSchemas.reduce((acc, schema) => merge(acc, schema) as FHIRSchema);
}

function elementKey(element: { path: string; sliceName?: string }): string {
  return `${element.path}|${element.sliceName || ''}`;
}

function rehydrateChoiceSliceMarkers(
  source: StructureDefinition,
  generatedElements: StructureDefinitionElement[],
): StructureDefinitionElement[] {
  const target = [...generatedElements];
  const seen = new Set(target.map((el) => elementKey(el)));

  const sourceElements = source.snapshot?.element || source.differential?.element || [];
  for (const sourceElement of sourceElements) {
    if (!sourceElement.path.includes('[x]') || !sourceElement.sliceName) {
      continue;
    }

    const key = elementKey(sourceElement);
    if (seen.has(key)) {
      continue;
    }

    const marker = {
      path: sourceElement.path,
      sliceName: sourceElement.sliceName,
      ...(sourceElement.type ? { type: sourceElement.type } : {}),
      ...(sourceElement.min !== undefined ? { min: sourceElement.min } : {}),
      ...(sourceElement.max !== undefined ? { max: sourceElement.max } : {}),
    };
    target.push(marker);
    seen.add(key);
  }

  return target;
}

export async function generateSnapshot(
  structureDefinition: StructureDefinition,
  options: SnapshotGenerationOptions,
): Promise<StructureDefinition> {
  const maxDepth = options.maxDepth ?? 32;
  const chain = await buildBaseChain(structureDefinition, options.resolver, maxDepth);
  const schemas = chain.map((sd) => translate(sd));
  const merged = mergeSchemas(schemas);
  const asStructureDefinition = toStructureDefinition(merged, {
    status: structureDefinition.status,
    emitChoiceVariants: 'strict',
  });
  const generatedElements =
    asStructureDefinition.differential?.element || [{ path: structureDefinition.type }];
  const snapshotElements = rehydrateChoiceSliceMarkers(structureDefinition, generatedElements);

  return {
    ...structureDefinition,
    snapshot: {
      element: snapshotElements,
    },
  };
}
