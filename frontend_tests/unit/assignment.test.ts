import { describe, expect, it } from "vitest";
import {
  assignmentExample,
  changeEligibility,
  exampleDefinition,
  exampleEligibility,
  serializeEligibility,
} from "../../frontend/src/shared/examples/assignment";

describe("assignment example", () => {
  it("has distinct variable names", () => {
    const names = assignmentExample.variables.map((variable) => variable.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("only references existing variables", () => {
    const rule = assignmentExample.constraints.find(
      (constraint) => constraint.kind === "all_different",
    );
    expect(rule).toBeDefined();
    if (!rule?.variables) throw new Error("missing constraint variables");
    for (const index of rule.variables) {
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(assignmentExample.variables.length);
    }
  });
});

describe("guided technician eligibility", () => {
  it("keeps the original setup unchanged until a selection is edited", () => {
    expect(serializeEligibility(exampleEligibility)).toBe(exampleDefinition);
  });

  it("changes only the requested job and preserves stable option order", () => {
    const eligible = changeEligibility(exampleEligibility, 0, 2, true);
    const withoutAlex = changeEligibility(eligible, 0, 8, false);
    const restoredAlex = changeEligibility(withoutAlex, 0, 8, true);
    expect(exampleEligibility[0]).toEqual([8, 3]);
    expect(restoredAlex).toEqual([
      [8, 3, 2],
      [8, 2],
      [3, 2],
    ]);
    expect(changeEligibility(restoredAlex, 0, 2, true)).toEqual(restoredAlex);
  });

  it("retains overlap and preference constraints when serializing eligibility", () => {
    const edited = changeEligibility(exampleEligibility, 0, 8, false);
    const definition = JSON.parse(serializeEligibility(edited));
    expect(definition.variables[0]).toEqual({
      name: "lift_repair",
      domain: [3],
    });
    expect(definition.constraints).toEqual(assignmentExample.constraints);
  });

  it("serializes an empty selection so the server can validate it", () => {
    const withoutAlex = changeEligibility(exampleEligibility, 0, 8, false);
    const uncovered = changeEligibility(withoutAlex, 0, 3, false);
    expect(
      JSON.parse(serializeEligibility(uncovered)).variables[0].domain,
    ).toEqual([]);
  });
});
