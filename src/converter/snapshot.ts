import { mergeFHIRSchema } from './merge.js';
import { toStructureDefinition } from './to-structure-definition.js';
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
  // Opt-in field-faithful snapshot: carry inherited documentation/metadata through the
  // chain (via the `fhir` sidecar) and synthesize the structural snapshot fields
  // (id, base, isModifier:false). Off by default — the default snapshot stays lean.
  preserveSource?: boolean;
}

const SD_IMPLEMENTS_URL = 'http://hl7.org/fhir/StructureDefinition/structuredefinition-implements';

const TYPE_TO_SUFFIX: Record<string, string> = {
  base64Binary: 'Base64Binary',
  boolean: 'Boolean',
  canonical: 'Canonical',
  code: 'Code',
  date: 'Date',
  dateTime: 'DateTime',
  decimal: 'Decimal',
  id: 'Id',
  instant: 'Instant',
  integer: 'Integer',
  integer64: 'Integer64',
  markdown: 'Markdown',
  oid: 'Oid',
  positiveInt: 'PositiveInt',
  string: 'String',
  time: 'Time',
  unsignedInt: 'UnsignedInt',
  uri: 'Uri',
  url: 'Url',
  uuid: 'Uuid',
};

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

function getImplementedCanonicals(sd: StructureDefinition): string[] {
  const canonicalValues = (sd.extension || [])
    .filter((ext) => ext.url === SD_IMPLEMENTS_URL)
    .map((ext) => ext.valueCanonical || ext.valueUri)
    .filter((value): value is string => typeof value === 'string' && value.length > 0);

  return [...new Set(canonicalValues)];
}

function structureDefinitionKey(sd: StructureDefinition): string {
  return `${sd.url}|${sd.version || ''}`;
}

