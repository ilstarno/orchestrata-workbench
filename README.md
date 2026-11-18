# Orchestrata Workbench

Plan job assignments from Excel or CSV, review results, and export the plan.

The workbench maps spreadsheet columns to jobs and people, highlights values that need attention, and submits a confirmed planning model to a compatible Orchestrata API. Results identify the assigned person and source rows. A failed rerun keeps the last successful plan and its CSV available.

## Run locally

Requirements:

- Node.js 22 and npm.
- A separately running compatible API at `http://127.0.0.1:3000`. The frontend does not include a backend or solver.
- The API must implement `POST /api/v1/solve` using the `Problem` and `SolveResponse` contracts in `frontend/src/shared/api/generated/orchestrata.ts`. The recipe catalog additionally requires the recipe endpoints declared there.

From the repository root:

```sh
cd frontend
npm ci
npm run dev
```

Open the local address printed by Vite. Development requests under `/api` are forwarded to `http://127.0.0.1:3000`. Reading and previewing a spreadsheet works locally; running a plan requires the API. This repository does not provide sign-in infrastructure or a hosted service. Authentication and authorization must be enforced by the serving application and API.

## Plan from a spreadsheet

1. Open one `.xlsx` workbook with separate jobs and people sheets, or choose a jobs CSV and a people CSV.
2. Review the suggested columns and their source values. Select the heading row if the export starts with a title. Duplicate or ambiguous headings require a choice.
3. Correct the flagged cells, then confirm the columns, heading rows and values.
4. Run the plan, review assignments and unassigned jobs, and download the CSV.

| Input | Fields |
| --- | --- |
| Jobs | Name, Required skill |
| People | Name, Skills, Available, Job limit |

Skills are comma-separated. Availability must be explicit: Yes/No, True/False, 1/0, Oui/Non or Po/Jo. Job limits are whole numbers from 0 to 200. Available capacity and matching skills determine eligibility; the submitted model maximizes covered jobs. Larger models can exceed the API's search limit, independently of the file's size.

Use values rather than formulas. Limits are 2 MB per file, 8 MB expanded workbook content, 8 sheets, 204 source rows and 80 columns per sheet, and 200 jobs and people combined. Macros and external workbook links are rejected.

Files are read in the current tab. Running sends a compiled constraint model to the API; spreadsheet names and labels remain in the tab. Saving column choices is optional and stores headers only. Inputs and results survive in-app navigation in the current tab, but not reloads. Place real imported files in `local-data/` or `frontend/local-data/`, which are ignored by Git. Synthetic test fixtures remain versioned.

The interface supports six languages and light and dark themes. Interface language does not translate service-provided recipe text or results.

## Check and build

From `frontend/`:

```sh
npm test
npm run build
npm audit --omit=dev
```

Tests include TypeScript checks, locale validation, unit tests and DOM integration tests. The build checks locales and application types, then writes production assets to `frontend/dist/`. The optional live-API test is skipped unless a local service is supplied:

```sh
ORCHESTRATA_TEST_API=http://127.0.0.1:3000 npm test
```

That test accepts a loopback URL and exercises synthetic Excel and CSV uploads against the service. DOM tests do not verify rendered mobile layouts or end-to-end sign-in.

To serve the production build, configure a same-origin `/api` proxy to the compatible backend and SPA route fallback to `index.html`. Static assets alone cannot calculate a plan. Development servers are intended for local development.

## License

See [LICENSE](LICENSE) for the source license and [third-party notices](frontend/THIRD_PARTY_NOTICES.txt) for spreadsheet-reader attribution.
