// Generated from authoritative TypeScript declarations.
import type { components } from "../components";
export type metadata = {
    parameters: {
        query?: never;
        header?: never;
        path: {
            /** @description Built-in recipe identifier */
            recipe_id: string;
        };
        cookie?: never;
    };
    requestBody?: never;
    responses: {
        /** @description Recipe input and output metadata */
        200: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["RecipeMetadataResponse"];
            };
        };
        /** @description Unknown built-in recipe */
        404: {
            headers: {
                [name: string]: unknown;
            };
            content?: never;
        };
        /** @description Built-in recipe metadata is unavailable */
        500: {
            headers: {
                [name: string]: unknown;
            };
            content?: never;
        };
    };
};
