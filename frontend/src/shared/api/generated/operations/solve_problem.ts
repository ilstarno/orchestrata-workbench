// Generated from authoritative TypeScript declarations.
import type { components } from "../components";
export type solve_problem = {
    parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
    };
    requestBody: {
        content: {
            "application/json": components["schemas"]["Problem"];
        };
    };
    responses: {
        /** @description Optimal solution; solution field is null if proven infeasible */
        200: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["SolveResponse"];
            };
        };
        /** @description Malformed or unreadable request body */
        400: {
            headers: {
                /** @description invalid_request_body */
                "X-Orchestrata-Error-Code"?: components["schemas"]["SolveErrorCode"];
                [name: string]: unknown;
            };
            content?: never;
        };
        /** @description Request body exceeds the accepted size */
        413: {
            headers: {
                /** @description invalid_request_body */
                "X-Orchestrata-Error-Code"?: components["schemas"]["SolveErrorCode"];
                [name: string]: unknown;
            };
            content?: never;
        };
        /** @description Expected a JSON content type */
        415: {
            headers: {
                /** @description invalid_request_body */
                "X-Orchestrata-Error-Code"?: components["schemas"]["SolveErrorCode"];
                [name: string]: unknown;
            };
            content?: never;
        };
        /** @description Invalid JSON shape, invalid problem, or search space too large */
        422: {
            headers: {
                /** @description invalid_request_body, invalid_problem, or search_limit_exceeded */
                "X-Orchestrata-Error-Code"?: components["schemas"]["SolveErrorCode"];
                [name: string]: unknown;
            };
            content?: never;
        };
        /** @description Solver execution failed */
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
