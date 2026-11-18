// Generated from authoritative TypeScript declarations.
import type { components } from "../components";
export type list = {
    parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
    };
    requestBody?: never;
    responses: {
        /** @description Included recipe catalog */
        200: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["RecipeMetadataResponse"][];
            };
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
