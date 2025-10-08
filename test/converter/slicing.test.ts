import { describe, test, expect } from "bun:test";
import * as sut from "../../src/converter/slicing";
import slicingObsComponent from "../data/slicing-obs-component.json";
import { FHIRSchema } from "../../src/converter/types";

describe("Slicing merge", () => {
  describe("Observation.component at us-core vital-signs", () => {
    test("Can merge slicing data into base definition", () => {
      const result = sut.merge(
        slicingObsComponent.base,
        slicingObsComponent.overlay
      );

      expect(result).toEqual(slicingObsComponent.result);
    });
  });
});
