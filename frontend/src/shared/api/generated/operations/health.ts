// Generated from authoritative TypeScript declarations.
import type { components } from "../components";
export type health = {
    parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
    };
    requestBody?: never;
    responses: {
        200: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["HealthResponse"];
            };
        };
    };
};
