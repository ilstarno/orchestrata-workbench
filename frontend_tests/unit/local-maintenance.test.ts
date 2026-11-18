import { readFileSync } from "node:fs";
import { webcrypto } from "node:crypto";
import { resolve } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { createEngine } from "../../frontend/src/features/maintenance/local/engine";
import { executeLocal } from "../../frontend/src/features/maintenance/local/execute-local";
import { runLocal } from "../../frontend/src/features/maintenance/local/run-local";
import { decodePlan } from "../../frontend/src/features/maintenance/local/decode-plan";
import type { LocalRequest } from "../../frontend/src/features/maintenance/local/local-request";
import type { WorkerPort } from "../../frontend/src/features/maintenance/local/worker-port";
const wasm = () =>
  new Uint8Array(
    readFileSync(
      resolve("src/features/maintenance/local/assets/package-runtime.wasm"),
    ),
  );
const archive = () =>
  new Uint8Array(
    readFileSync(
      resolve("src/features/maintenance/local/assets/maintenance-shift.orcpkg"),
    ),
  );
const request = (): LocalRequest => ({
  objective: "cost",
  source: "own.csv",
  records: {
    work_orders: [{ id: "mine" }, { id: "uncovered" }],
    technicians: [{ id: "tech", capacity_slots: 1, available: true }],
    eligibility: [
      {
        work_order_id: "mine",
        technician_id: "tech",
        cost_cents: 23,
        delay_minutes: 7,
      },
    ],
  },
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it("executes dynamic data, rejects altered assets and forged identities, assignments and scores", async () => {
  vi.stubGlobal("crypto", webcrypto);
  const solve = await createEngine(wasm(), archive()),
    input = request();
  const plan = await executeLocal(input, solve);
  expect(plan.assigned).toBe(1);
  expect(plan.minimized_edge_sum).toBe(23);
  expect(plan.assignments).toContainEqual({
    item_id: "uncovered",
    resource_id: null,
  });
  input.objective = "delay";
  expect((await executeLocal(input, solve)).minimized_edge_sum).toBe(7);
  input.records.technicians[0].available = false;
  expect((await executeLocal(input, solve)).assigned).toBe(0);
  const broken = wasm();
  broken[100] ^= 1;
  await expect(createEngine(broken, archive())).rejects.toThrow("asset");
  const changed = archive();
  changed[100] ^= 1;
  await expect(createEngine(wasm(), changed)).rejects.toThrow("asset");
  const raw = JSON.parse(solve(JSON.stringify(request().records), "cost"));
  for (const forged of [
    { ...raw, content_identity: "wrong" },
    { ...raw, execution_identity: "wrong" },
    { ...raw, solution: { ...raw.solution, assigned: 99 } },
    {
      ...raw,
      solution: {
        ...raw.solution,
        assignments: [
          { item_id: "mine", resource_id: "invented" },
          { item_id: "uncovered", resource_id: null },
        ],
      },
    },
  ])
    expect(() => decodePlan(JSON.stringify(forged), request(), "a")).toThrow(
      "result",
    );
  const invalid = request();
  invalid.records.eligibility.push({ ...invalid.records.eligibility[0] });
  await expect(executeLocal(invalid, solve)).rejects.toThrow("input");
});
it("enforces the host deadline, cancellation and late-message isolation", async () => {
  vi.useFakeTimers();
  const worker: WorkerPort = {
    onmessage: null,
    onerror: null,
    onmessageerror: null,
    postMessage: vi.fn(),
    terminate: vi.fn(),
  };
  const controller = new AbortController();
  const result = runLocal(request(), controller.signal, () => worker);
  const rejected = expect(result).rejects.toThrow("timeout");
  await vi.advanceTimersByTimeAsync(10000);
  await rejected;
  expect(worker.terminate).toHaveBeenCalledOnce();
  worker.onmessage?.({ data: { plan: {} } } as MessageEvent);
  const next = new AbortController(),
    cancelled = runLocal(request(), next.signal, () => worker);
  const cancelledCheck = expect(cancelled).rejects.toThrow("cancelled");
  next.abort();
  await cancelledCheck;
  expect(worker.terminate).toHaveBeenCalledTimes(2);
});
it("rejects invalid input before creating a worker and fails closed on worker load failure", async () => {
  const invalid = request();
  invalid.records.technicians[0].capacity_slots = "bad";
  const create = vi.fn();
  await expect(
    runLocal(invalid, new AbortController().signal, create),
  ).rejects.toThrow("input");
  expect(create).not.toHaveBeenCalled();
  await expect(
    runLocal(request(), new AbortController().signal, () => {
      throw Error("blocked");
    }),
  ).rejects.toThrow("failed");
});
it("rejects 129 records and preserves spreadsheet-safe identifiers in CSV output", async () => {
  vi.stubGlobal("crypto", webcrypto);
  const solve = await createEngine(wasm(), archive()),
    input = request();
  input.records.work_orders[0].id = "-own";
  input.records.eligibility[0].work_order_id = "-own";
  const plan = await executeLocal(input, solve);
  expect(plan.csv).toContain('"\'-own"');
  const oversized = request();
  oversized.records.work_orders = Array.from({ length: 129 }, (_, i) => ({
    id: "job" + i,
  }));
  await expect(executeLocal(oversized, solve)).rejects.toThrow("input");
});
