// Generated from authoritative TypeScript declarations.
import type { components } from "../components";
export type RecipeMetadataResponse = {
    id: string;
    inputs: components["schemas"]["RecipeFieldResponse"][];
    outputs: components["schemas"]["RecipeFieldResponse"][];
    scenario: string;
    title: string;
};