async function buildBaseDefinitionChain(
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

async function buildResolvedBaseChain(
  leaf: StructureDefinition,
  resolver: StructureDefinitionResolver,
  maxDepth: number,
): Promise<StructureDefinition[]> {
  const baseChain = await buildBaseDefinitionChain(leaf, resolver, maxDepth);
  const combined: StructureDefinition[] = [];
  const seen = new Set<string>();

  for (const sd of baseChain) {
    for (const canonical of getImplementedCanonicals(sd)) {
      const implemented = await resolveByCanonical(resolver, canonical);
      if (!implemented) {
        throw new Error(`Unable to resolve implemented profile: ${canonical}`);
      }

      const implementedChain = await buildBaseDefinitionChain(implemented, resolver, maxDepth);
      for (const chainItem of implementedChain) {
        const key = structureDefinitionKey(chainItem);
        if (seen.has(key)) continue;
        combined.push(chainItem);
        seen.add(key);
      }
    }

    const sdKey = structureDefinitionKey(sd);
    if (seen.has(sdKey)) continue;
    combined.push(sd);
    seen.add(sdKey);
  }

  return combined;
}

function foldSchemaChain(baseToLeafSchemas: FHIRSchema[]): FHIRSchema {
  if (baseToLeafSchemas.length === 0) {
    throw new Error('Cannot merge empty schema chain');
  }

  return baseToLeafSchemas.reduce(
    (acc, schema) => mergeFHIRSchema(acc, schema, { unionArrays: true }) as FHIRSchema,
  );
}

function elementKey(element: { path: string; sliceName?: string }): string {
  return `${element.path}|${element.sliceName || ''}`;
}

// Direct children of `parentPath` within an element list (one path segment deeper).
function directChildren(
  elements: StructureDefinitionElement[],
  parentPath: string,
): StructureDefinitionElement[] {
  const out: StructureDefinitionElement[] = [];
  for (const e of elements) {
    if (!e.path.startsWith(`${parentPath}.`)) continue;
    if (!e.path.slice(parentPath.length + 1).includes('.')) out.push(e);
  }
  return out;
}

function cloneInheritedElement(
  template: StructureDefinitionElement,
  targetPath: string,
): StructureDefinitionElement {
  const { path: _templatePath, id: _templateId, ...rest } = template;
  return {
    ...rest,
    path: targetPath,
  };
}

async function buildTypeElementTemplates(
  typeCode: string,
  resolver: StructureDefinitionResolver,
  maxDepth: number,
  cache: Map<string, StructureDefinitionElement[]>,
): Promise<StructureDefinitionElement[]> {
  const cached = cache.get(typeCode);
  if (cached) return cached;

  const typeCanonical = `http://hl7.org/fhir/StructureDefinition/${typeCode}`;
  const typeDefinition = await resolveByCanonical(resolver, typeCanonical);
  if (!typeDefinition) {
    cache.set(typeCode, []);
    return [];
  }

  const typeChain = await buildBaseDefinitionChain(typeDefinition, resolver, maxDepth);
  const templatesBySuffix = new Map<string, StructureDefinitionElement>();

  for (const definition of typeChain) {
    const rootPath = definition.type;
    for (const element of definition.differential?.element || []) {
      if (!element.path.startsWith(`${rootPath}.`)) continue;
      const suffix = element.path.slice(rootPath.length + 1);
      if (!suffix) continue;
      templatesBySuffix.set(suffix, element);
    }
  }

  const templates = [...templatesBySuffix.values()];
  cache.set(typeCode, templates);
  return templates;
}

async function expandInheritedTypeElements(
  generatedElements: StructureDefinitionElement[],
  resolver: StructureDefinitionResolver,
  maxDepth: number,
): Promise<StructureDefinitionElement[]> {
  const result = [...generatedElements];
  const indexByKey = new Map<string, number>();
  result.forEach((el, i) => {
    indexByKey.set(elementKey(el), i);
  });
  const templatesCache = new Map<string, StructureDefinitionElement[]>();
  const processedAnchors = new Set<string>();
  const processedCref = new Set<string>();

  // Self-contained expansion gate: expand a datatype element's children only when
  // the profile/base "reaches into" it — i.e. some merged element is a strict
  // descendant. Matches FHIR (an untouched inherited datatype element is NOT
  // expanded; touching any descendant materializes the type's full one-level child
  // set, which then recurses down the touched spine). Derived from the merged
  // element list, never from the input snapshot.
  const reachedParents = new Set<string>();
  for (const el of generatedElements) {
    const parts = el.path.split('.');
    for (let i = 1; i < parts.length; i += 1) {
      reachedParents.add(parts.slice(0, i).join('.'));
    }
  }

  for (let index = 0; index < result.length; index += 1) {
    const element = result[index];
    if (!element.path.includes('.')) continue;

    // contentReference: a recursive backbone (e.g. Parameters.parameter.part →
    // #Parameters.parameter) defines its children elsewhere. Surface the
    // referenced node's direct children under this element, one level — only when
    // the profile reaches into this cref node. `reachedParents` bounds the
    // recursion structurally: a nested cref (part.part) expands only if it too is
    // reached into, so there is no need for a source oracle or a depth cap.
    if (element.contentReference && !processedCref.has(element.path)) {
      processedCref.add(element.path);
      const refPath = element.contentReference.split('#')[1];
      if (refPath && reachedParents.has(element.path)) {
        for (const refChild of directChildren(result, refPath)) {
          // Recursion copies the referenced node's structure, not a profile's
          // reslices of it — skip slice rows (they'd produce phantom resliced
          // recursive children like part.part:MemberPatient).
          if (refChild.sliceName) continue;
          const suffix = refChild.path.slice(refPath.length + 1);
          const childPath = `${element.path}.${suffix}`;
          const child = cloneInheritedElement(refChild, childPath);
          const key = elementKey(child);
          if (indexByKey.has(key)) continue;
          indexByKey.set(key, result.length);
          result.push(child);
        }
      }
    }

    if (!element.type) continue;
    if (!reachedParents.has(element.path)) continue;
    // A still-ambiguous choice ([x] kept with >1 type) cannot be expanded — which
    // datatype's children would apply is undecided. A narrowed [x] (one type) and
    // any ordinary element expand normally.
    if (element.path.includes('[x]') && element.type.length > 1) continue;
    // Include the type signature in the anchor: a value[x] resliced per parent
    // slice yields several same-(path,sliceName) rows with different types
    // (e.g. one CodeableConcept, one canonical, one Quantity). Each must expand
    // its own datatype children; the child-level indexByKey dedups the results.
    const anchorKey = `${elementKey(element)}|${element.type.map((t) => t.code).join(',')}`;
    if (processedAnchors.has(anchorKey)) continue;
    processedAnchors.add(anchorKey);
    for (const typeRef of element.type) {
      const typeCode = typeRef.code;
      if (!typeCode) continue;

      const templates = await buildTypeElementTemplates(typeCode, resolver, maxDepth, templatesCache);
      for (const template of templates) {
        const templatePath = template.path;
        const splitIndex = templatePath.indexOf('.');
        if (splitIndex === -1) continue;
        const suffix = templatePath.slice(splitIndex + 1);
        if (!suffix) continue;

        const childPath = `${element.path}.${suffix}`;
        const child = cloneInheritedElement(template, childPath);
        const key = elementKey(child);
        const existingIndex = indexByKey.get(key);
        if (existingIndex !== undefined) {
          // Constrained child already present (e.g. mustSupport-only). Fill in the
          // datatype-derived type when the constraint did not restate it.
          const existing = result[existingIndex];
          if ((!existing.type || existing.type.length === 0) && child.type) {
            existing.type = child.type;
          }
          continue;
        }
        indexByKey.set(key, result.length);
        result.push(child);
      }
    }
  }

  return result;
}

function toChoiceSuffix(typeCode: string): string {
  return TYPE_TO_SUFFIX[typeCode] || `${typeCode[0].toUpperCase()}${typeCode.slice(1)}`;
}

function buildChoiceTypedPrefixMappings(
  generatedElements: StructureDefinitionElement[],
): Array<{ typedPrefix: string; choicePrefix: string; typeCode: string }> {
  const mappings: Array<{ typedPrefix: string; choicePrefix: string; typeCode: string }> = [];

  for (const element of generatedElements) {
    if (!element.path.includes('[x]') || !element.type) continue;
    const choicePrefix = element.path.replace('[x]', '');
    for (const typeRef of element.type) {
      const typeCode = typeRef.code;
      if (!typeCode) continue;
      mappings.push({
        typedPrefix: `${choicePrefix}${toChoiceSuffix(typeCode)}`,
        choicePrefix: element.path,
        typeCode,
      });
    }
  }

  return mappings;
}

// A typed choice-variant row may omit its type (the differential leaves it implied
// by the name, e.g. `component.valueQuantity` with no `type`). Infer the type from
// the variant name so datatype expansion can materialize the variant's children.
function fillChoiceVariantTypes(
  elements: StructureDefinitionElement[],
): StructureDefinitionElement[] {
  const byTypedPrefix = new Map(
    buildChoiceTypedPrefixMappings(elements).map((m) => [m.typedPrefix, m.typeCode]),
  );
  if (byTypedPrefix.size === 0) return elements;

  return elements.map((element) => {
    if (element.type && element.type.length > 0) return element;
    const typeCode = byTypedPrefix.get(element.path);
    return typeCode ? { ...element, type: [{ code: typeCode }] } : element;
  });
}

// FHIR snapshots represent a type-narrowed choice as a SLICE of the [x] element,
// with [x]-style children — not as typed-variant paths. A differential authored as
// `Observation.valueQuantity[.value]` becomes, in the snapshot:
//   Observation.value[x]                             (base, kept as-is)
//   Observation.value[x]  sliceName=valueQuantity    (the typed-variant slice)
//   Observation.value[x].value, .comparator, …       ([x]-style children)
// So map every typed-variant row back: the variant root becomes a `value[x]` slice
// row, its children become `value[x].*`. The mapping is derived from the `value[x]`
// base row the reverse converter keeps (all of its declared types), so no input
// snapshot is needed. Run this AFTER expansion: the typed variant is single-typed,
// so it expands cleanly first, then is renamed. Duplicate keys are merged by
// dedupeElements.
function normalizeChoicePathsToXStyle(
  elements: StructureDefinitionElement[],
): StructureDefinitionElement[] {
  const choiceMappings = buildChoiceTypedPrefixMappings(elements);
  if (choiceMappings.length === 0) return elements;
  // Paths that are themselves sliced (a slice row carries that path + a sliceName).
  // A choice narrowed INSIDE a sliced parent (component:systolic → component.valueQuantity)
  // does not get its own value[x] slice — its children just become value[x].* — whereas a
  // choice narrowed at an unsliced position (Observation.valueQuantity) becomes value[x]:valueQuantity.
  const slicedPaths = new Set(elements.filter((e) => e.sliceName).map((e) => e.path));

  return elements.map((element) => {
    for (const mapping of choiceMappings) {
      const isExact = element.path === mapping.typedPrefix;
      if (!isExact && !element.path.startsWith(`${mapping.typedPrefix}.`)) continue;

      if (isExact) {
        const parentPath = mapping.choicePrefix.slice(0, mapping.choicePrefix.lastIndexOf('.'));
        if (slicedPaths.has(parentPath)) {
          return { ...element, path: mapping.choicePrefix };
        }
        const sliceName = mapping.typedPrefix.slice(mapping.typedPrefix.lastIndexOf('.') + 1);
        return { ...element, path: mapping.choicePrefix, sliceName };
      }
      return {
        ...element,
        path: `${mapping.choicePrefix}${element.path.slice(mapping.typedPrefix.length)}`,
      };
    }
    return element;
  });
}

// Choice slices (value[x]:valueString …) are author-declared in a differential —
// the leaf's or an ancestor's in the resolved chain — never invented by
// snapshotting. The translate→merge→reverse round-trip can drop the marker row, so
// re-add it from the chain differentials (self-contained; CLAUDE.md: differential is
// the source of truth).
function rehydrateChoiceSliceMarkers(
  chainDifferentialElements: StructureDefinitionElement[],
  generatedElements: StructureDefinitionElement[],
): StructureDefinitionElement[] {
  const target = [...generatedElements];
  const seen = new Set(target.map((el) => elementKey(el)));
  const choiceMappings = buildChoiceTypedPrefixMappings(generatedElements);
  const slicedPaths = new Set(generatedElements.filter((e) => e.sliceName).map((e) => e.path));

  const addMarker = (
    path: string,
    sliceName: string,
    src: StructureDefinitionElement,
  ): void => {
    const key = `${path}|${sliceName}`;
    if (seen.has(key)) return;
    target.push({
      path,
      sliceName,
      ...(src.type ? { type: src.type } : {}),
      ...(src.min !== undefined ? { min: src.min } : {}),
      ...(src.max !== undefined ? { max: src.max } : {}),
    });
    seen.add(key);
  };

  for (const src of chainDifferentialElements) {
    // Already [x]-style slice rows declared in a differential.
    if (src.path.includes('[x]') && src.sliceName) {
      addMarker(src.path, src.sliceName, src);
      continue;
    }
    // A typed choice-variant base row (Observation.valueCodeableConcept) declares a
    // value[x]:variant slice. A childless variant is dropped by the reverse converter,
    // so re-add the marker here. Suppress when narrowed inside a sliced parent (the
    // per-slice narrowing does not get its own value[x] slice — see
    // normalizeChoicePathsToXStyle).
    const mapping = choiceMappings.find((m) => m.typedPrefix === src.path);
    if (mapping) {
      const parentPath = mapping.choicePrefix.slice(0, mapping.choicePrefix.lastIndexOf('.'));
      if (slicedPaths.has(parentPath)) continue;
      const sliceName = mapping.typedPrefix.slice(mapping.typedPrefix.lastIndexOf('.') + 1);
      addMarker(mapping.choicePrefix, sliceName, src);
    }
  }

  return target;
}

// A FHIR snapshot must not contain two elements with the same (path, sliceName).
// Choice narrowing can yield both the `value[x]` base row and a rewritten variant
// row at the same key; collapse them, keeping the first (richer) row and filling
// any fields it is missing from later duplicates.
function dedupeElements(elements: StructureDefinitionElement[]): StructureDefinitionElement[] {
  const byKey = new Map<string, StructureDefinitionElement>();
  const order: string[] = [];

  for (const element of elements) {
    const key = elementKey(element);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, element);
      order.push(key);
      continue;
    }
    for (const [field, value] of Object.entries(element)) {
      if (value !== undefined && (existing as Record<string, unknown>)[field] === undefined) {
        (existing as Record<string, unknown>)[field] = value;
      }
    }
  }

  return order.map((key) => byKey.get(key) as StructureDefinitionElement);
}

