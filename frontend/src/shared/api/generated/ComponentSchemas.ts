// Generated from authoritative TypeScript declarations.
import type { Constraint } from "./schemas/Constraint";
import type { ErrorCatalogEntry } from "./schemas/ErrorCatalogEntry";
import type { HealthResponse } from "./schemas/HealthResponse";
import type { Problem } from "./schemas/Problem";
import type { RecipeFieldKind } from "./schemas/RecipeFieldKind";
import type { RecipeFieldResponse } from "./schemas/RecipeFieldResponse";
import type { RecipeGridColumn } from "./schemas/RecipeGridColumn";
import type { RecipeGridColumnId } from "./schemas/RecipeGridColumnId";
import type { RecipeGridDirection } from "./schemas/RecipeGridDirection";
import type { RecipeGridResponse } from "./schemas/RecipeGridResponse";
import type { RecipeGridRow } from "./schemas/RecipeGridRow";
import type { RecipeGridSort } from "./schemas/RecipeGridSort";
import type { RecipeMetadataResponse } from "./schemas/RecipeMetadataResponse";
import type { Score } from "./schemas/Score";
import type { Solution } from "./schemas/Solution";
import type { SolveErrorCode } from "./schemas/SolveErrorCode";
import type { SolveResponse } from "./schemas/SolveResponse";
import type { Variable } from "./schemas/Variable";
export interface ComponentSchemas {
Constraint: Constraint;
ErrorCatalogEntry: ErrorCatalogEntry;
HealthResponse: HealthResponse;
Problem: Problem;
/** @enum {string} */
RecipeFieldKind: RecipeFieldKind;
RecipeFieldResponse: RecipeFieldResponse;
RecipeGridColumn: RecipeGridColumn;
/** @enum {string} */
RecipeGridColumnId: RecipeGridColumnId;
/** @enum {string} */
RecipeGridDirection: RecipeGridDirection;
RecipeGridResponse: RecipeGridResponse;
RecipeGridRow: RecipeGridRow;
/** @enum {string} */
RecipeGridSort: RecipeGridSort;
RecipeMetadataResponse: RecipeMetadataResponse;
Score: Score;
Solution: Solution;
/** @enum {string} */
SolveErrorCode: SolveErrorCode;
SolveResponse: SolveResponse;
Variable: Variable;
}
