// Generated from authoritative TypeScript declarations.
import type { operations } from "../operations";
export type GridPath = {
    parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
    };
    /** @description Browse metadata for the included synthetic recipe catalog. Filtering, sorting and paging are performed on the server; no user records or uploaded data are used. */
    get: operations["grid"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
};
