// Generated from authoritative TypeScript declarations.
import type { operations } from "../operations";
export type RunExamplePath = {
    parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
    };
    get?: never;
    put?: never;
    /** @description Solve the checked-in synthetic example for this recipe. No request body or external effects; recipes with variants use the default example. */
    post: operations["run_example"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
};
