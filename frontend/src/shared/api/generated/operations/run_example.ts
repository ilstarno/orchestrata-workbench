// Generated from authoritative TypeScript declarations.
import type { components } from "../components";
export type run_example = {
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
        /** @description Verified result; solution is null if proven infeasible */
        200: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["SolveResponse"];
            };
        };
        /** @description Unknown built-in recipe */
        404: {
            headers: {
                /** @description not_found */
                "X-Orchestrata-Error-Code"?: string;
                [name: string]: unknown;
            };
            content?: never;
        };
        /** @description The server could not solve the built-in example */
        500: {
            headers: {
                /** @description solve_execution_failed */
                "X-Orchestrata-Error-Code"?: components["schemas"]["SolveErrorCode"];
                [name: string]: unknown;
            };
            content?: never;
        };
        /** @description All solve execution slots are occupied; retry later */
        503: {
            headers: {
                /** @description solver_busy */
                "X-Orchestrata-Error-Code"?: components["schemas"]["SolveErrorCode"];
                [name: string]: unknown;
            };
            content?: never;
        };
    };
};
