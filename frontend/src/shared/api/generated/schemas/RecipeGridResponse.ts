// Generated from authoritative TypeScript declarations.
import type { components } from "../components";
export type RecipeGridResponse = {
    columns: components["schemas"]["RecipeGridColumn"][];
    items: components["schemas"]["RecipeGridRow"][];
    /** Format: int32 */
    page: number;
    /** Format: int32 */
    page_size: number;
    total_items: number;
};