export async function generateSnapshot(
  structureDefinition: StructureDefinition,
  options: SnapshotGenerationOptions,
): Promise<StructureDefinition> {
  const maxDepth = options.maxDepth ?? 32;
  const chain = await buildResolvedBaseChain(structureDefinition, options.resolver, maxDepth);
  const schemas = chain.map((sd) =>
    translate(sd, { explicitMaxCardinality: true, preserveSource: options.preserveSource }),
  );
  const merged = foldSchemaChain(schemas);
  const asStructureDefinition = toStructureDefinition(merged, {
    status: structureDefinition.status,
    emitChoiceVariants: 'strict',
  });
  const generatedElements =
    asStructureDefinition.differential?.element || [{ path: structureDefinition.type }];
  // Expand FIRST (a typed choice variant like `valueQuantity` is single-typed, so it
  // expands its datatype children cleanly), THEN normalize the typed-variant rows to
  // [x]-style slices. Doing it in this order keeps the multi-typed `value[x]` base
  // unexpanded while the chosen variant's children are materialized.
  const typedElements = fillChoiceVariantTypes(generatedElements);
  const expandedElements = await expandInheritedTypeElements(
    typedElements,
    options.resolver,
    maxDepth,
  );
  const styledElements = normalizeChoicePathsToXStyle(expandedElements);
  const chainDifferentialElements = chain.flatMap((sd) => sd.differential?.element || []);
  const snapshotElements = rehydrateChoiceSliceMarkers(chainDifferentialElements, styledElements);
  const finalElements = dedupeElements(snapshotElements);

  if (options.preserveSource) {
    synthesizeSnapshotFields(finalElements);
  }

  return {
    ...structureDefinition,
    snapshot: {
      element: finalElements,
    },
  };
}

// Field-faithful snapshot metadata that FHIR's generator fills from the base
// definitions (not present in any differential): a path-based `id` on every row, and
// `isModifier: false` on every non-root element that did not declare it. (`base` —
// the originating type's path + cardinality — needs originating-definition tracking and
// is handled separately.)
function synthesizeSnapshotFields(elements: StructureDefinitionElement[]): void {
  for (const el of elements) {
    const e = el as Record<string, unknown>;
    if (e.id === undefined) {
      e.id = el.sliceName ? `${el.path}:${el.sliceName}` : el.path;
    }
    if (el.path.includes('.') && e.isModifier === undefined) {
      e.isModifier = false;
    }
  }
}
