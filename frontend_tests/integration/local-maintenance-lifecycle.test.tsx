// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { LocalRunPanel } from "../../frontend/src/features/maintenance/local/local-run-panel";
import { runLocal } from "../../frontend/src/features/maintenance/local/run-local";
import type { LocalPlan } from "../../frontend/src/features/maintenance/local/local-plan";
vi.mock("../../frontend/src/features/maintenance/local/run-local", () => ({
  runLocal: vi.fn(),
}));
it("aborts on objective change and unmount, and discards stale responses", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const records = {
    work_orders: [{ id: "own" }],
    technicians: [],
    eligibility: [],
  };
  let complete: (plan: LocalPlan) => void = () => {};
  vi.mocked(runLocal).mockImplementation(
    () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  );
  try {
    await act(async () =>
      root.render(
        <LocalRunPanel
          records={records}
          source="own.csv"
          confirmed
          objective="cost"
        />,
      ),
    );
    await act(async () => host.querySelector("button")!.click());
    const first = vi.mocked(runLocal).mock.calls.at(-1)![1];
    await act(async () =>
      root.render(
        <LocalRunPanel
          records={records}
          source="own.csv"
          confirmed
          objective="delay"
        />,
      ),
    );
    expect(first.aborted).toBe(true);
    await act(async () => complete({ source: "stale.csv" } as LocalPlan));
    expect(host.textContent).not.toContain("stale.csv");
    await act(async () => host.querySelector("button")!.click());
    const second = vi.mocked(runLocal).mock.calls.at(-1)![1];
    await act(async () => root.unmount());
    expect(second.aborted).toBe(true);
  } finally {
    host.remove();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  }
});
