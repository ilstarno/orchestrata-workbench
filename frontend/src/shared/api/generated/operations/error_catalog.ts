// Generated from authoritative TypeScript declarations.
import type { components } from "../components";
export type error_catalog = {
    parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
    };
    requestBody?: never;
    responses: {
        /** @description Stable HTTP error codes and their descriptions */
        200: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["ErrorCatalogEntry"][];
            };
        };
    };
};
