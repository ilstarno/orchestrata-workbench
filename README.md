# Orchestrata Workbench

Prepare planning inputs from spreadsheets or normalized record exports, review data, and keep plans in context.

The workbench maps spreadsheet columns to jobs and people, highlights values that need attention, and submits a confirmed planning model to a compatible Orchestrata API. Results identify the assigned person and source rows. A failed rerun keeps the last successful plan and its CSV available.

## Run locally

Requirements:

- Node.js 22 and npm.
- A modern browser supporting WebAssembly, module workers and Web Crypto on localhost or a secure origin. The bundled maintenance workflow runs locally without an API.
- A separately running compatible API at `http://127.0.0.1:3000` for skill-based assignment and the recipe catalog.
- The API must implement `POST /api/v1/solve` using the `Problem` and `SolveResponse` contracts in `frontend/src/shared/api/generated/orchestrata.ts`. The recipe catalog additionally requires the recipe endpoints declared there.

From the repository root:

```sh
cd frontend
npm ci
npm run dev
```

Open the local address printed by Vite. Development requests under `/api` are forwarded to `http://127.0.0.1:3000`. Reading and previewing files works locally. Maintenance plans run in a local worker; skill-based assignment requires the API. This repository does not provide sign-in infrastructure or a hosted service. Authentication and authorization must be enforced by the serving application and API.

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

## Run a local maintenance plan

Choose **Maintenance package inputs** to prepare data for the published [`maintenance-shift` 1.0.0 package](https://github.com/ilstarno/orchestrata-recipes/tree/10ac8261727e3b024e277fbc0a5240815d6e40d2/packages/maintenance-shift). Select the `cost` or `delay` entrypoint, then open an Excel workbook, three CSV tables, or a local normalized-record JSON export. JSON editing is not required. Direct named records and the `tables → table name → records` export envelope are accepted; no hosted connector is supplied.

| Table | Fields |
| --- | --- |
| `work_orders` | `id` |
| `technicians` | `id`, `capacity_slots`, `available` |
| `eligibility` | `work_order_id`, `technician_id`, `cost_cents`, `delay_minutes` |

Review mappings and source values, correct flagged fields, confirm, then choose **Run locally**. Review assignments and unassigned orders, then choose **Export plan CSV**. Prepared input can also be exported. Stable identifiers are preserved, never generated from row positions. The runtime accepts 1–64 ASCII letters, digits, hyphens or underscores for IDs, boolean availability, and integer values from 0 to 1,000,000. Limits are 32 orders, 32 technicians and 128 total records. The package caps each technician at three orders and permits only explicit eligibility edges. Cost and delay both maximize coverage first; delay is a sum of estimates, not elapsed shift time.

The bundled free package executes with the pinned Engine mathematical v1 WebAssembly runtime in a dedicated worker. Input files stay on this device. Each run has a 10-second deadline and can be cancelled. Changing the reviewed input or objective cancels an active run. A failed rerun retains the last successful result and its export, labelled as a previous plan. Unassigned orders are shown without inventing a reason the runtime does not provide.

Only the bundled `maintenance-shift` package is supported locally; there is no arbitrary package upload or paid-package activation. Package and runtime bytes are checked before execution, and results are checked against the selected objective, exact input identity and package revisions. The worker has a 64 MiB memory ceiling. A browser that cannot load the worker or runtime reports failure; it does not fall back to a remote service.

The skill-based assignment workflow still uses the typed solve API described above. Neither workflow connects to Salesforce or another external data source. Local plans do not validate hosted authentication or authorization. Inputs and results remain in the current tab and are lost on reload.

## Check and build

From `frontend/`:

```sh
npm test
npm run build
npm audit --omit=dev
```

Tests include TypeScript checks, locale validation, unit tests and DOM integration tests. The build checks locales and application types, then writes production assets to `frontend/dist/`. The optional live-API tests are skipped unless a local service is supplied:

```sh
ORCHESTRATA_TEST_API=http://127.0.0.1:3000 npm test
```

Those tests accept a loopback URL and exercise synthetic Excel/CSV uploads and normalized skill-assignment input against the solve service. Maintenance tests exercise all three source channels with the real Engine, changed user identifiers, both objectives, result validation, retained results and cancellation. They do not validate hosted authorization. DOM tests do not verify rendered mobile layouts or end-to-end sign-in.

To serve the production build, configure a same-origin `/api` proxy to the compatible backend and SPA route fallback to `index.html`. The local maintenance workflow needs no API; the other workflows require their compatible backend. Development servers are intended for local development.

## License

See [LICENSE](LICENSE) for the source license and [third-party notices](frontend/THIRD_PARTY_NOTICES.txt) for spreadsheet-reader attribution.

The bundled runtime and maintenance package are Apache-2.0. Their attribution and dependency licenses are retained under `frontend/public/licenses/maintenance-engine/`.
