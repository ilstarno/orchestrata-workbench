// Generated from authoritative TypeScript declarations.
import type { ErrorCatalogPath } from "./paths/ErrorCatalogPath";
import type { ExamplePath } from "./paths/ExamplePath";
import type { GridPath } from "./paths/GridPath";
import type { HealthPath } from "./paths/HealthPath";
import type { ListPath } from "./paths/ListPath";
import type { MetadataPath } from "./paths/MetadataPath";
import type { RunExamplePath } from "./paths/RunExamplePath";
import type { SolveProblemPath } from "./paths/SolveProblemPath";
export interface paths {
"/api/v1/error-codes": ErrorCatalogPath;
"/api/v1/health": HealthPath;
"/api/v1/recipes": ListPath;
"/api/v1/recipes/grid": GridPath;
"/api/v1/recipes/{recipe_id}": MetadataPath;
"/api/v1/recipes/{recipe_id}/example": ExamplePath;
"/api/v1/recipes/{recipe_id}/run-example": RunExamplePath;
"/api/v1/solve": SolveProblemPath;
}
