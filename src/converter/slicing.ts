import { FHIRSchema, FHIRSchemaElement } from "./types";
import { zipper, ZipperOps } from "@thi.ng/zipper";

function merge(
  base: Partial<FHIRSchema>,
  derived: Partial<FHIRSchema>
): Partial<FHIRSchema> {
  const zOpts: ZipperOps<FhirSchemaNode> = {
    branch: (x) => Object.keys(x?.elements || {}).length > 0,
    children: (x) => Object.entries(x?.elements || {}).map(([_k, v]) => v),
    factory: (node, _children) => node,
  };

  // TODO: implement
  const zBase = zipper(zOpts, base);
  const zDerived = zipper(zOpts, derived);
  return base;
}

type FhirSchemaNode = Partial<FHIRSchema> | FHIRSchemaElement | undefined;

export { merge };
