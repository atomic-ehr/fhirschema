import { describe, test, expect } from "bun:test";
import * as sut from "../../src/converter/slicing";
import slicingObsComponent from "../data/slicing-obs-component.json";
import { FHIRSchema } from "../../src/converter/types";

describe("Slicing", () => {
  test("Observation.component at us-core vital-signs", () => {
    const result = sut.merge(
      slicingObsComponent.base,
      slicingObsComponent.derived
    );

    expect(result).toBe({} as FHIRSchema);
  });
});
