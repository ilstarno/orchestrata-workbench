import type {
  components,
  operations,
  paths,
} from "../../frontend/src/shared/api/generated/orchestrata";
import {
  recipeFieldKindValues,
  solveErrorCodeValues,
} from "../../frontend/src/shared/api/generated/orchestrata";
import type { Problem } from "../../frontend/src/shared/api/generated/schemas/Problem";
import type { Solution } from "../../frontend/src/shared/api/generated/schemas/Solution";

type Assert<T extends true> = T;
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
export type ProblemCompatibility = Assert<
  Same<Problem, components["schemas"]["Problem"]>
>;
export type SolutionCompatibility = Assert<
  Same<Solution, components["schemas"]["Solution"]>
>;
export type SolveRouteCompatibility = Assert<
  Same<paths["/api/v1/solve"]["post"], operations["solve_problem"]>
>;
export type RequestCompatibility = Assert<
  Same<
    operations["solve_problem"]["requestBody"]["content"]["application/json"],
    Problem
  >
>;
export type ResponseCompatibility = Assert<
  Same<
    operations["solve_problem"]["responses"][200]["content"]["application/json"],
    components["schemas"]["SolveResponse"]
  >
>;
export type EnumCompatibility = Assert<
  Same<
    (typeof recipeFieldKindValues)[number],
    components["schemas"]["RecipeFieldKind"]
  >
>;
export type ErrorEnumCompatibility = Assert<
  Same<
    (typeof solveErrorCodeValues)[number],
    components["schemas"]["SolveErrorCode"]
  >
>;

const problem: Problem = {
  variables: [{ name: "one", domain: [1] }],
  constraints: [
    { kind: "prefer_value", variable: 0, value: 1, soft_weight: 1 },
  ],
};
const response: components["schemas"]["SolveResponse"] = { solution: null };
void problem;
void response;
// @ts-expect-error The generated discriminant excludes unknown constraint kinds.
const invalidConstraint: components["schemas"]["Constraint"]["kind"] =
  "unknown";
// @ts-expect-error Variables require a numeric domain.
const invalidDomain: components["schemas"]["Variable"]["domain"] = ["1"];
// @ts-expect-error Enum collections remain readonly.
recipeFieldKindValues.push("string");
// @ts-expect-error The path contract does not introduce a package-run endpoint.
type UnknownRoute = paths["/api/v1/packages/run"];
void invalidConstraint;
void invalidDomain;
