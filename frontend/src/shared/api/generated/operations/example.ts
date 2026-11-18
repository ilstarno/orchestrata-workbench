// Generated from authoritative TypeScript declarations.
import type { components } from "../components";
export type example = {
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
        /** @description Checked-in synthetic solver problem */
        200: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["Problem"];
            };
        };
        /** @description Unknown built-in recipe */
        404: {
            headers: {
                [name: string]: unknown;
            };
            content?: never;
        };
    };
};
