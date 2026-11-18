// Generated from authoritative TypeScript declarations.
import type { components } from "../components";
export type grid = {
    parameters: {
        query?: {
            /** @description One-based page index. Defaults to 1. Pages after the last item are empty. */
            page?: number;
            /** @description Maximum rows returned. Defaults to 25. */
            page_size?: number;
            /** @description Allowlisted sort field. Defaults to id. */
            sort?: components["schemas"]["RecipeGridSort"];
            /** @description Defaults to asc. Rows with equal titles always use ascending ID order. */
            direction?: components["schemas"]["RecipeGridDirection"];
            /** @description Literal, case-insensitive substring of ID, title or scenario. At most 100 UTF-8 bytes. */
            q?: string;
        };
        header?: never;
        path?: never;
        cookie?: never;
    };
    requestBody?: never;
    responses: {
        /** @description Recipe metadata columns and requested page */
        200: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["RecipeGridResponse"];
            };
        };
        /** @description Unknown, duplicate, malformed or out-of-bounds query parameter */
        400: {
            headers: {
                /** @description request_rejected */
                "X-Orchestrata-Error-Code"?: string;
                [name: string]: unknown;
            };
            content: {
                "text/plain": string;
            };
        };
        /** @description Built-in recipe metadata is unavailable */
        500: {
            headers: {
                /** @description internal_error */
                "X-Orchestrata-Error-Code"?: string;
                [name: string]: unknown;
            };
            content: {
                "text/plain": string;
            };
        };
    };
};
